// ATLAS — simulation comparative des statuts (micro, EI au réel, SASU).
// Cotisations, IS et IR : moteur officiel URSSAF « modele-social » (mon-entreprise.urssaf.fr).
// RSA et prime d'activité : formules CAF codées ici, barème avril 2026 (voir ../ETUDE-STATUTS.md §8).
// Toutes les hypothèses sont en tête de fichier. Aucune donnée réelle n'est inventée :
// les chiffres d'affaires et les charges sont des SCÉNARIOS, pas des prévisions.
import rules from 'modele-social'
import Engine from 'publicodes'
import { writeFileSync } from 'node:fs'

// ───────── Hypothèses (à remplacer par les données réelles quand elles existent) ─────────
const H = {
  dateCreation: '01/01/2027',          // création hypothétique, après la décision
  foyer: { situation: "'célibataire'", enfants: 0 },  // [À CONFIRMER]
  autresRevenusImposables: 0,          // le RSA et la prime d'activité ne sont pas imposables
  fraisFixesAnnuels: 1500,             // logiciels, assurance RC pro, téléphone/internet pro, petit matériel [hypothèse]
  fraisComptables: { micro: 0, ei: 900, sasu: 2000 }, // expert-comptable / logiciel [hypothèse, à remplacer par devis]
  fraisBanqueSociete: 180,             // compte pro obligatoire en société [hypothèse]
  partSousTraitance: { leger: 0, production: 0.35 }, // part du CA reversée à des prestataires / locations
  pfu: 0.314,                          // PFU 2026 (12,8 % IR + 18,6 % prélèvements sociaux)
  caf: {                               // barème au 01/04/2026
    rsaForfait: 651.69, rsaForfaitLogement: 78.20,
    paForfait: 638.28, paForfaitLogement: 76.59, paTauxRevenus: 0.5985,
    bonifSeuil: 709.18, bonifPlein: 1658.76, bonifMax: 240.63, paMinimumVerse: 15,
    forfaitLogement: true,             // [À CONFIRMER] vrai si APL / hébergé gratuitement / propriétaire
  },
}
const CA_MENSUELS = [500, 1000, 1500, 2000, 3000, 4000, 5000, 7000]

const engine = new Engine(rules, { logger: { log() {}, warn() {}, error() {} } })
const ev = (r) => { const v = engine.evaluate({ valeur: r, unité: '€/an' }).nodeValue; return typeof v === 'number' ? v : 0 }

function situationCommune(ca, charges, nature, acre) {
  return {
    'entreprise . date de création': H.dateCreation,
    "entreprise . chiffre d'affaires": `${ca} €/an`,
    'entreprise . charges': `${charges} €/an`,
    'entreprise . activité . nature': nature.nature,
    ...(nature.serviceOuVente ? { 'entreprise . activités . service ou vente': nature.serviceOuVente } : {}),
    'entreprise . activité . nature . libérale . réglementée': 'non',
    'impôt . méthode de calcul': "'barème standard'",
    'impôt . foyer fiscal . situation de famille': H.foyer.situation,
    'impôt . foyer fiscal . enfants à charge': String(H.foyer.enfants),
    'impôt . foyer fiscal . revenu imposable . autres revenus imposables': `${H.autresRevenusImposables} €/an`,
    'établissement . commune . département . outre-mer': 'non',
    "situation personnelle . domiciliation fiscale à l'étranger": 'non',
    'dirigeant . exonérations . ACRE': acre ? 'oui' : 'non',
  }
}

const NATURES = {
  bnc: { nature: "'libérale'", abattementCaf: 0.34, label: 'BNC (libéral non réglementé)' },
  bic: { nature: "'artisanale'", serviceOuVente: "'service'", abattementCaf: 0.50, label: 'BIC prestations de services' },
}

// ───────── RSA + prime d'activité (estimation, personne seule sans enfant) ─────────
function aidesCaf(revenuProMensuel, autresRessourcesMensuelles = 0) {
  const c = H.caf
  const flRsa = c.forfaitLogement ? c.rsaForfaitLogement : 0
  const flPa = c.forfaitLogement ? c.paForfaitLogement : 0
  const rsa = Math.max(0, c.rsaForfait - revenuProMensuel - autresRessourcesMensuelles - flRsa)
  const r = revenuProMensuel
  const bonif = r < c.bonifSeuil ? 0 : r >= c.bonifPlein ? c.bonifMax
    : c.bonifMax * (r - c.bonifSeuil) / (c.bonifPlein - c.bonifSeuil)
  const ressources = r + autresRessourcesMensuelles + rsa + flPa
  let pa = c.paForfait + c.paTauxRevenus * r + bonif - Math.max(c.paForfait, ressources)
  if (r <= 0 || pa < c.paMinimumVerse) pa = 0
  return { rsa, pa }
}

