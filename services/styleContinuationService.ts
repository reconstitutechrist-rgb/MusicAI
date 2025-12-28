/**
 * Style Continuation Service
 * Orchestrates the full workflow for style-inspired music continuation:
 * 1. Analyze intro audio (BPM, key, mood, genre)
 * 2. Optionally extract melody via stem separation
 * 3. Generate continuation in target genre using MusicGen
 * 4. Stitch intro + continuation with crossfade
 */

import {
  generateWithMelodyConditioning,
  generateStyleContinuation as musicGenContinue,
  buildStyleTransitionPrompt,
  isMusicGenConfigured,
  type MusicGenResult,
} from "./musicGenService";
import { analyzeAudioFile, isCyaniteConfigured } from "./cyaniteService";
import { separateStems, isStemSeparationConfigured } from "./stemSeparationService";
import { audioBufferToWav } from "../utils/audioBufferToWav";

/**
 * Analysis result from intro audio
 */
export interface ContinuationAnalysis {
  bpm: number;
  key: string;
  keyConfidence: number;
  genres: Array<{ name: string; confidence: number }>;
  moods: Array<{ name: string; confidence: number }>;
  energy: number;
  danceability: number;
}

/**
 * Request for creating a style continuation
 */
export interface ContinuationRequest {
  introAudioFile: File;
  introAudioUrl?: string;
  targetGenre: string;
  continuationDuration: number; // seconds (5-30)
  extractMelody: boolean;
  crossfadePreference: "auto" | "short" | "medium" | "long";
  customPromptAdditions?: string;
}

/**
 * Progress stages for continuation workflow
 */
export type ContinuationStage =
  | "idle"
  | "analyzing"
  | "extracting-melody"
  | "building-prompt"
  | "generating"
  | "stitching"
  | "complete"
  | "error";

/**
 * Progress callback data
 */
export interface ContinuationProgress {
  stage: ContinuationStage;
  progress: number; // 0-100
  message: string;
  substage?: string;
}

/**
 * Result from continuation workflow
 */
export interface ContinuationResult {
  analysis: ContinuationAnalysis;
  introAudioUrl: string;
  continuationAudioUrl: string;
  continuationBlob: Blob;
  mergedAudioUrl: string;
  mergedBlob: Blob;
  melodyUrl?: string;
  crossfadeDuration: number;
  prompt: string;
}

/**
 * Progress callback type
 */
export type ContinuationProgressCallback = (
  progress: ContinuationProgress
) => void;

/**
 * Available target genres for continuation
 */
export const TARGET_GENRES = [
  { id: "rock", label: "Rock", description: "Electric guitars, drums, powerful energy" },
  { id: "electronic", label: "Electronic", description: "Synths, beats, modern production" },
  { id: "hip-hop", label: "Hip-Hop", description: "Beats, bass, rhythmic flow" },
  { id: "jazz", label: "Jazz", description: "Improvisation, sophisticated harmony" },
  { id: "classical", label: "Classical", description: "Orchestral, timeless elegance" },
  { id: "country", label: "Country", description: "Acoustic, storytelling warmth" },
  { id: "reggae", label: "Reggae", description: "Offbeat rhythm, island vibes" },
  { id: "metal", label: "Metal", description: "Heavy guitars, intense energy" },
  { id: "indie", label: "Indie", description: "Alternative, authentic sound" },
  { id: "pop", label: "Pop", description: "Catchy, mainstream appeal" },
  { id: "r&b", label: "R&B", description: "Smooth, soulful grooves" },
  { id: "funk", label: "Funk", description: "Groovy bass, tight rhythm" },
  { id: "blues", label: "Blues", description: "Soulful expression, raw emotion" },
  { id: "ambient", label: "Ambient", description: "Atmospheric, ethereal textures" },
  { id: "edm", label: "EDM", description: "High energy, festival-ready drops" },
] as const;

/**
 * Check if style continuation is available
 */
export function isStyleContinuationAvailable(): {
  available: boolean;
  missingServices: string[];
  message: string;
} {
  const missing: string[] = [];

  if (!isMusicGenConfigured()) {
    missing.push("MusicGen (Replicate API)");
  }

  if (missing.length > 0) {
    return {
      available: false,
      missingServices: missing,
      message: `Missing required services: ${missing.join(", ")}. Add VITE_REPLICATE_API_KEY to enable.`,
    };
  }

  return {
    available: true,
    missingServices: [],
    message: "Style continuation is available",
  };
}

/**
 * Analyze intro audio to extract musical characteristics
 */
