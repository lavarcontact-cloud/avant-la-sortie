import type { TranslationRequest, TranslationResult } from '../types'
import type { TranslationProvider } from '../providers/types'
import { createTranslationProvider } from '../providers'

let provider: TranslationProvider = createTranslationProvider()

/** Allows tests / settings to swap the underlying provider at runtime. */
export function setTranslationProvider(p: TranslationProvider) {
  provider = p
}

export function getActiveTranslationProvider(): TranslationProvider {
  return provider
}

/**
 * Central entry point for translation. Never talks to a vendor directly —
 * always goes through the TranslationProvider abstraction so swapping in a
 * real API is a one-line change in providers/index.ts.
 */
export async function translationEngine(req: TranslationRequest): Promise<TranslationResult> {
  try {
    return await provider.translate(req)
  } catch {
    // last-resort safety net: engine itself must never throw
    return {
      translatedText: req.text,
      detectedLang: req.sourceLang,
      confidence: 0,
      providerUsed: 'fallback-identity',
      debug: 'translation engine caught an unexpected error',
    }
  }
}