function simuler(ca, profil, natureKey, acre) {
  const nature = NATURES[natureKey]
  const part = typeof profil === 'number' ? profil : H.partSousTraitance[profil]
  const sousTraitance = ca * part
  const chargesOperationnelles = H.fraisFixesAnnuels + sousTraitance
  const out = {}

  // Micro-entreprise : cotisations sur le CA, aucune charge déductible
  engine.setSituation({ ...situationCommune(ca, 0, nature, acre),
    'entreprise . catégorie juridique': "'EI'",
    'entreprise . catégorie juridique . EI . auto-entrepreneur': 'oui',
    'dirigeant . auto-entrepreneur . impôt . versement libératoire': 'non' })
  const microCot = ev('dirigeant . rémunération . cotisations')
  const microImpot = ev('dirigeant . rémunération . impôt')
  const microDispo = ca - microCot - microImpot - chargesOperationnelles - H.fraisComptables.micro
  const microCaf = aidesCaf(ca * (1 - nature.abattementCaf) / 12)
  out.micro = { cotisations: microCot, impot: microImpot, frais: chargesOperationnelles + H.fraisComptables.micro, dispo: microDispo, ...microCaf }

  // EI au réel (IR) : cotisations et impôt sur le bénéfice réel
  const chargesEI = chargesOperationnelles + H.fraisComptables.ei
  engine.setSituation({ ...situationCommune(ca, chargesEI, nature, acre),
    'entreprise . catégorie juridique': "'EI'",
    'entreprise . catégorie juridique . EI . auto-entrepreneur': 'non',
    'entreprise . imposition': "'IR'" })
  const eiCot = ev('dirigeant . rémunération . cotisations')
  const eiImpot = ev('dirigeant . rémunération . impôt')
  const eiDispo = ev('dirigeant . rémunération . net . après impôt')
  // Pour la CAF, revenu professionnel ≈ bénéfice net de cotisations [approximation]
  const eiCaf = aidesCaf(Math.max(0, ca - chargesEI - eiCot) / 12)
  out.ei = { cotisations: eiCot, impot: eiImpot, frais: chargesEI, dispo: eiDispo, ...eiCaf }

  // SASU à l'IS, tout en salaire du président
  const chargesSASU = chargesOperationnelles + H.fraisComptables.sasu + H.fraisBanqueSociete
  const sasuBase = { ...situationCommune(ca, chargesSASU, nature, acre),
    'entreprise . catégorie juridique': "'SAS'", 'entreprise . associés': "'unique'", 'entreprise . imposition': "'IS'" }
  engine.setSituation(sasuBase)
  const sasuCot = ev('dirigeant . rémunération . cotisations')
  const sasuImpot = ev('dirigeant . rémunération . impôt')
  const sasuNet = ev('dirigeant . rémunération . net')
  const sasuDispo = ev('dirigeant . rémunération . net . après impôt')
  out.sasuSalaire = { cotisations: sasuCot, impot: sasuImpot, frais: chargesSASU, dispo: sasuDispo, ...aidesCaf(sasuNet / 12) }

  // SASU à l'IS, aucun salaire, bénéfice distribué en dividendes (PFU)
  engine.setSituation({ ...sasuBase, 'dirigeant . rémunération . totale': '0 €/an' })
  const is = ev('entreprise . imposition . IS . montant')
  const resultat = Math.max(0, ca - chargesSASU)
  const dividendesBruts = Math.max(0, resultat - is)
  const pfu = dividendesBruts * H.pfu
  // Dividendes = revenus du capital pour la CAF (pas de revenu professionnel) [À VÉRIFIER auprès de la CAF]
  out.sasuDividendes = { cotisations: 0, impot: is + pfu, frais: chargesSASU, dispo: dividendesBruts - pfu, ...aidesCaf(0, dividendesBruts / 12) }
  return out
}

const eur = (n) => Math.round(n).toLocaleString('fr-FR').replace(/ /g, ' ')
const lignes = []
const csv = ['profil;nature;acre;ca_mensuel;ca_annuel;statut;cotisations;impots;frais;disponible_annuel;disponible_mensuel;rsa_mensuel_estime;prime_activite_mensuelle_estimee;total_mensuel_avec_aides']
const STATUTS = { micro: 'Micro-entreprise', ei: 'EI au réel (IR)', sasuSalaire: 'SASU — salaire', sasuDividendes: 'SASU — dividendes' }

