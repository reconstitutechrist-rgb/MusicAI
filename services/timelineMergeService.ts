import { GoogleGenAI, Type } from "@google/genai";
import {
  MergeAnalysisResponse,
  LibrarySong,
  TimelineClip,
  CrossfadeRegion,
  MergePlan,
  MergeSuggestion,
} from "../types/timeline";
import { AudioAnalysisResult } from "../types";

let ai: GoogleGenAI;

// Get API key from environment
const getApiKey = (): string => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey || typeof apiKey !== "string") {
    throw new Error(
      "VITE_GEMINI_API_KEY environment variable not set. Please add it to your .env file.",
    );
  }
  return apiKey;
};

// Safe JSON parse helper
const safeJsonParse = <T>(text: string, errorContext: string): T => {
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    const parseError =
      error instanceof Error ? error.message : "Unknown parse error";
    throw new Error(
      `Failed to parse AI response for ${errorContext}: ${parseError}. Response text: ${text.substring(0, 200)}...`,
    );
  }
};

const getAi = () => {
  if (!ai) {
    ai = new GoogleGenAI({ apiKey: getApiKey() });
  }
  return ai;
};

// Timeout wrapper for API calls
const generateWithTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number = 90000,
): Promise<T> => {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error("Request timed out. Please try again.")),
      timeoutMs,
    ),
  );
  return Promise.race([promise, timeout]);
};

/**
 * Analyzes multiple songs for merge compatibility
 * Returns compatibility score, recommended order, and crossfade suggestions
 */
export async function analyzeSongsForMerge(
  songs: Array<{
    id: string;
    title: string;
    style: string;
    analysis: AudioAnalysisResult | null;
  }>,
  userDescription: string,
): Promise<MergeAnalysisResponse> {
  const ai = getAi();

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      compatibility: {
        type: Type.OBJECT,
        properties: {
          score: {
            type: Type.NUMBER,
            description: "Overall compatibility score from 0-100",
          },
          keyCompatibility: {
            type: Type.STRING,
            description: "Description of key relationship",
          },
          bpmDifference: {
            type: Type.NUMBER,
            description: "Average BPM difference between songs",
          },
          recommendedOrder: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Recommended playback order (array of song IDs)",
          },
        },
        required: [
          "score",
          "keyCompatibility",
          "bpmDifference",
          "recommendedOrder",
        ],
      },
      suggestedCrossfades: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            fromSongId: { type: Type.STRING },
            toSongId: { type: Type.STRING },
            recommendedDuration: {
              type: Type.NUMBER,
              description: "Crossfade duration in seconds (2-8)",
            },
            transitionType: {
              type: Type.STRING,
              description:
                "Type of transition: smooth, energetic, dramatic, subtle",
            },
            reasoning: {
              type: Type.STRING,
              description: "Brief explanation for this transition",
            },
          },
          required: [
            "fromSongId",
            "toSongId",
            "recommendedDuration",
            "transitionType",
          ],
        },
      },
      transitionPrompts: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            clipAId: { type: Type.STRING },
            clipBId: { type: Type.STRING },
            prompt: {
              type: Type.STRING,
              description:
                "Detailed prompt for generating AI transition audio between the songs",
            },
          },
          required: ["clipAId", "clipBId", "prompt"],
        },
      },
    },
    required: ["compatibility", "suggestedCrossfades", "transitionPrompts"],
  };

  const songDescriptions = songs
    .map((song, i) => {
      const analysis = song.analysis;
      return `Song ${i + 1}: "${song.title}"
- Style: ${song.style}
- BPM: ${analysis?.bpm || "Unknown"}
- Key: ${analysis?.key || "Unknown"}
- Genre: ${analysis?.genre || "Unknown"}
- Mood: ${analysis?.mood || "Unknown"}
- ID: ${song.id}`;
    })
    .join("\n\n");

  const prompt = `You are an expert DJ and music producer. Analyze these ${songs.length} songs for creating a seamless medley mix.

User's desired outcome: "${userDescription || "Create a smooth, professional medley"}"

Songs to merge:
${songDescriptions}

Analyze the songs and provide:
1. Overall compatibility score (0-100) based on key compatibility, tempo similarity, and mood alignment
2. Key compatibility analysis (e.g., "Compatible - relative minor", "Challenging - distant keys")
3. Average BPM difference between consecutive songs
4. Recommended playback order for the best musical flow
5. For each transition between songs:
   - Recommended crossfade duration (2-8 seconds based on tempo and energy)
   - Transition type (smooth, energetic, dramatic, subtle)
   - Brief reasoning
6. For each transition, provide a detailed audio generation prompt that describes what instrumental bridge should be generated. Include:
   - The tempo and feel
   - Musical elements (drums, bass, synths, etc.)
   - How it should connect the outgoing and incoming songs
   - Duration and energy arc`;

  try {
    const result = await generateWithTimeout(
      ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema,
        },
      }),
      90000,
    );

    const text = result.text?.trim();
    if (!text) {
      throw new Error("Empty response from AI");
    }

    return safeJsonParse<MergeAnalysisResponse>(text, "merge analysis");
  } catch (error) {
    console.error("Failed to analyze songs for merge:", error);
    throw error;
  }
}

