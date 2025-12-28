/**
 * MusicGen Service
 * Uses Meta's MusicGen model (via Replicate API) for AI music generation
 * with melody conditioning support.
 *
 * MusicGen can generate music from text prompts and optionally condition
 * on a melody input to maintain musical coherence during style transitions.
 */

const REPLICATE_API_BASE = "https://api.replicate.com/v1";

// MusicGen model on Replicate - stereo-melody version supports melody conditioning
const MUSICGEN_MODEL =
  "meta/musicgen:671ac645ce5e552cc63a54a2bbff63fcf798043ac92924f3aa7f66f0690062a5";

/**
 * Check if MusicGen is configured (uses same API key as stem separation)
 */
export function isMusicGenConfigured(): boolean {
  return !!import.meta.env.VITE_REPLICATE_API_KEY;
}

/**
 * Get API key or return null
 */
function getApiKey(): string | null {
  return import.meta.env.VITE_REPLICATE_API_KEY || null;
}

/**
 * MusicGen input parameters
 */
export interface MusicGenInput {
  prompt: string;
  duration?: number; // 1-30 seconds, default 8
  model_version?: "stereo-melody" | "stereo-large" | "melody" | "large";
  melody?: string; // URL to melody audio for conditioning
  continuation?: boolean;
  continuation_start?: number;
  continuation_end?: number;
  normalization_strategy?: "loudness" | "clip" | "peak" | "rms";
  top_k?: number;
  top_p?: number;
  temperature?: number;
  classifier_free_guidance?: number;
  output_format?: "wav" | "mp3";
  seed?: number;
}

/**
 * Replicate prediction response
 */
interface ReplicatePrediction {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: string; // URL to generated audio
  error?: string;
  urls: {
    get: string;
    cancel: string;
  };
  logs?: string;
}

/**
 * MusicGen generation result
 */
export interface MusicGenResult {
  audioUrl: string;
  audioBlob: Blob;
  duration: number;
  prompt: string;
}

/**
 * Progress callback type
 */
export type MusicGenProgressCallback = (
  status: string,
  progress?: number
) => void;

/**
 * Start a MusicGen prediction on Replicate
 */
async function startPrediction(
  input: MusicGenInput
): Promise<ReplicatePrediction> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error(
      "Replicate API key not configured. Please add VITE_REPLICATE_API_KEY for music generation."
    );
  }

  const response = await fetch(`${REPLICATE_API_BASE}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      version: MUSICGEN_MODEL.split(":")[1],
      input: {
        prompt: input.prompt,
        duration: input.duration || 8,
        model_version: input.model_version || "stereo-large",
        ...(input.melody && { melody: input.melody }),
        ...(input.continuation !== undefined && {
          continuation: input.continuation,
        }),
        ...(input.continuation_start !== undefined && {
          continuation_start: input.continuation_start,
        }),
        ...(input.continuation_end !== undefined && {
          continuation_end: input.continuation_end,
        }),
        normalization_strategy: input.normalization_strategy || "loudness",
        top_k: input.top_k || 250,
        top_p: input.top_p || 0,
        temperature: input.temperature || 1,
        classifier_free_guidance: input.classifier_free_guidance || 3,
        output_format: input.output_format || "wav",
        ...(input.seed !== undefined && { seed: input.seed }),
      },
    }),
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as {
      detail?: string;
    };
    throw new Error(
      `Failed to start music generation: ${error.detail || response.statusText}`
    );
  }

  return response.json();
}

/**
 * Poll for prediction completion
 */
async function pollPrediction(
  predictionUrl: string,
  maxAttempts: number = 120, // 10 minutes max (5s intervals)
  intervalMs: number = 5000,
  onProgress?: MusicGenProgressCallback
): Promise<ReplicatePrediction> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("Replicate API key not configured.");
  }

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await fetch(predictionUrl, {
      headers: {
        Authorization: `Token ${apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to check status: ${response.statusText}`);
    }

    const prediction: ReplicatePrediction = await response.json();

    // Calculate progress based on attempts (rough estimate)
    const progressPercent = Math.min(
      90,
      20 + Math.floor((attempt / maxAttempts) * 70)
    );
    onProgress?.(
      `Generating music (${prediction.status})...`,
      progressPercent
    );

    if (prediction.status === "succeeded") {
      return prediction;
    }

    if (prediction.status === "failed") {
      throw new Error(
        `Music generation failed: ${prediction.error || "Unknown error"}`
      );
    }

    if (prediction.status === "canceled") {
      throw new Error("Music generation was canceled.");
    }

    // Still processing, wait and retry
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error("Music generation timed out. Please try again.");
}

/**
 * Convert a File to a data URL for upload
 */
async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Fetch audio from URL and convert to Blob
 */
async function fetchAudioBlob(url: string): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch audio: ${response.statusText}`);
  }
  return response.blob();
}

/**
 * Generate music from a text prompt
 */
