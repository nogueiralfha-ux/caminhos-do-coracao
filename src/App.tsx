import {
  Book,
  BookOpen,
  CheckCircle,
  MessageSquare,
  Home,
  ChevronLeft,
  ShoppingBag,
  User,
} from "lucide-react";
import React, { useState, useEffect } from "react";
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
import { auth } from "./lib/firebase";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { useLanguage } from "./i18n/Context";

export default function App() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState("home");
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const navItems = [
    { id: "home", label: t("navHome"), icon: Home },
    { id: "devocional", label: t("navDevocional"), icon: Book },
    { id: "leitura", label: t("navLeitura"), icon: BookOpen },
    { id: "shema", label: t("navShema"), icon: MessageSquare },
    { id: "perfil", label: t("navProfile"), icon: User },
  ];

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const today = new Date();
  const formattedDate = today.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

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

  const renderView = () => {
    switch (activeTab) {
      case "devocional":
        return <DevocionalView onGoHome={() => setActiveTab("home")} />;
      case "leitura":
        return <LeituraView onGoHome={() => setActiveTab("home")} />;
      case "desafio":
        return <DesafioView onGoHome={() => setActiveTab("home")} />;
      case "shema":
        return <ShemaView onGoHome={() => setActiveTab("home")} />;
      case "apoio":
        return (
          <ApoioView
            onGoHome={() => setActiveTab("home")}
            onGoToStore={() => setActiveTab("loja")}
            hideBackButton={true}
          />
        );
      case "loja":
        return <LojaView onGoHome={() => setActiveTab("home")} hideBackButton={true} />;
      case "perfil":
        return (
          <ProfileView
            onGoHome={() => setActiveTab("home")}
            onGoAdmin={() => setActiveTab("admin")}
            onGoToStore={() => setActiveTab("loja")}
            hideBackButton={true}
          />
        );
      case "admin":
        return <AdminView onGoHome={() => setActiveTab("home")} hideBackButton={true} />;
      case "home":
      default:
        return (
          <div className="animate-in fade-in duration-500">
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
            {content}
          </div>
        </div>
      </div>
    );
  };

  if (authLoading) {
    return renderAppContainer(
      <div className="flex-1 bg-neutral-dark flex items-center justify-center text-white font-sans animate-pulse">
        {t("loading")}
      </div>
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
