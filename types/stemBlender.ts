/**
 * Stem Blender Types
 * Type definitions for multi-source stem blending feature
 */

/**
 * Available stem types from Demucs separation
 */
export type StemType = "vocals" | "drums" | "bass" | "other";

/**
 * Color scheme for stem types
 */
export const STEM_COLORS: Record<StemType, string> = {
  vocals: "#ec4899", // Pink
  drums: "#eab308", // Yellow
  bass: "#f97316", // Orange
  other: "#3b82f6", // Blue
};

/**
 * Labels for stem types
 */
export const STEM_LABELS: Record<StemType, string> = {
  vocals: "Vocals",
  drums: "Drums",
  bass: "Bass",
  other: "Other",
};

/**
 * Individual stem track from a separated song
 */
export interface StemTrack {
  id: string;
  type: StemType;
  songId: string; // Reference to parent SeparatedSong
  songTitle: string;
  audioUrl: string;
  audioBuffer: AudioBuffer | null;
  waveformData: Float32Array | null;
  duration: number;
}

/**
 * A song that has been separated into stems
 */
export interface SeparatedSong {
  id: string;
  originalTitle: string;
  originalAudioUrl: string;
  separatedAt: number; // timestamp
  stems: {
    vocals: StemTrack | null;
    drums: StemTrack | null;
    bass: StemTrack | null;
    other: StemTrack | null;
  };
  analysis: SongAnalysis | null;
}

/**
 * Audio analysis data
 */
export interface SongAnalysis {
  bpm: number;
  key: string;
  genre: string;
  mood: string;
}

/**
 * A track in the blender mixer
 */
export interface BlenderTrack {
  id: string;
  stem: StemTrack;

  // Mixer controls
  volume: number; // 0-1
  pan: number; // -1 (left) to +1 (right)
  muted: boolean;
  solo: boolean;

  // Time adjustment
  offset: number; // Seconds offset from start (for alignment)
  timeStretchRatio: number; // 1.0 = original tempo (future feature)
  originalBpm: number;
  originalKey: string; // Musical key (e.g., "C major", "Am")

  // Visual state
  color: string;
  isExpanded: boolean;
}

/**
 * Key compatibility result between tracks
 */
export interface KeyCompatibilityResult {
  isCompatible: boolean;
  score: number; // 0-1
  warnings: string[];
  suggestions: string[];
}

/**
 * BPM analysis result
 */
export interface BpmAnalysisResult {
  averageBpm: number;
  maxDifference: number;
  isCompatible: boolean;
  suggestions: string[];
}

/**
 * Main blender state
 */
export interface BlenderState {
  // Library of separated songs
  separatedSongs: SeparatedSong[];

  // Active tracks in the mixer
  tracks: BlenderTrack[];

  // Target BPM for time-stretching (future feature)
  targetBpm: number | null;

  // Master volume
  masterVolume: number;

  // Playback state
  isPlaying: boolean;
  currentTime: number;
  duration: number;

  // Analysis results
  keyCompatibility: KeyCompatibilityResult | null;
  bpmAnalysis: BpmAnalysisResult | null;
}

/**
 * Blender action types for reducer
 */
export type BlenderAction =
  | { type: "ADD_SEPARATED_SONG"; payload: SeparatedSong }
  | { type: "REMOVE_SEPARATED_SONG"; payload: string }
  | { type: "ADD_TRACK"; payload: BlenderTrack }
  | { type: "REMOVE_TRACK"; payload: string }
  | { type: "UPDATE_TRACK_VOLUME"; payload: { trackId: string; volume: number } }
  | { type: "UPDATE_TRACK_PAN"; payload: { trackId: string; pan: number } }
  | { type: "TOGGLE_TRACK_MUTE"; payload: string }
  | { type: "TOGGLE_TRACK_SOLO"; payload: string }
  | { type: "UPDATE_TRACK_OFFSET"; payload: { trackId: string; offset: number } }
  | { type: "SET_TARGET_BPM"; payload: number | null }
  | { type: "SET_MASTER_VOLUME"; payload: number }
  | { type: "SET_PLAYING"; payload: boolean }
  | { type: "SET_CURRENT_TIME"; payload: number }
  | { type: "SET_DURATION"; payload: number }
  | { type: "SET_KEY_COMPATIBILITY"; payload: KeyCompatibilityResult | null }
  | { type: "SET_BPM_ANALYSIS"; payload: BpmAnalysisResult | null }
  | { type: "CLEAR_TRACKS" }
  | { type: "LOAD_STATE"; payload: BlenderState };

/**
 * Export format options
 */
export type ExportFormat = "wav" | "mp3";

/**
 * Export options
 */
export interface BlenderExportOptions {
  format: ExportFormat;
  sampleRate: number;
  bitDepth: 16 | 24 | 32;
  normalize: boolean;
  includeSolo: boolean; // If solo is active, only export solo'd tracks
}

/**
 * Playback node structure for a track
 */
export interface TrackPlaybackNodes {
  source: AudioBufferSourceNode | null;
  gain: GainNode;
  pan: StereoPannerNode;
}

