/**
 * ElevenLabs Voice Text-to-Speech Service
 * Industry-leading realistic voice synthesis
 *
 * Documentation: https://elevenlabs.io/docs/api-reference/text-to-speech
 */

const ELEVENLABS_API_BASE = "https://api.elevenlabs.io/v1";

// Default timeout for TTS requests (30 seconds)
const DEFAULT_TIMEOUT_MS = 30000;

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
 * Check if ElevenLabs Voice API is configured
 */
export function isElevenLabsVoiceConfigured(): boolean {
  return !!import.meta.env.VITE_ELEVENLABS_API_KEY;
}

/**
 * Get API key or throw
 */
function getApiKey(): string {
  const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ElevenLabs API key not configured. Please add VITE_ELEVENLABS_API_KEY to your environment.",
    );
  }
  return apiKey;
}

/**
 * Available ElevenLabs voice presets
 */
export const VOICE_PRESETS = {
  // Premade voices
  rachel: "21m00Tcm4TlvDq8ikWAM", // Female, American, warm
  drew: "29vD33N1CtxCmqQRPOHJ", // Male, American, well-rounded
  clyde: "2EiwWnXFnvU5JabPnv8n", // Male, American, war veteran
  paul: "5Q0t7uMcjvnagumLfvZi", // Male, American, news
  domi: "AZnzlk1XvdvUeBnXmlld", // Female, American, strong
  dave: "CYw3kZ02Hs0563khs1Fj", // Male, British-Essex, conversational
  fin: "D38z5RcWu1voky8WS1ja", // Male, Irish, sailor
  sarah: "EXAVITQu4vr4xnSDxMaL", // Female, American, soft news
  antoni: "ErXwobaYiN019PkySvjV", // Male, American, well-rounded
  thomas: "GBv7mTt0atIp3Br8iCZE", // Male, American, calm
  charlie: "IKne3meq5aSn9XLyUdCD", // Male, Australian, casual
  emily: "LcfcDJNUP1GQjkzn1xUU", // Female, American, calm
  elli: "MF3mGyEYCl7XYWbV9V6O", // Female, American, young
  callum: "N2lVS1w4EtoT3dr4eOWO", // Male, Transatlantic, intense
  patrick: "ODq5zmih8GrVes37Dizd", // Male, American, shouty
  harry: "SOYHLrjzK2X1ezoPC6cr", // Male, American, anxious
  liam: "TX3LPaxmHKxFdv7VOQHJ", // Male, American, young
  dorothy: "ThT5KcBeYPX3keUQqHPh", // Female, British, pleasant
  josh: "TxGEqnHWrfWFTfGW9XjX", // Male, American, young
  arnold: "VR6AewLTigWG4xSOukaG", // Male, American, crisp
  charlotte: "XB0fDUnXU5powFXDhCwa", // Female, English-Swedish, seductive
  alice: "Xb7hH8MSUJpSbSDYk0k2", // Female, British, confident
  matilda: "XrExE9yKIg1WjnnlVkGX", // Female, American, warm
  james: "ZQe5CZNOzWyzPSCn5a3c", // Male, Australian, calm
  joseph: "Zlb1dXrM653N07WRdFW3", // Male, British, narrative
  michael: "flq6f7yk4E4fJM5XTYuZ", // Male, American, obnoxious
  ethan: "g5CIjZEefAph4nQFvHAz", // Male, American, young
  chris: "iP95p4xoKVk53GoZ742B", // Male, American, casual
  gigi: "jBpfuIE2acCO8z3wKNLl", // Female, American, childish
  freya: "jsCqWAovK2LkecY7zXl4", // Female, American, overly-expressive
  brian: "nPczCjzI2devNBz1zQrb", // Male, American, deep
  grace: "oWAxZDx7w5VEj9dCyTzz", // Female, American-Southern, gentle
  daniel: "onwK4e9ZLuTAKqWW03F9", // Male, British, deep news
  lily: "pFZP5JQG7iQjIQuC4Bku", // Female, British, warm
  serena: "pMsXgVXv3BLzUgSXRplE", // Female, American, pleasant
  adam: "pNInz6obpgDQGcFmaJgB", // Male, American, deep
  nicole: "piTKgcLEGmPE4e6mEKli", // Female, American, whisper
  glinda: "z9fAnlkpzviPz146aGWa", // Female, American, witch
  giovanni: "zcAOhNBS3c14rBihAFp1", // Male, English-Italian, foreigner
  mimi: "zrHiDhphv9ZnVXBqCLjz", // Female, English-Swedish, childish
} as const;

export type VoicePreset = keyof typeof VOICE_PRESETS;

export interface VoiceSettings {
  stability?: number; // 0-1, how stable/consistent the voice is
  similarityBoost?: number; // 0-1, how closely to match the original voice
  style?: number; // 0-1, stylistic expressiveness (available for some models)
  useSpeakerBoost?: boolean; // Boost speaker similarity
}