/**
 * Generate suggestions based on current timeline state
 */
export async function generateMergeSuggestions(
  clips: TimelineClip[],
  crossfades: CrossfadeRegion[],
): Promise<MergeSuggestion[]> {
  if (clips.length < 2) return [];

  const ai = getAi();

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      suggestions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            type: {
              type: Type.STRING,
              description: "reorder, crossfade, trim, key-match, bpm-match",
            },
            description: { type: Type.STRING },
            confidence: { type: Type.NUMBER, description: "0-100" },
            clipIds: { type: Type.ARRAY, items: { type: Type.STRING } },
            suggestedValue: {
              type: Type.STRING,
              description: "Optional suggested value",
            },
          },
          required: ["type", "description", "confidence", "clipIds"],
        },
      },
    },
    required: ["suggestions"],
  };

  const clipsDescription = clips
    .map((clip, i) => {
      return `Clip ${i + 1}: "${clip.songTitle}" at ${clip.startTime.toFixed(1)}s
- Duration: ${(clip.duration - clip.trimStart - clip.trimEnd).toFixed(1)}s
- BPM: ${clip.analysis?.bpm || "Unknown"}, Key: ${clip.analysis?.key || "Unknown"}
- ID: ${clip.id}`;
    })
    .join("\n");

  const crossfadesDescription = crossfades
    .map((cf, i) => {
      return `Crossfade ${i + 1}: ${cf.duration.toFixed(1)}s, Curve: ${cf.curveType}`;
    })
    .join("\n");

  const prompt = `Analyze this medley timeline and suggest improvements:

Current Clips:
${clipsDescription}

Current Crossfades:
${crossfadesDescription}

Provide suggestions for:
1. Better song ordering for improved flow
2. Optimal crossfade durations based on tempo and energy
3. Trim suggestions to start/end at better points (e.g., after intros, before outros)
4. Key matching opportunities (transposing)
5. BPM matching opportunities (time-stretching)

Only suggest changes that would significantly improve the mix. Be specific about which clips are affected.`;

  try {
    const result = await generateWithTimeout(
      ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema,
        },
      }),
      60000,
    );

    const text = result.text?.trim();
    if (!text) return [];

    const parsed = safeJsonParse<{ suggestions: MergeSuggestion[] }>(
      text,
      "suggestions",
    );
    return parsed.suggestions.map((s, i) => ({
      ...s,
      id: `suggestion-${Date.now()}-${i}`,
    }));
  } catch (error) {
    console.error("Failed to generate suggestions:", error);
    return [];
  }
}

/**
 * Generate a complete auto-merge plan from a user description
 */
export async function generateAutoMergePlan(
  songs: LibrarySong[],
  userDescription: string,
): Promise<{
  orderedSongIds: string[];
  crossfadeDurations: number[];
  transitionPrompts: string[];
}> {
  if (songs.length < 2) {
    return {
      orderedSongIds: songs.map((s) => s.id),
      crossfadeDurations: [],
      transitionPrompts: [],
    };
  }

  // First, analyze all songs for merge compatibility
  const analysis = await analyzeSongsForMerge(
    songs.map((s) => ({
      id: s.id,
      title: s.title,
      style: s.style,
      analysis: s.analysis || null,
    })),
    userDescription,
  );

  // Extract ordered song IDs from analysis
  const orderedSongIds =
    analysis.compatibility.recommendedOrder.length === songs.length
      ? analysis.compatibility.recommendedOrder
      : songs.map((s) => s.id);

  // Extract crossfade durations for each transition
  const crossfadeDurations = analysis.suggestedCrossfades.map(
    (cf) => cf.recommendedDuration,
  );

  // Extract transition prompts
  const transitionPrompts = analysis.transitionPrompts.map((tp) => tp.prompt);

  return {
    orderedSongIds,
    crossfadeDurations,
    transitionPrompts,
  };
}

