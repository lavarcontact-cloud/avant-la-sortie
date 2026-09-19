import type { SpeechProvider } from './types'
import type { LanguageCode } from '../types'

// Simulates progressive speech recognition when the Web Speech API is
// unavailable (e.g. Firefox, Safari on some versions), so the state machine
// (idle -> listening -> processing -> translated -> speaking) is always
// demonstrable end to end.
const DEMO_PHRASES: Partial<Record<LanguageCode, string>> = {
  fr: "Vas-y frérot, t'es chaud ou quoi ?",
  en: 'Hello, how are you doing today?',
  es: 'Hola, ¿cómo estás hoy?',
  pt: 'Olá, como você está hoje?',
  de: 'Hallo, wie geht es dir heute?',
  it: 'Ciao, come stai oggi?',
  nl: 'Hallo, hoe gaat het met je vandaag?',
  ar: 'مرحبا كيف حالك اليوم؟',
}

export class DemoSpeechProvider implements SpeechProvider {
  readonly name = 'DemoSpeechProvider'
  readonly isReal = false
  private timer: ReturnType<typeof setTimeout> | null = null
  private cancelled = false

  isSupported(): boolean {
    return true
  }

  start(opts: {
    lang: LanguageCode
    onInterim: (text: string) => void
    onFinal: (text: string) => void
    onError: (message: string) => void
    onEnd: () => void
  }): void {
    this.cancelled = false
    const phrase = DEMO_PHRASES[opts.lang] ?? DEMO_PHRASES.fr!
    const words = phrase.split(' ')
    let i = 0
    const step = () => {
      if (this.cancelled) return
      i += 1
      opts.onInterim(words.slice(0, i).join(' '))
      if (i < words.length) {
        this.timer = setTimeout(step, 180 + Math.random() * 120)
      } else {
        opts.onFinal(phrase)
        opts.onEnd()
      }
    }
    this.timer = setTimeout(step, 300)
  }

  stop(): void {
    this.cancelled = true
    if (this.timer) clearTimeout(this.timer)
  }
}
