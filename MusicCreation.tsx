
import React, { useState, useEffect, useRef, useCallback } from 'react';
import Page from '../ui/Page';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { generateOrRefineSong, generateInstrumentalTrack, generateSongStructure, generateSpeech } from '../../services/geminiService';
import { ChatMessage, SongData, StructureSection } from '../../types';
import WaveformPlayer from '../ui/WaveformPlayer';

// --- Audio Helper Functions ---

const decode = (base64: string): Uint8Array => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const bufferToWave = (abuffer: AudioBuffer) => {
    const numOfChan = abuffer.numberOfChannels,
          len = abuffer.length * numOfChan * 2 + 44;
    let buffer = new ArrayBuffer(len),
        view = new DataView(buffer),
        channels = [], i, sample, offset = 0, pos = 0;
    setUint32(0x46464952); setUint32(len - 8); setUint32(0x45564157);
    setUint32(0x20746d66); setUint32(16); setUint16(1); setUint16(numOfChan);
    setUint32(abuffer.sampleRate); setUint32(abuffer.sampleRate * 2 * numOfChan);
    setUint16(numOfChan * 2); setUint16(16); setUint32(0x61746164);
    setUint32(len - pos - 4);
    for(i = 0; i < abuffer.numberOfChannels; i++) channels.push(abuffer.getChannelData(i));
    let frameIndex = 0;
    while(pos < len && frameIndex < abuffer.length) {
        for(i = 0; i < numOfChan; i++) {
            sample = Math.max(-1, Math.min(1, channels[i][frameIndex]));
            sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767)|0;
            view.setInt16(pos, sample, true); pos += 2;
        }
        frameIndex++;
    }
    return new Blob([buffer], {type: "audio/wav"});
    function setUint16(data: number) { view.setUint16(pos, data, true); pos += 2; }
    function setUint32(data: number) { view.setUint32(pos, data, true); pos += 4; }
}

export const useUndoRedo = <T,>(initialState: T) => {
  const [history, setHistory] = useState<T[]>([initialState]);
  const [index, setIndex] = useState(0);

  const state = history[index];

  const set = useCallback(
    (newState: T | ((prevState: T) => T)) => {
      const resolvedState =
        newState instanceof Function ? newState(state) : newState;
      const newHistory = history.slice(0, index + 1);
      newHistory.push(resolvedState);
      setHistory(newHistory);
      setIndex(newHistory.length - 1);
    },
    [history, index, state],
  );

  const undo = useCallback(() => {
    if (index > 0) {
      setIndex(prevIndex => prevIndex - 1);
    }
  }, [index]);

  const redo = useCallback(() => {
    if (index < history.length - 1) {
      setIndex(prevIndex => prevIndex + 1);
    }
  }, [index, history.length]);

  const reset = useCallback((newState: T) => {
    setHistory([newState]);
    setIndex(0);
  }, []);

  const canUndo = index > 0;
  const canRedo = index < history.length - 1;

  return { state, set, undo, redo, reset, canUndo, canRedo };
};

// --- Component ---

const RegenerateIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
);

const DownloadIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
);

