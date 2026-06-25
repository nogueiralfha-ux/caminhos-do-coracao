import React, { useState, useEffect } from "react";
import { ChevronLeft, CreditCard, Loader2, Heart, CheckCircle2, QrCode, FileText } from "lucide-react";
import { auth, db } from "../lib/firebase";
import { doc, getDoc, collection, onSnapshot, query, orderBy } from "firebase/firestore";

interface Product {
  id: string;
  name: string;
  desc: string;
  price: string;
  priceValue?: number;
  image?: string;
  isDigital?: boolean;
  cycle?: "MONTHLY" | "YEARLY";
  isSubscription?: boolean;
}

export function CheckoutView({
  onGoHome,
  initialProductId = null,
  subscriptionStatus = "inactive",
}: {
  onGoHome: () => void;
  initialProductId?: string | null;
  subscriptionStatus?: string;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  
  // Opções extras para assinaturas dinâmicas
  const [planCycle, setPlanCycle] = useState<"MONTHLY" | "YEARLY">("MONTHLY");
  
  // Forma de pagamento
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "card" | "boleto">("pix");
  
  // Dados do formulário
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    cpf: "",
    phone: "",
    amount: "50", // apenas para ofertas avulsas
  });

  // Dados do cartão
  const [cardData, setCardData] = useState({
    holderName: "",
    number: "",
    expiry: "",
    cvv: "",
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successResult, setSuccessResult] = useState<any | null>(null);

  // Carrega produtos do Firestore
  useEffect(() => {
    const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const prods: Product[] = [];
      snapshot.forEach((doc) => {
        const d = doc.data();
        prods.push({
          id: doc.id,
          name: d.name || "",
          desc: d.desc || "",
          price: d.price || "",
          priceValue: d.priceValue,
          image: d.image,
          isDigital: d.isDigital,
          cycle: d.cycle,
          isSubscription: d.isSubscription,
        });
      });

      // Inclui doações/apoio como opções de "produto" virtuais para unificar a tela
      prods.push({
        id: "apoio-avulso-unica",
        name: "Oferta Única (Apoio)",
        desc: "Semeadura avulsa na obra Missio Dei",
        price: "Valor customizável",
      });
      prods.push({
        id: "apoio-avulso-mensal",
        name: "Compromisso Mensal (Apoio)",
        desc: "Apoio mensal recorrente na obra Missio Dei",
        price: "Valor customizável",
        cycle: "MONTHLY",
        isSubscription: true,
      });

      // Se for Plus ou Premium da tela de upgrade, representamos como produtos caso faltem
      if (!prods.find(p => p.id === "plano-plus")) {
        prods.unshift({
          id: "plano-plus",
          name: "Plano Plus",
          desc: "Estudos teológicos avançados e Conselheiro Shemá",
          price: "R$ 17,90",
          priceValue: 17.90,
          cycle: "MONTHLY",
          isSubscription: true,
        });
      }
      if (!prods.find(p => p.id === "plano-premium")) {
        prods.unshift({
          id: "plano-premium",
          name: "Plano Premium",
          desc: "Tudo do Plus e 20% OFF permanente na loja",
          price: "R$ 29,90",
          priceValue: 29.90,
          cycle: "MONTHLY",
          isSubscription: true,
        });
      }

      setProducts(prods);

      // Define produto inicial
      if (initialProductId) {
        const found = prods.find(p => p.id === initialProductId);
        if (found) setSelectedProduct(found);
      } else if (prods.length > 0) {
        setSelectedProduct(prods[0]);
      }
    });

    // Pega dados do usuário logado
    if (auth.currentUser) {
      setFormData(prev => ({
        ...prev,
        name: auth.currentUser?.displayName || "",
        email: auth.currentUser?.email || "",
        cpf: localStorage.getItem("checkout_cpf") || "",
        phone: localStorage.getItem("checkout_phone") || "",
      }));
    }

    return () => unsubscribe();
  }, [initialProductId]);

  const handleProductChange = (productId: string) => {
    const found = products.find(p => p.id === productId);
    if (found) {
      setSelectedProduct(found);
      setErrorMsg("");
    }
  };

  const handleProcessCheckout = async () => {
    if (!selectedProduct) return;
    setErrorMsg("");

    if (!formData.name.trim() || !formData.email.trim() || !formData.cpf.trim() || !formData.phone.trim()) {
      setErrorMsg("Preencha todos os campos cadastrais obrigatórios.");
      return;
    }

    const cleanCpf = formData.cpf.replace(/\D/g, "");
    if (cleanCpf.length < 11) {
      setErrorMsg("CPF ou CNPJ inválido.");
      return;
    }

    const cleanPhone = formData.phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      setErrorMsg("WhatsApp com DDD inválido.");
      return;
    }

    // Calcula valor final do produto selecionado
    let finalAmount = 0;
    const isDonation = selectedProduct.id.startsWith("apoio-avulso");
    
    if (isDonation) {
      finalAmount = parseFloat(formData.amount.replace(",", "."));
      if (isNaN(finalAmount) || finalAmount < 10) {
        setErrorMsg("O valor mínimo para doação/apoio é de R$ 10,00.");
        return;
      }
    } else {
      if (selectedProduct.priceValue) {
        finalAmount = selectedProduct.priceValue;
      } else {
        const numStr = selectedProduct.price.replace("R$", "").replace(/\./g, "").replace(",", ".").trim();
        finalAmount = parseFloat(numStr) || 0;
      }
    }

    // Se for assinatura recorrente, verifica ciclo
    const isSubscription = selectedProduct.isSubscription || 
      selectedProduct.cycle === "MONTHLY" || 
      selectedProduct.cycle === "YEARLY" || 
      selectedProduct.name.toLowerCase().includes("plano") || 
      selectedProduct.name.toLowerCase().includes("assinatura");

    let cycle = isSubscription ? (selectedProduct.cycle || planCycle) : undefined;

    // Se o plano for anual e não for doação, multiplica preço
    if (cycle === "YEARLY" && selectedProduct.id === "plano-premium") {
      finalAmount = 299.00; // Valor promocional anual
    } else if (cycle === "YEARLY" && selectedProduct.id === "plano-plus") {
      finalAmount = 179.00;
    }

    // Validação de Cartão
    if (paymentMethod === "card") {
      if (!cardData.holderName.trim() || !cardData.number.replace(/\s/g, "") || !cardData.expiry || !cardData.cvv) {
        setErrorMsg("Preencha todos os campos do Cartão de Crédito.");
        return;
      }
    }

    setLoading(true);

    try {
      // Salva dados locais para conveniência futura
      localStorage.setItem("checkout_cpf", formData.cpf);
      localStorage.setItem("checkout_phone", formData.phone);

      const res = await fetch("/api/asaas/checkout-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selectedProduct.id,
          amount: finalAmount,
          name: formData.name,
          email: formData.email,
          cpf: cleanCpf,
          phone: cleanPhone,
          userId: auth.currentUser?.uid,
          cycle: cycle,
          paymentMethod: paymentMethod.toUpperCase(),
          cardInfo: paymentMethod === "card" ? {
            holderName: cardData.holderName,
            number: cardData.number.replace(/\s/g, ""),
            expiryMonth: cardData.expiry.split("/")[0],
            expiryYear: "20" + cardData.expiry.split("/")[1],
            ccv: cardData.cvv
          } : undefined
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao gerar cobrança.");
      }

      // Se der certo, exibe resultado do pagamento integrado
      setSuccessResult({
        productName: selectedProduct.name,
        amount: finalAmount,
        billingType: paymentMethod,
        invoiceUrl: data.invoiceUrl,
        pixCode: data.pixCode, // Copia e cola gerado
        pixQrCode: data.pixQrCode, // Imagem Base64 QR Code
        bankSlipUrl: data.bankSlipUrl,
        isSuccess: true,
      });

    } catch (err: any) {
      setErrorMsg(err.message || "Erro de conexão ao processar faturamento.");
    } finally {
      setLoading(false);
    }
  };

  if (successResult) {
    return (
      <div className="flex flex-col items-center justify-center text-center px-4 py-8 animate-in zoom-in duration-500 min-h-[70vh]">
        <Heart size={64} className="text-[#FF5A00] mb-6 animate-pulse" fill="#FF5A00" />
        <h2 className="text-2xl font-serif font-bold text-white mb-4">
          Pagamento Gerado!
        </h2>
        <p className="text-gray-300 text-sm mb-6 max-w-sm">
          A transação de <strong>R$ {successResult.amount.toFixed(2)}</strong> referente a <strong>"{successResult.productName}"</strong> foi iniciada com segurança.
        </p>

        {/* PIX QR CODE DIRECT IN INTERFACE */}
        {successResult.billingType === "pix" && (
          <div className="bg-[#1A1A1A] p-6 rounded-[24px] border border-[#FF5A00]/20 flex flex-col items-center mb-6 w-full max-w-sm">
            <span className="text-[#FF5A00] text-xs font-bold uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <QrCode size={16} /> Pague com Pix Instante
            </span>
            {successResult.pixQrCode ? (
              <img 
                src={`data:image/png;base64,${successResult.pixQrCode}`} 
                alt="QR Code Pix"
                className="w-48 h-48 bg-white p-2 rounded-xl mb-4 shadow-lg"
              />
            ) : (
              <div className="w-48 h-48 bg-white/5 rounded-xl flex items-center justify-center text-gray-500 text-xs mb-4">
                QR Code não gerado
              </div>
            )}
            <p className="text-zinc-500 text-[10px] text-center mb-3">Escaneie o QR Code ou copie o código abaixo:</p>
            <textarea
              readOnly
              value={successResult.pixCode || ""}
              onClick={(e) => (e.target as any).select()}
              className="w-full text-xs font-mono bg-black text-[#FF5A00] border border-white/10 rounded-xl p-3 h-16 resize-none outline-none text-center"
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText(successResult.pixCode || "");
                alert("Código Pix Copia e Cola copiado com sucesso!");
              }}
              className="mt-3 text-xs text-[#FF5A00] font-bold uppercase hover:underline"
            >
              Copiar Código Pix
            </button>
          </div>
        )}

        {/* BOLETO BARCODE DIRECT IN INTERFACE */}
        {successResult.billingType === "boleto" && (
          <div className="bg-[#1A1A1A] p-6 rounded-[24px] border border-blue-500/20 flex flex-col items-center mb-6 w-full max-w-sm">
            <span className="text-blue-400 text-xs font-bold uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <FileText size={16} /> Pague com Boleto Bancário
            </span>
            <p className="text-zinc-400 text-xs text-center mb-5 leading-relaxed">
              O boleto foi gerado com sucesso. Clique abaixo para abrir ou fazer o download do PDF.
            </p>
            <a
              href={successResult.bankSlipUrl || successResult.invoiceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-blue-500/10 border border-blue-500/30 text-blue-400 font-bold py-3 rounded-full text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
            >
              Baixar Boleto (PDF)
            </a>
          </div>
        )}

        {/* CREDIT CARD SUCCESS */}
        {successResult.billingType === "card" && (
          <div className="bg-[#1A1A1A] p-6 rounded-[24px] border border-emerald-500/20 flex flex-col items-center mb-6 w-full max-w-sm">
            <CheckCircle2 size={40} className="text-emerald-500 mb-3" />
            <span className="text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">
              Processamento em Andamento
            </span>
            <p className="text-zinc-400 text-xs text-center leading-relaxed">
              Sua solicitação de faturamento via Cartão está sendo processada. Assim que a emissora aprovar, sua liberação ocorrerá automaticamente.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3 w-full max-w-sm mt-4">
          <a
            href={successResult.invoiceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full bg-[#FF5A00] hover:bg-[#E04D00] text-white font-sans font-bold py-3.5 rounded-full text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg"
          >
            Acompanhar no Asaas
          </a>
          <button
            onClick={onGoHome}
            className="w-full bg-white/5 text-gray-300 font-sans font-bold py-3 rounded-full transition-colors text-xs uppercase tracking-wider hover:bg-white/10"
          >
            Voltar ao Início
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-10">
      <div className="mb-1">
        <button
          onClick={onGoHome}
          className="text-[#FF5A00] flex items-center gap-1 mb-3 text-[12px] font-bold uppercase tracking-wider hover:text-white transition-colors cursor-pointer"
        >
          <ChevronLeft size={16} /> Voltar
        </button>
        <h2 className="text-white font-serif text-2xl font-bold mb-1 flex items-center gap-3">
          <CreditCard className="text-[#FF5A00]" /> Área de Pagamento
        </h2>
        <p className="text-gray-400 text-xs leading-relaxed">
          🔒 Pagamento 100% criptografado e seguro. Liberação automática.
        </p>
      </div>

      <div className="bg-[#1A1A1A] p-6 rounded-[24px] border border-white/5 space-y-4">
        {/* Seletor de Produto */}
        <div>
          <label className="text-gray-400 text-[10px] uppercase tracking-widest font-bold mb-1.5 block">Selecione o Produto ou Assinatura</label>
          <select
            value={selectedProduct?.id || ""}
            onChange={(e) => handleProductChange(e.target.value)}
            className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-[#FF5A00] outline-none"
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.price})
              </option>
            ))}
          </select>
        </div>

        {/* Doação Valor customizável */}
        {selectedProduct?.id.startsWith("apoio-avulso") && (
          <div>
            <label className="text-gray-400 text-[10px] uppercase tracking-widest font-bold mb-1.5 block">Valor da Oferta (R$ Min: 10,00)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-bold">R$</span>
              <input
                type="number"
                min="10"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full bg-[#111] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white text-sm focus:border-[#FF5A00] outline-none font-bold"
              />
            </div>
          </div>
        )}

        {/* Seletor Ciclo (Mensal / Anual) para Assinaturas Normais */}
        {selectedProduct && 
         (selectedProduct.isSubscription || selectedProduct.id.includes("plano")) && 
         !selectedProduct.id.startsWith("apoio-avulso") && (
          <div>
            <label className="text-gray-400 text-[10px] uppercase tracking-widest font-bold mb-1.5 block">Periodicidade da Assinatura</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPlanCycle("MONTHLY")}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase transition-all ${
                  planCycle === "MONTHLY" ? "bg-[#FF5A00] text-white" : "bg-[#111] text-gray-400 border border-white/5"
                }`}
              >
                Mensal (R$ {selectedProduct.id === "plano-plus" ? "17,90" : "29,90"}/mês)
              </button>
              <button
                type="button"
                onClick={() => setPlanCycle("YEARLY")}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase transition-all ${
                  planCycle === "YEARLY" ? "bg-[#FF5A00] text-white" : "bg-[#111] text-gray-400 border border-white/5"
                }`}
              >
                Anual (R$ {selectedProduct.id === "plano-plus" ? "179,00" : "299,00"}/ano)
              </button>
            </div>
          </div>
        )}

        {/* Cadastro cliente */}
        <div className="space-y-3 pt-2">
          <p className="text-gray-400 text-[10px] uppercase tracking-widest font-bold border-b border-white/5 pb-1">Seus Dados Cadastrais</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-zinc-400 font-bold mb-1 block">Nome Completo</label>
              <input
                type="text"
                placeholder="Seu nome"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-2.5 text-white text-xs focus:border-[#FF5A00] outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-400 font-bold mb-1 block">E-mail para entrega</label>
              <input
                type="email"
                placeholder="seuemail@exemplo.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-2.5 text-white text-xs focus:border-[#FF5A00] outline-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-zinc-400 font-bold mb-1 block">CPF / CNPJ (Somente números)</label>
              <input
                type="text"
                placeholder="00000000000"
                value={formData.cpf}
                onChange={(e) => setFormData({ ...formData, cpf: e.target.value.replace(/\D/g, "") })}
                className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-2.5 text-white text-xs focus:border-[#FF5A00] outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-400 font-bold mb-1 block">WhatsApp / Celular (Com DDD)</label>
              <input
                type="text"
                placeholder="11999999999"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, "") })}
                className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-2.5 text-white text-xs focus:border-[#FF5A00] outline-none"
              />
            </div>
          </div>
        </div>

        {/* Escolha Método Pagamento */}
        <div className="pt-2">
          <p className="text-gray-400 text-[10px] uppercase tracking-widest font-bold border-b border-white/5 pb-1 mb-2">Forma de Pagamento</p>
          <div className="flex gap-2">
            {(["pix", "card", "boleto"] as const).map((method) => (
              <button
                key={method}
                type="button"
                onClick={() => setPaymentMethod(method)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase transition-all flex items-center justify-center gap-1.5 ${
                  paymentMethod === method ? "bg-[#FF5A00] text-white" : "bg-[#111] text-gray-400 border border-white/5"
                }`}
              >
                {method === "pix" ? "Pix" : method === "card" ? "Cartão" : "Boleto"}
              </button>
            ))}
          </div>
        </div>

        {/* Formulário Cartão Crédito */}
        {paymentMethod === "card" && (
          <div className="bg-[#111] border border-white/10 rounded-2xl p-4 space-y-3 animate-in slide-in-from-top duration-300">
            <div>
              <label className="text-[9px] text-zinc-500 font-bold mb-1 block">Nome Impresso no Cartão</label>
              <input
                type="text"
                placeholder="Ex: LUCIANO A S SILVA"
                value={cardData.holderName}
                onChange={(e) => setCardData({ ...cardData, holderName: e.target.value.toUpperCase() })}
                className="w-full bg-black border border-white/5 rounded-xl px-3 py-2 text-white text-xs focus:border-[#FF5A00] outline-none"
              />
            </div>
            <div>
              <label className="text-[9px] text-zinc-500 font-bold mb-1 block">Número do Cartão</label>
              <input
                type="text"
                maxLength={19}
                placeholder="4000 1234 5678 9010"
                value={cardData.number}
                onChange={(e) => {
                  let v = e.target.value.replace(/\s+/g, "").replace(/[^0-9]/gi, "");
                  let matches = v.match(/\d{4,16}/g);
                  let match = (matches && matches[0]) || "";
                  let parts = [];
                  for (let i = 0, len = match.length; i < len; i += 4) {
                    parts.push(match.substring(i, i + 4));
                  }
                  if (parts.length > 0) {
                    setCardData({ ...cardData, number: parts.join(" ") });
                  } else {
                    setCardData({ ...cardData, number: v });
                  }
                }}
                className="w-full bg-black border border-white/5 rounded-xl px-3 py-2 text-white text-xs focus:border-[#FF5A00] outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[9px] text-zinc-500 font-bold mb-1 block">Validade (MM/AA)</label>
                <input
                  type="text"
                  maxLength={5}
                  placeholder="12/29"
                  value={cardData.expiry}
                  onChange={(e) => {
                    let v = e.target.value.replace(/\D/g, "");
                    if (v.length >= 2) {
                      v = v.substring(0, 2) + "/" + v.substring(2, 4);
                    }
                    setCardData({ ...cardData, expiry: v });
                  }}
                  className="w-full bg-black border border-white/5 rounded-xl px-3 py-2 text-white text-xs focus:border-[#FF5A00] outline-none text-center"
                />
              </div>
              <div>
                <label className="text-[9px] text-zinc-500 font-bold mb-1 block">Cód. Segurança (CVV)</label>
                <input
                  type="text"
                  maxLength={4}
                  placeholder="123"
                  value={cardData.cvv}
                  onChange={(e) => setCardData({ ...cardData, cvv: e.target.value.replace(/\D/g, "") })}
                  className="w-full bg-black border border-white/5 rounded-xl px-3 py-2 text-white text-xs focus:border-[#FF5A00] outline-none text-center"
                />
              </div>
            </div>
          </div>
        )}

        {/* Mensagem de Erro */}
        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-xl">
            <p className="text-red-400 text-xs text-center font-medium">{errorMsg}</p>
          </div>
        )}

        {/* Botão de Finalizar */}
        <button
          onClick={handleProcessCheckout}
          disabled={loading}
          className="w-full bg-[#FF5A00] hover:bg-[#E04D00] text-white font-sans font-bold py-4 rounded-full transition-colors text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {loading ? (
            <Loader2 className="animate-spin" size={18} />
          ) : (
            <CreditCard size={18} />
          )}
          {loading ? "Processando..." : "Finalizar Compra"}
        </button>
      </div>
    </div>
  );
}
