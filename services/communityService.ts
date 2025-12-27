import { supabase, isSupabaseConfigured } from "./supabaseClient";
import {
  UserProfile,
  KaraokeCollaboration,
  CollabSubmission,
  CompletedCollab,
  AIShowcase,
  Comment,
  CommunityFilters,
  CreateCollabFormData,
  CreateShowcaseFormData,
} from "../types/community";

// ==================== COLLABORATIONS ====================

export const createCollaboration = async (
  data: CreateCollabFormData,
  ownerId: string,
): Promise<{ data?: KaraokeCollaboration; error?: string }> => {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured" };
  }

  try {
    const { data: result, error } = await supabase
      .from("karaoke_collaborations")
      .insert({
        owner_id: ownerId,
        title: data.title,
        description: data.description,
        genre: data.genre,
        mood: data.mood,
        collab_type: data.collabType,
        instrumental_url: data.instrumentalUrl,
        original_vocal_url: data.originalVocalUrl,
        lyrics: data.lyrics,
        duration: data.duration,
        bpm: data.bpm,
        song_key: data.songKey,
        parts_needed: data.partsNeeded,
        max_submissions: data.maxSubmissions || 10,
        deadline: data.deadline,
      })
      .select()
      .single();

    if (error) {
      return { error: error.message };
    }

    return { data: mapCollabFromDb(result) };
  } catch (err) {
    return { error: "Failed to create collaboration" };
  }
};

export const getCollaborations = async (
  filters: CommunityFilters = {},
): Promise<{ data?: KaraokeCollaboration[]; error?: string }> => {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured" };
  }

  try {
    let query = supabase
      .from("karaoke_collaborations")
      .select(
        `
        *,
        owner:profiles!owner_id(*)
      `,
      );

    // Apply filters
    if (filters.genre && filters.genre !== "all") {
      query = query.eq("genre", filters.genre);
    }
    if (filters.mood && filters.mood !== "all") {
      query = query.eq("mood", filters.mood);
    }
    if (filters.status && filters.status !== "all") {
      query = query.eq("status", filters.status);
    }
    if (filters.search) {
      query = query.ilike("title", `%${filters.search}%`);
    }

    // Apply sorting
    switch (filters.sortBy) {
      case "popular":
        query = query.order("created_at", { ascending: false });
        break;
      case "deadline":
        query = query
          .not("deadline", "is", null)
          .order("deadline", { ascending: true });
        break;
      default:
        query = query.order("created_at", { ascending: false });
    }

    const { data, error } = await query;

    if (error) {
      return { error: error.message };
    }

    const collaborations = data.map((item) => ({
      ...mapCollabFromDb(item),
      owner: item.owner ? mapProfileFromDb(item.owner) : undefined,
    }));

    return { data: collaborations };
  } catch (err) {
    return { error: "Failed to fetch collaborations" };
  }
};

export const getCollaborationById = async (
  id: string,
): Promise<{ data?: KaraokeCollaboration; error?: string }> => {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured" };
  }

  try {
    const { data, error } = await supabase
      .from("karaoke_collaborations")
      .select(
        `
        *,
        owner:profiles!owner_id(*)
      `,
      )
      .eq("id", id)
      .single();

    if (error) {
      return { error: error.message };
    }

    return {
      data: {
        ...mapCollabFromDb(data),
        owner: data.owner ? mapProfileFromDb(data.owner) : undefined,
      },
    };
  } catch (err) {
    return { error: "Failed to fetch collaboration" };
  }
};

export const updateCollaboration = async (
  id: string,
  updates: Partial<CreateCollabFormData>,
): Promise<{ error?: string }> => {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured" };
  }

  try {
    const { error } = await supabase
      .from("karaoke_collaborations")
      .update({
        title: updates.title,
        description: updates.description,
        genre: updates.genre,
        mood: updates.mood,
        collab_type: updates.collabType,
        lyrics: updates.lyrics,
        parts_needed: updates.partsNeeded,
        max_submissions: updates.maxSubmissions,
        deadline: updates.deadline,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      return { error: error.message };
    }

    return {};
  } catch (err) {
    return { error: "Failed to update collaboration" };
  }
};