for (const profil of ['leger', 'production']) for (const natureKey of ['bnc', 'bic']) for (const acre of [false, true]) {
  lignes.push(`\n### Profil « ${profil === 'leger' ? 'léger' : 'production'} » · ${NATURES[natureKey].label} · ${acre ? 'avec ACRE (1re année)' : 'sans ACRE (régime de croisière)'}\n`)
  lignes.push('| CA / mois | CA / an | Micro | EI au réel | SASU salaire | SASU dividendes |')
  lignes.push('|---:|---:|---:|---:|---:|---:|')
  for (const m of CA_MENSUELS) {
    const ca = m * 12
    const r = simuler(ca, profil, natureKey, acre)
    const cell = (k) => `${eur(r[k].dispo / 12)} €`
    lignes.push(`| ${eur(m)} € | ${eur(ca)} € | ${cell('micro')} | ${cell('ei')} | ${cell('sasuSalaire')} | ${cell('sasuDividendes')} |`)
    for (const [k, v] of Object.entries(r)) csv.push([profil, natureKey, acre ? 'oui' : 'non', m, ca, STATUTS[k], v.cotisations, v.impot, v.frais, v.dispo, v.dispo / 12, v.rsa, v.pa, v.dispo / 12 + v.rsa + v.pa].map((x) => typeof x === 'number' ? x.toFixed(2) : x).join(';'))
  }
}

// Tableau détaillé micro BNC vs BIC avec aides CAF
const detail = ['\n### Micro-entreprise : revenu disponible + aides CAF estimées (profil léger, sans ACRE)\n',
  '| CA / mois | Nature | Cotisations / mois | Impôt / mois | Frais / mois | Disponible / mois | RSA estimé | Prime d\'activité estimée | Total / mois |',
  '|---:|---|---:|---:|---:|---:|---:|---:|---:|']
for (const m of [0, ...CA_MENSUELS]) for (const nk of ['bnc', 'bic']) {
  if (m === 0) { if (nk === 'bnc') { const a = aidesCaf(0); detail.push(`| 0 € | — | 0 € | 0 € | 0 € | 0 € | ${eur(a.rsa)} € | 0 € | ${eur(a.rsa)} € |`) } continue }
  const r = simuler(m * 12, 'leger', nk, false).micro
  detail.push(`| ${eur(m)} € | ${nk.toUpperCase()} | ${eur(r.cotisations / 12)} € | ${eur(r.impot / 12)} € | ${eur(r.frais / 12)} € | ${eur(r.dispo / 12)} € | ${eur(r.rsa)} € | ${eur(r.pa)} € | ${eur(r.dispo / 12 + r.rsa + r.pa)} € |`)
}

// Point de bascule : part de charges (frais fixes inclus) à partir de laquelle l'EI au réel dépasse la micro
const bascule = ['\n### Point de bascule micro → EI au réel (sans ACRE)\n',
  "Part du CA consacrée aux charges réelles (frais fixes de 1 500 €/an + sous-traitance/locations) à partir de laquelle l'EI au réel laisse plus de revenu disponible que la micro.\n",
  '| CA / mois | BNC | BIC services |', '|---:|---:|---:|']
for (const m of [1000, 1500, 2000, 3000, 4000, 5000, 6500]) {
  const seuil = (nk) => {
    for (let p = 0; p <= 0.9; p += 0.01) {
      const r = simuler(m * 12, p, nk, false)
      if (r.ei.dispo > r.micro.dispo) return Math.round((p * m * 12 + H.fraisFixesAnnuels) / (m * 12) * 100) + ' %'
    }
    return '> 90 %'
  }
  bascule.push(`| ${eur(m)} € | ${seuil('bnc')} | ${seuil('bic')} |`)
}

const md = [
  '# Résultats de simulation (générés)',
  '',
  `Générés le ${new Date().toISOString().slice(0, 10)} par \`simulate.mjs\` avec modele-social ${rules ? '11.1.0' : ''} (moteur URSSAF). **Ne pas modifier à la main.**`,
  '',
  '**Lecture :** « disponible / mois » = ce qui reste après cotisations, impôts (IR, IS, PFU) et frais professionnels, **hors aides CAF**. Hypothèses : voir en-tête de `simulate.mjs` et `../ETUDE-STATUTS.md`.',
  ...detail, ...bascule, ...lignes, '',
].join('\n')
writeFileSync(new URL('./resultats.md', import.meta.url), md)
writeFileSync(new URL('./resultats.csv', import.meta.url), csv.join('\n'))
console.log(md)
