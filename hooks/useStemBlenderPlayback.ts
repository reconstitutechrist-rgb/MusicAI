/**
 * Stem Blender Playback Hook
 * Handles multi-stem playback using Web Audio API
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { BlenderTrack, TrackPlaybackNodes } from "../types/stemBlender";

interface UseStemBlenderPlaybackOptions {
  tracks: BlenderTrack[];
  masterVolume: number;
  isPlaying: boolean;
  currentTime: number;
  onTimeUpdate?: (time: number) => void;
  onEnded?: () => void;
}

interface UseStemBlenderPlaybackReturn {
  audioContext: AudioContext | null;
  isReady: boolean;
  audioLevels: Map<string, number>;
  play: () => Promise<void>;
  pause: () => void;
  stop: () => void;
  seek: (time: number) => void;
  loadTrack: (track: BlenderTrack) => Promise<void>;
}

export function useStemBlenderPlayback({
  tracks,
  masterVolume,
  isPlaying,
  currentTime,
  onTimeUpdate,
  onEnded,
}: UseStemBlenderPlaybackOptions): UseStemBlenderPlaybackReturn {
  const audioContextRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const trackNodesRef = useRef<Map<string, TrackPlaybackNodes>>(new Map());
  const audioBuffersRef = useRef<Map<string, AudioBuffer>>(new Map());
  const startTimeRef = useRef<number>(0);
  const pauseTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [audioLevels, setAudioLevels] = useState<Map<string, number>>(
    new Map()
  );

  // Initialize audio context
  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
      masterGainRef.current = audioContextRef.current.createGain();
      masterGainRef.current.connect(audioContextRef.current.destination);
      masterGainRef.current.gain.value = masterVolume;
    }
    return audioContextRef.current;
  }, [masterVolume]);

  // Load audio buffer for a track
  const loadTrack = useCallback(async (track: BlenderTrack) => {
    const ctx = initAudioContext();

    // Check if already loaded
    if (audioBuffersRef.current.has(track.id)) {
      return;
    }

    try {
      const response = await fetch(track.stem.audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      audioBuffersRef.current.set(track.id, audioBuffer);
    } catch (error) {
      console.error(`Failed to load track ${track.id}:`, error);
    }
  }, [initAudioContext]);

  // Create playback nodes for a track
  const createTrackNodes = useCallback(
    (track: BlenderTrack, buffer: AudioBuffer): TrackPlaybackNodes => {
      const ctx = audioContextRef.current!;

      // Create nodes
      const source = ctx.createBufferSource();
      source.buffer = buffer;

      const gain = ctx.createGain();
      const pan = ctx.createStereoPanner();

      // Apply track settings
      gain.gain.value = track.volume;
      pan.pan.value = track.pan;

      // Connect: source -> gain -> pan -> master
      source.connect(gain);
      gain.connect(pan);
      pan.connect(masterGainRef.current!);

      return { source, gain, pan };
    },
    []
  );

  // Update track volume in real-time
  const updateTrackVolume = useCallback(
    (trackId: string, volume: number) => {
      const nodes = trackNodesRef.current.get(trackId);
      if (nodes?.gain) {
        nodes.gain.gain.setValueAtTime(
          volume,
          audioContextRef.current?.currentTime || 0
        );
      }
    },
    []
  );

  // Update track pan in real-time
  const updateTrackPan = useCallback((trackId: string, pan: number) => {
    const nodes = trackNodesRef.current.get(trackId);
    if (nodes?.pan) {
      nodes.pan.pan.setValueAtTime(
        pan,
        audioContextRef.current?.currentTime || 0
      );
    }
  }, []);

  // Play all tracks
  const play = useCallback(async () => {
    const ctx = initAudioContext();

    // Resume context if suspended
    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    // Check for solo
    const hasSolo = tracks.some((t) => t.solo);

    // Stop any existing sources
    trackNodesRef.current.forEach((nodes) => {
      if (nodes.source) {
        try {
          nodes.source.stop();
        } catch (e) {
          // Expected if source was already stopped or never started
        }
      }
    });
    trackNodesRef.current.clear();

    // Calculate start time
    const startOffset = pauseTimeRef.current || currentTime;
    startTimeRef.current = ctx.currentTime - startOffset;

    // Create and start sources for each track
    for (const track of tracks) {
      // Skip muted tracks
      if (track.muted) continue;

      // Skip non-solo tracks when solo is active
      if (hasSolo && !track.solo) continue;

      // Get or load buffer
      let buffer = audioBuffersRef.current.get(track.id);
      if (!buffer) {
        await loadTrack(track);
        buffer = audioBuffersRef.current.get(track.id);
      }

      if (!buffer) continue;

      // Create nodes
      const nodes = createTrackNodes(track, buffer);
      trackNodesRef.current.set(track.id, nodes);

      // Calculate when to start (considering offset)
      const trackStartTime = ctx.currentTime + track.offset - startOffset;
      const audioOffset = Math.max(0, startOffset - track.offset);

      if (trackStartTime >= ctx.currentTime) {
        // Track starts in the future
        nodes.source?.start(trackStartTime, 0);
      } else if (audioOffset < buffer.duration) {
        // Track already started, play from offset
        nodes.source?.start(0, audioOffset);
      }
    }

    // Start time update loop
    const updateTime = () => {
      if (audioContextRef.current) {
        const elapsed = audioContextRef.current.currentTime - startTimeRef.current;
        onTimeUpdate?.(elapsed);

        // Check if playback ended
        const maxDuration = Math.max(
          ...tracks.map((t) => t.stem.duration + t.offset),
          0
        );
        if (elapsed >= maxDuration) {
          onEnded?.();
          return;
        }
      }
      animationFrameRef.current = requestAnimationFrame(updateTime);
    };

    animationFrameRef.current = requestAnimationFrame(updateTime);
    setIsReady(true);
  }, [
    initAudioContext,
    tracks,
    currentTime,
    loadTrack,
    createTrackNodes,
    onTimeUpdate,
    onEnded,
  ]);

  // Pause playback
  const pause = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (audioContextRef.current) {
      pauseTimeRef.current =
        audioContextRef.current.currentTime - startTimeRef.current;
    }

    // Stop all sources
    trackNodesRef.current.forEach((nodes) => {
      if (nodes.source) {
        try {
          nodes.source.stop();
        } catch (e) {
          // Expected if source was already stopped or never started
        }
      }
    });
    trackNodesRef.current.clear();
  }, []);

  // Stop playback
  const stop = useCallback(() => {
    pause();
    pauseTimeRef.current = 0;
    onTimeUpdate?.(0);
  }, [pause, onTimeUpdate]);

  // Seek to time
  const seek = useCallback(
    (time: number) => {
      pauseTimeRef.current = time;
      if (isPlaying) {
        // Restart playback from new position
        play();
      } else {
        onTimeUpdate?.(time);
      }
    },
    [isPlaying, play, onTimeUpdate]
  );

  // Update master volume
  useEffect(() => {
    if (masterGainRef.current && audioContextRef.current) {
      masterGainRef.current.gain.setValueAtTime(
        masterVolume,
        audioContextRef.current.currentTime
      );
    }
  }, [masterVolume]);

  // Update individual track volumes and pans
  useEffect(() => {
    const hasSolo = tracks.some((t) => t.solo);

    tracks.forEach((track) => {
      const nodes = trackNodesRef.current.get(track.id);
      if (!nodes) return;

      // Calculate effective volume (considering mute and solo)
      let effectiveVolume = track.volume;
      if (track.muted) {
        effectiveVolume = 0;
      } else if (hasSolo && !track.solo) {
        effectiveVolume = 0;
      }

      updateTrackVolume(track.id, effectiveVolume);
      updateTrackPan(track.id, track.pan);
    });
  }, [tracks, updateTrackVolume, updateTrackPan]);

  // Handle play/pause state changes
  useEffect(() => {
    if (isPlaying) {
      play();
    } else {
      pause();
    }
  }, [isPlaying, play, pause]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      trackNodesRef.current.forEach((nodes) => {
        if (nodes.source) {
          try {
            nodes.source.stop();
          } catch (e) {
            // Expected if source was already stopped or never started
          }
        }
      });
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  return {
    audioContext: audioContextRef.current,
    isReady,
    audioLevels,
    play,
    pause,
    stop,
    seek,
    loadTrack,
  };
}

export default useStemBlenderPlayback;
