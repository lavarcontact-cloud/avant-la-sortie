import { Icon } from "./icons";
import type { ProfileSettings } from "@/lib/settings";

export const SOCIALS = [
  { key: "instagram", label: "Instagram" },
  { key: "tiktok", label: "TikTok" },
  { key: "snapchat", label: "Snapchat" },
  { key: "youtube", label: "YouTube" },
  { key: "linkedin", label: "LinkedIn" },
] as const;

/** Liens vers les réseaux renseignés dans Paramètres → Profil. Aucune URL n'est inventée. */
export function socialList(p: ProfileSettings) {
  return SOCIALS.map((s) => ({ ...s, url: ((p as any)[s.key] as string | undefined)?.trim() ?? "" })).filter((s) => /^https:\/\//.test(s.url));
}

export function SocialLinks({ profile, variant = "dark", size = "md" }: { profile: ProfileSettings; variant?: "dark" | "light"; size?: "md" | "lg" }) {
  const links = socialList(profile);
  if (!links.length) return null;
  const base = variant === "dark"
    ? "border-white/15 text-paper hover:border-accent hover:bg-accent hover:text-white"
    : "border-ink/15 text-ink hover:border-ink hover:bg-ink hover:text-paper";
  return (
    <ul className="flex flex-wrap gap-2.5">
      {links.map((l) => (
        <li key={l.key}>
          <a href={l.url} target="_blank" rel="noopener noreferrer me" aria-label={`${l.label} (nouvel onglet)`}
            className={`group inline-flex items-center gap-2 rounded-full border transition duration-300 ${size === "lg" ? "px-5 py-3 text-[0.95rem]" : "px-4 py-2.5 text-sm"} ${base}`}>
            <Icon name={l.key} size={size === "lg" ? 20 : 17} />
            <span className="font-medium">{l.label}</span>
            <Icon name="external" size={13} className="opacity-50 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
          </a>
        </li>
      ))}
    </ul>
  );
}
