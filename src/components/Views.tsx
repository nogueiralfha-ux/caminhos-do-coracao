import React, { useState, useEffect, useRef } from "react";
import {
  Book,
  BookOpen,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ChevronLeft,
  CheckCircle2,
  Circle,
  MessageSquare,
  Send,
  User,
  Bot,
  Loader2,
  Heart,
  Gift,
  CreditCard,
  ShoppingBag,
  LogOut,
  Settings,
  Globe,
  Share2,
} from "lucide-react";
import { databases } from "../data";
import { auth, db } from "../lib/firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  User as FirebaseUser,
  sendPasswordResetEmail,
} from "firebase/auth";
import {
  doc,
  setDoc,
  serverTimestamp,
  collection,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";
import { useLanguage } from "../i18n/Context";
import { Language } from "../i18n/translations";

export function DevocionalView({ onGoHome }: { onGoHome?: () => void }) {
  const { t, language } = useLanguage();
  const today = new Date();
  const formattedDate = today.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const start = new Date(today.getFullYear(), 0, 0);
  const diff = today.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);

  const db = databases[language] || databases.pt;
  const index = (dayOfYear - 1) % db.devocionais.length;
  const item = db.devocionais[index >= 0 ? index : 0];

  const handleShare = async () => {
    const shareText = `*${item.title}*\n_${item.subtitle}_\n\n*Referência:* ${item.reference}\n\n*Introdução:* ${item.intro}\n\n*Ensino:* ${item.ensino}\n\n*Ação:* ${item.acao}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: item.title,
          text: shareText,
          url: window.location.origin,
        });
      } else {
        await navigator.clipboard.writeText(`${item.title} (${item.reference})\n\n"${item.intro}"\n\nLeia mais no app: ${window.location.origin}`);
        alert(t('copied'));
      }
    } catch (err) {
      console.error("Error sharing devotional:", err);
    }
  };

  return (
    <div className="flex flex-col space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="mb-2">
        <h2 className="text-primary-orange font-serif text-2xl font-bold mb-1 flex items-center gap-3">
          <Book className="text-primary-orange/70" /> Devocional
        </h2>
        <p className="text-zinc-400 text-sm font-semibold tracking-wide">
          {t('devotionalDesc')} {formattedDate}.
        </p>
      </div>

      <div className="bg-neutral-card rounded-[24px] p-6 border border-primary-orange/10 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary-orange/50 to-transparent" />
        <div className="inline-block bg-primary-orange/10 text-primary-orange font-bold uppercase tracking-widest text-[9px] px-2.5 py-1 rounded-full mb-3">
          {t('devotionalOfDay')}
        </div>
        <h3 className="text-3xl font-bold font-serif text-white mb-2 leading-tight">
          {item.title}
        </h3>
        <p className="text-zinc-400 text-sm mb-6 font-medium leading-relaxed">{item.subtitle}</p>

        <div className="space-y-6">
          <div>
            <span className="text-primary-orange font-serif italic text-base block mb-4 border-b border-primary-orange/20 pb-2">
              {item.reference}
            </span>
            <div className="space-y-5">
              <div>
                <h4 className="text-zinc-400 font-bold font-sans text-[10px] uppercase tracking-widest mb-1.5">
                  {t('introLabel')}
                </h4>
                <p className="text-zinc-200 text-[15px] leading-[1.7]">
                  {item.intro}
                </p>
              </div>
              <div>
                <h4 className="text-zinc-400 font-bold font-sans text-[10px] uppercase tracking-widest mb-1.5">
                  {t('teachingLabel')}
                </h4>
                <p className="text-zinc-200 text-[15px] leading-[1.7]">
                  {item.ensino}
                </p>
              </div>
              <div>
                <h4 className="text-zinc-400 font-bold font-sans text-[10px] uppercase tracking-widest mb-1.5">
                  {t('appLabel')}
                </h4>
                <p className="text-zinc-200 text-[15px] leading-[1.7]">
                  {item.aplicacao}
                </p>
              </div>
              <div>
                <h4 className="text-zinc-400 font-bold font-sans text-[10px] uppercase tracking-widest mb-2">
                  {t('prayerLabel')}
                </h4>
                <p className="text-zinc-100 text-[16px] leading-[1.7] font-serif italic border-l-2 border-primary-orange pl-4 py-1">
                  {item.oracao}
                </p>
              </div>
              <div className="bg-primary-orange/10 p-5 rounded-2xl mt-6 border border-primary-orange/10">
                <h4 className="text-primary-orange font-bold font-sans text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
                  <CheckCircle2 size={16} /> {t('actionLabel')}
                </h4>
                <p className="text-white text-[15px] leading-[1.7] font-medium">
                  {item.acao}
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-white/5 flex gap-3">
            <button
              onClick={onGoHome}
              className="flex-1 bg-white/5 hover:bg-white/10 text-white font-sans font-bold py-3.5 rounded-full transition-all flex items-center justify-center gap-2 text-sm uppercase tracking-wider focus-ring cursor-pointer"
            >
              {t('backHome')}
            </button>
            <button
              onClick={handleShare}
              className="flex-1 bg-primary-orange hover:bg-primary-orange-hover text-white font-sans font-bold py-3.5 rounded-full transition-all flex items-center justify-center gap-2 text-sm uppercase tracking-wider focus-ring cursor-pointer"
            >
              <Share2 size={16} /> {t('shareBtn')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ApoioView({
  onGoHome,
  onGoToStore,
  hideBackButton = false,
}: {
  onGoHome?: () => void;
  onGoToStore?: () => void;
  hideBackButton?: boolean;
}) {
  const { t } = useLanguage();
  const [showGratitude, setShowGratitude] = useState(false);
  const [checkoutType, setCheckoutType] = useState<"unica" | "mensal" | null>(
    null,
  );
  const [completedType, setCompletedType] = useState<"unica" | "mensal" | null>(
    null,
  );
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    cpf: "",
    amount: "",
  });
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleProcessPayment = async () => {
    if (
      !formData.name ||
      !formData.email ||
      !formData.cpf ||
      !formData.amount
    ) {
      setErrorMsg("Por favor, preencha todos os campos obrigatórios.");
      return;
    }
    setLoading(true);
    setErrorMsg("");
    
    // Abre a aba antes do await para evitar bloqueador de popups
    const newWindow = window.open('about:blank', '_blank');
    
    try {
      const res = await fetch("/api/asaas/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: checkoutType,
          ...formData,
          amount: parseFloat(formData.amount.replace(",", ".")),
        }),
      });
      const data = await res.json();

      if (data.error) {
        if (newWindow) newWindow.close();
        setErrorMsg(data.error);
      } else if (data.invoiceUrl) {
        if (newWindow) {
          newWindow.location.href = data.invoiceUrl;
        } else {
          window.location.href = data.invoiceUrl;
        }
        setCompletedType(checkoutType);
        setCheckoutType(null);
        setShowGratitude(true);
      }
    } catch (err) {
      if (newWindow) newWindow.close();
      setErrorMsg("Erro de conexão ao processar. Tente novamente mais tarde.");
    } finally {
      setLoading(false);
    }
  };

  const startCheckout = (type: "unica" | "mensal") => {
    setCheckoutType(type);
    setErrorMsg("");
    setFormData({
      name: "",
      email: "",
      cpf: "",
      amount: type === "mensal" ? "50" : "",
    });
  };

  if (showGratitude) {
    return (
      <div className="flex flex-col items-center justify-center text-center px-4 py-12 animate-in zoom-in duration-500 min-h-[60vh]">
        <Heart size={80} className="text-[#FF5A00] mb-8" fill="#FF5A00" />
        <h2 className="text-3xl font-serif font-bold text-white mb-6">
          Gratidão!
        </h2>
        <p className="text-[#FF5A00] text-[18px] font-serif italic leading-relaxed mb-6 px-4">
          "Cada um dê conforme determinou em seu coração, não com pesar ou por
          obrigação, pois Deus ama quem dá com alegria."
        </p>
        <p className="text-gray-400 font-bold tracking-widest text-sm uppercase mb-8">
          2 Coríntios 9:7
        </p>
        <p className="text-gray-300 text-sm mb-6 leading-relaxed">
          Sua semente ajuda a espalhar a luz do Evangelho. Por favor, conclua o
          pagamento na aba segura do Asaas que acabou de ser aberta!
        </p>

        {completedType === "mensal" && (
          <div className="bg-[#1A1A1A] border border-[#FF5A00]/50 rounded-[24px] p-6 mb-8 w-full max-w-sm shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-transparent via-[#FF5A00] to-transparent" />
            <h3 className="text-white font-bold text-lg mb-2">
              Bem-vindo(a) aos Mantenedores!
            </h3>
            <p className="text-gray-400 text-[13px] mb-5 leading-relaxed">
              Conforme prometido, aqui está o seu cupom de{" "}
              <strong>20% de desconto</strong> para utilizar em nossa loja:
            </p>
            <div className="bg-black border border-dashed border-[#FF5A00] rounded-xl py-3 px-4 mb-5 flex items-center justify-center">
              <span className="text-[#FF5A00] font-mono font-bold tracking-widest text-xl">
                MISSIO20
              </span>
            </div>
            <button
              onClick={onGoToStore}
              className="w-full bg-[#FF5A00]/10 border border-[#FF5A00]/50 text-[#FF5A00] hover:bg-[#FF5A00] hover:text-white font-bold py-3 rounded-full text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
            >
              <ShoppingBag size={16} /> Visitar Loja Agora
            </button>
          </div>
        )}

        <button
          onClick={onGoHome}
          className="w-full max-w-sm bg-white/5 text-gray-300 font-sans font-bold py-3.5 rounded-full transition-colors text-sm uppercase tracking-wider hover:bg-white/10 hover:text-white focus:outline-none"
        >
          {t('backHome')}
        </button>
      </div>
    );
  }

  if (checkoutType) {
    return (
      <div className="flex flex-col space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="mb-2">
          <button
            onClick={() => setCheckoutType(null)}
            className="text-[#FF5A00] flex items-center gap-1 mb-4 text-[13px] font-bold uppercase tracking-wider hover:text-white transition-colors"
          >
            <ChevronLeft size={16} /> {t('back')}
          </button>
          <h2 className="text-white font-serif text-2xl font-bold mb-1">
            {checkoutType === "unica" ? "Oferta Única" : "Compromisso Mensal"}
          </h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            Preencha seus dados para prosseguirmos para o ambiente seguro do
            Asaas.
          </p>
        </div>

        <div className="space-y-4">
          <input
            placeholder="Nome Completo"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full bg-[#1A1A1A] text-white border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-[#FF5A00]/50 text-sm"
          />
          <input
            placeholder="E-mail"
            type="email"
            value={formData.email}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
            className="w-full bg-[#1A1A1A] text-white border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-[#FF5A00]/50 text-sm"
          />
          <input
            placeholder="CPF ou CNPJ (apenas números)"
            value={formData.cpf}
            onChange={(e) =>
              setFormData({
                ...formData,
                cpf: e.target.value.replace(/\D/g, ""),
              })
            }
            className="w-full bg-[#1A1A1A] text-white border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-[#FF5A00]/50 text-sm"
          />
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-bold">
              R$
            </span>
            <input
              placeholder="Valor"
              type="number"
              step="0.01"
              min="5"
              value={formData.amount}
              onChange={(e) =>
                setFormData({ ...formData, amount: e.target.value })
              }
              className="w-full bg-[#1A1A1A] text-white border border-white/10 rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-[#FF5A00]/50 text-sm font-bold"
            />
          </div>
        </div>

        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-xl">
            <p className="text-red-400 text-sm leading-relaxed text-center font-medium">
              {errorMsg}
            </p>
          </div>
        )}

        <button
          onClick={handleProcessPayment}
          disabled={loading}
          className="w-full bg-[#FF5A00] text-white font-sans font-bold py-3.5 rounded-full transition-colors text-sm uppercase tracking-wider hover:bg-[#E04D00] focus:outline-none flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <Loader2 className="animate-spin" size={18} />
          ) : (
            <CreditCard size={18} />
          )}
          {loading ? "Preparando..." : "Pagamento Seguro"}
        </button>

        <p className="text-center text-gray-500 text-[11px] px-4 font-medium flex items-center justify-center gap-1.5 opacity-80">
          Você será redirecionado para o Checkout Asaas.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="mb-2">
        <h2 className="text-white font-serif text-2xl font-bold mb-1 flex items-center gap-3">
          <Heart className="text-[#FF5A00]" /> Apoio Missionário
        </h2>
        <p className="text-gray-400 text-sm">
          Juntos na expansão do Reino de Deus.
        </p>
      </div>

      {/* Oferta Única */}
      <div className="bg-[#1E1E1E] rounded-[24px] p-6 border border-white/5 relative overflow-hidden">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-[#FF5A00]/20 p-3 rounded-full">
            <Gift className="text-[#FF5A00]" size={24} />
          </div>
          <h3 className="text-xl font-bold font-serif text-white">
            Oferta Única
          </h3>
        </div>
        <p className="text-gray-400 text-[14px] leading-relaxed mb-6">
          Semeie de forma pontual em nossos projetos missionários. Toda oferta é
          revertida para o avanço da Missio Dei.
        </p>
        <button
          onClick={() => startCheckout("unica")}
          className="w-full border border-[#FF5A00]/50 text-[#FF5A00] font-sans font-bold py-3 rounded-full transition-colors text-sm uppercase tracking-wider hover:bg-[#FF5A00]/10 focus:outline-none"
        >
          Ofertar Agora
        </button>
      </div>

      {/* Compromisso Mensal */}
      <div className="bg-gradient-to-br from-[#1E1E1E] to-[#2A1600] rounded-[24px] p-6 border border-[#FF5A00]/30 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 left-0 h-[2px] bg-gradient-to-r from-[#FF5A00]/0 via-[#FF5A00]/80 to-[#FF5A00]/0" />
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-[#FF5A00] p-3 rounded-full">
            <CreditCard className="text-white" size={24} />
          </div>
          <h3 className="text-xl font-bold font-serif text-white">
            Compromisso Mensal
          </h3>
        </div>

        <div className="space-y-3 mb-6">
          <p className="text-gray-300 text-[14px] leading-relaxed">
            Torne-se um mantenedor e faça parte ativa das nossas missões
            mensalmente.
          </p>
          <div className="bg-black/30 rounded-xl p-4 border border-[#FF5A00]/10">
            <h4 className="text-[#FF5A00] text-[11px] uppercase tracking-widest font-bold mb-2">
              Benefícios de ser fiel:
            </h4>
            <ul className="text-gray-400 text-sm space-y-2 list-disc list-inside">
              <li>
                <strong className="text-gray-200">20% de Desconto</strong> na
                Loja Missionária
              </li>
              <li>
                <strong className="text-gray-200">E-book Grátis</strong> a cada
                2 meses de apoio
              </li>
            </ul>
          </div>
        </div>

        <button
          onClick={() => startCheckout("mensal")}
          className="w-full bg-[#FF5A00] text-white font-sans font-bold py-3 rounded-full transition-colors text-sm uppercase tracking-wider hover:bg-[#E04D00] focus:outline-none"
        >
          Assinar Compromisso
        </button>
      </div>
    </div>
  );
}

export function LojaView({
  onGoHome,
  hideBackButton = false,
}: {
  onGoHome?: () => void;
  hideBackButton?: boolean;
}) {
  const { t } = useLanguage();
  const [products, setProducts] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [showCpfPrompt, setShowCpfPrompt] = useState<any | null>(null);
  const [cpf, setCpf] = useState("");

  useEffect(() => {
    // Buscar produtos
    const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
    const unsubscribeProducts = onSnapshot(
      q,
      (snapshot) => {
        const prods: any[] = [];
        snapshot.forEach((doc) => prods.push({ id: doc.id, ...doc.data() }));

        // Adiciona o E-book para testes, caso não exista no banco
        if (!prods.find(p => p.id === "ebook-teste")) {
          prods.unshift({
            id: "ebook-teste",
            tag: "Teste",
            name: "E-book: Os Chamados",
            desc: "Formato Digital PDF",
            price: "R$ 5,00",
            priceValue: 5.00,
            isDigital: true,
            downloadUrl: "https://exemplo.com/ebook.pdf",
            image: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80&w=400&h=400",
          });
        }

        if (prods.length > 0) {
          setProducts(prods);
        } else {
          // Mock inicial se o banco estiver vazio
          setProducts([
            {
              id: "1",
              tag: "Teste",
              name: "E-book: Os Chamados",
              desc: "Formato Digital PDF",
              price: "R$ 5,00",
              priceValue: 5.00, // valor numérico para API
              isDigital: true,
              downloadUrl: "https://exemplo.com/ebook.pdf",
              image: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80&w=400&h=400",
            },
            {
              id: "2",
              tag: "Mais Vendido",
              name: "Camiseta 'Missio Dei'",
              desc: "Algodão premium 100%",
              price: "R$ 69,90",
              priceValue: 69.90,
              image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&q=80&w=400&h=400",
            }
          ]);
        }
        setLoading(false);
      },
      (err) => {
        console.error("Firestore erro na Loja:", err);
        setProducts([
          {
            id: "1",
            tag: "Teste",
            name: "E-book: Os Chamados",
            desc: "Formato Digital PDF",
            price: "R$ 5,00",
            priceValue: 5.00,
            isDigital: true,
            downloadUrl: "https://exemplo.com/ebook.pdf",
            image: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80&w=400&h=400",
          }
        ]);
        setLoading(false);
      }
    );

    // Buscar compras do usuário se logado
    let unsubscribePurchases = () => {};
    if (auth.currentUser) {
      const pQuery = query(collection(db, "users", auth.currentUser.uid, "purchases"));
      unsubscribePurchases = onSnapshot(pQuery, (snapshot) => {
        const owned: string[] = [];
        snapshot.forEach((doc) => {
          if (doc.data().status === "PAID") owned.push(doc.id);
        });
        setPurchases(owned);
      });
    }

    return () => {
      unsubscribeProducts();
      unsubscribePurchases();
    };
  }, []);

  const handleBuy = async (product: any) => {
    setError(null);
    if (!auth.currentUser) {
      setError("Por favor, faça login para comprar.");
      return;
    }

    if (purchases.includes(product.id) && product.isDigital) {
      // Já possui o e-book, baixar
      window.open(product.downloadUrl, "_blank");
      return;
    }

    setShowCpfPrompt(product);
  };

  const confirmPurchase = async () => {
    if (!showCpfPrompt || !cpf) {
      setError("Por favor, informe seu CPF.");
      return;
    }

    const product = showCpfPrompt;
    setShowCpfPrompt(null);
    
    // Abre a aba antes do await para contornar o bloqueador de popups do navegador
    const newWindow = window.open('about:blank', '_blank');

    setBuyingId(product.id);
    try {
      const res = await fetch("/api/asaas/checkout-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          amount: product.priceValue || parseFloat(product.price.replace("R$", "").replace(",", ".")),
          name: auth.currentUser?.displayName || "Usuário do App",
          email: auth.currentUser?.email,
          cpf: cpf.replace(/\D/g, ""), // Limpa caracteres não numéricos
          userId: auth.currentUser?.uid
        }),
      });

      const data = await res.json();
      if (res.ok && data.invoiceUrl) {
        if (newWindow) {
          newWindow.location.href = data.invoiceUrl;
        } else {
          // Fallback caso o navegador tenha bloqueado até a aba about:blank
          window.location.href = data.invoiceUrl;
        }
      } else {
        if (newWindow) newWindow.close();
        setError(data.error || "Erro ao gerar cobrança.");
      }
    } catch (err) {
      if (newWindow) newWindow.close();
      setError("Erro de conexão.");
    } finally {
      setBuyingId(null);
    }
  };

  return (
    <div className="flex flex-col space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-10">
      <div className="mb-2">
        {!hideBackButton && onGoHome && (
          <button
            onClick={onGoHome}
            className="text-[#FF5A00] flex items-center gap-1 mb-4 text-[13px] font-bold uppercase tracking-wider hover:text-white transition-colors cursor-pointer"
          >
            <ChevronLeft size={16} /> {t("back")}
          </button>
        )}
        <h2 className="text-white font-serif text-2xl font-bold mb-1 flex items-center gap-3">
          <ShoppingBag className="text-[#FF5A00]" /> {t("storeTitle")}
        </h2>
        <p className="text-gray-400 text-sm leading-relaxed">
          {t("storeSubtitle")}
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-500 text-sm px-4 py-3 rounded-xl mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-6 h-6 text-[#FF5A00] animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {showCpfPrompt ? (
            <div className="bg-neutral-card p-6 rounded-2xl border border-white/10 flex flex-col items-center animate-in fade-in zoom-in duration-300">
              <h3 className="text-white text-lg font-bold mb-2 text-center">Informe seu CPF/CNPJ</h3>
              <p className="text-zinc-400 text-sm mb-4 text-center font-medium">
                Para processarmos o pagamento do produto "{showCpfPrompt.name}", o Asaas exige um CPF ou CNPJ válido.
              </p>
              <input
                type="text"
                placeholder="000.000.000-00"
                value={cpf}
                onChange={(e) => setCpf(e.target.value)}
                className="w-full bg-neutral-darker/60 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-600 mb-4 focus:outline-none focus:border-primary-orange/50 focus:ring-1 focus:ring-primary-orange/20 transition-colors focus-ring font-medium"
              />
              <div className="flex gap-2 w-full">
                <button
                  onClick={() => setShowCpfPrompt(null)}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-bold uppercase transition-all cursor-pointer focus-ring"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmPurchase}
                  className="flex-1 py-3 bg-primary-orange hover:bg-primary-orange-hover text-white rounded-xl text-sm font-bold uppercase transition-all cursor-pointer focus-ring"
                >
                  Confirmar
                </button>
              </div>
            </div>
          ) : (
            products.map((p) => (
            <div
              key={p.id}
              className="bg-neutral-card rounded-2xl overflow-hidden border border-white/5 flex flex-row group hover:border-primary-orange/30 hover:bg-neutral-card-hover transition-all duration-300"
            >
              <div className="relative w-1/3 min-w-[120px] overflow-hidden bg-neutral-darker">
                {p.tag && (
                  <div className="absolute top-2 left-2 z-10 bg-primary-orange text-white text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md shadow-md">
                    {p.tag}
                  </div>
                )}
                <img
                  src={p.image}
                  alt={p.name}
                  className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
                />
              </div>
              <div className="p-4 flex flex-col justify-center flex-1">
                <h3 className="text-white text-[15px] font-bold leading-tight mb-1">
                  {p.name}
                </h3>
                <p className="text-zinc-400 text-[12px] mb-4 font-medium">{p.desc}</p>

                <div className="flex items-center justify-between mt-auto">
                  <p className="text-primary-orange text-[15px] font-bold">
                    {p.price}
                  </p>
                  <button
                    onClick={() => handleBuy(p)}
                    disabled={buyingId === p.id}
                    className="bg-white/5 hover:bg-primary-orange text-white text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded-lg transition-all border border-white/10 hover:border-primary-orange disabled:opacity-50 cursor-pointer focus-ring active:scale-95"
                  >
                    {buyingId === p.id
                      ? "Aguarde..."
                      : purchases.includes(p.id) && p.isDigital
                      ? "Baixar PDF"
                      : t('buyBtn')}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
        </div>
      )}
    </div>
  );
}

export function LeituraView({ onGoHome }: { onGoHome?: () => void }) {
  const { t, language } = useLanguage();
  const [reflection, setReflection] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const today = new Date();
  const formattedDate = today.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const start = new Date(today.getFullYear(), 0, 0);
  const diff = today.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);

  const db = databases[language] || databases.pt;
  const index = (dayOfYear - 1) % db.leituras.length;
  const leituraDoDia = db.leituras[index >= 0 ? index : 0];

  const handleShareLeitura = async () => {
    const shareText = `*${leituraDoDia.title}*\n_${leituraDoDia.book} ${leituraDoDia.chapter}_\n\n"${leituraDoDia.content}"`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: leituraDoDia.title,
          text: shareText,
          url: window.location.origin,
        });
      } else {
        await navigator.clipboard.writeText(`${leituraDoDia.title} (${leituraDoDia.book} ${leituraDoDia.chapter})\n\n"${leituraDoDia.content}"\n\nLeia mais no app: ${window.location.origin}`);
        alert(t('copied'));
      }
    } catch (err) {
      console.error("Error sharing bible reading:", err);
    }
  };

  const handleShareReflection = async () => {
    if (!reflection) return;
    const shareText = `*Meditação: ${leituraDoDia.title}*\n\n${reflection}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Meditação - ${leituraDoDia.title}`,
          text: shareText,
          url: window.location.origin,
        });
      } else {
        await navigator.clipboard.writeText(`Meditação - ${leituraDoDia.title}\n\n${reflection}\n\nLeia no app: ${window.location.origin}`);
        alert(t('copied'));
      }
    } catch (err) {
      console.error("Error sharing reflection:", err);
    }
  };

  const handleMeditar = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/leitura/meditation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          book: leituraDoDia.book,
          chapter: leituraDoDia.chapter,
          content: leituraDoDia.content,
        }),
      });
      const data = await res.json();
      if (data.reflection) setReflection(data.reflection);
    } catch (e) {
      setReflection(
        "**Erro:** Houve um problema ao gerar a meditação. Tente novamente mais tarde.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="mb-2">
        <h2 className="text-white font-serif text-2xl font-bold mb-1 flex items-center gap-3">
          <BookOpen className="text-white text-opacity-50" /> {t('leituraTitle')}
        </h2>
        <p className="text-zinc-400 text-sm font-medium">
          {t('leituraSubtitle')} {formattedDate}
        </p>
      </div>

      <div
        key={leituraDoDia.id}
        className="bg-white text-black rounded-[24px] p-7 shadow-lg relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 p-4 opacity-5 transform translate-x-2 -translate-y-2">
          <BookOpen size={80} />
        </div>
        <div className="absolute top-4 right-4 z-10">
          <button
            onClick={handleShareLeitura}
            className="p-2.5 bg-black/5 hover:bg-black/10 text-black rounded-full transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-black/25"
            title={t('shareBtn')}
          >
            <Share2 size={16} />
          </button>
        </div>
        <div className="inline-block bg-black/5 text-black font-bold uppercase tracking-widest text-[9px] px-2.5 py-1 rounded-full mb-3 relative z-10">
          {t('leituraOfDay')}
        </div>
        <h3 className="text-2xl font-bold font-serif mb-2 relative z-10 pr-8">
          {leituraDoDia.title}
        </h3>
        <p className="text-black/50 text-[11px] font-bold uppercase tracking-widest mb-5 border-b border-black/10 pb-3 relative z-10">
          {leituraDoDia.book} {leituraDoDia.chapter}
        </p>
        <p className="text-black/80 font-serif leading-[1.8] text-[16px] italic relative z-10">
          "{leituraDoDia.content}"
        </p>
      </div>

      {!reflection && !isLoading && (
        <div className="flex gap-3">
          <button
            onClick={onGoHome}
            className="flex-1 bg-white/5 hover:bg-white/10 text-white font-sans font-bold py-4 rounded-full transition-colors flex items-center justify-center gap-2 text-sm uppercase tracking-wider focus-ring cursor-pointer"
          >
            {t('backHome')}
          </button>
          <button
            onClick={handleMeditar}
            className="flex-[2] bg-primary-orange text-white font-sans font-bold py-4 rounded-full transition-colors flex items-center justify-center gap-2 text-sm uppercase tracking-wider hover:bg-primary-orange-hover focus-ring cursor-pointer"
          >
            <Bot size={20} />
            {t('meditateBtn')}
          </button>
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-8 text-zinc-400 gap-3 text-sm font-medium">
          <Loader2 className="animate-spin text-primary-orange" size={20} />
          <span>{t('meditateLoading')}</span>
        </div>
      )}

      {reflection && (
        <div className="bg-neutral-card rounded-[24px] p-6 border border-primary-orange/20 animate-in fade-in duration-500 shadow-xl overflow-hidden relative">
          <div className="absolute top-0 right-0 left-0 h-[2px] bg-gradient-to-r from-transparent via-primary-orange/50 to-transparent" />
          <div
            className="text-[14px] leading-relaxed mb-6 text-zinc-200 markdown-style"
            dangerouslySetInnerHTML={{
              __html: reflection
                .replace(/\n{2,}/g, "<br/><br/>")
                .replace(/\n/g, "<br/>")
                .replace(
                  /\*\*(.*?)\*\*/g,
                  '<strong class="text-primary-orange">$1</strong>',
                ),
            }}
          />

          <div className="pt-4 border-t border-white/5 flex gap-3">
            <button
              onClick={onGoHome}
              className="flex-1 bg-white/5 hover:bg-white/10 text-zinc-300 font-sans font-bold py-3.5 rounded-full transition-colors flex items-center justify-center gap-2 text-sm uppercase tracking-wider focus-ring cursor-pointer"
            >
              {t('backHome')}
            </button>
            <button
              onClick={handleShareReflection}
              className="flex-1 bg-primary-orange hover:bg-primary-orange-hover text-white font-sans font-bold py-3.5 rounded-full transition-colors flex items-center justify-center gap-2 text-sm uppercase tracking-wider focus-ring cursor-pointer"
            >
              <Share2 size={16} />
              {t('shareBtn')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function DesafioView({ onGoHome }: { onGoHome?: () => void }) {
  const { t, language } = useLanguage();
  const [completed, setCompleted] = useState<number[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);

  const db = databases[language] || databases.pt;

  useEffect(() => {
    const saved = localStorage.getItem("desafios_concluidos");
    if (saved) setCompleted(JSON.parse(saved));
  }, []);

  const toggleDesafio = (id: number) => {
    const updated = completed.includes(id)
      ? completed.filter((c) => c !== id)
      : [...completed, id];
    setCompleted(updated);
    localStorage.setItem("desafios_concluidos", JSON.stringify(updated));
  };

  const handleAccept = () => {
    setShowSuccess(true);
    setTimeout(() => {
      if (onGoHome) onGoHome();
    }, 4500); // Retorna ao início após 4.5 segundos
  };

  if (showSuccess) {
    return (
      <div className="flex flex-col items-center justify-center text-center px-4 py-12 animate-in zoom-in duration-500 min-h-[60vh]">
        <CheckCircle2 size={80} className="text-primary-mint mb-8" />
        <h2 className="text-3xl font-serif font-bold text-white mb-6">
          {t('challengeAccepted')}
        </h2>
        <p className="text-primary-mint text-[20px] font-serif italic leading-relaxed mb-6 px-4">
          {t('challengeQuote')}
        </p>
        <p className="text-zinc-400 font-bold tracking-widest text-sm uppercase">
          {t('challengeRef')}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <h2 className="text-primary-mint font-serif text-2xl font-bold mb-2">
        {t('desafiosTitle')}
      </h2>
      <p className="text-zinc-400 text-sm mb-4 font-medium">
        {t('desafiosSubtitle')}
      </p>
      {db.desafios.map((item) => {
        const isDone = completed.includes(item.id);
        return (
          <div
            key={item.id}
            onClick={() => toggleDesafio(item.id)}
            className={`rounded-[20px] p-5 border transition-all duration-300 cursor-pointer flex gap-4 ${
              isDone 
                ? "bg-primary-mint/10 border-primary-mint/30" 
                : "bg-neutral-card border-white/5 hover:border-primary-mint/40 hover:bg-neutral-card-hover"
            }`}
          >
            <div className="mt-0.5 shrink-0">
              {isDone ? (
                <CheckCircle2 className="text-primary-mint" size={24} />
              ) : (
                <Circle className="text-zinc-500" size={24} />
              )}
            </div>
            <div>
              <h3
                className={`text-[17px] font-bold font-sans mb-1.5 ${isDone ? "text-primary-mint line-through decoration-primary-mint/50" : "text-white"}`}
              >
                {item.title}
              </h3>
              <p
                className={`text-[14px] leading-relaxed ${isDone ? "text-zinc-500" : "text-zinc-300"}`}
              >
                {item.description}
              </p>
            </div>
          </div>
        );
      })}

      <div className="pt-6 mt-4 border-t border-white/5">
        <button
          onClick={handleAccept}
          className="w-full bg-primary-mint hover:bg-primary-mint-hover text-black font-sans font-bold py-4 rounded-full transition-all flex items-center justify-center gap-2 text-sm uppercase tracking-wider focus-ring cursor-pointer"
        >
          <CheckCircle2 size={20} />
          {t('acceptChallengeBtn')}
        </button>
      </div>
    </div>
  );
}

export function ShemaView({ onGoHome }: { onGoHome?: () => void }) {
  const { t, language } = useLanguage();
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([
    {
      role: "model",
      text: t('shemaGreeting'),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasReceivedResponse, setHasReceivedResponse] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: userMsg }]);
    setIsLoading(true);

    try {
      // Build history for the API
      const history = messages.map((msg) => ({
        role: msg.role === "model" ? "model" : "user",
        parts: [{ text: msg.text }],
      }));

      const res = await fetch("/api/shema/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg, history }),
      });

      const data = await res.json();
      if (data.reply) {
        setMessages((prev) => [...prev, { role: "model", text: data.reply }]);
        setHasReceivedResponse(true);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "model",
            text: "Desculpe, não consegui processar sua mensagem agora. Tente novamente mais tarde.",
          },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "model",
          text: "Houve um erro na comunicação. Por favor, confie no Senhor e tente novamente em instantes.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden pb-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="mb-4">
        <h2 className="text-primary-gold font-serif text-2xl font-bold mb-1 flex items-center gap-3">
          <MessageSquare className="text-primary-gold/70" /> {t('shemaCounselor')}
        </h2>
        <p className="text-zinc-400 text-sm font-medium">
          {t('shemaSubtitle')}
        </p>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto mb-4 space-y-4 pr-1 custom-scrollbar">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`flex gap-3.5 max-w-[88%] ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
            >
              <div
                className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${msg.role === "user" ? "bg-primary-orange/25 text-primary-orange" : "bg-primary-gold/25 text-primary-gold"}`}
              >
                {msg.role === "user" ? <User size={15} /> : <Bot size={15} />}
              </div>
              <div
                className={`p-4 rounded-2xl shadow-md ${msg.role === "user" ? "bg-primary-orange text-white rounded-tr-none" : "bg-neutral-card text-zinc-100 border border-primary-gold/10 rounded-tl-none"}`}
              >
                <div
                  className="text-[14px] leading-relaxed markdown-style"
                  dangerouslySetInnerHTML={{
                    __html: msg.text
                      .replace(/\n/g, "<br/>")
                      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>"),
                  }}
                />
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="flex gap-3 max-w-[85%] flex-row">
              <div className="shrink-0 w-8 h-8 rounded-full bg-primary-gold/25 text-primary-gold flex items-center justify-center">
                <Bot size={15} />
              </div>
              <div className="p-4 rounded-2xl bg-neutral-card text-zinc-100 border border-primary-gold/10 rounded-tl-none flex items-center gap-2.5 shadow-md">
                <Loader2 size={15} className="animate-spin text-primary-gold" />
                <span className="text-sm italic text-zinc-400 font-medium">
                  {t('shemaThinking')}
                </span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area / Go Home */}
      <div className="pt-3 border-t border-white/5 flex gap-2">
        {!hasReceivedResponse ? (
          <>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder={t('askShemaPlaceholder')}
              className="flex-1 bg-neutral-card text-white border border-white/10 rounded-full px-5 py-3 text-sm focus:outline-none focus:border-primary-gold/50 transition-colors focus-ring placeholder-zinc-500 font-medium"
              disabled={isLoading}
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="bg-primary-gold text-black w-11 h-11 rounded-full flex items-center justify-center shrink-0 hover:bg-primary-gold-hover transition-colors disabled:opacity-50 cursor-pointer focus-ring active:scale-90"
            >
              <Send
                size={16}
                className="translate-x-[-1px] translate-y-[1px]"
              />
            </button>
          </>
        ) : (
          <button
            onClick={onGoHome}
            className="w-full bg-primary-gold hover:bg-primary-gold-hover text-black font-sans font-bold py-3.5 rounded-full transition-colors flex items-center justify-center gap-2 text-sm uppercase tracking-wider cursor-pointer focus-ring"
          >
            {t('backHome')}
          </button>
        )}
      </div>
    </div>
  );
}

export function ProfileView({
  onGoHome,
  onGoAdmin,
  onGoToStore,
  hideBackButton = false,
}: {
  onGoHome?: () => void;
  onGoAdmin?: () => void;
  onGoToStore?: () => void;
  hideBackButton?: boolean;
}) {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const { t, language, setLanguage } = useLanguage();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    if (onGoHome) onGoHome();
  };

  return (
    <div className="flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-500 pb-10">
      <div className="mb-6">
        {!hideBackButton && onGoHome && (
          <button
            onClick={onGoHome}
            className="text-[#FF5A00] flex items-center gap-1 mb-4 text-[13px] font-bold uppercase tracking-wider hover:text-white transition-colors cursor-pointer"
          >
            <ChevronLeft size={16} /> {t("back")}
          </button>
        )}
        <h2 className="text-white font-serif text-2xl font-bold mb-1 flex items-center gap-3">
          <User className="text-[#00D1A0]" /> {t("profileTitle")}
        </h2>
        <p className="text-gray-400 text-sm leading-relaxed">
          {t("profileSubtitle")}
        </p>
      </div>

      <div className="bg-[#1A1A1A] p-6 rounded-[24px] border border-white/5 relative overflow-hidden flex flex-col items-center">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#00D1A0] to-transparent" />
        <div className="w-16 h-16 bg-[#00D1A0]/20 rounded-full flex items-center justify-center text-[#00D1A0] mb-4">
          <User size={32} />
        </div>
        <p className="text-white font-bold mb-1">{currentUser?.email}</p>
        <p className="text-[#00D1A0] text-xs font-bold uppercase tracking-widest mb-6">
          Plano Gratuito
        </p>

        <div className="w-full bg-[#111] border border-white/5 rounded-xl p-4 mb-6">
          <p className="text-gray-400 text-[11px] uppercase tracking-widest font-bold mb-2">
            Sua Assinatura
          </p>
          <p className="text-gray-300 text-sm leading-relaxed">
            Assinaturas premium não estão ativas no momento. Você será
            notificado quando lançarmos nossa plataforma pro!
          </p>
        </div>

        <div className="w-full bg-[#111] border border-white/5 rounded-xl p-4 mb-6">
          <p className="text-gray-400 text-[11px] uppercase tracking-widest font-bold mb-3">
            {t("languageSelector")}
          </p>
          <div className="flex gap-2">
            {(["pt", "en", "es"] as Language[]).map((lang) => (
              <button
                key={lang}
                onClick={() => setLanguage(lang)}
                className={`flex-1 py-2 rounded-lg text-sm font-bold uppercase ${language === lang ? "bg-[#00D1A0] text-black" : "bg-white/5 text-gray-400 hover:bg-white/10"}`}
              >
                {lang}
              </button>
            ))}
          </div>
        </div>

        {onGoToStore && (
          <button
            onClick={onGoToStore}
            className="w-full bg-[#FF5A00] text-white font-sans font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm uppercase tracking-wider hover:bg-[#E04D00] mb-4"
          >
            <ShoppingBag size={16} /> Loja Missionária
          </button>
        )}

        {onGoAdmin && currentUser?.email === "nogueiralfha@gmail.com" && (
          <button
            onClick={onGoAdmin}
            className="w-full bg-[#FF5A00]/10 text-[#FF5A00] font-sans font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm uppercase tracking-wider hover:bg-[#FF5A00]/20 mb-4"
          >
            <Settings size={16} /> {t("adminPanel")}
          </button>
        )}

        <button
          onClick={handleLogout}
          className="w-full bg-white/5 text-gray-300 font-sans font-bold py-3.5 rounded-full transition-colors flex items-center justify-center gap-2 text-sm uppercase tracking-wider hover:bg-white/10 hover:text-white"
        >
          <LogOut size={16} /> {t("logout")}
        </button>
      </div>
    </div>
  );
}

export function LandingView({ onGoToStore }: { onGoToStore?: () => void }) {
  const { t } = useLanguage();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [resetSent, setResetSent] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    setResetSent(false);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        if (!fullName.trim() || fullName.length < 3) {
          setErrorMsg("Por favor, informe seu nome completo.");
          setLoading(false);
          return;
        }
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password,
        );
        const user = userCredential.user;
        // Salva perfil inicial no Firestore
        await setDoc(doc(db, "users", user.uid), {
          email: user.email,
          fullName: fullName.trim(),
          subscriptionStatus: "inactive",
          createdAt: serverTimestamp(),
        });
      }
    } catch (error: any) {
      console.error(error);
      if (error.code === "auth/invalid-credential") {
        setErrorMsg("Email ou senha incorretos.");
      } else if (error.code === "auth/email-already-in-use") {
        setErrorMsg("Este email já está em uso.");
      } else if (error.code === "auth/weak-password") {
        setErrorMsg("A senha deve ter pelo menos 6 caracteres.");
      } else {
        setErrorMsg("Erro inesperado: " + error.message);
      }
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setErrorMsg(
        "Por favor, digite seu email no campo acima para redefinir a senha.",
      );
      return;
    }
    setLoading(true);
    setErrorMsg("");
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
    } catch (error: any) {
      setErrorMsg("Erro ao enviar email de recuperação: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-full px-6 py-12 justify-center">
      <div className="text-center mb-10">
        <h1 className="font-serif font-bold text-3xl mb-2 tracking-tight">
          {t("mainTitle")}
        </h1>
        <p className="font-sans italic text-gray-400 text-sm font-medium">
          {t("mainSubtitle")}
        </p>
      </div>

      <div className="bg-[#1A1A1A] p-6 rounded-[24px] border border-white/5 relative overflow-hidden mb-6 shadow-2xl">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#FF5A00] to-transparent" />

        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-4 text-center mb-6">
            <p className="text-red-400 text-[13px] leading-relaxed">
              {errorMsg}
            </p>
          </div>
        )}

        {resetSent && (
          <div className="bg-[#00D1A0]/10 border border-[#00D1A0]/50 rounded-xl p-4 text-center mb-6">
            <p className="text-[#00D1A0] text-[13px] leading-relaxed">
              {t("resetSent")}
            </p>
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          {!isLogin && (
            <div className="animate-in fade-in duration-300">
              <label className="text-gray-400 text-[11px] uppercase tracking-widest font-bold mb-1 block">
                Nome Completo
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#FF5A00] transition-colors"
                placeholder="Seu nome"
              />
            </div>
          )}
          <div>
            <label className="text-gray-400 text-[11px] uppercase tracking-widest font-bold mb-1 block">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#FF5A00] transition-colors"
              placeholder="seu@email.com"
            />
          </div>
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-gray-400 text-[11px] uppercase tracking-widest font-bold block">
                {t("passwordLabel")}
              </label>
              {isLogin && (
                <button
                  type="button"
                  onClick={handleResetPassword}
                  className="text-[#FF5A00] text-[11px] hover:underline"
                >
                  {t("forgotPassword")}
                </button>
              )}
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#FF5A00] transition-colors"
              placeholder="••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#FF5A00] text-white font-sans font-bold py-3.5 rounded-full transition-colors flex items-center justify-center gap-2 text-sm uppercase tracking-wider hover:bg-[#E04D00] mt-4 disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            {isLogin ? t("loginBtn") : t("createAccountBtn")}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setErrorMsg("");
            }}
            className="text-gray-400 text-[13px] hover:text-white transition-colors"
          >
            {isLogin ? t("registerBtn") : t("backToLogin")}
          </button>
        </div>
      </div>

      <div className="text-center">
        <p className="text-gray-500 text-xs mb-3">Conheça nossos recursos</p>
        <button
          onClick={onGoToStore}
          className="w-full bg-white/5 text-gray-300 font-sans font-bold py-3.5 rounded-full transition-colors flex items-center justify-center gap-2 text-[11px] border border-white/10 uppercase tracking-widest hover:bg-white/10 hover:text-white"
        >
          <ShoppingBag size={16} className="text-[#FF5A00]" /> {t("visitStore")}
        </button>
      </div>
    </div>
  );
}
