export type LanguageCode =
  | 'fr' | 'en' | 'es' | 'pt' | 'ar' | 'de' | 'it' | 'nl' | 'auto'

export interface Language {
  code: LanguageCode
  name: string
  flag: string
  bcp47: string // for Web Speech API / speechSynthesis
}

export type SlangLevel = 'STANDARD' | 'NATUREL' | 'SLANG' | 'LITTERAL'

export type Speaker = 'A' | 'B'

export interface ConversationTurn {
  id: string
  speaker: Speaker
  detectedLang: LanguageCode
  originalText: string
  translatedText: string
  targetLang: LanguageCode
  timestamp: number
  confidence: number
  providerUsed: string
  debug?: string
}

export interface Conversation {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  langA: LanguageCode
  langB: LanguageCode
  turns: ConversationTurn[]
}

export type EngineState =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'translating'
  | 'translated'
  | 'speaking'
  | 'error'

export type ErrorKind =
  | 'mic-denied'
  | 'no-speech'
  | 'unknown-language'
  | 'translation-failed'
  | 'api-unavailable'
  | 'slow-connection'
  | 'unintelligible'
  | 'unknown'

export interface EngineError {
  kind: ErrorKind
  message: string
}

export interface TranslationRequest {
  text: string
  sourceLang: LanguageCode
  targetLang: LanguageCode
  context: ConversationTurn[]
  slangLevel: SlangLevel
}

export interface TranslationResult {
  translatedText: string
  detectedLang: LanguageCode
  confidence: number
  providerUsed: string
  debug?: string
}

export interface Settings {
  primaryLanguage: LanguageCode
  favoriteLanguages: LanguageCode[]
  autoPlayback: boolean
  slangLevel: SlangLevel
  speechRate: number
  keepHistory: boolean
}
