"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import { setAnalyticsEnabled } from "@/lib/analytics/client";
import {
  CONSENT_COOKIE,
  CONSENT_MAX_AGE_DAYS,
  POLICY_VERSION,
  parseConsent,
  serializeConsent,
  type ConsentChoices,
  type ConsentRecord,
} from "@/lib/consent";

type Ctx = {
  record: ConsentRecord | null;
  ready: boolean;
  save: (choices: ConsentChoices, action: "accept_all" | "reject_all" | "custom") => void;
  openPreferences: () => void;
};

const ConsentContext = createContext<Ctx | null>(null);

export function useConsent() {
  const ctx = useContext(ConsentContext);
  if (!ctx) throw new Error("useConsent hors ConsentProvider");
  return ctx;
}

function readCookie(): string | undefined {
  return document.cookie
    .split("; ")
    .find((c) => c.startsWith(CONSENT_COOKIE + "="))
    ?.slice(CONSENT_COOKIE.length + 1);
}

export function ConsentProvider({ children }: { children: React.ReactNode }) {
  const [record, setRecord] = useState<ConsentRecord | null>(null);
  const [ready, setReady] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  // Pas de bandeau dans l'espace privé : aucune mesure d'audience n'y a lieu.
  const isAdminArea = usePathname().startsWith("/admin");

  useEffect(() => {
    const rec = parseConsent(readCookie());
    setRecord(rec);
    setAnalyticsEnabled(!!rec?.choices.audience);
    setReady(true);
  }, []);

  const save = useCallback<Ctx["save"]>((choices, action) => {
    const rec: ConsentRecord = {
      v: POLICY_VERSION,
      id: record?.id ?? crypto.randomUUID(),
      choices,
      ts: Date.now(),
    };
    const secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${CONSENT_COOKIE}=${serializeConsent(rec)}; Max-Age=${CONSENT_MAX_AGE_DAYS * 86400}; Path=/; SameSite=Lax${secure}`;
    setRecord(rec);
    setAnalyticsEnabled(choices.audience);
    setPrefsOpen(false);
    // Preuve du consentement (identifiant aléatoire, choix, version, date).
    fetch("/api/consent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: rec.id, version: rec.v, choices, action }),
      keepalive: true,
    }).catch(() => {});
  }, [record]);

  const openPreferences = useCallback(() => setPrefsOpen(true), []);

  return (
    <ConsentContext.Provider value={{ record, ready, save, openPreferences }}>
      {children}
      {ready && !isAdminArea && (!record || prefsOpen) && (
        <ConsentBanner
          initial={record?.choices ?? { audience: false }}
          expanded={prefsOpen}
          onClose={record ? () => setPrefsOpen(false) : undefined}
        />
      )}
    </ConsentContext.Provider>
  );
}

function ConsentBanner({
  initial,
  expanded,
  onClose,
}: {
  initial: ConsentChoices;
  expanded: boolean;
  onClose?: () => void;
}) {
  const { save } = useConsent();
  const [custom, setCustom] = useState(expanded);
  const [audience, setAudience] = useState(initial.audience);
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (expanded) ref.current?.querySelector<HTMLElement>("button, input")?.focus();
  }, [expanded]);

  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      className="glass glass-strong fixed inset-x-3 z-[70] mx-auto max-w-xl rounded-[var(--radius-glass)] p-5 rise"
      style={{ bottom: "calc(var(--dock-h) + var(--safe-b) + 20px)" }}
      data-testid="consent-banner"
    >
      <p id={titleId} className="t-display text-xl">Vos choix sur ce site</p>
      <p className="mt-2 text-[15px] text-[#d9d5cc]">
        Avec votre accord, nous mesurons l'audience du site (pages vues, lectures vidéo, clics) pour
        comprendre ce qui intéresse les visiteurs. Ces statistiques restent sur nos serveurs et ne
        servent à aucune publicité. Vous pouvez changer d'avis à tout moment via "Cookies" en bas de
        page.{" "}
        <Link href="/cookies" className="underline underline-offset-2">
          En savoir plus
        </Link>
      </p>

      {custom && (
        <fieldset className="mt-4 space-y-3">
          <legend className="sr-only">Catégories</legend>
          <div className="flex items-start justify-between gap-4 rounded-2xl border border-[var(--color-line)] p-3">
            <div>
              <p className="font-semibold">Nécessaires</p>
              <p className="text-sm text-[var(--color-muted)]">Mémoriser vos choix, sécuriser l'espace privé. Toujours actifs.</p>
            </div>
            <span className="t-eyebrow mt-1">Actif</span>
          </div>
          <label className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl border border-[var(--color-line)] p-3">
            <span>
              <span className="block font-semibold">Mesure d'audience</span>
              <span className="block text-sm text-[var(--color-muted)]">
                Statistiques internes de fréquentation et d'usage. Identifiant conservé 13 mois, statistiques 25 mois au plus.
              </span>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={audience}
              onChange={(e) => setAudience(e.target.checked)}
              className="mt-1 h-6 w-6 accent-[var(--color-accent)]"
              aria-label="Mesure d'audience"
            />
          </label>
        </fieldset>
      )}

      {/* Refuser et Accepter : même taille, même poids visuel (CNIL). */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" className="btn btn-ghost" onClick={() => save({ audience: false }, "reject_all")}>
          Tout refuser
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => save({ audience: true }, "accept_all")}>
          Tout accepter
        </button>
      </div>
      <div className="mt-2 flex justify-between gap-2">
        {custom ? (
          <button type="button" className="btn btn-primary w-full" onClick={() => save({ audience }, "custom")}>
            Enregistrer mes choix
          </button>
        ) : (
          <button type="button" className="text-sm underline underline-offset-2 min-h-[44px]" onClick={() => setCustom(true)}>
            Personnaliser
          </button>
        )}
        {onClose && !custom && (
          <button type="button" className="text-sm underline underline-offset-2 min-h-[44px]" onClick={onClose}>
            Fermer
          </button>
        )}
      </div>
    </div>
  );
}

export function ManageCookiesButton({ className }: { className?: string }) {
  const { openPreferences } = useConsent();
  return (
    <button type="button" onClick={openPreferences} className={className}>
      Cookies
    </button>
  );
}
