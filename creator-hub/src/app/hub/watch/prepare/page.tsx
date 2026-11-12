import Link from "next/link";
import { q } from "@/lib/db";
import { getSetting, DEFAULT_PROFILE, type ProfileSettings } from "@/lib/settings";
import { SIGNALS, manualSearchLinks, type Signal } from "@/lib/watch/core";
import { COLLAB_TYPES, type CollabType } from "@/lib/constants";
import { fmtDate } from "@/lib/dates";
import { PageHeader, Card, Badge, Empty } from "@/components/ui";
import { ActionForm } from "@/components/client";
import { acceptCandidate } from "../../intel-actions";
import { CandidateStudio } from "./studio";

export const metadata = { title: "Préparer les démarches" };

const ANGLE: Partial<Record<Signal, string>> = {
  product_launch: "j'ai vu votre récent lancement", new_collection: "j'ai découvert votre nouvelle collection", ambassador_program: "j'ai vu que vous avez un programme ambassadeur",
  creator_program: "j'ai vu votre programme dédié aux créateurs", ugc_recruiting: "j'ai vu que vous recherchez des créateurs UGC", event: "j'ai vu votre événement",
  influence_campaign: "j'ai vu vos collaborations avec des créateurs", content_needs: "j'ai vu que vous produisez beaucoup de contenus photo et vidéo", music: "j'ai vu vos liens avec la scène musicale",
};
const PROPOSAL: Record<CollabType, string> = {
  ugc_paid: "Proposition : série de contenus UGC rémunérés (formats verticaux), droits d'usage définis au devis.",
  gifting: "Proposition : envoi d'un produit à intégrer naturellement à mes contenus, produit offert clairement mentionné.",
  product_test: "Proposition : test en conditions réelles de tournage avec retour honnête.",
  influence: "Proposition : publication sponsorisée sur mes réseaux, identifiée comme partenariat.",
  ambassador: "Proposition : partenariat récurrent sur 3 à 6 mois avec calendrier de contenus.",
  event: "Proposition : couverture photo/vidéo ou activation d'un événement.",
  production: "Proposition : production photo/vidéo de A à Z.",
  music: "Proposition : activation reliant la marque à un projet musical (artiste, clip, sortie).",
  strategy: "Proposition : accompagnement stratégie et création de contenus.",
};

