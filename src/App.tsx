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
      buttonColor: "bg-[#FF5A00] text-white hover:bg-[#E04D00]",
      glow: "from-white via-white/50 to-transparent",
      icon: Book,
    },
    {
      id: "leitura",
      title: t("cardLeituraTitle"),
      subtitle: `${t("cardLeituraSub")} ${formattedDate}`,
      buttonText: t("cardLeituraBtn"),
      buttonColor: "bg-white text-black hover:bg-gray-100",
      glow: "from-[#FF5A00] via-[#FF5A00]/50 to-transparent",
      icon: BookOpen,
    },
    {
      id: "desafio",
      title: t("cardDesafioTitle"),
      subtitle: t("cardDesafioSub"),
      buttonText: t("cardDesafioBtn"),
      buttonColor: "bg-[#00D1A0] text-black hover:bg-[#00B388]",
      glow: "from-[#00D1A0] via-[#00D1A0]/50 to-transparent",
      icon: CheckCircle,
    },
    {
      id: "shema",
      title: t("cardShemaTitle"),
      subtitle: t("cardShemaSub"),
      buttonText: t("cardShemaBtn"),
      buttonColor: "bg-[#FFD600] text-black hover:bg-[#E6C000]",
      glow: "from-[#FFD600] via-[#FFD600]/50 to-transparent",
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
          />
        );
      case "loja":
        return <LojaView onGoHome={() => setActiveTab("home")} />;
      case "perfil":
        return (
          <ProfileView
            onGoHome={() => setActiveTab("home")}
            onGoAdmin={() => setActiveTab("admin")}
            onGoToStore={() => setActiveTab("loja")}
          />
        );
      case "admin":
        return <AdminView onGoHome={() => setActiveTab("home")} />;
      case "home":
      default:
        return (
          <div className="animate-in fade-in duration-500">
            {/* Grid of Cards */}
            <div className="grid grid-cols-2 gap-4 mb-10">
              {cards.map((card) => (
                <div
                  key={card.id}
                  className="relative bg-[#1E1E1E] rounded-[24px] p-5 flex flex-col items-center text-center overflow-hidden cursor-pointer hover:bg-[#252525] transition-colors"
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
                  <h2 className="font-serif font-bold text-xl mb-1">
                    {card.title}
                  </h2>
                  <p className="text-[#888888] text-xs mb-6 h-4">
                    {card.subtitle}
                  </p>
                  <button
                    className={`w-full py-2.5 rounded-full font-sans font-semibold text-sm transition-colors mt-auto ${card.buttonColor}`}
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
              <p className="text-[#666666] italic text-xs leading-relaxed">
                {t("footerQuote")}
              </p>
            </div>

            {/* Action Button */}
            <div className="flex flex-col items-center justify-center mb-6 px-4">
              <p className="text-[#888888] text-[11px] text-center mb-4 leading-relaxed px-4">
                {t("supportText1")} <strong>{t("supportText2")}</strong>{" "}
                {t("supportText3")} <strong>{t("supportText4")}</strong>{" "}
                {t("supportText5")}
              </p>
              <button
                className="w-full max-w-[250px] py-3.5 rounded-full border border-[#333] text-white text-[11px] font-bold tracking-widest bg-[#1A1A1A] hover:bg-[#222] hover:border-[#FF5A00]/50 transition-all flex items-center justify-center focus:outline-none uppercase"
                onClick={() => setActiveTab("apoio")}
              >
                {t("supportBtn")}
              </button>
            </div>
          </div>
        );
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white font-sans animate-pulse">
        {t("loading")}
      </div>
    );
  }

  if (!user) {
    if (activeTab === "loja") {
      return (
        <div className="flex justify-center min-h-screen bg-black">
          <div className="w-full max-w-md bg-[#161616] min-h-screen flex flex-col relative text-white shadow-2xl overflow-y-auto px-6 py-12">
            <LojaView onGoHome={() => setActiveTab("home")} />
          </div>
        </div>
      );
    }

    return (
      <div className="flex justify-center min-h-screen bg-black">
        <div className="w-full max-w-md bg-[#161616] min-h-screen flex flex-col relative text-white shadow-2xl overflow-y-auto">
          <LandingView onGoToStore={() => setActiveTab("loja")} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-center min-h-screen bg-black">
      {/* Mobile Constraint Container */}
      <div className="w-full max-w-md bg-[#161616] min-h-screen flex flex-col relative text-white shadow-2xl overflow-hidden">
        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto pb-24 pt-12 px-6">
          {/* Header */}
          <div className="text-center mb-10 relative">
            {activeTab !== "home" && (
              <button
                onClick={() => setActiveTab("home")}
                className="absolute left-0 top-1/2 -translate-y-1/2 p-2 -ml-2 text-gray-400 hover:text-white transition-colors"
                aria-label="Voltar para o início"
              >
                <ChevronLeft size={28} />
              </button>
            )}
            <h1
              className="font-serif font-bold text-3xl mb-2 tracking-tight cursor-pointer"
              onClick={() => setActiveTab("home")}
            >
              {t("mainTitle")}
            </h1>
            <p className="font-sans italic text-gray-400 text-sm font-medium">
              {t("mainSubtitle")}
            </p>
          </div>

          {renderView()}
        </div>

        {/* Bottom Navigation */}
        <div className="absolute bottom-0 w-full bg-[#1A1D2B]/95 backdrop-blur-md border-t border-white/5 py-3 px-2 flex justify-between items-center rounded-t-[20px] z-50">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center justify-center w-[20%] transition-colors focus:outline-none ${
                  isActive ? "text-white" : "text-[#626880] hover:text-white/70"
                }`}
              >
                <item.icon
                  className="w-6 h-6 mb-1"
                  strokeWidth={isActive ? 2 : 1.5}
                />
                <span className="text-[9px] tracking-wider uppercase font-medium">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
