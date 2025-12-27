// Community Marketplace Types

export type Genre =
  | "pop"
  | "rock"
  | "hip_hop"
  | "rnb"
  | "country"
  | "electronic"
  | "jazz"
  | "classical"
  | "folk"
  | "metal"
  | "indie"
  | "latin"
  | "other";

export type Mood =
  | "energetic"
  | "chill"
  | "emotional"
  | "party"
  | "focus"
  | "romantic"
  | "melancholic"
  | "uplifting"
  | "dark"
  | "peaceful";

export type CollabStatus = "open" | "in_progress" | "completed" | "cancelled";
export type SubmissionStatus = "pending" | "accepted" | "rejected" | "selected";
export type CollabType =
  | "single_singer"
  | "multiple_auditions"
  | "duet"
  | "multi_part";

// User profile
export interface UserProfile {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  createdAt: string;
  updatedAt?: string;
}

// Part definition for multi-part collaborations
export interface CollabPart {
  part: string;
  description: string;
  filled?: boolean;
  singerId?: string;
}

// Karaoke collaboration
export interface KaraokeCollaboration {
  id: string;
  ownerId: string;
  owner?: UserProfile;
  title: string;
  description: string | null;
  genre: Genre;
  mood: Mood;
  collabType: CollabType;
  status: CollabStatus;
  instrumentalUrl: string;
  originalVocalUrl: string | null;
  lyrics: string | null;
  duration: number | null;
  bpm: number | null;
  songKey: string | null;
  partsNeeded: CollabPart[] | null;
  maxSubmissions: number;
  deadline: string | null;
  createdAt: string;
  updatedAt?: string;
  submissionCount?: number;
}

// Collaboration submission
export interface CollabSubmission {
  id: string;
  collabId: string;
  singerId: string;
  singer?: UserProfile;
  recordingUrl: string;
  isEnhanced: boolean;
  partName: string | null;
  status: SubmissionStatus;
  ownerFeedback: string | null;
  createdAt: string;
}

// Contributor credit
export interface Contributor {
  userId: string;
  user?: UserProfile;
  role: "vocalist" | "producer" | "mixing" | "lyrics";
  part?: string;
}

// Completed collaboration
export interface CompletedCollab {
  id: string;
  collabId: string;
  collaboration?: KaraokeCollaboration;
  finalMixUrl: string;
  contributors: Contributor[];
  playCount: number;
  likeCount: number;
  publishedAt: string;
  isLikedByUser?: boolean;
}

// AI Showcase track
export interface AIShowcase {
  id: string;
  creatorId: string;
  creator?: UserProfile;
  title: string;
  description: string | null;
  genre: Genre;
  mood: Mood;
  audioUrl: string;
  coverImageUrl: string | null;
  lyrics: string | null;
  duration: number | null;
  bpm: number | null;
  songKey: string | null;
  styleDescription: string | null;
  playCount: number;
  likeCount: number;
  createdAt: string;
  isLikedByUser?: boolean;
}

// Comment
export interface Comment {
  id: string;
  userId: string;
  user?: UserProfile;
  targetType: "ai_showcase" | "completed_collab" | "karaoke_collaboration";
  targetId: string;
  content: string;
  createdAt: string;
}

// Filter options for browsing
export interface CommunityFilters {
  genre?: Genre | "all";
  mood?: Mood | "all";
  status?: CollabStatus | "all";
  sortBy?: "newest" | "popular" | "deadline";
  search?: string;
}

// Form data for creating collaborations
export interface CreateCollabFormData {
  title: string;
  description: string;
  genre: Genre;
  mood: Mood;
  collabType: CollabType;
  instrumentalUrl: string;
  originalVocalUrl?: string;
  lyrics?: string;
  duration?: number;
  bpm?: number;
  songKey?: string;
  partsNeeded?: CollabPart[];
  maxSubmissions?: number;
  deadline?: string;
}

// Form data for AI showcase upload
export interface CreateShowcaseFormData {
  title: string;
  description?: string;
  genre: Genre;
  mood: Mood;
  audioUrl: string;
  coverImageUrl?: string;
  lyrics?: string;
  duration?: number;
  bpm?: number;
  songKey?: string;
  styleDescription?: string;
}

// Genre and mood display options
export const GENRES: { value: Genre; label: string }[] = [
  { value: "pop", label: "Pop" },
  { value: "rock", label: "Rock" },
  { value: "hip_hop", label: "Hip-Hop" },
  { value: "rnb", label: "R&B" },
  { value: "country", label: "Country" },
  { value: "electronic", label: "Electronic" },
  { value: "jazz", label: "Jazz" },
  { value: "classical", label: "Classical" },
  { value: "folk", label: "Folk" },
  { value: "metal", label: "Metal" },
  { value: "indie", label: "Indie" },
  { value: "latin", label: "Latin" },
  { value: "other", label: "Other" },
];

export const MOODS: { value: Mood; label: string }[] = [
  { value: "energetic", label: "Energetic" },
  { value: "chill", label: "Chill" },
  { value: "emotional", label: "Emotional" },
  { value: "party", label: "Party" },
  { value: "focus", label: "Focus" },
  { value: "romantic", label: "Romantic" },
  { value: "melancholic", label: "Melancholic" },
  { value: "uplifting", label: "Uplifting" },
  { value: "dark", label: "Dark" },
  { value: "peaceful", label: "Peaceful" },
];

export const COLLAB_TYPES: { value: CollabType; label: string; description: string }[] = [
  {
    value: "single_singer",
    label: "Single Singer",
    description: "Looking for one vocalist to sing the entire song",
  },
  {
    value: "multiple_auditions",
    label: "Multiple Auditions",
    description: "Accept multiple recordings, pick the best one",
  },
  {
    value: "duet",
    label: "Duet",
    description: "Two singers sharing vocal parts",
  },
  {
    value: "multi_part",
    label: "Multi-Part",
    description: "Multiple singers for different sections (verse, chorus, etc.)",
  },
];
