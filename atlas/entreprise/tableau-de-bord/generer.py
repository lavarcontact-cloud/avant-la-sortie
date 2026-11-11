"""Génère le tableau de bord Excel du module Entreprise d'ATLAS.

Le classeur est livré VIDE : aucune donnée fictive. Toutes les valeurs
réglementaires sont dans l'onglet Paramètres, avec leur source et leur date de
vérification, pour pouvoir être mises à jour sans toucher aux formules.

Usage : python3 generer.py [chemin_sortie.xlsx]
"""
import sys
from openpyxl import Workbook
from openpyxl.chart import BarChart, LineChart, Reference
from openpyxl.formatting.rule import CellIsRule, FormulaRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.workbook.defined_name import DefinedName

OUT = sys.argv[1] if len(sys.argv) > 1 else "ATLAS-Entreprise-Tableau-de-bord.xlsx"
N = 500  # lignes de saisie par onglet

INK, MUTED, ACCENT = "1B1A1F", "6B6775", "FF5B3C"
HEAD = PatternFill("solid", fgColor="1B1A1F")
INPUT = PatternFill("solid", fgColor="FFF7E6")
CALC = PatternFill("solid", fgColor="EEF2F7")
WARN = PatternFill("solid", fgColor="FDE2DD")
OK = PatternFill("solid", fgColor="E3F4E8")
thin = Side(style="thin", color="D9D6DE")
BOX = Border(left=thin, right=thin, top=thin, bottom=thin)
EUR = '#,##0.00 "€";-#,##0.00 "€";"–"'
PCT = "0.0%"
DATE = "DD/MM/YYYY"

wb = Workbook()


def header(ws, row, labels, widths=None):
    for i, lab in enumerate(labels, 1):
        c = ws.cell(row=row, column=i, value=lab)
        c.font = Font(bold=True, color="FFFFFF")
        c.fill = HEAD
        c.alignment = Alignment(wrap_text=True, vertical="center")
        c.border = BOX
    ws.row_dimensions[row].height = 32
    if widths:
        for i, w in enumerate(widths, 1):
            ws.column_dimensions[get_column_letter(i)].width = w
    ws.freeze_panes = ws.cell(row=row + 1, column=1)


def title(ws, text, sub):
    ws["A1"] = text
    ws["A1"].font = Font(bold=True, size=16, color=INK)
    ws["A2"] = sub
    ws["A2"].font = Font(italic=True, color=MUTED)


def name(n, ref):
    wb.defined_names[n] = DefinedName(n, attr_text=ref)


