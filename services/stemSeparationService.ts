/**
 * Stem Separation Service
 * Uses Demucs (via Replicate API) for high-quality stem separation
 *
 * Demucs is Meta's state-of-the-art music source separation model.
 *
 * Note: For fully client-side separation, you could use spleeter.js or
 * a WASM port of Demucs, but these have significant size/performance tradeoffs.
 * This implementation uses Replicate's hosted Demucs for best quality.
 */

const REPLICATE_API_BASE = "https://api.replicate.com/v1";

// Demucs model versions on Replicate
const DEMUCS_MODEL =
  "cjwbw/demucs:25a173108cff36ef9f80f854c162d01df9e6528be175794b81571db6c64ee6bb";

/**
 * Check if stem separation is configured
 * Uses Replicate API key (optional feature)
 */
export function isStemSeparationConfigured(): boolean {
  return !!import.meta.env.VITE_REPLICATE_API_KEY;
}

/**
 * Get API key or return null (graceful degradation)
 */
function getApiKey(): string | null {
  return import.meta.env.VITE_REPLICATE_API_KEY || null;
}

/**
 * Stem separation output types
 */
export interface StemSeparationResult {
  vocals: string; // URL to vocals track
  drums: string; // URL to drums track
  bass: string; // URL to bass track
  other: string; // URL to other instruments track
  originalName: string;
}

/**
 * Four-stem separation (vocals, drums, bass, other)
 */
export type FourStemOutput = {
  vocals: string;
  drums: string;
  bass: string;
  other: string;
};

/**
 * Two-stem separation (vocals, instrumental)
 */
export type TwoStemOutput = {
  vocals: string;
  instrumental: string;
};

interface ReplicatePrediction {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: string[] | Record<string, string>;
  error?: string;
  urls: {
    get: string;
    cancel: string;
  };
}

/**
 * Start a stem separation job on Replicate
 */
