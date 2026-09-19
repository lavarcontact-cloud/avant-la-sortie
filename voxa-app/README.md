# LOBA — Interprète bilingue en direct (prototype)

LOBA simule un interprète de conversation en temps réel : on pose le téléphone
entre deux personnes, l'application écoute, détecte la langue parlée, traduit
et lit la traduction à voix haute — en alternant automatiquement entre les
deux langues configurées.

This is a **real, runnable, interactive prototype** (Vite + React + TypeScript
+ Tailwind), not a static mockup: it uses the actual browser `getUserMedia`,
`SpeechRecognition` and `speechSynthesis` APIs, with graceful DEMO fallbacks
wherever a real browser API or external API key is unavailable.

## Install & run

```bash
cd voxa-app
npm install
npm run dev        # http://localhost:5173
npm run build       # production build to dist/
npm run preview     # preview the production build
```

No environment variables are required to run it — leaving `.env` unset (see
`.env.example`) runs the entire app in **DEMO mode**, which is fully
interactive and always demonstrable end to end (see below).

## What works for real, today, with zero config

- **Microphone capture & live waveform** — real `getUserMedia` + Web Audio
  `AnalyserNode`, drawn on canvas in `components/Waveform.tsx`, driven by
  actual mic amplitude (not a CSS pulse).
- **Speech-to-text** — real `SpeechRecognition` / `webkitSpeechRecognition`
  where the browser supports it (Chrome, Edge, most Chromium browsers),
  with progressive interim transcript display. Where unsupported (e.g.
  Firefox, some Safari versions), a labeled `DemoSpeechProvider` simulates
  progressive transcript typing so the same state machine
  (`idle → listening → processing → translated → speaking`) is always
  demonstrable.
- **Text-to-speech** — real `speechSynthesis`, picking a voice that matches
  the target language when the browser exposes one, with an adjustable
  speech rate.
- **Language auto-detection** — a dependency-light heuristic
  (`lib/languageDetection.ts`) using common-word lists per language plus a
  script check for Arabic, with a `navigator.language` fallback.
- **Translation (demo)** — `DemoTranslationProvider` always works offline: a
  hardcoded phrase table proves the "slang mode" intent (e.g.
  *"Vas-y frérot, t'es chaud ou quoi ?"* → *"Yo bro, you down or what?"* in
  SLANG mode, with different output per register), and a naive bracketed
  fallback for anything else. Used automatically whenever the real AI path
  (below) is unavailable or fails.
- **History** — localStorage-backed, list/rename/delete, text/metadata only
  (no audio ever stored).
- **Settings** — persisted to localStorage: primary language, favorites,
  auto-playback, slang level, speech rate, keep-history toggle.
- **Error states** — mic permission denied, no speech detected, translation
  failure, etc. each show a dismissible banner with a retry action; the UI
  never gets stuck in an infinite spinner.

Every place a feature is simulated, or was actually served by DEMO on the
last call, the UI shows an honest `DEMO` badge next to a `LIVE` one when the
real path served it (`components/DemoBadge.tsx`) — never a real-looking badge
for a simulated call. See `providers/index.ts`'s `providerFlags` and
`isLiveTranslationProviderName`, and each `ConversationTurn.providerUsed`.

## Real AI translation — server-side only, secret never shipped to the browser

Translation can be backed by a real LLM call through a **Vercel serverless
function**, `api/translate.ts`. This is the only place a translation API key
is ever read:

- `TRANSLATION_API_KEY` / `TRANSLATION_API_URL` / `TRANSLATION_MODEL` are
  **server-only** env vars (no `VITE_` prefix), set in the Vercel project
  settings. Vite never bundles them into client JS, so they can never leak
  through devtools or the built bundle.
- The frontend's `providers/AITranslationProvider.ts` never touches an API
  key — it only does a same-origin `fetch('/api/translate', ...)`.
- `providers/index.ts`'s `FallbackTranslationProvider` always tries the real
  AI path first and transparently falls back to `DemoTranslationProvider` on
  ANY failure (endpoint not configured — e.g. `TRANSLATION_API_KEY` unset,
  which the function reports as a clean JSON error — network error, upstream
  error, timeout, malformed response). The UI never breaks, and it never
  claims LIVE when a call actually fell back to DEMO: the badge reflects
  `ConversationTurn.providerUsed` from the call that actually happened, not
  whether an env var merely exists.
- The `/api/translate` request/response contract: the frontend sends
  `{ text, sourceLanguage, targetLanguage, conversationContext (last ~6
  turns), translationMode }`; the function returns
  `{ translatedText, detectedLang, confidence }` on success, or
  `{ error: string }` with a non-200 status on failure.
- The chosen backend is an **OpenAI-compatible chat completions endpoint**
  (default `https://api.openai.com/v1/chat/completions`), so any compatible
  provider (Azure OpenAI, OpenRouter, Groq, etc.) works by overriding
  `TRANSLATION_API_URL` / `TRANSLATION_MODEL`.