# ───────────────────────── Paramètres ─────────────────────────
p = wb.active
p.title = "Paramètres"
title(p, "Paramètres", "Cellules jaunes = à renseigner. Valeurs réglementaires vérifiées le 11/11/2026 : à revérifier chaque 1er janvier et 1er juillet.")
p.column_dimensions["A"].width = 46
p.column_dimensions["B"].width = 16
p.column_dimensions["C"].width = 70
rows = [
    ("Situation", None, None),
    ("Année suivie", 2027, "Année civile affichée dans Provisions et Tableau de bord", "annee"),
    ("Statut", "Micro-entreprise", "Micro-entreprise / EI au réel / SASU (les calculs de cotisations ne valent que pour la micro)", "statut"),
    ("Date de début d'activité", None, "Date figurant sur le justificatif d'immatriculation", "debut"),
    ("ACRE accordée ?", "Non", "Oui seulement après accord de l'URSSAF (demande sous 60 jours, attestation RSA jointe)", "acre"),
    ("Fin de l'ACRE (calculée)", "=IF(OR(acre<>\"Oui\",debut=\"\"),\"\",EOMONTH(DATE(YEAR(debut),(INT((MONTH(debut)-1)/3)+1)*3,1),9))", "Fin du 3e trimestre civil suivant le début d'activité (service-public.fr F11677)", "fin_acre"),
    ("Versement libératoire de l'IR ?", "Non", "Déconseillé tant que le foyer n'est pas imposable : il fait payer un impôt même quand l'IR serait nul", "vfl"),
    ("Autres revenus imposables du foyer (€/an)", 0, "Le RSA et la prime d'activité ne sont pas imposables", "autres_rev"),
    ("Taux de mise de côté de sécurité", 0.05, "Coussin en plus des provisions calculées (imprévus, régularisations)", "securite"),
    ("Taux 2026 — micro-entreprise", None, None),
    ("Cotisations BNC (libéral non réglementé)", 0.256, "service-public.fr F36232, vérifié le 01/01/2026", "tx_bnc"),
    ("Cotisations BIC prestations de services", 0.212, "service-public.fr F36232", "tx_bic"),
    ("Cotisations vente de marchandises", 0.123, "service-public.fr F36232", "tx_vente"),
    ("CFP libéral", 0.002, "Contribution à la formation professionnelle", "cfp_bnc"),
    ("CFP artisan", 0.003, "Photographe immatriculé à la CMA = artisan [à confirmer à l'immatriculation]", "cfp_bic"),
    ("CFP commerçant", 0.001, "", "cfp_vente"),
    ("Coefficient ACRE (taux réduit à 75 %)", 0.75, "service-public.fr F11677, vérifié le 01/07/2026", "coef_acre"),
    ("Versement libératoire BNC", 0.022, "service-public.fr F36232 (27,8 % − 25,6 %)", "vfl_bnc"),
    ("Versement libératoire BIC services", 0.017, "service-public.fr F36232", "vfl_bic"),
    ("Versement libératoire vente", 0.01, "service-public.fr F36232", "vfl_vente"),
    ("Abattements (impôt et CAF)", None, None),
    ("Abattement BNC", 0.34, "Même taux retenu par la CAF pour le RSA / la prime d'activité", "abt_bnc"),
    ("Abattement BIC services", 0.50, "", "abt_bic"),
    ("Abattement vente", 0.71, "", "abt_vente"),
    ("Seuils", None, None),
    ("Franchise TVA — services (CA N-1)", 37500, "service-public.fr F21746, vérifié le 01/01/2026", "seuil_tva"),
    ("Franchise TVA — seuil majoré (CA N)", 41250, "Au-delà : TVA due dès le jour du dépassement", "seuil_tva_maj"),
    ("Plafond micro — services", 83600, "service-public.fr F23267, vérifié le 13/05/2026", "plafond_micro"),
    ("Compte bancaire dédié obligatoire au-delà de", 10000, "CA annuel, 2 années civiles consécutives", "seuil_compte"),
    ("Barème IR 2026 (1 part) — provision indicative, sans décote", None, None),
    ("Tranche 11 % à partir de", 11600, "LF 2026, revalorisation 0,9 %", "ir_t1"),
    ("Tranche 30 % à partir de", 29579, "", "ir_t2"),
    ("Tranche 41 % à partir de", 84577, "", "ir_t3"),
    ("Point de bascule (étude statuts)", None, None),
    ("Part de charges réelles déclenchant l'étude de l'EI au réel — BNC", 0.20, "Simulation URSSAF modele-social 11.1.0 (voir ETUDE-STATUTS.md)", "bascule_bnc"),
    ("Part de charges réelles déclenchant l'étude de l'EI au réel — BIC", 0.32, "", "bascule_bic"),
]
r = 4
for row in rows:
    lab, val, note = row[:3]
    if val is None and note is None:
        p.cell(row=r, column=1, value=lab).font = Font(bold=True, color=ACCENT, size=12)
        r += 1
        continue
    p.cell(row=r, column=1, value=lab)
    c = p.cell(row=r, column=2, value=val)
    c.border = BOX
    c.fill = CALC if isinstance(val, str) and val.startswith("=") else INPUT
    if isinstance(val, float) and val < 1:
        c.number_format = PCT if val >= 0.01 or lab.startswith("CFP") or "libératoire" in lab else "0.0%"
    elif isinstance(val, int) and val > 1000 and lab != "Année suivie":
        c.number_format = '#,##0 "€"'
    if lab.startswith("Date") or lab.startswith("Fin"):
        c.number_format = DATE
    p.cell(row=r, column=3, value=note).font = Font(color=MUTED, size=9)
    if len(row) > 3:
        name(row[3], f"Paramètres!$B${r}")
    r += 1

