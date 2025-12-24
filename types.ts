
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
  role: 'user' | 'model';
  text: string;
  translatedText?: string;
  // Properties for Music Creation conversational UI
  songData?: SongData;
  audioUrl?: string; // Instrumental URL
  vocalUrl?: string; // Vocal URL
  isLoadingAudio?: boolean;
  structurePlan?: StructureSection[];
  isLoadingStructure?: boolean;
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
  eqLow: number;   // -10 to 10 dB
  eqMid: number;   // -10 to 10 dB
  eqHigh: number;  // -10 to 10 dB
  reverb: number;  // 0 to 1
  delay: number;   // 0 to 1
}

export interface EQBand {
  id: string;
  frequency: number;  // 20-20000 Hz
  gain: number;       // -12 to +12 dB
  q: number;          // 0.1 to 10
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
export type LufsPreset = 'spotify' | 'youtube' | 'apple' | 'broadcast' | 'custom';

export interface LufsPresetConfig {
  name: string;
  target: number;
  truePeakLimit: number;
  toleranceRange: number;
}

export interface LufsReadings {
  momentary: number;    // 400ms window
  shortTerm: number;    // 3s window
  integrated: number;   // Full program
  truePeak: number;     // dBTP
  range?: number;       // LRA (Loudness Range)
}

// Stereo Field Types
export interface StereoFieldReadings {
  correlation: number;  // -1 (out of phase) to +1 (mono/in phase)
  balance: number;      // -1 (full left) to +1 (full right)
  width: number;        // 0 (mono) to 1+ (wide/out of phase)
}

// Multiband Compressor Types
export interface CompressorBandSettings {
  name: string;
  lowFreq: number;
  highFreq: number;
  enabled: boolean;
  solo: boolean;
  threshold: number;    // -60 to 0 dB
  ratio: number;        // 1 to 20
  attack: number;       // 0.001 to 1 seconds
  release: number;      // 0.01 to 2 seconds
  makeupGain: number;   // 0 to 24 dB
  knee?: number;        // 0 to 40 dB (soft knee)
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
