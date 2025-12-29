import { useState, useCallback, useRef, useEffect } from "react";

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isLoading: boolean;
  error: string | null;
  playbackRate: number;
}

export interface PlaybackActions {
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setPlaybackRate: (rate: number) => void;
  reset: () => void;
}

export interface UsePlaybackStateOptions {
  initialVolume?: number;
  autoPlay?: boolean;
  loop?: boolean;
  onEnded?: () => void;
  onTimeUpdate?: (time: number) => void;
  onError?: (error: string) => void;
}

export function usePlaybackState(
  audioUrl: string | null,
  options: UsePlaybackStateOptions = {}
): [PlaybackState, PlaybackActions, React.RefObject<HTMLAudioElement>] {
  const {
    initialVolume = 1,
    autoPlay = false,
    loop = false,
    onEnded,
    onTimeUpdate,
    onError,
  } = options;

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(initialVolume);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playbackRate, setPlaybackRateState] = useState(1);

  const audioRef = useRef<HTMLAudioElement>(null);
  const prevVolumeRef = useRef(initialVolume);

  // Initialize audio element
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadStart = () => setIsLoading(true);
    const handleCanPlay = () => {
      setIsLoading(false);
      setDuration(audio.duration || 0);
      if (autoPlay) {
        audio.play().catch(() => {
          // Autoplay was prevented
        });
      }
    };
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      onTimeUpdate?.(audio.currentTime);
    };
    const handleEnded = () => {
      setIsPlaying(false);
      if (!loop) {
        setCurrentTime(0);
      }
      onEnded?.();
    };
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleError = () => {
      const errorMsg = "Failed to load audio. The file may be corrupted or unsupported.";
      setError(errorMsg);
      setIsLoading(false);
      onError?.(errorMsg);
    };
    const handleDurationChange = () => {
      setDuration(audio.duration || 0);
    };

    audio.addEventListener("loadstart", handleLoadStart);
    audio.addEventListener("canplay", handleCanPlay);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("error", handleError);
    audio.addEventListener("durationchange", handleDurationChange);

    // Set initial properties
    audio.volume = volume;
    audio.loop = loop;
    audio.playbackRate = playbackRate;

    return () => {
      audio.removeEventListener("loadstart", handleLoadStart);
      audio.removeEventListener("canplay", handleCanPlay);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("error", handleError);
      audio.removeEventListener("durationchange", handleDurationChange);
    };
  }, [autoPlay, loop, onEnded, onTimeUpdate, onError, volume, playbackRate]);

  // Update audio source when URL changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audioUrl) {
      setError(null);
      audio.src = audioUrl;
      audio.load();
    } else {
      audio.src = "";
      setDuration(0);
      setCurrentTime(0);
      setIsPlaying(false);
    }
  }, [audioUrl]);

  const play = useCallback(() => {
    const audio = audioRef.current;
    if (audio && audioUrl) {
      audio.play().catch((err) => {
        const errorMsg = err.name === "NotAllowedError"
          ? "Playback was blocked. Click to enable audio."
          : "Failed to play audio.";
        setError(errorMsg);
        onError?.(errorMsg);
      });
    }
  }, [audioUrl, onError]);

  const pause = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
    }
  }, []);

  const toggle = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (audio) {
      const clampedTime = Math.max(0, Math.min(time, duration));
      audio.currentTime = clampedTime;
      setCurrentTime(clampedTime);
    }
  }, [duration]);

  const setVolume = useCallback((newVolume: number) => {
    const audio = audioRef.current;
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    setVolumeState(clampedVolume);
    if (audio) {
      audio.volume = clampedVolume;
    }
    if (clampedVolume > 0) {
      setIsMuted(false);
      prevVolumeRef.current = clampedVolume;
    }
  }, []);

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (isMuted) {
      setIsMuted(false);
      const restoreVolume = prevVolumeRef.current || 1;
      setVolumeState(restoreVolume);
      if (audio) {
        audio.volume = restoreVolume;
      }
    } else {
      setIsMuted(true);
      prevVolumeRef.current = volume;
      setVolumeState(0);
      if (audio) {
        audio.volume = 0;
      }
    }
  }, [isMuted, volume]);

  const setPlaybackRate = useCallback((rate: number) => {
    const audio = audioRef.current;
    const clampedRate = Math.max(0.25, Math.min(4, rate));
    setPlaybackRateState(clampedRate);
    if (audio) {
      audio.playbackRate = clampedRate;
    }
  }, []);

  const reset = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setIsPlaying(false);
    setCurrentTime(0);
    setError(null);
  }, []);

  const state: PlaybackState = {
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    isLoading,
    error,
    playbackRate,
  };

  const actions: PlaybackActions = {
    play,
    pause,
    toggle,
    seek,
    setVolume,
    toggleMute,
    setPlaybackRate,
    reset,
  };

  return [state, actions, audioRef];
}

/**
 * Format seconds to MM:SS or HH:MM:SS string
 */
export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

export default usePlaybackState;