dv = DataValidation(type="list", formula1='"Oui,Non"', allow_blank=False)
p.add_data_validation(dv)
for n in ("acre", "vfl"):
    dv.add(wb.defined_names[n].attr_text.split("!")[1].replace("$", ""))
dvs = DataValidation(type="list", formula1='"Micro-entreprise,EI au réel,SASU"')
p.add_data_validation(dvs)
dvs.add(wb.defined_names["statut"].attr_text.split("!")[1].replace("$", ""))

NATURES = '"BNC,BIC services,Vente"'

# ───────────────────────── Clients ─────────────────────────
cl = wb.create_sheet("Clients")
title(cl, "Clients", "Un client par ligne. Le type détermine l'impact de la TVA si la franchise est dépassée.")
cols = ["Réf.", "Nom / raison sociale", "Type", "Contact", "Email", "Téléphone", "SIREN", "Adresse", "Source", "Notes",
        "Facturé (année)", "Encaissé (année)", "Reste dû (toutes années)", "Nb factures"]
header(cl, 4, cols, [8, 28, 16, 18, 24, 14, 12, 28, 14, 24, 14, 14, 16, 10])
dvt = DataValidation(type="list", formula1='"Particulier,Artiste indépendant,Label / maison de disques,Entreprise,Association,Collectivité,Autre"')
cl.add_data_validation(dvt)
dvt.add(f"C5:C{N + 4}")
for i in range(5, N + 5):
    for j in range(1, 11):
        cl.cell(row=i, column=j).fill = INPUT
    cl.cell(row=i, column=11, value=f'=IF(B{i}="","",SUMPRODUCT((Factures!$C$5:$C${N+4}=B{i})*(YEAR(Factures!$B$5:$B${N+4})=annee)*Factures!$G$5:$G${N+4}))')
    cl.cell(row=i, column=12, value=f'=IF(B{i}="","",SUMPRODUCT((Recettes!$B$5:$B${N+4}=B{i})*(YEAR(Recettes!$A$5:$A${N+4})=annee)*Recettes!$E$5:$E${N+4}))')
    cl.cell(row=i, column=13, value=f'=IF(B{i}="","",SUMIFS(Factures!$L$5:$L${N+4},Factures!$C$5:$C${N+4},B{i}))')
    cl.cell(row=i, column=14, value=f'=IF(B{i}="","",COUNTIF(Factures!$C$5:$C${N+4},B{i}))')
    for j in (11, 12, 13):
        cl.cell(row=i, column=j).number_format = EUR
        cl.cell(row=i, column=j).fill = CALC
    cl.cell(row=i, column=14).fill = CALC

# ───────────────────────── Factures ─────────────────────────
fa = wb.create_sheet("Factures")
title(fa, "Factures", "Numérotation chronologique continue, sans trou. Une facture n'est « payée » que si l'encaissement est saisi dans Recettes.")
cols = ["N° facture", "Date d'émission", "Client", "Objet / projet", "Nature", "Échéance",
        "Montant HT", "TVA", "TTC", "Encaissé (Recettes)", "Statut", "Reste dû", "Jours de retard"]
header(fa, 4, cols, [14, 13, 26, 30, 14, 13, 13, 11, 13, 15, 13, 13, 11])
dvn = DataValidation(type="list", formula1=NATURES)
fa.add_data_validation(dvn)
dvn.add(f"E5:E{N + 4}")
dvc = DataValidation(type="list", formula1=f"=Clients!$B$5:$B${N + 4}")
fa.add_data_validation(dvc)
dvc.add(f"C5:C{N + 4}")
for i in range(5, N + 5):
    for j in (1, 2, 3, 4, 5, 6, 7, 8):
        fa.cell(row=i, column=j).fill = INPUT
    fa.cell(row=i, column=2).number_format = DATE
    fa.cell(row=i, column=6).number_format = DATE
    fa.cell(row=i, column=9, value=f'=IF(A{i}="","",G{i}+H{i})')
    fa.cell(row=i, column=10, value=f'=IF(A{i}="","",SUMIFS(Recettes!$E$5:$E${N+4},Recettes!$C$5:$C${N+4},A{i}))')
    fa.cell(row=i, column=11, value=f'=IF(A{i}="","",IF(J{i}>=I{i}-0.005,"Payée",IF(AND(F{i}<>"",TODAY()>F{i}),"En retard",IF(J{i}>0,"Partielle","À échoir"))))')
    fa.cell(row=i, column=12, value=f'=IF(A{i}="","",MAX(0,I{i}-J{i}))')
    fa.cell(row=i, column=13, value=f'=IF(K{i}="En retard",TODAY()-F{i},"")')
    for j in (7, 8, 9, 10, 12):
        fa.cell(row=i, column=j).number_format = EUR
    for j in (9, 10, 11, 12, 13):
        fa.cell(row=i, column=j).fill = CALC