export const updateCollabStatus = async (
  id: string,
  status: KaraokeCollaboration["status"],
): Promise<{ error?: string }> => {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured" };
  }

  try {
    const { error } = await supabase
      .from("karaoke_collaborations")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      return { error: error.message };
    }

    return {};
  } catch (err) {
    return { error: "Failed to update status" };
  }
};

export const deleteCollaboration = async (
  id: string,
): Promise<{ error?: string }> => {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured" };
  }

  try {
    const { error } = await supabase
      .from("karaoke_collaborations")
      .delete()
      .eq("id", id);

    if (error) {
      return { error: error.message };
    }

    return {};
  } catch (err) {
    return { error: "Failed to delete collaboration" };
  }
};

// ==================== SUBMISSIONS ====================

export const submitAudition = async (
  collabId: string,
  singerId: string,
  recordingUrl: string,
  partName?: string,
  isEnhanced: boolean = false,
): Promise<{ data?: CollabSubmission; error?: string }> => {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured" };
  }

  try {
    const { data, error } = await supabase
      .from("collab_submissions")
      .insert({
        collab_id: collabId,
        singer_id: singerId,
        recording_url: recordingUrl,
        part_name: partName,
        is_enhanced: isEnhanced,
      })
      .select()
      .single();

    if (error) {
      return { error: error.message };
    }

    return { data: mapSubmissionFromDb(data) };
  } catch (err) {
    return { error: "Failed to submit audition" };
  }
};

export const getSubmissions = async (
  collabId: string,
): Promise<{ data?: CollabSubmission[]; error?: string }> => {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured" };
  }

  try {
    const { data, error } = await supabase
      .from("collab_submissions")
      .select(
        `
        *,
        singer:profiles!singer_id(*)
      `,
      )
      .eq("collab_id", collabId)
      .order("created_at", { ascending: false });

    if (error) {
      return { error: error.message };
    }

    const submissions = data.map((item) => ({
      ...mapSubmissionFromDb(item),
      singer: item.singer ? mapProfileFromDb(item.singer) : undefined,
    }));

    return { data: submissions };
  } catch (err) {
    return { error: "Failed to fetch submissions" };
  }
};

export const updateSubmissionStatus = async (
  submissionId: string,
  status: CollabSubmission["status"],
  feedback?: string,
): Promise<{ error?: string }> => {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured" };
  }

  try {
    const { error } = await supabase
      .from("collab_submissions")
      .update({
        status,
        owner_feedback: feedback,
      })
      .eq("id", submissionId);

    if (error) {
      return { error: error.message };
    }

    return {};
  } catch (err) {
    return { error: "Failed to update submission" };
  }
};

// ==================== AI SHOWCASE ====================

export const createShowcase = async (
  data: CreateShowcaseFormData,
  creatorId: string,
): Promise<{ data?: AIShowcase; error?: string }> => {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured" };
  }

  try {
    const { data: result, error } = await supabase
      .from("ai_showcase")
      .insert({
        creator_id: creatorId,
        title: data.title,
        description: data.description,
        genre: data.genre,
        mood: data.mood,
        audio_url: data.audioUrl,
        cover_image_url: data.coverImageUrl,
        lyrics: data.lyrics,
        duration: data.duration,
        bpm: data.bpm,
        song_key: data.songKey,
        style_description: data.styleDescription,
      })
      .select()
      .single();

    if (error) {
      return { error: error.message };
    }

    return { data: mapShowcaseFromDb(result) };
  } catch (err) {
    return { error: "Failed to create showcase" };
  }
};

