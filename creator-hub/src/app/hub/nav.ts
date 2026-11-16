export const NAV = [
  { href: "/hub", label: "Dashboard", icon: "dashboard", group: "Pilotage" },
  { href: "/hub/watch", label: "Veille", icon: "radar", countKey: "watch", group: "Pilotage" },
  { href: "/hub/forecast", label: "Business Forecast", icon: "trend", group: "Pilotage" },
  { href: "/hub/audience", label: "Audience Value", icon: "audience", group: "Pilotage" },
  { href: "/hub/brands", label: "Marques", icon: "brands", group: "Relation" },
  { href: "/hub/pipeline", label: "Pipeline", icon: "pipeline", group: "Relation" },
  { href: "/hub/followups", label: "Relances", icon: "refresh", countKey: "followups", group: "Relation" },
  { href: "/hub/responses", label: "Réponses", icon: "inbox", group: "Relation" },
  { href: "/hub/contacts", label: "Interlocuteurs", icon: "contacts", group: "Relation" },
  { href: "/hub/finance", label: "Finances", icon: "wallet", group: "Argent" },
  { href: "/hub/documents", label: "Devis & factures", icon: "document", group: "Argent" },
  { href: "/hub/notifications", label: "Notifications", icon: "bell", countKey: "notifs", group: "Système" },
  { href: "/hub/reports", label: "Bilans", icon: "clock", group: "Système" },
  { href: "/hub/settings", label: "Paramètres", icon: "settings", group: "Système" },
] as const;
export const MOBILE_TABS = ["/hub", "/hub/brands", "/hub/watch", "/hub/followups"] as const;