fa.conditional_formatting.add(f"K5:K{N+4}", CellIsRule(operator="equal", formula=['"En retard"'], fill=WARN))
fa.conditional_formatting.add(f"K5:K{N+4}", CellIsRule(operator="equal", formula=['"Payée"'], fill=OK))

# ───────────────────────── Recettes (livre des recettes) ─────────────────────────
re_ = wb.create_sheet("Recettes")
title(re_, "Livre des recettes", "Obligatoire en micro-entreprise : chaque encaissement, dans l'ordre chronologique. C'est la base des déclarations URSSAF et CAF.")
cols = ["Date d'encaissement", "Client", "N° facture", "Nature", "Montant encaissé", "Mode de règlement", "Référence / justificatif"]
header(re_, 4, cols, [14, 26, 14, 14, 15, 16, 30])
dvn2 = DataValidation(type="list", formula1=NATURES)
re_.add_data_validation(dvn2)
dvn2.add(f"D5:D{N + 4}")
dvm = DataValidation(type="list", formula1='"Virement,Carte,Chèque,Espèces,Plateforme (Stripe…),Autre"')
re_.add_data_validation(dvm)
dvm.add(f"F5:F{N + 4}")
dvc2 = DataValidation(type="list", formula1=f"=Clients!$B$5:$B${N + 4}")
re_.add_data_validation(dvc2)
dvc2.add(f"B5:B{N + 4}")
for i in range(5, N + 5):
    for j in range(1, 8):
        re_.cell(row=i, column=j).fill = INPUT
    re_.cell(row=i, column=1).number_format = DATE
    re_.cell(row=i, column=5).number_format = EUR

# ───────────────────────── Dépenses ─────────────────────────
de = wb.create_sheet("Dépenses")
title(de, "Dépenses professionnelles", "En micro, elles ne sont pas déductibles, mais les suivre mesure la rentabilité réelle et déclenche l'alerte de bascule vers le réel.")
cols = ["Date", "Fournisseur / prestataire", "Catégorie", "Description", "Montant TTC", "Projet", "Justificatif conservé ?", "Mode de paiement"]
header(de, 4, cols, [13, 26, 22, 32, 14, 22, 12, 16])
dvcat = DataValidation(type="list", formula1='"Sous-traitance / prestataires,Location matériel,Matériel (achat),Logiciels / abonnements,Assurance,Transport / déplacements,Téléphone / internet,Formation,Comptabilité / juridique,Banque,Communication / publicité,Autre"')
de.add_data_validation(dvcat)
dvcat.add(f"C5:C{N + 4}")
dvj = DataValidation(type="list", formula1='"Oui,Non"')
de.add_data_validation(dvj)
dvj.add(f"G5:G{N + 4}")
for i in range(5, N + 5):
    for j in range(1, 9):
        de.cell(row=i, column=j).fill = INPUT
    de.cell(row=i, column=1).number_format = DATE
    de.cell(row=i, column=5).number_format = EUR
de.conditional_formatting.add(f"G5:G{N+4}", CellIsRule(operator="equal", formula=['"Non"'], fill=WARN))

