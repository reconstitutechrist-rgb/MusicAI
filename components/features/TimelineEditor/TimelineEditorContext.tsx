import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import {
  TimelineState,
  TimelineActions,
  TimelineContextValue,
  TimelineClip,
  CrossfadeRegion,
  CrossfadeCurveType,
  ControlMode,
  LibrarySong,
  MergeSuggestion,
} from "../../../types/timeline";
import {
  generateMergeSuggestions,
  generateAutoMergePlan,
  generateTransitionAudio as generateTransitionAudioService,
} from "../../../services/timelineMergeService";
import { applyCrossfade } from "../../../utils/crossfadeAlgorithms";

// Initial state
const initialState: TimelineState = {
  clips: [],
  crossfades: [],
  currentTime: 0,
  isPlaying: false,
  duration: 0,
  zoom: 1, // 1 second = 100px
  scrollPosition: 0,
  viewportWidth: 800,
  controlMode: "ai-suggests",
  selectedClipId: null,
  selectedCrossfadeId: null,
  isDragging: false,
  draggedClipId: null,
  isAnalyzing: false,
  isGeneratingTransition: false,
  mergePlan: null,
  suggestions: [],
  isRendering: false,
  renderProgress: 0,
};

// Action types
type TimelineAction =
  | { type: "ADD_CLIP"; clip: TimelineClip }
  | { type: "REMOVE_CLIP"; clipId: string }
  | { type: "MOVE_CLIP"; clipId: string; startTime: number }
  | { type: "TRIM_CLIP"; clipId: string; trimStart: number; trimEnd: number }
  | { type: "SELECT_CLIP"; clipId: string | null }
  | { type: "SET_CLIP_VOLUME"; clipId: string; volume: number }
  | { type: "TOGGLE_CLIP_MUTE"; clipId: string }
  | { type: "UPDATE_CROSSFADES" }
  | { type: "SET_CROSSFADE_DURATION"; crossfadeId: string; duration: number }
  | {
      type: "SET_CROSSFADE_CURVE";
      crossfadeId: string;
      curve: CrossfadeCurveType;
    }
  | {
      type: "SET_CROSSFADE_TRANSITION";
      crossfadeId: string;
      audioBuffer: AudioBuffer;
      audioUrl: string;
    }
  | {
      type: "SET_CROSSFADE_GENERATING";
      crossfadeId: string;
      isGenerating: boolean;
    }
  | {
      type: "SET_CROSSFADE_AUDIO";
      crossfadeId: string;
      audioBuffer: AudioBuffer;
    }
  | { type: "SET_PLAYING"; isPlaying: boolean }
  | { type: "SET_CURRENT_TIME"; time: number }
  | { type: "SET_DURATION"; duration: number }
  | { type: "SET_ZOOM"; zoom: number }
  | { type: "SET_SCROLL"; position: number }
  | { type: "SET_VIEWPORT_WIDTH"; width: number }
  | { type: "SET_CONTROL_MODE"; mode: ControlMode }
  | { type: "SET_DRAGGING"; isDragging: boolean; clipId: string | null }
  | { type: "SET_ANALYZING"; isAnalyzing: boolean }
  | { type: "SET_SUGGESTIONS"; suggestions: MergeSuggestion[] }
  | { type: "REMOVE_SUGGESTION"; suggestionId: string }
  | { type: "SET_RENDERING"; isRendering: boolean; progress: number }
  | { type: "SET_CLIPS"; clips: TimelineClip[] }
  | { type: "SET_CROSSFADES"; crossfades: CrossfadeRegion[] };

// Helper to generate unique IDs
const generateId = () => Math.random().toString(36).substring(2, 11);

