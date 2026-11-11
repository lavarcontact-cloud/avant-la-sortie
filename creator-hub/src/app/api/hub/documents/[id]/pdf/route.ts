import { NextResponse, type NextRequest } from "next/server";
import { one } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { renderDocumentPdf } from "@/lib/pdf";
import { getSetting, DEFAULT_LEGAL, missingLegal, type LegalSettings } from "@/lib/settings";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const id = Number((await params).id);
  const d = await one<any>(`select *, issue_date::text as issue_date, due_date::text as due_date from documents where id=$1`, [id]);
  if (!d) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  const legal = await getSetting<LegalSettings>("legal", DEFAULT_LEGAL);
  const finalized = Boolean(d.number) && missingLegal(legal).length === 0;
  const bytes = await renderDocumentPdf({ ...d, deposit: Number(d.deposit), paid_amount: Number(d.paid_amount) }, legal, finalized);
  const name = `${d.kind === "invoice" ? "Facture" : "Devis"}-${d.number ?? `brouillon-${id}`}.pdf`;
  const inline = req.nextUrl.searchParams.get("inline") === "1";
  return new NextResponse(Buffer.from(bytes), {
    headers: { "content-type": "application/pdf", "content-disposition": `${inline ? "inline" : "attachment"}; filename="${name}"`, "cache-control": "no-store", "x-frame-options": "SAMEORIGIN" },
  });
}