async function startSeparation(audioUrl: string): Promise<ReplicatePrediction> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error(
      "Replicate API key not configured. Please add VITE_REPLICATE_API_KEY for stem separation.",
    );
  }

  const response = await fetch(`${REPLICATE_API_BASE}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      version: DEMUCS_MODEL.split(":")[1],
      input: {
        audio: audioUrl,
        // Default: htdemucs_ft (fine-tuned, best quality)
        model: "htdemucs_ft",
        // Output all 4 stems
        output_format: "mp3",
        mp3_bitrate: 320,
      },
    }),
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as {
      detail?: string;
    };
    throw new Error(
      `Failed to start separation: ${error.detail || response.statusText}`,
    );
  }

  return response.json();
}

/**
 * Poll for separation completion
 */
async function pollPrediction(
  predictionUrl: string,
  maxAttempts: number = 60,
  intervalMs: number = 5000,
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

    if (prediction.status === "succeeded") {
      return prediction;
    }

    if (prediction.status === "failed") {
      throw new Error(
        `Separation failed: ${prediction.error || "Unknown error"}`,
      );
    }

    if (prediction.status === "canceled") {
      throw new Error("Separation was canceled.");
    }

    // Still processing, wait and retry
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error("Separation timed out. Please try again.");
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
 * Separate audio into 4 stems (vocals, drums, bass, other)
 * Uses Replicate's hosted Demucs model
 */
export async function separateStems(
  audioFile: File | string, // File object or URL
  onProgress?: (status: string, progress?: number) => void,
): Promise<StemSeparationResult> {
  onProgress?.("Preparing audio...", 0);

  // Get audio URL
  let audioUrl: string;
  if (typeof audioFile === "string") {
    audioUrl = audioFile;
  } else {
    // For files, we need to convert to data URL
    // Note: For large files, you'd want to upload to a temp storage first
    audioUrl = await fileToDataUrl(audioFile);
  }

  onProgress?.("Starting stem separation...", 10);
  const prediction = await startSeparation(audioUrl);

  onProgress?.("Separating stems (this may take 1-3 minutes)...", 20);
  const result = await pollPrediction(prediction.urls.get);

  onProgress?.("Processing complete!", 100);

  // Parse output - Demucs returns URLs to each stem
  const output = result.output as Record<string, string>;

  return {
    vocals: output.vocals || "",
    drums: output.drums || "",
    bass: output.bass || "",
    other: output.other || "",
    originalName: typeof audioFile === "string" ? "audio" : audioFile.name,
  };
}

/**
 * Isolate vocals from a track
 * Returns just the vocals track
 */
export async function isolateVocals(
  audioFile: File | string,
  onProgress?: (status: string, progress?: number) => void,
): Promise<string> {
  const result = await separateStems(audioFile, onProgress);
  return result.vocals;
}

/**
 * Get instrumental (everything except vocals)
 * Creates a mix of drums + bass + other
 */
export async function isolateInstrumental(
  audioFile: File | string,
  onProgress?: (status: string, progress?: number) => void,
): Promise<string> {
  // Note: Demucs separates into 4 stems. For instrumental,
  // you'd typically need to remix drums+bass+other.
  // Replicate's Demucs doesn't do this automatically,
  // so we return the "other" stem which contains non-vocal elements
  // For a proper instrumental, you'd need to mix the stems client-side.

  onProgress?.("Separating stems to create instrumental...", 0);
  const result = await separateStems(audioFile, (status, progress) => {
    onProgress?.(status, progress);
  });

  // Return the URLs for all non-vocal stems
  // Client will need to mix these together
  return JSON.stringify({
    drums: result.drums,
    bass: result.bass,
    other: result.other,
    message: "Mix these stems together for full instrumental",
  });
}

/**
 * Browser-based simple vocal removal using Web Audio API
 * This is a basic phase-cancellation technique - not as good as Demucs
 * but works without any API
 */
export async function simpleVocalRemoval(
  audioBuffer: AudioBuffer,
  audioContext: AudioContext,
): Promise<AudioBuffer> {
  // Phase cancellation: Invert center channel to remove vocals
  // Vocals are typically panned to center (same in L and R)

  const numberOfChannels = audioBuffer.numberOfChannels;
  if (numberOfChannels < 2) {
    console.warn("Mono audio - vocal removal requires stereo");
    return audioBuffer;
  }

  const length = audioBuffer.length;
  const sampleRate = audioBuffer.sampleRate;
  const outputBuffer = audioContext.createBuffer(2, length, sampleRate);

  const leftInput = audioBuffer.getChannelData(0);
  const rightInput = audioBuffer.getChannelData(1);
  const leftOutput = outputBuffer.getChannelData(0);
  const rightOutput = outputBuffer.getChannelData(1);

  // Basic center channel cancellation
  // Subtract the average (center) from each channel
  for (let i = 0; i < length; i++) {
    const center = (leftInput[i] + rightInput[i]) / 2;
    leftOutput[i] = leftInput[i] - center;
    rightOutput[i] = rightInput[i] - center;
  }

  return outputBuffer;
}

/**
 * Download a stem from URL
 */
export async function downloadStem(
  url: string,
  filename: string,
): Promise<void> {
  const response = await fetch(url);
  const blob = await response.blob();

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

/**
 * Estimate separation time based on audio duration
 */
export function estimateSeparationTime(durationSeconds: number): string {
  // Demucs typically takes 1-3 minutes depending on track length
  const estimatedMinutes = Math.max(1, Math.ceil(durationSeconds / 60));
  return `~${estimatedMinutes}-${estimatedMinutes + 2} minutes`;
}

/**
 * Feature availability check
 */
export function getStemSeparationStatus(): {
  available: boolean;
  method: "cloud" | "local" | "none";
  message: string;
} {
  if (isStemSeparationConfigured()) {
    return {
      available: true,
      method: "cloud",
      message: "High-quality stem separation available via Demucs (cloud)",
    };
  }

  return {
    available: true,
    method: "local",
    message:
      "Basic vocal removal available (local processing). Add VITE_REPLICATE_API_KEY for high-quality separation.",
  };
}
