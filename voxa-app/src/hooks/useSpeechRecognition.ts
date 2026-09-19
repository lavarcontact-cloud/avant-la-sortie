import { useCallback, useRef, useState } from 'react'
import { createSpeechProvider } from '../providers'
import type { LanguageCode } from '../types'

export function useSpeechRecognition() {
  const providerRef = useRef(createSpeechProvider())
  const [interimText, setInterimText] = useState('')
  const [isListening, setIsListening] = useState(false)

  const listen = useCallback((lang: LanguageCode) => {
    return new Promise<{ text: string } | { error: string }>((resolve) => {
      setInterimText('')
      setIsListening(true)
      providerRef.current.start({
        lang,
        onInterim: (text) => setInterimText(text),
        onFinal: (text) => {
          setInterimText(text)
        },
        onError: (message) => {
          setIsListening(false)
          resolve({ error: message })
        },
        onEnd: () => {
          setIsListening(false)
          setInterimText((current) => {
            if (current.trim()) resolve({ text: current.trim() })
            else resolve({ error: 'no-speech' })
            return current
          })
        },
      })
    })
  }, [])

  const stop = useCallback(() => {
    providerRef.current.stop()
    setIsListening(false)
  }, [])

  return {
    listen,
    stop,
    interimText,
    isListening,
    providerName: providerRef.current.name,
    isReal: providerRef.current.isReal,
  }
}
