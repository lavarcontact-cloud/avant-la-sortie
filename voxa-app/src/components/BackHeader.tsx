import { useNavigate } from 'react-router-dom'

export default function BackHeader({ title, to }: { title: string; to?: string }) {
  const navigate = useNavigate()
  return (
    <div className="flex items-center gap-3 px-4 pt-6 pb-2 safe-top">
      <button
        onClick={() => (to ? navigate(to) : navigate(-1))}
        className="w-9 h-9 flex items-center justify-center rounded-full bg-elevated border border-border text-ink/80 active:scale-95 transition"
        aria-label="Retour"
      >
        ←
      </button>
      <h1 className="text-lg font-semibold">{title}</h1>
    </div>
  )
}