async function analyzeIntro(
  audioFile: File,
  onProgress?: ContinuationProgressCallback
): Promise<ContinuationAnalysis> {
  onProgress?.({
    stage: "analyzing",
    progress: 10,
    message: "Analyzing intro audio...",
    substage: "Detecting BPM, key, and mood",
  });

  // Try Cyanite first if available
  if (isCyaniteConfigured()) {
    try {
      const result = await analyzeAudioFile(audioFile);
      return {
        bpm: result.bpm || 120,
        key: result.key || "C major",
        keyConfidence: result.keyConfidence || 0.8,
        genres: result.genres || [{ name: "Unknown", confidence: 0.5 }],
        moods: result.moods || [{ name: "Neutral", confidence: 0.5 }],
        energy: result.energy || 0.5,
        danceability: result.danceability || 0.5,
      };
    } catch (error) {
      console.warn("Cyanite analysis failed, using defaults:", error);
    }
  }

  // Fallback: Return reasonable defaults
  // In production, you might use Web Audio API for basic BPM detection
  return {
    bpm: 120,
    key: "C major",
    keyConfidence: 0.5,
    genres: [{ name: "Unknown", confidence: 0.5 }],
    moods: [{ name: "Neutral", confidence: 0.5 }],
    energy: 0.5,
    danceability: 0.5,
  };
}

/**
 * Extract melody from intro using stem separation
 */
async function extractMelodyFromIntro(
  audioFile: File,
  onProgress?: ContinuationProgressCallback
): Promise<string | null> {
  if (!isStemSeparationConfigured()) {
    console.warn("Stem separation not configured, skipping melody extraction");
    return null;
  }

  onProgress?.({
    stage: "extracting-melody",
    progress: 30,
    message: "Extracting melody from intro...",
    substage: "Using AI stem separation",
  });

  try {
    const stems = await separateStems(audioFile, (status, progress) => {
      onProgress?.({
        stage: "extracting-melody",
        progress: 30 + (progress || 0) * 0.2, // 30-50%
        message: status,
        substage: "Stem separation in progress",
      });
    });

    // Use the "other" stem which typically contains the main melody/instruments
    // or combine with vocals for a fuller melodic reference
    return stems.other || stems.vocals || null;
  } catch (error) {
    console.warn("Melody extraction failed:", error);
    return null;
  }
}

/**
 * Calculate crossfade duration based on analysis and preference
 */
function calculateCrossfadeDuration(
  analysis: ContinuationAnalysis,
  preference: "auto" | "short" | "medium" | "long"
): number {
  if (preference === "short") return 2;
  if (preference === "medium") return 4;
  if (preference === "long") return 6;

  // Auto calculation based on BPM and energy
  const baseDuration = 4; // seconds
  const bpmFactor = 120 / analysis.bpm; // slower = longer crossfade
  const energyFactor = 1 + (1 - analysis.energy) * 0.3; // low energy = slightly longer

  return Math.min(8, Math.max(2, baseDuration * bpmFactor * energyFactor));
}

/**
 * Stitch intro and continuation audio with crossfade
 * Returns a merged audio blob
 */
async function stitchAudioWithCrossfade(
  introUrl: string,
  continuationBlob: Blob,
  crossfadeDuration: number,
  onProgress?: ContinuationProgressCallback
): Promise<{ url: string; blob: Blob }> {
  onProgress?.({
    stage: "stitching",
    progress: 85,
    message: "Stitching audio with crossfade...",
    substage: `${crossfadeDuration}s crossfade`,
  });

  // Create audio context for processing
  const audioContext = new AudioContext();

  try {
    // Fetch and decode intro
    const introResponse = await fetch(introUrl);
    const introArrayBuffer = await introResponse.arrayBuffer();
    const introBuffer = await audioContext.decodeAudioData(introArrayBuffer);

    // Decode continuation
    const continuationArrayBuffer = await continuationBlob.arrayBuffer();
    const continuationBuffer = await audioContext.decodeAudioData(
      continuationArrayBuffer
    );

    // Calculate crossfade samples
    const sampleRate = introBuffer.sampleRate;
    const crossfadeSamples = Math.floor(crossfadeDuration * sampleRate);

    // Calculate total length (intro + continuation - crossfade overlap)
    const totalLength =
      introBuffer.length + continuationBuffer.length - crossfadeSamples;

    // Create output buffer
    const outputBuffer = audioContext.createBuffer(
      2, // stereo
      totalLength,
      sampleRate
    );

    // Process each channel
    for (let channel = 0; channel < 2; channel++) {
      const introData = introBuffer.getChannelData(
        Math.min(channel, introBuffer.numberOfChannels - 1)
      );
      const contData = continuationBuffer.getChannelData(
        Math.min(channel, continuationBuffer.numberOfChannels - 1)
      );
      const outputData = outputBuffer.getChannelData(channel);

      // Copy intro (up to crossfade point)
      const introEnd = introBuffer.length - crossfadeSamples;
      for (let i = 0; i < introEnd; i++) {
        outputData[i] = introData[i];
      }

      // Crossfade region
      for (let i = 0; i < crossfadeSamples; i++) {
        const introIndex = introEnd + i;
        const t = i / crossfadeSamples;

        // Equal power crossfade
        const introGain = Math.cos(t * Math.PI * 0.5);
        const contGain = Math.sin(t * Math.PI * 0.5);

        const introSample = introIndex < introData.length ? introData[introIndex] : 0;
        const contSample = i < contData.length ? contData[i] : 0;

        outputData[introEnd + i] = introSample * introGain + contSample * contGain;
      }

      // Copy rest of continuation
      for (let i = crossfadeSamples; i < continuationBuffer.length; i++) {
        outputData[introEnd + i] = contData[i];
      }
    }

    // Convert to WAV blob
    const wavBlob = audioBufferToWav(outputBuffer);
    const url = URL.createObjectURL(wavBlob);

    onProgress?.({
      stage: "stitching",
      progress: 95,
      message: "Audio stitched successfully",
    });

    return { url, blob: wavBlob };
  } finally {
    await audioContext.close();
  }
}

