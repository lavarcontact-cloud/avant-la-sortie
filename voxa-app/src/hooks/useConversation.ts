import { useCallback, useEffect, useRef, useState } from 'react'
import type { Conversation, EngineError, EngineState, LanguageCode, Speaker } from '../types'
import { useSpeechRecognition } from './useSpeechRecognition'
import { useTextToSpeech } from './useTextToSpeech'
import { useMicrophone } from './useMicrophone'
import { translationEngine } from '../lib/translationEngine'
import { detectLanguageHeuristic } from '../lib/languageDetection'
import { appendTurn, recentContext } from '../services/conversationService'
import { historyService } from '../services/historyService'
import { settingsService } from '../services/settingsService'
import { POST_TTS_LISTEN_DELAY_MS, isLikelyUnreliableContinuousSTT } from '../lib/conversationConfig'

const CONTEXT_WINDOW = Number(import.meta.env.VITE_CONTEXT_WINDOW) || 6

const RECOVERABLE_STT_ERRORS = new Set(['no-speech', 'aborted'])

function otherSpeaker(s: Speaker): Speaker {
  return s === 'A' ? 'B' : 'A'
}

/**
 * Drives the continuous, hands-free A <-> B conversation loop:
 *
 *   IDLE -> LISTENING_A -> PROCESSING_A -> TRANSLATING_A -> PLAYING_B ->
 *   LISTENING_B -> PROCESSING_B -> TRANSLATING_B -> PLAYING_A -> LISTENING_A -> ...
 *
 * Represented here as (phase, activeSpeaker) pairs rather than one giant
 * enum of 8 named states — semantically identical, easier to reuse the
 * existing EngineState type. Runs automatically until `stopSession()` is
 * called; never requires a page refresh.
 */
