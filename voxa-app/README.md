# VOXA — Interprète bilingue en direct (prototype)

VOXA simule un interprète de conversation en temps réel : on pose le téléphone
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
  fallback for anything else.
- **History** — localStorage-backed, list/rename/delete, text/metadata only
  (no audio ever stored).
- **Settings** — persisted to localStorage: primary language, favorites,
  auto-playback, slang level, speech rate, keep-history toggle.
- **Error states** — mic permission denied, no speech detected, translation
  failure, etc. each show a dismissible banner with a retry action; the UI
  never gets stuck in an infinite spinner.

Every place a feature is simulated, the UI shows an honest `DEMO` badge
(`components/DemoBadge.tsx`) rather than pretending a demo output is a real
AI call — see `providers/index.ts`'s `providerFlags`.

## What needs a real API key to become "real"

| Feature | Env var | Notes |
|---|---|---|
| High-quality, context-aware, slang-aware translation | `VITE_TRANSLATION_API_KEY` (+ optional `VITE_TRANSLATION_API_URL`, `VITE_TRANSLATION_MODEL`) | `providers/OpenAITranslationProvider.ts` calls an OpenAI-compatible chat completion endpoint. Any failure (missing key, network, bad response) transparently falls back to `DemoTranslationProvider` — the UI never breaks. |
| Better / non-Chromium speech-to-text | `VITE_STT_API_KEY` (reserved) | Currently STT is 100% free via the browser's own `SpeechRecognition`; this var is a placeholder for wiring in a cloud STT provider (e.g. Whisper) as a higher-quality or cross-browser fallback path in `providers/`. |
| Higher quality / more expressive voices | `VITE_TTS_PROVIDER=cloud`, `VITE_TTS_API_KEY` (reserved) | TTS currently uses the browser's own `speechSynthesis`, which is free but has variable voice quality per OS/browser. These vars are placeholders for a cloud TTS provider (ElevenLabs, Azure, etc.) implementing the same `VoiceProvider` interface. |

See `.env.example` for the full list with comments.

## Architecture

```
src/
  components/   UI building blocks (Waveform, ConversationBubble, DemoBadge, ErrorBanner, BackHeader)
  pages/        Home, ConversationSetup, LiveConversation, History, Settings
  services/     conversationService, historyService (localStorage), settingsService, audioService (getUserMedia + analyser)
  providers/    SpeechProvider / TranslationProvider / VoiceProvider interfaces
                + Demo* implementations (always available, zero config)
                + WebSpeechProvider / WebSpeechSynthesisProvider (real browser APIs)
                + OpenAITranslationProvider (real, key-gated, safe fallback)
                + index.ts factory that picks real vs demo per feature
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
- No backend: everything (history, settings) lives in the browser's
  localStorage, per device, per browser profile. There is no sync across
  devices.
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
- Add a small backend (or a serverless proxy) once a real translation API key
  is used in production, so the key is never shipped to the client bundle.
- Add push-to-talk with automatic voice-activity detection (VAD) instead of
  manual per-side mic buttons, for a more hands-free "just talk" experience.
