// Génération PDF des devis et factures (pdf-lib, polices standard, aucun service externe).
import { PDFDocument, StandardFonts, rgb, degrees, type PDFFont, type PDFPage } from "pdf-lib";
import { docTotals, type DocLine } from "./money";
import type { LegalSettings } from "./settings";

export interface PdfDoc {
  kind: "quote" | "invoice"; number: string | null; status: string; client_name: string; client_address: string | null;
  client_siret: string | null; client_vat: string | null; client_email: string | null; issue_date: string | null; due_date: string | null;
  lines: DocLine[]; deposit: number; paid_amount: number; notes: string | null; currency: string;
}

// WinAnsi (polices standard) : on normalise les caractères non supportés.
const WINANSI_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
export function sanitize(s: string): string {
  return (s ?? "")
    .replace(/[   ]/g, " ")
    .replace(/[‐‑]/g, "-")
    .replace(/\t/g, "  ")
    .split("")
    .map((c) => (c === "\n" || (c.charCodeAt(0) >= 32 && c.charCodeAt(0) <= 255) || WINANSI_EXTRA.includes(c) ? c : "?"))
    .join("");
}

const money = (n: number, cur = "EUR") => sanitize(new Intl.NumberFormat("fr-FR", { style: "currency", currency: cur }).format(n));
const dfmt = (v: string | null) => (v ? new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(v.slice(0, 10) + "T12:00:00Z")) : "—");

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = [];
  for (const para of sanitize(text).split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/)) {
      const test = line ? line + " " + word : word;
      if (font.widthOfTextAtSize(test, size) > width && line) { out.push(line); line = word; } else line = test;
    }
    out.push(line);
  }
  return out;
}

const INK = rgb(0.07, 0.07, 0.09), MUTED = rgb(0.42, 0.42, 0.47), LINE = rgb(0.88, 0.88, 0.9), ACCENT = rgb(1, 0.357, 0.235), SOFT = rgb(0.965, 0.965, 0.972);

