/**
 * Stem Blender Provider
 * Context and state management for the multi-source stem blender
 */

import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useRef,
  useEffect,
} from "react";
import {
  BlenderState,
  BlenderAction,
  BlenderTrack,
  SeparatedSong,
  StemTrack,
  initialBlenderState,
  createBlenderTrack,
  analyzeBpmCompatibility,
  analyzeKeyCompatibility,
  type KeyCompatibilityResult,
  type BpmAnalysisResult,
} from "../../../types/stemBlender";

/**
 * Context value type
 */
interface StemBlenderContextValue {
  state: BlenderState;
  dispatch: React.Dispatch<BlenderAction>;

  // Helper actions
  addSeparatedSong: (song: SeparatedSong) => void;
  removeSeparatedSong: (songId: string) => void;
  addStemToMixer: (stem: StemTrack, bpm?: number, key?: string) => void;
  removeTrackFromMixer: (trackId: string) => void;
  updateTrackVolume: (trackId: string, volume: number) => void;
  updateTrackPan: (trackId: string, pan: number) => void;
  toggleMute: (trackId: string) => void;
  toggleSolo: (trackId: string) => void;
  setTrackOffset: (trackId: string, offset: number) => void;
  setMasterVolume: (volume: number) => void;
  clearAllTracks: () => void;

  // Playback (to be wired to hook)
  audioContext: AudioContext | null;
}

const StemBlenderContext = createContext<StemBlenderContextValue | null>(null);

/**
 * Reducer for blender state
 */
function blenderReducer(
  state: BlenderState,
  action: BlenderAction
): BlenderState {
  switch (action.type) {
    case "ADD_SEPARATED_SONG":
      // Don't add duplicates
      if (state.separatedSongs.find((s) => s.id === action.payload.id)) {
        return state;
      }
      return {
        ...state,
        separatedSongs: [...state.separatedSongs, action.payload],
      };

    case "REMOVE_SEPARATED_SONG":
      return {
        ...state,
        separatedSongs: state.separatedSongs.filter(
          (s) => s.id !== action.payload
        ),
        // Also remove any tracks from this song
        tracks: state.tracks.filter(
          (t) => t.stem.songId !== action.payload
        ),
      };

    case "ADD_TRACK":
      // Don't add duplicate stems from the same song
      if (
        state.tracks.find(
          (t) =>
            t.stem.songId === action.payload.stem.songId &&
            t.stem.type === action.payload.stem.type
        )
      ) {
        return state;
      }
      const newTracks = [...state.tracks, action.payload];
      const newDuration = Math.max(
        ...newTracks.map((t) => t.stem.duration + t.offset),
        0
      );
      return {
        ...state,
        tracks: newTracks,
        duration: newDuration,
        bpmAnalysis: analyzeBpmCompatibility(newTracks),
        keyCompatibility: analyzeKeyCompatibility(newTracks),
      };

    case "REMOVE_TRACK":
      const filteredTracks = state.tracks.filter((t) => t.id !== action.payload);
      return {
        ...state,
        tracks: filteredTracks,
        duration: Math.max(
          ...filteredTracks.map((t) => t.stem.duration + t.offset),
          0
        ),
        bpmAnalysis: analyzeBpmCompatibility(filteredTracks),
        keyCompatibility: analyzeKeyCompatibility(filteredTracks),
      };

    case "UPDATE_TRACK_VOLUME":
      return {
        ...state,
        tracks: state.tracks.map((t) =>
          t.id === action.payload.trackId
            ? { ...t, volume: action.payload.volume }
            : t
        ),
      };

    case "UPDATE_TRACK_PAN":
      return {
        ...state,
        tracks: state.tracks.map((t) =>
          t.id === action.payload.trackId
            ? { ...t, pan: action.payload.pan }
            : t
        ),
      };

    case "TOGGLE_TRACK_MUTE":
      return {
        ...state,
        tracks: state.tracks.map((t) =>
          t.id === action.payload ? { ...t, muted: !t.muted } : t
        ),
      };

    case "TOGGLE_TRACK_SOLO":
      return {
        ...state,
        tracks: state.tracks.map((t) =>
          t.id === action.payload ? { ...t, solo: !t.solo } : t
        ),
      };

    case "UPDATE_TRACK_OFFSET":
      const updatedTracks = state.tracks.map((t) =>
        t.id === action.payload.trackId
          ? { ...t, offset: action.payload.offset }
          : t
      );
      return {
        ...state,
        tracks: updatedTracks,
        duration: Math.max(
          ...updatedTracks.map((t) => t.stem.duration + t.offset),
          0
        ),
      };

    case "SET_TARGET_BPM":
      return {
        ...state,
        targetBpm: action.payload,
      };

    case "SET_MASTER_VOLUME":
      return {
        ...state,
        masterVolume: action.payload,
      };

    case "SET_PLAYING":
      return {
        ...state,
        isPlaying: action.payload,
      };

    case "SET_CURRENT_TIME":
      return {
        ...state,
        currentTime: action.payload,
      };

    case "SET_DURATION":
      return {
        ...state,
        duration: action.payload,
      };

    case "SET_KEY_COMPATIBILITY":
      return {
        ...state,
        keyCompatibility: action.payload,
      };

    case "SET_BPM_ANALYSIS":
      return {
        ...state,
        bpmAnalysis: action.payload,
      };

    case "CLEAR_TRACKS":
      return {
        ...state,
        tracks: [],
        duration: 0,
        currentTime: 0,
        isPlaying: false,
        keyCompatibility: null,
        bpmAnalysis: null,
      };

    case "LOAD_STATE":
      return action.payload;

    default:
      return state;
  }
}

