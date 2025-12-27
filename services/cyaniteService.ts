/**
 * Cyanite.ai Audio Analysis Service
 * Professional-grade music analysis (BPM, key, mood, genre)
 *
 * Documentation: https://api-docs.cyanite.ai/
 */

import type { AudioAnalysisResult } from "../types";

// Re-export for convenience
export type { AudioAnalysisResult };

const CYANITE_API_BASE = "https://api.cyanite.ai/graphql";

// Default timeout for API requests (60 seconds for analysis)
const DEFAULT_TIMEOUT_MS = 60000;

/**
 * Fetch wrapper with timeout support
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs / 1000} seconds.`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Check if Cyanite API is configured
 */
export function isCyaniteConfigured(): boolean {
  return !!import.meta.env.VITE_CYANITE_API_KEY;
}

/**
 * Get API key or throw
 */
function getApiKey(): string {
  const apiKey = import.meta.env.VITE_CYANITE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Cyanite API key not configured. Please add VITE_CYANITE_API_KEY to your environment.",
    );
  }
  return apiKey;
}

/**
 * Execute a GraphQL query against Cyanite API
 */
async function executeGraphQL<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const apiKey = getApiKey();

  const response = await fetchWithTimeout(CYANITE_API_BASE, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Cyanite API error: ${response.status} ${response.statusText}`,
    );
  }

  const data = await response.json();

  if (data.errors) {
    throw new Error(`Cyanite GraphQL error: ${JSON.stringify(data.errors)}`);
  }

  return data.data as T;
}

/**
 * Audio analysis result from Cyanite
 */
export interface CyaniteAnalysisResult {
  bpm: number;
  key: string;
  keyConfidence: number;
  genres: Array<{ name: string; confidence: number }>;
  moods: Array<{ name: string; confidence: number }>;
  energy: number;
  valence: number; // Musical positivity
  danceability: number;
  instrumentalness: number;
  acousticness: number;
  speechiness: number;
  segments?: Array<{
    start: number;
    duration: number;
    energy: number;
    mood: string;
  }>;
}

/**
 * Request a file upload URL from Cyanite
 */
async function requestUploadUrl(): Promise<{
  uploadUrl: string;
  fileId: string;
}> {
  const query = `
    mutation FileUploadRequest {
      fileUploadRequest {
        ... on FileUploadRequest {
          id
          uploadUrl
        }
        ... on FileUploadRequestError {
          message
        }
      }
    }
  `;

  const result = await executeGraphQL<{
    fileUploadRequest: {
      id?: string;
      uploadUrl?: string;
      message?: string;
    };
  }>(query);

  if (result.fileUploadRequest.message) {
    throw new Error(
      `Upload request failed: ${result.fileUploadRequest.message}`,
    );
  }

  const { uploadUrl, id } = result.fileUploadRequest;
  if (!uploadUrl || !id) {
    throw new Error("Upload request failed: Missing upload URL or file ID");
  }

  return { uploadUrl, fileId: id };
}

/**
 * Upload file to Cyanite's storage
 */
async function uploadFile(uploadUrl: string, file: File | Blob): Promise<void> {
  const response = await fetchWithTimeout(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type || "audio/mpeg",
    },
    body: file,
  });

  if (!response.ok) {
    throw new Error(`File upload failed: ${response.status}`);
  }
}

/**
 * Create a library track from uploaded file
 */
async function createLibraryTrack(
  fileId: string,
  title: string,
): Promise<string> {
  const query = `
    mutation LibraryTrackCreate($input: LibraryTrackCreateInput!) {
      libraryTrackCreate(input: $input) {
        ... on LibraryTrackCreateSuccess {
          createdLibraryTrack {
            id
          }
        }
        ... on LibraryTrackCreateError {
          message
        }
      }
    }
  `;

  const result = await executeGraphQL<{
    libraryTrackCreate: {
      createdLibraryTrack?: { id: string };
      message?: string;
    };
  }>(query, {
    input: {
      uploadId: fileId,
      title,
    },
  });

  if (result.libraryTrackCreate.message) {
    throw new Error(
      `Track creation failed: ${result.libraryTrackCreate.message}`,
    );
  }

  const trackId = result.libraryTrackCreate.createdLibraryTrack?.id;
  if (!trackId) {
    throw new Error("Track creation failed: No track ID returned");
  }

  return trackId;
}

/**
 * Enqueue track for analysis
 */
async function enqueueAnalysis(trackId: string): Promise<void> {
  const query = `
    mutation LibraryTrackEnqueue($input: LibraryTrackEnqueueInput!) {
      libraryTrackEnqueue(input: $input) {
        ... on LibraryTrackEnqueueSuccess {
          enqueuedLibraryTrack {
            id
          }
        }
        ... on LibraryTrackEnqueueError {
          message
        }
      }
    }
  `;

  const result = await executeGraphQL<{
    libraryTrackEnqueue: {
      enqueuedLibraryTrack?: { id: string };
      message?: string;
    };
  }>(query, {
    input: {
      libraryTrackId: trackId,
    },
  });

  if (result.libraryTrackEnqueue.message) {
    throw new Error(
      `Analysis enqueue failed: ${result.libraryTrackEnqueue.message}`,
    );
  }
}

/**
 * Poll for analysis results
 */
async function getAnalysisResult(
  trackId: string,
  maxAttempts: number = 30,
  intervalMs: number = 2000,
): Promise<CyaniteAnalysisResult> {
  const query = `
    query LibraryTrack($id: ID!) {
      libraryTrack(id: $id) {
        ... on LibraryTrack {
          id
          audioAnalysisV6 {
            ... on AudioAnalysisV6Finished {
              result {
                bpmPrediction {
                  value
                  confidence
                }
                keyPrediction {
                  value
                  confidence
                }
                genreTags {
                  ... on GenreTag {
                    genre
                    score
                  }
                }
                moodTags {
                  ... on MoodTag {
                    mood
                    score
                  }
                }
                energyLevel
                emotionalProfile {
                  valence
                }
                voicePresenceProfile {
                  instrumental
                }
                segments {
                  start
                  duration
                  energy
                }
              }
            }
            ... on AudioAnalysisV6Enqueued {
              __typename
            }
            ... on AudioAnalysisV6Processing {
              __typename
            }
            ... on AudioAnalysisV6Failed {
              error {
                message
              }
            }
          }
        }
      }
    }
  `;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = await executeGraphQL<{
      libraryTrack: {
        audioAnalysisV6: {
          __typename?: string;
          result?: {
            bpmPrediction: { value: number; confidence: number };
            keyPrediction: { value: string; confidence: number };
            genreTags: Array<{ genre: string; score: number }>;
            moodTags: Array<{ mood: string; score: number }>;
            energyLevel: number;
            emotionalProfile: { valence: number };
            voicePresenceProfile: { instrumental: number };
            segments: Array<{
              start: number;
              duration: number;
              energy: number;
            }>;
          };
          error?: { message: string };
        };
      };
    }>(query, { id: trackId });

    const analysis = result.libraryTrack.audioAnalysisV6;

    if (analysis.error) {
      throw new Error(`Analysis failed: ${analysis.error.message}`);
    }

    if (analysis.result) {
      const r = analysis.result;
      return {
        bpm: r.bpmPrediction.value,
        key: r.keyPrediction.value,
        keyConfidence: r.keyPrediction.confidence,
        genres: r.genreTags.map((g) => ({
          name: g.genre,
          confidence: g.score,
        })),
        moods: r.moodTags.map((m) => ({ name: m.mood, confidence: m.score })),
        energy: r.energyLevel,
        valence: r.emotionalProfile.valence,
        danceability: r.energyLevel, // Approximation
        instrumentalness: r.voicePresenceProfile.instrumental,
        acousticness: 0.5, // Not provided by Cyanite v6
        speechiness: 1 - r.voicePresenceProfile.instrumental,
        segments: r.segments.map((s) => ({
          start: s.start,
          duration: s.duration,
          energy: s.energy,
          mood: r.moodTags[0]?.mood || "neutral",
        })),
      };
    }

    // Still processing, wait and retry
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error("Analysis timed out. Please try again.");
}

/**
 * Analyze an audio file using Cyanite
 * Full pipeline: upload -> create track -> analyze -> return results
 */
export async function analyzeAudioFile(
  file: File,
  onProgress?: (status: string) => void,
): Promise<CyaniteAnalysisResult> {
  onProgress?.("Requesting upload URL...");
  const { uploadUrl, fileId } = await requestUploadUrl();

  onProgress?.("Uploading audio file...");
  await uploadFile(uploadUrl, file);

  onProgress?.("Creating track...");
  const trackId = await createLibraryTrack(fileId, file.name);

  onProgress?.("Starting analysis...");
  await enqueueAnalysis(trackId);

  onProgress?.("Analyzing audio (this may take a moment)...");
  const result = await getAnalysisResult(trackId);

  onProgress?.("Analysis complete!");
  return result;
}

/**
 * Analyze audio from base64 data
 * Convenience wrapper that creates a blob from base64
 */
export async function analyzeAudioBase64(
  base64Data: string,
  mimeType: string,
  fileName: string = "audio.mp3",
  onProgress?: (status: string) => void,
): Promise<CyaniteAnalysisResult> {
  // Convert base64 to blob
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: mimeType });
  const file = new File([blob], fileName, { type: mimeType });

  return analyzeAudioFile(file, onProgress);
}

/**
 * Convert Cyanite result to AudioAnalyzer component format
 */
export function toAudioAnalysisResult(
  cyaniteResult: CyaniteAnalysisResult,
): AudioAnalysisResult {
  // Get top genre
  const topGenre =
    cyaniteResult.genres.sort((a, b) => b.confidence - a.confidence)[0]?.name ||
    "Unknown";

  // Get top mood
  const topMood =
    cyaniteResult.moods.sort((a, b) => b.confidence - a.confidence)[0]?.name ||
    "Neutral";

  // Generate production feedback based on analysis
  const feedback = generateProductionFeedback(cyaniteResult);

  return {
    bpm: Math.round(cyaniteResult.bpm).toString(),
    key: cyaniteResult.key,
    genre: topGenre,
    chords: [], // Cyanite doesn't provide chord detection
    productionFeedback: feedback,
    mood: topMood,
  };
}

/**
 * Generate production feedback based on analysis results
 */
function generateProductionFeedback(result: CyaniteAnalysisResult): string {
  const feedbackParts: string[] = [];

  // BPM feedback
  if (result.bpm < 80) {
    feedbackParts.push("Slow tempo suitable for ballads or ambient tracks.");
  } else if (result.bpm < 120) {
    feedbackParts.push("Moderate tempo, works well for pop or R&B.");
  } else if (result.bpm < 140) {
    feedbackParts.push("Upbeat tempo, great for dance or electronic music.");
  } else {
    feedbackParts.push(
      "High energy tempo, ideal for EDM or fast-paced tracks.",
    );
  }

  // Energy feedback
  if (result.energy < 0.3) {
    feedbackParts.push(
      "Low energy track - consider adding dynamics or percussion to lift it.",
    );
  } else if (result.energy > 0.7) {
    feedbackParts.push(
      "High energy production - ensure you have dynamic contrast in quieter sections.",
    );
  }

  // Instrumentalness feedback
  if (result.instrumentalness > 0.8) {
    feedbackParts.push(
      "Highly instrumental track - vocals could add emotional connection if desired.",
    );
  } else if (result.instrumentalness < 0.2) {
    feedbackParts.push(
      "Vocal-heavy track - ensure instrumental layers support without overwhelming vocals.",
    );
  }

  // Key confidence
  if (result.keyConfidence < 0.6) {
    feedbackParts.push(
      "Key detection has low confidence - track may have complex or ambiguous harmony.",
    );
  }

  // Genre suggestions
  const topGenres = result.genres
    .filter((g) => g.confidence > 0.3)
    .slice(0, 3)
    .map((g) => g.name);
  if (topGenres.length > 1) {
    feedbackParts.push(
      `Cross-genre elements detected: ${topGenres.join(", ")}.`,
    );
  }

  return feedbackParts.join(" ");
}

/**
 * Quick BPM detection (using full analysis)
 */
export async function detectBPM(file: File): Promise<number> {
  const result = await analyzeAudioFile(file);
  return result.bpm;
}

/**
 * Quick key detection (using full analysis)
 */
export async function detectKey(file: File): Promise<string> {
  const result = await analyzeAudioFile(file);
  return result.key;
}
