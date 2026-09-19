import type { TranslationProvider } from './types'
import type { TranslationRequest, TranslationResult } from '../types'
import { languageName } from '../lib/languages'
import { SLANG_LEVEL_DESCRIPTIONS } from '../lib/slang'
import { DemoTranslationProvider } from './DemoTranslationProvider'

// Real LLM-backed provider. Calls an OpenAI-compatible chat completions
// endpoint. Any failure (missing key, network, bad response) falls back to
// the Demo provider so the UI never breaks — it just silently degrades and
// the UI is told via `providerUsed`.
export class OpenAITranslationProvider implements TranslationProvider {
  readonly name = 'OpenAITranslationProvider'
  readonly isReal = true
  private fallback = new DemoTranslationProvider()

  private get apiKey() {
    return import.meta.env.VITE_TRANSLATION_API_KEY
  }
  private get apiUrl() {
    return import.meta.env.VITE_TRANSLATION_API_URL || 'https://api.openai.com/v1/chat/completions'
  }
  private get model() {
    return import.meta.env.VITE_TRANSLATION_MODEL || 'gpt-4o-mini'
  }

  async translate(req: TranslationRequest): Promise<TranslationResult> {
    if (!this.apiKey) {
      return this.fallback.translate(req)
    }

    try {
      const contextLines = req.context
        .slice(-6)
        .map((t) => `${t.speaker}: ${t.originalText} (=> ${t.translatedText})`)
        .join('\n')

      const systemPrompt = [
        'Tu es un interprète bilingue en temps réel.',
        `Style demandé: ${req.slangLevel} — ${SLANG_LEVEL_DESCRIPTIONS[req.slangLevel]}`,
        'Traduis fidèlement le sens en gardant le registre demandé.',
        'Réponds uniquement avec le texte traduit, sans guillemets ni explications.',
      ].join(' ')

      const userPrompt = [
        contextLines ? `Contexte récent:\n${contextLines}\n` : '',
        `Traduis ce texte de ${languageName(req.sourceLang)} vers ${languageName(req.targetLang)}:`,
        req.text,
      ].join('\n')

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15000)

      const res = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: req.slangLevel === 'LITTERAL' ? 0.1 : 0.5,
        }),
        signal: controller.signal,
      })
      clearTimeout(timeout)

      if (!res.ok) throw new Error(`API error ${res.status}`)
      const data = await res.json()
      const translatedText = data?.choices?.[0]?.message?.content?.trim()
      if (!translatedText) throw new Error('Empty response')

      return {
        translatedText,
        detectedLang: req.sourceLang,
        confidence: 0.9,
        providerUsed: this.name,
      }
    } catch (err) {
      const fallback = await this.fallback.translate(req)
      return {
        ...fallback,
        debug: `OpenAITranslationProvider failed (${(err as Error).message}), used ${fallback.providerUsed}`,
      }
    }
  }
}
