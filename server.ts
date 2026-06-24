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

  // Initialize Gemini API
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

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

      const chat = ai.chats.create({
        model: "gemini-3.5-flash",
        config: {
          systemInstruction,
          temperature: 0.7,
        },
      });

      // Se houver histórico, poderíamos reinjetar, mas para simplificar
      // vamos apenas mandar a mensagem nova se não estivermos usando estado.
      // O ideal é passar o history se houver
      
      let contents = [];
      if (history && Array.isArray(history)) {
          contents = [...history];
      }
      contents.push({ role: 'user', parts: [{ text: message }] });

      // @google/genai 2.4.0 não suporta history diretamente em sendMessage no modo fácil sem state, 
      // mas podemos usar generateContent
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: contents,
        config: {
          systemInstruction,
          temperature: 0.7
        }
      });

      res.json({ reply: response.text });
    } catch (error) {
      console.error("Error communicating with Gemini:", error);
      res.status(500).json({ error: "Erro ao se comunicar com o conselheiro." });
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
    } catch (error) {
      console.error("Error communicating with Gemini (Leitura):", error);
      res.status(500).json({ error: "Erro ao gerar meditação." });
    }
  });

  // API Route for Asaas Checkout
  app.post("/api/asaas/checkout", async (req, res) => {
    try {
      const { type, amount, name, email, cpf } = req.body;
      const apiKey = process.env.ASAAS_API_KEY;
      if (!apiKey) {
        return res.status(400).json({ error: "ASAAS_API_KEY não configurada no painel (Secrets) do projeto." });
      }

      let isSandbox = process.env.ASAAS_SANDBOX === "true";
      let asaasUrls = isSandbox 
        ? ["https://sandbox.asaas.com/api/v3", "https://api.asaas.com/v3"] 
        : ["https://api.asaas.com/v3", "https://sandbox.asaas.com/api/v3"];

      // Nova função de suporte com sistema inteligente de fallback e tratamento de erros
      const fetchAsaas = async (endpoint: string, options: any) => {
        let res = await fetch(`${asaasUrls[0]}${endpoint}`, options);
        let text = await res.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          throw new Error(`Asaas devolveu um formato inválido (${res.status}): ${text.substring(0, 50)}...`);
        }
        
        if (data && data.errors && data.errors.length > 0) {
           const desc = data.errors[0].description || "";
           if (desc.toLowerCase().includes("ambiente") || desc.toLowerCase().includes("not belong") || desc.toLowerCase().includes("invalid token") || desc.toLowerCase().includes("chave")) {
              console.log(`Alternando ambiente Asaas URL para: ${asaasUrls[1]}`);
              res = await fetch(`${asaasUrls[1]}${endpoint}`, options);
              text = await res.text();
              try {
                data = JSON.parse(text);
              } catch (e) {
                throw new Error(`Asaas devolveu um formato inválido no fallback (${res.status}): ${text.substring(0, 50)}...`);
              }
           }
        }
        return data;
      };

      // 1. Criar ou recuperar cliente no Asaas
      const customerData = await fetchAsaas('/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'access_token': apiKey },
        body: JSON.stringify({ name, email, cpfCnpj: cpf })
      });
      
      if (customerData.errors) {
        return res.status(400).json({ error: customerData.errors[0].description });
      }
      const customerId = customerData.id;

      let invoiceUrl = "";

      if (type === 'unica') {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 1); // Amanhã

        const paymentData = await fetchAsaas('/payments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'access_token': apiKey },
          body: JSON.stringify({
            customer: customerId,
            billingType: 'UNDEFINED',
            value: amount,
            dueDate: dueDate.toISOString().split('T')[0],
            description: "Oferta Única - Apoio Missionário Missio Dei"
          })
        });
        
        if (paymentData.errors) {
           return res.status(400).json({ error: paymentData.errors[0].description });
        }
        invoiceUrl = paymentData.invoiceUrl;
      } else if (type === 'mensal') {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 1); // Amanhã

        const subData = await fetchAsaas('/subscriptions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'access_token': apiKey },
          body: JSON.stringify({
            customer: customerId,
            billingType: 'UNDEFINED', // Permite escolher o método (cartão, pix, boleto)
            value: amount,
            nextDueDate: dueDate.toISOString().split('T')[0],
            cycle: 'MONTHLY',
            description: "Compromisso Mensal - Apoio Missionário Missio Dei"
          })
        });
        
        if (subData.errors) {
           return res.status(400).json({ error: subData.errors[0].description });
        }
        
        // Para assinaturas o Asaas não retorna a URL diretamente naquele nível, precisamos pegar a primeira cobrança (payment) atrelada
        const paymentsData = await fetchAsaas(`/subscriptions/${subData.id}/payments`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json', 'access_token': apiKey }
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
          const apiKey = process.env.ASAAS_API_KEY;
          if (!apiKey) {
            return res.status(400).json({ error: "ASAAS_API_KEY não configurada." });
          }
    
          let isSandbox = process.env.ASAAS_SANDBOX === "true";
          let asaasUrls = isSandbox 
            ? ["https://sandbox.asaas.com/api/v3", "https://api.asaas.com/v3"] 
            : ["https://api.asaas.com/v3", "https://sandbox.asaas.com/api/v3"];
    
          const fetchAsaas = async (endpoint: string, options: any) => {
            let res = await fetch(`${asaasUrls[0]}${endpoint}`, options);
            let text = await res.text();
            let data;
            try {
              data = JSON.parse(text);
            } catch (e) {
              throw new Error(`Asaas devolveu um formato inválido (${res.status})`);
            }
            if (data && data.errors && data.errors.length > 0) {
               const desc = data.errors[0].description || "";
               if (desc.toLowerCase().includes("ambiente") || desc.toLowerCase().includes("not belong") || desc.toLowerCase().includes("invalid token")) {
                  res = await fetch(`${asaasUrls[1]}${endpoint}`, options);
                  text = await res.text();
                  try {
                    data = JSON.parse(text);
                  } catch (e) {
                    throw new Error(`Asaas devolveu um formato inválido no fallback (${res.status})`);
                  }
               }
            }
            return data;
          };
    
          // 1. Criar ou recuperar cliente
          const customerData = await fetchAsaas('/customers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'access_token': apiKey },
            body: JSON.stringify({ name, email, cpfCnpj: cpf })
          });
          
          if (customerData.errors) {
            return res.status(400).json({ error: customerData.errors[0].description });
          }
          const customerId = customerData.id;
    
          // 2. Criar a cobrança atrelando o userId e productId no externalReference
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + 1); // Amanhã
    
          const paymentData = await fetchAsaas('/payments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'access_token': apiKey },
            body: JSON.stringify({
              customer: customerId,
              billingType: 'UNDEFINED',
              value: amount,
              dueDate: dueDate.toISOString().split('T')[0],
              description: `Compra do Produto ID: ${productId}`,
              externalReference: JSON.stringify({ userId, productId }) // Guardamos quem comprou o quê
            })
          });
          
          if (paymentData.errors) {
             return res.status(400).json({ error: paymentData.errors[0].description });
          }
          
          res.json({ invoiceUrl: paymentData.invoiceUrl });
        } catch (error: any) {
          console.error("Erro no checkout do produto:", error);
          res.status(500).json({ error: error.message || "Erro interno." });
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