/**
 * Main workflow: Create a style-inspired continuation
 */
export async function createStyleContinuation(
  request: ContinuationRequest,
  onProgress?: ContinuationProgressCallback
): Promise<ContinuationResult> {
  // Validate request
  if (!request.introAudioFile) {
    throw new Error("Intro audio file is required");
  }
  if (!request.targetGenre) {
    throw new Error("Target genre is required");
  }

  const duration = Math.min(30, Math.max(5, request.continuationDuration || 15));

  // Stage 1: Get intro URL
  onProgress?.({
    stage: "analyzing",
    progress: 5,
    message: "Preparing intro audio...",
  });

  const introUrl =
    request.introAudioUrl || URL.createObjectURL(request.introAudioFile);

  // Stage 2: Analyze intro
  const analysis = await analyzeIntro(request.introAudioFile, onProgress);

  onProgress?.({
    stage: "analyzing",
    progress: 25,
    message: `Detected: ${analysis.bpm} BPM, ${analysis.key}, ${analysis.genres[0]?.name || "Unknown"} style`,
  });

  // Stage 3: Optional melody extraction
  let melodyUrl: string | undefined;
  if (request.extractMelody && isStemSeparationConfigured()) {
    melodyUrl =
      (await extractMelodyFromIntro(request.introAudioFile, onProgress)) ||
      undefined;
  }

  // Stage 4: Build intelligent prompt
  onProgress?.({
    stage: "building-prompt",
    progress: 55,
    message: "Building generation prompt...",
  });

  const basePrompt = buildStyleTransitionPrompt(
    {
      bpm: analysis.bpm,
      key: analysis.key,
      genre: analysis.genres[0]?.name,
      mood: analysis.moods[0]?.name,
    },
    request.targetGenre
  );

  const fullPrompt = request.customPromptAdditions
    ? `${basePrompt}, ${request.customPromptAdditions}`
    : basePrompt;

  // Stage 5: Generate continuation
  onProgress?.({
    stage: "generating",
    progress: 60,
    message: `Generating ${request.targetGenre} continuation...`,
    substage: `Duration: ${duration}s`,
  });

  let generationResult: MusicGenResult;

  if (melodyUrl) {
    // Use melody conditioning
    generationResult = await generateWithMelodyConditioning(
      melodyUrl,
      fullPrompt,
      duration,
      (status, progress) => {
        onProgress?.({
          stage: "generating",
          progress: 60 + (progress || 0) * 0.2, // 60-80%
          message: status,
          substage: "With melody conditioning",
        });
      }
    );
  } else {
    // Generate without melody conditioning (use intro directly)
    generationResult = await musicGenContinue(
      request.introAudioFile,
      fullPrompt,
      duration,
      undefined, // Let MusicGen use the end of the audio
      (status, progress) => {
        onProgress?.({
          stage: "generating",
          progress: 60 + (progress || 0) * 0.2,
          message: status,
        });
      }
    );
  }

  // Stage 6: Stitch with crossfade
  const crossfadeDuration = calculateCrossfadeDuration(
    analysis,
    request.crossfadePreference
  );

  const stitched = await stitchAudioWithCrossfade(
    introUrl,
    generationResult.audioBlob,
    crossfadeDuration,
    onProgress
  );

  // Complete!
  onProgress?.({
    stage: "complete",
    progress: 100,
    message: "Style continuation complete!",
  });

  return {
    analysis,
    introAudioUrl: introUrl,
    continuationAudioUrl: generationResult.audioUrl,
    continuationBlob: generationResult.audioBlob,
    mergedAudioUrl: stitched.url,
    mergedBlob: stitched.blob,
    melodyUrl,
    crossfadeDuration,
    prompt: fullPrompt,
  };
}

/**
 * Clean up URLs created by the service
 */
export function cleanupContinuationResult(result: ContinuationResult): void {
  // Revoke object URLs to free memory
  if (result.introAudioUrl.startsWith("blob:")) {
    URL.revokeObjectURL(result.introAudioUrl);
  }
  if (result.mergedAudioUrl.startsWith("blob:")) {
    URL.revokeObjectURL(result.mergedAudioUrl);
  }
}
