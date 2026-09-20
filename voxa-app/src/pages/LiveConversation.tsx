import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import BackHeader from '../components/BackHeader'
import Waveform from '../components/Waveform'
import ConversationBubble from '../components/ConversationBubble'
import DemoBadge from '../components/DemoBadge'
import ErrorBanner from '../components/ErrorBanner'
import { useConversation } from '../hooks/useConversation'
import { createConversation } from '../services/conversationService'
import { getLanguage } from '../lib/languages'
import { providerFlags, isLiveTranslationProviderName } from '../providers'
import type { EngineState, LanguageCode, Speaker } from '../types'

function stateIndicator(state: EngineState, speaker: Speaker): { label: string; sub: string } {
  switch (state) {
    case 'listening':
      return speaker === 'A'
        ? { label: '🎙️ À VOUS', sub: 'Parlez naturellement' }
        : { label: '🎙️ À l’autre personne', sub: 'Speak now' }
    case 'processing':
    case 'translating':
      return { label: '◉ LOBA traduit', sub: 'Un instant...' }
    case 'speaking':
      return { label: '🔊 LOBA parle', sub: '' }
    case 'error':
      return { label: '⚠️ Pause', sub: '' }
    default:
      return { label: 'LOBA', sub: 'Appuyez pour démarrer' }
  }
}

export default function LiveConversation() {
  const location = useLocation() as { state?: { langA: LanguageCode; langB: LanguageCode } }
  const langA = location.state?.langA ?? 'fr'
  const langB = location.state?.langB ?? 'en'

  const conversationRef = useRef(createConversation(langA, langB))
  const {
    conversation,
    state,
    error,
    activeSpeaker,
    sessionActive,
    awaitingManualResume,
    amplitude,
    interimText,
    isListening,
    startSession,
    stopSession,
    resumeAfterError,
    continuousSttUnreliable,
  } = useConversation(conversationRef.current)

  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [conversation.turns.length, interimText])

  // Honest LIVE/DEMO badge for translation: reflects which provider actually
  // served the LAST translation, never just whether an API key exists.
  const lastTurn = conversation.turns[conversation.turns.length - 1]
  const lastTranslationWasLive = lastTurn ? isLiveTranslationProviderName(lastTurn.providerUsed) : null

  const indicator = stateIndicator(state, activeSpeaker)
  const speaking = state === 'speaking'
  const processing = state === 'processing' || state === 'translating'

  return (
    <div className="flex-1 flex flex-col safe-top safe-bottom">
      <BackHeader title="LOBA" to="/" />

      <div className="px-4 flex items-center justify-between text-xs text-muted mb-2">
        <span>
          {getLanguage(langA).flag} {getLanguage(langA).name} ⇄ {getLanguage(langB).flag} {getLanguage(langB).name}
        </span>
        <div className="flex gap-1.5">
          <DemoBadge isReal={providerFlags.speechIsReal} label="Voix→texte" />
          {lastTranslationWasLive !== null && (
            <DemoBadge isReal={lastTranslationWasLive} label="Traduction" />
          )}
        </div>
      </div>

      {continuousSttUnreliable && (
        <div className="mx-4 mb-2 rounded-lg bg-elevated/60 border border-border/60 px-3 py-2 text-[11px] text-muted">
          L'écoute continue peut être limitée sur ce navigateur (Safari iOS). Si LOBA
          s'arrête d'écouter de façon inattendue, appuyez sur "Reprendre".
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
        {conversation.turns.length === 0 && !sessionActive && (
          <div className="text-center text-muted text-sm mt-10 px-6">
            Posez le téléphone entre vous deux et appuyez sur Démarrer. LOBA écoute,
            traduit et parle automatiquement, à tour de rôle, sans autre geste.
          </div>
        )}
        {conversation.turns.map((turn) => (
          <ConversationBubble key={turn.id} turn={turn} />
        ))}
        {isListening && interimText && (
          <div className={`flex ${activeSpeaker === 'A' ? 'justify-start' : 'justify-end'}`}>
            <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-elevated/60 border border-border/60 text-ink/60 italic text-sm">
              {interimText}
            </div>
          </div>
        )}
      </div>

      {error && (
        <ErrorBanner
          error={error}
          onRetry={resumeAfterError}
          onDismiss={() => (awaitingManualResume ? stopSession() : resumeAfterError())}
        />
      )}

      <div className="px-4 pb-2">
        <Waveform
          amplitude={amplitude}
          active={isListening || speaking}
          color={
            speaking
              ? '#c084fc'
              : processing
              ? '#e8a87c'
              : activeSpeaker === 'A'
              ? '#7dd3c0'
              : '#e8a87c'
          }
        />
      </div>

      <div className="px-4 pb-8">
        <div className="text-center mb-6">
          <p className="text-xl font-bold text-ink">{indicator.label}</p>
          {indicator.sub && <p className="text-sm text-muted mt-1">{indicator.sub}</p>}
        </div>

        <div className="flex items-center justify-center">
          {!sessionActive ? (
            <button
              onClick={() => startSession('A')}
              className="px-8 py-4 rounded-full bg-primary text-void font-bold text-base shadow-soft"
            >
              ▶ Démarrer
            </button>
          ) : (
            <button
              onClick={stopSession}
              className="px-8 py-4 rounded-full bg-elevated border border-border text-ink font-bold text-base shadow-soft"
            >
              ⏹ Arrêter
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