export default async function Prepare({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const ids = ((await searchParams).ids ?? "").split(",").map(Number).filter(Number.isInteger).slice(0, 20);
  if (!ids.length) return <Empty title="Aucune opportunité sélectionnée" action={<Link href="/hub/watch" className="btn btn-primary">Retour à la veille</Link>} />;
  const [cands, profile] = await Promise.all([
    q<any>(`select b.*, s.name as sector from watch_candidates b left join sectors s on s.id=b.sector_id where b.id = any($1) and b.kind='brand' order by b.score desc nulls last`, [ids]),
    getSetting<ProfileSettings>("profile", DEFAULT_PROFILE),
  ]);
  const contactsBy = new Map<number, any[]>();
  for (const c of cands) contactsBy.set(c.id, await q<any>(`select * from watch_candidates where kind='contact' and status<>'dismissed' and (parent_id=$1 or lower(company)=lower($2))
    order by case contact_quality when 'excellent' then 1 when 'bon' then 2 else 3 end`, [c.id, c.name]));
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-2 text-xs text-zinc-500"><Link href="/hub/watch" className="hover:text-zinc-900">← Veille</Link></div>
      <PageHeader title={`Préparer ${cands.length} démarche(s)`} subtitle="Examinez chaque opportunité, vérifiez la source, ajustez l'angle, copiez le message. Validez une par une : la validation crée la fiche CRM, l'envoi reste manuel." />
      <div className="space-y-6">
        {cands.map((c, idx) => {
          const signals = c.signals as Signal[];
          const collabs = (c.opportunities as CollabType[]).length ? c.opportunities as CollabType[] : ["ugc_paid" as CollabType];
          const people = contactsBy.get(c.id) ?? [];
          const best = people[0];
          const angleBits = signals.map((s) => ANGLE[s]).filter((x): x is string => Boolean(x));
          const defaultAngle = angleBits.length ? `${angleBits[0].charAt(0).toUpperCase() + angleBits[0].slice(1)} (${c.domain}) et je pense pouvoir apporter des contenus qui servent directement cet objectif.` : "";
          return (
            <Card key={c.id} title={<span className="flex flex-wrap items-center gap-2"><span className="text-zinc-400">{idx + 1}.</span>{c.name}<Badge tone="dark">Score {c.score ?? "—"}/100</Badge>{c.status !== "new" && <Badge tone="amber">{c.status === "known" ? "Déjà au CRM" : c.status}</Badge>}</span>}>
              <div className="grid gap-5 lg:grid-cols-2">
                <div className="space-y-3 text-sm">
                  <div><div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Présentation (extrait de la source)</div>
                    <p className="mt-1 text-zinc-700">{c.snippet ? `« ${c.snippet} »` : "Aucun extrait fourni par la source."}</p>
                    <p className="text-xs text-zinc-500"><a href={c.url} target="_blank" rel="noreferrer" className="underline">{c.url}</a> · vu le {fmtDate(c.first_seen_at)} · {c.sector ?? "secteur non déterminé"}</p></div>
                  <div><div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Pourquoi la contacter</div>
                    {signals.length ? <ul className="mt-1 list-inside list-disc text-zinc-700">{signals.map((s) => <li key={s}>{SIGNALS[s]?.label}</li>)}</ul> : <p className="mt-1 text-zinc-500">Aucun signal commercial détecté dans la source : vérifiez la pertinence avant d'aller plus loin.</p>}</div>
                  <div><div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Interlocuteur à privilégier</div>
                    {best ? <p className="mt-1"><b>{best.person_name ?? "Nom non publié"}</b> — {best.person_role ?? "fonction non publiée"} <Badge tone={best.contact_quality === "excellent" ? "green" : "blue"}>{best.contact_quality}</Badge><br /><a className="text-xs underline" href={best.url} target="_blank" rel="noreferrer">{best.platform} ↗</a> <span className="text-xs text-amber-700">poste actuel à confirmer sur le profil</span></p>
                      : <p className="mt-1 text-zinc-500">Interlocuteur introuvable dans les résultats publics. Recherchez-le vous-même :</p>}
                    <ul className="mt-1 space-y-0.5 text-xs">{manualSearchLinks(c.name).map((l) => <li key={l.url}><a href={l.url} target="_blank" rel="noreferrer" className="underline">{l.label} ↗</a></li>)}</ul></div>
                  <div><div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Proposition commerciale</div>
                    <ul className="mt-1 space-y-0.5 text-zinc-700">{collabs.slice(0, 3).map((k) => <li key={k}>• {PROPOSAL[k]}</li>)}</ul></div>
                  <div className="rounded-lg border border-zinc-200 p-3">
                    <ActionForm action={acceptCandidate} submitLabel={c.status === "known" ? "Relier à la fiche CRM existante" : "Valider : créer la fiche CRM"} submitClass="btn btn-primary">
                      <input type="hidden" name="id" value={c.id} />
                      <label className="field"><span>Nom exact de la marque (vérifiez-le sur le site)</span><input name="name" defaultValue={c.name} className="input" /></label>
                      {people.length > 0 && <div className="mt-2 space-y-1 text-xs">{people.map((p: any) => <label key={p.id} className="flex items-center gap-2"><input type="checkbox" name="contact_ids" value={p.id} />Ajouter {p.person_name ?? "ce profil"} ({p.person_role ?? "fonction ?"})</label>)}</div>}
                      <label className="mt-2 flex items-start gap-2 text-xs"><input type="checkbox" name="verified" className="mt-0.5" />J'ai vérifié sur la source officielle que la marque et, le cas échéant, le poste actuel des interlocuteurs sont exacts.</label>
                    </ActionForm>
                  </div>
                </div>
                <div><div className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">Messages préparés</div>
                  <CandidateStudio brand={{ name: c.name, sector: c.sector }} defaultAngle={defaultAngle} collabs={collabs} profile={profile}
                    contacts={people.filter((p: any) => p.person_name).map((p: any) => ({ id: p.id, first_name: p.person_name.split(" ")[0], label: `${p.person_name} — ${p.person_role ?? ""}` }))} />
                  <p className="mt-2 text-[0.7rem] text-zinc-400">L'angle est pré-rempli à partir des signaux trouvés dans la source. Reformulez-le avec ce que vous avez réellement vu.</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