export async function generateMusic(
  prompt: string,
  duration: number = 15,
  onProgress?: MusicGenProgressCallback
): Promise<MusicGenResult> {
  onProgress?.("Starting music generation...", 5);

  const prediction = await startPrediction({
    prompt,
    duration: Math.min(30, Math.max(1, duration)), // Clamp to 1-30
    model_version: "stereo-large",
    output_format: "wav",
  });

  onProgress?.("Processing...", 15);
  const result = await pollPrediction(prediction.urls.get, 120, 5000, onProgress);

  onProgress?.("Downloading generated audio...", 95);
  const audioBlob = await fetchAudioBlob(result.output as string);

  onProgress?.("Complete!", 100);

  return {
    audioUrl: result.output as string,
    audioBlob,
    duration,
    prompt,
  };
}

/**
 * Generate music with melody conditioning
 * The generated music will follow the melodic contour of the input audio
 */
export async function generateWithMelodyConditioning(
  melodyAudio: File | string, // File or URL
  prompt: string,
  duration: number = 15,
  onProgress?: MusicGenProgressCallback
): Promise<MusicGenResult> {
  onProgress?.("Preparing melody audio...", 5);

  // Get melody URL
  let melodyUrl: string;
  if (typeof melodyAudio === "string") {
    melodyUrl = melodyAudio;
  } else {
    melodyUrl = await fileToDataUrl(melodyAudio);
  }

  onProgress?.("Starting melody-conditioned generation...", 10);

  const prediction = await startPrediction({
    prompt,
    duration: Math.min(30, Math.max(1, duration)),
    model_version: "stereo-melody", // Use melody model for conditioning
    melody: melodyUrl,
    output_format: "wav",
  });

  onProgress?.("Processing with melody conditioning...", 20);
  const result = await pollPrediction(prediction.urls.get, 120, 5000, onProgress);

  onProgress?.("Downloading generated audio...", 95);
  const audioBlob = await fetchAudioBlob(result.output as string);

  onProgress?.("Complete!", 100);

  return {
    audioUrl: result.output as string,
    audioBlob,
    duration,
    prompt,
  };
}

/**
 * Generate a style continuation
 * Uses the end of the input audio to condition the generation
 */
export async function generateStyleContinuation(
  sourceAudio: File | string,
  targetStylePrompt: string,
  duration: number = 15,
  continuationStart?: number, // Start time in source for continuation context
  onProgress?: MusicGenProgressCallback
): Promise<MusicGenResult> {
  onProgress?.("Preparing source audio for continuation...", 5);

  let audioUrl: string;
  if (typeof sourceAudio === "string") {
    audioUrl = sourceAudio;
  } else {
    audioUrl = await fileToDataUrl(sourceAudio);
  }

  onProgress?.("Starting style continuation...", 10);

  const prediction = await startPrediction({
    prompt: targetStylePrompt,
    duration: Math.min(30, Math.max(1, duration)),
    model_version: "stereo-melody",
    melody: audioUrl,
    continuation: true,
    ...(continuationStart !== undefined && {
      continuation_start: continuationStart,
    }),
    output_format: "wav",
  });

  onProgress?.("Generating continuation...", 20);
  const result = await pollPrediction(prediction.urls.get, 120, 5000, onProgress);

  onProgress?.("Downloading generated audio...", 95);
  const audioBlob = await fetchAudioBlob(result.output as string);

  onProgress?.("Complete!", 100);

  return {
    audioUrl: result.output as string,
    audioBlob,
    duration,
    prompt: targetStylePrompt,
  };
}

/**
 * Build an intelligent prompt for style transition
 */
export function buildStyleTransitionPrompt(
  sourceAnalysis: {
    bpm?: number;
    key?: string;
    genre?: string;
    mood?: string;
  },
  targetGenre: string
): string {
  const parts: string[] = [];

  // Target genre
  parts.push(targetGenre);

  // Maintain BPM if known
  if (sourceAnalysis.bpm) {
    parts.push(`at ${Math.round(sourceAnalysis.bpm)} BPM`);
  }

  // Maintain key if known
  if (sourceAnalysis.key) {
    parts.push(`in ${sourceAnalysis.key}`);
  }

  // Add transition context
  if (sourceAnalysis.genre && sourceAnalysis.genre !== targetGenre) {
    parts.push(`transitioning from ${sourceAnalysis.genre}`);
  }

  // Add mood for continuity
  if (sourceAnalysis.mood) {
    parts.push(`with ${sourceAnalysis.mood} energy`);
  }

  // Add quality modifiers
  parts.push("professional quality, smooth transition, musical coherence");

  return parts.join(", ");
}

/**
 * Get MusicGen service status
 */
export function getMusicGenStatus(): {
  available: boolean;
  message: string;
} {
  if (isMusicGenConfigured()) {
    return {
      available: true,
      message: "AI music generation available via MusicGen (Replicate)",
    };
  }

  return {
    available: false,
    message:
      "Add VITE_REPLICATE_API_KEY to enable AI music generation with MusicGen.",
  };
}

/**
 * Estimate generation time based on duration
 */
export function estimateGenerationTime(durationSeconds: number): string {
  // MusicGen typically takes 30 seconds to 2 minutes depending on duration
  const estimatedMinutes = Math.max(0.5, Math.ceil(durationSeconds / 15));
  if (estimatedMinutes < 1) {
    return "~30-60 seconds";
  }
  return `~${estimatedMinutes}-${estimatedMinutes + 1} minutes`;
}
