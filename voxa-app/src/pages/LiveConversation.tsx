import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import BackHeader from '../components/BackHeader'
import Waveform from '../components/Waveform'
import ConversationBubble from '../components/ConversationBubble'
import DemoBadge from '../components/DemoBadge'
import ErrorBanner from '../components/ErrorBanner'
import { useConversation } from '../hooks/useConversation'
import { createConversation } from '../services/conversationService'
import { getLanguage } from '../lib/languages'
import { providerFlags, isLiveTranslationProviderName } from '../providers'
import type { LanguageCode, Speaker } from '../types'

const STATE_LABEL: Record<string, string> = {
  idle: 'Prêt',
  listening: 'Écoute...',
  processing: 'Traduction...',
  translated: 'Traduit',
  speaking: 'Lecture...',
  error: 'Erreur',
}

export default function LiveConversation() {
  const location = useLocation() as { state?: { langA: LanguageCode; langB: LanguageCode } }
  const navigate = useNavigate()
  const langA = location.state?.langA ?? 'fr'
  const langB = location.state?.langB ?? 'en'

  const conversationRef = useRef(createConversation(langA, langB))
  const {
    conversation,
    state,
    error,
    activeSpeaker,
    amplitude,
    interimText,
    isListening,
    listenFor,
    stopListening,
    clearError,
  } = useConversation(conversationRef.current)

  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [conversation.turns.length, interimText])

  const busy = state === 'listening' || state === 'processing' || state === 'speaking'

  // Honest LIVE/DEMO badge for translation: reflects which provider actually
  // served the LAST translation, never just whether an API key exists.
  const lastTurn = conversation.turns[conversation.turns.length - 1]
  const lastTranslationWasLive = lastTurn ? isLiveTranslationProviderName(lastTurn.providerUsed) : null

  const handleMicPress = (side: Speaker) => {
    if (isListening) {
      stopListening()
      return
    }
    if (busy) return
    listenFor(side)
  }

  return (
    <div className="flex-1 flex flex-col safe-top safe-bottom">
      <BackHeader title="Conversation en direct" to="/" />

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

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
        {conversation.turns.length === 0 && (
          <div className="text-center text-muted text-sm mt-10 px-6">
            Posez le téléphone entre vous deux et appuyez sur le micro du côté qui parle.
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

      {error && <ErrorBanner error={error} onRetry={() => { clearError(); handleMicPress(activeSpeaker) }} onDismiss={clearError} />}

      <div className="px-4 pb-2">
        <Waveform amplitude={amplitude} active={isListening} color={activeSpeaker === 'A' ? '#7dd3c0' : '#e8a87c'} />
      </div>

      <div className="px-4 pb-8">
        <p className="text-center text-sm text-muted mb-4 h-4">{STATE_LABEL[state]}</p>
        <div className="flex items-center justify-center gap-6">
          <MicButton
            side="A"
            active={activeSpeaker === 'A' && isListening}
            disabled={busy && activeSpeaker !== 'A'}
            onPress={() => handleMicPress('A')}
          />
          <MicButton
            side="B"
            active={activeSpeaker === 'B' && isListening}
            disabled={busy && activeSpeaker !== 'B'}
            onPress={() => handleMicPress('B')}
          />
        </div>
      </div>
    </div>
  )
}

function MicButton({
  side,
  active,
  disabled,
  onPress,
}: {
  side: Speaker
  active: boolean
  disabled: boolean
  onPress: () => void
}) {
  const color = side === 'A' ? 'bg-primary text-void' : 'bg-accentB text-void'
  return (
    <button
      onClick={onPress}
      disabled={disabled}
      className={`flex flex-col items-center gap-2 ${disabled ? 'opacity-40' : ''}`}
    >
      <div
        className={`w-20 h-20 rounded-full flex items-center justify-center text-xl font-bold shadow-soft transition ${
          active ? `${color} animate-pulseSoft scale-105` : 'bg-elevated border border-border text-ink'
        }`}
      >
        🎙️
      </div>
      <span className="text-xs text-muted font-medium">Personne {side}</span>
    </button>
  )
}
