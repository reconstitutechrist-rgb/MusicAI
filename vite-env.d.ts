/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Required: Core AI functionality
  readonly VITE_GEMINI_API_KEY: string;

  // Optional: Enhanced music generation
  readonly VITE_ELEVENLABS_API_KEY?: string;

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