// Mini Player for handling simultaneous tracks
const MultiTrackPlayer: React.FC<{ instrumentalUrl: string; vocalUrl: string }> = ({ instrumentalUrl, vocalUrl }) => {
    const instRef = useRef<HTMLAudioElement>(null);
    const vocalRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [muteInst, setMuteInst] = useState(false);
    const [muteVocal, setMuteVocal] = useState(false);

    const togglePlay = () => {
        if(isPlaying) {
            instRef.current?.pause();
            vocalRef.current?.pause();
            setIsPlaying(false);
        } else {
            // Sync start
            if(instRef.current) instRef.current.currentTime = 0;
            if(vocalRef.current) vocalRef.current.currentTime = 0;
            instRef.current?.play();
            vocalRef.current?.play();
            setIsPlaying(true);
        }
    };

    return (
        <div className="bg-gray-800 rounded-lg p-3">
             <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-indigo-300 font-bold uppercase tracking-wider">Multi-Track Demo</p>
                <button onClick={togglePlay} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full p-2">
                    {isPlaying ? (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>
                    ) : (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    )}
                </button>
             </div>
             
             <div className="space-y-2">
                 {/* Instrumental Row */}
                <div className="flex items-center gap-2 bg-gray-900/50 p-2 rounded">
                    <span className="text-xs text-gray-400 w-20">Instrumental</span>
                    <button 
                        onClick={() => setMuteInst(!muteInst)}
                        className={`text-xs px-2 py-1 rounded border ${muteInst ? 'bg-red-500/20 text-red-400 border-red-500/50' : 'bg-gray-700 text-gray-300 border-gray-600'}`}
                    >
                        {muteInst ? 'Muted' : 'Mute'}
                    </button>
                    <div className="flex-1 h-1 bg-gray-700 rounded overflow-hidden">
                        <div className={`h-full bg-indigo-500 ${muteInst ? 'opacity-30' : 'opacity-100'}`} style={{width: '100%'}}></div>
                    </div>
                </div>

                {/* Vocal Row */}
                 <div className="flex items-center gap-2 bg-gray-900/50 p-2 rounded">
                    <span className="text-xs text-gray-400 w-20">Vocals</span>
                    <button 
                        onClick={() => setMuteVocal(!muteVocal)}
                        className={`text-xs px-2 py-1 rounded border ${muteVocal ? 'bg-red-500/20 text-red-400 border-red-500/50' : 'bg-gray-700 text-gray-300 border-gray-600'}`}
                    >
                        {muteVocal ? 'Muted' : 'Mute'}
                    </button>
                    <div className="flex-1 h-1 bg-gray-700 rounded overflow-hidden">
                         <div className={`h-full bg-pink-500 ${muteVocal ? 'opacity-30' : 'opacity-100'}`} style={{width: '100%'}}></div>
                    </div>
                </div>
             </div>

             <audio ref={instRef} src={instrumentalUrl} muted={muteInst} onEnded={() => setIsPlaying(false)} />
             <audio ref={vocalRef} src={vocalUrl} muted={muteVocal} />
             
             <div className="mt-3 pt-2 border-t border-gray-700 flex justify-end gap-3">
                 <a href={instrumentalUrl} download="instrumental.wav" className="text-xs text-gray-400 hover:text-white flex items-center gap-1"><DownloadIcon className="w-3 h-3"/> Inst</a>
                 <a href={vocalUrl} download="vocals.wav" className="text-xs text-gray-400 hover:text-white flex items-center gap-1"><DownloadIcon className="w-3 h-3"/> Vox</a>
             </div>
        </div>
    );
};


interface MusicCreationProps {
  onLyricsGenerated: (lyrics: string, concept: string, audioUrl?: string, vocalUrl?: string) => void;
}

const initialMessages: ChatMessage[] = [{
    role: 'model',
    text: "Hello! I'm Song Maker GPT, your creative partner. Describe a feeling, a story, or a style of music you have in mind, and let's create a song together."
}];

const SUGGESTED_STYLES = [
    "Lo-fi Hip Hop",
    "Synthwave 80s",
    "Acoustic Folk",
    "Upbeat Pop",
    "Dark Trap",
    "Ambient Chill"
];

