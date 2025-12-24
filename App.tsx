import React, { useState, useCallback } from "react";
import {
  Sidebar,
  SidebarItem,
  SidebarSection,
} from "./components/layout/Sidebar";
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
} from "./constants";
import MusicCreation from "./components/features/MusicCreation";
import AudioProduction from "./components/features/AudioProduction";
import VideoCreation from "./components/features/VideoCreation";
import SocialMarketing from "./components/features/SocialMarketing";
import AiAssistant from "./components/features/AiAssistant";
import LyricLab from "./components/features/LyricLab";
import AudioAnalyzer from "./components/features/AudioAnalyzer";
import RemixStudio from "./components/features/RemixStudio";
import ToastContainer from "./components/ui/ToastContainer";
import ThemeToggle from "./components/ui/ThemeToggle";
import { useTheme, useMusicState } from "./context/AppContext";

type View =
  | "create"
  | "produce"
  | "video"
  | "market"
  | "assist"
  | "lab"
  | "analyze"
  | "remix";

const App: React.FC = () => {
  const { theme } = useTheme();
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

  const [activeView, setActiveView] = useState<View>("create");

  const handleLyricsGenerated = useCallback(
    (
      lyrics: string,
      concept: string,
      audioUrl?: string,
      generatedVocalUrl?: string
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
    []
  );

  const renderView = () => {
    switch (activeView) {
      case "create":
        return <MusicCreation onLyricsGenerated={handleLyricsGenerated} />;
      case "produce":
        return (
          <AudioProduction
            lyrics={generatedLyrics}
            instrumentalUrl={instrumentalUrl}
            initialVocalUrl={vocalUrl}
          />
        );
      case "video":
        return (
          <VideoCreation lyrics={generatedLyrics} songConcept={songConcept} />
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
      default:
        return <MusicCreation onLyricsGenerated={handleLyricsGenerated} />;
    }
  };

  return (
    <div
      className={`flex min-h-screen overflow-hidden ${
        theme === "dark"
          ? "bg-gradient-animated text-gray-200"
          : "bg-gradient-light text-gray-800"
      }`}
    >
      {/* Toast notifications */}
      <ToastContainer />

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

      <Sidebar>
        {/* Logo Section */}
        <div className="flex items-center justify-center md:justify-start py-6 px-4 md:px-6 mb-2">
          <div className="relative">
            <LogoIcon className="h-10 w-10 text-indigo-400 drop-shadow-lg" />
            <div className="absolute inset-0 h-10 w-10 bg-indigo-400/30 blur-xl rounded-full" />
          </div>
          <div className="ml-3 hidden md:block">
            <span className="text-2xl font-bold gradient-text">MUSE AI</span>
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

        {/* Theme Toggle at bottom */}
        <div className="mt-auto px-4 py-4 border-t border-gray-700/50">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 hidden md:block">Theme</span>
            <ThemeToggle />
          </div>
        </div>
      </Sidebar>

      <main
        className={`flex-1 ml-20 md:ml-72 relative ${
          theme === "light" ? "bg-white/50" : ""
        }`}
      >
        {/* Top ambient glow */}
        <div
          className={`absolute top-0 left-0 right-0 h-48 bg-gradient-to-b pointer-events-none ${
            theme === "dark" ? "from-indigo-500/5" : "from-indigo-500/10"
          } to-transparent`}
        />

        <div className="p-6 md:p-10 relative z-10 animate-fade-in-up">
          {renderView()}
        </div>
      </main>
    </div>
  );
};

export default App;
