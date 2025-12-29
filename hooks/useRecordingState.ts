import { useState, useCallback, useRef, useEffect } from "react";

export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  audioBlob: Blob | null;
  audioUrl: string | null;
  error: string | null;
}

export interface RecordingActions {
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  resetRecording: () => void;
  setError: (error: string | null) => void;
}

export interface UseRecordingStateOptions {
  maxDuration?: number; // in seconds
  mimeType?: string;
  onRecordingComplete?: (blob: Blob) => void;
  onError?: (error: string) => void;
}

export function useRecordingState(
  options: UseRecordingStateOptions = {}
): [RecordingState, RecordingActions] {
  const {
    maxDuration = 300, // 5 minutes default
    mimeType = "audio/webm",
    onRecordingComplete,
    onError,
  } = options;

  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedDurationRef = useRef<number>(0);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      chunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported(mimeType) ? mimeType : "audio/webm",
      });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(blob);

        // Revoke old URL if exists
        if (audioUrl) {
          URL.revokeObjectURL(audioUrl);
        }
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        onRecordingComplete?.(blob);
      };

      mediaRecorder.onerror = () => {
        const errorMsg = "Recording failed. Please check microphone permissions.";
        setError(errorMsg);
        onError?.(errorMsg);
      };

      mediaRecorder.start(100); // Capture in 100ms chunks
      setIsRecording(true);
      setIsPaused(false);
      startTimeRef.current = Date.now();
      pausedDurationRef.current = 0;

      // Start duration timer
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor(
          (Date.now() - startTimeRef.current - pausedDurationRef.current) / 1000
        );
        setDuration(elapsed);

        // Auto-stop if max duration reached
        if (elapsed >= maxDuration && mediaRecorderRef.current?.state === "recording") {
          mediaRecorderRef.current.stop();
          setIsRecording(false);
          if (timerRef.current) {
            clearInterval(timerRef.current);
          }
        }
      }, 100);
    } catch (err) {
      const errorMsg =
        err instanceof Error && err.name === "NotAllowedError"
          ? "Microphone access denied. Please allow microphone access in your browser settings."
          : "Could not access microphone. Please check your device settings.";
      setError(errorMsg);
      onError?.(errorMsg);
    }
  }, [mimeType, maxDuration, audioUrl, onRecordingComplete, onError]);

  const stopRecording = useCallback((): Promise<Blob | null> => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const recorder = mediaRecorderRef.current;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    setIsRecording(false);
    setIsPaused(false);

    // Return a promise that resolves when the onstop handler fires
    if (recorder && recorder.state !== "inactive") {
      return new Promise((resolve) => {
        const originalOnStop = recorder.onstop;
        recorder.onstop = (event) => {
          // Call original handler which sets up the blob
          if (originalOnStop && typeof originalOnStop === "function") {
            originalOnStop.call(recorder, event);
          }
          // Resolve with the blob after a microtask to ensure state is set
          setTimeout(() => {
            const blob = chunksRef.current.length > 0
              ? new Blob(chunksRef.current, { type: mimeType })
              : null;
            resolve(blob);
          }, 0);
        };
        recorder.stop();
      });
    }

    return Promise.resolve(null);
  }, [mimeType]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      pausedDurationRef.current += Date.now() - startTimeRef.current;
    }
  }, []);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "paused") {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      startTimeRef.current = Date.now();
    }
  }, []);

  const resetRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }

    setIsRecording(false);
    setIsPaused(false);
    setDuration(0);
    setAudioBlob(null);
    setAudioUrl(null);
    setError(null);
    chunksRef.current = [];
  }, [audioUrl]);

  const state: RecordingState = {
    isRecording,
    isPaused,
    duration,
    audioBlob,
    audioUrl,
    error,
  };

  const actions: RecordingActions = {
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    resetRecording,
    setError,
  };

  return [state, actions];
}

export default useRecordingState;
