/// <reference types="vite/client" />

// Only client-side (VITE_-prefixed) vars belong here. Server-only secrets
// (TRANSLATION_API_KEY, TRANSLATION_API_URL, TRANSLATION_MODEL) live in
// api/translate.ts's process.env and must NEVER be prefixed with VITE_ or
// referenced from src/ — see .env.example for the full explanation.
interface ImportMetaEnv {
  readonly VITE_STT_API_KEY?: string
  readonly VITE_TTS_PROVIDER?: string
  readonly VITE_TTS_API_KEY?: string
  readonly VITE_CONTEXT_WINDOW?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
