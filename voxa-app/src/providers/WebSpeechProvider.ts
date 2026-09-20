import type { SpeechProvider } from './types'
import { getLanguage } from '../lib/languages'
import { TURN_END_SILENCE_MS } from '../lib/conversationConfig'

type SR = typeof window extends { SpeechRecognition: infer T } ? T : any

function getRecognitionCtor(): any {
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
}

export function isWebSpeechSupported(): boolean {
  return typeof window !== 'undefined' && !!getRecognitionCtor()
}

const RECOVERABLE_ERRORS = new Set(['no-speech', 'aborted'])

// Real STT backed by the browser's SpeechRecognition API. Runs in
// `continuous` mode so a brief mid-sentence pause doesn't cut the speaker
// off, but ends the turn itself via a silence timer (TURN_END_SILENCE_MS)
// rather than relying on the browser to ever naturally stop — some engines
// (esp. non-Chromium ones) never fire a natural end in continuous mode.
export class WebSpeechProvider implements SpeechProvider {
  readonly name = 'WebSpeechProvider'
  readonly isReal = true
  private recognition: any = null
  private active = false // guards against starting a second instance
  private silenceTimer: ReturnType<typeof setTimeout> | null = null
  private stoppedByUs = false

  isSupported(): boolean {
    return isWebSpeechSupported()
  }

  /** True while a recognition instance is running for this provider. */
  isActive(): boolean {
    return this.active
  }

  start(opts: {
    lang: import('../types').LanguageCode
    onInterim: (text: string) => void
    onFinal: (text: string) => void
    onError: (message: string) => void
    onEnd: () => void
  }): void {
    if (this.active) {
      // Never allow two simultaneous recognition instances.
      return
    }
    const Ctor = getRecognitionCtor()
    if (!Ctor) {
      opts.onError('unavailable')
      return
    }
    const recognition = new Ctor()
    this.recognition = recognition
    this.active = true
    this.stoppedByUs = false
    recognition.lang = opts.lang === 'auto' ? navigator.language : getLanguage(opts.lang).bcp47
    recognition.interimResults = true
    recognition.continuous = true
    recognition.maxAlternatives = 1

    let finalTranscript = ''

    const clearSilenceTimer = () => {
      if (this.silenceTimer) {
        clearTimeout(this.silenceTimer)
        this.silenceTimer = null
      }
    }

    const armSilenceTimer = () => {
      clearSilenceTimer()
      this.silenceTimer = setTimeout(() => {
        // Real silence: end the turn ourselves.
        this.stoppedByUs = true
        try {
          recognition.stop()
        } catch {
          /* already stopped */
        }
      }, TURN_END_SILENCE_MS)
    }

    recognition.onresult = (event: any) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          finalTranscript += result[0].transcript
        } else {
          interim += result[0].transcript
        }
      }
      if (interim) opts.onInterim(finalTranscript ? `${finalTranscript} ${interim}` : interim)
      else if (finalTranscript) opts.onInterim(finalTranscript)
      armSilenceTimer()
    }

    recognition.onerror = (event: any) => {
      clearSilenceTimer()
      if (event.error === 'not-allowed' || event.error === 'permission-denied') {
        opts.onError('mic-denied')
      } else if (RECOVERABLE_ERRORS.has(event.error)) {
        opts.onError(event.error)
      } else {
        opts.onError(event.error || 'unknown')
      }
    }

    recognition.onend = () => {
      clearSilenceTimer()
      this.active = false
      if (finalTranscript.trim()) {
        opts.onFinal(finalTranscript.trim())
      }
      opts.onEnd()
    }

    try {
      recognition.start()
      // Start an initial silence window in case the speaker never says
      // anything at all.
      armSilenceTimer()
    } catch (e) {
      this.active = false
      opts.onError('unknown')
    }
  }

  stop(): void {
    this.stoppedByUs = true
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer)
      this.silenceTimer = null
    }
    try {
      this.recognition?.stop()
    } catch {
      /* no-op */
    }
  }
}