export const getShowcases = async (
  filters: CommunityFilters = {},
): Promise<{ data?: AIShowcase[]; error?: string }> => {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured" };
  }

  try {
    let query = supabase.from("ai_showcase").select(`
        *,
        creator:profiles!creator_id(*)
      `);

    // Apply filters
    if (filters.genre && filters.genre !== "all") {
      query = query.eq("genre", filters.genre);
    }
    if (filters.mood && filters.mood !== "all") {
      query = query.eq("mood", filters.mood);
    }
    if (filters.search) {
      query = query.ilike("title", `%${filters.search}%`);
    }

    // Apply sorting
    switch (filters.sortBy) {
      case "popular":
        query = query.order("play_count", { ascending: false });
        break;
      default:
        query = query.order("created_at", { ascending: false });
    }

    const { data, error } = await query;

    if (error) {
      return { error: error.message };
    }

    const showcases = data.map((item) => ({
      ...mapShowcaseFromDb(item),
      creator: item.creator ? mapProfileFromDb(item.creator) : undefined,
    }));

    return { data: showcases };
  } catch (err) {
    return { error: "Failed to fetch showcases" };
  }
};

export const getShowcaseById = async (
  id: string,
): Promise<{ data?: AIShowcase; error?: string }> => {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured" };
  }

  try {
    const { data, error } = await supabase
      .from("ai_showcase")
      .select(
        `
        *,
        creator:profiles!creator_id(*)
      `,
      )
      .eq("id", id)
      .single();

    if (error) {
      return { error: error.message };
    }

    return {
      data: {
        ...mapShowcaseFromDb(data),
        creator: data.creator ? mapProfileFromDb(data.creator) : undefined,
      },
    };
  } catch (err) {
    return { error: "Failed to fetch showcase" };
  }
};

export const deleteShowcase = async (id: string): Promise<{ error?: string }> => {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured" };
  }

  try {
    const { error } = await supabase.from("ai_showcase").delete().eq("id", id);

    if (error) {
      return { error: error.message };
    }

    return {};
  } catch (err) {
    return { error: "Failed to delete showcase" };
  }
};

export const incrementPlayCount = async (
  type: "showcase" | "collab",
  id: string,
): Promise<void> => {
  if (!isSupabaseConfigured()) return;

  const table = type === "showcase" ? "ai_showcase" : "completed_collabs";

  await supabase.rpc("increment_play_count", {
    table_name: table,
    row_id: id,
  });
};

// ==================== SOCIAL FEATURES ====================

export const toggleLike = async (
  userId: string,
  targetType: "ai_showcase" | "completed_collab",
  targetId: string,
): Promise<{ liked: boolean; error?: string }> => {
  if (!isSupabaseConfigured()) {
    return { liked: false, error: "Supabase is not configured" };
  }

  try {
    // Check if already liked
    const { data: existingLike } = await supabase
      .from("likes")
      .select("id")
      .eq("user_id", userId)
      .eq("target_type", targetType)
      .eq("target_id", targetId)
      .single();

    if (existingLike) {
      // Unlike
      await supabase.from("likes").delete().eq("id", existingLike.id);
      return { liked: false };
    } else {
      // Like
      await supabase.from("likes").insert({
        user_id: userId,
        target_type: targetType,
        target_id: targetId,
      });
      return { liked: true };
    }
  } catch (err) {
    return { liked: false, error: "Failed to toggle like" };
  }
};

export const checkIfLiked = async (
  userId: string,
  targetType: "ai_showcase" | "completed_collab",
  targetId: string,
): Promise<boolean> => {
  if (!isSupabaseConfigured()) return false;

  const { data } = await supabase
    .from("likes")
    .select("id")
    .eq("user_id", userId)
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .single();

  return !!data;
};

export const getComments = async (
  targetType: string,
  targetId: string,
): Promise<{ data?: Comment[]; error?: string }> => {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured" };
  }

  try {
    const { data, error } = await supabase
      .from("comments")
      .select(
        `
        *,
        user:profiles!user_id(*)
      `,
      )
      .eq("target_type", targetType)
      .eq("target_id", targetId)
      .order("created_at", { ascending: true });

    if (error) {
      return { error: error.message };
    }

    const comments: Comment[] = data.map((item) => ({
      id: item.id,
      userId: item.user_id,
      user: item.user ? mapProfileFromDb(item.user) : undefined,
      targetType: item.target_type as Comment["targetType"],
      targetId: item.target_id,
      content: item.content,
      createdAt: item.created_at,
    }));

    return { data: comments };
  } catch (err) {
    return { error: "Failed to fetch comments" };
  }
};

