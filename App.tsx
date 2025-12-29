import React, { useState, useCallback, useEffect } from "react";
import {
  Sidebar,
  SidebarItem,
  SidebarSection,
} from "./components/layout/Sidebar";
import {
  validateEnvironment,
  logValidationResults,
  EnvValidationResult,
} from "./utils/envValidation";
import {
  MusicCreationIcon,
  AudioProductionIcon,
  VideoCreationIcon,
  MarketingIcon,
  AssistantIcon,
  LogoIcon,
  LyricLabIcon,
  AnalyzerIcon,
  RemixIcon,
  CommunityIcon,
} from "./constants";
import MusicCreation from "./components/features/MusicCreation";
import AudioProduction from "./components/features/AudioProduction";
import VideoCreation from "./components/features/VideoCreation";
import SocialMarketing from "./components/features/SocialMarketing";
import AiAssistant from "./components/features/AiAssistant";
import LyricLab from "./components/features/LyricLab";
import AudioAnalyzer from "./components/features/AudioAnalyzer";
import RemixStudio from "./components/features/RemixStudio";
import Community from "./components/features/Community";
import { AuthProvider } from "./context/AuthContext";
import ToastContainer from "./components/ui/Toast";
import ThemeToggle from "./components/ui/ThemeToggle";
import SessionRestorePrompt from "./components/ui/SessionRestorePrompt";
import Breadcrumb, { BreadcrumbItem, HomeIcon } from "./components/ui/Breadcrumb";
import WorkflowProgress, { MUSIC_CREATION_STEPS } from "./components/ui/WorkflowProgress";
import { useTheme, useMusicState, useWorkflow } from "./context/AppContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { LiveRegionProvider } from "./components/ui/LiveRegion";
import {
  MobileNav,
  HamburgerButton,
  AppSection,
} from "./components/ui/MobileNav";
import { KaraokeSong } from "./types";

type View =
  | "create"
  | "produce"
  | "video"
  | "market"
  | "assist"
  | "lab"
  | "analyze"
  | "remix"
  | "community";