const MusicCreation: React.FC<MusicCreationProps> = ({ onLyricsGenerated }) => {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(initialMessages);
  const [chatInput, setChatInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [latestSongData, setLatestSongData] = useState<SongData | null>(null);
  const [latestAudioUrl, setLatestAudioUrl] = useState<string | undefined>(undefined);
  const [latestVocalUrl, setLatestVocalUrl] = useState<string | undefined>(undefined);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    if (!audioContext) {
      const context = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      setAudioContext(context);
    }
    return () => { audioContext?.close(); }
  }, [audioContext]);

  const handleChatSend = async (overrideInput?: string) => {
    const inputToSend = overrideInput || chatInput;
    if (!inputToSend.trim() || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', text: inputToSend };
    const newMessages = [...chatMessages, userMessage];
    setChatMessages(newMessages);
    setChatInput('');
    setIsLoading(true);

    try {
        const response = await generateOrRefineSong(newMessages);
        setLatestSongData(response.songData);
        // Reset latest audio when song changes to avoid mismatch
        setLatestAudioUrl(undefined);
        setLatestVocalUrl(undefined);

        const modelMessage: ChatMessage = {
            role: 'model',
            text: response.conversationalResponse,
            songData: response.songData
        };
        setChatMessages([...newMessages, modelMessage]);

    } catch (e) {
        console.error(e);
        const errorMessage: ChatMessage = { role: 'model', text: "Sorry, I ran into a creative block. Could you try phrasing that differently?" };
        setChatMessages([...newMessages, errorMessage]);
    } finally {
        setIsLoading(false);
    }
  };

  const handleRegenerateText = async () => {
    if (isLoading) return;

    // Find the last user message to determine the history to resend.
    let lastUserMessageIndex = -1;
    for (let i = chatMessages.length - 1; i >= 0; i--) {
        if (chatMessages[i].role === 'user') {
            lastUserMessageIndex = i;
            break;
        }
    }

    if (lastUserMessageIndex === -1 || chatMessages[chatMessages.length - 1].role !== 'model') {
        return;
    }

    const historyToResend = chatMessages.slice(0, lastUserMessageIndex + 1);
    
    setChatMessages(historyToResend);
    setIsLoading(true);

    try {
        const response = await generateOrRefineSong(historyToResend);
        setLatestSongData(response.songData);
        setLatestAudioUrl(undefined);
        setLatestVocalUrl(undefined);

        const modelMessage: ChatMessage = {
            role: 'model',
            text: response.conversationalResponse,
            songData: response.songData
        };
        setChatMessages([...historyToResend, modelMessage]);

    } catch (e) {
        console.error(e);
        const errorMessage: ChatMessage = { role: 'model', text: "Sorry, I ran into a creative block while regenerating. Could you try phrasing that differently?" };
        setChatMessages([...historyToResend, errorMessage]);
    } finally {
        setIsLoading(false);
    }
  };


  const handleGenerateFullSong = useCallback(async (messageIndex: number) => {
    const message = chatMessages[messageIndex];
    if (!message.songData || !audioContext) return;

    setChatMessages(prev => prev.map((msg, idx) => 
        idx === messageIndex ? { ...msg, isLoadingAudio: true, audioUrl: undefined, vocalUrl: undefined } : msg
    ));

    try {
        if (audioContext.state === 'suspended') await audioContext.resume();

        // Generate Instrumental and Vocals in parallel
        const [base64Instrumental, base64Vocal] = await Promise.all([
            generateInstrumentalTrack(message.songData.style),
            generateSpeech(message.songData.lyrics, 'Kore') // Default to Kore for initial demo
        ]);
        
        // Decode Instrumental
        const instBytes = decode(base64Instrumental);
        const instBuffer = await decodeAudioData(instBytes, audioContext, 24000, 1);
        const instBlob = bufferToWave(instBuffer);
        const instUrl = URL.createObjectURL(instBlob);

        // Decode Vocals
        const vocBytes = decode(base64Vocal);
        const vocBuffer = await decodeAudioData(vocBytes, audioContext, 24000, 1);
        const vocBlob = bufferToWave(vocBuffer);
        const vocUrl = URL.createObjectURL(vocBlob);

        setLatestAudioUrl(instUrl);
        setLatestVocalUrl(vocUrl);

        setChatMessages(prev => prev.map((msg, idx) => 
            idx === messageIndex ? { ...msg, isLoadingAudio: false, audioUrl: instUrl, vocalUrl: vocUrl } : msg
        ));
    } catch (e) {
        console.error(e);
        setChatMessages(prev => prev.map((msg, idx) => 
            idx === messageIndex ? { ...msg, isLoadingAudio: false, text: msg.text + "\n\nSorry, I encountered an issue generating one of the audio tracks." } : msg
        ));
    }
  }, [chatMessages, audioContext]);

  const handleGenerateStructure = useCallback(async (messageIndex: number) => {
    const message = chatMessages[messageIndex];
    if (!message.songData) return;

    setChatMessages(prev => prev.map((msg, idx) => 
        idx === messageIndex ? { ...msg, isLoadingStructure: true } : msg
    ));

    try {
        const sections = await generateSongStructure(message.songData.lyrics, message.songData.style);
        
        setChatMessages(prev => prev.map((msg, idx) => 
            idx === messageIndex ? { ...msg, isLoadingStructure: false, structurePlan: sections } : msg
        ));
    } catch (e) {
        console.error(e);
        setChatMessages(prev => prev.map((msg, idx) => 
            idx === messageIndex ? { ...msg, isLoadingStructure: false } : msg
        ));
    }
  }, [chatMessages]);

  const handleProceed = () => {
    if (latestSongData) {
      // Pass both lyrics AND the instrumental audio URL if it exists
      onLyricsGenerated(latestSongData.lyrics, latestSongData.style, latestAudioUrl, latestVocalUrl);
    }
  };

  const formatSongForDisplay = (song: SongData) => {
      return (
          <>
              <h3 className="font-bold text-lg mt-4">Title: "{song.title}"</h3>
              <p className="text-sm text-gray-400 italic mt-1">Style: {song.style}</p>
              <pre className="whitespace-pre-wrap font-sans text-sm bg-gray-900/50 p-3 rounded-md mt-3">{song.lyrics}</pre>
          </>
      );
  };

  return (
    <Page title="Compose with AI" description="Create your next song through a conversation. Describe your idea, refine the lyrics and style, and generate music as you go.">
      <div className="flex flex-col h-[calc(100vh-14rem)]">
        <Card className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                      <div className={`max-w-prose px-4 py-3 rounded-lg ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-gray-700'}`}>
                          <div className="whitespace-pre-wrap text-sm">{msg.text}</div>
                          {msg.songData && (
                              <div className="mt-2 border-t border-gray-600 pt-2">
                                  {formatSongForDisplay(msg.songData)}
                                  
                                  {/* Structure Plan Section */}
                                  {msg.structurePlan ? (
                                      <div className="mt-4 border-l-2 border-indigo-500 pl-3 space-y-2 bg-gray-800/50 p-3 rounded-r-md">
                                          <h4 className="font-bold text-indigo-300 text-sm mb-2">Structure Plan</h4>
                                          {msg.structurePlan.map((section, idx) => (
                                              <div key={idx} className="flex flex-wrap justify-between text-xs gap-2 border-b border-gray-700 pb-1 last:border-0">
                                                  <span className="font-semibold text-white w-20">{section.name}</span>
                                                  <span className="text-gray-400 flex-1">{section.description}</span>
                                                  <span className="text-gray-500 font-mono">{section.bars} bars</span>
                                              </div>
                                          ))}
                                      </div>
                                  ) : (
                                      <div className="mt-3">
                                          <Button 
                                            onClick={() => handleGenerateStructure(i)} 
                                            variant="ghost" 
                                            size="sm"
                                            isLoading={msg.isLoadingStructure}
                                            className="text-xs px-2 py-1"
                                          >
                                              {msg.isLoadingStructure ? "Analyzing..." : "Generate Structure Plan"}
                                          </Button>
                                      </div>
                                  )}

                                  <div className="mt-4">
                                      {msg.isLoadingAudio ? (
                                           <div className="flex items-center justify-center p-3 bg-gray-800 rounded-lg">
                                               <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                               <span>Generating Full Song Demo (Inst + Vox)...</span>
                                           </div>
                                      ) : msg.audioUrl && msg.vocalUrl ? (
                                          <MultiTrackPlayer instrumentalUrl={msg.audioUrl} vocalUrl={msg.vocalUrl} />
                                      ) : (
                                          <Button onClick={() => handleGenerateFullSong(i)} variant="secondary" size="sm" className="w-full">
                                              Generate Full Song Demo (Instrumental + Vocals)
                                          </Button>
                                      )}
                                  </div>
                              </div>
                          )}
                      </div>
                      {i === chatMessages.length - 1 && msg.role === 'model' && chatMessages.length > 1 && !isLoading && (
                          <div className="mt-2 text-left">
                              <Button onClick={handleRegenerateText} variant="ghost" size="sm">
                                  <RegenerateIcon className="h-4 w-4 mr-2" />
                                  Regenerate Text
                              </Button>
                          </div>
                      )}
                  </div>
              ))}
              {isLoading && (
                  <div className="flex items-start">
                      <div className="max-w-prose px-4 py-3 rounded-lg bg-gray-700">
                           <p className="text-sm italic text-gray-400">Song Maker is typing...</p>
                      </div>
                  </div>
              )}
              <div ref={chatEndRef} />
          </div>
          <div className="mt-auto p-4 border-t border-gray-700">
               {/* Style suggestions */}
               {chatMessages.length === 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
                        {SUGGESTED_STYLES.map(style => (
                            <button
                                key={style}
                                onClick={() => handleChatSend(`I want to write a ${style} song.`)}
                                className="whitespace-nowrap px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-full text-xs text-indigo-300 border border-gray-600 transition-colors"
                            >
                                {style}
                            </button>
                        ))}
                    </div>
              )}

              <div className="flex">
                  <textarea
                      rows={2}
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleChatSend())}
                      className="flex-1 bg-gray-800 border-gray-600 rounded-l-md focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50 resize-none"
                      placeholder="e.g., 'Make it more powerful' or 'Change the story to be about...'"
                      disabled={isLoading}
                  />
                  <Button onClick={() => handleChatSend()} isLoading={isLoading} className="rounded-l-none self-stretch">Send</Button>
              </div>
          </div>
        </Card>
      </div>
      <div className="mt-6 flex justify-center">
          <Button onClick={handleProceed} variant="primary" size="lg" disabled={!latestSongData}>
              Proceed to Audio Production &raquo;
          </Button>
      </div>
    </Page>
  );
};

export default MusicCreation;
