import type { LanguageCode, SlangLevel } from '../types'

// Hardcoded phrase-table proving intent for the "SLANG" style transform,
// used by the DemoTranslationProvider. A real LLM-backed provider receives
// the same slangLevel and produces genuinely context-aware output instead.
interface PhraseEntry {
  from: LanguageCode
  to: LanguageCode
  match: RegExp
  outputs: Partial<Record<SlangLevel, string>>
}

export const PHRASE_TABLE: PhraseEntry[] = [
  {
    from: 'fr',
    to: 'en',
    match: /vas-?y,?\s*fr[ée]rot,?\s*t'?es\s*chaud\s*ou\s*quoi\s*\??/i,
    outputs: {
      SLANG: 'Yo bro, you down or what?',
      NATUREL: "Come on man, are you up for it or not?",
      STANDARD: 'Come on, are you ready or not?',
      LITTERAL: "Go ahead, brother, are you hot or what?",
    },
  },
  {
    from: 'en',
    to: 'fr',
    match: /what'?s\s*up\s*bro,?\s*you\s*good\s*\??/i,
    outputs: {
      SLANG: "Ça va frérot, t'es good ?",
      NATUREL: 'Ça va mon pote, tout va bien ?',
      STANDARD: 'Comment vas-tu, tout va bien ?',
      LITTERAL: "Quoi de neuf frère, es-tu bon ?",
    },
  },
  {
    from: 'fr',
    to: 'en',
    match: /^\s*ça\s*roule\s*\??\s*$/i,
    outputs: {
      SLANG: "All good?",
      NATUREL: 'Everything alright?',
      STANDARD: 'Is everything okay?',
      LITTERAL: 'Does it roll?',
    },
  },
]

export function findHardcodedTransform(
  text: string,
  from: LanguageCode,
  to: LanguageCode,
  slangLevel: SlangLevel
): string | null {
  for (const entry of PHRASE_TABLE) {
    if (entry.from === from && entry.to === to && entry.match.test(text)) {
      return entry.outputs[slangLevel] ?? entry.outputs.STANDARD ?? null
    }
  }
  return null
}

export const SLANG_LEVEL_LABELS: Record<SlangLevel, string> = {
  STANDARD: 'Standard',
  NATUREL: 'Naturel',
  SLANG: 'Argot',
  LITTERAL: 'Littéral',
}

export const SLANG_LEVEL_DESCRIPTIONS: Record<SlangLevel, string> = {
  STANDARD: 'Traduction neutre et correcte, adaptée à tous les contextes.',
  NATUREL: "Formulation fluide, comme un locuteur natif décontracté.",
  SLANG: 'Registre familier / argot, expressions de rue.',
  LITTERAL: 'Traduction mot à mot, utile pour apprendre la structure.',
}
