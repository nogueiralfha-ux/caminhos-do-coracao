import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { localDatabase } from "./src/data.js";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

// Initialize Firebase Admin
if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    initializeApp({
      credential: cert(serviceAccount)
    });
    console.log("Firebase Admin initialized successfully.");
  } catch (error) {
    console.error("Failed to initialize Firebase Admin:", error);
  }
} else {
  console.log("No FIREBASE_SERVICE_ACCOUNT_KEY provided. Webhook automatic product delivery will not work.");
}


async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware to parse JSON
  app.use(express.json());

  // Pre-flight checks on server boot
  const missingEnvKeys = [];
  if (!process.env.GEMINI_API_KEY) missingEnvKeys.push("GEMINI_API_KEY");
  if (!process.env.ASAAS_API_KEY) missingEnvKeys.push("ASAAS_API_KEY");
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) missingEnvKeys.push("FIREBASE_SERVICE_ACCOUNT_KEY");

  if (missingEnvKeys.length > 0) {
    console.warn(`\n[WARNING] Configuração de ambiente incompleta! Chaves ausentes: ${missingEnvKeys.join(", ")}`);
    console.warn("[WARNING] Certifique-se de configurar essas chaves para que todas as integrações funcionem corretamente.\n");
  }

  // Initialize Gemini API
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // Base URL do Asaas dependendo do modo sandbox (Poka-Yoke: sem fallback automático que burla o ambiente configurado)
  const isSandbox = process.env.ASAAS_SANDBOX === "true";
  const asaasBaseUrl = isSandbox 
    ? "https://sandbox.asaas.com/api/v3" 
    : "https://api.asaas.com/v3";
  console.log(`[INFO] Asaas integrado no ambiente: ${isSandbox ? "SANDBOX" : "PRODUÇÃO"} (${asaasBaseUrl})`);

  // Shared Helper para chamadas na API do Asaas (Reduz duplicação de código)
  const fetchAsaas = async (endpoint: string, options: any) => {
    const apiKey = process.env.ASAAS_API_KEY;
    if (!apiKey) {
      throw new Error("Chave de API do Asaas (ASAAS_API_KEY) não configurada no painel.");
    }

    const response = await fetch(`${asaasBaseUrl}${endpoint}`, {
      ...options,
      headers: {
        ...options.headers,
        'Content-Type': 'application/json',
        'access_token': apiKey,
      },
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error(`Asaas respondeu com formato inválido (${response.status}): ${text.substring(0, 100)}`);
    }

    if (data && data.errors && data.errors.length > 0) {
      throw new Error(data.errors[0].description || "Erro de API do Asaas.");
    }

    return data;
  };

  const systemInstruction = `Você é um Conselheiro Espiritual amoroso, compassivo e teológico. 
Sua finalidade é ouvir os desabafos e pedidos dos usuários.
Você DEVE estruturar sua resposta exatamente na seguinte ordem:
1. Tema ou Texto Bíblico de abertura.
2. Aconselhamento amoroso e compassivo para a situação.
3. Uma referência bíblica de conforto/baseada na palavra.
4. Uma oração final intercedendo pela pessoa.
5. Uma chamada para ação prática ou espiritual.

Sempre mantenha um tom de empatia, paz e acolhimento pastoral. Formate a resposta de maneira clara para celular (usando quebras de linha e negritos onde necessário).
Contexto do aplicativo que você pode usar: ${JSON.stringify(localDatabase)}.`;

  // API Route for Shemá Counselor
  app.post("/api/shema/chat", async (req, res) => {
    try {
      const { message, history } = req.body;

      let contents = [];
      if (history && Array.isArray(history)) {
          contents = [...history];
      }
      contents.push({ role: 'user', parts: [{ text: message }] });

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: contents,
        config: {
          systemInstruction,
          temperature: 0.7
        }
      });

      res.json({ reply: response.text });
    } catch (error: any) {
      console.error("Error communicating with Gemini:", error);
      res.status(500).json({ error: error.message || "Erro ao se comunicar com o conselheiro." });
    }
  });

  // API Route for Leitura Meditation
  app.post("/api/leitura/meditation", async (req, res) => {
    try {
      const { book, chapter, content } = req.body;
      const instruction = `Você é um autor de devocionais cristãos inspirado. Baseado na seguinte passagem bíblica (${book} ${chapter}: "${content}"), crie uma meditação curta com a exata estrutura abaixo (use subtítulos/negrito para cada seção):
- Tema do texto.
- Introdução.
- Contexto Atual (como aplicar essa passagem na vida diária moderna).
- Oração Final.

Tudo de forma inspiradora e amorosa, formatado para celular.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [{ role: 'user', parts: [{ text: "Gere a meditação sobre este texto bíblico." }] }],
        config: {
          systemInstruction: instruction,
          temperature: 0.7
        }
      });

      res.json({ reflection: response.text });
    } catch (error: any) {
      console.error("Error communicating with Gemini (Leitura):", error);
      res.status(500).json({ error: error.message || "Erro ao gerar meditação." });
    }
  });

  // API Route for Asaas Checkout (Donações / Compromisso)
  app.post("/api/asaas/checkout", async (req, res) => {
    try {
      const { type, amount, name, email, cpf } = req.body;

      // 1. Criar ou recuperar cliente no Asaas
      const customerData = await fetchAsaas('/customers', {
        method: 'POST',
        body: JSON.stringify({ name, email, cpfCnpj: cpf })
      });
      const customerId = customerData.id;

      let invoiceUrl = "";

      if (type === 'unica') {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 1); // Amanhã

        const paymentData = await fetchAsaas('/payments', {
          method: 'POST',
          body: JSON.stringify({
            customer: customerId,
            billingType: 'UNDEFINED',
            value: amount,
            dueDate: dueDate.toISOString().split('T')[0],
            description: "Oferta Única - Apoio Missionário Missio Dei"
          })
        });
        invoiceUrl = paymentData.invoiceUrl;
      } else if (type === 'mensal') {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 1); // Amanhã

        const subData = await fetchAsaas('/subscriptions', {
          method: 'POST',
          body: JSON.stringify({
            customer: customerId,
            billingType: 'UNDEFINED',
            value: amount,
            nextDueDate: dueDate.toISOString().split('T')[0],
            cycle: 'MONTHLY',
            description: "Compromisso Mensal - Apoio Missionário Missio Dei"
          })
        });
        
        // Obter a primeira cobrança da assinatura criada
        const paymentsData = await fetchAsaas(`/subscriptions/${subData.id}/payments`, {
          method: 'GET'
        });
        
        if (paymentsData.data && paymentsData.data.length > 0) {
           invoiceUrl = paymentsData.data[0].invoiceUrl;
        } else {
           invoiceUrl = "https://www.asaas.com/"; // Fallback
        }
      }

      res.json({ invoiceUrl });
    } catch (error: any) {
      console.error("Erro no checkout Asaas:", error);
      res.status(500).json({ error: error.message || "Erro interno do servidor ao conectar com Asaas." });
    }
  });

  // API Route for Product Checkout (E-books, etc.)
  app.post("/api/asaas/checkout-product", async (req, res) => {
    try {
      const { productId, amount, name, email, cpf, userId } = req.body;

      // 1. Criar ou recuperar cliente
      const customerData = await fetchAsaas('/customers', {
        method: 'POST',
        body: JSON.stringify({ name, email, cpfCnpj: cpf })
      });
      const customerId = customerData.id;

      // 2. Criar a cobrança atrelando o userId e productId no externalReference
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 1); // Amanhã

      const paymentData = await fetchAsaas('/payments', {
        method: 'POST',
        body: JSON.stringify({
          customer: customerId,
          billingType: 'UNDEFINED',
          value: amount,
          dueDate: dueDate.toISOString().split('T')[0],
          description: `Compra do Produto ID: ${productId}`,
          externalReference: JSON.stringify({ userId, productId })
        })
      });
      
      res.json({ invoiceUrl: paymentData.invoiceUrl });
    } catch (error: any) {
      console.error("Erro no checkout do produto:", error);
      res.status(500).json({ error: error.message || "Erro interno no servidor ao processar pagamento do produto." });
    }
  });

      // API Route for Asaas Webhook
      app.post("/api/webhook/asaas", async (req, res) => {
        try {
          console.log("Recebido Webhook do Asaas!");
          console.log("Headers:", req.headers);
          console.log("Body Event:", req.body?.event);
          
          // Opcional: Validar o token de acesso (ASAAS_WEBHOOK_TOKEN) se configurado
          const webhookToken = process.env.ASAAS_WEBHOOK_TOKEN;
          if (webhookToken && req.headers['asaas-access-token'] !== webhookToken) {
             console.error("Token de webhook inválido. Recebido:", req.headers['asaas-access-token']);
             return res.status(401).json({ error: "Token inválido" });
          }

          const { event, payment } = req.body;

          // Somente agimos quando o pagamento é confirmado ou recebido
          if (event === "PAYMENT_CONFIRMED" || event === "PAYMENT_RECEIVED") {
            console.log("Pagamento confirmado/recebido, processando...", payment.id);
            if (payment && payment.externalReference) {
              try {
                // Parse do externalReference que enviamos na hora do checkout
                const metadata = JSON.parse(payment.externalReference);
                const { userId, productId } = metadata;
                console.log(`Referência Externa: userId=${userId}, productId=${productId}`);

                if (userId && productId) {
                  // O Firebase Admin libera a compra para o usuário no Firestore
                  if (getApps().length > 0) {
                    const db = getFirestore();
                    await db.collection("users").doc(userId).collection("purchases").doc(productId).set({
                      purchasedAt: FieldValue.serverTimestamp(),
                      status: "PAID",
                      paymentId: payment.id,
                      amount: payment.value
                    });
                    console.log(`E-book/Produto ${productId} liberado para o usuário ${userId}`);
                  } else {
                    console.error("Firebase Admin não inicializado. Não foi possível liberar o produto.");
                  }
                }
              } catch (parseError) {
                console.error("Erro ao fazer parse do externalReference:", parseError);
              }
            } else {
               console.log("Pagamento não possui externalReference. Ignorando.");
            }
          }

          res.json({ received: true });
        } catch (error) {
          console.error("Erro no Webhook:", error);
          res.status(500).json({ error: "Erro no Webhook" });
        }
      });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