/**
 * Helper function to create a stem track ID
 */
export function createStemTrackId(songId: string, stemType: StemType): string {
  return `${songId}-${stemType}`;
}

/**
 * Helper function to create a blender track from a stem
 */
export function createBlenderTrack(
  stem: StemTrack,
  bpm: number = 120,
  key: string = "C major"
): BlenderTrack {
  return {
    id: `blender-${stem.id}-${Date.now()}`,
    stem,
    volume: 0.8,
    pan: 0,
    muted: false,
    solo: false,
    offset: 0,
    timeStretchRatio: 1.0,
    originalBpm: bpm,
    originalKey: key,
    color: STEM_COLORS[stem.type],
    isExpanded: false,
  };
}

/**
 * Initial blender state
 */
export const initialBlenderState: BlenderState = {
  separatedSongs: [],
  tracks: [],
  targetBpm: null,
  masterVolume: 0.8,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  keyCompatibility: null,
  bpmAnalysis: null,
};

/**
 * Circle of Fifths key relationships for compatibility checking
 */
export const CIRCLE_OF_FIFTHS = [
  "C",
  "G",
  "D",
  "A",
  "E",
  "B",
  "F#",
  "Db",
  "Ab",
  "Eb",
  "Bb",
  "F",
] as const;

/**
 * Relative minor keys
 */
export const RELATIVE_MINORS: Record<string, string> = {
  C: "Am",
  G: "Em",
  D: "Bm",
  A: "F#m",
  E: "C#m",
  B: "G#m",
  "F#": "D#m",
  Db: "Bbm",
  Ab: "Fm",
  Eb: "Cm",
  Bb: "Gm",
  F: "Dm",
};

/**
 * Check if two keys are compatible (within 2 steps on circle of fifths)
 */
export function areKeysCompatible(key1: string, key2: string): boolean {
  // Normalize keys (remove minor/major suffix for comparison)
  const normalize = (key: string) => key.replace(/m$/, "").replace(" major", "").replace(" minor", "");

  const k1 = normalize(key1);
  const k2 = normalize(key2);

  // Same key
  if (k1 === k2) return true;

  // Check circle of fifths distance
  const idx1 = CIRCLE_OF_FIFTHS.indexOf(k1 as (typeof CIRCLE_OF_FIFTHS)[number]);
  const idx2 = CIRCLE_OF_FIFTHS.indexOf(k2 as (typeof CIRCLE_OF_FIFTHS)[number]);

  if (idx1 === -1 || idx2 === -1) return true; // Unknown keys, assume compatible

  const distance = Math.min(
    Math.abs(idx1 - idx2),
    12 - Math.abs(idx1 - idx2)
  );

  return distance <= 2;
}

/**
 * Calculate key compatibility for multiple tracks
 */
export function analyzeKeyCompatibility(
  tracks: BlenderTrack[]
): KeyCompatibilityResult {
  if (tracks.length < 2) {
    return {
      isCompatible: true,
      score: 1.0,
      warnings: [],
      suggestions: [],
    };
  }

  const warnings: string[] = [];
  const suggestions: string[] = [];

  // Check all pairs for compatibility
  let incompatiblePairs = 0;
  let totalPairs = 0;

  for (let i = 0; i < tracks.length; i++) {
    for (let j = i + 1; j < tracks.length; j++) {
      totalPairs++;
      const key1 = tracks[i].originalKey;
      const key2 = tracks[j].originalKey;

      if (!areKeysCompatible(key1, key2)) {
        incompatiblePairs++;
        warnings.push(
          `${tracks[i].stem.songTitle} (${key1}) may clash with ${tracks[j].stem.songTitle} (${key2})`
        );
      }
    }
  }

  const score = totalPairs > 0 ? 1 - incompatiblePairs / totalPairs : 1.0;
  const isCompatible = incompatiblePairs === 0;

  if (!isCompatible) {
    suggestions.push(
      "Consider using stems from songs in the same or relative keys for better harmonic blending."
    );
  }

  return {
    isCompatible,
    score,
    warnings,
    suggestions,
  };
}

/**
 * Calculate BPM compatibility for multiple tracks
 */
export function analyzeBpmCompatibility(
  tracks: BlenderTrack[]
): BpmAnalysisResult {
  if (tracks.length === 0) {
    return {
      averageBpm: 0,
      maxDifference: 0,
      isCompatible: true,
      suggestions: [],
    };
  }

  const bpms = tracks.map((t) => t.originalBpm);
  const avg = bpms.reduce((a, b) => a + b, 0) / bpms.length;
  const maxDiff = Math.max(...bpms) - Math.min(...bpms);

  const suggestions: string[] = [];
  if (maxDiff > 10) {
    suggestions.push(
      `BPM difference of ${maxDiff.toFixed(0)} detected. Consider enabling tempo matching.`
    );
  }

  return {
    averageBpm: avg,
    maxDifference: maxDiff,
    isCompatible: maxDiff <= 15,
    suggestions,
  };
}
