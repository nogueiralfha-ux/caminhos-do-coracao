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
  Eye,
  EyeOff,
  Volume2,
  VolumeX,
  Play,
  Square
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
import { sanitizeHtml } from "../lib/security";

export function DevocionalView({
  onGoHome,
  subscriptionStatus = "inactive",
  trialDaysLeft = null,
  onGoToUpgrade,
}: {
  onGoHome?: () => void;
  subscriptionStatus?: "inactive" | "active" | "premium";
  trialDaysLeft?: number | null;
  onGoToUpgrade?: () => void;
}) {
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

  const isPremiumUser = subscriptionStatus === "active" || subscriptionStatus === "premium" || auth.currentUser?.email?.toLowerCase().trim() === "nogueiralfha@gmail.com";
  const hasActiveTrial = trialDaysLeft !== null && trialDaysLeft > 0;
  const isLocked = !isPremiumUser && !hasActiveTrial;

  const handleShare = () => {
    if (isLocked) {
      alert("Disponível apenas no plano ativo.");
      return;
    }
    const shareText = `*${item.title}*\n_${item.subtitle}_\n\n*Referência:* ${item.reference}\n\n*Introdução:* ${item.intro}\n\n*Ensino:* ${item.ensino}\n\n*Ação:* ${item.acao}\n\nLeia mais no app: ${window.location.origin}`;
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
    window.open(whatsappUrl, "_blank");
  };

  // --- AUDIO BOOK HYBRID SYSTEM (REAL MP3 + TTS FALLBACK) ---
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isRealAudio, setIsRealAudio] = useState(false);
  const [audioSpeed, setAudioSpeed] = useState(1);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Efetua a inicialização e cancelamento de áudios pendentes
  useEffect(() => {
    // Carregar elemento de áudio real
    const audioEl = new Audio();
    audioRef.current = audioEl;

    audioEl.onended = () => {
      setIsPlayingAudio(false);
    };
    audioEl.onerror = () => {
      console.warn("Falha ao reproduzir áudio gravado. Acionando TTS...");
      setIsPlayingAudio(false);
      setIsRealAudio(false);
    };

    return () => {
      window.speechSynthesis.cancel();
      audioEl.pause();
    };
  }, []);

  // Sincroniza velocidade se for áudio real
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = audioSpeed;
    }
  }, [audioSpeed]);

  const toggleAudio = () => {
    if (isLocked) {
      alert("Recurso disponível no Plano Plus.");
      return;
    }

    // Se temos áudio real (MP3 gravado) configurado para este devocional
    if (item.audioUrl) {
      if (!audioRef.current) return;
      
      if (isPlayingAudio) {
        audioRef.current.pause();
        setIsPlayingAudio(false);
      } else {
        // Pausar TTS se estiver falando
        window.speechSynthesis.cancel();

        setIsRealAudio(true);
        // Só define src se for diferente para evitar recarregar
        if (audioRef.current.src !== item.audioUrl) {
          audioRef.current.src = item.audioUrl;
        }
        audioRef.current.playbackRate = audioSpeed;
        audioRef.current.play().then(() => {
          setIsPlayingAudio(true);
        }).catch((err) => {
          console.error("Erro ao tocar áudio real:", err);
          // Fallback para TTS imediato caso a URL falhe
          runTts();
        });
      }
      return;
    }

    // Se não há áudio real, aciona o TTS Sintético
    runTts();
  };

  const runTts = () => {
    setIsRealAudio(false);
    if (isPlayingAudio) {
      window.speechSynthesis.pause();
      setIsPlayingAudio(false);
    } else {
      if (window.speechSynthesis.paused && utteranceRef.current) {
        window.speechSynthesis.resume();
        setIsPlayingAudio(true);
        return;
      }

      window.speechSynthesis.cancel();
      
      const fullText = `
        Devocional de hoje. ${item.title}. 
        Referência bíblica. ${item.reference}. 
        Introdução. ${item.intro}. 
        Ensino. ${item.ensino}. 
        Aplicação. ${item.aplicacao}. 
        Oração. ${item.oracao}. 
        Ação prática para hoje. ${item.acao}.
      `;

      const utterance = new SpeechSynthesisUtterance(fullText);
      utterance.lang = language === "en" ? "en-US" : language === "es" ? "es-ES" : "pt-BR";
      utterance.rate = audioSpeed;

      utterance.onend = () => {
        setIsPlayingAudio(false);
        utteranceRef.current = null;
      };

      utterance.onerror = () => {
        setIsPlayingAudio(false);
        utteranceRef.current = null;
      };

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
      setIsPlayingAudio(true);
    }
  };

  const stopAudio = () => {
    if (isRealAudio && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    } else {
      window.speechSynthesis.cancel();
      utteranceRef.current = null;
    }
    setIsPlayingAudio(false);
  };

  const handleSpeedChange = (speed: number) => {
    setAudioSpeed(speed);
    if (isRealAudio && audioRef.current) {
      audioRef.current.playbackRate = speed;
    } else if (!isRealAudio && utteranceRef.current) {
      const wasPlaying = isPlayingAudio;
      stopAudio();
      if (wasPlaying) {
        setTimeout(() => {
          const fullText = `
            Devocional de hoje. ${item.title}. 
            Referência bíblica. ${item.reference}. 
            Introdução. ${item.intro}. 
            Ensino. ${item.ensino}. 
            Aplicação. ${item.aplicacao}. 
            Oração. ${item.oracao}. 
            Ação prática para hoje. ${item.acao}.
          `;
          const utterance = new SpeechSynthesisUtterance(fullText);
          utterance.lang = language === "en" ? "en-US" : language === "es" ? "es-ES" : "pt-BR";
          utterance.rate = speed;
          utterance.onend = () => {
            setIsPlayingAudio(false);
            utteranceRef.current = null;
          };
          utterance.onerror = () => {
            setIsPlayingAudio(false);
            utteranceRef.current = null;
          };
          utteranceRef.current = utterance;
          window.speechSynthesis.speak(utterance);
          setIsPlayingAudio(true);
        }, 100);
      }
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
        <p className="text-zinc-400 text-sm mb-4 font-medium leading-relaxed">{item.subtitle}</p>

        {/* 🎧 PLAY AUDIO PLAYER (AUDIOBOOK SYSTEM) */}
        <div className="bg-[#111] border border-white/5 rounded-2xl p-4 mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleAudio}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                isPlayingAudio ? "bg-primary-orange text-white" : "bg-white/10 text-white hover:bg-white/20"
              }`}
              title={isPlayingAudio ? "Pausar leitura" : "Ouvir áudio-livro"}
            >
              {isPlayingAudio ? <Volume2 size={18} className="animate-pulse" /> : <Play size={18} className="translate-x-[1px]" />}
            </button>
            {isPlayingAudio && (
              <button
                onClick={stopAudio}
                className="w-8 h-8 rounded-full bg-white/5 text-gray-400 hover:bg-white/10 flex items-center justify-center cursor-pointer transition-colors"
                title="Parar áudio"
              >
                <Square size={12} fill="currentColor" />
              </button>
            )}
            <div>
              <span className="text-xs font-bold text-white block">
                {isPlayingAudio ? "Ouvindo Devocional..." : "Ouvir Devocional"}
              </span>
              <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider block">
                {isLocked ? "🔒 Conteúdo Exclusivo Plus" : item.audioUrl ? "Voz Real Gravada (MP3)" : "Audiobook Nativo AI"}
              </span>
            </div>
          </div>

          {!isLocked && (
            <div className="flex items-center gap-1.5 bg-black/40 px-3 py-1.5 rounded-full border border-white/5">
              <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Velocidade:</span>
              {([1, 1.25, 1.5, 2] as const).map((speed) => (
                <button
                  key={speed}
                  onClick={() => handleSpeedChange(speed)}
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                    audioSpeed === speed ? "bg-primary-orange text-white" : "text-gray-400 hover:text-white"
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          )}
        </div>

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

              {isLocked ? (
                <div className="relative mt-6 p-6 rounded-2xl bg-neutral-darker/50 border border-white/5 text-center flex flex-col items-center">
                  <span className="text-2xl mb-2">🔒</span>
                  <h4 className="text-white text-sm font-bold mb-1.5">Conteúdo Exclusivo do Plano Plus</h4>
                  <p className="text-zinc-400 text-[11px] mb-4 max-w-xs leading-relaxed font-medium">
                    O seu período de teste grátis expirou. Assine o **Plano Plus** por apenas **R$ 17,90/mês** para liberar os estudos teológicos diários, desafios de fé e ações práticas!
                  </p>
                  <button
                    onClick={onGoToUpgrade}
                    className="bg-primary-orange hover:bg-primary-orange-hover text-white text-[10px] font-bold uppercase tracking-wider px-5 py-2.5 rounded-full transition-all active:scale-95 cursor-pointer focus-ring shadow-md"
                  >
                    Liberar Todo Conteúdo
                  </button>
                </div>
              ) : (
                <>
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
                </>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-white/5 flex gap-3">
            <button
              onClick={onGoHome}
              className="flex-1 bg-white/5 hover:bg-white/10 text-white font-sans font-bold py-3.5 rounded-full transition-all flex items-center justify-center gap-2 text-sm uppercase tracking-wider focus-ring cursor-pointer"
            >
              {t('backHome')}
            </button>
            {!isLocked && (
              <button
                onClick={handleShare}
                className="flex-1 bg-primary-orange hover:bg-primary-orange-hover text-white font-sans font-bold py-3.5 rounded-full transition-all flex items-center justify-center gap-2 text-sm uppercase tracking-wider focus-ring cursor-pointer"
              >
                <Share2 size={16} /> {t('shareBtn')}
              </button>
            )}
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
  subscriptionStatus = "inactive",
  onGoToCheckout,
}: {
  onGoHome?: () => void;
  onGoToStore?: () => void;
  hideBackButton?: boolean;
  subscriptionStatus?: "inactive" | "active" | "premium";
  onGoToCheckout?: (productId: string) => void;
}) {
  const { t } = useLanguage();
  const [showGratitude, setShowGratitude] = useState(false);
  const [checkoutType, setCheckoutType] = useState<"unica" | "mensal" | "plus" | "premium" | null>(null);
  const [completedType, setCompletedType] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    cpf: "",
    phone: "",
    amount: "",
  });
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (auth.currentUser) {
      setFormData(prev => ({
        ...prev,
        name: auth.currentUser?.displayName || "",
        email: auth.currentUser?.email || "",
      }));
    }
  }, []);

  const handleProcessPayment = async () => {
    if (!formData.name || !formData.email || !formData.cpf) {
      setErrorMsg("Por favor, preencha todos os campos obrigatórios.");
      return;
    }
    const cleanCpf = formData.cpf.replace(/\D/g, "");
    if (cleanCpf.length < 11) {
      setErrorMsg("Por favor, informe um CPF ou CNPJ válido.");
      return;
    }
    const cleanPhone = formData.phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      setErrorMsg("Por favor, informe um WhatsApp/Celular válido com DDD.");
      return;
    }

    if ((checkoutType === "unica" || checkoutType === "mensal") && !formData.amount) {
      setErrorMsg("Por favor, informe o valor da oferta.");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    
    // Abre a aba antes do await para contornar o bloqueador de popups do navegador
    const newWindow = window.open('about:blank', '_blank');
    
    try {
      let res;
      if (checkoutType === "plus" || checkoutType === "premium") {
        // Fluxo de Assinaturas (Plus e Premium)
        const isPlus = checkoutType === "plus";
        res = await fetch("/api/asaas/checkout-product", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productId: isPlus ? "plano-plus" : "plano-premium",
            amount: isPlus ? 17.90 : 29.90,
            name: formData.name,
            email: formData.email,
            cpf: cleanCpf,
            phone: cleanPhone,
            userId: auth.currentUser?.uid,
            cycle: "MONTHLY"
          }),
        });
      } else {
        // Fluxo de Ofertas (Única ou Mensal de Apoio)
        const amountVal = parseFloat(formData.amount.replace(",", "."));
        if (isNaN(amountVal) || amountVal < 50) {
          if (newWindow) newWindow.close();
          setErrorMsg("O valor mínimo para a oferta é de R$ 50,00.");
          setLoading(false);
          return;
        }

        res = await fetch("/api/asaas/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: checkoutType,
            name: formData.name,
            email: formData.email,
            cpf: cleanCpf,
            amount: amountVal,
          }),
        });
      }

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
      setErrorMsg("Erro de conexão ao processar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const startCheckout = (type: "unica" | "mensal" | "plus" | "premium") => {
    if (onGoToCheckout) {
      if (type === "plus") onGoToCheckout("plano-plus");
      else if (type === "premium") onGoToCheckout("plano-premium");
      else if (type === "unica") onGoToCheckout("apoio-avulso-unica");
      else if (type === "mensal") onGoToCheckout("apoio-avulso-mensal");
      return;
    }
    setCheckoutType(type);
    setErrorMsg("");
    setFormData(prev => ({
      ...prev,
      cpf: localStorage.getItem("checkout_cpf") || "",
      phone: localStorage.getItem("checkout_phone") || "",
      amount: (type === "unica" || type === "mensal") ? "50" : "",
    }));
  };

  if (showGratitude) {
    return (
      <div className="flex flex-col items-center justify-center text-center px-4 py-12 animate-in zoom-in duration-500 min-h-[60vh]">
        <Heart size={80} className="text-[#FF5A00] mb-8 animate-pulse" fill="#FF5A00" />
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
          Sua assinatura ou oferta está sendo processada. Conclua o
          pagamento na aba segura do Asaas que acabou de ser aberta!
        </p>

        {completedType === "premium" && (
          <div className="bg-[#1A1A1A] border border-[#FF5A00]/50 rounded-[24px] p-6 mb-8 w-full max-w-sm shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-transparent via-[#FF5A00] to-transparent" />
            <h3 className="text-white font-bold text-lg mb-2">
              Bem-vindo(a) ao Plano Premium!
            </h3>
            <p className="text-gray-400 text-[13px] mb-5 leading-relaxed">
              Aqui está o seu cupom do Clube de Descontos para a loja:
            </p>
            <div className="bg-black border border-dashed border-[#FF5A00] rounded-xl py-3 px-4 mb-5 flex items-center justify-center">
              <span className="text-[#FF5A00] font-mono font-bold tracking-widest text-xl">
                MISSIO20
              </span>
            </div>
            <button
              onClick={onGoToStore}
              className="w-full bg-[#FF5A00]/10 border border-[#FF5A00]/50 text-[#FF5A00] hover:bg-[#FF5A00] hover:text-white font-bold py-3 rounded-full text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <ShoppingBag size={16} /> Visitar Loja Agora
            </button>
          </div>
        )}

        <button
          onClick={onGoHome}
          className="w-full max-w-sm bg-white/5 text-gray-300 font-sans font-bold py-3.5 rounded-full transition-colors text-sm uppercase tracking-wider hover:bg-white/10 hover:text-white focus:outline-none cursor-pointer"
        >
          {t('backHome')}
        </button>
      </div>
    );
  }

  if (checkoutType) {
    const isPlus = checkoutType === "plus";
    const isPremium = checkoutType === "premium";
    
    return (
      <div className="flex flex-col space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="mb-2">
          <button
            onClick={() => setCheckoutType(null)}
            className="text-[#FF5A00] flex items-center gap-1 mb-4 text-[13px] font-bold uppercase tracking-wider hover:text-white transition-colors cursor-pointer"
          >
            <ChevronLeft size={16} /> {t('back')}
          </button>
          <h2 className="text-white font-serif text-2xl font-bold mb-1">
            {isPlus ? "Assinar Plano Plus" : isPremium ? "Assinar Plano Premium" : checkoutType === "unica" ? "Oferta Única" : "Compromisso Mensal"}
          </h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            {isPlus 
              ? "Confirme seus dados para ativar sua Assinatura do Plano Plus (R$ 17,90/mês)." 
              : isPremium 
              ? "Confirme seus dados para ativar sua Assinatura do Plano Premium (R$ 29,90/mês)." 
              : "Preencha seus dados para prosseguirmos para o ambiente seguro do Asaas."}
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
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full bg-[#1A1A1A] text-white border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-[#FF5A00]/50 text-sm"
          />
          <input
            placeholder="CPF ou CNPJ (apenas números)"
            value={formData.cpf}
            onChange={(e) => setFormData({ ...formData, cpf: e.target.value.replace(/\D/g, "") })}
            className="w-full bg-[#1A1A1A] text-white border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-[#FF5A00]/50 text-sm"
          />
          <input
            placeholder="WhatsApp / Celular (com DDD)"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, "") })}
            className="w-full bg-[#1A1A1A] text-white border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-[#FF5A00]/50 text-sm"
          />
          {(checkoutType === "unica" || checkoutType === "mensal") && (
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-bold">
                R$
              </span>
              <input
                placeholder="Valor"
                type="number"
                step="0.01"
                min="50"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full bg-[#1A1A1A] text-white border border-white/10 rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-[#FF5A00]/50 text-sm font-bold"
              />
            </div>
          )}
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
          className="w-full bg-[#FF5A00] hover:bg-[#E04D00] text-white font-sans font-bold py-3.5 rounded-full transition-colors text-sm uppercase tracking-wider focus:outline-none flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {loading ? (
            <Loader2 className="animate-spin" size={18} />
          ) : (
            <CreditCard size={18} />
          )}
          {loading ? "Preparando..." : "Pagamento Seguro"}
        </button>

        <p className="text-center text-gray-500 text-[11px] px-4 font-medium flex items-center justify-center gap-1.5 opacity-80">
          Você será redirecionado para a página de faturamento seguro do Asaas.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-10">
      <div className="mb-2">
        <h2 className="text-white font-serif text-2xl font-bold mb-1 flex items-center gap-3">
          <Heart className="text-[#FF5A00]" /> Planos e Assinaturas
        </h2>
        <p className="text-gray-400 text-sm leading-relaxed">
          Escolha o plano ideal e ajude a sustentar e propagar a Missio Dei.
        </p>
      </div>

      {/* Plans Section */}
      <div className="grid grid-cols-1 gap-4">
        {/* Plano Plus */}
        <div className="bg-[#1E1E1E] rounded-[24px] p-6 border border-white/5 relative overflow-hidden flex flex-col group hover:border-[#00E5FF]/20 transition-all duration-300">
          <div className="absolute top-0 right-0 left-0 h-[2px] bg-gradient-to-r from-transparent via-[#00E5FF]/40 to-transparent" />
          <div className="flex justify-between items-start mb-4">
            <div>
              <span className="text-[#00E5FF] text-[9px] font-bold uppercase tracking-widest bg-[#00E5FF]/10 px-2.5 py-1 rounded-md mb-2 block w-fit">
                Recomendado
              </span>
              <h3 className="text-2xl font-serif font-bold text-white leading-tight">Plano Plus</h3>
            </div>
            <div className="text-right">
              <span className="text-[#00E5FF] font-serif text-xl font-bold">R$ 17,90</span>
              <span className="text-zinc-500 text-[10px] block">/mês</span>
            </div>
          </div>
          <p className="text-gray-400 text-sm leading-relaxed mb-6">
            Acesso a todo o conteúdo espiritual exclusivo. Perfeito para seu devocional diário.
          </p>
          <div className="bg-black/30 rounded-xl p-4 border border-[#00E5FF]/10 mb-6">
            <ul className="text-zinc-300 text-xs space-y-2">
              <li className="flex items-center gap-2">✓ Devocional Diário Completo</li>
              <li className="flex items-center gap-2">✓ Meditações AI Ilimitadas (Leitura)</li>
              <li className="flex items-center gap-2">✓ Conselheiro Espiritual AI (Shemá) 24h</li>
            </ul>
          </div>
          <button
            onClick={() => startCheckout("plus")}
            className="w-full bg-[#00E5FF]/10 hover:bg-[#00E5FF] text-[#00E5FF] hover:text-black font-sans font-bold py-3.5 rounded-full transition-all text-xs uppercase tracking-widest border border-[#00E5FF]/20 hover:border-[#00E5FF] cursor-pointer"
          >
            Assinar Plano Plus
          </button>
        </div>

        {/* Plano Premium */}
        <div className="bg-gradient-to-br from-[#1E1E1E] to-[#2B2000] rounded-[24px] p-6 border border-[#FFD700]/20 relative overflow-hidden flex flex-col group hover:border-[#FFD700]/40 transition-all duration-300 shadow-xl">
          <div className="absolute top-0 right-0 left-0 h-[2px] bg-gradient-to-r from-transparent via-[#FFD700]/50 to-transparent" />
          <div className="flex justify-between items-start mb-4">
            <div>
              <span className="text-[#FFD700] text-[9px] font-bold uppercase tracking-widest bg-[#FFD700]/10 px-2.5 py-1 rounded-md mb-2 block w-fit">
                Completo
              </span>
              <h3 className="text-2xl font-serif font-bold text-white leading-tight">Plano Premium</h3>
            </div>
            <div className="text-right">
              <span className="text-[#FFD700] font-serif text-xl font-bold">R$ 29,90</span>
              <span className="text-zinc-500 text-[10px] block">/mês</span>
            </div>
          </div>
          <p className="text-gray-400 text-sm leading-relaxed mb-6">
            Conteúdo espiritual completo, clube de benefícios e apoio especial à obra missionária.
          </p>
          <div className="bg-black/30 rounded-xl p-4 border border-[#FFD700]/10 mb-6">
            <ul className="text-[#FFD700] text-xs space-y-2">
              <li className="flex items-center gap-2">✓ Tudo do Plano Plus</li>
              <li className="flex items-center gap-2">✓ Cupom Permanente (20% OFF na Loja)</li>
              <li className="flex items-center gap-2">✓ E-books Grátis nos Lançamentos</li>
              <li className="flex items-center gap-2">✓ Apoiador Destaque da Missio Dei</li>
            </ul>
          </div>
          <button
            onClick={() => startCheckout("premium")}
            className="w-full bg-[#FFD700] hover:bg-[#E6C200] text-black font-sans font-bold py-3.5 rounded-full transition-all text-xs uppercase tracking-widest cursor-pointer shadow-lg"
          >
            Assinar Plano Premium
          </button>
        </div>
      </div>

      {/* Donation Divider & Expandable Support Option */}
      <div className="pt-6 border-t border-white/5">
        <h3 className="text-white font-serif text-lg font-bold mb-2 flex items-center gap-2">
          🌱 Outras Formas de Apoio
        </h3>
        <p className="text-gray-400 text-xs mb-4">
          Prefere fazer uma semeadura direta sem assinatura? Utilize o Apoio Missionário avulso:
        </p>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => startCheckout("unica")}
            className="py-3 px-4 bg-white/5 hover:bg-white/10 text-white rounded-xl text-[11px] font-bold uppercase tracking-wider transition-colors border border-white/5 cursor-pointer text-center"
          >
            Oferta Única
          </button>
          <button
            onClick={() => startCheckout("mensal")}
            className="py-3 px-4 bg-white/5 hover:bg-white/10 text-white rounded-xl text-[11px] font-bold uppercase tracking-wider transition-colors border border-white/5 cursor-pointer text-center"
          >
            Compromisso Mensal
          </button>
        </div>
      </div>
    </div>
  );
}

export function LojaView({
  onGoHome,
  hideBackButton = false,
  onGoToCheckout,
  subscriptionStatus = "inactive",
}: {
  onGoHome?: () => void;
  hideBackButton?: boolean;
  onGoToCheckout?: (productId: string) => void;
  subscriptionStatus?: string;
}) {
  const { t } = useLanguage();
  const [products, setProducts] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [showCheckoutModal, setShowCheckoutModal] = useState<any | null>(null);
  const [cpf, setCpf] = useState(() => localStorage.getItem("checkout_cpf") || "");
  const [phone, setPhone] = useState(() => localStorage.getItem("checkout_phone") || "");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");

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

    if (onGoToCheckout) {
      onGoToCheckout(product.id);
      return;
    }

    setFullName(auth.currentUser.displayName || "");
    setEmail(auth.currentUser.email || "");
    setShowCheckoutModal(product);
  };

  const confirmPurchase = async () => {
    if (!showCheckoutModal) return;
    setError(null);

    if (!fullName.trim()) {
      setError("Por favor, informe seu nome completo.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setError("Por favor, informe um e-mail válido.");
      return;
    }
    const cleanCpf = cpf.replace(/\D/g, "");
    if (cleanCpf.length < 11) {
      setError("Por favor, informe um CPF ou CNPJ válido.");
      return;
    }
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      setError("Por favor, informe um número de celular válido com DDD.");
      return;
    }

    const product = showCheckoutModal;
    setShowCheckoutModal(null);

    // Salva no localStorage para a próxima compra
    localStorage.setItem("checkout_cpf", cpf);
    localStorage.setItem("checkout_phone", phone);
    
    // Abre a aba antes do await para contornar o bloqueador de popups do navegador
    const newWindow = window.open('about:blank', '_blank');

    setBuyingId(product.id);

    // Detecção dinâmica de assinatura
    const isSubscription = product.cycle === "MONTHLY" || product.cycle === "YEARLY" || 
      product.isSubscription ||
      product.name?.toLowerCase().includes("assinatura") ||
      product.name?.toLowerCase().includes("plano") ||
      product.desc?.toLowerCase().includes("mensal") ||
      product.desc?.toLowerCase().includes("anual") ||
      product.price?.toLowerCase().includes("mês") ||
      product.price?.toLowerCase().includes("ano");

    let cycle: "MONTHLY" | "YEARLY" | undefined = undefined;
    if (isSubscription) {
      if (product.cycle === "YEARLY" || product.name?.toLowerCase().includes("anual") || product.desc?.toLowerCase().includes("anual") || product.price?.toLowerCase().includes("ano")) {
        cycle = "YEARLY";
      } else {
        cycle = "MONTHLY";
      }
    }

    // Tentar extrair preço numérico de forma segura
    let parsedPrice = 0;
    if (product.priceValue) {
      parsedPrice = product.priceValue;
    } else {
      const numberString = product.price
        .replace("R$", "")
        .replace(/\./g, "")
        .replace(",", ".")
        .trim();
      parsedPrice = parseFloat(numberString) || 0;
    }

    try {
      const res = await fetch("/api/asaas/checkout-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          amount: parsedPrice,
          name: fullName,
          email: email,
          cpf: cleanCpf,
          phone: cleanPhone,
          userId: auth.currentUser?.uid,
          cycle: cycle
        }),
      });

      const data = await res.json();
      if (res.ok && data.invoiceUrl) {
        if (newWindow) {
          newWindow.location.href = data.invoiceUrl;
        } else {
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
          {showCheckoutModal ? (
            <div className="bg-neutral-card p-6 rounded-2xl border border-white/10 flex flex-col animate-in fade-in zoom-in duration-300">
              <h3 className="text-white text-lg font-bold mb-4 text-center flex items-center justify-center gap-2 font-serif">
                <CreditCard className="text-[#FF5A00]" size={20} /> Checkout Seguro
              </h3>
              
              {/* Product Summary */}
              <div className="flex gap-4 p-3 bg-neutral-darker/60 rounded-xl border border-white/5 mb-4">
                <img 
                  src={showCheckoutModal.image} 
                  alt={showCheckoutModal.name} 
                  className="w-16 h-16 rounded-lg object-cover bg-neutral-darker"
                />
                <div className="flex flex-col justify-center">
                  <span className="text-white text-sm font-bold leading-snug">{showCheckoutModal.name}</span>
                  <span className="text-[#FF5A00] text-sm font-bold mt-1">{showCheckoutModal.price}</span>
                  <span className="text-[10px] text-zinc-500 font-medium mt-0.5">
                    {showCheckoutModal.cycle === "MONTHLY" || showCheckoutModal.name?.toLowerCase().includes("assinatura") || showCheckoutModal.name?.toLowerCase().includes("plano") || showCheckoutModal.desc?.toLowerCase().includes("mensal") || showCheckoutModal.price?.toLowerCase().includes("mês") 
                      ? "Assinatura Recorrente" 
                      : "Pagamento Único"}
                  </span>
                </div>
              </div>

              {/* Form Fields */}
              <div className="space-y-3 mb-5">
                <div>
                  <label className="text-xs text-zinc-400 font-semibold mb-1 block">Nome Completo</label>
                  <input
                    type="text"
                    placeholder="Seu nome completo"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-neutral-darker/60 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-primary-orange/50 focus:ring-1 focus:ring-primary-orange/20 transition-colors font-medium"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 font-semibold mb-1 block">E-mail para entrega</label>
                  <input
                    type="email"
                    placeholder="seuemail@exemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-neutral-darker/60 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-primary-orange/50 focus:ring-1 focus:ring-primary-orange/20 transition-colors font-medium"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-zinc-400 font-semibold mb-1 block">CPF / CNPJ</label>
                    <input
                      type="text"
                      placeholder="000.000.000-00"
                      value={cpf}
                      onChange={(e) => setCpf(e.target.value)}
                      className="w-full bg-neutral-darker/60 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-primary-orange/50 focus:ring-1 focus:ring-primary-orange/20 transition-colors font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 font-semibold mb-1 block">WhatsApp / Celular</label>
                    <input
                      type="text"
                      placeholder="(00) 00000-0000"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full bg-neutral-darker/60 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-primary-orange/50 focus:ring-1 focus:ring-primary-orange/20 transition-colors font-medium"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 w-full">
                <button
                  onClick={() => setShowCheckoutModal(null)}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold uppercase transition-all cursor-pointer focus-ring"
                >
                  Voltar
                </button>
                <button
                  onClick={confirmPurchase}
                  className="flex-1 py-3 bg-primary-orange hover:bg-primary-orange-hover text-white rounded-xl text-xs font-bold uppercase transition-all cursor-pointer focus-ring flex items-center justify-center gap-1"
                >
                  Confirmar e Pagar
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

export function LeituraView({
  onGoHome,
  subscriptionStatus = "inactive",
  trialDaysLeft = null,
  onGoToUpgrade,
}: {
  onGoHome?: () => void;
  subscriptionStatus?: "inactive" | "active" | "premium";
  trialDaysLeft?: number | null;
  onGoToUpgrade?: () => void;
}) {
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

  const isPremiumUser = subscriptionStatus === "active" || subscriptionStatus === "premium" || auth.currentUser?.email?.toLowerCase().trim() === "nogueiralfha@gmail.com";
  const hasActiveTrial = trialDaysLeft !== null && trialDaysLeft > 0;
  const isLocked = !isPremiumUser && !hasActiveTrial;

  const handleShareLeitura = () => {
    const shareText = `*${leituraDoDia.title}*\n_${leituraDoDia.book} ${leituraDoDia.chapter}_\n\n"${leituraDoDia.content}"\n\nLeia mais no app: ${window.location.origin}`;
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
    window.open(whatsappUrl, "_blank");
  };

  const handleShareReflection = () => {
    if (!reflection) return;
    const shareText = `*Meditação: ${leituraDoDia.title}*\n\n${reflection}\n\nLeia mais no app: ${window.location.origin}`;
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
    window.open(whatsappUrl, "_blank");
  };

  const handleMeditar = async () => {
    if (isLocked) return;
    setIsLoading(true);
    try {
      const res = await fetch("/api/leitura/meditation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          book: leituraDoDia.book,
          chapter: leituraDoDia.chapter,
          content: leituraDoDia.content,
          language: language,
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
        <div className="flex flex-col gap-3">
          {isLocked ? (
            <div className="p-5 rounded-2xl bg-neutral-card border border-white/10 text-center flex flex-col items-center">
              <span className="text-xl mb-1">🔒</span>
              <h4 className="text-white text-xs font-bold mb-1">Meditações Exclusivas do Plano Plus</h4>
              <p className="text-zinc-400 text-[10px] mb-3 max-w-xs leading-relaxed">
                Gere estudos e reflexões bíblicas guiadas por Inteligência Artificial assinando o **Plano Plus**.
              </p>
              <div className="flex gap-2 w-full">
                <button
                  onClick={onGoHome}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-white font-sans font-bold py-2.5 rounded-full transition-colors text-[10px] uppercase tracking-wider cursor-pointer"
                >
                  Voltar
                </button>
                <button
                  onClick={onGoToUpgrade}
                  className="flex-1 bg-primary-orange hover:bg-primary-orange-hover text-white font-sans font-bold py-2.5 rounded-full transition-colors text-[10px] uppercase tracking-wider cursor-pointer"
                >
                  Assinar R$ 17,90
                </button>
              </div>
            </div>
          ) : (
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
              __html: sanitizeHtml(
                reflection
                  .replace(/\n{2,}/g, "<br/><br/>")
                  .replace(/\n/g, "<br/>")
                  .replace(
                    /\*\*(.*?)\*\*/g,
                    '<strong class="text-primary-orange">$1</strong>',
                  )
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

export function ShemaView({
  onGoHome,
  subscriptionStatus = "inactive",
  trialDaysLeft = null,
  onGoToUpgrade,
}: {
  onGoHome?: () => void;
  subscriptionStatus?: "inactive" | "active" | "premium";
  trialDaysLeft?: number | null;
  onGoToUpgrade?: () => void;
}) {
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

  const isPremiumUser = subscriptionStatus === "active" || subscriptionStatus === "premium" || auth.currentUser?.email?.toLowerCase().trim() === "nogueiralfha@gmail.com";
  const hasActiveTrial = trialDaysLeft !== null && trialDaysLeft > 0;
  const isLocked = !isPremiumUser && !hasActiveTrial;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (isLocked) return;
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
        body: JSON.stringify({ message: userMsg, history, language: language }),
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
                    __html: sanitizeHtml(
                      msg.text
                        .replace(/\n/g, "<br/>")
                        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                    ),
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
      <div className="pt-3 border-t border-white/5">
        {isLocked ? (
          <div className="p-5 bg-neutral-card rounded-2xl border border-white/10 text-center flex flex-col items-center">
            <span className="text-xl mb-1">🔒</span>
            <h4 className="text-white text-xs font-bold mb-1">Acesso Bloqueado — Teste Expirado</h4>
            <p className="text-zinc-400 text-[10px] mb-4 max-w-sm leading-relaxed font-medium">
              Seus 7 dias gratuitos terminaram. Assine o **Plano Plus** por apenas **R$ 17,90/mês** para continuar sua conversa espiritual com o conselheiro AI!
            </p>
            <div className="flex gap-2 w-full">
              <button
                onClick={onGoHome}
                className="flex-1 bg-white/5 hover:bg-white/10 text-white font-sans font-bold py-2.5 rounded-full transition-colors text-[10px] uppercase tracking-wider cursor-pointer"
              >
                Voltar
              </button>
              <button
                onClick={onGoToUpgrade}
                className="flex-1 bg-primary-orange hover:bg-primary-orange-hover text-white font-sans font-bold py-2.5 rounded-full transition-colors text-[10px] uppercase tracking-wider cursor-pointer font-bold"
              >
                Assinar R$ 17,90
              </button>
            </div>
          </div>
        ) : !hasReceivedResponse ? (
          <div className="flex gap-2">
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
          </div>
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
  onGoToUpgrade,
  hideBackButton = false,
  subscriptionStatus = "inactive",
  trialDaysLeft = null,
}: {
  onGoHome?: () => void;
  onGoAdmin?: () => void;
  onGoToStore?: () => void;
  onGoToUpgrade?: () => void;
  hideBackButton?: boolean;
  subscriptionStatus?: "inactive" | "active" | "premium";
  trialDaysLeft?: number | null;
}) {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const { t, language, setLanguage } = useLanguage();
  const [showLanguageLock, setShowLanguageLock] = useState(false);

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

  const getPlanLabel = () => {
    if (subscriptionStatus === "premium") return "Plano Premium 🌟";
    if (subscriptionStatus === "active") return "Plano Plus ✨";
    if (trialDaysLeft !== null && trialDaysLeft > 0) return "Plano Gratuito (Em Teste)";
    return "Plano Gratuito (Expirado)";
  };

  const getPlanColorClass = () => {
    if (subscriptionStatus === "premium") return "text-[#FFD700]";
    if (subscriptionStatus === "active") return "text-[#00E5FF]";
    if (trialDaysLeft !== null && trialDaysLeft > 0) return "text-[#00D1A0]";
    return "text-red-400";
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
        <p className={`text-xs font-bold uppercase tracking-widest mb-6 ${getPlanColorClass()}`}>
          {getPlanLabel()}
        </p>

        <div className="w-full bg-[#111] border border-white/5 rounded-xl p-4 mb-6">
          <p className="text-gray-400 text-[11px] uppercase tracking-widest font-bold mb-2">
            Sua Assinatura
          </p>
          {subscriptionStatus === "premium" && (
            <p className="text-zinc-300 text-sm leading-relaxed">
              Você está no **Plano Premium**. Todos os recursos de meditação, inteligência Shemá e o Clube de Descontos da loja estão ativos em sua conta.
            </p>
          )}
          {subscriptionStatus === "active" && (
            <p className="text-zinc-300 text-sm leading-relaxed">
              Você está no **Plano Plus**. Todo o conteúdo espiritual de devocionais diários, meditações e o Shemá AI estão 100% liberados.
            </p>
          )}
          {subscriptionStatus === "inactive" && trialDaysLeft !== null && trialDaysLeft > 0 && (
            <div>
              <p className="text-zinc-300 text-sm leading-relaxed mb-3">
                Você está no período de teste de **7 dias grátis**. Restam **{trialDaysLeft} {trialDaysLeft === 1 ? 'dia' : 'dias'}**. Aproveite para testar todo o conteúdo!
              </p>
              {onGoToUpgrade && (
                <button
                  onClick={onGoToUpgrade}
                  className="w-full bg-[#FF5A00]/20 border border-[#FF5A00]/40 text-[#FF5A00] hover:bg-[#FF5A00] hover:text-white font-bold py-2 rounded-lg text-xs uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Garantir Assinatura
                </button>
              )}
            </div>
          )}
          {subscriptionStatus === "inactive" && (trialDaysLeft === null || trialDaysLeft <= 0) && (
            <div>
              <p className="text-zinc-300 text-sm leading-relaxed mb-3">
                Seu período de teste grátis terminou. Assine o Plano Plus ou Premium para liberar os recursos fechados.
              </p>
              {onGoToUpgrade && (
                <button
                  onClick={onGoToUpgrade}
                  className="w-full bg-primary-orange hover:bg-primary-orange-hover text-white font-bold py-2.5 rounded-lg text-xs uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Assinar Plano
                </button>
              )}
            </div>
          )}
        </div>

        <div className="w-full bg-[#111] border border-white/5 rounded-xl p-4 mb-6">
          <p className="text-gray-400 text-[11px] uppercase tracking-widest font-bold mb-3">
            {t("languageSelector")}
          </p>
          <div className="flex gap-2">
            {(["pt", "en", "es"] as Language[]).map((lang) => (
              <button
                key={lang}
                onClick={() => {
                  if (lang !== "pt" && subscriptionStatus !== "premium") {
                    setShowLanguageLock(true);
                  } else {
                    setShowLanguageLock(false);
                    setLanguage(lang);
                  }
                }}
                className={`flex-1 py-2 rounded-lg text-sm font-bold uppercase ${language === lang ? "bg-[#00D1A0] text-black" : "bg-white/5 text-gray-400 hover:bg-white/10"}`}
              >
                {lang}
              </button>
            ))}
          </div>
          {showLanguageLock && (
            <div className="w-full mt-3 p-4 bg-yellow-950/20 border border-yellow-600/30 rounded-xl text-center animate-in fade-in slide-in-from-top-2 duration-300">
              <span className="text-xl mb-1 block">🌎</span>
              <p className="text-white text-xs font-bold mb-1">Modo Multilíngue Exclusivo</p>
              <p className="text-zinc-400 text-[10px] mb-3 leading-relaxed">
                Alternar para Inglês e Espanhol é um recurso exclusivo do **Plano Premium**. Aprofunde sua fé em outros idiomas!
              </p>
              <button
                onClick={onGoToUpgrade}
                className="w-full bg-[#FFD700] hover:bg-[#E6C200] text-black font-bold py-2 rounded-lg text-[10px] uppercase tracking-wider transition-colors cursor-pointer"
              >
                Fazer Upgrade para Premium
              </button>
            </div>
          )}
        </div>

        {onGoToStore && (
          <button
            onClick={onGoToStore}
            className="w-full bg-[#FF5A00] text-white font-sans font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm uppercase tracking-wider hover:bg-[#E04D00] mb-4"
          >
            <ShoppingBag size={16} /> Loja Missionária
          </button>
        )}

        {onGoAdmin && currentUser?.email && currentUser.email.toLowerCase().trim() === "nogueiralfha@gmail.com" && (
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
  const [showPassword, setShowPassword] = useState(false);
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
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#FF5A00]/10 text-[#FF5A00] mb-4 border border-[#FF5A00]/20 animate-pulse">
          <Heart size={32} fill="currentColor" className="opacity-90" />
        </div>
        <h1 className="font-serif font-bold text-3xl mb-2 tracking-tight text-white">
          {t("mainTitle")}
        </h1>
        <p className="font-sans italic text-gray-400 text-sm font-medium">
          {t("mainSubtitle")}
        </p>
      </div>

      <div className="bg-[#1A1A1A] p-6 rounded-[24px] border border-white/5 relative overflow-hidden mb-6 shadow-2xl">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#FF5A00] to-transparent" />

        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center mb-6 animate-in fade-in duration-300">
            <p className="text-red-400 text-[13px] leading-relaxed font-medium">
              {errorMsg}
            </p>
          </div>
        )}

        {resetSent && (
          <div className="bg-[#00D1A0]/10 border border-[#00D1A0]/30 rounded-xl p-4 text-center mb-6 animate-in fade-in duration-300">
            <p className="text-[#00D1A0] text-[13px] leading-relaxed font-medium">
              {t("resetSent")}
            </p>
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-5">
          {!isLogin && (
            <div className="animate-in slide-in-from-top-2 duration-300">
              <label className="text-gray-400 text-[11px] uppercase tracking-widest font-bold mb-1.5 block">
                Nome Completo
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-500">
                  <User size={16} />
                </span>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-[#111] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white text-sm focus:outline-none focus:border-[#FF5A00] focus:ring-1 focus:ring-[#FF5A00] transition-all duration-200 placeholder-gray-600"
                  placeholder="Seu nome completo"
                />
              </div>
            </div>
          )}
          
          <div>
            <label className="text-gray-400 text-[11px] uppercase tracking-widest font-bold mb-1.5 block">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#FF5A00] focus:ring-1 focus:ring-[#FF5A00] transition-all duration-200 placeholder-gray-600"
              placeholder="seu@email.com"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-gray-400 text-[11px] uppercase tracking-widest font-bold block">
                {t("passwordLabel")}
              </label>
              {isLogin && (
                <button
                  type="button"
                  onClick={handleResetPassword}
                  className="text-[#FF5A00] text-[11px] hover:underline transition-colors"
                >
                  {t("forgotPassword")}
                </button>
              )}
            </div>
            
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#111] border border-white/10 rounded-xl pl-4 pr-10 py-3 text-white text-sm focus:outline-none focus:border-[#FF5A00] focus:ring-1 focus:ring-[#FF5A00] transition-all duration-200 placeholder-gray-600"
                placeholder="••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-300 transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-[#FF5A00] to-[#E04D00] text-white font-sans font-bold py-3.5 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 text-sm uppercase tracking-wider hover:opacity-90 active:scale-95 shadow-lg shadow-[#FF5A00]/20 mt-6 disabled:opacity-50 disabled:pointer-events-none"
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
              setShowPassword(false);
            }}
            className="text-gray-400 text-[13px] hover:text-white transition-all font-medium"
          >
            {isLogin ? t("registerBtn") : t("backToLogin")}
          </button>
        </div>
      </div>

      <div className="text-center">
        <p className="text-gray-500 text-xs mb-3">Conheça nossos recursos</p>
        <button
          onClick={onGoToStore}
          className="w-full bg-white/5 text-gray-300 font-sans font-bold py-3.5 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 text-[11px] border border-white/10 uppercase tracking-widest hover:bg-white/10 hover:text-white"
        >
          <ShoppingBag size={16} className="text-[#FF5A00]" /> {t("visitStore")}
        </button>
      </div>
    </div>
  );
}
