import type { LanguageCode, TranslationRequest, TranslationResult } from '../types'

/** Speech-to-text abstraction. Implementations drive a live transcript. */
export interface SpeechProvider {
  readonly name: string
  readonly isReal: boolean
  isSupported(): boolean
  start(opts: {
    lang: LanguageCode
    onInterim: (text: string) => void
    onFinal: (text: string) => void
    onError: (message: string) => void
    onEnd: () => void
  }): void
  stop(): void
}

/** Translation abstraction. Never call a vendor SDK outside an implementation of this. */
export interface TranslationProvider {
  readonly name: string
  readonly isReal: boolean
  translate(req: TranslationRequest): Promise<TranslationResult>
}

/** Text-to-speech abstraction. */
export interface VoiceProvider {
  readonly name: string
  readonly isReal: boolean
  isSupported(): boolean
  speak(opts: { text: string; lang: LanguageCode; rate: number; onEnd?: () => void }): void
  stop(): void
}
