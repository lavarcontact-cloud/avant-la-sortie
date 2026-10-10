const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
const I = ({ d }: { d: string }) => <svg viewBox="0 0 24 24" aria-hidden="true" {...P}><path d={d} /></svg>;
export const Icon = {
  cockpit: () => <I d="M4 13a8 8 0 1 1 16 0M12 13l4-4M7 17h10" />,
  market: () => <I d="M4 19h16M7 15V9M12 15V5M17 15v-4" />,
  radar: () => <I d="M12 12l6-6M12 3a9 9 0 1 0 9 9M12 7a5 5 0 1 0 5 5" />,
  feed: () => <I d="M5 4h14v6H5zM5 14h14v6H5z" />,
  copilot: () => <I d="M5 18l-1 3 3-1h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v8M9 10h.01M15 10h.01" />,
  pro: () => <I d="M4 20V4M4 20h16M8 16l3-4 3 2 5-7" />,
  goal: () => <I d="M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8z" />,
  settings: () => <I d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4 12h2M18 12h2M12 4v2M12 18v2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4" />,
  info: () => <I d="M12 16v-5M12 8h.01M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18z" />,
};
