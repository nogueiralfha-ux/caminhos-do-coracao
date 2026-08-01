import {
  Book,
  BookOpen,
  CheckCircle,
  MessageSquare,
  Home,
  ChevronLeft,
  ShoppingBag,
  User,
  WifiOff,
  Download,
  Volume2,
  Play,
  Square,
  Music,
} from "lucide-react";
import React, { useState, useEffect, useRef } from "react";
import {
  DevocionalView,
  LeituraView,
  DesafioView,
  ShemaView,
  ApoioView,
  LojaView,
  ProfileView,
  LandingView,
} from "./components/Views";
import { AdminView } from "./components/AdminView";
import { CheckoutView } from "./components/CheckoutView";
import { auth, db } from "./lib/firebase";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { useLanguage } from "./i18n/Context";
import { databases } from "./data";


export default function App() {
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState("home");
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // Mantém a animação de splash na tela por 3.2 segundos
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 3200);
    return () => clearTimeout(timer);
  }, []);
  
  // Estados de Assinatura e Trial
  const [subscriptionStatus, setSubscriptionStatus] = useState<"inactive" | "active" | "premium">("inactive");
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null);

  // --- SISTEMA DE ÁUDIO DE CONVITE DIÁRIO (BEM-VINDO) ---
  const [isPlayingInvite, setIsPlayingInvite] = useState(false);
  const [isInviteRealAudio, setIsInviteRealAudio] = useState(true);
  const inviteAudioRef = useRef<HTMLAudioElement | null>(null);
  const inviteUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Parar áudio se trocar de aba
  useEffect(() => {
    stopInviteAudio();
  }, [activeTab]);

  // Autoplay do áudio de convite na inicialização (durante a tela de splash)
  useEffect(() => {
    const hasPlayed = sessionStorage.getItem("welcome_audio_played");
    if (!hasPlayed) {
      sessionStorage.setItem("welcome_audio_played", "true");
      
      const timer = setTimeout(() => {
        toggleInviteAudio();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, []);


  const stopInviteAudio = () => {
    if (inviteAudioRef.current) {
      inviteAudioRef.current.pause();
      inviteAudioRef.current.currentTime = 0;
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    inviteUtteranceRef.current = null;
    setIsPlayingInvite(false);
  };

  const toggleInviteAudio = () => {
    if (isPlayingInvite) {
      stopInviteAudio();
      return;
    }

    const audioUrls = [
      `/apresentacao.mp3`,
      `/audios/apresentacao.mp3`,
      `/apresentacao_caminhos_do_coracao.mp3`,
      `/audios/apresentacao_caminhos_do_coracao.mp3`
    ];

    if (!inviteAudioRef.current) {
      const audioEl = new Audio();
      inviteAudioRef.current = audioEl;
      
      audioEl.onended = () => {
        setIsPlayingInvite(false);
      };
      
      let currentUrlIndex = 0;
      audioEl.onerror = () => {
        currentUrlIndex++;
        if (currentUrlIndex < audioUrls.length) {
          console.warn(`Áudio não encontrado em ${audioEl.src}. Tentando próxima rota: ${audioUrls[currentUrlIndex]}`);
          audioEl.src = audioUrls[currentUrlIndex];
          audioEl.play().then(() => {
            setIsPlayingInvite(true);
            setIsInviteRealAudio(true);
          }).catch(() => {
            audioEl.dispatchEvent(new Event('error'));
          });
        } else {
          console.warn("Nenhuma rota de áudio de apresentação funcionou.");
          setIsPlayingInvite(false);
        }
      };
    }

    setIsInviteRealAudio(true);
    
    const firstUrl = audioUrls[0];
    inviteAudioRef.current.src = firstUrl;
    
    let playAttemptUrlIndex = 0;
    const playNextAvailable = () => {
      if (!inviteAudioRef.current) return;
      inviteAudioRef.current.play()
        .then(() => {
          setIsPlayingInvite(true);
        })
        .catch((err) => {
          playAttemptUrlIndex++;
          if (playAttemptUrlIndex < audioUrls.length) {
            inviteAudioRef.current.src = audioUrls[playAttemptUrlIndex];
            playNextAvailable();
          } else {
            setIsPlayingInvite(false);
          }
        });
    };

    playNextAvailable();
  };


  const navItems = [
    { id: "home", label: t("navHome"), icon: Home },
    { id: "devocional", label: t("navDevocional"), icon: Book },
    { id: "leitura", label: t("navLeitura"), icon: BookOpen },
    { id: "shema", label: t("navShema"), icon: MessageSquare },
    { id: "perfil", label: t("navProfile"), icon: User },
  ];

  useEffect(() => {
    let unsubscribeProfile = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        if (u.email && u.email.toLowerCase().trim() === "nogueiralfha@gmail.com") {
          setSubscriptionStatus("premium");
          setTrialDaysLeft(null);
          setAuthLoading(false);
          return;
        }
        // Escutar perfil no Firestore
        const docRef = doc(db, "users", u.uid);
        unsubscribeProfile = onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setSubscriptionStatus(data.subscriptionStatus || "inactive");
            
            // Calcular dias de teste (trial) restantes de forma precisa
            if (data.createdAt) {
              const createdDate = data.createdAt.toDate 
                ? data.createdAt.toDate() 
                : new Date(data.createdAt);
              const diffTime = Math.max(0, new Date().getTime() - createdDate.getTime());
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              const daysLeft = Math.max(0, 7 - (diffDays - 1)); // 7 dias de trial
              setTrialDaysLeft(daysLeft);
            } else {
              setTrialDaysLeft(7);
            }
          } else {
            setSubscriptionStatus("inactive");
            setTrialDaysLeft(7);
          }
        });
      } else {
        setSubscriptionStatus("inactive");
        setTrialDaysLeft(null);
        unsubscribeProfile();
      }
      setAuthLoading(false);
    });

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    return () => {
      unsubscribeAuth();
      unsubscribeProfile();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User PWA installation outcome: ${outcome}`);
    setDeferredPrompt(null);
  };

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

  const dbData = databases[language || "pt"] || databases.pt;
  const devocionalIndex = (dayOfYear - 1) % dbData.devocionais.length;
  const todayDevocional = dbData.devocionais[devocionalIndex >= 0 ? devocionalIndex : 0];


  const cards = [
    {
      id: "devocional",
      title: t("cardDevocionalTitle"),
      subtitle: t("cardDevocionalSub"),
      buttonText: t("cardDevocionalBtn"),
      buttonColor: "bg-primary-orange text-white hover:bg-primary-orange-hover",
      glow: "from-primary-orange via-primary-orange/40 to-transparent",
      icon: Book,
    },
    {
      id: "leitura",
      title: t("cardLeituraTitle"),
      subtitle: `${t("cardLeituraSub")} ${formattedDate}`,
      buttonText: t("cardLeituraBtn"),
      buttonColor: "bg-white text-black hover:bg-gray-100",
      glow: "from-white via-white/40 to-transparent",
      icon: BookOpen,
    },
    {
      id: "desafio",
      title: t("cardDesafioTitle"),
      subtitle: t("cardDesafioSub"),
      buttonText: t("cardDesafioBtn"),
      buttonColor: "bg-primary-mint text-black hover:bg-primary-mint-hover",
      glow: "from-primary-mint via-primary-mint/40 to-transparent",
      icon: CheckCircle,
    },
    {
      id: "shema",
      title: t("cardShemaTitle"),
      subtitle: t("cardShemaSub"),
      buttonText: t("cardShemaBtn"),
      buttonColor: "bg-primary-gold text-black hover:bg-primary-gold-hover",
      glow: "from-primary-gold via-primary-gold/40 to-transparent",
      icon: MessageSquare,
    },
  ];

  // Estado para armazenar o ID do produto para o checkout direto
  const [checkoutProductId, setCheckoutProductId] = useState<string | null>(null);

  const renderView = () => {
    switch (activeTab) {
      case "devocional":
        return <DevocionalView onGoHome={() => setActiveTab("home")} subscriptionStatus={subscriptionStatus} trialDaysLeft={trialDaysLeft} onGoToUpgrade={() => { setCheckoutProductId("plano-plus"); setActiveTab("checkout"); }} />;
      case "leitura":
        return <LeituraView onGoHome={() => setActiveTab("home")} subscriptionStatus={subscriptionStatus} trialDaysLeft={trialDaysLeft} onGoToUpgrade={() => { setCheckoutProductId("plano-plus"); setActiveTab("checkout"); }} />;
      case "desafio":
        return <DesafioView onGoHome={() => setActiveTab("home")} />;
      case "shema":
        return <ShemaView onGoHome={() => setActiveTab("home")} subscriptionStatus={subscriptionStatus} trialDaysLeft={trialDaysLeft} onGoToUpgrade={() => { setCheckoutProductId("plano-plus"); setActiveTab("checkout"); }} />;
      case "apoio":
        return (
          <ApoioView
            onGoHome={() => setActiveTab("home")}
            onGoToStore={() => setActiveTab("loja")}
            hideBackButton={true}
            subscriptionStatus={subscriptionStatus}
            onGoToCheckout={(id) => { setCheckoutProductId(id); setActiveTab("checkout"); }}
          />
        );
      case "loja":
        return <LojaView onGoHome={() => setActiveTab("home")} hideBackButton={true} subscriptionStatus={subscriptionStatus} onGoToCheckout={(id) => { setCheckoutProductId(id); setActiveTab("checkout"); }} />;
      case "checkout":
        return <CheckoutView onGoHome={() => { setCheckoutProductId(null); setActiveTab("home"); }} initialProductId={checkoutProductId} subscriptionStatus={subscriptionStatus} />;
      case "perfil":
        return (
          <ProfileView
            onGoHome={() => setActiveTab("home")}
            onGoAdmin={() => setActiveTab("admin")}
            onGoToStore={() => setActiveTab("loja")}
            onGoToUpgrade={() => { setCheckoutProductId("plano-plus"); setActiveTab("checkout"); }}
            hideBackButton={true}
            subscriptionStatus={subscriptionStatus}
            trialDaysLeft={trialDaysLeft}
          />
        );
      case "admin":
        if (user?.email && user.email.toLowerCase().trim() === "nogueiralfha@gmail.com") {
          return <AdminView onGoHome={() => setActiveTab("home")} hideBackButton={true} />;
        }
        return (
          <div className="text-center text-white py-20 font-serif flex flex-col items-center justify-center gap-4 animate-in fade-in duration-300">
            <span className="text-4xl">🔒</span>
            <p className="text-sm font-sans text-gray-400">Acesso restrito ao administrador.</p>
            <button 
              onClick={() => setActiveTab("home")} 
              className="bg-[#FF5A00] px-6 py-2.5 rounded-full font-sans font-bold text-xs uppercase tracking-wider text-white hover:opacity-90 transition-opacity cursor-pointer"
            >
              Voltar ao Início
            </button>
          </div>
        );
      case "home":
      default:
        return (
          <div className="animate-in fade-in duration-500">
            {/* Trial Banner */}
            {trialDaysLeft !== null && trialDaysLeft > 0 && subscriptionStatus === "inactive" && (
              <div className="mb-6 p-4 rounded-[20px] bg-gradient-to-r from-primary-orange/20 to-primary-gold/15 border border-primary-orange/30 flex items-center justify-between gap-4">
                <div className="flex-1">
                  <h3 className="font-serif font-bold text-sm text-white flex items-center gap-1.5">
                    <span className="animate-pulse">✨</span> Teste Grátis de 7 Dias
                  </h3>
                  <p className="text-[11px] text-zinc-300 mt-1">
                    Você tem mais <strong>{trialDaysLeft} {trialDaysLeft === 1 ? 'dia' : 'dias'}</strong> de acesso livre e gratuito a todos os recursos.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab("apoio")}
                  className="bg-[#FF5A00] hover:bg-[#E04D00] text-white text-[10px] font-bold py-2 px-3.5 rounded-full transition-all active:scale-95 whitespace-nowrap cursor-pointer shrink-0"
                >
                  Ver Planos
                </button>
              </div>
            )}
            
            {trialDaysLeft !== null && trialDaysLeft <= 0 && subscriptionStatus === "inactive" && (
              <div className="mb-6 p-4 rounded-[20px] bg-red-950/20 border border-red-500/30 flex items-center justify-between gap-4">
                <div className="flex-1">
                  <h3 className="font-serif font-bold text-sm text-white flex items-center gap-1.5">
                    🔒 Teste Grátis Expirado
                  </h3>
                  <p className="text-[11px] text-zinc-300 mt-1">
                    Seus 7 dias gratuitos acabaram. Garanta seu plano para liberar as meditações diárias e o conselheiro!
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab("apoio")}
                  className="bg-[#FF5A00] hover:bg-[#E04D00] text-white text-[10px] font-bold py-2 px-3.5 rounded-full transition-all active:scale-95 whitespace-nowrap cursor-pointer shrink-0"
                >
                  Assinar
                </button>
              </div>
            )}

            {/* Grid of Cards */}
            <div className="grid grid-cols-2 gap-4 mb-10">
              {cards.map((card) => (
                <div
                  key={card.id}
                  className="relative bg-neutral-card rounded-[24px] p-5 flex flex-col items-center text-center overflow-hidden cursor-pointer hover:bg-neutral-card-hover transition-all duration-300"
                  onClick={() => setActiveTab(card.id)}
                >
                  {/* Top Glow Border Effect */}
                  <div
                    className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${card.glow}`}
                    style={{
                      maskImage:
                        "linear-gradient(to right, black 80%, transparent 100%)",
                      WebkitMaskImage:
                        "linear-gradient(to right, black 80%, transparent 100%)",
                    }}
                  />

                  <card.icon
                    className="w-8 h-8 mb-3 text-white"
                    strokeWidth={1.5}
                  />
                  <h2 className="font-serif font-bold text-xl mb-1 text-white">
                    {card.title}
                  </h2>
                  <p className="text-zinc-400 text-xs mb-6 h-4 font-medium">
                    {card.subtitle}
                  </p>
                  <button
                    className={`w-full py-2.5 rounded-full font-sans font-semibold text-sm transition-colors mt-auto cursor-pointer focus-ring ${card.buttonColor}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveTab(card.id);
                    }}
                  >
                    {card.buttonText}
                  </button>
                </div>
              ))}
            </div>

            {/* Install App Prompt */}
            {deferredPrompt && (
              <div className="mx-4 mb-6 p-4 rounded-[20px] bg-gradient-to-r from-primary-orange/20 to-primary-gold/10 border border-primary-orange/30 flex items-center justify-between gap-4 animate-in fade-in duration-300">
                <div>
                  <h3 className="font-serif font-bold text-sm text-white flex items-center gap-1.5">
                    <Download size={16} className="text-primary-orange animate-bounce" />
                    Caminhos do Coração App
                  </h3>
                  <p className="text-[10px] text-zinc-300 mt-1">
                    Instale em sua tela de início para acesso rápido e offline!
                  </p>
                </div>
                <button
                  onClick={handleInstallClick}
                  className="bg-primary-orange hover:bg-primary-orange-hover text-white text-[11px] font-bold py-2 px-4 rounded-full transition-all active:scale-95 whitespace-nowrap cursor-pointer shrink-0"
                >
                  Instalar
                </button>
              </div>
            )}

            {/* Footer Quote */}
            <div className="text-center px-4 mb-6">
              <p className="text-zinc-400 italic text-xs leading-relaxed font-medium">
                {t("footerQuote")}
              </p>
            </div>

            {/* Action Button */}
            <div className="flex flex-col items-center justify-center mb-6 px-4">
              <p className="text-zinc-400 text-[11px] text-center mb-4 leading-relaxed px-4 font-medium">
                {t("supportText1")} <strong>{t("supportText2")}</strong>{" "}
                {t("supportText3")} <strong>{t("supportText4")}</strong>{" "}
                {t("supportText5")}
              </p>
              <button
                className="w-full max-w-[250px] py-3.5 rounded-full border border-white/10 text-white text-[11px] font-bold tracking-widest bg-neutral-card hover:bg-neutral-card-hover hover:border-primary-orange/50 transition-all flex items-center justify-center focus-ring cursor-pointer uppercase"
                onClick={() => setActiveTab("apoio")}
              >
                {t("supportBtn")}
              </button>
            </div>
          </div>
        );
    }
  };

  const renderAppContainer = (content: React.ReactNode, isFullScreenView = false) => {
    return (
      <div className="simulator-wrapper">
        <div className="device-simulator">
          <div className="device-notch" />
          <div className="flex-1 flex flex-col relative text-white overflow-hidden h-full">
            {isOffline && (
              <div className="bg-red-950/90 text-red-200 border-b border-red-800/30 py-1.5 px-4 text-center text-[10px] font-semibold flex items-center justify-center gap-1.5 z-[100] backdrop-blur-md animate-in slide-in-from-top duration-300">
                <WifiOff size={12} className="text-red-400" />
                <span>Sem conexão com a internet — Modo Offline ativo</span>
              </div>
            )}
            {content}
          </div>
        </div>
      </div>
    );
  };

  if (authLoading || showSplash) {
    return renderAppContainer(
      <div className="flex-1 bg-neutral-darker flex flex-col items-center justify-center text-white px-6 relative overflow-hidden select-none">
        {/* Glowing Background Light */}
        <div className="absolute w-[200px] h-[200px] bg-primary-orange/10 rounded-full blur-[100px] pointer-events-none" />
        
        {/* 1. App Title (Fades in first) */}
        <h1 className="font-serif font-bold text-3xl tracking-tight text-white mb-2 animate-text-splash text-center">
          {t("mainTitle")}
        </h1>
        <p className="font-sans italic text-zinc-400 text-xs font-semibold tracking-wider uppercase opacity-75 animate-text-sub-splash text-center mb-12">
          {t("mainSubtitle")}
        </p>

        {/* 2. Heart Logo (Official App Icon containing the heart and path) */}
        <div className="relative w-32 h-32 flex items-center justify-center animate-heart-pop">
          <img 
            src="/icon-192.png" 
            alt="Logo Caminhos do Coração" 
            className="w-full h-full object-contain rounded-2xl shadow-lg border border-white/5"
          />
        </div>
      </div>,
      true
    );
  }

  if (!user) {
    if (activeTab === "loja") {
      return renderAppContainer(
        <div className="flex-1 overflow-y-auto px-6 py-12 custom-scrollbar">
          <LojaView onGoHome={() => setActiveTab("home")} />
        </div>,
        true
      );
    }

    return renderAppContainer(
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <LandingView onGoToStore={() => setActiveTab("loja")} />
      </div>,
      true
    );
  }

  const isChat = activeTab === "shema";

  return renderAppContainer(
    <div className="flex flex-col h-full overflow-hidden bg-neutral-dark">
      {/* Fixed Top Header (outside scroll area) */}
      <header className="text-center pt-8 pb-3 px-6 relative shrink-0 border-b border-white/5 bg-neutral-dark z-40">
        {activeTab !== "home" && (
          <button
            onClick={() => setActiveTab("home")}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-2 text-zinc-400 hover:text-white transition-colors cursor-pointer focus-ring rounded-lg flex items-center justify-center"
            aria-label="Voltar para o início"
          >
            <ChevronLeft size={24} />
          </button>
        )}
        {/* Floating Play/Pause toggle for background daily welcome audio */}
        <button
          onClick={() => toggleInviteAudio()}
          className={`absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full transition-colors cursor-pointer focus-ring flex items-center justify-center ${
            isPlayingInvite ? "text-primary-orange animate-pulse" : "text-zinc-500 hover:text-white"
          }`}
          title={isPlayingInvite ? "Pausar convite de áudio" : "Ouvir convite de áudio"}
        >
          {isPlayingInvite ? <Volume2 size={22} /> : <Play size={22} />}
        </button>
        <h1
          className="font-serif font-bold text-2xl tracking-tight cursor-pointer hover:opacity-80 active:scale-[0.98] transition-all"
          onClick={() => setActiveTab("home")}
        >
          {t("mainTitle")}
        </h1>
        <p className="font-sans italic text-zinc-400 text-[10px] font-semibold tracking-wider uppercase opacity-75 mt-0.5">
          {t("mainSubtitle")}
        </p>
      </header>

      {/* Main Content Area: scrolls for normal views, fits full height for chat to support fixed input */}
      <main className={`flex-1 flex flex-col overflow-hidden relative ${!isChat ? "overflow-y-auto px-6 py-6 custom-scrollbar" : "px-6 pt-4"}`}>
        {renderView()}
      </main>

      {/* Docked Solid Bottom Navigation Bar (fixes all contrast/clipping leaks) */}
      <nav className="h-20 bg-zinc-950 border-t border-white/10 px-4 flex justify-between items-center shrink-0 z-50">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center flex-1 w-full transition-all py-1.5 rounded-xl cursor-pointer focus-ring active:scale-[0.9] ${
                isActive 
                  ? "text-primary-orange bg-primary-orange/10 font-bold" 
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <item.icon
                className="w-5 h-5 mb-1"
                strokeWidth={isActive ? 2.5 : 1.8}
              />
              <span className="text-[8px] tracking-wider uppercase font-semibold">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