// Calculate crossfades based on clip positions
function calculateCrossfades(clips: TimelineClip[]): CrossfadeRegion[] {
  if (clips.length < 2) return [];

  const sortedClips = [...clips].sort((a, b) => a.startTime - b.startTime);
  const crossfades: CrossfadeRegion[] = [];

  for (let i = 0; i < sortedClips.length - 1; i++) {
    const clipA = sortedClips[i];
    const clipB = sortedClips[i + 1];

    const clipAEnd =
      clipA.startTime + clipA.duration - clipA.trimStart - clipA.trimEnd;
    const clipBStart = clipB.startTime;

    // If clips overlap, create a crossfade region
    if (clipAEnd > clipBStart) {
      const overlapDuration = clipAEnd - clipBStart;
      crossfades.push({
        id: `crossfade-${clipA.id}-${clipB.id}`,
        clipAId: clipA.id,
        clipBId: clipB.id,
        duration: Math.min(overlapDuration, 8), // Max 8 seconds
        curveType: "equalPower",
      });
    }
  }

  return crossfades;
}

// Calculate total duration
function calculateDuration(clips: TimelineClip[]): number {
  if (clips.length === 0) return 0;

  let maxEnd = 0;
  for (const clip of clips) {
    const effectiveDuration = clip.duration - clip.trimStart - clip.trimEnd;
    const clipEnd = clip.startTime + effectiveDuration;
    if (clipEnd > maxEnd) maxEnd = clipEnd;
  }

  return maxEnd;
}

// Reducer
function timelineReducer(
  state: TimelineState,
  action: TimelineAction,
): TimelineState {
  switch (action.type) {
    case "ADD_CLIP": {
      const newClips = [...state.clips, action.clip];
      return {
        ...state,
        clips: newClips,
        crossfades: calculateCrossfades(newClips),
        duration: calculateDuration(newClips),
      };
    }

    case "REMOVE_CLIP": {
      const newClips = state.clips.filter((c) => c.id !== action.clipId);
      return {
        ...state,
        clips: newClips,
        crossfades: calculateCrossfades(newClips),
        duration: calculateDuration(newClips),
        selectedClipId:
          state.selectedClipId === action.clipId ? null : state.selectedClipId,
      };
    }

    case "MOVE_CLIP": {
      const newClips = state.clips.map((c) =>
        c.id === action.clipId
          ? { ...c, startTime: Math.max(0, action.startTime) }
          : c,
      );
      return {
        ...state,
        clips: newClips,
        crossfades: calculateCrossfades(newClips),
        duration: calculateDuration(newClips),
      };
    }

    case "TRIM_CLIP": {
      const newClips = state.clips.map((c) =>
        c.id === action.clipId
          ? { ...c, trimStart: action.trimStart, trimEnd: action.trimEnd }
          : c,
      );
      return {
        ...state,
        clips: newClips,
        crossfades: calculateCrossfades(newClips),
        duration: calculateDuration(newClips),
      };
    }

    case "SELECT_CLIP":
      return {
        ...state,
        selectedClipId: action.clipId,
        selectedCrossfadeId: null,
      };

    case "SET_CLIP_VOLUME":
      return {
        ...state,
        clips: state.clips.map((c) =>
          c.id === action.clipId ? { ...c, volume: action.volume } : c,
        ),
      };

    case "TOGGLE_CLIP_MUTE":
      return {
        ...state,
        clips: state.clips.map((c) =>
          c.id === action.clipId ? { ...c, isMuted: !c.isMuted } : c,
        ),
      };

    case "UPDATE_CROSSFADES":
      return {
        ...state,
        crossfades: calculateCrossfades(state.clips),
      };

    case "SET_CROSSFADE_DURATION":
      return {
        ...state,
        crossfades: state.crossfades.map((cf) =>
          cf.id === action.crossfadeId
            ? { ...cf, duration: action.duration }
            : cf,
        ),
      };

    case "SET_CROSSFADE_CURVE":
      return {
        ...state,
        crossfades: state.crossfades.map((cf) =>
          cf.id === action.crossfadeId
            ? { ...cf, curveType: action.curve }
            : cf,
        ),
      };

    case "SET_CROSSFADE_TRANSITION":
      return {
        ...state,
        crossfades: state.crossfades.map((cf) =>
          cf.id === action.crossfadeId
            ? {
                ...cf,
                transitionAudioBuffer: action.audioBuffer,
                transitionAudioUrl: action.audioUrl,
                isGenerating: false,
              }
            : cf,
        ),
      };

    case "SET_CROSSFADE_GENERATING":
      return {
        ...state,
        crossfades: state.crossfades.map((cf) =>
          cf.id === action.crossfadeId
            ? { ...cf, isGenerating: action.isGenerating }
            : cf,
        ),
        isGeneratingTransition: action.isGenerating,
      };

    case "SET_CROSSFADE_AUDIO":
      return {
        ...state,
        crossfades: state.crossfades.map((cf) =>
          cf.id === action.crossfadeId
            ? { ...cf, transitionAudioBuffer: action.audioBuffer }
            : cf,
        ),
      };

    case "SET_PLAYING":
      return { ...state, isPlaying: action.isPlaying };

    case "SET_CURRENT_TIME":
      return { ...state, currentTime: action.time };

    case "SET_DURATION":
      return { ...state, duration: action.duration };

    case "SET_ZOOM":
      return { ...state, zoom: Math.max(0.1, Math.min(16, action.zoom)) };

    case "SET_SCROLL":
      return { ...state, scrollPosition: Math.max(0, action.position) };

    case "SET_VIEWPORT_WIDTH":
      return { ...state, viewportWidth: action.width };

    case "SET_CONTROL_MODE":
      return { ...state, controlMode: action.mode };

    case "SET_DRAGGING":
      return {
        ...state,
        isDragging: action.isDragging,
        draggedClipId: action.clipId,
      };

    case "SET_ANALYZING":
      return { ...state, isAnalyzing: action.isAnalyzing };

    case "SET_SUGGESTIONS":
      return { ...state, suggestions: action.suggestions };

    case "REMOVE_SUGGESTION":
      return {
        ...state,
        suggestions: state.suggestions.filter(
          (s) => s.id !== action.suggestionId,
        ),
      };

    case "SET_RENDERING":
      return {
        ...state,
        isRendering: action.isRendering,
        renderProgress: action.progress,
      };

    case "SET_CLIPS":
      return {
        ...state,
        clips: action.clips,
        crossfades: calculateCrossfades(action.clips),
        duration: calculateDuration(action.clips),
      };

    case "SET_CROSSFADES":
      return { ...state, crossfades: action.crossfades };

    default:
      return state;
  }
}

