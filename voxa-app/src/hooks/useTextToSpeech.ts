import { useCallback, useRef } from 'react'
import { createVoiceProvider } from '../providers'
import type { LanguageCode } from '../types'

export function useTextToSpeech() {
  const providerRef = useRef(createVoiceProvider())

  const speak = useCallback((text: string, lang: LanguageCode, rate: number) => {
    return new Promise<void>((resolve) => {
      providerRef.current.speak({ text, lang, rate, onEnd: () => resolve() })
    })
  }, [])

  const stop = useCallback(() => providerRef.current.stop(), [])
  const primeForUserGesture = useCallback(() => providerRef.current.primeForUserGesture(), [])

  return {
    speak,
    stop,
    primeForUserGesture,
    isReal: providerRef.current.isReal,
    providerName: providerRef.current.name,
  }
}