export const addComment = async (
  userId: string,
  targetType: string,
  targetId: string,
  content: string,
): Promise<{ data?: Comment; error?: string }> => {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured" };
  }

  try {
    const { data, error } = await supabase
      .from("comments")
      .insert({
        user_id: userId,
        target_type: targetType,
        target_id: targetId,
        content,
      })
      .select()
      .single();

    if (error) {
      return { error: error.message };
    }

    return {
      data: {
        id: data.id,
        userId: data.user_id,
        targetType: data.target_type as Comment["targetType"],
        targetId: data.target_id,
        content: data.content,
        createdAt: data.created_at,
      },
    };
  } catch (err) {
    return { error: "Failed to add comment" };
  }
};

export const deleteComment = async (
  commentId: string,
): Promise<{ error?: string }> => {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured" };
  }

  try {
    const { error } = await supabase
      .from("comments")
      .delete()
      .eq("id", commentId);

    if (error) {
      return { error: error.message };
    }

    return {};
  } catch (err) {
    return { error: "Failed to delete comment" };
  }
};

// ==================== FILE STORAGE ====================

export const uploadAudio = async (
  file: File | Blob,
  path: string,
): Promise<{ url?: string; error?: string }> => {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured" };
  }

  try {
    const { error } = await supabase.storage
      .from("audio")
      .upload(path, file, { upsert: true });

    if (error) {
      return { error: error.message };
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("audio").getPublicUrl(path);

    return { url: publicUrl };
  } catch (err) {
    return { error: "Failed to upload audio" };
  }
};

export const uploadImage = async (
  file: File,
  path: string,
): Promise<{ url?: string; error?: string }> => {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured" };
  }

  try {
    const { error } = await supabase.storage
      .from("images")
      .upload(path, file, { upsert: true });

    if (error) {
      return { error: error.message };
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("images").getPublicUrl(path);

    return { url: publicUrl };
  } catch (err) {
    return { error: "Failed to upload image" };
  }
};

// ==================== HELPER FUNCTIONS ====================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapProfileFromDb = (data: any): UserProfile => ({
  id: data.id,
  username: data.username,
  displayName: data.display_name,
  avatarUrl: data.avatar_url,
  bio: data.bio,
  createdAt: data.created_at,
  updatedAt: data.updated_at,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapCollabFromDb = (data: any): KaraokeCollaboration => ({
  id: data.id,
  ownerId: data.owner_id,
  title: data.title,
  description: data.description,
  genre: data.genre,
  mood: data.mood,
  collabType: data.collab_type,
  status: data.status,
  instrumentalUrl: data.instrumental_url,
  originalVocalUrl: data.original_vocal_url,
  lyrics: data.lyrics,
  duration: data.duration,
  bpm: data.bpm,
  songKey: data.song_key,
  partsNeeded: data.parts_needed,
  maxSubmissions: data.max_submissions,
  deadline: data.deadline,
  createdAt: data.created_at,
  updatedAt: data.updated_at,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapSubmissionFromDb = (data: any): CollabSubmission => ({
  id: data.id,
  collabId: data.collab_id,
  singerId: data.singer_id,
  recordingUrl: data.recording_url,
  isEnhanced: data.is_enhanced,
  partName: data.part_name,
  status: data.status,
  ownerFeedback: data.owner_feedback,
  createdAt: data.created_at,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapShowcaseFromDb = (data: any): AIShowcase => ({
  id: data.id,
  creatorId: data.creator_id,
  title: data.title,
  description: data.description,
  genre: data.genre,
  mood: data.mood,
  audioUrl: data.audio_url,
  coverImageUrl: data.cover_image_url,
  lyrics: data.lyrics,
  duration: data.duration,
  bpm: data.bpm,
  songKey: data.song_key,
  styleDescription: data.style_description,
  playCount: data.play_count,
  likeCount: data.like_count,
  createdAt: data.created_at,
});