# ───────────────────────── Provisions ─────────────────────────
pr = wb.create_sheet("Provisions")
title(pr, "Provisions mois par mois", "Ce qu'il faut mettre de côté sur chaque encaissement. Cotisations : calcul micro-entreprise uniquement.")
cols = ["Mois", "CA BNC", "CA BIC services", "CA vente", "CA total", "Cotisations URSSAF", "Versement libératoire",
        "Provision IR (si pas de VFL)", "Coussin sécurité", "Total à mettre de côté", "Dépenses", "Reste réellement disponible", "CA cumulé"]
header(pr, 4, cols, [12, 13, 14, 12, 13, 15, 14, 15, 13, 15, 13, 16, 14])
R = f"$5:$A${N+4}"
for k in range(12):
    i = 5 + k
    m = k + 1
    pr.cell(row=i, column=1, value=f"=DATE(annee,{m},1)").number_format = "MMM YYYY"
    for col, nat in ((2, "BNC"), (3, "BIC services"), (4, "Vente")):
        pr.cell(row=i, column=col, value=f'=SUMPRODUCT((YEAR(Recettes!$A$5:$A${N+4})=annee)*(MONTH(Recettes!$A$5:$A${N+4})={m})*(Recettes!$D$5:$D${N+4}="{nat}")*Recettes!$E$5:$E${N+4})')
    pr.cell(row=i, column=5, value=f"=B{i}+C{i}+D{i}")
    acre_f = f'IF(AND(acre="Oui",fin_acre<>"",A{i}<=fin_acre),coef_acre,1)'
    pr.cell(row=i, column=6, value=f'=IF(statut<>"Micro-entreprise","",B{i}*(tx_bnc*{acre_f}+cfp_bnc)+C{i}*(tx_bic*{acre_f}+cfp_bic)+D{i}*(tx_vente*{acre_f}+cfp_vente))')
    pr.cell(row=i, column=7, value=f'=IF(vfl="Oui",B{i}*vfl_bnc+C{i}*vfl_bic+D{i}*vfl_vente,0)')
    # Provision IR : part du CA abattu de l'année x taux moyen estimé sur l'année entière (prudente : sans décote)
    pr.cell(row=i, column=8, value=f'=IF(vfl="Oui",0,IFERROR((B{i}*(1-abt_bnc)+C{i}*(1-abt_bic)+D{i}*(1-abt_vente))*$P$7,0))')
    pr.cell(row=i, column=9, value=f"=E{i}*securite")
    pr.cell(row=i, column=10, value=f"=N(F{i})+G{i}+H{i}+I{i}")
    pr.cell(row=i, column=11, value=f'=SUMPRODUCT((YEAR(Dépenses!$A$5:$A${N+4})=annee)*(MONTH(Dépenses!$A$5:$A${N+4})={m})*Dépenses!$E$5:$E${N+4})')
    pr.cell(row=i, column=12, value=f"=E{i}-J{i}-K{i}")
    pr.cell(row=i, column=13, value=f"=SUM($E$5:E{i})")
    for j in range(2, 14):
        pr.cell(row=i, column=j).number_format = EUR
        pr.cell(row=i, column=j).fill = CALC
t = 17
pr.cell(row=t, column=1, value="Total").font = Font(bold=True)
for j in range(2, 13):
    c = pr.cell(row=t, column=j, value=f"=SUM({get_column_letter(j)}5:{get_column_letter(j)}16)")
    c.number_format = EUR
    c.font = Font(bold=True)
# Bloc de calcul du taux moyen d'IR estimé (barème 1 part, sans décote ni quotient)
pr["O4"], pr["P4"] = "Estimation IR annuelle (indicative)", ""
pr["O4"].font = Font(bold=True, color=ACCENT)
pr["O5"], pr["P5"] = "Revenu imposable estimé (micro abattu + autres)", f"=B17*(1-abt_bnc)+C17*(1-abt_bic)+D17*(1-abt_vente)+autres_rev"
pr["O6"], pr["P6"] = "IR estimé avant décote", "=MAX(0,MIN(P5,ir_t2)-ir_t1)*0.11+MAX(0,MIN(P5,ir_t3)-ir_t2)*0.30+MAX(0,P5-ir_t3)*0.41"
pr["O7"], pr["P7"] = "Taux moyen appliqué au revenu pro abattu", "=IF(P5=0,0,P6/P5)"
pr["O8"] = "Prudent : la décote et la situation réelle du foyer réduisent souvent l'impôt. L'IR réel est sur l'avis d'imposition."
pr["O8"].font = Font(italic=True, color=MUTED, size=9)
pr.column_dimensions["O"].width = 46
pr.column_dimensions["P"].width = 16
for c in ("P5", "P6"):
    pr[c].number_format = EUR