/**
 * Generate transition audio prompt for a specific crossfade
 */
export function generateTransitionPrompt(
  clipA: TimelineClip,
  clipB: TimelineClip,
  crossfadeDuration: number,
): string {
  const bpmA = clipA.analysis?.bpm || 120;
  const bpmB = clipB.analysis?.bpm || 120;
  const avgBpm = (bpmA + bpmB) / 2;

  const keyA = clipA.analysis?.key || "C";
  const keyB = clipB.analysis?.key || "C";

  const moodA = clipA.analysis?.mood || "energetic";
  const moodB = clipB.analysis?.mood || "energetic";

  return `Create a ${crossfadeDuration.toFixed(1)} second musical transition bridge.

Outgoing song: "${clipA.songTitle}"
- Tempo: ${bpmA} BPM
- Key: ${keyA}
- Mood: ${moodA}

Incoming song: "${clipB.songTitle}"
- Tempo: ${bpmB} BPM
- Key: ${keyB}
- Mood: ${moodB}

Generate an instrumental transition that:
1. Starts at approximately ${bpmA} BPM and smoothly transitions to ${bpmB} BPM
2. Bridges the key change from ${keyA} to ${keyB}
3. Uses drum fills, risers, or sweeps appropriate for the genres
4. Creates a natural energy arc from ${moodA} to ${moodB}
5. Includes tension-building elements like filter sweeps or impacts
6. Duration: exactly ${crossfadeDuration.toFixed(1)} seconds at ~${avgBpm.toFixed(0)} average BPM

The transition should feel like a professional DJ mix, maintaining the groove while smoothly introducing the next song.`;
}

/**
 * Estimate compatibility between two songs based on their analysis
 * Quick local calculation without API call
 */
export function estimateCompatibility(
  analysisA: AudioAnalysisResult | null,
  analysisB: AudioAnalysisResult | null,
): {
  score: number;
  bpmCompatibility: string;
  keyCompatibility: string;
} {
  if (!analysisA || !analysisB) {
    return {
      score: 50,
      bpmCompatibility: "Unknown",
      keyCompatibility: "Unknown",
    };
  }

  const bpmA = parseFloat(analysisA.bpm) || 120;
  const bpmB = parseFloat(analysisB.bpm) || 120;
  const bpmDiff = Math.abs(bpmA - bpmB);

  // BPM compatibility (within 10 BPM is good, 20 is okay, beyond is challenging)
  let bpmScore = 100;
  let bpmCompatibility = "Excellent";
  if (bpmDiff > 20) {
    bpmScore = 40;
    bpmCompatibility = "Challenging - significant tempo difference";
  } else if (bpmDiff > 10) {
    bpmScore = 70;
    bpmCompatibility = "Good - moderate tempo adjustment needed";
  } else if (bpmDiff > 5) {
    bpmScore = 90;
    bpmCompatibility = "Very good - minor tempo difference";
  }

  // Key compatibility (simplified)
  const keyA = analysisA.key?.toUpperCase() || "C";
  const keyB = analysisB.key?.toUpperCase() || "C";

  let keyScore = 70;
  let keyCompatibility = "Moderate";

  if (keyA === keyB) {
    keyScore = 100;
    keyCompatibility = "Perfect - same key";
  } else if (
    // Relative major/minor (simplified)
    (keyA.includes("M") && keyB.includes("m")) ||
    (keyA.includes("m") && keyB.includes("M"))
  ) {
    keyScore = 90;
    keyCompatibility = "Excellent - relative major/minor";
  }

  // Overall score weighted average
  const score = Math.round(bpmScore * 0.6 + keyScore * 0.4);

  return {
    score,
    bpmCompatibility,
    keyCompatibility,
  };
}
