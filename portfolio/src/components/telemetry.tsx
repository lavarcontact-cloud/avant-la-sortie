"use client";

import { usePathname } from "next/navigation";
import { useReportWebVitals } from "next/web-vitals";
import { useEffect } from "react";
import { track } from "@/lib/analytics/client";
import { useConsent } from "./consent";

/** Pages vues, Core Web Vitals réels et erreurs JS, sous réserve de consentement. */
export function Telemetry() {
  const pathname = usePathname();
  const { record } = useConsent();
  const allowed = !!record?.choices.audience;

  useEffect(() => {
    if (!allowed || pathname.startsWith("/admin")) return;
    // Le jeton de paiement est un secret : jamais dans les statistiques.
    track("page_view", { path: pathname.startsWith("/paiement/") ? "/paiement/[jeton]" : pathname, referrer: document.referrer || undefined });
  }, [pathname, allowed]);

  useReportWebVitals((m) => {
    if (!["LCP", "CLS", "INP", "FCP", "TTFB"].includes(m.name)) return;
    track("web_vital", {
      name: m.name as "LCP",
      value: Math.round(m.name === "CLS" ? m.value * 1000 : m.value),
      rating: m.rating,
    });
  });

  useEffect(() => {
    const onError = (e: ErrorEvent) =>
      track("js_error", { message: String(e.message).slice(0, 300), source: e.filename?.slice(0, 300) });
    addEventListener("error", onError);
    return () => removeEventListener("error", onError);
  }, []);

  return null;
}