pr["P7"].number_format = PCT

# Déclarations CAF trimestrielles
pr["A20"] = "Déclarations trimestrielles CAF (RSA / prime d'activité) — chiffre d'affaires BRUT encaissé par nature"
pr["A20"].font = Font(bold=True, color=ACCENT, size=12)
pr["A21"] = "Saisir le CA brut : la CAF applique elle-même l'abattement. Vérifier le libellé exact du formulaire dans l'espace caf.fr."
pr["A21"].font = Font(italic=True, color=MUTED, size=9)
header_cols = ["Trimestre", "CA BNC brut", "CA BIC services brut", "CA vente brut", "Revenu retenu estimé (après abattement)", "Revenu retenu / mois"]
for j, lab in enumerate(header_cols, 1):
    c = pr.cell(row=22, column=j, value=lab)
    c.font = Font(bold=True, color="FFFFFF")
    c.fill = HEAD
    c.alignment = Alignment(wrap_text=True)
for q in range(4):
    i = 23 + q
    a, b = 5 + 3 * q, 7 + 3 * q
    pr.cell(row=i, column=1, value=f'="T{q+1} "&annee')
    pr.cell(row=i, column=2, value=f"=SUM(B{a}:B{b})")
    pr.cell(row=i, column=3, value=f"=SUM(C{a}:C{b})")
    pr.cell(row=i, column=4, value=f"=SUM(D{a}:D{b})")
    pr.cell(row=i, column=5, value=f"=B{i}*(1-abt_bnc)+C{i}*(1-abt_bic)+D{i}*(1-abt_vente)")
    pr.cell(row=i, column=6, value=f"=E{i}/3")
    for j in range(2, 7):
        pr.cell(row=i, column=j).number_format = EUR
        pr.cell(row=i, column=j).fill = CALC

