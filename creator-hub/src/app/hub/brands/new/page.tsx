import Link from "next/link";
import { getSectors, getStages } from "@/lib/data";
import { PageHeader, Card } from "@/components/ui";
import { BrandForm } from "../brand-form";
import { EXCLUDED_LIST } from "@/lib/ethics";

export const metadata = { title: "Nouvelle marque" };

export default async function NewBrand() {
  const [sectors, stages] = await Promise.all([getSectors(), getStages()]);
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Ajouter une marque" subtitle="Ne renseignez que des informations vérifiées, avec leur source." actions={<Link href="/hub/brands" className="btn btn-ghost">Annuler</Link>} />
      <Card><BrandForm sectors={sectors.filter((s) => !s.archived)} stages={stages} /></Card>
      <p className="mt-4 text-xs text-zinc-500">Secteurs exclus par la charte : {EXCLUDED_LIST.join(" · ")}.</p>
    </div>
  );
}
