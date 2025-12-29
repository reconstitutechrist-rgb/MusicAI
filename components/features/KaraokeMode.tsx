import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import Card from "../ui/Card";
import Button from "../ui/Button";
import VuMeter from "../ui/VuMeter";
import { useTheme } from "../../context/AppContext";
import {
  KaraokeSong,
  KaraokeRecordingState,
  RecordingEnhancementResult,
  LyricTimingAdjustment,
} from "../../types";
import { enhanceKaraokeVocal } from "../../services/geminiService";

interface KaraokeModeProps {
  availableSongs: KaraokeSong[];
  audioContext: AudioContext | null;
  onRecordingComplete?: (result: RecordingEnhancementResult) => void;
  onOpenInMixer?: (recordingUrl: string) => void;
  onBackToMixer?: () => void;
}

const KaraokeMode: React.FC<KaraokeModeProps> = ({
  availableSongs,
  audioContext,
  onRecordingComplete,
  onOpenInMixer,
  onBackToMixer,
}) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // Song selection state
  const [selectedSong, setSelectedSong] = useState<KaraokeSong | null>(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentLineIndex, setCurrentLineIndex] = useState(-1);

  // Recording state
  const [recordingState, setRecordingState] = useState<KaraokeRecordingState>({
    isRecording: false,
    isPreviewing: false,
    recordedBlobUrl: null,
    recordedBlob: null,
    recordingStartTime: null,
    recordingDuration: 0,
  });
  const [countdown, setCountdown] = useState<number | null>(null);
  const [recordingElapsed, setRecordingElapsed] = useState(0);

  // Timing editor state
  const [isEditingTiming, setIsEditingTiming] = useState(false);
  const [timingAdjustments, setTimingAdjustments] = useState<
    LyricTimingAdjustment[]
  >([]);

  // Post-recording state
  const [showPostRecording, setShowPostRecording] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhancedBlobUrl, setEnhancedBlobUrl] = useState<string | null>(null);
  const [useEnhanced, setUseEnhanced] = useState(false);

  // Audio refs
  const instrumentalRef = useRef<HTMLAudioElement>(null);
  const recordedVocalRef = useRef<HTMLAudioElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const micStreamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const recordingMimeTypeRef = useRef<string>("audio/webm");

  // Refs for cleanup (to avoid stale closure)
  const recordedBlobUrlRef = useRef<string | null>(null);
  const enhancedBlobUrlRef = useRef<string | null>(null);
  const stopRecordingRef = useRef<() => void>(() => {});

  // Compute adjusted lyric lines
  const adjustedLyricLines = useMemo(() => {
    if (!selectedSong) return [];
    return selectedSong.lyricLines.map((line) => {
      const adjustment = timingAdjustments.find((a) => a.lineId === line.id);
      const offsetSec = adjustment ? adjustment.offsetMs / 1000 : 0;
      return {
        ...line,
        startTime: Math.max(0, line.startTime + offsetSec),
        endTime: Math.min(selectedSong.duration, line.endTime + offsetSec),
      };
    });
  }, [selectedSong, timingAdjustments]);

  // Update current line based on playback time
  const updateCurrentLine = useCallback(() => {
    if (!selectedSong || adjustedLyricLines.length === 0) return;

    const time = currentTime;
    const index = adjustedLyricLines.findIndex(
      (line) => time >= line.startTime && time < line.endTime,
    );

    if (index !== currentLineIndex) {
      setCurrentLineIndex(index);
    }
  }, [selectedSong, adjustedLyricLines, currentTime, currentLineIndex]);

  useEffect(() => {
    updateCurrentLine();
  }, [updateCurrentLine]);

  // Playback time update
  useEffect(() => {
    const audio = instrumentalRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      if (recordingState.isRecording) {
        stopRecordingRef.current();
      }
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [recordingState.isRecording]);

  // Mic level monitoring - setup analyser for VuMeter
  useEffect(() => {
    if (!recordingState.isRecording || !audioContext || !micStreamRef.current)
      return;

    const source = audioContext.createMediaStreamSource(micStreamRef.current);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;

    return () => {
      source.disconnect();
      analyserRef.current = null;
    };
  }, [recordingState.isRecording, audioContext]);

  // Recording timer update
  useEffect(() => {
    if (!recordingState.isRecording || !recordingState.recordingStartTime)
      return;

    const interval = setInterval(() => {
      setRecordingElapsed(
        (Date.now() - recordingState.recordingStartTime!) / 1000,
      );
    }, 100);

    return () => clearInterval(interval);
  }, [recordingState.isRecording, recordingState.recordingStartTime]);

  // Song selection handler
  const handleSongSelect = (song: KaraokeSong) => {
    setSelectedSong(song);
    setCurrentTime(0);
    setCurrentLineIndex(-1);
    setTimingAdjustments([]);
    setRecordingState({
      isRecording: false,
      isPreviewing: false,
      recordedBlobUrl: null,
      recordedBlob: null,
      recordingStartTime: null,
      recordingDuration: 0,
    });
    setShowPostRecording(false);
    setEnhancedBlobUrl(null);
    setUseEnhanced(false);
  };

  // Playback controls
  const togglePlayback = () => {
    const audio = instrumentalRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (instrumentalRef.current) {
      instrumentalRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  // Recording controls
  const startRecordingWithCountdown = async () => {
    setCountdown(3);

    for (let i = 3; i > 0; i--) {
      setCountdown(i);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    setCountdown(null);
    await startRecording();
  };

  // Helper to get supported mimeType for recording
  const getSupportedMimeType = (): string | undefined => {
    const mimeTypes = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/ogg;codecs=opus",
    ];
    for (const mimeType of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        return mimeType;
      }
    }
    return undefined; // Let browser choose default
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      micStreamRef.current = stream;

      const mimeType = getSupportedMimeType();
      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      // Store the actual mimeType for blob creation
      recordingMimeTypeRef.current =
        mediaRecorder.mimeType || mimeType || "audio/webm";

      mediaRecorderRef.current = mediaRecorder;
      recordedChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, {
          type: recordingMimeTypeRef.current,
        });
        const url = URL.createObjectURL(blob);
        setRecordingState((prev) => ({
          ...prev,
          isRecording: false,
          recordedBlobUrl: url,
          recordedBlob: blob,
          recordingDuration:
            (Date.now() - (prev.recordingStartTime || 0)) / 1000,
        }));
        stream.getTracks().forEach((track) => track.stop());
        micStreamRef.current = null;
        setShowPostRecording(true);
      };

      // Reset to beginning and start
      if (instrumentalRef.current) {
        instrumentalRef.current.currentTime = 0;
        setCurrentTime(0);
      }

      mediaRecorder.start();

      // Start instrumental playback
      instrumentalRef.current?.play();
      setIsPlaying(true);

      setRecordingState((prev) => ({
        ...prev,
        isRecording: true,
        recordingStartTime: Date.now(),
      }));
    } catch (error) {
      console.error("Recording failed:", error);
      alert(
        "Could not access microphone. Please ensure microphone permissions are granted.",
      );
    }
  };

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && recordingState.isRecording) {
      mediaRecorderRef.current.stop();
      instrumentalRef.current?.pause();
      setIsPlaying(false);
    }
  }, [recordingState.isRecording]);

  // Keep ref in sync for event handlers
  useEffect(() => {
    stopRecordingRef.current = stopRecording;
  }, [stopRecording]);

  const cancelRecording = () => {
    stopRecording();
    setRecordingState({
      isRecording: false,
      isPreviewing: false,
      recordedBlobUrl: null,
      recordedBlob: null,
      recordingStartTime: null,
      recordingDuration: 0,
    });
    setShowPostRecording(false);
  };

  // Post-recording handlers
  const handleEnhanceWithAI = async () => {
    if (!recordingState.recordedBlob) return;

    setIsEnhancing(true);

    try {
      // Convert blob to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(",")[1];
          resolve(base64);
        };
      });
      reader.readAsDataURL(recordingState.recordedBlob);
      const audioBase64 = await base64Promise;

      // Call AI enhancement
      const enhancedBase64 = await enhanceKaraokeVocal(audioBase64, {
        autoTune: true,
        reverb: true,
        key: selectedSong?.key,
      });

      // Convert back to blob and URL
      const binaryString = atob(enhancedBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const enhancedBlob = new Blob([bytes], { type: "audio/wav" });
      const enhancedUrl = URL.createObjectURL(enhancedBlob);

      setEnhancedBlobUrl(enhancedUrl);
      setUseEnhanced(true);
    } catch (error) {
      console.error("Enhancement failed:", error);
      alert("Failed to enhance vocals. Please try again.");
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleOpenInMixer = () => {
    const urlToUse =
      useEnhanced && enhancedBlobUrl
        ? enhancedBlobUrl
        : recordingState.recordedBlobUrl;

    if (urlToUse && onOpenInMixer) {
      onOpenInMixer(urlToUse);
    }
  };

  const handleSaveAndExport = () => {
    const urlToUse =
      useEnhanced && enhancedBlobUrl
        ? enhancedBlobUrl
        : recordingState.recordedBlobUrl;

    if (urlToUse) {
      // Get extension from mimeType
      const getExtension = (mimeType: string): string => {
        if (mimeType.includes("webm")) return "webm";
        if (mimeType.includes("mp4")) return "m4a";
        if (mimeType.includes("ogg")) return "ogg";
        return "webm";
      };
      const rawExt = getExtension(recordingMimeTypeRef.current);

      const link = document.createElement("a");
      link.href = urlToUse;
      link.download = `karaoke_${selectedSong?.songData.title || "recording"}_${Date.now()}.${useEnhanced ? "wav" : rawExt}`;
      link.click();

      onRecordingComplete?.({
        type: useEnhanced ? "ai-enhanced" : "raw",
        processedUrl: urlToUse,
        processingApplied: useEnhanced ? ["auto-tune", "reverb"] : undefined,
      });
    }
  };

  const handleStartOver = () => {
    if (recordingState.recordedBlobUrl) {
      URL.revokeObjectURL(recordingState.recordedBlobUrl);
    }
    if (enhancedBlobUrl) {
      URL.revokeObjectURL(enhancedBlobUrl);
    }

    setRecordingState({
      isRecording: false,
      isPreviewing: false,
      recordedBlobUrl: null,
      recordedBlob: null,
      recordingStartTime: null,
      recordingDuration: 0,
    });
    setShowPostRecording(false);
    setEnhancedBlobUrl(null);
    setUseEnhanced(false);

    if (instrumentalRef.current) {
      instrumentalRef.current.currentTime = 0;
      setCurrentTime(0);
    }
  };

  // Preview playback
  const togglePreview = () => {
    const vocal = recordedVocalRef.current;
    const instrumental = instrumentalRef.current;

    if (!vocal || !instrumental) return;

    if (recordingState.isPreviewing) {
      vocal.pause();
      instrumental.pause();
      setRecordingState((prev) => ({ ...prev, isPreviewing: false }));
    } else {
      vocal.currentTime = 0;
      instrumental.currentTime = 0;
      vocal.play();
      instrumental.play();
      setRecordingState((prev) => ({ ...prev, isPreviewing: true }));
    }
  };

  // Timing adjustment
  const adjustTiming = (lineId: string, offsetMs: number) => {
    setTimingAdjustments((prev) => {
      const existing = prev.find((a) => a.lineId === lineId);
      if (existing) {
        return prev.map((a) =>
          a.lineId === lineId ? { ...a, offsetMs: a.offsetMs + offsetMs } : a,
        );
      }
      return [...prev, { lineId, offsetMs }];
    });
  };

  const resetTiming = () => {
    setTimingAdjustments([]);
  };

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Get section color
  const getSectionColor = (sectionTag?: string) => {
    if (!sectionTag) return "text-gray-400";
    if (sectionTag.toLowerCase().includes("chorus")) return "text-pink-400";
    if (sectionTag.toLowerCase().includes("verse")) return "text-blue-400";
    if (sectionTag.toLowerCase().includes("bridge")) return "text-purple-400";
    if (sectionTag.toLowerCase().includes("intro")) return "text-green-400";
    if (sectionTag.toLowerCase().includes("outro")) return "text-orange-400";
    return "text-indigo-400";
  };

  // Keep refs in sync for cleanup
  useEffect(() => {
    recordedBlobUrlRef.current = recordingState.recordedBlobUrl;
  }, [recordingState.recordedBlobUrl]);

  useEffect(() => {
    enhancedBlobUrlRef.current = enhancedBlobUrl;
  }, [enhancedBlobUrl]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordedBlobUrlRef.current) {
        URL.revokeObjectURL(recordedBlobUrlRef.current);
      }
      if (enhancedBlobUrlRef.current) {
        URL.revokeObjectURL(enhancedBlobUrlRef.current);
      }
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-2xl font-bold flex items-center gap-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            <span className="text-3xl">🎤</span>
            Karaoke Mode
          </h2>
          <p className={`mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Sing along to your AI-generated songs and record your vocals
          </p>
        </div>
        {onBackToMixer && (
          <Button variant="secondary" onClick={onBackToMixer}>
            ← Back to Mixer
          </Button>
        )}
      </div>

      {/* Song Selector */}
      {!selectedSong ? (
        <Card>
          <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Select a Song
          </h3>
          {availableSongs.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🎵</div>
              <p className={`text-lg ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>No songs available yet</p>
              <p className={`text-sm mt-2 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                Create a song in Compose and send it to Karaoke mode
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {availableSongs.map((song) => (
                <button
                  key={song.id}
                  onClick={() => handleSongSelect(song)}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${isDark ? 'bg-gray-800/50 hover:bg-gray-700/50 border-gray-700/50 hover:border-indigo-500/50' : 'bg-gray-50 hover:bg-gray-100 border-gray-200 hover:border-indigo-400'}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {song.songData.title}
                      </h4>
                      <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        {song.songData.style}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                        {formatTime(song.duration)}
                      </span>
                      {song.bpm && (
                        <span className={`text-xs block ${isDark ? 'text-gray-600' : 'text-gray-500'}`}>
                          {song.bpm} BPM
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>
      ) : (
        <>
          {/* Selected Song Info */}
          <Card className="!p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setSelectedSong(null)}
                  className={`p-2 rounded-lg transition-colors ${isDark ? 'bg-gray-700/50 hover:bg-gray-600/50 text-gray-400 hover:text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-900'}`}
                  aria-label="Back to song selection"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>
                <div>
                  <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {selectedSong.songData.title}
                  </h3>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {selectedSong.songData.style}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selectedSong.key && (
                  <span className="px-2 py-1 rounded bg-indigo-500/20 text-indigo-400 text-xs">
                    Key: {selectedSong.key}
                  </span>
                )}
                {selectedSong.bpm && (
                  <span className="px-2 py-1 rounded bg-purple-500/20 text-purple-400 text-xs">
                    {selectedSong.bpm} BPM
                  </span>
                )}
              </div>
            </div>
          </Card>

          {/* Hidden audio elements */}
          <audio
            ref={instrumentalRef}
            src={selectedSong.instrumentalUrl}
            preload="auto"
          />
          {recordingState.recordedBlobUrl && (
            <audio
              ref={recordedVocalRef}
              src={
                useEnhanced && enhancedBlobUrl
                  ? enhancedBlobUrl
                  : recordingState.recordedBlobUrl
              }
              preload="auto"
            />
          )}

          {/* Karaoke Display */}
          <Card className="min-h-[400px] flex flex-col relative">
            {/* Countdown overlay */}
            {countdown !== null && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 rounded-2xl z-10">
                <div className="text-9xl font-bold text-indigo-400 animate-pulse">
                  {countdown}
                </div>
              </div>
            )}

            {/* Lyrics display */}
            <div className="flex-1 flex flex-col items-center justify-center text-center px-8 py-12 relative overflow-hidden">
              {/* Recording indicator */}
              {recordingState.isRecording && (
                <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/20 border border-red-500/50">
                  <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-red-400 text-sm font-medium">
                    Recording
                  </span>
                </div>
              )}

              {/* Previous line */}
              {currentLineIndex > 0 &&
                adjustedLyricLines[currentLineIndex - 1] && (
                  <p className="text-xl text-gray-600 mb-4 transition-all">
                    {adjustedLyricLines[currentLineIndex - 1].text}
                  </p>
                )}

              {/* Current line */}
              {currentLineIndex >= 0 && adjustedLyricLines[currentLineIndex] ? (
                <div className="mb-4">
                  {adjustedLyricLines[currentLineIndex].sectionTag && (
                    <span
                      className={`text-sm font-medium mb-2 block ${getSectionColor(adjustedLyricLines[currentLineIndex].sectionTag)}`}
                    >
                      {adjustedLyricLines[currentLineIndex].sectionTag}
                    </span>
                  )}
                  <p className="text-4xl md:text-5xl font-bold text-white leading-tight animate-pulse-slow">
                    {adjustedLyricLines[currentLineIndex].text}
                  </p>
                  {/* Progress bar for current line */}
                  <div className="mt-4 w-full max-w-md mx-auto h-1 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-pink-500 transition-all duration-100"
                      style={{
                        width: `${
                          ((currentTime -
                            adjustedLyricLines[currentLineIndex].startTime) /
                            (adjustedLyricLines[currentLineIndex].endTime -
                              adjustedLyricLines[currentLineIndex].startTime)) *
                          100
                        }%`,
                      }}
                    />
                  </div>
                </div>
              ) : (
                <p className="text-3xl text-gray-500">
                  {currentTime < (adjustedLyricLines[0]?.startTime || 0)
                    ? "Get ready..."
                    : "♪ ♪ ♪"}
                </p>
              )}

              {/* Next lines */}
              <div className="space-y-2 mt-6">
                {adjustedLyricLines
                  .slice(
                    Math.max(0, currentLineIndex + 1),
                    currentLineIndex + 4,
                  )
                  .map((line, idx) => (
                    <p
                      key={line.id}
                      className={`text-lg transition-all ${
                        idx === 0
                          ? "text-gray-400"
                          : idx === 1
                            ? "text-gray-500"
                            : "text-gray-600"
                      }`}
                    >
                      {line.sectionTag && (
                        <span
                          className={`text-xs mr-2 ${getSectionColor(line.sectionTag)}`}
                        >
                          {line.sectionTag}
                        </span>
                      )}
                      {line.text}
                    </p>
                  ))}
              </div>
            </div>

            {/* Playback controls */}
            <div className={`border-t p-4 ${isDark ? 'border-gray-700/50' : 'border-gray-200'}`}>
              <div className="flex items-center gap-4">
                {/* Play/Pause */}
                <button
                  onClick={togglePlayback}
                  disabled={recordingState.isRecording}
                  className="p-3 rounded-full bg-indigo-500 hover:bg-indigo-400 text-white transition-colors disabled:opacity-50"
                  aria-label={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? (
                    <svg
                      className="w-6 h-6"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                    </svg>
                  ) : (
                    <svg
                      className="w-6 h-6"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </button>

                {/* Time display */}
                <span className={`text-sm w-16 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {formatTime(currentTime)}
                </span>

                {/* Seek slider */}
                <input
                  type="range"
                  min={0}
                  max={duration || selectedSong.duration}
                  value={currentTime}
                  onChange={handleSeek}
                  disabled={recordingState.isRecording}
                  className={`flex-1 h-2 rounded-lg appearance-none cursor-pointer accent-indigo-500 disabled:opacity-50 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}
                />

                {/* Duration */}
                <span className={`text-sm w-16 text-right ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {formatTime(duration || selectedSong.duration)}
                </span>
              </div>
            </div>
          </Card>

          {/* Recording Controls */}
          {!showPostRecording && (
            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Recording
                  </h3>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    Record your vocals over the instrumental
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  {/* Mic level meter */}
                  {recordingState.isRecording && analyserRef.current && (
                    <div className="w-32">
                      <VuMeter
                        analyser={analyserRef.current}
                        orientation="horizontal"
                      />
                    </div>
                  )}

                  {recordingState.isRecording ? (
                    <>
                      <span className="text-red-400 font-mono">
                        {formatTime(recordingElapsed)}
                      </span>
                      <Button
                        variant="secondary"
                        onClick={cancelRecording}
                        size="sm"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={stopRecording}
                        className="!bg-red-500 hover:!bg-red-400"
                      >
                        <svg
                          className="w-5 h-5 mr-2"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <rect x="6" y="6" width="12" height="12" rx="1" />
                        </svg>
                        Stop Recording
                      </Button>
                    </>
                  ) : (
                    <Button
                      onClick={startRecordingWithCountdown}
                      disabled={countdown !== null}
                      className="!bg-red-500 hover:!bg-red-400"
                    >
                      <svg
                        className="w-5 h-5 mr-2"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <circle cx="12" cy="12" r="8" />
                      </svg>
                      Start Recording
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* Post-Recording Flow */}
          {showPostRecording && (
            <Card>
              <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Your Recording
              </h3>

              {/* Preview section */}
              <div className={`mb-6 p-4 rounded-xl ${isDark ? 'bg-gray-800/50' : 'bg-gray-100'}`}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Preview</p>
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      Listen to your recording over the instrumental
                    </p>
                  </div>
                  <Button variant="secondary" onClick={togglePreview} size="sm">
                    {recordingState.isPreviewing ? (
                      <>
                        <svg
                          className="w-4 h-4 mr-2"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                        </svg>
                        Stop Preview
                      </>
                    ) : (
                      <>
                        <svg
                          className="w-4 h-4 mr-2"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M8 5v14l11-7z" />
                        </svg>
                        Play Preview
                      </>
                    )}
                  </Button>
                </div>

                {/* Enhanced toggle */}
                {enhancedBlobUrl && (
                  <div className={`flex items-center gap-4 p-3 rounded-lg ${isDark ? 'bg-gray-700/50' : 'bg-gray-200/50'}`}>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useEnhanced}
                        onChange={(e) => setUseEnhanced(e.target.checked)}
                        className={`w-4 h-4 rounded text-indigo-500 focus:ring-indigo-500 ${isDark ? 'border-gray-600 focus:ring-offset-gray-800' : 'border-gray-300 focus:ring-offset-white'}`}
                      />
                      <span className={isDark ? 'text-white' : 'text-gray-900'}>
                        Use AI Enhanced Version
                      </span>
                    </label>
                    <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                      Auto-tune + Reverb applied
                    </span>
                  </div>
                )}
              </div>

              {/* Enhancement section */}
              <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/30">
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`font-medium flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      <span className="text-xl">✨</span>
                      AI Enhancement
                    </p>
                    <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      Apply auto-tune and reverb to polish your vocals
                    </p>
                  </div>
                  <Button
                    onClick={handleEnhanceWithAI}
                    disabled={isEnhancing || !!enhancedBlobUrl}
                    isLoading={isEnhancing}
                  >
                    {enhancedBlobUrl ? (
                      <>
                        <svg
                          className="w-5 h-5 mr-2 text-green-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        Enhanced
                      </>
                    ) : (
                      "Enhance with AI"
                    )}
                  </Button>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-4">
                <Button onClick={handleOpenInMixer} variant="gradient">
                  <svg
                    className="w-5 h-5 mr-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                    />
                  </svg>
                  Open in Mixer
                </Button>

                <Button onClick={handleSaveAndExport} variant="secondary">
                  <svg
                    className="w-5 h-5 mr-2"
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
                  Save & Export
                </Button>

                <Button onClick={handleStartOver} variant="ghost">
                  <svg
                    className="w-5 h-5 mr-2"
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
                  Start Over
                </Button>
              </div>
            </Card>
          )}

          {/* Timing Editor */}
          <Card>
            <button
              onClick={() => setIsEditingTiming(!isEditingTiming)}
              className="w-full flex items-center justify-between"
            >
              <div>
                <h3 className={`text-lg font-semibold text-left ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Timing Adjustments
                </h3>
                <p className={`text-sm text-left ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Fine-tune lyrics timing if needed
                </p>
              </div>
              <svg
                className={`w-5 h-5 transition-transform ${isEditingTiming ? "rotate-180" : ""} ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {isEditingTiming && (
              <div className="mt-4 space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    Adjust timing for individual lines (±ms)
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetTiming}
                    disabled={timingAdjustments.length === 0}
                  >
                    Reset All
                  </Button>
                </div>

                <div className="max-h-64 overflow-y-auto space-y-2">
                  {adjustedLyricLines.map((line, index) => {
                    const adjustment = timingAdjustments.find(
                      (a) => a.lineId === line.id,
                    );
                    return (
                      <div
                        key={line.id}
                        className={`flex items-center gap-4 p-2 rounded-lg ${isDark ? 'bg-gray-800/50' : 'bg-gray-100'}`}
                      >
                        <span className={`text-xs w-8 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                          #{index + 1}
                        </span>
                        <span className={`flex-1 text-sm truncate ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                          {line.text}
                        </span>
                        <span className={`text-xs w-24 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                          {formatTime(line.startTime)} -{" "}
                          {formatTime(line.endTime)}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() =>
                              adjustTiming(
                                selectedSong.lyricLines[index].id,
                                -100,
                              )
                            }
                            className={`p-1 rounded ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
                            title="Earlier (-100ms)"
                          >
                            -
                          </button>
                          <span className={`w-16 text-center text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {adjustment?.offsetMs || 0}ms
                          </span>
                          <button
                            onClick={() =>
                              adjustTiming(
                                selectedSong.lyricLines[index].id,
                                100,
                              )
                            }
                            className={`p-1 rounded ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
                            title="Later (+100ms)"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
};

export default KaraokeMode;
