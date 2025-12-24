
import React, { useState, useCallback } from 'react';
import { Sidebar, SidebarItem } from './components/layout/Sidebar';
import { 
  MusicCreationIcon, 
  AudioProductionIcon, 
  VideoCreationIcon, 
  MarketingIcon, 
  AssistantIcon, 
  LogoIcon,
  LyricLabIcon,
  AnalyzerIcon,
  RemixIcon
} from './constants';
import MusicCreation from './components/features/MusicCreation';
import AudioProduction from './components/features/AudioProduction';
import VideoCreation from './components/features/VideoCreation';
import SocialMarketing from './components/features/SocialMarketing';
import AiAssistant from './components/features/AiAssistant';
import LyricLab from './components/features/LyricLab';
import AudioAnalyzer from './components/features/AudioAnalyzer';
import RemixStudio from './components/features/RemixStudio';

type View = 'create' | 'produce' | 'video' | 'market' | 'assist' | 'lab' | 'analyze' | 'remix';

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<View>('create');
  const [generatedLyrics, setGeneratedLyrics] = useState<string>('');
  const [songConcept, setSongConcept] = useState<string>('');
  const [instrumentalUrl, setInstrumentalUrl] = useState<string>('');
  const [vocalUrl, setVocalUrl] = useState<string>('');

  const handleLyricsGenerated = useCallback((lyrics: string, concept: string, audioUrl?: string, generatedVocalUrl?: string) => {
    setGeneratedLyrics(lyrics);
    setSongConcept(concept);
    if (audioUrl) {
      setInstrumentalUrl(audioUrl);
    }
    if (generatedVocalUrl) {
      setVocalUrl(generatedVocalUrl);
    }
    setActiveView('produce');
  }, []);

  const renderView = () => {
    switch (activeView) {
      case 'create':
        return <MusicCreation onLyricsGenerated={handleLyricsGenerated} />;
      case 'produce':
        return <AudioProduction lyrics={generatedLyrics} instrumentalUrl={instrumentalUrl} initialVocalUrl={vocalUrl} />;
      case 'video':
        return <VideoCreation lyrics={generatedLyrics} songConcept={songConcept} />;
      case 'market':
        return <SocialMarketing lyrics={generatedLyrics} songConcept={songConcept} />;
      case 'assist':
        return <AiAssistant />;
      case 'lab':
        return <LyricLab initialLyrics={generatedLyrics} onUpdateLyrics={setGeneratedLyrics} />;
      case 'analyze':
        return <AudioAnalyzer />;
      case 'remix':
        return <RemixStudio />;
      default:
        return <MusicCreation onLyricsGenerated={handleLyricsGenerated} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-900 text-gray-200">
      <Sidebar>
        <div className="flex items-center justify-center py-6 px-4 border-b border-gray-700 mb-2">
          <LogoIcon className="h-10 w-10 text-indigo-400" />
          <span className="ml-3 text-2xl font-bold hidden md:inline">MUSE AI</span>
        </div>
        
        <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:block">
          Creation
        </div>
        <SidebarItem
          icon={<MusicCreationIcon className="h-6 w-6" />}
          text="Compose"
          active={activeView === 'create'}
          onClick={() => setActiveView('create')}
        />
        <SidebarItem
          icon={<LyricLabIcon className="h-6 w-6" />}
          text="Lyric Lab"
          active={activeView === 'lab'}
          onClick={() => setActiveView('lab')}
        />
        <SidebarItem
          icon={<AudioProductionIcon className="h-6 w-6" />}
          text="Production"
          active={activeView === 'produce'}
          onClick={() => setActiveView('produce')}
        />

        <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:block mt-4">
          Tools
        </div>
         <SidebarItem
          icon={<RemixIcon className="h-6 w-6" />}
          text="Remix Studio"
          active={activeView === 'remix'}
          onClick={() => setActiveView('remix')}
        />
        <SidebarItem
          icon={<AnalyzerIcon className="h-6 w-6" />}
          text="Audio Critic"
          active={activeView === 'analyze'}
          onClick={() => setActiveView('analyze')}
        />

        <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:block mt-4">
          Promotion
        </div>
        <SidebarItem
          icon={<VideoCreationIcon className="h-6 w-6" />}
          text="Video"
          active={activeView === 'video'}
          onClick={() => setActiveView('video')}
        />
        <SidebarItem
          icon={<MarketingIcon className="h-6 w-6" />}
          text="Market"
          active={activeView === 'market'}
          onClick={() => setActiveView('market')}
        />
        <SidebarItem
          icon={<AssistantIcon className="h-6 w-6" />}
          text="Assistant"
          active={activeView === 'assist'}
          onClick={() => setActiveView('assist')}
        />
      </Sidebar>
      <main className="flex-1 p-6 md:p-10 ml-16 md:ml-64 overflow-x-hidden">
        {renderView()}
      </main>
    </div>
  );
};

export default App;
