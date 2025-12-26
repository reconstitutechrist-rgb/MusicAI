export interface LyricsAndConcept {
  lyrics: string;
  concept: string;
  chordProgression: string;
}

export interface SocialMarketingPackage {
  hashtags: string[];
  description: string;
  // Captions now support multiple variations for A/B testing
  captions: { platform: string; variations: string[] }[];
  imagePrompt: string;
  // New strategic content fields
  artistBio: string;
  pressRelease: string;
  interviewPoints: string[];
  releaseTimeline: { day: number; platform: string; action: string }[];
  videoPrompts: string[];
}

export interface SavedCampaign extends SocialMarketingPackage {
  id: string;
  name: string;
  createdAt: number;
}

export interface SongData {
  title: string;
  style: string;
  lyrics: string;
}

export interface StructureSection {
  name: string;
  description: string;
  bars: number;
}

export interface ChatMessage {
  role: "user" | "model";
  text: string;
  translatedText?: string;
  // Properties for Music Creation conversational UI
  songData?: SongData;
  audioUrl?: string; // Instrumental URL
  vocalUrl?: string; // Vocal URL
  isLoadingAudio?: boolean;
  structurePlan?: StructureSection[];
  isLoadingStructure?: boolean;
  // Error handling properties
  isError?: boolean;
  audioError?: boolean;
  audioErrorMessage?: string;
}

export interface AudioAnalysisResult {
  bpm: string;
  key: string;
  genre: string;
  chords: string[];
  productionFeedback: string;
  mood: string;
}

// Audio Production Types
export interface TrackFX {
  eqLow: number; // -10 to 10 dB
  eqMid: number; // -10 to 10 dB
  eqHigh: number; // -10 to 10 dB
  reverb: number; // 0 to 1
  delay: number; // 0 to 1
}

export interface EQBand {
  id: string;
  frequency: number; // 20-20000 Hz
  gain: number; // -12 to +12 dB
  q: number; // 0.1 to 10
  type: BiquadFilterType;
  enabled: boolean;
}

export interface FXPreset {
  id: string;
  name: string;
  vocalFX: TrackFX;
  harmonyFX: TrackFX;
  volumes: { inst: number; vocal: number; harmony: number };
  isBuiltIn?: boolean;
}

// Note: TrackConfig is defined in utils/audioExport.ts for audio export functionality

// Spectrum Analyzer Types
export interface SpectrumAnalyzerConfig {
  fftSize: 1024 | 2048 | 4096 | 8192;
  smoothingTimeConstant: number;
  minDecibels: number;
  maxDecibels: number;
}

// LUFS Metering Types
export type LufsPreset =
  | "spotify"
  | "youtube"
  | "apple"
  | "broadcast"
  | "custom";

export interface LufsPresetConfig {
  name: string;
  target: number;
  truePeakLimit: number;
  toleranceRange: number;
}

export interface LufsReadings {
  momentary: number; // 400ms window
  shortTerm: number; // 3s window
  integrated: number; // Full program
  truePeak: number; // dBTP
  range?: number; // LRA (Loudness Range)
}

// Stereo Field Types
export interface StereoFieldReadings {
  correlation: number; // -1 (out of phase) to +1 (mono/in phase)
  balance: number; // -1 (full left) to +1 (full right)
  width: number; // 0 (mono) to 1+ (wide/out of phase)
}

// Multiband Compressor Types
export interface CompressorBandSettings {
  name: string;
  lowFreq: number;
  highFreq: number;
  enabled: boolean;
  solo: boolean;
  threshold: number; // -60 to 0 dB
  ratio: number; // 1 to 20
  attack: number; // 0.001 to 1 seconds
  release: number; // 0.01 to 2 seconds
  makeupGain: number; // 0 to 24 dB
  knee?: number; // 0 to 40 dB (soft knee)
}

export interface MultibandCompressorSettings {
  bands: CompressorBandSettings[];
  bypass: boolean;
  inputGain: number;
  outputGain: number;
}

export interface MultibandCompressorPreset {
  id: string;
  name: string;
  description: string;
  settings: MultibandCompressorSettings;
  isBuiltIn: boolean;
}

// Master Bus Configuration
export interface MasterBusConfig {
  analyserFFTSize: number;
  analyserSmoothing: number;
  enableStereoAnalysis: boolean;
  enableMultibandCompressor: boolean;
}

// Automation Types
export type AutomationCurveType = "linear" | "exponential" | "hold" | "smooth";