export interface TTSOptions {
  text: string;
  voiceId?: string;
  voicePreset?: VoicePreset;
  modelId?: "eleven_multilingual_v2" | "eleven_flash_v2_5" | "eleven_turbo_v2";
  settings?: VoiceSettings;
}

/**
 * Generate speech from text using ElevenLabs
 * Returns base64 encoded audio data
 */
export async function generateSpeech(options: TTSOptions): Promise<string> {
  const apiKey = getApiKey();

  // Determine voice ID
  let voiceId = options.voiceId;
  if (!voiceId && options.voicePreset) {
    voiceId = VOICE_PRESETS[options.voicePreset];
  }
  if (!voiceId) {
    voiceId = VOICE_PRESETS.rachel; // Default voice
  }

  const modelId = options.modelId || "eleven_multilingual_v2";

  const response = await fetchWithTimeout(
    `${ELEVENLABS_API_BASE}/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: options.text,
        model_id: modelId,
        voice_settings: {
          stability: options.settings?.stability ?? 0.5,
          similarity_boost: options.settings?.similarityBoost ?? 0.75,
          style: options.settings?.style ?? 0.5,
          use_speaker_boost: options.settings?.useSpeakerBoost ?? true,
        },
      }),
    },
  );

  if (!response.ok) {
    let errorMessage = `ElevenLabs TTS API error: ${response.status}`;
    try {
      const errorData = await response.json();
      if (errorData.detail?.message) {
        errorMessage = errorData.detail.message;
      } else if (errorData.detail) {
        errorMessage = JSON.stringify(errorData.detail);
      }
    } catch {
      errorMessage = `ElevenLabs TTS API error: ${response.status} ${response.statusText}`;
    }
    throw new Error(errorMessage);
  }

  // Convert response to base64
  const audioBlob = await response.blob();
  const arrayBuffer = await audioBlob.arrayBuffer();
  const base64 = btoa(
    new Uint8Array(arrayBuffer).reduce(
      (data, byte) => data + String.fromCharCode(byte),
      "",
    ),
  );

  return base64;
}

/**
 * Generate speech with simple parameters (convenience wrapper)
 * Matches signature expected by components
 */
export async function generateSpeechSimple(
  text: string,
  voicePreset: VoicePreset = "rachel",
): Promise<string> {
  return generateSpeech({
    text,
    voicePreset,
    modelId: "eleven_multilingual_v2",
  });
}

/**
 * Generate singing vocals using ElevenLabs
 * Uses special settings optimized for singing
 */
export async function generateSingingVocal(
  lyrics: string,
  voicePreset: VoicePreset = "rachel",
): Promise<string> {
  return generateSpeech({
    text: lyrics,
    voicePreset,
    modelId: "eleven_multilingual_v2",
    settings: {
      stability: 0.3, // Lower for more expressive
      similarityBoost: 0.8, // High to maintain voice character
      style: 0.8, // High for more stylistic expression
      useSpeakerBoost: true,
    },
  });
}

export interface Voice {
  voice_id: string;
  name: string;
  category: string;
  labels?: Record<string, string>;
  description?: string;
  preview_url?: string;
}

/**
 * List available voices
 */
export async function listVoices(): Promise<Voice[]> {
  const apiKey = getApiKey();

  const response = await fetchWithTimeout(`${ELEVENLABS_API_BASE}/voices`, {
    method: "GET",
    headers: {
      "xi-api-key": apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch voices: ${response.status}`);
  }

  const data = await response.json();
  return data.voices || [];
}

/**
 * Get voice by ID
 */
export async function getVoice(voiceId: string): Promise<Voice> {
  const apiKey = getApiKey();

  const response = await fetchWithTimeout(
    `${ELEVENLABS_API_BASE}/voices/${voiceId}`,
    {
      method: "GET",
      headers: {
        "xi-api-key": apiKey,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch voice: ${response.status}`);
  }

  return response.json();
}

/**
 * Create audio URL from base64
 */
export function createAudioUrl(base64Audio: string): string {
  const byteCharacters = atob(base64Audio);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: "audio/mpeg" });
  return URL.createObjectURL(blob);
}

/**
 * Estimate character cost
 * Based on ElevenLabs pricing tiers
 */
export function estimateCharacterCost(textLength: number): {
  characters: number;
  estimatedCost: string;
} {
  // Starter: ~$0.30/1000 chars, Pro: ~$0.18/1000 chars
  const lowEstimate = ((textLength / 1000) * 0.18).toFixed(3);
  const highEstimate = ((textLength / 1000) * 0.3).toFixed(3);

  return {
    characters: textLength,
    estimatedCost: `$${lowEstimate} - $${highEstimate}`,
  };
}
