import React, { useState, useEffect, useCallback, useRef } from "react";
import Card from "../ui/Card";
import Button from "../ui/Button";
import VuMeter from "../ui/VuMeter";
import { KaraokeCollaboration } from "../../types/community";
import { uploadAudio, submitAudition } from "../../services/communityService";
import { enhanceKaraokeVocal } from "../../services/geminiService";

interface AuditionRecorderProps {
  collaboration: KaraokeCollaboration;
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface RecordingState {
  isRecording: boolean;
  isPreviewing: boolean;
  recordedBlobUrl: string | null;
  recordedBlob: Blob | null;
  recordingStartTime: number | null;
  recordingDuration: number;
}

const AuditionRecorder: React.FC<AuditionRecorderProps> = ({
  collaboration,
  userId,
  onClose,
  onSuccess,
}) => {
  // Recording state
  const [recordingState, setRecordingState] = useState<RecordingState>({
    isRecording: false,
    isPreviewing: false,
    recordedBlobUrl: null,
    recordedBlob: null,
    recordingStartTime: null,
    recordingDuration: 0,
  });
  const [countdown, setCountdown] = useState<number | null>(null);
  const [recordingElapsed, setRecordingElapsed] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Post-recording state
  const [showPostRecording, setShowPostRecording] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhancedBlobUrl, setEnhancedBlobUrl] = useState<string | null>(null);
  const [useEnhanced, setUseEnhanced] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Analyser state for VuMeter (using state to trigger re-renders)
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  // Part selection for multi-part collaborations
  const [selectedPart, setSelectedPart] = useState<string | null>(
    collaboration.partsNeeded?.[0]?.part || null
  );

  // Audio refs
  const instrumentalRef = useRef<HTMLAudioElement>(null);
  const recordedVocalRef = useRef<HTMLAudioElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const micStreamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const recordingMimeTypeRef = useRef<string>("audio/webm");