export interface AutomationPoint {
  id: string;
  time: number; // Position in seconds
  value: number; // Normalized 0-1 value
  curve: AutomationCurveType; // Interpolation to next point
}

export type AutomatableParameter =
  | "inst-volume"
  | "vocal-volume"
  | "harmony-volume"
  | "vocal-eqLow"
  | "vocal-eqMid"
  | "vocal-eqHigh"
  | "harmony-eqLow"
  | "harmony-eqMid"
  | "harmony-eqHigh"
  | "vocal-reverb"
  | "harmony-reverb"
  | "vocal-delay"
  | "harmony-delay"
  | "master-volume";

export interface AutomationLaneData {
  id: string;
  parameter: AutomatableParameter;
  points: AutomationPoint[];
  enabled: boolean;
  minValue: number; // Actual min value for the parameter
  maxValue: number; // Actual max value for the parameter
}

export interface AutomationState {
  lanes: AutomationLaneData[];
  isRecording: boolean;
  isPlaying: boolean;
}

// Karaoke Feature Types

/**
 * Represents a single line of lyrics with timing information for karaoke sync
 */
export interface LyricLine {
  id: string;
  text: string;
  startTime: number; // in seconds
  endTime: number; // in seconds
  sectionTag?: string; // e.g., "[Verse 1]", "[Chorus]"
}

/**
 * Complete karaoke song data with timing information
 */
export interface KaraokeSong {
  id: string;
  songData: SongData;
  instrumentalUrl: string;
  vocalUrl?: string; // Original AI vocal for reference
  duration: number; // Total duration in seconds
  lyricLines: LyricLine[];
  bpm?: number;
  key?: string;
  createdAt: number;
}

/**
 * Recording session state for karaoke mode
 */
export interface KaraokeRecordingState {
  isRecording: boolean;
  isPreviewing: boolean;
  recordedBlobUrl: string | null;
  recordedBlob: Blob | null;
  recordingStartTime: number | null;
  recordingDuration: number;
}

/**
 * Type of vocal enhancement applied to recording
 */
export type VocalEnhancementType = "ai-enhanced" | "manual-edit" | "raw";

/**
 * Result of recording enhancement process
 */
export interface RecordingEnhancementResult {
  type: VocalEnhancementType;
  processedUrl: string;
  processingApplied?: string[]; // e.g., ['auto-tune', 'reverb']
}

/**
 * Manual timing adjustment for a lyric line
 */
export interface LyricTimingAdjustment {
  lineId: string;
  offsetMs: number; // Positive = delay, Negative = advance
}

/**
 * Response from AI lyrics timing generation
 */
export interface LyricsTimingResponse {
  lyricLines: {
    text: string;
    startTime: number;
    endTime: number;
    sectionTag?: string;
  }[];
  estimatedBpm?: number;
  estimatedKey?: string;
}

// Song Merger Types

/**
 * Represents a song segment on the timeline
 */
export interface TimelineSegment {
  id: string;
  audioUrl: string;
  audioBuffer?: AudioBuffer;
  title: string;
  startTime: number; // Position on timeline in seconds
  duration: number; // Duration of the segment in seconds
  trimStart: number; // How much of the start is trimmed in seconds
  trimEnd: number; // How much of the end is trimmed in seconds
  volume: number; // 0 to 1
  fadeIn: number; // Fade in duration in seconds
  fadeOut: number; // Fade out duration in seconds
}

/**
 * Merge strategy options for AI-powered song merging
 */
export type MergeStrategy =
  | "crossfade"
  | "beat-match"
  | "smooth-transition"
  | "medley"
  | "mashup"
  | "custom";

/**
 * Configuration for AI song merging
 */
export interface MergeConfiguration {
  strategy: MergeStrategy;
  customInstructions?: string;
  transitionDuration?: number; // in seconds
  matchBPM?: boolean;
  matchKey?: boolean;
}

/**
 * Result from AI song merge analysis
 */
export interface MergeAnalysisResult {
  suggestedTransitions: {
    fromSegment: string; // segment id
    toSegment: string; // segment id
    transitionType: string;
    transitionDuration: number;
    reasoning: string;
  }[];
  tempoAdjustments: {
    segmentId: string;
    originalBPM: number;
    targetBPM: number;
  }[];
  keyAdjustments: {
    segmentId: string;
    originalKey: string;
    targetKey: string;
    semitoneShift: number;
  }[];
  overallFlow: string; // Description of the merged song flow
}