export async function renderDocumentPdf(doc: PdfDoc, legal: LegalSettings, finalized: boolean): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const isInvoice = doc.kind === "invoice";
  pdf.setTitle(`${isInvoice ? "Facture" : "Devis"} ${doc.number ?? "brouillon"}`);
  pdf.setCreator("Creator Business & PR Hub");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 595.28, H = 841.89, M = 48;
  let page = pdf.addPage([W, H]);
  let y = H - M;

  const text = (p: PDFPage, s: string, x: number, yy: number, o: { size?: number; f?: PDFFont; color?: ReturnType<typeof rgb>; align?: "left" | "right" } = {}) => {
    const size = o.size ?? 9, f = o.f ?? font, str = sanitize(s);
    const xx = o.align === "right" ? x - f.widthOfTextAtSize(str, size) : x;
    p.drawText(str, { x: xx, y: yy, size, font: f, color: o.color ?? INK });
  };
  const watermark = (p: PDFPage) => {
    if (finalized) return;
    p.drawText("BROUILLON - NON FINALISÉ", { x: 90, y: 300, size: 46, font: bold, color: rgb(0.93, 0.3, 0.2), opacity: 0.12, rotate: degrees(35) });
  };
  watermark(page);

  // En-tête
  page.drawRectangle({ x: M, y: y - 2, width: 28, height: 3, color: ACCENT });
  y -= 22;
  const emitter = legal.trade_name || legal.legal_name || "[Identité légale non renseignée]";
  text(page, emitter, M, y, { size: 15, f: bold });
  text(page, isInvoice ? "FACTURE" : "DEVIS", W - M, y, { size: 15, f: bold, align: "right" });
  y -= 16;
  text(page, doc.number ? `N° ${doc.number}` : "Numéro attribué à l'émission", W - M, y, { size: 9, color: MUTED, align: "right" });
  y -= 12;
  text(page, `Date : ${dfmt(doc.issue_date)}`, W - M, y, { size: 9, color: MUTED, align: "right" });
  y -= 12;
  text(page, `${isInvoice ? "Échéance" : "Valable jusqu'au"} : ${dfmt(doc.due_date)}`, W - M, y, { size: 9, color: MUTED, align: "right" });

  // Émetteur
  let ey = y + 24;
  const emitterLines = [
    legal.trade_name && legal.legal_name && legal.trade_name !== legal.legal_name ? legal.legal_name : "",
    legal.legal_status, legal.address,
    legal.siret ? `SIRET ${legal.siret}` : legal.siren ? `SIREN ${legal.siren}` : "",
    legal.ape ? `APE ${legal.ape}` : "",
    !legal.vat_exempt && legal.vat_number ? `TVA ${legal.vat_number}` : "",
    legal.email, legal.phone,
  ].filter(Boolean);
  for (const l of emitterLines) for (const w of wrap(l, font, 9, 250)) { text(page, w, M, ey, { color: MUTED }); ey -= 12; }
  y = Math.min(ey, y) - 22;

  // Client
  page.drawRectangle({ x: W / 2, y: y - 74, width: W / 2 - M, height: 84, color: SOFT });
  let cy = y - 6;
  text(page, isInvoice ? "FACTURÉ À" : "DESTINATAIRE", W / 2 + 12, cy, { size: 7.5, f: bold, color: MUTED }); cy -= 14;
  text(page, doc.client_name, W / 2 + 12, cy, { size: 10.5, f: bold }); cy -= 13;
  for (const l of [doc.client_address, doc.client_siret ? `SIRET ${doc.client_siret}` : "", doc.client_vat ? `TVA ${doc.client_vat}` : ""].filter(Boolean) as string[])
    for (const w of wrap(l, font, 9, W / 2 - M - 24)) { text(page, w, W / 2 + 12, cy, { color: MUTED }); cy -= 11.5; }
  y = Math.min(y - 96, cy - 14);

  // Tableau
  const cols = [
    { k: "description", label: "Désignation", x: M + 8, w: 220 },
    { k: "qty", label: "Qté", x: M + 290, align: "right" as const },
    { k: "pu", label: "PU HT", x: M + 355, align: "right" as const },
    { k: "disc", label: "Remise", x: M + 400, align: "right" as const },
    { k: "vat", label: "TVA", x: M + 435, align: "right" as const },
    { k: "ht", label: "Total HT", x: W - M - 8, align: "right" as const },
  ];
  const header = (p: PDFPage) => {
    p.drawRectangle({ x: M, y: y - 6, width: W - 2 * M, height: 20, color: INK });
    for (const c of cols) text(p, c.label, c.x, y, { size: 8, f: bold, color: rgb(1, 1, 1), align: c.align });
    y -= 22;
  };
  header(page);
  const totals = docTotals(doc.lines, doc.deposit, doc.paid_amount);
  for (const l of doc.lines) {
    const desc = wrap(l.description || "—", font, 9, 225);
    const need = desc.length * 11.5 + 10;
    if (y - need < 170) { page = pdf.addPage([W, H]); watermark(page); y = H - M; header(page); }
    const gross = (Number(l.quantity) || 0) * (Number(l.unit_price) || 0);
    const ht = gross - gross * ((Number(l.discount_pct) || 0) / 100);
    const top = y;
    desc.forEach((d, i) => text(page, d, M + 8, top - i * 11.5));
    text(page, String(l.quantity), cols[1].x, top, { align: "right" });
    text(page, money(Number(l.unit_price) || 0, doc.currency), cols[2].x, top, { align: "right" });
    text(page, l.discount_pct ? `${l.discount_pct} %` : "—", cols[3].x, top, { align: "right", color: MUTED });
    text(page, `${l.vat_rate} %`, cols[4].x, top, { align: "right", color: MUTED });
    text(page, money(Math.round(ht * 100) / 100, doc.currency), cols[5].x, top, { align: "right" });
    y = top - desc.length * 11.5 - 6;
    page.drawLine({ start: { x: M, y: y + 2 }, end: { x: W - M, y: y + 2 }, thickness: 0.5, color: LINE });
    y -= 8;
  }

  // Totaux
  if (y < 230) { page = pdf.addPage([W, H]); watermark(page); y = H - M; }
  const tx = W - M - 8, lx = W - M - 200;
  const row = (label: string, val: string, strong = false) => {
    text(page, label, lx, y, { size: strong ? 10 : 9, f: strong ? bold : font, color: strong ? INK : MUTED });
    text(page, val, tx, y, { size: strong ? 10 : 9, f: strong ? bold : font, align: "right" });
    y -= strong ? 18 : 14;
  };
  y -= 6;
  if (totals.discount > 0) row("Remises", "- " + money(totals.discount, doc.currency));
  row("Total HT", money(totals.ht, doc.currency));
  if (legal.vat_exempt) row("TVA", money(0, doc.currency));
  else for (const v of totals.vatByRate) row(`TVA ${v.rate} %`, money(v.vat, doc.currency));
  page.drawLine({ start: { x: lx, y: y + 8 }, end: { x: tx, y: y + 8 }, thickness: 0.8, color: INK });
  y -= 2;
  row("Total TTC", money(totals.ttc, doc.currency), true);
  if (totals.deposit > 0) row("Acompte", "- " + money(totals.deposit, doc.currency));
  if (totals.paid > 0) row("Déjà réglé", "- " + money(totals.paid, doc.currency));
  if (totals.deposit > 0 || totals.paid > 0) row(isInvoice ? "Reste à payer" : "Solde", money(totals.balance, doc.currency), true);

  // Mentions
  y -= 10;
  const mentions: string[] = [];
  if (legal.vat_exempt) mentions.push("TVA non applicable, art. 293 B du CGI.");
  if (isInvoice) {
    if (legal.payment_terms) mentions.push(legal.payment_terms);
    if (legal.late_penalty) mentions.push(legal.late_penalty);
    mentions.push("Indemnité forfaitaire pour frais de recouvrement en cas de retard de paiement : 40 € (art. L441-10 du Code de commerce). Pas d'escompte pour paiement anticipé.");
    if (legal.iban) mentions.push(`Règlement par virement — IBAN ${legal.iban}${legal.bic ? ` — BIC ${legal.bic}` : ""}`);
  } else {
    mentions.push(`Devis valable jusqu'au ${dfmt(doc.due_date)}. Conditions de paiement : ${legal.payment_terms || "à définir"}.`);
  }
  if (doc.notes) mentions.push(doc.notes);
  for (const m of mentions) for (const w of wrap(m, font, 8, W - 2 * M)) {
    if (y < 60) { page = pdf.addPage([W, H]); watermark(page); y = H - M; }
    text(page, w, M, y, { size: 8, color: MUTED }); y -= 11;
  }
  if (!isInvoice) {
    y -= 16;
    if (y < 110) { page = pdf.addPage([W, H]); y = H - M; }
    page.drawRectangle({ x: W - M - 220, y: y - 60, width: 220, height: 70, borderColor: LINE, borderWidth: 0.8 });
    text(page, "Bon pour accord — date et signature", W - M - 210, y - 4, { size: 8, color: MUTED });
  }

  // Pied de page
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    text(p, `${emitter}${legal.siret ? ` · SIRET ${legal.siret}` : ""}`, M, 28, { size: 7, color: MUTED });
    text(p, `${i + 1} / ${pages.length}`, W - M, 28, { size: 7, color: MUTED, align: "right" });
  });
  return pdf.save();
}
