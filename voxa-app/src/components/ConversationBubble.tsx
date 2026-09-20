import type { ConversationTurn } from '../types'
import { getLanguage } from '../lib/languages'

export default function ConversationBubble({ turn }: { turn: ConversationTurn }) {
  const isA = turn.speaker === 'A'
  const detected = getLanguage(turn.detectedLang)
  const target = getLanguage(turn.targetLang)
  const time = new Date(turn.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className={`flex ${isA ? 'justify-start' : 'justify-end'} animate-fadeUp`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
          isA ? 'bg-elevated border border-border rounded-tl-sm' : 'bg-accentA/10 border border-accentA/30 rounded-tr-sm'
        }`}
      >
        <div className="flex items-center gap-2 mb-1">
          <span
            className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${
              isA ? 'bg-primary/20 text-primary' : 'bg-accentB/20 text-accentB'
            }`}
          >
            {isA ? 'A' : 'B'}
          </span>
          <span className="text-xs text-muted">
            {detected.flag} {detected.name}
          </span>
          <span className="text-xs text-muted ml-auto">{time}</span>
        </div>
        <p className="text-ink/70 text-sm mb-1">{turn.originalText}</p>
        <p className="text-ink text-base font-medium">
          {target.flag} {turn.translatedText}
        </p>
        <div className="mt-1 text-[10px] text-muted/70">
          {turn.providerUsed} · confiance {Math.round(turn.confidence * 100)}%
        </div>
        {turn.debug ? (
          <div className="mt-1 text-[10px] text-red-400/80 break-words">{turn.debug}</div>
        ) : null}
      </div>
    </div>
  )
}
