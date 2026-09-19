import type { LanguageCode } from '../types'
import { LANGUAGES } from './languages'

// Lightweight, dependency-free heuristic detector used in DEMO mode / as a
// fallback when no real language-ID API is configured. Real deployments can
// swap this out for a proper service (fastText/CLD, or the same LLM call
// used for translation) behind the same function signature.

const COMMON_WORDS: Record<string, string[]> = {
  fr: ['le', 'la', 'les', 'et', 'est', 'un', 'une', 'je', 'tu', 'vous', 'bonjour', 'merci', 'frérot', "c'est", 'chaud', 'vas-y', 'quoi', 'salut'],
  en: ['the', 'and', 'is', 'are', 'you', 'i', 'hello', 'thanks', 'what', 'bro', 'yo', 'down', 'okay', 'please'],
  es: ['el', 'la', 'los', 'las', 'y', 'es', 'un', 'una', 'hola', 'gracias', 'qué', 'tú', 'vamos'],
  pt: ['o', 'a', 'os', 'as', 'e', 'é', 'um', 'uma', 'olá', 'obrigado', 'você', 'tudo'],
  ar: ['في', 'من', 'على', 'هذا', 'مرحبا', 'شكرا', 'أنت', 'ما'],
  de: ['der', 'die', 'das', 'und', 'ist', 'ein', 'eine', 'hallo', 'danke', 'du', 'wie'],
  it: ['il', 'lo', 'la', 'e', 'è', 'un', 'una', 'ciao', 'grazie', 'tu', 'come'],
  nl: ['de', 'het', 'een', 'en', 'is', 'hallo', 'dank', 'jij', 'hoe'],
}

export interface DetectionResult {
  lang: LanguageCode
  confidence: number
}

export function detectLanguageHeuristic(text: string): DetectionResult {
  const cleaned = text.toLowerCase().replace(/[.,!?;:'"()]/g, ' ')
  const tokens = cleaned.split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return { lang: 'fr', confidence: 0 }

  const scores: Record<string, number> = {}
  for (const code of Object.keys(COMMON_WORDS)) scores[code] = 0

  for (const token of tokens) {
    for (const [code, words] of Object.entries(COMMON_WORDS)) {
      if (words.includes(token)) scores[code] += 1
    }
  }

  // Arabic script quick check
  if (/[؀-ۿ]/.test(text)) scores.ar += 3

  let best: string = 'fr'
  let bestScore = -1
  for (const [code, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score
      best = code
    }
  }

  // If nothing matched, fall back to browser locale, else French.
  if (bestScore <= 0) {
    const nav = (navigator.language || 'fr').slice(0, 2)
    const known = LANGUAGES.find((l) => l.code === nav)
    return { lang: (known?.code as LanguageCode) ?? 'fr', confidence: 0.2 }
  }

  const confidence = Math.min(0.95, 0.4 + bestScore / tokens.length)
  return { lang: best as LanguageCode, confidence }
}

/**
 * Decide which side (A/B) most likely just spoke, given the detected
 * language of the utterance and the two configured conversation languages.
 * Falls back to alternating speaker if the language is ambiguous.
 */
export function resolveSpeakerFromLanguage(
  detected: LanguageCode,
  langA: LanguageCode,
  langB: LanguageCode,
  lastSpeaker: 'A' | 'B' | null
): 'A' | 'B' {
  if (langA !== 'auto' && detected === langA) return 'A'
  if (langB !== 'auto' && detected === langB) return 'B'
  return lastSpeaker === 'A' ? 'B' : 'A'
}
