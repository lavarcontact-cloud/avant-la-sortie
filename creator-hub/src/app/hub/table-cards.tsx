"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Sur mobile, chaque tableau devient une liste de fiches lisibles : on recopie l'intitulé
 * de colonne dans data-label (affiché par le CSS `table.rt`). Aucun changement de données.
 */
export function TableCards() {
  const path = usePathname();
  useEffect(() => {
    const apply = () => {
      document.querySelectorAll<HTMLTableElement>("main table").forEach((t) => {
        if (t.classList.contains("no-rt")) return;
        if (t.dataset.rtDone === "1" && t.querySelectorAll("td:not([data-label])").length === 0) return;
        const heads = [...t.querySelectorAll("thead th")].map((th) => (th.textContent ?? "").trim());
        if (!heads.length) return;
        t.classList.add("rt");
        t.parentElement?.classList.add("rt-wrap");
        t.querySelectorAll("tbody tr").forEach((tr) => [...tr.children].forEach((td, i) => { if (!td.hasAttribute("data-label")) td.setAttribute("data-label", heads[i] ?? ""); }));
        t.dataset.rtDone = "1";
      });
    };
    apply();
    const mo = new MutationObserver(apply);
    const main = document.querySelector("main");
    if (main) mo.observe(main, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [path]);
  return null;
}