const App: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const {
    generatedLyrics,
    setGeneratedLyrics,
    songConcept,
    setSongConcept,
    instrumentalUrl,
    setInstrumentalUrl,
    vocalUrl,
    setVocalUrl,
  } = useMusicState();
  const { completedSteps } = useWorkflow();

  const [activeView, setActiveView] = useState<View>("create");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [karaokeSongs, setKaraokeSongs] = useState<KaraokeSong[]>([]);
  const [startInKaraokeMode, setStartInKaraokeMode] = useState(false);
  const [envValidation, setEnvValidation] = useState<EnvValidationResult | null>(null);
  const [showEnvBanner, setShowEnvBanner] = useState(true);

  // Validate environment on app load
  useEffect(() => {
    const result = validateEnvironment();
    setEnvValidation(result);
    logValidationResults(result);
  }, []);

  // Handle responsive breakpoint
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Map View to AppSection for mobile nav
  const getAppSection = (view: View): AppSection => {
    switch (view) {
      case "create":
      case "lab":
        return "music";
      case "produce":
      case "remix":
      case "analyze":
        return "production";
      case "video":
      case "market":
      case "assist":
      case "community":
        return "marketing";
      default:
        return "music";
    }
  };

  // Generate breadcrumb items based on current view
  const getBreadcrumbItems = (): BreadcrumbItem[] => {
    const home: BreadcrumbItem = {
      label: "Home",
      icon: <HomeIcon className="w-4 h-4" />,
      onClick: () => setActiveView("create"),
    };

    const viewInfo: Record<View, { section: string; label: string }> = {
      create: { section: "Creation", label: "Compose" },
      lab: { section: "Creation", label: "Lyric Lab" },
      produce: { section: "Production", label: "Audio Production" },
      remix: { section: "Tools", label: "Remix Studio" },
      analyze: { section: "Tools", label: "Audio Critic" },
      video: { section: "Promotion", label: "Video" },
      market: { section: "Promotion", label: "Marketing" },
      assist: { section: "Promotion", label: "Assistant" },
      community: { section: "Promotion", label: "Community" },
    };

    const info = viewInfo[activeView];
    return [
      home,
      { label: info.section },
      { label: info.label },
    ];
  };

  // Map view to workflow step for progress indicator
  const getWorkflowStep = (): string => {
    switch (activeView) {
      case "create":
      case "lab":
        return "compose";
      case "produce":
      case "remix":
      case "analyze":
        return "produce";
      case "video":
        return "video";
      case "market":
      case "assist":
      case "community":
        return "market";
      default:
        return "compose";
    }
  };

  const handleMobileSectionChange = (section: AppSection) => {
    switch (section) {
      case "music":
        setActiveView("create");
        break;
      case "production":
        setActiveView("produce");
        break;
      case "marketing":
        setActiveView("market");
        break;
    }
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const handleLyricsGenerated = useCallback(
    (
      lyrics: string,
      concept: string,
      audioUrl?: string,
      generatedVocalUrl?: string,
    ) => {
      setGeneratedLyrics(lyrics);
      setSongConcept(concept);
      if (audioUrl) {
        setInstrumentalUrl(audioUrl);
      }
      if (generatedVocalUrl) {
        setVocalUrl(generatedVocalUrl);
      }
      setActiveView("produce");
    },
    [],
  );

  const handleSendToKaraoke = useCallback((song: KaraokeSong) => {
    setKaraokeSongs((prev) => [...prev, song]);
    setStartInKaraokeMode(true);
    setActiveView("produce");
  }, []);

  // Reset karaoke mode flag after navigation
  useEffect(() => {
    if (startInKaraokeMode && activeView === "produce") {
      // Reset after a short delay to ensure the component has mounted with the flag
      const timer = setTimeout(() => setStartInKaraokeMode(false), 100);
      return () => clearTimeout(timer);
    }
  }, [startInKaraokeMode, activeView]);

  const renderView = () => {
    switch (activeView) {
      case "create":
        return (
          <MusicCreation
            onLyricsGenerated={handleLyricsGenerated}
            onSendToKaraoke={handleSendToKaraoke}
          />
        );
      case "produce":
        return (
          <AudioProduction
            lyrics={generatedLyrics}
            instrumentalUrl={instrumentalUrl}
            initialVocalUrl={vocalUrl}
            karaokeSongs={karaokeSongs}
            initialKaraokeMode={startInKaraokeMode}
          />
        );
      case "video":
        return (
          <VideoCreation
            lyrics={generatedLyrics}
            songConcept={songConcept}
            instrumentalUrl={instrumentalUrl}
            vocalUrl={vocalUrl}
          />
        );
      case "market":
        return (
          <SocialMarketing lyrics={generatedLyrics} songConcept={songConcept} />
        );
      case "assist":
        return <AiAssistant />;
      case "lab":
        return (
          <LyricLab
            initialLyrics={generatedLyrics}
            onUpdateLyrics={setGeneratedLyrics}
          />
        );
      case "analyze":
        return <AudioAnalyzer />;
      case "remix":
        return <RemixStudio />;
      case "community":
        return <Community />;
      default:
        return (
          <MusicCreation
            onLyricsGenerated={handleLyricsGenerated}
            onSendToKaraoke={handleSendToKaraoke}
          />
        );
    }
  };

  return (
    <AuthProvider>
      <LiveRegionProvider>
          <ErrorBoundary>
            <div
              className={`flex min-h-screen overflow-hidden ${
                theme === "dark"
                  ? "bg-gradient-animated text-gray-200"
                  : "bg-gradient-light text-gray-800"
              }`}
            >
              {/* Skip navigation link for accessibility */}
              <a href="#main-content" className="skip-nav sr-only-focusable">
                Skip to main content
              </a>

              {/* Toast notifications */}
              <ToastContainer />

              {/* Session restore prompt */}
              <SessionRestorePrompt />

              {/* Environment validation banner */}
              {showEnvBanner && envValidation && (!envValidation.isValid || envValidation.warnings.length > 0) && (
                <div className={`fixed top-0 left-0 right-0 z-50 ${
                  !envValidation.isValid ? 'bg-red-600' : 'bg-yellow-600'
                } text-white px-4 py-2 text-sm`}>
                  <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d={!envValidation.isValid
                            ? "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            : "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          }
                        />
                      </svg>
                      <span>
                        {!envValidation.isValid
                          ? `Missing required config: ${envValidation.missing.join(', ')}. Add to .env file.`
                          : envValidation.warnings[0]
                        }
                      </span>
                    </div>
                    <button
                      onClick={() => setShowEnvBanner(false)}
                      className="p-1 hover:bg-white/20 rounded"
                      aria-label="Dismiss"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              {/* Mobile navigation */}
              <MobileNav
                isOpen={mobileMenuOpen}
                onClose={() => setMobileMenuOpen(false)}
                currentSection={getAppSection(activeView)}
                onSectionChange={handleMobileSectionChange}
                isDarkMode={theme === "dark"}
                onToggleTheme={toggleTheme}
              />

              {/* Mobile header with hamburger */}
              {isMobile && (
                <header
                  className={`fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-3 backdrop-blur-sm border-b ${
                    theme === "dark"
                      ? "bg-gray-900/95 border-gray-700/50"
                      : "bg-white/95 border-gray-200/50"
                  }`}
                >
                  <HamburgerButton onClick={() => setMobileMenuOpen(true)} />
                  <div className="flex items-center gap-2">
                    <LogoIcon className="h-6 w-6 text-indigo-400" />
                    <span className="font-bold gradient-text">MUSE AI</span>
                  </div>
                  <ThemeToggle />
                </header>
              )}

              {/* Ambient background orbs */}
              <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div
                  className={`orb w-96 h-96 -top-48 -left-48 float-note ${
                    theme === "dark" ? "orb-purple" : "orb-purple-light"
                  }`}
                />
                <div
                  className={`orb w-80 h-80 top-1/3 right-0 float-note-delayed ${
                    theme === "dark" ? "orb-indigo" : "orb-indigo-light"
                  }`}
                />
                <div
                  className={`orb w-64 h-64 bottom-0 left-1/3 float-note-slow ${
                    theme === "dark" ? "orb-pink" : "orb-pink-light"
                  }`}
                />
              </div>

              {/* Desktop Sidebar - hidden on mobile */}
              <div className={isMobile ? "hidden" : "block"}>
                <Sidebar>
                  {/* Logo Section */}
                  <div className="flex items-center justify-center md:justify-start py-6 px-4 md:px-6 mb-2">
                    <div className="relative">
                      <LogoIcon className="h-10 w-10 text-indigo-400 drop-shadow-lg" />
                      <div className="absolute inset-0 h-10 w-10 bg-indigo-400/30 blur-xl rounded-full" />
                    </div>
                    <div className="ml-3 hidden md:block">
                      <span className="text-2xl font-bold gradient-text">
                        MUSE AI
                      </span>
                      <p
                        className={`text-[10px] -mt-1 ${
                          theme === "dark" ? "text-gray-500" : "text-gray-600"
                        }`}
                      >
                        Create • Produce • Share
                      </p>
                    </div>
                  </div>

                  <SidebarSection title="Creation" />
                  <SidebarItem
                    icon={<MusicCreationIcon className="h-5 w-5" />}
                    text="Compose"
                    active={activeView === "create"}
                    onClick={() => setActiveView("create")}
                  />
                  <SidebarItem
                    icon={<LyricLabIcon className="h-5 w-5" />}
                    text="Lyric Lab"
                    active={activeView === "lab"}
                    onClick={() => setActiveView("lab")}
                  />
                  <SidebarItem
                    icon={<AudioProductionIcon className="h-5 w-5" />}
                    text="Production"
                    active={activeView === "produce"}
                    onClick={() => setActiveView("produce")}
                  />

                  <SidebarSection title="Tools" />
                  <SidebarItem
                    icon={<RemixIcon className="h-5 w-5" />}
                    text="Remix Studio"
                    active={activeView === "remix"}
                    onClick={() => setActiveView("remix")}
                  />
                  <SidebarItem
                    icon={<AnalyzerIcon className="h-5 w-5" />}
                    text="Audio Critic"
                    active={activeView === "analyze"}
                    onClick={() => setActiveView("analyze")}
                  />

                  <SidebarSection title="Promotion" />
                  <SidebarItem
                    icon={<VideoCreationIcon className="h-5 w-5" />}
                    text="Video"
                    active={activeView === "video"}
                    onClick={() => setActiveView("video")}
                  />
                  <SidebarItem
                    icon={<MarketingIcon className="h-5 w-5" />}
                    text="Market"
                    active={activeView === "market"}
                    onClick={() => setActiveView("market")}
                  />
                  <SidebarItem
                    icon={<AssistantIcon className="h-5 w-5" />}
                    text="Assistant"
                    active={activeView === "assist"}
                    onClick={() => setActiveView("assist")}
                  />
                  <SidebarItem
                    icon={<CommunityIcon className="h-5 w-5" />}
                    text="Community"
                    active={activeView === "community"}
                    onClick={() => setActiveView("community")}
                  />

                  {/* Workflow Progress */}
                  <div className="px-4 py-4 mt-4 border-t border-gray-700/50">
                    <p className="text-xs text-gray-500 mb-3 hidden md:block">Workflow</p>
                    <WorkflowProgress
                      steps={MUSIC_CREATION_STEPS}
                      currentStep={getWorkflowStep()}
                      completedSteps={completedSteps}
                      onStepClick={(stepId) => {
                        const stepToView: Record<string, View> = {
                          compose: "create",
                          produce: "produce",
                          video: "video",
                          market: "market",
                        };
                        const view = stepToView[stepId];
                        if (view) setActiveView(view);
                      }}
                      orientation="vertical"
                      size="sm"
                      className="hidden md:block"
                    />
                    {/* Compact version for collapsed sidebar */}
                    <WorkflowProgress
                      steps={MUSIC_CREATION_STEPS}
                      currentStep={getWorkflowStep()}
                      completedSteps={completedSteps}
                      orientation="vertical"
                      size="sm"
                      className="md:hidden"
                    />
                  </div>

                  {/* Theme Toggle at bottom */}
                  <div className="mt-auto px-4 py-4 border-t border-gray-700/50">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 hidden md:block">
                        Theme
                      </span>
                      <ThemeToggle />
                    </div>
                  </div>
                </Sidebar>
              </div>

              <main
                id="main-content"
                className={`flex-1 relative ${
                  isMobile ? "mt-14" : "ml-20 md:ml-72"
                } ${theme === "light" ? "bg-white/50" : ""}`}
                role="main"
              >
                {/* Top ambient glow */}
                <div
                  className={`absolute top-0 left-0 right-0 h-48 bg-gradient-to-b pointer-events-none ${
                    theme === "dark"
                      ? "from-indigo-500/5"
                      : "from-indigo-500/10"
                  } to-transparent`}
                />

                <div className="p-4 md:p-6 lg:p-10 relative z-10 page-enter-active">
                  {/* Breadcrumb navigation */}
                  <Breadcrumb
                    items={getBreadcrumbItems()}
                    className="mb-4"
                  />
                  {renderView()}
                </div>
              </main>
            </div>
          </ErrorBoundary>
      </LiveRegionProvider>
    </AuthProvider>
  );
};

export default App;
