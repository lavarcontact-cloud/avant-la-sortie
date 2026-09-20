import type { VoiceProvider } from './types'
import { getLanguage } from '../lib/languages'

// Real TTS backed by the browser's speechSynthesis API.
export class WebSpeechSynthesisProvider implements VoiceProvider {
  readonly name = 'WebSpeechSynthesisProvider'
  readonly isReal = true

  isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window
  }

  speak(opts: { text: string; lang: import('../types').LanguageCode; rate: number; onEnd?: () => void }): void {
    if (!this.isSupported()) {
      opts.onEnd?.()
      return
    }
    const synth = window.speechSynthesis
    const utterance = new SpeechSynthesisUtterance(opts.text)
    const bcp47 = opts.lang === 'auto' ? navigator.language : getLanguage(opts.lang).bcp47
    utterance.lang = bcp47
    utterance.rate = opts.rate

    const voices = synth.getVoices()
    const match = voices.find((v) => v.lang.toLowerCase().startsWith(bcp47.slice(0, 2).toLowerCase()))
    if (match) utterance.voice = match

    utterance.onend = () => opts.onEnd?.()
    utterance.onerror = () => opts.onEnd?.()

    synth.cancel()
    synth.speak(utterance)
  }

  stop(): void {
    if (this.isSupported()) window.speechSynthesis.cancel()
  }

  primeForUserGesture(): void {
    if (!this.isSupported()) return
    // A near-silent, near-instant real utterance — must be spoken (not just
    // constructed) synchronously inside the tap for iOS Safari to grant this
    // page audio-output permission for subsequent speak() calls made later,
    // after awaits, in the same session.
    const unlock = new SpeechSynthesisUtterance(' ')
    unlock.volume = 0.01
    unlock.rate = 10
    window.speechSynthesis.speak(unlock)
  }
}
