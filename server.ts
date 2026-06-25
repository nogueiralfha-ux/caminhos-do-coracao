import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";
import fs from "fs";
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
  const PORT = Number(process.env.PORT) || 3001;

  // Middleware to parse JSON
  app.use(express.json());

  // Security Headers Middleware (webapp-security)
  app.use((req, res, next) => {
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://www.gstatic.com; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "img-src 'self' data: https://images.unsplash.com https://*.googleapis.com https://*.gstatic.com https://i.ibb.co https://ibb.co https://*.ibb.co; " +
      "connect-src 'self' https://api.asaas.com https://sandbox.asaas.com https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com; " +
      "font-src 'self' https://fonts.gstatic.com; " +
      "frame-src 'self' https://*.firebaseapp.com https://*.web.app; " +
      "object-src 'none';"
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    if (process.env.NODE_ENV === "production" || req.headers["x-forwarded-proto"] === "https") {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    next();
  });

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

  // Carrega devocionais locais para busca inteligente sem custos de API
  let localDevocionais: any[] = [];
  try {
    const devocionaisRaw = fs.readFileSync(path.join(process.cwd(), "src/data/devocionais.json"), "utf-8");
    localDevocionais = JSON.parse(devocionaisRaw);
    console.log(`[INFO] Carregados ${localDevocionais.length} devocionais locais no Shemá.`);
  } catch (error) {
    console.error("[ERROR] Falha ao carregar devocionais.json:", error);
  }

  // API Route for Shemá Counselor
  app.post("/api/shema/chat", async (req, res) => {
    try {
      const { message } = req.body;
      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "Mensagem inválida." });
      }

      // Função de normalização para busca sem acentos/pontuação
      const normalizeText = (text: string) => {
        return text
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, " ")
          .trim();
      };

      const stopWords = new Set([
        "de", "a", "o", "que", "em", "do", "da", "um", "uma", "para", "com", 
        "nao", "se", "por", "mais", "os", "as", "como", "y", "el", "la", "en", 
        "es", "un", "una", "con", "no", "lo", "los", "las", "o", "u", "e", "te", "me"
      ]);

      const userWords = normalizeText(message)
        .split(/\s+/)
        .filter(w => w.length > 2 && !stopWords.has(w));

      let bestDevotional = null;
      let highestScore = 0;

      if (userWords.length > 0) {
        for (const dev of localDevocionais) {
          let score = 0;
          const searchFields = [
            { text: dev.tema, weight: 5 },
            { text: dev.ensino, weight: 2 },
            { text: dev.introducao, weight: 1 },
            { text: dev.aplicacao, weight: 1 },
            { text: dev.referencia, weight: 1 },
            { text: dev.frase, weight: 1 }
          ];

          for (const field of searchFields) {
            if (!field.text) continue;
            const normalizedField = normalizeText(field.text);
            for (const word of userWords) {
              if (normalizedField.includes(word)) {
                score += field.weight;
              }
            }
          }

          if (score > highestScore) {
            highestScore = score;
            bestDevotional = dev;
          }
        }
      }

      // Se não encontrou nenhuma correspondência por palavra-chave, escolhe baseado no dia atual
      if (!bestDevotional && localDevocionais.length > 0) {
        const now = new Date();
        const start = new Date(now.getFullYear(), 0, 0);
        const diff = (now.getTime() - start.getTime()) + ((start.getTimezoneOffset() - now.getTimezoneOffset()) * 60 * 1000);
        const oneDay = 1000 * 60 * 60 * 24;
        const dayOfYear = Math.floor(diff / oneDay);
        
        const index = (dayOfYear - 1) % localDevocionais.length;
        bestDevotional = localDevocionais[index >= 0 ? index : 0];
      }

      if (bestDevotional) {
        const reply = `✨ *Shalom! Que a graça e a paz de nosso Senhor Jesus Cristo estejam com você.* 

Sinto muito por você estar passando por isso. Saiba que seu desabafo foi ouvido e que você está sob o cuidado e o amor do Pai. Ao refletir sobre a sua situação, o Espírito Santo nos direciona a esta preciosa palavra:

📖 **${bestDevotional.tema}**
_${bestDevotional.referencia}_

✨ **Palavra de Sabedoria:**
${bestDevotional.introducao}

${bestDevotional.ensino}

🙏 **Oração Final do Conselheiro:**
Soberano Deus, Pai de amor e misericórdia, eu apresento a vida deste Teu filho(a) diante de Ti agora. Tu conheces as aflições, as lutas silenciosas e o peso que este coração tem carregado. Derrama o Teu Espírito Consolador sobre ele(a). Que a verdade divina de que *"${bestDevotional.frase}"* traga renovo, esperança e paz hoje. Concede a direção certa, acalma a tempestade e fortaleça a sua fé para seguir adiante, sabendo que o Senhor está no controle. Em nome de Jesus, amém.

🌱 **Passo de Fé para Hoje:**
${bestDevotional.acao}
_${bestDevotional.aplicacao}_`;

        return res.json({ reply });
      }

      res.json({ reply: "Shalom! Como posso te ouvir e orar por você hoje?" });
    } catch (error: any) {
      console.error("Error in Shema local search:", error);
      res.status(500).json({ error: "Erro ao se comunicar com o conselheiro local." });
    }
  });

  // API Route for Leitura Meditation
  app.post("/api/leitura/meditation", async (req, res) => {
    try {
      const { book, chapter } = req.body;

      // Encontra devocional pelo dia do ano atual
      const now = new Date();
      const start = new Date(now.getFullYear(), 0, 0);
      const diff = (now.getTime() - start.getTime()) + ((start.getTimezoneOffset() - now.getTimezoneOffset()) * 60 * 1000);
      const oneDay = 1000 * 60 * 60 * 24;
      const dayOfYear = Math.floor(diff / oneDay);
      
      const index = (dayOfYear - 1) % localDevocionais.length;
      const bestDevotional = localDevocionais[index >= 0 ? index : 0];

      if (bestDevotional) {
        const reflection = `📖 **Meditação sobre ${book} ${chapter}**
*(Inspirada no Devocional de Hoje: ${bestDevotional.tema})*

✨ **Tema do Texto:**
${bestDevotional.tema}

✨ **Introdução:**
${bestDevotional.introducao}

✨ **Contexto Atual & Aplicação:**
${bestDevotional.ensino}

${bestDevotional.aplicacao}

🙏 **Oração Final:**
*"${bestDevotional.frase}"* 
Que o Senhor te fortaleça e abençoe os seus passos hoje. Amém.`;

        return res.json({ reflection });
      }

      res.json({ reflection: "Shalom! Que a Palavra do Senhor habite ricamente em seu coração hoje." });
    } catch (error: any) {
      console.error("Error generating local meditation:", error);
      res.status(500).json({ error: "Erro ao gerar meditação local." });
    }
  });

  // API Route to resolve viewer ImgBB link to direct image link
  app.post("/api/admin/process-image", async (req, res) => {
    try {
      const { url } = req.body;
      if (!url) {
        return res.status(400).json({ error: "URL inválida." });
      }

      if (url.includes("ibb.co/") && !url.includes("i.ibb.co")) {
        const response = await fetch(url);
        const html = await response.text();
        const match = html.match(/<meta property="og:image" content="([^"]+)"/);
        if (match && match[1]) {
          return res.json({ directUrl: match[1] });
        }
      }
      return res.json({ directUrl: url });
    } catch (error: any) {
      console.error("Error processing image URL:", error);
      res.status(500).json({ error: "Erro ao processar URL da imagem." });
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

  // API Route for Product Checkout (E-books, subscriptions, etc. with integrated methods)
  app.post("/api/asaas/checkout-product", async (req, res) => {
    try {
      const { productId, amount, name, email, cpf, phone, userId, cycle, paymentMethod, cardInfo } = req.body;

      // 1. Criar ou recuperar cliente
      const customerData = await fetchAsaas('/customers', {
        method: 'POST',
        body: JSON.stringify({ 
          name, 
          email, 
          cpfCnpj: cpf,
          mobilePhone: phone || undefined
        })
      });
      const customerId = customerData.id;

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 1); // Amanhã
      const dueDateString = dueDate.toISOString().split('T')[0];

      // Mapeamento correto de billingType para Asaas
      const billingType = paymentMethod || "UNDEFINED"; // PIX, CREDIT_CARD, BOLETO ou UNDEFINED

      // Dados seguros do Cartão de Crédito
      const creditCard = billingType === "CREDIT_CARD" && cardInfo ? {
        holderName: cardInfo.holderName,
        number: cardInfo.number,
        expiryMonth: cardInfo.expiryMonth,
        expiryYear: cardInfo.expiryYear,
        ccv: cardInfo.ccv
      } : undefined;

      const creditCardHolderInfo = billingType === "CREDIT_CARD" ? {
        name,
        email,
        cpfCnpj: cpf,
        postalCode: "01001000", // CEP genérico para passar na validação de endereço
        addressNumber: "100",
        phone
      } : undefined;

      let invoiceUrl = "";
      let pixCode = "";
      let pixQrCode = "";
      let bankSlipUrl = "";
      let paymentId = "";

      // Se houver um ciclo (MONTHLY ou YEARLY), cria assinatura recorrente
      if (cycle === "MONTHLY" || cycle === "YEARLY") {
        const description = cycle === "MONTHLY" 
          ? `Assinatura Mensal - ${productId}` 
          : `Assinatura Anual - ${productId}`;

        const subData = await fetchAsaas('/subscriptions', {
          method: 'POST',
          body: JSON.stringify({
            customer: customerId,
            billingType: billingType,
            value: amount,
            nextDueDate: dueDateString,
            cycle: cycle,
            description: description,
            externalReference: JSON.stringify({ userId, productId }),
            creditCard,
            creditCardHolderInfo
          })
        });

        // Buscar o primeiro pagamento gerado para obter detalhes
        const paymentsData = await fetchAsaas(`/subscriptions/${subData.id}/payments`, {
          method: 'GET'
        });

        if (paymentsData.data && paymentsData.data.length > 0) {
          const firstPayment = paymentsData.data[0];
          invoiceUrl = firstPayment.invoiceUrl;
          paymentId = firstPayment.id;
          bankSlipUrl = firstPayment.bankSlipUrl || "";
        } else {
          invoiceUrl = "https://www.asaas.com/";
        }
      } else {
        // Pagamento único
        const paymentData = await fetchAsaas('/payments', {
          method: 'POST',
          body: JSON.stringify({
            customer: customerId,
            billingType: billingType,
            value: amount,
            dueDate: dueDateString,
            description: `Compra do Produto ID: ${productId}`,
            externalReference: JSON.stringify({ userId, productId }),
            creditCard,
            creditCardHolderInfo
          })
        });
        invoiceUrl = paymentData.invoiceUrl;
        paymentId = paymentData.id;
        bankSlipUrl = paymentData.bankSlipUrl || "";
      }

      // Se o método de pagamento foi Pix, buscar os dados de QR Code e Copia e Cola instantaneamente
      if (billingType === "PIX" && paymentId) {
        try {
          const qrCodeData = await fetchAsaas(`/payments/${paymentId}/pixQrCode`, {
            method: 'GET'
          });
          pixCode = qrCodeData.payload || "";
          pixQrCode = qrCodeData.encodedImage || "";
        } catch (qrErr) {
          console.error("Falha ao gerar QR Code Pix:", qrErr);
        }
      }
      
      res.json({ 
        invoiceUrl,
        pixCode,
        pixQrCode,
        bankSlipUrl,
        paymentId
      });
    } catch (error: any) {
      console.error("Erro no checkout do produto:", error);
      res.status(500).json({ error: error.message || "Erro interno no servidor ao processar pagamento do produto." });
    }
  });

      // API Route for Asaas Webhook
      app.post("/api/webhook/asaas", async (req, res) => {
        try {
          console.log("Recebido Webhook do Asaas!");
          const { event, payment } = req.body;
          console.log(`[INFO] Evento recebido: ${event} para pagamento ID: ${payment?.id}`);
          
          // Somente agimos quando o pagamento é confirmado ou recebido
          if (event === "PAYMENT_CONFIRMED" || event === "PAYMENT_RECEIVED") {
            console.log("Pagamento confirmado/recebido, processando liberação...", payment.id);
            
            if (payment && payment.externalReference) {
              try {
                // Parse do externalReference que enviamos na hora do checkout
                const metadata = JSON.parse(payment.externalReference);
                const { userId, productId } = metadata;
                console.log(`[INFO] Referência Externa: userId=${userId}, productId=${productId}`);

                if (userId && productId) {
                  // O Firebase Admin libera a compra para o usuário no Firestore
                  if (getApps().length > 0) {
                    const db = getFirestore();
                    
                    // 1. Registra a compra na coleção do usuário
                    await db.collection("users").doc(userId).collection("purchases").doc(productId).set({
                      purchasedAt: FieldValue.serverTimestamp(),
                      status: "PAID",
                      paymentId: payment.id,
                      amount: payment.value
                    });
                    console.log(`[SUCCESS] E-book/Produto ${productId} liberado na coleção do usuário ${userId}`);

                    // 1.5 Busca detalhes do produto para extrair o nome e link de download do PDF
                    let pdfDownloadLink = "";
                    let productRealName = productId;
                    try {
                      const prodDoc = await db.collection("products").doc(productId).get();
                      if (prodDoc.exists) {
                        const prodData = prodDoc.data();
                        productRealName = prodData?.name || productId;
                        pdfDownloadLink = prodData?.pdfUrl || "";
                      }
                    } catch (prodErr) {
                      console.error("[ERROR] Falha ao buscar detalhes do produto no Firestore:", prodErr);
                    }

                    // 2. Recupera dados cadastrais do usuário para envio de notificações
                    const userDoc = await db.collection("users").doc(userId).get();
                    const userData = userDoc.exists ? userDoc.data() : null;
                    const recipientEmail = userData?.email || payment.customerEmail || "luciano.designerux@gmail.com";
                    const recipientName = userData?.fullName || "Irmão(ã)";
                    const recipientPhone = userData?.phone || payment.customerMobilePhone || "";

                    // 3. Atualiza o status de assinatura principal do usuário se for um plano recorrente
                    const isPremium = productId === "premium" || productId === "assinatura_premium" || productId?.toLowerCase().includes("premium");
                    const isPlus = productId === "plus" || productId === "assinatura_plus" || productId?.toLowerCase().includes("plus");

                    if (isPremium) {
                      await db.collection("users").doc(userId).update({
                        subscriptionStatus: "premium"
                      });
                      console.log(`[SUCCESS] Status de Assinatura PREMIUM ativo no perfil do usuário ${userId}`);
                    } else if (isPlus) {
                      await db.collection("users").doc(userId).update({
                        subscriptionStatus: "active"
                      });
                      console.log(`[SUCCESS] Status de Assinatura PLUS ativo no perfil do usuário ${userId}`);
                    }

                    // 4. Envio de E-mail Automático com Resend
                    const resendApiKey = process.env.RESEND_API_KEY;
                    if (resendApiKey) {
                      try {
                        const emailData = {
                          from: "Caminhos do Coracao <onboarding@resend.dev>",
                          to: recipientEmail,
                          subject: "Seu Acesso foi Liberado! 📖 Caminhos do Coração",
                          html: `
                            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 12px;">
                              <h2 style="color: #FF5A00; text-align: center; font-family: serif;">Caminhos do Coração</h2>
                              <p>Olá, <strong>${recipientName}</strong>,</p>
                              <p>Temos a alegria de informar que o seu pagamento referente ao produto <strong>"${productRealName}"</strong> foi confirmado com sucesso!</p>
                              <p>Seu acesso foi liberado de forma totalmente automática no seu perfil no aplicativo.</p>
                              
                              ${isPremium || isPlus 
                                ? `<p>O seu plano de assinatura está ativo. Todo o conteúdo exclusivo, devocionais avançados e o Shemá Multilíngue já estão liberados para você.</p>`
                                : `
                                  <p>Seu e-book/produto digital já está disponível para leitura no aplicativo.</p>
                                  ${pdfDownloadLink 
                                    ? `
                                      <p>Você também pode baixar o arquivo PDF diretamente clicando no botão abaixo:</p>
                                      <div style="text-align: center; margin: 25px 0;">
                                        <a href="${pdfDownloadLink}" style="background-color: #00D1A0; color: white; padding: 12px 24px; text-decoration: none; border-radius: 24px; font-weight: bold; font-size: 13px; display: inline-block;">Baixar E-book (PDF)</a>
                                      </div>
                                    ` 
                                    : ""
                                  }
                                `
                              }

                              <div style="text-align: center; margin: 30px 0;">
                                <a href="${process.env.APP_URL || 'http://localhost:3001'}" style="background-color: #FF5A00; color: white; padding: 12px 24px; text-decoration: none; border-radius: 24px; font-weight: bold; font-size: 14px; display: inline-block;">Acessar Meu Aplicativo</a>
                              </div>
                              
                              <p style="color: #666; font-size: 12px; border-top: 1px solid #eee; padding-top: 15px; margin-top: 25px;">
                                Que o Senhor te abençoe ricamente na sua caminhada espiritual.<br/>
                                <em>Equipe Caminhos do Coração</em>
                              </p>
                            </div>
                          `
                        };

                        await fetch("https://api.resend.com/emails", {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${resendApiKey}`
                          },
                          body: JSON.stringify(emailData)
                        });
                        console.log(`[SUCCESS] E-mail de liberação enviado para ${recipientEmail}`);
                      } catch (emailErr) {
                        console.error("[ERROR] Erro ao enviar e-mail com Resend:", emailErr);
                      }
                    }

                    // 5. WhatsApp Automático (Exemplo configurável usando Gateway Z-API ou similar)
                    const whatsappApiUrl = process.env.WHATSAPP_API_URL;
                    if (whatsappApiUrl && recipientPhone) {
                      try {
                        const cleanPhone = recipientPhone.replace(/\D/g, "");
                        await fetch(whatsappApiUrl, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            phone: cleanPhone,
                            message: `Olá, ${recipientName}! Seu pagamento foi aprovado! 🎉 Seu acesso ao produto *${productRealName}* já está liberado de forma automática no aplicativo Caminhos do Coração. ${pdfDownloadLink ? `Baixe seu PDF diretamente aqui: ${pdfDownloadLink}` : `Acesse pelo link: ${process.env.APP_URL || 'http://localhost:3001'}`}`
                          })
                        });
                        console.log(`[SUCCESS] Notificação WhatsApp enviada para o telefone ${cleanPhone}`);
                      } catch (waErr) {
                        console.error("[ERROR] Erro ao disparar WhatsApp:", waErr);
                      }
                    }

                  } else {
                    console.error("[ERROR] Firebase Admin não inicializado. Não foi possível realizar a liberação automática.");
                  }
                }
              } catch (parseError) {
                console.error("[ERROR] Falha ao fazer parse do externalReference:", parseError);
              }
            } else {
               console.log("[INFO] Pagamento sem referência externa para liberação automática. Ignorando.");
            }
          }
          res.json({ received: true });
        } catch (error) {
          console.error("[ERROR] Erro geral no processamento do webhook Asaas:", error);
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
