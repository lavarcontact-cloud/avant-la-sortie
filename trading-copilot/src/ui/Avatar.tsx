// Vigie : une sentinelle géométrique. Son expression reflète l'état RÉEL
// (données, limites de risque), jamais un effet décoratif.
import type { Mood } from '../copilot/copilot';

const MOOD_COLOR: Record<Mood, string> = { calme: 'var(--accent)', attentif: 'var(--info)', alerte: 'var(--warn)', reserve: 'var(--muted)' };
export const MOOD_LABEL: Record<Mood, string> = { calme: 'calme', attentif: 'attentive', alerte: 'en alerte', reserve: 'en réserve (données insuffisantes)' };

export function Avatar({ mood = 'calme', size = 44 }: { mood?: Mood; size?: number }) {
  const c = MOOD_COLOR[mood];
  const eyeH = mood === 'alerte' ? 7 : mood === 'reserve' ? 2.5 : 5.5;
  const look = mood === 'attentif' ? 2 : 0;
  return (
    <svg className="avatar" width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={`Vigie, ${MOOD_LABEL[mood]}`}>
      <defs>
        <linearGradient id="vg-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2a3040" />
          <stop offset="1" stopColor="#12151d" />
        </linearGradient>
      </defs>
      <circle className="halo" cx="32" cy="34" r="29" fill="none" stroke={c} strokeWidth="1.5" opacity=".5" />
      <path d="M32 6 l3 7 h-6 z" fill={c} />
      <rect x="10" y="13" width="44" height="42" rx="18" fill="url(#vg-body)" stroke="#3a4152" />
      <rect x="16" y="24" width="32" height="18" rx="9" fill="#07080b" />
      <ellipse className="eye" cx={25 + look} cy="33" rx="3.4" ry={eyeH} fill={c} />
      <ellipse className="eye" cx={39 + look} cy="33" rx="3.4" ry={eyeH} fill={c} />
      {mood === 'alerte' && <rect x="29" y="47" width="6" height="3" rx="1.5" fill={c} />}
      {mood !== 'alerte' && <path d={mood === 'reserve' ? 'M27 49 h10' : 'M27 48 q5 3 10 0'} stroke="#5b6377" strokeWidth="2" fill="none" strokeLinecap="round" />}
    </svg>
  );
}
