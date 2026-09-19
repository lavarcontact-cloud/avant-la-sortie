import type { TranslationProvider } from './types'
import type { TranslationRequest, TranslationResult } from '../types'

// Real LLM-backed provider. NEVER touches an API key directly — it only
// calls our own serverless function at /api/translate, which holds the
// secret key server-side (see api/translate.ts). Any failure (endpoint
// missing, network error, non-200, malformed response) throws, and the
// caller (see providers/index.ts) is responsible for falling back to
// DemoTranslationProvider — that keeps the "which provider actually served
// this turn" bookkeeping honest in one place instead of two.
export class AITranslationProvider implements TranslationProvider {
  readonly name = 'AITranslationProvider'
  readonly isReal = true

  async translate(req: TranslationRequest): Promise<TranslationResult> {
    const context = req.context.slice(-6).map((t) => ({
      speaker: t.speaker,
      originalText: t.originalText,
      translatedText: t.translatedText,
    }))

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20000)

    let res: Response
    try {
      res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: req.text,
          sourceLanguage: req.sourceLang,
          targetLanguage: req.targetLang,
          conversationContext: context,
          translationMode: req.slangLevel,
        }),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body?.error || `AI translation API error ${res.status}`)
    }

    const data = await res.json()
    if (!data?.translatedText) throw new Error('AI translation API returned no translatedText')

    return {
      translatedText: data.translatedText,
      detectedLang: (data.detectedLang as TranslationResult['detectedLang']) || req.sourceLang,
      confidence: typeof data.confidence === 'number' ? data.confidence : 0.9,
      providerUsed: this.name,
    }
  }
}