/**
 * Provider props
 */
interface StemBlenderProviderProps {
  children: React.ReactNode;
  audioContext?: AudioContext;
  initialSong?: SeparatedSong;
  onInitialSongConsumed?: () => void;
}

/**
 * Stem Blender Provider Component
 */
export const StemBlenderProvider: React.FC<StemBlenderProviderProps> = ({
  children,
  audioContext: externalAudioContext,
  initialSong,
  onInitialSongConsumed,
}) => {
  const [state, dispatch] = useReducer(blenderReducer, initialBlenderState);
  const audioContextRef = useRef<AudioContext | null>(
    externalAudioContext || null
  );
  // Track which song ID was last processed to allow new songs to be added
  const lastProcessedSongIdRef = useRef<string | null>(null);

  // Initialize audio context on first interaction
  useEffect(() => {
    if (!audioContextRef.current) {
      const initAudioContext = () => {
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContext();
        }
        window.removeEventListener("click", initAudioContext);
      };
      window.addEventListener("click", initAudioContext);
      return () => window.removeEventListener("click", initAudioContext);
    }
  }, []);

  // Handle initial song from StemSeparator
  useEffect(() => {
    if (initialSong && initialSong.id !== lastProcessedSongIdRef.current) {
      lastProcessedSongIdRef.current = initialSong.id;
      dispatch({ type: "ADD_SEPARATED_SONG", payload: initialSong });
      onInitialSongConsumed?.();
    }
  }, [initialSong, onInitialSongConsumed]);

  // Helper actions
  const addSeparatedSong = useCallback((song: SeparatedSong) => {
    dispatch({ type: "ADD_SEPARATED_SONG", payload: song });
  }, []);

  const removeSeparatedSong = useCallback((songId: string) => {
    dispatch({ type: "REMOVE_SEPARATED_SONG", payload: songId });
  }, []);

  const addStemToMixer = useCallback((stem: StemTrack, bpm: number = 120, key: string = "C major") => {
    const track = createBlenderTrack(stem, bpm, key);
    dispatch({ type: "ADD_TRACK", payload: track });
  }, []);

  const removeTrackFromMixer = useCallback((trackId: string) => {
    dispatch({ type: "REMOVE_TRACK", payload: trackId });
  }, []);

  const updateTrackVolume = useCallback((trackId: string, volume: number) => {
    dispatch({ type: "UPDATE_TRACK_VOLUME", payload: { trackId, volume } });
  }, []);

  const updateTrackPan = useCallback((trackId: string, pan: number) => {
    dispatch({ type: "UPDATE_TRACK_PAN", payload: { trackId, pan } });
  }, []);

  const toggleMute = useCallback((trackId: string) => {
    dispatch({ type: "TOGGLE_TRACK_MUTE", payload: trackId });
  }, []);

  const toggleSolo = useCallback((trackId: string) => {
    dispatch({ type: "TOGGLE_TRACK_SOLO", payload: trackId });
  }, []);

  const setTrackOffset = useCallback((trackId: string, offset: number) => {
    dispatch({ type: "UPDATE_TRACK_OFFSET", payload: { trackId, offset } });
  }, []);

  const setMasterVolume = useCallback((volume: number) => {
    dispatch({ type: "SET_MASTER_VOLUME", payload: volume });
  }, []);

  const clearAllTracks = useCallback(() => {
    dispatch({ type: "CLEAR_TRACKS" });
  }, []);

  const value: StemBlenderContextValue = {
    state,
    dispatch,
    addSeparatedSong,
    removeSeparatedSong,
    addStemToMixer,
    removeTrackFromMixer,
    updateTrackVolume,
    updateTrackPan,
    toggleMute,
    toggleSolo,
    setTrackOffset,
    setMasterVolume,
    clearAllTracks,
    audioContext: audioContextRef.current,
  };

  return (
    <StemBlenderContext.Provider value={value}>
      {children}
    </StemBlenderContext.Provider>
  );
};

/**
 * Hook to use the stem blender context
 */
export function useStemBlender(): StemBlenderContextValue {
  const context = useContext(StemBlenderContext);
  if (!context) {
    throw new Error("useStemBlender must be used within a StemBlenderProvider");
  }
  return context;
}

export default StemBlenderProvider;
