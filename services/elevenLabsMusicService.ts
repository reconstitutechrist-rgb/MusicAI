/**
 * ElevenLabs Eleven Music API Service
 * High-quality AI music generation with vocals (44.1kHz stereo)
 *
 * Documentation: https://elevenlabs.io/docs/api-reference/music/compose
 */

const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io/v1';

export interface MusicGenerationOptions {
  prompt: string;              // Description of the music to generate (up to 4100 chars)
  durationMs?: number;         // 3000 - 300000 ms (3 sec - 5 min)
  instrumental?: boolean;      // If true, generates instrumental only (no vocals)
}

export interface CompositionSection {
  name: string;                // e.g., "intro", "verse", "chorus"
  description: string;         // Musical description for this section
  duration_ms: number;         // Duration of this section
  lyrics?: string;             // Optional lyrics for this section
}

export interface CompositionPlan {
  sections: CompositionSection[];
}

export interface AdvancedMusicOptions {
  compositionPlan: CompositionPlan;
}

/**
 * Check if ElevenLabs API is configured
 */
export function isElevenLabsConfigured(): boolean {
  return !!import.meta.env.VITE_ELEVENLABS_API_KEY;
}

/**
 * Generate music from a text prompt
 * Returns MP3 blob (44.1kHz, 128kbps stereo)
 */
export async function generateMusic(
  options: MusicGenerationOptions,
  onProgress?: (status: string) => void
): Promise<Blob> {
  const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;

  if (!apiKey) {
    throw new Error('ElevenLabs API key not configured. Please add VITE_ELEVENLABS_API_KEY to your environment.');
  }

  onProgress?.('Starting music generation...');

  const response = await fetch(`${ELEVENLABS_API_BASE}/music`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt: options.prompt,
      music_length_ms: options.durationMs || 60000,  // Default 1 minute
      instrumental: options.instrumental ?? false
    })
  });

  if (!response.ok) {
    let errorMessage = `ElevenLabs API error: ${response.status}`;
    try {
      const errorData = await response.json();
      if (errorData.detail) {
        errorMessage = errorData.detail;
      }
      // Handle specific error types
      if (errorData.error === 'bad_prompt') {
        errorMessage = `Prompt rejected: ${errorData.message || 'Please modify your prompt to avoid copyrighted content.'}`;
      }
    } catch {
      // If we can't parse JSON, use the status text
      errorMessage = `ElevenLabs API error: ${response.status} ${response.statusText}`;
    }
    throw new Error(errorMessage);
  }

  onProgress?.('Processing audio...');

  // Response is the audio file directly (MP3)
  const blob = await response.blob();

  onProgress?.('Music generated successfully!');

  return blob;
}

/**
 * Generate music with a detailed composition plan
 * Allows fine-grained control over song sections
 */
export async function generateMusicWithPlan(
  plan: CompositionPlan,
  onProgress?: (status: string) => void
): Promise<Blob> {
  const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;

  if (!apiKey) {
    throw new Error('ElevenLabs API key not configured.');
  }

  onProgress?.('Starting composition...');

  const response = await fetch(`${ELEVENLABS_API_BASE}/music`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      composition_plan: plan
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Composition failed: ${response.status}`);
  }

  onProgress?.('Processing audio...');

  return response.blob();
}

/**
 * Generate instrumental track
 * Convenience wrapper for generateMusic with instrumental=true
 */
export async function generateInstrumental(
  stylePrompt: string,
  durationMs: number = 60000,
  onProgress?: (status: string) => void
): Promise<Blob> {
  return generateMusic({
    prompt: stylePrompt,
    durationMs,
    instrumental: true
  }, onProgress);
}

/**
 * Generate full song with vocals
 * Convenience wrapper for generateMusic with lyrics included in prompt
 */
export async function generateSongWithLyrics(
  lyrics: string,
  style: string,
  durationMs: number = 60000,
  onProgress?: (status: string) => void
): Promise<Blob> {
  // Combine style and lyrics in the prompt
  const prompt = `${style} song with these lyrics:\n\n${lyrics}`;

  return generateMusic({
    prompt,
    durationMs,
    instrumental: false
  }, onProgress);
}

/**
 * Create a URL from a blob for audio playback
 */
export function createAudioUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}

/**
 * Estimate cost based on duration
 * Approximate based on ElevenLabs pricing tiers
 */
export function estimateCost(durationMs: number): { minutes: number; estimatedCost: string } {
  const minutes = Math.ceil(durationMs / 60000);
  // Starter tier: ~$0.23/min, Pro tier: ~$0.33/min
  const lowEstimate = (minutes * 0.23).toFixed(2);
  const highEstimate = (minutes * 0.33).toFixed(2);

  return {
    minutes,
    estimatedCost: `$${lowEstimate} - $${highEstimate}`
  };
}
