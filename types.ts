
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
