export default function DemoBadge({ isReal, label }: { isReal: boolean; label: string }) {
  return (
    <span
      className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border ${
        isReal
          ? 'text-primary border-primary/40 bg-primary/10'
          : 'text-accentB border-accentB/40 bg-accentB/10'
      }`}
      title={isReal ? `${label} — API réelle du navigateur` : `${label} — mode démo simulé`}
    >
      {isReal ? 'RÉEL' : 'DEMO'} · {label}
    </span>
  )
}