# ───────────────────────── Tableau de bord ─────────────────────────
tb = wb.create_sheet("Tableau de bord", 0)
title(tb, "ATLAS — Entreprise", "Synthèse calculée à partir des onglets Recettes, Factures, Dépenses et Provisions. Rien n'est saisi ici.")
tb.column_dimensions["A"].width = 44
tb.column_dimensions["B"].width = 18
tb.column_dimensions["C"].width = 54
kpis = [
    ("Activité", None, None),
    ("Année", "=annee", ""),
    ("Statut suivi", "=statut", ""),
    ("CA encaissé sur l'année", "=Provisions!E17", "Somme du livre des recettes"),
    ("CA encaissé ce mois-ci", "=IF(YEAR(TODAY())=annee,INDEX(Provisions!E5:E16,MONTH(TODAY())),\"\")", ""),
    ("Dépenses de l'année", "=Provisions!K17", ""),
    ("Part des dépenses dans le CA", "=IF(Provisions!E17=0,\"\",Provisions!K17/Provisions!E17)", "Repère pour le point de bascule vers le réel"),
    ("Factures", None, None),
    ("Montant en attente de paiement", f"=SUMIFS(Factures!L5:L{N+4},Factures!K5:K{N+4},\"<>Payée\")", ""),
    ("Dont en retard", f"=SUMIFS(Factures!L5:L{N+4},Factures!K5:K{N+4},\"En retard\")", ""),
    ("Nombre de factures en retard", f"=COUNTIF(Factures!K5:K{N+4},\"En retard\")", ""),
    ("Nombre de clients", f"=COUNTA(Clients!B5:B{N+4})", ""),
    ("Provisions", None, None),
    ("Total à mettre de côté sur l'année", "=Provisions!J17", "Cotisations + VFL ou provision IR + coussin"),
    ("Dont cotisations URSSAF", "=N(Provisions!F17)", ""),
    ("Revenu réellement disponible sur l'année", "=Provisions!L17", "CA − provisions − dépenses"),
    ("Revenu réellement disponible / mois écoulé", "=IF(Provisions!E17=0,\"\",Provisions!L17/IF(YEAR(TODAY())=annee,MONTH(TODAY()),12))", ""),
    ("Seuils et alertes", None, None),
    ("CA vs franchise de TVA (37 500 €)", "=Provisions!E17/seuil_tva", ""),
    ("CA vs plafond micro (83 600 €)", "=Provisions!E17/plafond_micro", ""),
    ("Alerte TVA", "=IF(Provisions!E17>seuil_tva_maj,\"DÉPASSÉ : TVA due depuis le jour du dépassement\",IF(Provisions!E17>seuil_tva,\"Seuil franchi : TVA à facturer à partir du 1er janvier suivant\",IF(Provisions!E17>0.8*seuil_tva,\"Attention : plus de 80 % du seuil\",\"OK\")))", ""),
    ("Alerte point de bascule", "=IF(Provisions!E17=0,\"\",IF(Provisions!K17/Provisions!E17>MIN(bascule_bnc,bascule_bic),\"Charges élevées : refaire la comparaison micro / EI au réel\",\"OK\"))", "Seuils issus de la simulation, voir Paramètres"),
    ("Alerte compte dédié", "=IF(Provisions!E17>seuil_compte,\"CA > 10 000 € : compte dédié obligatoire si c'est la 2e année consécutive\",\"OK\")", ""),
    ("Alerte justificatifs", f"=IF(COUNTIF(Dépenses!G5:G{N+4},\"Non\")>0,COUNTIF(Dépenses!G5:G{N+4},\"Non\")&\" dépense(s) sans justificatif\",\"OK\")", ""),
    ("ACRE", "=IF(acre<>\"Oui\",\"Non demandée / non accordée\",\"Active jusqu'au \"&TEXT(fin_acre,\"dd/mm/yyyy\"))", ""),
]
r = 4
for lab, f, note in kpis:
    if f is None:
        tb.cell(row=r, column=1, value=lab).font = Font(bold=True, color=ACCENT, size=12)
        r += 1
        continue
    tb.cell(row=r, column=1, value=lab)
    c = tb.cell(row=r, column=2, value=f)
    c.fill = CALC
    c.border = BOX
    c.font = Font(bold=True)
    if "vs" in lab or "Part" in lab:
        c.number_format = PCT
    elif not lab.startswith(("Année", "Statut", "Nombre", "Alerte", "ACRE")):
        c.number_format = EUR
    tb.cell(row=r, column=3, value=note).font = Font(color=MUTED, size=9)
    if lab.startswith("Alerte"):
        tb.conditional_formatting.add(f"B{r}", FormulaRule(formula=[f'AND(B{r}<>"OK",B{r}<>"")'], fill=WARN))
        tb.conditional_formatting.add(f"B{r}", CellIsRule(operator="equal", formula=['"OK"'], fill=OK))
        c.alignment = Alignment(wrap_text=True)
        tb.column_dimensions["B"].width = 30
    r += 1

ch = BarChart()
ch.title = "CA encaissé, dépenses et provisions par mois"
ch.y_axis.title = "€"
ch.height, ch.width = 8, 22
data = Reference(pr, min_col=5, min_row=4, max_row=16)
ch.add_data(data, titles_from_data=True)
ch.add_data(Reference(pr, min_col=10, min_row=4, max_row=16), titles_from_data=True)
ch.add_data(Reference(pr, min_col=11, min_row=4, max_row=16), titles_from_data=True)
ch.set_categories(Reference(pr, min_col=1, min_row=5, max_row=16))
tb.add_chart(ch, "E4")
lc = LineChart()
lc.title = "CA cumulé"
lc.height, lc.width = 8, 22
lc.add_data(Reference(pr, min_col=13, min_row=4, max_row=16), titles_from_data=True)
lc.set_categories(Reference(pr, min_col=1, min_row=5, max_row=16))
tb.add_chart(lc, "E22")

wb.save(OUT)
print("OK", OUT)
