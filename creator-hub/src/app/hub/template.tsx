// Remonté à chaque navigation : sert d'animation d'entrée des pages.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
