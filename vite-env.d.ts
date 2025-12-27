/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Required: Core AI functionality
  readonly VITE_GEMINI_API_KEY: string;

  // Optional: Enhanced music generation
  readonly VITE_ELEVENLABS_API_KEY?: string;

  // Optional: DALL-E 3 image generation (better prompt accuracy)
  readonly VITE_OPENAI_API_KEY?: string;

  // Optional: Professional audio analysis
  readonly VITE_CYANITE_API_KEY?: string;

  // Optional: High-quality stem separation
  readonly VITE_REPLICATE_API_KEY?: string;

  // Vite built-in variables
  readonly MODE: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly SSR: boolean;
  readonly BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
