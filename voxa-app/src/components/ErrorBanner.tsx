import type { EngineError } from '../types'

export default function ErrorBanner({ error, onRetry, onDismiss }: { error: EngineError; onRetry: () => void; onDismiss: () => void }) {
  return (
    <div className="mx-4 mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 animate-fadeUp">
      <p className="text-sm text-red-300">{error.message}</p>
      <div className="mt-2 flex gap-3">
        <button onClick={onRetry} className="text-xs font-semibold text-red-200 underline underline-offset-2">
          Réessayer
        </button>
        <button onClick={onDismiss} className="text-xs text-red-300/70">
          Ignorer
        </button>
      </div>
    </div>
  )
}