| Feature | Env var | Side | Notes |
|---|---|---|---|
| High-quality, context-aware, slang-aware translation | `TRANSLATION_API_KEY` (+ optional `TRANSLATION_API_URL`, `TRANSLATION_MODEL`) | **server-only** | See above. |
| Better / non-Chromium speech-to-text | `VITE_STT_API_KEY` (reserved) | client | Currently STT is 100% free via the browser's own `SpeechRecognition`; this var is a placeholder for wiring in a cloud STT provider (e.g. Whisper) as a higher-quality or cross-browser fallback path in `providers/`. |
| Higher quality / more expressive voices | `VITE_TTS_PROVIDER=cloud`, `VITE_TTS_API_KEY` (reserved) | client | TTS currently uses the browser's own `speechSynthesis`, which is free but has variable voice quality per OS/browser. These vars are placeholders for a cloud TTS provider (ElevenLabs, Azure, etc.) implementing the same `VoiceProvider` interface. |

See `.env.example` for the full list with comments, including which vars are
client-visible vs. server-only.

## Architecture

```
api/
  translate.ts  Vercel serverless function — the ONLY place the translation API key is read
src/
  components/   UI building blocks (Waveform, ConversationBubble, DemoBadge, ErrorBanner, BackHeader)
  pages/        Home, ConversationSetup, LiveConversation, History, Settings
  services/     conversationService, historyService (localStorage), settingsService, audioService (getUserMedia + analyser)
  providers/    SpeechProvider / TranslationProvider / VoiceProvider interfaces
                + Demo* implementations (always available, zero config)
                + WebSpeechProvider / WebSpeechSynthesisProvider (real browser APIs)
                + AITranslationProvider (calls /api/translate — never touches a key)
                + index.ts factory (FallbackTranslationProvider: AI first, Demo on any failure)
  hooks/        useMicrophone, useSpeechRecognition, useTextToSpeech, useConversation (orchestrates the whole turn cycle)
  lib/          languages.ts (single source of truth for the language list), languageDetection.ts,
                slang.ts (phrase table + level metadata), translationEngine.ts (the one entry point
                for translation — always goes through the provider abstraction, never a vendor call inline)
  types/        shared TypeScript types
```

### Provider abstraction

Nothing in `pages/` or `hooks/` ever imports a vendor SDK or calls `fetch`
directly for translation/speech/voice — everything goes through the
`SpeechProvider` / `TranslationProvider` / `VoiceProvider` interfaces defined
in `providers/types.ts`. `providers/index.ts` is the single factory/selector
that decides, per feature, whether to use the real browser/API-backed
implementation or the demo one, and exposes that choice as `providerFlags` so
the UI can show an honest badge.

### Translation engine

`lib/translationEngine.ts` exposes one function:

```ts
translationEngine({ text, sourceLang, targetLang, context, slangLevel }) => {
  translatedText, detectedLang, confidence, providerUsed, debug?
}
```

`context` is the last N turns of the conversation (`VITE_CONTEXT_WINDOW`,
default 6), passed through so a real LLM-backed provider can resolve
pronouns and maintain continuity across turns.

## Known limitations

- `SpeechRecognition` is not implemented in all browsers (notably Firefox);
  DEMO speech input is used there, which is clearly labeled and simulates the
  same flow rather than silently failing.
- The demo translation quality is intentionally minimal (a phrase table + a
  bracketed fallback) — it exists to prove the interaction loop and the
  slang-level concept, not to be a real MT engine.
- Speaker attribution when both languages are set to "auto-detect" is a
  simple heuristic (alternates when the detected language doesn't clearly
  match either configured language) and can misattribute turns in genuinely
  ambiguous cases.
- History and settings still live only in the browser's localStorage, per
  device, per browser profile — there is no account sync across devices
  (only the translation call itself now goes through a backend, `api/translate.ts`).
- No automated test suite yet.

## Next steps toward a native mobile app

- Wrap with **Capacitor** (fastest path): add `@capacitor/core` +
  `@capacitor/ios` / `@capacitor/android`, run `npx cap init`, point it at the
  Vite `dist/` build, and swap `getUserMedia`/`SpeechRecognition` for
  Capacitor's native `Microphone`/`SpeechRecognition` plugins for reliable
  background audio and iOS Safari support.
- Alternatively, port `services/`, `providers/`, `hooks/` and `lib/` largely
  as-is into a **React Native** app (they contain no DOM-only code except the
  `AudioService`/`Waveform` canvas bits and the two Web Speech/Web Audio
  provider implementations, which would be swapped for
  `react-native-voice` / `expo-speech` equivalents behind the same
  `SpeechProvider`/`VoiceProvider` interfaces).
- Add push-to-talk with automatic voice-activity detection (VAD) instead of
  manual per-side mic buttons, for a more hands-free "just talk" experience.
