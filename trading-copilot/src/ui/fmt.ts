export { eur, pc, dt } from '../copilot/copilot';

export const qty = (x: number) => x.toLocaleString('fr-FR', { maximumFractionDigits: 8 });
export const sign = (x: number) => (x > 0 ? 'gain' : x < 0 ? 'loss' : '');
export const ago = (t: number, now: number) => {
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return `il y a ${s} s`;
  if (s < 3600) return `il y a ${Math.round(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.round(s / 3600)} h`;
  return `il y a ${Math.round(s / 86400)} j`;
};
export const dday = (t: number) => new Date(t).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
