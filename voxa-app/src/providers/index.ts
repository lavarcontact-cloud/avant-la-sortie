import type { SpeechProvider, TranslationProvider, VoiceProvider } from './types'
import type { TranslationRequest, TranslationResult } from '../types'
import { DemoSpeechProvider } from './DemoSpeechProvider'
import { WebSpeechProvider, isWebSpeechSupported } from './WebSpeechProvider'
import { DemoTranslationProvider } from './DemoTranslationProvider'
import { AITranslationProvider } from './AITranslationProvider'
import { WebSpeechSynthesisProvider } from './WebSpeechSynthesisProvider'

// Factory: picks the real implementation when the browser/env supports it,
// otherwise falls back to the Demo implementation. Exposes flags so the UI
// can honestly show a "DEMO" badge and never claim a simulated feature is
// backed by a real AI call.

export function createSpeechProvider(): SpeechProvider {
  return isWebSpeechSupported() ? new WebSpeechProvider() : new DemoSpeechProvider()
}

/**
 * Translation is provided by a small composite: always attempt the real,
 * server-backed AITranslationProvider (it never holds a secret itself — see
 * AITranslationProvider.ts / api/translate.ts), and gracefully fall back to
 * DemoTranslationProvider on ANY failure (endpoint not configured, network
 * error, upstream error, timeout). The UI never has to guess ahead of time
 * whether a key is configured — it just reads `providerUsed` on the result
 * of the call that actually happened, which is always accurate.
 */
class FallbackTranslationProvider implements TranslationProvider {
  readonly name = 'FallbackTranslationProvider'
  readonly isReal = true // capability: may serve a real translation; actual outcome is per-call

  private ai = new AITranslationProvider()
  private demo = new DemoTranslationProvider()

  async translate(req: TranslationRequest): Promise<TranslationResult> {
    try {
      return await this.ai.translate(req)
    } catch (err) {
      const fallback = await this.demo.translate(req)
      return {
        ...fallback,
        debug: `AITranslationProvider failed (${(err as Error).message}), used ${fallback.providerUsed}`,
      }
    }
  }
}

export function createTranslationProvider(): TranslationProvider {
  return new FallbackTranslationProvider()
}

export function createVoiceProvider(): VoiceProvider {
  return new WebSpeechSynthesisProvider()
}

export const providerFlags = {
  speechIsReal: isWebSpeechSupported(),
  // Whether the app WILL ATTEMPT a real AI translation call — not a promise
  // that it will succeed. Always true: the AI path is always tried first and
  // safely falls back to DEMO per-call. The honest, per-result truth lives in
  // each ConversationTurn's `providerUsed` field (AITranslationProvider vs
  // DemoTranslationProvider) — that's what the LIVE/DEMO badge should read.
  translationAttemptsLive: true,
  voiceIsReal: typeof window !== 'undefined' && 'speechSynthesis' in window,
}

export function isLiveTranslationProviderName(name: string): boolean {
  return name === 'AITranslationProvider'
}
