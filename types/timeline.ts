import { AudioAnalysisResult } from "../types";

// Timeline Clip - represents a song segment on the timeline
export interface TimelineClip {
  id: string;
  songId: string;
  songTitle: string;
  audioBuffer: AudioBuffer | null;
  waveformData: Float32Array | null; // Pre-computed for fast rendering
  audioUrl: string;

  // Timeline positioning
  startTime: number; // Position on timeline (seconds)
  duration: number; // Original duration
  trimStart: number; // Trim from beginning (seconds)
  trimEnd: number; // Trim from end (seconds)

  // Audio analysis
  analysis: {
    bpm: number;
    key: string;
    genre: string;
    mood: string;
  } | null;

  // State
  isSelected: boolean;
  isMuted: boolean;
  volume: number; // 0-1
}

// Crossfade curve types
export type CrossfadeCurveType =
  | "linear"
  | "equalPower"
  | "sCurve"
  | "exponential";

// Crossfade region between two clips
export interface CrossfadeRegion {
  id: string;
  clipAId: string;
  clipBId: string;
  duration: number; // Crossfade length in seconds
  curveType: CrossfadeCurveType;

  // AI-generated transition audio (optional)
  transitionAudioBuffer?: AudioBuffer;
  transitionAudioUrl?: string;
  transitionPrompt?: string;
  isGenerating?: boolean;
}

// Control mode for the timeline editor
export type ControlMode = "automated" | "ai-suggests" | "manual";

// Song library item (for song selection panel)
export interface LibrarySong {
  id: string;
  title: string;
  style: string;
  audioUrl: string;
  duration: number;
  thumbnailWaveform?: number[]; // Pre-computed for library view
  analysis?: AudioAnalysisResult; // Cached from previous analysis
}

// Merge suggestion from AI
export interface MergeSuggestion {
  id: string;
  type: "reorder" | "crossfade" | "trim" | "key-match" | "bpm-match";
  description: string;
  confidence: number; // 0-100
  clipIds: string[];
  suggestedValue?: number | string;
}

// AI merge plan
export interface MergePlan {
  id: string;
  clips: TimelineClip[];
  crossfades: CrossfadeRegion[];
  totalDuration: number;
  userDescription?: string;
  suggestions: MergeSuggestion[];
  compatibility: {
    score: number; // 0-100
    keyCompatibility: string;
    bpmDifference: number;
    recommendedOrder: string[];
  };
}

// Timeline state
export interface TimelineState {
  // Timeline data
  clips: TimelineClip[];
  crossfades: CrossfadeRegion[];

  // Playback
  currentTime: number;
  isPlaying: boolean;
  duration: number;

  // View
  zoom: number; // 1 = 1 second per 100px
  scrollPosition: number;
  viewportWidth: number;

  // UI State
  controlMode: ControlMode;
  selectedClipId: string | null;
  selectedCrossfadeId: string | null;
  isDragging: boolean;
  draggedClipId: string | null;

  // AI State
  isAnalyzing: boolean;
  isGeneratingTransition: boolean;
  mergePlan: MergePlan | null;
  suggestions: MergeSuggestion[];

  // Export
  isRendering: boolean;
  renderProgress: number;
}

// Timeline actions for context
export interface TimelineActions {
  // Clip operations
  addClip: (song: LibrarySong) => Promise<void>;
  removeClip: (clipId: string) => void;
  moveClip: (clipId: string, newStartTime: number) => void;
  trimClip: (clipId: string, trimStart: number, trimEnd: number) => void;
  selectClip: (clipId: string | null) => void;
  setClipVolume: (clipId: string, volume: number) => void;
  toggleClipMute: (clipId: string) => void;

  // Crossfade operations
  setCrossfadeDuration: (crossfadeId: string, duration: number) => void;
  setCrossfadeCurve: (crossfadeId: string, curve: CrossfadeCurveType) => void;
  generateTransitionAudio: (crossfadeId: string) => Promise<void>;

  // Playback
  play: () => void;
  pause: () => void;
  stop: () => void;
  seek: (time: number) => void;
  setCurrentTime: (time: number) => void; // Updates display time without restarting playback

  // AI operations
  analyzeAndSuggest: () => Promise<void>;
  autoMerge: (description: string) => Promise<void>;
  applySuggestion: (suggestionId: string) => void;
  dismissSuggestion: (suggestionId: string) => void;

  // View
  setZoom: (zoom: number) => void;
  setScroll: (position: number) => void;
  setControlMode: (mode: ControlMode) => void;

  // Export
  renderMergedAudio: () => Promise<Blob>;
}

// Context value type
export interface TimelineContextValue {
  state: TimelineState;
  actions: TimelineActions;
}

// Audio format for export
export type AudioFormat =
  | "wav-16"
  | "wav-24"
  | "wav-32"
  | "mp3-128"
  | "mp3-192"
  | "mp3-256"
  | "mp3-320";

// Export configuration
export interface MergeExportConfig {
  format: AudioFormat;
  normalizeVolume: boolean;
  applyLimiter: boolean;
  includeTransitions: boolean;
  fadeInDuration: number;
  fadeOutDuration: number;
}

// AI analysis response for merge
export interface MergeAnalysisResponse {
  compatibility: {
    score: number;
    keyCompatibility: string;
    bpmDifference: number;
    recommendedOrder: string[];
  };
  suggestedCrossfades: {
    fromSongId: string;
    toSongId: string;
    recommendedDuration: number;
    transitionType: string;
    reasoning: string;
  }[];
  transitionPrompts: {
    clipAId: string;
    clipBId: string;
    prompt: string;
  }[];
}

// Scheduled clip for playback
export interface ScheduledClip {
  clipId: string;
  sourceNode: AudioBufferSourceNode | null;
  gainNode: GainNode | null;
  startTime: number;
  offset: number;
  duration: number;
}
