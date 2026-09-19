/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TRANSLATION_API_KEY?: string
  readonly VITE_TRANSLATION_API_URL?: string
  readonly VITE_TRANSLATION_MODEL?: string
  readonly VITE_STT_API_KEY?: string
  readonly VITE_TTS_PROVIDER?: string
  readonly VITE_TTS_API_KEY?: string
  readonly VITE_CONTEXT_WINDOW?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
