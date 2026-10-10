"use client";

import Link from "next/link";
import { track } from "@/lib/analytics/client";
import type { ClientEventProps } from "@/lib/analytics/events";

/** Lien d'appel à l'action instrumenté (clic mesuré si consentement). */
export function CtaLink({
  href,
  cta,
  surface,
  className,
  children,
}: {
  href: string;
  cta: ClientEventProps<"cta_click">["cta"];
  surface: string;
  className?: string;
  children: React.ReactNode;
}) {
  const external = /^(mailto:|tel:|https?:)/.test(href);
  const onClick = () => track("cta_click", { cta, surface });
  return external ? (
    <a href={href} className={className} onClick={onClick}>
      {children}
    </a>
  ) : (
    <Link href={href} className={className} onClick={onClick}>
      {children}
    </Link>
  );
}
