import { useCallback, useEffect, useRef, useState } from 'react'
import type { Conversation, EngineError, EngineState, LanguageCode, Speaker } from '../types'
import { useSpeechRecognition } from './useSpeechRecognition'
import { useTextToSpeech } from './useTextToSpeech'
import { useMicrophone } from './useMicrophone'
import { translationEngine } from '../lib/translationEngine'
import { detectLanguageHeuristic, resolveSpeakerFromLanguage } from '../lib/languageDetection'
import { appendTurn, recentContext } from '../services/conversationService'
import { historyService } from '../services/historyService'
import { settingsService } from '../services/settingsService'

const CONTEXT_WINDOW = Number(import.meta.env.VITE_CONTEXT_WINDOW) || 6

export function useConversation(initial: Conversation) {
  const [conversation, setConversation] = useState<Conversation>(initial)
  const [state, setState] = useState<EngineState>('idle')
  const [error, setError] = useState<EngineError | null>(null)
  const [activeSpeaker, setActiveSpeaker] = useState<Speaker>('A')
  const lastSpeakerRef = useRef<Speaker | null>(null)

  const speech = useSpeechRecognition()
  const tts = useTextToSpeech()
  const mic = useMicrophone()

  const settings = useRef(settingsService.load()).current

  const persist = useCallback((c: Conversation) => {
    if (settingsService.load().keepHistory) historyService.save(c)
  }, [])

  const listenFor = useCallback(
    async (side: Speaker) => {
      setError(null)
      setActiveSpeaker(side)
      setState('listening')
      const sideLang = side === 'A' ? conversation.langA : conversation.langB
      await mic.start()
      const result = await speech.listen(sideLang)
      mic.stop()

      if ('error' in result) {
        setState('error')
        const kind = result.error === 'mic-denied' ? 'mic-denied' : result.error === 'no-speech' ? 'no-speech' : 'unknown'
        setError({
          kind,
          message:
            kind === 'mic-denied'
              ? "Accès au micro refusé. Autorisez le micro dans les réglages du navigateur."
              : kind === 'no-speech'
              ? "Aucune parole détectée. Réessayez en parlant plus près du micro."
              : "Une erreur est survenue pendant l'écoute.",
        })
        return
      }

      setState('processing')

      let detected: LanguageCode = sideLang
      if (sideLang === 'auto') {
        detected = detectLanguageHeuristic(result.text).lang
      }

      const resolvedSpeaker = resolveSpeakerFromLanguage(
        detected,
        conversation.langA,
        conversation.langB,
        lastSpeakerRef.current
      )
      const targetLang =
        resolvedSpeaker === 'A'
          ? conversation.langB === 'auto'
            ? 'en'
            : conversation.langB
          : conversation.langA === 'auto'
          ? 'fr'
          : conversation.langA

      try {
        const translation = await translationEngine({
          text: result.text,
          sourceLang: detected,
          targetLang,
          context: recentContext(conversation, CONTEXT_WINDOW),
          slangLevel: settingsService.load().slangLevel,
        })

        const turn = {
          id: crypto.randomUUID(),
          speaker: resolvedSpeaker,
          detectedLang: detected,
          originalText: result.text,
          translatedText: translation.translatedText,
          targetLang,
          timestamp: Date.now(),
          confidence: translation.confidence,
          providerUsed: translation.providerUsed,
          debug: translation.debug,
        }

        lastSpeakerRef.current = resolvedSpeaker
        setConversation((prev) => {
          const next = appendTurn(prev, turn)
          persist(next)
          return next
        })
        setState('translated')

        if (settingsService.load().autoPlayback) {
          setState('speaking')
          await tts.speak(translation.translatedText, targetLang, settingsService.load().speechRate)
        }
        setState('idle')
      } catch (e) {
        setState('error')
        setError({ kind: 'translation-failed', message: 'La traduction a échoué. Réessayez.' })
      }
    },
    [conversation, mic, speech, tts, persist]
  )

  const stopListening = useCallback(() => {
    speech.stop()
    mic.stop()
    setState('idle')
  }, [speech, mic])

  const clearError = useCallback(() => {
    setError(null)
    setState('idle')
  }, [])

  useEffect(() => () => {
    mic.stop()
    speech.stop()
    tts.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    conversation,
    state,
    error,
    activeSpeaker,
    amplitude: mic.amplitude,
    interimText: speech.interimText,
    isListening: speech.isListening,
    listenFor,
    stopListening,
    clearError,
    speechProviderName: speech.providerName,
    speechIsReal: speech.isReal,
    ttsIsReal: tts.isReal,
    settings,
  }
}