// Create context
const TimelineContext = createContext<TimelineContextValue | null>(null);

// Provider props
interface TimelineEditorProviderProps {
  children: ReactNode;
  audioContext: AudioContext | null;
}

// Compute waveform data from AudioBuffer
function computeWaveformData(
  buffer: AudioBuffer,
  samplesPerPixel: number = 256,
): Float32Array {
  const channelData = buffer.getChannelData(0);
  const numSamples = Math.ceil(channelData.length / samplesPerPixel);
  const waveform = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const start = i * samplesPerPixel;
    const end = Math.min(start + samplesPerPixel, channelData.length);

    let max = 0;
    for (let j = start; j < end; j++) {
      const abs = Math.abs(channelData[j]);
      if (abs > max) max = abs;
    }
    waveform[i] = max;
  }

  return waveform;
}

// Provider component
export function TimelineEditorProvider({
  children,
  audioContext,
}: TimelineEditorProviderProps) {
  const [state, dispatch] = useReducer(timelineReducer, initialState);
  const playbackRef = useRef<{
    startTime: number;
    scheduledNodes: Map<
      string,
      { source: AudioBufferSourceNode; gain: GainNode }
    >;
  }>({ startTime: 0, scheduledNodes: new Map() });

  // Clip operations
  const addClip = useCallback(
    async (song: LibrarySong) => {
      if (!audioContext) return;

      try {
        // Fetch and decode audio
        const response = await fetch(song.audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        // Compute waveform
        const waveformData = computeWaveformData(audioBuffer);

        // Calculate start position (after last clip with overlap for crossfade)
        let startTime = 0;
        if (state.clips.length > 0) {
          const lastClipEnd = state.clips.reduce((latest, clip) => {
            const clipEnd =
              clip.startTime + clip.duration - clip.trimStart - clip.trimEnd;
            return clipEnd > latest ? clipEnd : latest;
          }, 0);
          // Default overlap of 4 seconds for crossfade (but not for first clip)
          startTime = Math.max(0, lastClipEnd - 4);
        }

        const newClip: TimelineClip = {
          id: generateId(),
          songId: song.id,
          songTitle: song.title,
          audioBuffer,
          waveformData,
          audioUrl: song.audioUrl,
          startTime,
          duration: audioBuffer.duration,
          trimStart: 0,
          trimEnd: 0,
          analysis: song.analysis
            ? {
                bpm: parseFloat(song.analysis.bpm) || 120,
                key: song.analysis.key || "C",
                genre: song.analysis.genre || "Unknown",
                mood: song.analysis.mood || "Unknown",
              }
            : null,
          isSelected: false,
          isMuted: false,
          volume: 1,
        };

        dispatch({ type: "ADD_CLIP", clip: newClip });
      } catch (error) {
        console.error("Failed to add clip:", error);
      }
    },
    [audioContext, state.clips],
  );

  const removeClip = useCallback((clipId: string) => {
    dispatch({ type: "REMOVE_CLIP", clipId });
  }, []);

  const moveClip = useCallback((clipId: string, newStartTime: number) => {
    dispatch({ type: "MOVE_CLIP", clipId, startTime: newStartTime });
  }, []);

  const trimClip = useCallback(
    (clipId: string, trimStart: number, trimEnd: number) => {
      dispatch({ type: "TRIM_CLIP", clipId, trimStart, trimEnd });
    },
    [],
  );

  const selectClip = useCallback((clipId: string | null) => {
    dispatch({ type: "SELECT_CLIP", clipId });
  }, []);

  const setClipVolume = useCallback((clipId: string, volume: number) => {
    dispatch({ type: "SET_CLIP_VOLUME", clipId, volume });
  }, []);

  const toggleClipMute = useCallback((clipId: string) => {
    dispatch({ type: "TOGGLE_CLIP_MUTE", clipId });
  }, []);

  // Crossfade operations
  const setCrossfadeDuration = useCallback(
    (crossfadeId: string, duration: number) => {
      dispatch({ type: "SET_CROSSFADE_DURATION", crossfadeId, duration });
    },
    [],
  );

  const setCrossfadeCurve = useCallback(
    (crossfadeId: string, curve: CrossfadeCurveType) => {
      dispatch({ type: "SET_CROSSFADE_CURVE", crossfadeId, curve });
    },
    [],
  );

  const generateTransitionAudio = useCallback(async (crossfadeId: string) => {
    const crossfade = state.crossfades.find(cf => cf.id === crossfadeId);
    if (!crossfade) {
      console.warn("Crossfade not found:", crossfadeId);
      return;
    }

    dispatch({
      type: "SET_CROSSFADE_GENERATING",
      crossfadeId,
      isGenerating: true,
    });

    try {
      const transitionBuffer = await generateTransitionAudioService(
        crossfade,
        state.clips,
        (progress) => {
          console.log(`Generating transition: ${progress}%`);
        }
      );

      if (transitionBuffer) {
        dispatch({
          type: "SET_CROSSFADE_AUDIO",
          crossfadeId,
          audioBuffer: transitionBuffer,
        });
      }
    } catch (error) {
      console.error("Error generating transition audio:", error);
    } finally {
      dispatch({
        type: "SET_CROSSFADE_GENERATING",
        crossfadeId,
        isGenerating: false,
      });
    }
  }, [state.crossfades, state.clips]);

  // Playback controls
  // playFromTime allows seeking to work correctly by passing the target time directly
  const playFromTime = useCallback(
    (fromTime?: number) => {
      if (!audioContext || state.clips.length === 0) return;

      const currentPlayTime = fromTime ?? state.currentTime;

      // Stop any existing playback
      playbackRef.current.scheduledNodes.forEach(({ source }) => {
        try {
          source.stop();
        } catch {
          // Ignore if already stopped
        }
      });
      playbackRef.current.scheduledNodes.clear();

      const now = audioContext.currentTime;
      playbackRef.current.startTime = now - currentPlayTime;

      // Schedule all clips
      for (const clip of state.clips) {
        if (clip.isMuted || !clip.audioBuffer) continue;

        const effectiveStart = clip.startTime;
        const effectiveDuration = clip.duration - clip.trimStart - clip.trimEnd;
        const effectiveEnd = effectiveStart + effectiveDuration;

        // Skip if clip ends before current time
        if (effectiveEnd <= currentPlayTime) continue;

        const source = audioContext.createBufferSource();
        const gain = audioContext.createGain();

        source.buffer = clip.audioBuffer;
        source.connect(gain);
        gain.connect(audioContext.destination);
        gain.gain.value = clip.volume;

        // Calculate when to start and at what offset
        let when = 0;
        let offset = clip.trimStart;

        if (effectiveStart > currentPlayTime) {
          // Clip starts after current time
          when = effectiveStart - currentPlayTime;
        } else {
          // Clip already started, need offset
          offset += currentPlayTime - effectiveStart;
        }

        const duration = effectiveDuration - (offset - clip.trimStart);

        source.start(now + when, offset, duration);
        playbackRef.current.scheduledNodes.set(clip.id, { source, gain });
      }

      // Apply crossfade automation to overlapping clips
      for (const crossfade of state.crossfades) {
        const clipANode = playbackRef.current.scheduledNodes.get(
          crossfade.clipAId,
        );
        const clipBNode = playbackRef.current.scheduledNodes.get(
          crossfade.clipBId,
        );

        if (clipANode && clipBNode) {
          const clipA = state.clips.find((c) => c.id === crossfade.clipAId);
          const clipB = state.clips.find((c) => c.id === crossfade.clipBId);

          if (clipA && clipB) {
            const crossfadeStart = clipB.startTime;
            const crossfadeStartInPlayback =
              now + (crossfadeStart - currentPlayTime);

            // Only apply if crossfade is in the future
            if (crossfadeStartInPlayback > now) {
              applyCrossfade(
                clipANode.gain,
                clipBNode.gain,
                crossfadeStartInPlayback,
                crossfade.duration,
                crossfade.curveType,
                audioContext,
              );
            }
          }
        }
      }

      dispatch({ type: "SET_PLAYING", isPlaying: true });
    },
    [audioContext, state.clips, state.crossfades, state.currentTime],
  );

  // Wrapper for play() that uses current state time
  const play = useCallback(() => {
    playFromTime();
  }, [playFromTime]);

  const pause = useCallback(() => {
    if (!audioContext) return;

    playbackRef.current.scheduledNodes.forEach(({ source }) => {
      try {
        source.stop();
      } catch {
        // Ignore if already stopped
      }
    });
    playbackRef.current.scheduledNodes.clear();

    dispatch({ type: "SET_PLAYING", isPlaying: false });
  }, [audioContext]);

  const stop = useCallback(() => {
    pause();
    dispatch({ type: "SET_CURRENT_TIME", time: 0 });
  }, [pause]);

  const seek = useCallback(
    (time: number) => {
      const wasPlaying = state.isPlaying;
      const clampedTime = Math.max(0, Math.min(time, state.duration));

      if (wasPlaying) pause();

      dispatch({
        type: "SET_CURRENT_TIME",
        time: clampedTime,
      });

      // Use playFromTime with the new time directly to avoid stale state issue
      if (wasPlaying) playFromTime(clampedTime);
    },
    [state.isPlaying, state.duration, pause, playFromTime],
  );

  // Update current time without restarting playback (for animation display)
  const setCurrentTime = useCallback(
    (time: number) => {
      const clampedTime = Math.max(0, Math.min(time, state.duration));
      dispatch({ type: "SET_CURRENT_TIME", time: clampedTime });
    },
    [state.duration],
  );

  // AI operations
  const analyzeAndSuggest = useCallback(async () => {
    if (state.clips.length < 2) return;

    dispatch({ type: "SET_ANALYZING", isAnalyzing: true });
    try {
      const suggestions = await generateMergeSuggestions(
        state.clips,
        state.crossfades,
      );
      dispatch({ type: "SET_SUGGESTIONS", suggestions });
    } catch (error) {
      console.error("Failed to generate suggestions:", error);
    } finally {
      dispatch({ type: "SET_ANALYZING", isAnalyzing: false });
    }
  }, [state.clips, state.crossfades]);

  const autoMerge = useCallback(
    async (description: string) => {
      if (state.clips.length < 2) return;

      dispatch({ type: "SET_ANALYZING", isAnalyzing: true });
      try {
        // Get current songs from clips
        const songs: LibrarySong[] = state.clips.map((clip) => ({
          id: clip.songId,
          title: clip.songTitle,
          style: clip.analysis?.genre || "Unknown",
          audioUrl: clip.audioUrl,
          duration: clip.duration,
          analysis: clip.analysis
            ? {
                bpm: clip.analysis.bpm.toString(),
                key: clip.analysis.key,
                genre: clip.analysis.genre,
                chords: [],
                productionFeedback: "",
                mood: clip.analysis.mood,
              }
            : undefined,
        }));

        const plan = await generateAutoMergePlan(songs, description);

        // Reorder clips based on AI recommendation
        const reorderedClips: TimelineClip[] = [];
        let currentTime = 0;

        for (let i = 0; i < plan.orderedSongIds.length; i++) {
          const songId = plan.orderedSongIds[i];
          const clip = state.clips.find((c) => c.songId === songId);
          if (clip) {
            const crossfadeDuration =
              i > 0 ? plan.crossfadeDurations[i - 1] || 4 : 0;
            const newClip = {
              ...clip,
              startTime: Math.max(0, currentTime - crossfadeDuration),
            };
            reorderedClips.push(newClip);
            currentTime =
              newClip.startTime +
              newClip.duration -
              newClip.trimStart -
              newClip.trimEnd;
          }
        }

        dispatch({ type: "SET_CLIPS", clips: reorderedClips });
      } catch (error) {
        console.error("Failed to auto-merge:", error);
      } finally {
        dispatch({ type: "SET_ANALYZING", isAnalyzing: false });
      }
    },
    [state.clips],
  );

  const applySuggestion = useCallback(
    (suggestionId: string) => {
      const suggestion = state.suggestions.find((s) => s.id === suggestionId);
      if (!suggestion) {
        dispatch({ type: "REMOVE_SUGGESTION", suggestionId });
        return;
      }

      switch (suggestion.type) {
        case "reorder": {
          // Reorder clips based on suggestion clipIds order
          if (suggestion.clipIds.length >= 2) {
            const reorderedClips: TimelineClip[] = [];
            let currentTime = 0;

            for (let i = 0; i < suggestion.clipIds.length; i++) {
              const clipId = suggestion.clipIds[i];
              const clip = state.clips.find((c) => c.id === clipId);
              if (clip) {
                const overlapDuration = i > 0 ? 4 : 0; // 4 second overlap for crossfades
                const newClip = {
                  ...clip,
                  startTime: Math.max(0, currentTime - overlapDuration),
                };
                reorderedClips.push(newClip);
                currentTime =
                  newClip.startTime +
                  newClip.duration -
                  newClip.trimStart -
                  newClip.trimEnd;
              }
            }

            // Add any clips not in the suggestion
            for (const clip of state.clips) {
              if (!suggestion.clipIds.includes(clip.id)) {
                const effectiveDuration =
                  clip.duration - clip.trimStart - clip.trimEnd;
                reorderedClips.push({
                  ...clip,
                  startTime: Math.max(0, currentTime - 4), // Overlap with previous clip
                });
                currentTime = Math.max(0, currentTime - 4) + effectiveDuration;
              }
            }

            dispatch({ type: "SET_CLIPS", clips: reorderedClips });
          }
          break;
        }

        case "crossfade": {
          // Update crossfade duration
          const duration =
            typeof suggestion.suggestedValue === "number"
              ? suggestion.suggestedValue
              : parseFloat(suggestion.suggestedValue || "4") || 4;

          // Find crossfade between the specified clips
          if (suggestion.clipIds.length >= 2) {
            const crossfade = state.crossfades.find(
              (cf) =>
                cf.clipAId === suggestion.clipIds[0] &&
                cf.clipBId === suggestion.clipIds[1],
            );
            if (crossfade) {
              dispatch({
                type: "SET_CROSSFADE_DURATION",
                crossfadeId: crossfade.id,
                duration,
              });
            }
          }
          break;
        }

        case "trim": {
          // Apply trim suggestion
          const trimValue =
            typeof suggestion.suggestedValue === "number"
              ? suggestion.suggestedValue
              : parseFloat(suggestion.suggestedValue || "0") || 0;

          for (const clipId of suggestion.clipIds) {
            // Determine if this is a trim start or trim end based on description
            const isTrimStart =
              suggestion.description.toLowerCase().includes("start") ||
              suggestion.description.toLowerCase().includes("intro");
            if (isTrimStart) {
              dispatch({
                type: "TRIM_CLIP",
                clipId,
                trimStart: trimValue,
                trimEnd: state.clips.find((c) => c.id === clipId)?.trimEnd || 0,
              });
            } else {
              dispatch({
                type: "TRIM_CLIP",
                clipId,
                trimStart:
                  state.clips.find((c) => c.id === clipId)?.trimStart || 0,
                trimEnd: trimValue,
              });
            }
          }
          break;
        }

        case "key-match":
        case "bpm-match": {
          // These require audio processing which is not yet implemented
          // For now, just acknowledge and remove the suggestion
          console.log(
            `${suggestion.type} suggestion acknowledged:`,
            suggestion.description,
          );
          break;
        }
      }

      dispatch({ type: "REMOVE_SUGGESTION", suggestionId });
    },
    [state.suggestions, state.clips, state.crossfades],
  );

  const dismissSuggestion = useCallback((suggestionId: string) => {
    dispatch({ type: "REMOVE_SUGGESTION", suggestionId });
  }, []);

  // View controls
  const setZoom = useCallback((zoom: number) => {
    dispatch({ type: "SET_ZOOM", zoom });
  }, []);

  const setScroll = useCallback((position: number) => {
    dispatch({ type: "SET_SCROLL", position });
  }, []);

  const setControlMode = useCallback((mode: ControlMode) => {
    dispatch({ type: "SET_CONTROL_MODE", mode });
  }, []);

  // Export - render merged audio offline
  const renderMergedAudio = useCallback(async (): Promise<Blob> => {
    if (state.clips.length === 0) return new Blob();

    dispatch({ type: "SET_RENDERING", isRendering: true, progress: 0 });

    try {
      const sampleRate = 44100;
      const totalDuration = state.duration + 1; // Add 1 second buffer
      const numChannels = 2;

      const offlineContext = new OfflineAudioContext(
        numChannels,
        Math.ceil(totalDuration * sampleRate),
        sampleRate,
      );

      // Create nodes for each clip
      const clipNodes: Map<
        string,
        { source: AudioBufferSourceNode; gain: GainNode }
      > = new Map();

      for (const clip of state.clips) {
        if (clip.isMuted || !clip.audioBuffer) continue;

        const source = offlineContext.createBufferSource();
        const gain = offlineContext.createGain();

        source.buffer = clip.audioBuffer;
        source.connect(gain);
        gain.connect(offlineContext.destination);
        gain.gain.value = clip.volume;

        const effectiveStart = clip.startTime;
        const offset = clip.trimStart;
        const duration = clip.duration - clip.trimStart - clip.trimEnd;

        source.start(effectiveStart, offset, duration);
        clipNodes.set(clip.id, { source, gain });
      }

      dispatch({ type: "SET_RENDERING", isRendering: true, progress: 30 });

      // Apply crossfades
      for (const crossfade of state.crossfades) {
        const clipANode = clipNodes.get(crossfade.clipAId);
        const clipBNode = clipNodes.get(crossfade.clipBId);

        if (clipANode && clipBNode) {
          const clipB = state.clips.find((c) => c.id === crossfade.clipBId);
          if (clipB) {
            const crossfadeStart = clipB.startTime;
            applyCrossfade(
              clipANode.gain,
              clipBNode.gain,
              crossfadeStart,
              crossfade.duration,
              crossfade.curveType,
              offlineContext as unknown as AudioContext,
            );
          }
        }
      }

      dispatch({ type: "SET_RENDERING", isRendering: true, progress: 50 });

      // Render
      const renderedBuffer = await offlineContext.startRendering();

      dispatch({ type: "SET_RENDERING", isRendering: true, progress: 80 });

      // Convert to WAV
      const wavBlob = audioBufferToWav(renderedBuffer);

      dispatch({ type: "SET_RENDERING", isRendering: false, progress: 100 });
      return wavBlob;
    } catch (error) {
      console.error("Failed to render audio:", error);
      dispatch({ type: "SET_RENDERING", isRendering: false, progress: 0 });
      return new Blob();
    }
  }, [state.clips, state.crossfades, state.duration]);

  // Helper to convert AudioBuffer to WAV Blob
  function audioBufferToWav(buffer: AudioBuffer): Blob {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const length = buffer.length * numChannels * 2 + 44;
    const arrayBuffer = new ArrayBuffer(length);
    const view = new DataView(arrayBuffer);

    // WAV header
    let offset = 0;
    const writeString = (str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset++, str.charCodeAt(i));
      }
    };
    const writeUint32 = (value: number) => {
      view.setUint32(offset, value, true);
      offset += 4;
    };
    const writeUint16 = (value: number) => {
      view.setUint16(offset, value, true);
      offset += 2;
    };

    writeString("RIFF");
    writeUint32(length - 8);
    writeString("WAVE");
    writeString("fmt ");
    writeUint32(16); // PCM
    writeUint16(1); // Audio format
    writeUint16(numChannels);
    writeUint32(sampleRate);
    writeUint32(sampleRate * numChannels * 2); // Byte rate
    writeUint16(numChannels * 2); // Block align
    writeUint16(16); // Bits per sample
    writeString("data");
    writeUint32(buffer.length * numChannels * 2);

    // Write audio data
    const channels: Float32Array[] = [];
    for (let i = 0; i < numChannels; i++) {
      channels.push(buffer.getChannelData(i));
    }

    for (let i = 0; i < buffer.length; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        const sample = Math.max(-1, Math.min(1, channels[ch][i]));
        const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        view.setInt16(offset, intSample, true);
        offset += 2;
      }
    }

    return new Blob([arrayBuffer], { type: "audio/wav" });
  }

  const actions: TimelineActions = {
    addClip,
    removeClip,
    moveClip,
    trimClip,
    selectClip,
    setClipVolume,
    toggleClipMute,
    setCrossfadeDuration,
    setCrossfadeCurve,
    generateTransitionAudio,
    play,
    pause,
    stop,
    seek,
    setCurrentTime,
    analyzeAndSuggest,
    autoMerge,
    applySuggestion,
    dismissSuggestion,
    setZoom,
    setScroll,
    setControlMode,
    renderMergedAudio,
  };

  return (
    <TimelineContext.Provider value={{ state, actions }}>
      {children}
    </TimelineContext.Provider>
  );
}

// Hook to use timeline context
export function useTimeline(): TimelineContextValue {
  const context = useContext(TimelineContext);
  if (!context) {
    throw new Error("useTimeline must be used within a TimelineEditorProvider");
  }
  return context;
}

export { TimelineContext };
