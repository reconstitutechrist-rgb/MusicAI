import React, { useState, useEffect, useRef, useCallback } from "react";
import Page from "../ui/Page";
import Card from "../ui/Card";
import Button from "../ui/Button";
import WelcomeHero from "../ui/WelcomeHero";
import {
  generateOrRefineSong,
  generateInstrumentalTrack,
  generateSongStructure,
  generateSpeech,
  generateLyricsTiming,
} from "../../services/geminiService";
import {
  isElevenLabsConfigured,
  generateInstrumental,
  generateSongWithLyrics,
  createAudioUrl,
} from "../../services/elevenLabsMusicService";
import {
  ChatMessage,
  SongData,
  StructureSection,
  KaraokeSong,
} from "../../types";
import { useLiveRegion } from "../ui/LiveRegion";
import { useToastHelpers } from "../ui/Toast";

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
    channels = [],
    i,
    sample,
    pos = 0;
  setUint32(0x46464952);
  setUint32(len - 8);
  setUint32(0x45564157);
  setUint32(0x20746d66);
  setUint32(16);
  setUint16(1);
  setUint16(numOfChan);
  setUint32(abuffer.sampleRate);
  setUint32(abuffer.sampleRate * 2 * numOfChan);
  setUint16(numOfChan * 2);
  setUint16(16);
  setUint32(0x61746164);
  setUint32(len - pos - 4);
  for (i = 0; i < abuffer.numberOfChannels; i++)
    channels.push(abuffer.getChannelData(i));
  let frameIndex = 0;
  while (pos < len && frameIndex < abuffer.length) {
    for (i = 0; i < numOfChan; i++) {
      sample = Math.max(-1, Math.min(1, channels[i][frameIndex]));
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
      view.setInt16(pos, sample, true);
      pos += 2;
    }
    frameIndex++;
  }
  return new Blob([buffer], { type: "audio/wav" });
  function setUint16(data: number) {
    view.setUint16(pos, data, true);
    pos += 2;
  }
  function setUint32(data: number) {
    view.setUint32(pos, data, true);
    pos += 4;
  }
};

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
      setIndex((prevIndex) => prevIndex - 1);
    }
  }, [index]);

  const redo = useCallback(() => {
    if (index < history.length - 1) {
      setIndex((prevIndex) => prevIndex + 1);
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

// --- Utility Functions ---

// Timeout wrapper for API calls
const generateWithTimeout = async <T,>(
  promise: Promise<T>,
  timeoutMs: number = 60000,
): Promise<T> => {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Request timed out")), timeoutMs),
  );
  return Promise.race([promise, timeout]);
};

// Error message helper
const getErrorMessage = (error: unknown): string => {
  const errorMessage = error instanceof Error ? error.message : "Unknown error";

  if (
    errorMessage.includes("network") ||
    errorMessage.includes("fetch") ||
    errorMessage.includes("Failed to fetch")
  ) {
    return "Network error. Please check your connection and try again.";
  } else if (
    errorMessage.includes("timeout") ||
    errorMessage.includes("timed out")
  ) {
    return "The request took too long. Please try again.";
  } else if (
    errorMessage.includes("API") ||
    errorMessage.includes("401") ||
    errorMessage.includes("403")
  ) {
    return "AI service temporarily unavailable. Please try again in a moment.";
  } else if (errorMessage.includes("rate") || errorMessage.includes("limit")) {
    return "Too many requests. Please wait a moment and try again.";
  }

  return "Sorry, I ran into a creative block. Could you try phrasing that differently?";
};

// --- Component ---

const RegenerateIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
    />
  </svg>
);

const DownloadIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
    />
  </svg>
);

const CopyIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
    />
  </svg>
);

const ShareIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
    />
  </svg>
);

const MusicNoteIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
    />
  </svg>
);

const ChevronUpIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5 15l7-7 7 7"
    />
  </svg>
);

