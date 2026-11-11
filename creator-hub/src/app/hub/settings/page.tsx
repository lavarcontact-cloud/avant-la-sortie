import Link from "next/link";
import { q } from "@/lib/db";
import { getSectors, getStages } from "@/lib/data";
import { getSetting, missingLegal, DEFAULT_LEGAL, DEFAULT_NOTIF, DEFAULT_PROFILE, type LegalSettings, type NotifSettings, type ProfileSettings } from "@/lib/settings";
import { pushConfigured } from "@/lib/push";
import { EXCLUDED_LIST } from "@/lib/ethics";
import { fmtDateTime } from "@/lib/dates";
import { PageHeader, Card, Badge } from "@/components/ui";
import { ActionForm, Submit, ConfirmSubmit } from "@/components/client";
import { saveLegal, saveNotifSettings, saveSector, saveStageLabel, addSuppression, removeSuppression } from "../actions";
import { ProfileForm } from "./profile-form";

export const metadata = { title: "Paramètres" };

export default async function Settings() {
  const [legal, notif, profile, sectors, stages, supp, logs] = await Promise.all([
    getSetting<LegalSettings>("legal", DEFAULT_LEGAL), getSetting<NotifSettings>("notifications", DEFAULT_NOTIF), getSetting<ProfileSettings>("profile", DEFAULT_PROFILE),
    getSectors(), getStages(), q<any>(`select * from suppression_list order by created_at desc`), q<any>(`select * from audit_log order by created_at desc limit 40`),
  ]);
  const missing = missingLegal(legal);
  const L = (k: keyof LegalSettings, label: string, ph = "") => <label className="field"><span>{label}</span><input name={k} defaultValue={String(legal[k] ?? "")} placeholder={ph} className="input" /></label>;
  const integrations = [
    { name: "Base de données", ok: Boolean(process.env.DATABASE_URL), on: "PostgreSQL (DATABASE_URL)", off: "PGlite local (.data/) — à remplacer par Supabase en production" },
    { name: "Notifications push", ok: pushConfigured(), on: "Clés VAPID configurées", off: "En attente : clés VAPID" },
    { name: "Bilans planifiés", ok: Boolean(process.env.CRON_SECRET), on: "CRON_SECRET défini — planificateur à brancher (README)", off: "En attente : CRON_SECRET + planificateur horaire" },
    { name: "Gmail (détection des réponses)", ok: false, on: "", off: "Non connecté — saisie manuelle des réponses (phase suivante : OAuth Gmail)" },
    { name: "Assistant IA", ok: false, on: "", off: "Non connecté — messages préparés par modèles personnalisables (phase suivante)" },
  ];
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="Paramètres" />
      <Card title="État des intégrations">
        <ul className="divide-y divide-zinc-100">{integrations.map((i) => <li key={i.name} className="flex items-center justify-between py-2 text-sm"><span className="font-medium">{i.name}</span><span className="flex items-center gap-2 text-right text-xs text-zinc-500">{i.ok ? i.on : i.off}<Badge tone={i.ok ? "green" : "amber"}>{i.ok ? "Actif" : "En attente"}</Badge></span></li>)}</ul>
      </Card>

      <Card title="Profil public & Media Kit"><ProfileForm p={profile} /></Card>

      <div id="legal"><Card title={<span className="flex items-center gap-2">Facturation {missing.length ? <Badge tone="amber">{missing.length} mention(s) manquante(s)</Badge> : <Badge tone="green">Complet</Badge>}</span>}>
        <p className="mb-4 text-xs text-zinc-500">Ne saisissez que vos informations réelles. Tant qu'elles sont incomplètes, devis et factures restent en brouillon (filigrane). Outil d'aide, non certifié juridiquement : vérifiez les mentions applicables à votre statut avec votre expert-comptable.</p>
        <ActionForm action={saveLegal} submitLabel="Enregistrer" className="grid gap-3 sm:grid-cols-2">
          {L("legal_name", "Nom / dénomination légale *")}{L("trade_name", "Nom commercial")}
          {L("legal_status", "Statut juridique *", "Entrepreneur individuel (micro-entreprise), SASU…")}{L("address", "Adresse *")}
          {L("siren", "SIREN (9 chiffres)")}{L("siret", "SIRET (14 chiffres) *")}{L("ape", "Code APE")}{L("vat_number", "N° TVA intracommunautaire")}
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="vat_exempt" defaultChecked={legal.vat_exempt} /> Franchise en base de TVA (art. 293 B du CGI)</label>
          {L("default_vat_rate", "Taux de TVA par défaut (%) si assujetti", "20")}{L("currency", "Devise", "EUR")}
          {L("iban", "IBAN")}{L("bic", "BIC")}{L("email", "Email de facturation")}{L("phone", "Téléphone")}
          <label className="field sm:col-span-2"><span>Conditions de paiement *</span><input name="payment_terms" defaultValue={legal.payment_terms} className="input" /></label>
          <label className="field sm:col-span-2"><span>Pénalités de retard * (taux applicable)</span><input name="late_penalty" defaultValue={legal.late_penalty} placeholder="En cas de retard, pénalités au taux de … % (au minimum 3 fois le taux d'intérêt légal)." className="input" /></label>
        </ActionForm>
      </Card></div>

      <div id="notifications"><Card title="Bilans & relances">
        <ActionForm action={saveNotifSettings} submitLabel="Enregistrer" className="grid gap-3 sm:grid-cols-3">
          <label className="field"><span>Bilan du matin</span><input type="time" name="morning" defaultValue={notif.morning} className="input" /></label>
          <label className="field"><span>Point de mi-journée</span><input type="time" name="midday" defaultValue={notif.midday} className="input" /></label>
          <label className="field"><span>Bilan du soir</span><input type="time" name="evening" defaultValue={notif.evening} className="input" /></label>
          <label className="field"><span>Relances max. sans réponse</span><input type="number" name="max_follow_ups" min={0} max={5} defaultValue={notif.max_follow_ups} className="input" /></label>
          <label className="field"><span>Délai de relance par défaut (jours)</span><input type="number" name="follow_up_days" min={1} max={60} defaultValue={notif.follow_up_days} className="input" /></label>
          <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" name="enabled" defaultChecked={notif.enabled} /> Bilans activés</label>
          <p className="text-xs text-zinc-500 sm:col-span-3">Fuseau Europe/Paris. Le bilan est généré à l'heure pleine indiquée (minutes ignorées) par la tâche planifiée horaire.</p>
        </ActionForm>
      </Card></div>

      <Card title="Secteurs">
        <ul className="space-y-2">{sectors.map((s) => (
          <li key={s.id}><form action={saveSector} className="flex flex-wrap items-center gap-2"><input type="hidden" name="id" value={s.id} />
            <input type="color" name="color" defaultValue={s.color} className="h-8 w-10 rounded border border-zinc-200" />
            <input name="name" defaultValue={s.name} className="input !w-64" />
            <label className="flex items-center gap-1 text-xs text-zinc-500"><input type="checkbox" name="archived" defaultChecked={s.archived} />Archivé</label>
            <Submit className="btn btn-ghost !py-1 !text-xs">OK</Submit></form></li>))}</ul>
        <form action={saveSector} className="mt-3 flex gap-2"><input type="color" name="color" defaultValue="#64748b" className="h-9 w-10 rounded border border-zinc-200" /><input name="name" placeholder="Nouveau secteur" className="input !w-64" required /><Submit className="btn btn-primary">Ajouter</Submit></form>
        <p className="mt-3 text-xs text-zinc-500">Exclus par la charte : {EXCLUDED_LIST.join(" · ")}.</p>
      </Card>

      <Card title="Statuts du pipeline">
        <div className="grid gap-2 sm:grid-cols-2">{stages.map((s) => (
          <form key={s.id} action={saveStageLabel} className="flex items-center gap-2"><input type="hidden" name="id" value={s.id} /><span className="w-6 text-right text-xs text-zinc-400">{s.position}</span>
            <input name="label" defaultValue={s.label} className="input" /><Badge tone={s.kind === "won" ? "green" : s.kind === "lost" ? "red" : s.kind === "dnc" ? "dark" : "slate"}>{s.kind}</Badge><Submit className="btn btn-ghost !py-1 !text-xs">OK</Submit></form>))}</div>
      </Card>

      <Card title={`Liste d'opposition (${supp.length})`}>
        <p className="mb-3 text-xs text-zinc-500">Emails ou domaines à ne plus solliciter (ex. <code>nom@marque.com</code> ou <code>marque.com</code>). Toute démarche vers ces adresses est bloquée.</p>
        <form action={addSuppression} className="flex flex-wrap gap-2"><input name="value" required placeholder="email ou domaine" className="input !w-64" /><input name="reason" placeholder="Motif" className="input !w-64" /><Submit className="btn btn-primary">Ajouter</Submit></form>
        {supp.length > 0 && <ul className="mt-3 divide-y divide-zinc-100">{supp.map((s) => <li key={s.id} className="flex items-center justify-between py-1.5 text-sm"><span>{s.value} <span className="text-xs text-zinc-400">{s.reason} · {fmtDateTime(s.created_at)}</span></span><form action={removeSuppression}><input type="hidden" name="id" value={s.id} /><ConfirmSubmit message="Retirer de la liste d'opposition ?" className="text-xs text-zinc-400 hover:text-red-600">Retirer</ConfirmSubmit></form></li>)}</ul>}
      </Card>

      <Card title="Données & RGPD">
        <div className="flex flex-wrap gap-2"><a href="/api/hub/export" className="btn btn-primary">↓ Exporter toutes les données (JSON)</a><Link href="/hub/contacts" className="btn btn-ghost">Gérer / supprimer des contacts</Link></div>
        <p className="mt-2 text-xs text-zinc-500">Chaque contact conserve sa source. Suppression individuelle depuis la fiche marque (droit à l'effacement), opposition via « Opposition ».</p>
        <div className="mt-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">Journal des actions</div>
        <ul className="mt-2 max-h-64 overflow-auto text-xs text-zinc-600">{logs.map((l) => <li key={l.id} className="flex gap-3 border-b border-zinc-50 py-1"><span className="w-28 shrink-0 text-zinc-400">{fmtDateTime(l.created_at)}</span><span className="font-mono">{l.action}</span><span className="text-zinc-400">{l.entity ? `${l.entity} #${l.entity_id}` : ""}</span></li>)}</ul>
      </Card>
    </div>
  );
}
