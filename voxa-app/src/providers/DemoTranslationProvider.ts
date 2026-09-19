import type { TranslationProvider } from './types'
import type { TranslationRequest, TranslationResult } from '../types'
import { findHardcodedTransform } from '../lib/slang'
import { languageName } from '../lib/languages'

// Always-available provider: zero config, works offline. Uses a small
// hardcoded phrase table for the demo "wow" cases, and otherwise a naive
// bracket-style fallback that clearly signals it is not a real translation.
export class DemoTranslationProvider implements TranslationProvider {
  readonly name = 'DemoTranslationProvider'
  readonly isReal = false

  async translate(req: TranslationRequest): Promise<TranslationResult> {
    // simulate network/processing latency for a believable state transition
    await new Promise((r) => setTimeout(r, 500 + Math.random() * 400))

    const hardcoded = findHardcodedTransform(req.text, req.sourceLang, req.targetLang, req.slangLevel)
    if (hardcoded) {
      return {
        translatedText: hardcoded,
        detectedLang: req.sourceLang,
        confidence: 0.97,
        providerUsed: this.name,
      }
    }

    const translatedText = naiveFallback(req)
    return {
      translatedText,
      detectedLang: req.sourceLang,
      confidence: 0.55,
      providerUsed: this.name,
      debug: 'naive fallback — configure VITE_TRANSLATION_API_KEY for real translation',
    }
  }
}

function naiveFallback(req: TranslationRequest): string {
  const target = languageName(req.targetLang)
  const stylePrefix: Record<string, string> = {
    SLANG: '(mode argot — démo) ',
    NATUREL: '',
    STANDARD: '',
    LITTERAL: '(mot à mot — démo) ',
  }
  return `${stylePrefix[req.slangLevel] ?? ''}[${target}] ${req.text}`
}
