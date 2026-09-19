import { useNavigate } from 'react-router-dom'

export default function Home() {
  const navigate = useNavigate()
  return (
    <div className="flex-1 flex flex-col justify-between px-6 py-10 safe-top safe-bottom">
      <div />
      <div className="flex flex-col items-center text-center gap-4">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/30 to-accentB/20 border border-border flex items-center justify-center text-3xl font-bold text-primary shadow-soft">
          V
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight">VOXA</h1>
        <p className="text-muted text-base max-w-xs">Parlez. L'application s'occupe du reste.</p>
      </div>
      <div className="flex flex-col gap-3">
        <button
          onClick={() => navigate('/setup')}
          className="w-full py-4 rounded-2xl bg-primary text-void font-semibold text-base active:scale-[0.98] transition shadow-soft"
        >
          Commencer une conversation
        </button>
        <button
          onClick={() => navigate('/setup')}
          className="w-full py-4 rounded-2xl bg-elevated border border-border text-ink font-medium text-base active:scale-[0.98] transition"
        >
          Choisir les langues
        </button>
        <div className="flex justify-center gap-6 pt-4 text-sm text-muted">
          <button onClick={() => navigate('/history')} className="underline-offset-4 hover:underline">
            Historique
          </button>
          <button onClick={() => navigate('/settings')} className="underline-offset-4 hover:underline">
            Réglages
          </button>
        </div>
      </div>
    </div>
  )
}
