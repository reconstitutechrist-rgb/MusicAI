// Database types for Supabase
// These types match the database schema defined in COMMUNITY_MARKETPLACE_PLAN.md

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

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          display_name: string | null;
          avatar_url: string | null;
          bio: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          display_name?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          updated_at?: string;
        };
      };
      karaoke_collaborations: {
        Row: {
          id: string;
          owner_id: string;
          title: string;
          description: string | null;
          genre: Genre;
          mood: Mood;
          collab_type: CollabType;
          status: CollabStatus;
          instrumental_url: string;
          original_vocal_url: string | null;
          lyrics: string | null;
          duration: number | null;
          bpm: number | null;
          song_key: string | null;
          parts_needed: CollabPart[] | null;
          max_submissions: number;
          deadline: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          title: string;
          description?: string | null;
          genre: Genre;
          mood: Mood;
          collab_type?: CollabType;
          status?: CollabStatus;
          instrumental_url: string;
          original_vocal_url?: string | null;
          lyrics?: string | null;
          duration?: number | null;
          bpm?: number | null;
          song_key?: string | null;
          parts_needed?: CollabPart[] | null;
          max_submissions?: number;
          deadline?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          description?: string | null;
          genre?: Genre;
          mood?: Mood;
          collab_type?: CollabType;
          status?: CollabStatus;
          instrumental_url?: string;
          original_vocal_url?: string | null;
          lyrics?: string | null;
          duration?: number | null;
          bpm?: number | null;
          song_key?: string | null;
          parts_needed?: CollabPart[] | null;
          max_submissions?: number;
          deadline?: string | null;
          updated_at?: string;
        };
      };
      collab_submissions: {
        Row: {
          id: string;
          collab_id: string;
          singer_id: string;
          recording_url: string;
          is_enhanced: boolean;
          part_name: string | null;
          status: SubmissionStatus;
          owner_feedback: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          collab_id: string;
          singer_id: string;
          recording_url: string;
          is_enhanced?: boolean;
          part_name?: string | null;
          status?: SubmissionStatus;
          owner_feedback?: string | null;
          created_at?: string;
        };
        Update: {
          recording_url?: string;
          is_enhanced?: boolean;
          part_name?: string | null;
          status?: SubmissionStatus;
          owner_feedback?: string | null;
        };
      };
      completed_collabs: {
        Row: {
          id: string;
          collab_id: string;
          final_mix_url: string;
          contributors: Contributor[];
          play_count: number;
          like_count: number;
          published_at: string;
        };
        Insert: {
          id?: string;
          collab_id: string;
          final_mix_url: string;
          contributors: Contributor[];
          play_count?: number;
          like_count?: number;
          published_at?: string;
        };
        Update: {
          final_mix_url?: string;
          contributors?: Contributor[];
          play_count?: number;
          like_count?: number;
        };
      };
      ai_showcase: {
        Row: {
          id: string;
          creator_id: string;
          title: string;
          description: string | null;
          genre: Genre;
          mood: Mood;
          audio_url: string;
          cover_image_url: string | null;
          lyrics: string | null;
          duration: number | null;
          bpm: number | null;
          song_key: string | null;
          style_description: string | null;
          play_count: number;
          like_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          creator_id: string;
          title: string;
          description?: string | null;
          genre: Genre;
          mood: Mood;
          audio_url: string;
          cover_image_url?: string | null;
          lyrics?: string | null;
          duration?: number | null;
          bpm?: number | null;
          song_key?: string | null;
          style_description?: string | null;
          play_count?: number;
          like_count?: number;
          created_at?: string;
        };
        Update: {
          title?: string;
          description?: string | null;
          genre?: Genre;
          mood?: Mood;
          audio_url?: string;
          cover_image_url?: string | null;
          lyrics?: string | null;
          duration?: number | null;
          bpm?: number | null;
          song_key?: string | null;
          style_description?: string | null;
          play_count?: number;
          like_count?: number;
        };
      };
      likes: {
        Row: {
          id: string;
          user_id: string;
          target_type: "ai_showcase" | "completed_collab";
          target_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          target_type: "ai_showcase" | "completed_collab";
          target_id: string;
          created_at?: string;
        };
        Update: never;
      };
      comments: {
        Row: {
          id: string;
          user_id: string;
          target_type: string;
          target_id: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          target_type: string;
          target_id: string;
          content: string;
          created_at?: string;
        };
        Update: {
          content?: string;
        };
      };
    };
  };
}

// Helper types
export interface CollabPart {
  part: string;
  description: string;
  filled?: boolean;
  singerId?: string;
}

export interface Contributor {
  userId: string;
  role: "vocalist" | "producer" | "mixing" | "lyrics";
  part?: string;
}