  // Refs for cleanup
  const recordedBlobUrlRef = useRef<string | null>(null);
  const enhancedBlobUrlRef = useRef<string | null>(null);
  const stopRecordingRef = useRef<() => void>(() => {});
  const countdownAbortRef = useRef<boolean>(false);
  const mediaSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
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
    return undefined;
  };

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

  // Mic level monitoring
  useEffect(() => {
    if (!recordingState.isRecording || !micStreamRef.current) {
      setAnalyser(null);
      return;
    }

    let isActive = true;

    const setupAnalyser = async () => {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      const audioContext = audioContextRef.current;

      // Resume AudioContext if suspended (browser autoplay policy)
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      // Check if still active after async operation
      if (!isActive || !micStreamRef.current) return;

      const source = audioContext.createMediaStreamSource(micStreamRef.current);
      const newAnalyser = audioContext.createAnalyser();
      newAnalyser.fftSize = 256;
      source.connect(newAnalyser);
      mediaSourceRef.current = source;
      analyserRef.current = newAnalyser;
      setAnalyser(newAnalyser);
    };

    setupAnalyser();

    return () => {
      isActive = false;
      if (mediaSourceRef.current) {
        mediaSourceRef.current.disconnect();
        mediaSourceRef.current = null;
      }
      if (analyserRef.current) {
        setAnalyser(null);
        analyserRef.current = null;
      }
    };
  }, [recordingState.isRecording]);

  // Recording timer update
  useEffect(() => {
    if (!recordingState.isRecording || !recordingState.recordingStartTime)
      return;

    const interval = setInterval(() => {
      setRecordingElapsed(
        (Date.now() - recordingState.recordingStartTime!) / 1000
      );
    }, 100);

    return () => clearInterval(interval);
  }, [recordingState.isRecording, recordingState.recordingStartTime]);

  // Playback controls
  const togglePlayback = async () => {
    const audio = instrumentalRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      try {
        await audio.play();
        setIsPlaying(true);
      } catch (err) {
        console.error("Playback failed:", err);
        setError("Failed to play instrumental track");
      }
    }
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
    // Clear any previous errors
    setError(null);

    // Stop any instrumental preview before countdown
    if (isPlaying && instrumentalRef.current) {
      instrumentalRef.current.pause();
      setIsPlaying(false);
    }

    countdownAbortRef.current = false;
    setCountdown(3);

    for (let i = 3; i > 0; i--) {
      if (countdownAbortRef.current) {
        setCountdown(null);
        return;
      }
      setCountdown(i);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (countdownAbortRef.current) {
      setCountdown(null);
      return;
    }

    setCountdown(null);
    await startRecording();
  };

  const abortCountdown = () => {
    countdownAbortRef.current = true;
    setCountdown(null);
  };

  const startRecording = async () => {
    // Check browser support
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Your browser does not support audio recording. Please try a modern browser like Chrome or Firefox.");
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      setError("Your browser does not support MediaRecorder. Please try a modern browser like Chrome or Firefox.");
      return;
    }

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
      if (instrumentalRef.current) {
        try {
          await instrumentalRef.current.play();
          setIsPlaying(true);
        } catch (playErr) {
          console.error("Instrumental playback failed:", playErr);
          // Continue recording even if instrumental fails
        }
      }

      setRecordingState((prev) => ({
        ...prev,
        isRecording: true,
        recordingStartTime: Date.now(),
      }));
    } catch (err) {
      console.error("Recording failed:", err);
      setError(
        "Could not access microphone. Please ensure microphone permissions are granted."
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
    setError(null);
    setRecordingElapsed(0);
  };

  // Post-recording handlers
  const handleEnhanceWithAI = async () => {
    if (!recordingState.recordedBlob) return;

    // Stop preview if playing
    if (recordingState.isPreviewing) {
      recordedVocalRef.current?.pause();
      instrumentalRef.current?.pause();
      setRecordingState((prev) => ({ ...prev, isPreviewing: false }));
    }

    setIsEnhancing(true);
    setError(null);

    try {
      // Convert blob to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          if (reader.result) {
            const base64 = (reader.result as string).split(",")[1];
            resolve(base64);
          } else {
            reject(new Error("Failed to read audio file"));
          }
        };
        reader.onerror = () => {
          reject(new Error("Failed to read audio file"));
        };
      });
      reader.readAsDataURL(recordingState.recordedBlob);
      const audioBase64 = await base64Promise;

      // Call AI enhancement
      const enhancedBase64 = await enhanceKaraokeVocal(audioBase64, {
        autoTune: true,
        reverb: true,
        key: collaboration.songKey || undefined,
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
    } catch (err) {
      console.error("Enhancement failed:", err);
      setError("Failed to enhance vocals. You can still submit the raw recording.");
    } finally {
      setIsEnhancing(false);
    }
  };

  // Preview playback
  const togglePreview = async () => {
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

      try {
        await Promise.all([vocal.play(), instrumental.play()]);
        setRecordingState((prev) => ({ ...prev, isPreviewing: true }));
      } catch (err) {
        console.error("Preview playback failed:", err);
        setError("Failed to start preview playback");
      }
    }
  };

  // Handle preview ended
  useEffect(() => {
    const vocal = recordedVocalRef.current;
    const instrumental = instrumentalRef.current;

    if (!vocal || !instrumental) return;

    const handleEnded = () => {
      setRecordingState((prev) => ({ ...prev, isPreviewing: false }));
    };

    vocal.addEventListener("ended", handleEnded);
    instrumental.addEventListener("ended", handleEnded);

    return () => {
      vocal.removeEventListener("ended", handleEnded);
      instrumental.removeEventListener("ended", handleEnded);
    };
  }, [recordingState.recordedBlobUrl, enhancedBlobUrl, useEnhanced]);

  const handleStartOver = () => {
    // Stop any playing audio first
    if (recordingState.isPreviewing) {
      recordedVocalRef.current?.pause();
      instrumentalRef.current?.pause();
    }

    // Revoke blob URLs
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
    setError(null);
    setRecordingElapsed(0);

    if (instrumentalRef.current) {
      instrumentalRef.current.currentTime = 0;
      setCurrentTime(0);
    }
  };

  // Submit audition
  const handleSubmit = async () => {
    if (!recordingState.recordedBlob) return;

    // Stop preview if playing
    if (recordingState.isPreviewing) {
      recordedVocalRef.current?.pause();
      instrumentalRef.current?.pause();
      setRecordingState((prev) => ({ ...prev, isPreviewing: false }));
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Determine which blob to use
      let blobToUpload = recordingState.recordedBlob;
      let fileExtension = "webm";

      if (useEnhanced && enhancedBlobUrl) {
        // Fetch the enhanced blob from URL
        const response = await fetch(enhancedBlobUrl);
        blobToUpload = await response.blob();
        fileExtension = "wav";
      } else {
        // Get extension from mimeType
        const mimeType = recordingMimeTypeRef.current;
        if (mimeType.includes("webm")) fileExtension = "webm";
        else if (mimeType.includes("mp4")) fileExtension = "m4a";
        else if (mimeType.includes("ogg")) fileExtension = "ogg";
      }

      // Upload audio
      const audioPath = `collabs/${collaboration.id}/submissions/${userId}_${Date.now()}.${fileExtension}`;
      const uploadResult = await uploadAudio(blobToUpload, audioPath);

      if (uploadResult.error || !uploadResult.url) {
        setError(uploadResult.error || "Failed to upload recording");
        setIsSubmitting(false);
        return;
      }

      // Submit audition
      const result = await submitAudition(
        collaboration.id,
        userId,
        uploadResult.url,
        selectedPart || undefined,
        useEnhanced
      );

      if (result.error) {
        setError(result.error);
      } else {
        onSuccess();
      }
    } catch (err) {
      console.error("Submission failed:", err);
      setError("Failed to submit audition. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Keep refs in sync for cleanup
  useEffect(() => {
    recordedBlobUrlRef.current = recordingState.recordedBlobUrl;
  }, [recordingState.recordedBlobUrl]);

  useEffect(() => {
    enhancedBlobUrlRef.current = enhancedBlobUrl;
  }, [enhancedBlobUrl]);

  // Handle Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !recordingState.isRecording && !isSubmitting && !isEnhancing && countdown === null) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, recordingState.isRecording, isSubmitting, isEnhancing, countdown]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Abort any ongoing countdown
      countdownAbortRef.current = true;

      // Revoke blob URLs
      if (recordedBlobUrlRef.current) {
        URL.revokeObjectURL(recordedBlobUrlRef.current);
      }
      if (enhancedBlobUrlRef.current) {
        URL.revokeObjectURL(enhancedBlobUrlRef.current);
      }

      // Stop mic stream
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((track) => track.stop());
      }

      // Disconnect media source
      if (mediaSourceRef.current) {
        mediaSourceRef.current.disconnect();
      }

      // Close audio context
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }

      // Pause and cleanup audio elements (access refs directly at cleanup time)
      if (instrumentalRef.current) {
        instrumentalRef.current.pause();
        instrumentalRef.current.src = "";
      }
      if (recordedVocalRef.current) {
        recordedVocalRef.current.pause();
        recordedVocalRef.current.src = "";
      }
    };
  }, []);

  // Handle overlay click to close
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only close if clicking the overlay itself, not the card
    if (e.target === e.currentTarget && !recordingState.isRecording && !isSubmitting && !isEnhancing && countdown === null) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="audition-recorder-title"
    >
      <Card className="w-full max-w-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 id="audition-recorder-title" className="text-xl font-bold text-white">Record Audition</h2>
            <p className="text-gray-400 text-sm mt-1">{collaboration.title}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={recordingState.isRecording || isSubmitting || isEnhancing || countdown !== null}
            aria-label="Close audition recorder"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-4 bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-400 text-sm"
          >
            {error}
          </div>
        )}

        {/* Part selector for multi-part collaborations */}
        {collaboration.collabType === "multi_part" &&
          collaboration.partsNeeded &&
          collaboration.partsNeeded.length > 0 && (
            <div className="mb-6">
              <label
                htmlFor="part-selector"
                className="block text-sm font-medium text-gray-300 mb-2"
              >
                Select Part to Audition
              </label>
              <select
                id="part-selector"
                value={selectedPart || ""}
                onChange={(e) => setSelectedPart(e.target.value || null)}
                disabled={recordingState.isRecording || countdown !== null || isSubmitting}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {collaboration.partsNeeded.map((part) => (
                  <option key={part.part} value={part.part}>
                    {part.part}
                    {part.description ? ` - ${part.description}` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

        {/* Hidden audio elements */}
        <audio
          ref={instrumentalRef}
          src={collaboration.instrumentalUrl}
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

        {/* Recording area */}
        <div className="bg-gray-800/50 rounded-xl p-6 mb-6 relative min-h-[200px] flex flex-col items-center justify-center">
          {/* Countdown overlay */}
          {countdown !== null && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 rounded-xl z-10">
              <div className="text-9xl font-bold text-indigo-400 animate-pulse">
                {countdown}
              </div>
              <button
                onClick={abortCountdown}
                className="mt-6 px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Recording indicator */}
          {recordingState.isRecording && (
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/20 border border-red-500/50">
                <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                <span className="text-red-400 font-medium">Recording</span>
              </div>
              <span className="text-4xl font-mono text-white">
                {formatTime(recordingElapsed)}
              </span>
              {analyser && (
                <div className="w-48">
                  <VuMeter analyser={analyser} orientation="horizontal" />
                </div>
              )}
            </div>
          )}

          {/* Instructions when not recording */}
          {!recordingState.isRecording && !showPostRecording && (
            <div className="text-center">
              <div className="text-5xl mb-4">🎤</div>
              <p className="text-gray-400">
                Click "Start Recording" to begin. The instrumental will play
                while you sing.
              </p>
            </div>
          )}

          {/* Post-recording state */}
          {showPostRecording && (
            <div className="text-center">
              <div className="text-5xl mb-4">✓</div>
              <p className="text-white font-medium">Recording Complete</p>
              <p className="text-gray-400 text-sm">
                Duration: {formatTime(recordingState.recordingDuration)}
              </p>
            </div>
          )}
        </div>

        {/* Lyrics display */}
        {collaboration.lyrics && !showPostRecording && (
          <div className="mb-6 p-4 bg-gray-800/30 rounded-lg max-h-40 overflow-y-auto">
            <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Lyrics</p>
            <pre className="text-gray-300 text-sm whitespace-pre-wrap font-sans">
              {collaboration.lyrics}
            </pre>
          </div>
        )}

        {/* Playback controls - show when not recording and not in countdown */}
        {!recordingState.isRecording && !showPostRecording && countdown === null && (
          <div className="mb-6 p-4 bg-gray-800/30 rounded-lg">
            <p className="text-sm text-gray-400 mb-3">
              Preview the instrumental before recording
            </p>
            <div className="flex items-center gap-4">
              <button
                onClick={togglePlayback}
                className="p-3 rounded-full bg-indigo-500 hover:bg-indigo-400 text-white transition-colors"
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>

              <span className="text-sm text-gray-400 w-12">
                {formatTime(currentTime)}
              </span>

              <input
                type="range"
                min={0}
                max={duration || collaboration.duration || 180}
                step={0.1}
                value={currentTime}
                onChange={handleSeek}
                aria-label="Seek instrumental track"
                className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />

              <span className="text-sm text-gray-400 w-12 text-right">
                {formatTime(duration || collaboration.duration || 0)}
              </span>
            </div>
          </div>
        )}

        {/* Recording controls */}
        {!showPostRecording ? (
          <div className="flex justify-between items-center">
            <Button
              variant="secondary"
              onClick={onClose}
              disabled={recordingState.isRecording || countdown !== null}
            >
              Cancel
            </Button>

            <div className="flex items-center gap-3">
              {recordingState.isRecording ? (
                <>
                  <Button variant="secondary" onClick={cancelRecording} size="sm">
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
        ) : (
          <div className="space-y-4">
            {/* Preview section */}
            <div className="p-4 rounded-xl bg-gray-800/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">Preview</p>
                  <p className="text-sm text-gray-400">
                    Listen to your recording over the instrumental
                  </p>
                </div>
                <Button
                  variant="secondary"
                  onClick={togglePreview}
                  size="sm"
                  disabled={isEnhancing || isSubmitting}
                >
                  {recordingState.isPreviewing ? (
                    <>
                      <svg
                        className="w-4 h-4 mr-2"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                      </svg>
                      Stop
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
                      Play
                    </>
                  )}
                </Button>
              </div>

              {/* Enhanced toggle */}
              {enhancedBlobUrl && (
                <div className="mt-3 flex items-center gap-4 p-3 rounded-lg bg-gray-700/50">
                  <label className={`flex items-center gap-3 ${recordingState.isPreviewing ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
                    <input
                      type="checkbox"
                      checked={useEnhanced}
                      onChange={(e) => setUseEnhanced(e.target.checked)}
                      disabled={recordingState.isPreviewing}
                      className="w-4 h-4 rounded border-gray-600 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-gray-800 disabled:opacity-50"
                    />
                    <span className="text-white text-sm">
                      Use AI Enhanced Version
                    </span>
                  </label>
                  <span className="text-xs text-gray-500">
                    {recordingState.isPreviewing ? "Stop preview to toggle" : "Auto-tune + Reverb applied"}
                  </span>
                </div>
              )}
            </div>

            {/* Enhancement section */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/30">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium flex items-center gap-2">
                    <span className="text-xl">✨</span>
                    AI Enhancement
                  </p>
                  <p className="text-sm text-gray-400 mt-1">
                    Apply auto-tune and reverb to polish your vocals
                  </p>
                </div>
                <Button
                  onClick={handleEnhanceWithAI}
                  disabled={isEnhancing || !!enhancedBlobUrl}
                  isLoading={isEnhancing}
                  size="sm"
                >
                  {enhancedBlobUrl ? (
                    <>
                      <svg
                        className="w-4 h-4 mr-2 text-green-400"
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
                    "Enhance"
                  )}
                </Button>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex justify-between pt-4 border-t border-gray-700">
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  onClick={handleStartOver}
                  size="sm"
                  disabled={isEnhancing || isSubmitting}
                >
                  <svg
                    className="w-4 h-4 mr-2"
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
                  Re-record
                </Button>
                <Button
                  variant="secondary"
                  onClick={onClose}
                  size="sm"
                  disabled={isEnhancing || isSubmitting}
                >
                  Cancel
                </Button>
              </div>

              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || isEnhancing}
                isLoading={isSubmitting}
              >
                Submit Audition
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default AuditionRecorder;
