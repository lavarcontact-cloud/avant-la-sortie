import type { SpeechProvider } from './types'
import { getLanguage } from '../lib/languages'

type SR = typeof window extends { SpeechRecognition: infer T } ? T : any

function getRecognitionCtor(): any {
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
}

export function isWebSpeechSupported(): boolean {
  return typeof window !== 'undefined' && !!getRecognitionCtor()
}

// Real STT backed by the browser's SpeechRecognition API.
export class WebSpeechProvider implements SpeechProvider {
  readonly name = 'WebSpeechProvider'
  readonly isReal = true
  private recognition: any = null

  isSupported(): boolean {
    return isWebSpeechSupported()
  }

  start(opts: {
    lang: import('../types').LanguageCode
    onInterim: (text: string) => void
    onFinal: (text: string) => void
    onError: (message: string) => void
    onEnd: () => void
  }): void {
    const Ctor = getRecognitionCtor()
    if (!Ctor) {
      opts.onError('SpeechRecognition non disponible dans ce navigateur.')
      return
    }
    const recognition = new Ctor()
    this.recognition = recognition
    recognition.lang = opts.lang === 'auto' ? navigator.language : getLanguage(opts.lang).bcp47
    recognition.interimResults = true
    recognition.continuous = false
    recognition.maxAlternatives = 1

    let finalTranscript = ''

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
      if (interim) opts.onInterim(interim)
    }

    recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed' || event.error === 'permission-denied') {
        opts.onError('mic-denied')
      } else if (event.error === 'no-speech') {
        opts.onError('no-speech')
      } else {
        opts.onError(event.error || 'unknown')
      }
    }

    recognition.onend = () => {
      if (finalTranscript.trim()) {
        opts.onFinal(finalTranscript.trim())
      }
      opts.onEnd()
    }

    try {
      recognition.start()
    } catch (e) {
      opts.onError('unknown')
    }
  }

  stop(): void {
    this.recognition?.stop()
  }
}