export function useConversation(initial: Conversation) {
  const [conversation, setConversation] = useState<Conversation>(initial)
  const [state, setState] = useState<EngineState>('idle')
  const [error, setError] = useState<EngineError | null>(null)
  const [activeSpeaker, setActiveSpeaker] = useState<Speaker>('A')
  const [sessionActive, setSessionActive] = useState(false)
  const [awaitingManualResume, setAwaitingManualResume] = useState(false)

  const speech = useSpeechRecognition()
  const tts = useTextToSpeech()
  const mic = useMicrophone()

  const settings = useRef(settingsService.load()).current
  const conversationRef = useRef(conversation)
  conversationRef.current = conversation

  // Generation counter: every new turn attempt bumps this. Any async
  // callback (STT result, translation result, TTS end) checks its captured
  // generation against the current one before acting, so a stale duplicate
  // event (e.g. two "final" results, or a turn started after Stop) is
  // silently ignored instead of firing a duplicate translation/TTS or
  // corrupting the active turn.
  const generationRef = useRef(0)
  const cycleRunningRef = useRef(false)
  // Mirrors `sessionActive` but read synchronously inside the loop, since
  // React state updates are async and the loop's recursive calls need the
  // up-to-the-instant value (e.g. right after startSession() sets it).
  const sessionActiveRef = useRef(false)

  const persist = useCallback((c: Conversation) => {
    if (settingsService.load().keepHistory) historyService.save(c)
  }, [])

  const isCurrent = (gen: number) => generationRef.current === gen

  const runTurnCycle = useCallback(
    async (speaker: Speaker) => {
      if (cycleRunningRef.current) return // never run two cycles concurrently
      cycleRunningRef.current = true
      const gen = ++generationRef.current

      try {
        setError(null)
        setAwaitingManualResume(false)
        setActiveSpeaker(speaker)
        setState('listening')

        const conv = conversationRef.current
        const sideLang: LanguageCode = speaker === 'A' ? conv.langA : conv.langB
        const otherLang: LanguageCode = speaker === 'A' ? conv.langB : conv.langA

        await mic.start()
        const result = await speech.listen(sideLang)
        mic.stop()

        if (!isCurrent(gen)) return // session was stopped / superseded meanwhile

        if ('error' in result) {
          if (result.error === 'mic-denied') {
            setSessionActive(false)
            setState('error')
            setError({
              kind: 'mic-denied',
              message: "Accès au micro refusé. Autorisez le micro dans les réglages du navigateur.",
            })
            return
          }

          if (RECOVERABLE_STT_ERRORS.has(result.error)) {
            // Nobody spoke (yet) or the engine dropped the recognition
            // session transiently: tell the user briefly and keep going
            // automatically rather than freezing the loop.
            setState('error')
            setError({
              kind: 'no-speech',
              message: 'Microphone interrompu — reprise automatique...',
            })
            cycleRunningRef.current = false
            if (sessionActiveRef.current || gen === 1) {
              setTimeout(() => {
                if (isCurrent(gen)) {
                  setError(null)
                  runTurnCycle(speaker)
                }
              }, 250)
            }
            return
          }

          // Non-recoverable STT error: pause and wait for an explicit tap.
          setState('error')
          setAwaitingManualResume(true)
          setError({
            kind: 'unknown',
            message: 'Microphone interrompu — appuyez pour reprendre.',
          })
          return
        }

        const transcript = result.text.trim()
        if (!transcript) {
          // Empty/whitespace-only transcript: no API call, just keep listening.
          cycleRunningRef.current = false
          if (sessionActiveRef.current) runTurnCycle(speaker)
          return
        }

        setState('processing')

        let detected: LanguageCode = sideLang
        if (sideLang === 'auto') {
          detected = detectLanguageHeuristic(transcript).lang
        }
        const targetLang: LanguageCode = otherLang === 'auto' ? (speaker === 'A' ? 'en' : 'fr') : otherLang

        setState('translating')

        let translation
        try {
          translation = await translationEngine({
            text: transcript,
            sourceLang: detected,
            targetLang,
            context: recentContext(conversationRef.current, CONTEXT_WINDOW),
            slangLevel: settingsService.load().slangLevel,
          })
        } catch (e) {
          if (!isCurrent(gen)) return
          setState('error')
          setError({ kind: 'translation-failed', message: 'La traduction a échoué. Réessayez.' })
          cycleRunningRef.current = false
          if (sessionActiveRef.current) {
            setTimeout(() => {
              if (isCurrent(gen)) {
                setError(null)
                runTurnCycle(speaker)
              }
            }, 600)
          }
          return
        }

        if (!isCurrent(gen)) return // superseded while translating

        const turn = {
          id: crypto.randomUUID(),
          speaker,
          detectedLang: detected,
          originalText: transcript,
          translatedText: translation.translatedText,
          targetLang,
          timestamp: Date.now(),
          confidence: translation.confidence,
          providerUsed: translation.providerUsed,
          debug: translation.debug,
        }

        setConversation((prev) => {
          const next = appendTurn(prev, turn)
          persist(next)
          return next
        })

        const advance = () => {
          cycleRunningRef.current = false
          if (isCurrent(gen) && sessionActiveRef.current) {
            setTimeout(() => {
              if (isCurrent(gen)) runTurnCycle(otherSpeaker(speaker))
            }, POST_TTS_LISTEN_DELAY_MS)
          }
        }

        if (settingsService.load().autoPlayback) {
          setState('speaking')
          try {
            await tts.speak(translation.translatedText, targetLang, settingsService.load().speechRate)
          } catch {
            /* TTS unavailable: fall through and resume listening anyway */
          }
        }

        if (!isCurrent(gen)) return
        advance()
      } finally {
        // no-op; cycleRunningRef is cleared on every return path above
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mic, speech, tts, persist]
  )

  const startSession = useCallback(
    (firstSpeaker: Speaker = 'A') => {
      // Must run synchronously inside the tap handler, before any await —
      // see VoiceProvider.primeForUserGesture for why.
      tts.primeForUserGesture()
      sessionActiveRef.current = true
      setSessionActive(true)
      cycleRunningRef.current = false
      runTurnCycle(firstSpeaker)
    },
    [runTurnCycle, tts]
  )

  const stopSession = useCallback(() => {
    generationRef.current += 1 // invalidate any in-flight cycle
    cycleRunningRef.current = false
    sessionActiveRef.current = false
    setSessionActive(false)
    setAwaitingManualResume(false)
    speech.stop()
    mic.stop()
    tts.stop()
    setState('idle')
    setError(null)
  }, [speech, mic, tts])

  // Explicit tap to resume after a non-recoverable STT error (or after
  // mic-denied once permission has been re-granted). Restarts the session
  // for the speaker whose turn was interrupted.
  const resumeAfterError = useCallback(() => {
    tts.primeForUserGesture()
    setError(null)
    setAwaitingManualResume(false)
    sessionActiveRef.current = true
    setSessionActive(true)
    runTurnCycle(activeSpeaker)
  }, [runTurnCycle, activeSpeaker, tts])

  const clearError = useCallback(() => {
    resumeAfterError()
  }, [resumeAfterError])

  useEffect(
    () => () => {
      mic.stop()
      speech.stop()
      tts.stop()
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    []
  )

  return {
    conversation,
    state,
    error,
    activeSpeaker,
    sessionActive,
    awaitingManualResume,
    amplitude: mic.amplitude,
    interimText: speech.interimText,
    isListening: speech.isListening,
    startSession,
    stopSession,
    resumeAfterError,
    clearError,
    speechProviderName: speech.providerName,
    speechIsReal: speech.isReal,
    ttsIsReal: tts.isReal,
    continuousSttUnreliable: isLikelyUnreliableContinuousSTT(),
    settings,
  }
}