// Mini Player for handling simultaneous tracks
const MultiTrackPlayer: React.FC<{
  instrumentalUrl: string;
  vocalUrl: string;
  format?: "mp3" | "wav";
}> = ({ instrumentalUrl, vocalUrl, format = "wav" }) => {
  const instRef = useRef<HTMLAudioElement>(null);
  const vocalRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [muteInst, setMuteInst] = useState(false);
  const [muteVocal, setMuteVocal] = useState(false);

  const togglePlay = () => {
    if (isPlaying) {
      instRef.current?.pause();
      vocalRef.current?.pause();
      setIsPlaying(false);
    } else {
      // Sync start
      if (instRef.current) instRef.current.currentTime = 0;
      if (vocalRef.current) vocalRef.current.currentTime = 0;
      instRef.current?.play();
      vocalRef.current?.play();
      setIsPlaying(true);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-indigo-300 font-bold uppercase tracking-wider">
          Multi-Track Demo
        </p>
        <button
          onClick={togglePlay}
          className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full p-2"
          aria-label={isPlaying ? "Pause audio playback" : "Play audio tracks"}
          aria-pressed={isPlaying}
        >
          {isPlaying ? (
            <svg
              className="w-4 h-4"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          ) : (
            <svg
              className="w-4 h-4"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
      </div>

      <div className="space-y-2">
        {/* Instrumental Row */}
        <div className="flex items-center gap-2 bg-gray-900/50 p-2 rounded">
          <span className="text-xs text-gray-400 w-20">Instrumental</span>
          <button
            onClick={() => setMuteInst(!muteInst)}
            className={`text-xs px-2 py-1 rounded border ${
              muteInst
                ? "bg-red-500/20 text-red-400 border-red-500/50"
                : "bg-gray-700 text-gray-300 border-gray-600"
            }`}
            aria-label={
              muteInst ? "Unmute instrumental track" : "Mute instrumental track"
            }
            aria-pressed={muteInst}
          >
            {muteInst ? "Muted" : "Mute"}
          </button>
          <div className="flex-1 h-1 bg-gray-700 rounded overflow-hidden">
            <div
              className={`h-full bg-indigo-500 ${
                muteInst ? "opacity-30" : "opacity-100"
              }`}
              style={{ width: "100%" }}
            ></div>
          </div>
        </div>

        {/* Vocal Row */}
        <div className="flex items-center gap-2 bg-gray-900/50 p-2 rounded">
          <span className="text-xs text-gray-400 w-20">Vocals</span>
          <button
            onClick={() => setMuteVocal(!muteVocal)}
            className={`text-xs px-2 py-1 rounded border ${
              muteVocal
                ? "bg-red-500/20 text-red-400 border-red-500/50"
                : "bg-gray-700 text-gray-300 border-gray-600"
            }`}
            aria-label={muteVocal ? "Unmute vocal track" : "Mute vocal track"}
            aria-pressed={muteVocal}
          >
            {muteVocal ? "Muted" : "Mute"}
          </button>
          <div className="flex-1 h-1 bg-gray-700 rounded overflow-hidden">
            <div
              className={`h-full bg-pink-500 ${
                muteVocal ? "opacity-30" : "opacity-100"
              }`}
              style={{ width: "100%" }}
            ></div>
          </div>
        </div>
      </div>

      <audio
        ref={instRef}
        src={instrumentalUrl}
        muted={muteInst}
        onEnded={() => setIsPlaying(false)}
      />
      <audio ref={vocalRef} src={vocalUrl} muted={muteVocal} />

      <div className="mt-3 pt-2 border-t border-gray-700 flex justify-end gap-3">
        <a
          href={instrumentalUrl}
          download={`instrumental.${format}`}
          className="text-xs text-gray-400 hover:text-white flex items-center gap-1"
          aria-label={`Download instrumental track as ${format.toUpperCase()}`}
        >
          <DownloadIcon className="w-3 h-3" aria-hidden="true" /> Inst
        </a>
        <a
          href={vocalUrl}
          download={`vocals.${format}`}
          className="text-xs text-gray-400 hover:text-white flex items-center gap-1"
          aria-label={`Download vocal track as ${format.toUpperCase()}`}
        >
          <DownloadIcon className="w-3 h-3" aria-hidden="true" /> Vox
        </a>
      </div>
    </div>
  );
};

interface MusicCreationProps {
  onLyricsGenerated: (
    lyrics: string,
    concept: string,
    audioUrl?: string,
    vocalUrl?: string,
  ) => void;
  onSendToKaraoke?: (song: KaraokeSong) => void;
}

const initialMessages: ChatMessage[] = [
  {
    role: "model",
    text: "Hello! I'm Song Maker GPT, your creative partner. Describe a feeling, a story, or a style of music you have in mind, and let's create a song together.",
  },
];

const SUGGESTED_STYLES = [
  "Lo-fi Hip Hop",
  "Synthwave 80s",
  "Acoustic Folk",
  "Upbeat Pop",
  "Dark Trap",
  "Ambient Chill",
];

const MusicCreation: React.FC<MusicCreationProps> = ({
  onLyricsGenerated,
  onSendToKaraoke,
}) => {
  // State
  const [chatMessages, setChatMessages] =
    useState<ChatMessage[]>(initialMessages);
  const [chatInput, setChatInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [latestSongData, setLatestSongData] = useState<SongData | null>(null);
  const [latestAudioUrl, setLatestAudioUrl] = useState<string | undefined>(
    undefined,
  );
  const [latestVocalUrl, setLatestVocalUrl] = useState<string | undefined>(
    undefined,
  );
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [generationProgress, setGenerationProgress] = useState<string>("");
  const [useElevenLabsApi] = useState<boolean>(isElevenLabsConfigured());
  const [showScrollIndicator, setShowScrollIndicator] = useState(false);
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 768 : false,
  );
  const [isPreparingKaraoke, setIsPreparingKaraoke] = useState(false);

  // Refs
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const audioUrlsRef = useRef<string[]>([]);

  // Hooks
  const { announce } = useLiveRegion();
  const toast = useToastHelpers();

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Audio context initialization
  useEffect(() => {
    if (!audioContext) {
      // Use 44100Hz for better quality when using ElevenLabs (44.1kHz stereo output)
      // Falls back to 24000Hz compatible with Gemini if needed
      const sampleRate = useElevenLabsApi ? 44100 : 24000;
      const context = new (
        window.AudioContext || (window as any).webkitAudioContext
      )({ sampleRate });
      setAudioContext(context);
    }
    return () => {
      audioContext?.close();
    };
  }, [audioContext, useElevenLabsApi]);

  // Mobile detection with debounced resize
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setIsMobile(window.innerWidth < 768);
      }, 150);
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(timeoutId);
    };
  }, []);

  // Scroll indicator detection
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const isScrolledDown = container.scrollTop > 100;
      setShowScrollIndicator(isScrolledDown && chatMessages.length > 3);
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [chatMessages.length]);

  // Cleanup audio URLs on unmount
  useEffect(() => {
    return () => {
      audioUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape to clear input
      if (
        e.key === "Escape" &&
        chatInput &&
        document.activeElement === inputRef.current
      ) {
        setChatInput("");
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [chatInput]);

  // Scroll to top function
  const scrollToTop = useCallback(() => {
    chatContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleChatSend = useCallback(
    async (overrideInput?: string, baseMessages?: ChatMessage[]) => {
      const inputToSend = overrideInput || chatInput;
      if (!inputToSend.trim() || isLoading) return;

      const currentMessages = baseMessages ?? chatMessages;
      const userMessage: ChatMessage = { role: "user", text: inputToSend };
      const newMessages = [...currentMessages, userMessage];
      setChatMessages(newMessages);
      setChatInput("");
      setIsLoading(true);
      announce("Generating song ideas...", "polite");

      try {
        const response = await generateWithTimeout(
          generateOrRefineSong(newMessages),
          45000, // 45 second timeout
        );
        setLatestSongData(response.songData);
        // Reset latest audio when song changes to avoid mismatch
        setLatestAudioUrl(undefined);
        setLatestVocalUrl(undefined);

        const modelMessage: ChatMessage = {
          role: "model",
          text: response.conversationalResponse,
          songData: response.songData,
        };
        setChatMessages([...newMessages, modelMessage]);
        announce("Song lyrics generated successfully", "polite");
      } catch (e) {
        console.error(e);
        const userFriendlyMessage = getErrorMessage(e);
        const errorChatMessage: ChatMessage = {
          role: "model",
          text: userFriendlyMessage,
          isError: true,
        };
        setChatMessages([...newMessages, errorChatMessage]);
        announce("Failed to generate song", "assertive");
      } finally {
        setIsLoading(false);
      }
    },
    [chatInput, isLoading, chatMessages, announce],
  );

  const handleRegenerateText = async () => {
    if (isLoading) return;

    // Find the last user message to determine the history to resend.
    let lastUserMessageIndex = -1;
    for (let i = chatMessages.length - 1; i >= 0; i--) {
      if (chatMessages[i].role === "user") {
        lastUserMessageIndex = i;
        break;
      }
    }

    if (
      lastUserMessageIndex === -1 ||
      chatMessages[chatMessages.length - 1].role !== "model"
    ) {
      return;
    }

    const historyToResend = chatMessages.slice(0, lastUserMessageIndex + 1);

    setChatMessages(historyToResend);
    setIsLoading(true);
    announce("Regenerating response...", "polite");

    try {
      const response = await generateWithTimeout(
        generateOrRefineSong(historyToResend),
        45000,
      );
      setLatestSongData(response.songData);
      setLatestAudioUrl(undefined);
      setLatestVocalUrl(undefined);

      const modelMessage: ChatMessage = {
        role: "model",
        text: response.conversationalResponse,
        songData: response.songData,
      };
      setChatMessages([...historyToResend, modelMessage]);
      announce("New response generated", "polite");
    } catch (e) {
      console.error(e);
      const userFriendlyMessage = getErrorMessage(e);
      const errorChatMessage: ChatMessage = {
        role: "model",
        text: userFriendlyMessage,
        isError: true,
      };
      setChatMessages([...historyToResend, errorChatMessage]);
      announce("Failed to regenerate", "assertive");
    } finally {
      setIsLoading(false);
    }
  };

  // Retry handler for error messages
  const handleRetry = useCallback(
    (messageIndex: number) => {
      // Find the user message before this error
      let userMessageIndex = -1;
      for (let i = messageIndex - 1; i >= 0; i--) {
        if (chatMessages[i].role === "user") {
          userMessageIndex = i;
          break;
        }
      }
      if (userMessageIndex >= 0) {
        const userMessage = chatMessages[userMessageIndex].text;
        // Get messages before the error (excluding the user message we're retrying)
        const messagesBeforeRetry = chatMessages.slice(0, userMessageIndex);
        // Pass the correct base messages to handleChatSend
        handleChatSend(userMessage, messagesBeforeRetry);
      }
    },
    [chatMessages, handleChatSend],
  );

  const handleGenerateFullSong = useCallback(
    async (messageIndex: number) => {
      const message = chatMessages[messageIndex];
      if (!message.songData || !audioContext) return;

      setChatMessages((prev) =>
        prev.map((msg, idx) =>
          idx === messageIndex
            ? {
                ...msg,
                isLoadingAudio: true,
                audioUrl: undefined,
                vocalUrl: undefined,
                audioError: false,
                audioErrorMessage: undefined,
              }
            : msg,
        ),
      );
      announce("Generating audio tracks...", "polite");

      try {
        if (audioContext.state === "suspended") await audioContext.resume();

        let instUrl: string;
        let vocUrl: string;

        if (useElevenLabsApi) {
          // Use ElevenLabs API for high-quality 44.1kHz stereo music
          setGenerationProgress("Generating instrumental track...");

          // Generate instrumental track with ElevenLabs
          const instrumentalBlob = await generateWithTimeout(
            generateInstrumental(
              `${message.songData.style} instrumental track`,
              60000, // 1 minute
              (status) => setGenerationProgress(status),
            ),
            120000, // 2 minute timeout for audio generation
          );
          instUrl = createAudioUrl(instrumentalBlob);
          audioUrlsRef.current.push(instUrl);

          // Generate full song with vocals using ElevenLabs
          setGenerationProgress("Generating vocal track...");
          const vocalBlob = await generateWithTimeout(
            generateSongWithLyrics(
              message.songData.lyrics,
              message.songData.style,
              60000, // 1 minute
              (status) => setGenerationProgress(status),
            ),
            120000,
          );
          vocUrl = createAudioUrl(vocalBlob);
          audioUrlsRef.current.push(vocUrl);

          setGenerationProgress("");
        } else {
          // Use Gemini API (fallback - lower quality 24kHz mono)
          // Generate Instrumental and Vocals in parallel
          const [base64Instrumental, base64Vocal] = await Promise.all([
            generateWithTimeout(
              generateInstrumentalTrack(message.songData.style),
              90000,
            ),
            generateWithTimeout(
              generateSpeech(message.songData.lyrics, "Kore"),
              90000,
            ),
          ]);

          // Decode Instrumental
          const instBytes = decode(base64Instrumental);
          const instBuffer = await decodeAudioData(
            instBytes,
            audioContext,
            24000,
            1,
          );
          const instBlob = bufferToWave(instBuffer);
          instUrl = URL.createObjectURL(instBlob);
          audioUrlsRef.current.push(instUrl);

          // Decode Vocals
          const vocBytes = decode(base64Vocal);
          const vocBuffer = await decodeAudioData(
            vocBytes,
            audioContext,
            24000,
            1,
          );
          const vocBlob = bufferToWave(vocBuffer);
          vocUrl = URL.createObjectURL(vocBlob);
          audioUrlsRef.current.push(vocUrl);
        }

        setLatestAudioUrl(instUrl);
        setLatestVocalUrl(vocUrl);

        setChatMessages((prev) =>
          prev.map((msg, idx) =>
            idx === messageIndex
              ? {
                  ...msg,
                  isLoadingAudio: false,
                  audioUrl: instUrl,
                  vocalUrl: vocUrl,
                }
              : msg,
          ),
        );
        announce("Audio generation complete", "polite");
      } catch (e) {
        console.error("Audio generation failed:", e);
        setGenerationProgress("");
        const errorMsg =
          e instanceof Error && e.message.includes("timed out")
            ? "Audio generation timed out. Please try again."
            : "Audio generation failed. Click retry to try again.";

        setChatMessages((prev) =>
          prev.map((msg, idx) =>
            idx === messageIndex
              ? {
                  ...msg,
                  isLoadingAudio: false,
                  audioError: true,
                  audioErrorMessage: errorMsg,
                }
              : msg,
          ),
        );
        announce("Audio generation failed", "assertive");
      }
    },
    [chatMessages, audioContext, useElevenLabsApi, announce],
  );

  const handleGenerateStructure = useCallback(
    async (messageIndex: number) => {
      const message = chatMessages[messageIndex];
      if (!message.songData) return;

      setChatMessages((prev) =>
        prev.map((msg, idx) =>
          idx === messageIndex ? { ...msg, isLoadingStructure: true } : msg,
        ),
      );
      announce("Analyzing song structure...", "polite");

      try {
        const sections = await generateSongStructure(
          message.songData.lyrics,
          message.songData.style,
        );

        setChatMessages((prev) =>
          prev.map((msg, idx) =>
            idx === messageIndex
              ? { ...msg, isLoadingStructure: false, structurePlan: sections }
              : msg,
          ),
        );
        announce("Structure plan generated", "polite");
      } catch (e) {
        console.error(e);
        setChatMessages((prev) =>
          prev.map((msg, idx) =>
            idx === messageIndex ? { ...msg, isLoadingStructure: false } : msg,
          ),
        );
        announce("Failed to generate structure", "assertive");
      }
    },
    [chatMessages, announce],
  );

  const handleProceed = () => {
    if (latestSongData) {
      // Pass both lyrics AND the instrumental audio URL if it exists
      onLyricsGenerated(
        latestSongData.lyrics,
        latestSongData.style,
        latestAudioUrl,
        latestVocalUrl,
      );
    }
  };

  // Send to Karaoke Mode - generates timing and creates KaraokeSong
  const handleSendToKaraoke = useCallback(async () => {
    if (!latestSongData || !latestAudioUrl || !onSendToKaraoke) return;

    setIsPreparingKaraoke(true);
    announce("Preparing song for karaoke mode...", "polite");

    try {
      // Get duration from audio element
      const audio = new Audio(latestAudioUrl);
      await new Promise<void>((resolve, reject) => {
        audio.onloadedmetadata = () => resolve();
        audio.onerror = () => reject(new Error("Failed to load audio"));
      });
      const duration = audio.duration;

      // Generate lyrics timing using AI
      const timingResult = await generateLyricsTiming(
        latestSongData.lyrics,
        duration,
        latestSongData.style,
      );

      // Create KaraokeSong object
      const karaokeSong: KaraokeSong = {
        id: `karaoke-${Date.now()}`,
        songData: latestSongData,
        instrumentalUrl: latestAudioUrl,
        vocalUrl: latestVocalUrl,
        duration: duration,
        lyricLines: timingResult.lyricLines.map((line, index) => ({
          id: `line-${index}`,
          text: line.text,
          startTime: line.startTime,
          endTime: line.endTime,
          sectionTag: line.sectionTag,
        })),
        bpm: timingResult.estimatedBpm,
        key: timingResult.estimatedKey,
        createdAt: Date.now(),
      };

      onSendToKaraoke(karaokeSong);
      toast.success("Song ready for karaoke!");
      announce("Song prepared for karaoke mode", "polite");
    } catch (error) {
      console.error("Failed to prepare karaoke:", error);
      toast.error("Failed to prepare song for karaoke. Please try again.");
      announce("Failed to prepare karaoke", "assertive");
    } finally {
      setIsPreparingKaraoke(false);
    }
  }, [
    latestSongData,
    latestAudioUrl,
    latestVocalUrl,
    onSendToKaraoke,
    toast,
    announce,
  ]);

  // Copy lyrics to clipboard
  const handleCopyLyrics = useCallback(
    async (lyrics: string) => {
      try {
        await navigator.clipboard.writeText(lyrics);
        toast.success("Lyrics copied to clipboard!");
        announce("Lyrics copied", "polite");
      } catch {
        toast.error("Failed to copy lyrics");
      }
    },
    [toast, announce],
  );

  // Share song (uses Web Share API if available)
  const handleShare = useCallback(
    async (song: SongData) => {
      const shareText = `🎵 "${song.title}"\nStyle: ${song.style}\n\n${song.lyrics}`;

      if (navigator.share) {
        try {
          await navigator.share({
            title: song.title,
            text: shareText,
          });
          announce("Share dialog opened", "polite");
        } catch (e) {
          // User cancelled or share failed
          if ((e as Error).name !== "AbortError") {
            handleCopyLyrics(song.lyrics);
          }
        }
      } else {
        handleCopyLyrics(song.lyrics);
      }
    },
    [handleCopyLyrics, announce],
  );

  // Memoized song display formatter
  const formatSongForDisplay = useCallback(
    (song: SongData) => {
      return (
        <>
          <h3 className="font-bold text-lg mt-4">Title: "{song.title}"</h3>
          <p className="text-sm text-gray-400 italic mt-1">
            Style: {song.style}
          </p>
          <pre className="whitespace-pre-wrap font-sans text-sm bg-gray-900/50 p-3 rounded-md mt-3">
            {song.lyrics}
          </pre>
          {/* Action buttons */}
          <div className="flex gap-2 mt-3">
            <Button
              onClick={() => handleCopyLyrics(song.lyrics)}
              variant="ghost"
              size="sm"
              className="text-xs"
              aria-label="Copy lyrics to clipboard"
            >
              <CopyIcon className="w-3 h-3 mr-1" /> Copy
            </Button>
            <Button
              onClick={() => handleShare(song)}
              variant="ghost"
              size="sm"
              className="text-xs"
              aria-label="Share song"
            >
              <ShareIcon className="w-3 h-3 mr-1" /> Share
            </Button>
          </div>
        </>
      );
    },
    [handleCopyLyrics, handleShare],
  );

  return (
    <Page
      title="Compose with AI"
      description="Create your next song through a conversation. Describe your idea, refine the lyrics and style, and generate music as you go."
    >
      {chatMessages.length === 0 && (
        <WelcomeHero onGetStarted={() => inputRef.current?.focus()} />
      )}
      {/* Responsive container - adapts to mobile and desktop */}
      <div className="flex flex-col min-h-[400px] md:min-h-[500px] max-h-[calc(100vh-10rem)] md:max-h-[calc(100vh-14rem)]">
        <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Chat messages container with ARIA attributes */}
          <div
            ref={chatContainerRef}
            role="log"
            aria-label="Song creation conversation"
            aria-live="polite"
            className="flex-1 overflow-y-auto p-4 space-y-6 relative"
          >
            {/* Scroll to top indicator */}
            {showScrollIndicator && (
              <button
                onClick={scrollToTop}
                className="sticky top-2 left-1/2 -translate-x-1/2 z-10 bg-indigo-600/90 hover:bg-indigo-600 px-3 py-1.5 rounded-full text-xs text-white shadow-lg transition-all flex items-center gap-1"
                aria-label="Scroll to earlier messages"
              >
                <ChevronUpIcon className="w-3 h-3" /> Earlier messages
              </button>
            )}

            {/* Empty state with helpful suggestions */}
            {chatMessages.length <= 1 && !isLoading && (
              <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center p-6">
                <MusicNoteIcon className="w-16 h-16 text-indigo-400/50 mb-4" />
                <h3 className="text-lg font-medium text-gray-300 mb-2">
                  Start Creating
                </h3>
                <p className="text-gray-500 text-sm max-w-md mb-4">
                  Describe your song idea, mood, or story. Try something like:
                </p>
                <div className="space-y-2 text-sm text-indigo-300/80">
                  <p className="italic">
                    "A melancholic ballad about lost love"
                  </p>
                  <p className="italic">
                    "Upbeat summer anthem with tropical vibes"
                  </p>
                  <p className="italic">
                    "Dark electronic track for a night drive"
                  </p>
                </div>
              </div>
            )}

            {chatMessages.map((msg, i) => (
              <div
                key={i}
                role="article"
                aria-label={`${msg.role === "user" ? "You" : "AI Assistant"}`}
                className={`flex flex-col ${
                  msg.role === "user" ? "items-end" : "items-start"
                }`}
              >
                {/* Chat bubble with responsive width and error styling */}
                <div
                  className={`max-w-[85%] md:max-w-prose px-4 py-3 rounded-lg ${
                    msg.role === "user"
                      ? "bg-indigo-600 text-white"
                      : msg.isError
                        ? "bg-red-900/50 border border-red-500/30"
                        : "bg-gray-700"
                  }`}
                >
                  <div className="whitespace-pre-wrap text-sm">{msg.text}</div>

                  {/* Error retry button */}
                  {msg.isError && (
                    <Button
                      onClick={() => handleRetry(i)}
                      variant="ghost"
                      size="sm"
                      className="mt-2 text-red-300 hover:text-red-200"
                    >
                      <RegenerateIcon className="w-4 h-4 mr-1" /> Try Again
                    </Button>
                  )}

                  {msg.songData && (
                    <div className="mt-2 border-t border-gray-600 pt-2">
                      {formatSongForDisplay(msg.songData)}

                      {/* Structure Plan Section */}
                      {msg.structurePlan ? (
                        <div className="mt-4 border-l-2 border-indigo-500 pl-3 space-y-2 bg-gray-800/50 p-3 rounded-r-md">
                          <h4 className="font-bold text-indigo-300 text-sm mb-2">
                            Structure Plan
                          </h4>
                          {msg.structurePlan.map((section, idx) => (
                            <div
                              key={idx}
                              className="flex flex-wrap justify-between text-xs gap-2 border-b border-gray-700 pb-1 last:border-0"
                            >
                              <span className="font-semibold text-white w-20">
                                {section.name}
                              </span>
                              <span className="text-gray-400 flex-1">
                                {section.description}
                              </span>
                              <span className="text-gray-500 font-mono">
                                {section.bars} bars
                              </span>
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
                            {msg.isLoadingStructure
                              ? "Analyzing..."
                              : "Generate Structure Plan"}
                          </Button>
                        </div>
                      )}

                      <div className="mt-4">
                        {msg.isLoadingAudio ? (
                          <div
                            role="status"
                            aria-live="polite"
                            aria-label="Generating audio"
                            className="flex flex-col items-center justify-center p-4 bg-gray-800 rounded-lg"
                          >
                            <span className="sr-only">
                              Generating audio tracks...
                            </span>
                            <div className="flex items-center">
                              <svg
                                className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                              >
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                ></circle>
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                ></path>
                              </svg>
                              <span>
                                {generationProgress ||
                                  "Generating Full Song Demo..."}
                              </span>
                            </div>
                            {useElevenLabsApi && (
                              <p className="text-xs text-gray-500 mt-2">
                                Using ElevenLabs for high-quality audio (this
                                may take 30-60 seconds)
                              </p>
                            )}
                          </div>
                        ) : msg.audioError ? (
                          // Audio error state with retry
                          <div className="flex flex-col items-center justify-center p-4 bg-red-900/30 border border-red-500/30 rounded-lg">
                            <p className="text-sm text-red-300 mb-2">
                              {msg.audioErrorMessage}
                            </p>
                            <Button
                              onClick={() => handleGenerateFullSong(i)}
                              variant="secondary"
                              size="sm"
                            >
                              <RegenerateIcon className="w-4 h-4 mr-1" /> Retry
                              Audio Generation
                            </Button>
                          </div>
                        ) : msg.audioUrl && msg.vocalUrl ? (
                          <MultiTrackPlayer
                            instrumentalUrl={msg.audioUrl}
                            vocalUrl={msg.vocalUrl}
                            format={useElevenLabsApi ? "mp3" : "wav"}
                          />
                        ) : (
                          <Button
                            onClick={() => handleGenerateFullSong(i)}
                            variant="secondary"
                            size="sm"
                            className="w-full"
                          >
                            Generate Full Song Demo (Instrumental + Vocals)
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                {i === chatMessages.length - 1 &&
                  msg.role === "model" &&
                  chatMessages.length > 1 &&
                  !isLoading &&
                  !msg.isError && (
                    <div className="mt-2 text-left">
                      <Button
                        onClick={handleRegenerateText}
                        variant="ghost"
                        size="sm"
                      >
                        <RegenerateIcon className="h-4 w-4 mr-2" />
                        Regenerate Text
                      </Button>
                    </div>
                  )}
              </div>
            ))}
            {isLoading && (
              <div
                className="flex items-start"
                role="status"
                aria-live="polite"
              >
                <div className="max-w-[85%] md:max-w-prose px-4 py-3 rounded-lg bg-gray-700">
                  <span className="sr-only">AI is generating a response</span>
                  <p className="text-sm italic text-gray-400">
                    Song Maker is typing...
                  </p>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <div className="mt-auto p-4 border-t border-gray-700">
            {/* Style suggestions - touch-friendly with larger tap targets */}
            {chatMessages.length === 1 && (
              <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide -mx-4 px-4">
                {SUGGESTED_STYLES.map((style) => (
                  <button
                    key={style}
                    onClick={() =>
                      handleChatSend(`I want to write a ${style} song.`)
                    }
                    className="whitespace-nowrap px-4 py-2 min-h-[44px] bg-gray-700 hover:bg-gray-600 active:bg-gray-500 rounded-full text-sm text-indigo-300 border border-gray-600 transition-colors touch-manipulation"
                  >
                    {style}
                  </button>
                ))}
              </div>
            )}

            {/* Input area with accessibility labels */}
            <div className="flex">
              <label htmlFor="chat-input" className="sr-only">
                Describe your song or give feedback
              </label>
              <textarea
                id="chat-input"
                ref={inputRef}
                rows={isMobile ? 1 : 2}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleChatSend();
                  }
                }}
                className="flex-1 bg-gray-800 border border-gray-600 rounded-l-md focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50 resize-none min-h-[44px] p-3"
                placeholder="Describe your song idea... Try: 'A dreamy indie track about stargazing' or 'Make it more upbeat'"
                disabled={isLoading}
                aria-describedby="chat-input-hint"
              />
              <span id="chat-input-hint" className="sr-only">
                Press Enter to send, Shift+Enter for new line, Escape to clear
              </span>
              <Button
                onClick={() => handleChatSend()}
                isLoading={isLoading}
                className="rounded-l-none self-stretch min-w-[60px] md:min-w-[80px]"
                aria-label="Send message"
              >
                Send
              </Button>
            </div>
          </div>
        </Card>
      </div>
      <div className="mt-6 flex justify-center gap-4">
        <Button
          onClick={handleProceed}
          variant="primary"
          size="lg"
          disabled={!latestSongData}
          aria-label="Proceed to audio production with current song"
        >
          Proceed to Audio Production &raquo;
        </Button>
        {onSendToKaraoke && latestAudioUrl && (
          <Button
            onClick={handleSendToKaraoke}
            variant="gradient"
            size="lg"
            disabled={!latestSongData || !latestAudioUrl || isPreparingKaraoke}
            isLoading={isPreparingKaraoke}
            aria-label="Send song to karaoke mode"
          >
            🎤 Send to Karaoke
          </Button>
        )}
      </div>
    </Page>
  );
};

export default MusicCreation;
