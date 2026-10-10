"use client";

import type { ClientEventName, ClientEventProps } from "./events";

/**
 * Collecte côté navigateur. Règle absolue : rien n'est envoyé, ni même mis
 * en file, tant que l'utilisateur n'a pas accepté la mesure d'audience.
 * Les identifiants (session, visiteur) ne sont créés qu'après ce choix et
 * sont supprimés au retrait du consentement.
 */

type Queued = { id: string; name: string; ts: number; props: Record<string, unknown> };

const SID_KEY = "sfp_sid";
const VID_KEY = "sfp_vid";
const INTERNAL_KEY = "sfp_internal";
const VID_TTL_MS = 395 * 86400_000; // 13 mois

let enabled = false;
let queue: Queued[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
const onceKeys = new Set<string>();

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function sessionId(): string {
  return safe(() => {
    let sid = sessionStorage.getItem(SID_KEY);
    if (!sid) {
      sid = crypto.randomUUID();
      sessionStorage.setItem(SID_KEY, sid);
    }
    return sid;
  }, "nostorage-" + Math.random().toString(36).slice(2, 12));
}

function visitorId(): string | undefined {
  return safe(() => {
    const raw = localStorage.getItem(VID_KEY);
    if (raw) {
      const [id, ts] = raw.split(".");
      if (id && Date.now() - Number(ts) < VID_TTL_MS) return id;
    }
    const id = crypto.randomUUID();
    localStorage.setItem(VID_KEY, `${id}.${Date.now()}`);
    return id;
  }, undefined);
}

function isInternal(): boolean {
  return safe(() => {
    const url = new URL(location.href);
    if (url.searchParams.get("internal") === "1") localStorage.setItem(INTERNAL_KEY, "1");
    if (url.searchParams.get("internal") === "0") localStorage.removeItem(INTERNAL_KEY);
    return localStorage.getItem(INTERNAL_KEY) === "1";
  }, false);
}

function utm() {
  return safe(() => {
    const p = new URL(location.href).searchParams;
    const o = {
      source: p.get("utm_source") ?? undefined,
      medium: p.get("utm_medium") ?? undefined,
      campaign: p.get("utm_campaign") ?? undefined,
    };
    return o.source || o.medium || o.campaign ? o : undefined;
  }, undefined);
}

export function setAnalyticsEnabled(on: boolean) {
  enabled = on;
  if (!on) {
    queue = [];
    // Retrait du consentement : on efface les identifiants déjà posés.
    safe(() => {
      sessionStorage.removeItem(SID_KEY);
      localStorage.removeItem(VID_KEY);
    }, undefined);
  }
}

export function isAnalyticsEnabled() {
  return enabled;
}

function flush(useBeacon = false) {
  if (!queue.length || !enabled) return;
  const batch = queue.splice(0, 30);
  const body = JSON.stringify({
    sid: sessionId(),
    vid: visitorId(),
    internal: isInternal() || undefined,
    utm: utm(),
    events: batch,
  });
  if (useBeacon && navigator.sendBeacon) {
    navigator.sendBeacon("/api/events", new Blob([body], { type: "application/json" }));
  } else {
    fetch("/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  }
  if (queue.length) flush(useBeacon);
}

export function track<N extends ClientEventName>(name: N, props: ClientEventProps<N>, opts?: { once?: string }) {
  if (!enabled || typeof window === "undefined") return;
  // Robots déclarés et navigateurs pilotés : ignorés dès la source.
  if ((navigator as Navigator & { webdriver?: boolean }).webdriver && !isInternal()) return;
  if (opts?.once) {
    if (onceKeys.has(opts.once)) return;
    onceKeys.add(opts.once);
  }
  queue.push({ id: crypto.randomUUID(), name, ts: Date.now(), props: props as Record<string, unknown> });
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => flush(), 1500);
}

if (typeof window !== "undefined") {
  addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush(true);
  });
  addEventListener("pagehide", () => flush(true));
}
