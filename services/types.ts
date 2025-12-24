
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
