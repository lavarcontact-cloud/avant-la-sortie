import type { SpeechProvider, TranslationProvider, VoiceProvider } from './types'
import { DemoSpeechProvider } from './DemoSpeechProvider'
import { WebSpeechProvider, isWebSpeechSupported } from './WebSpeechProvider'
import { DemoTranslationProvider } from './DemoTranslationProvider'
import { OpenAITranslationProvider } from './OpenAITranslationProvider'
import { WebSpeechSynthesisProvider } from './WebSpeechSynthesisProvider'

// Factory: picks the real implementation when the browser/env supports it,
// otherwise falls back to the Demo implementation. Exposes flags so the UI
// can honestly show a "DEMO" badge and never claim a simulated feature is
// backed by a real AI call.

export function createSpeechProvider(): SpeechProvider {
  return isWebSpeechSupported() ? new WebSpeechProvider() : new DemoSpeechProvider()
}

export function createTranslationProvider(): TranslationProvider {
  const hasKey = !!import.meta.env.VITE_TRANSLATION_API_KEY
  return hasKey ? new OpenAITranslationProvider() : new DemoTranslationProvider()
}

export function createVoiceProvider(): VoiceProvider {
  return new WebSpeechSynthesisProvider()
}

export const providerFlags = {
  speechIsReal: isWebSpeechSupported(),
  translationIsReal: !!import.meta.env.VITE_TRANSLATION_API_KEY,
  voiceIsReal: typeof window !== 'undefined' && 'speechSynthesis' in window,
}
