# ATLAS — Registre des vérifications

Chaque affirmation technique ou réglementaire utilisée dans la conception, avec sa source et sa date.
**Statuts :** ✅ vérifié sur source officielle · 🟡 vérifié sur sources secondaires · ⚪ non vérifié (connaissance antérieure, à confirmer).

| # | Affirmation | Statut | Source | Vérifié le |
|---|---|---|---|---|
| 1 | Nickel propose une API DSP2 (standard Berlin Group) pour l'information sur les comptes et l'initiation de paiement, via un portail développeur réservé aux prestataires. | 🟡 | [nickel.eu/en-fr/api-dsp2](https://nickel.eu/en-fr/api-dsp2), [psdapistore.nickel.eu](https://psdapistore.nickel.eu/) | 11/11/2026 |
| 2 | La prise en charge de Nickel par Powens ou Bridge n'a pas pu être confirmée. | ⚪ | Pas de source trouvée. Demander aux agrégateurs. | 11/11/2026 |
| 3 | Powens, Bridge, Tink, TrueLayer, Fintecture font partie des acteurs DSP2 (agrégation / initiation) en France ; Bridge est agréé AISP/PISP depuis 2018. | 🟡 | [Crassula — open banking](https://crassula.io/fr/solutions/digital-banking/guides/open-banking/), [JDN — agréments DSP2](https://www.journaldunet.com/fintech/1486993-dsp2-que-font-les-fintech-de-leurs-agrements/) | 11/11/2026 |
| 4 | API Qonto : OAuth (`oauth.qonto.com`), base `thirdparty.qonto.com/v2`, création de virement SEPA (scope `payment.write`, SCA sauf bénéficiaire de confiance), vérification du bénéficiaire (`verify_payee`, `vop_proof_token`), sandbox. | ✅ | [docs.qonto.com — SEPA transfers create](https://docs.qonto.com/api-reference/business-api/payments-transfers/sepa-transfers/sepa-transfers/create), [use case](https://docs.qonto.com/get-started/business-api/use-cases/send-sepa-transfer) | 11/11/2026 |
| 5 | GoCardless Bank Account Data (ex-Nordigen) n'accepte plus de nouvelles inscriptions. | 🟡 | [DEV — signups disabled](https://dev.to/johnfrandsen/gocardless-bank-account-data-alternatives-what-to-use-when-signups-are-disabled-326d), [forum Invoice Ninja](https://forum.invoiceninja.com/t/gocardless-nordigen-service-no-longer-available-alternative-needed/22576) | 11/11/2026 |
| 6 | API Particulier (dont quotient familial CAF, statut demandeur d'emploi) est réservée aux administrations, collectivités et organismes en mission de service public, avec habilitation DataPass. Pas d'accès particulier. | ✅ | [data.gouv.fr — API Particulier](https://www.data.gouv.fr/dataservices/api-particulier) | 11/11/2026 |
| 7 | Facturation électronique : réception obligatoire pour toutes les entreprises (micro comprises) au 01/09/2026 ; émission et e-reporting pour PME/micro au 01/09/2027. | 🟡 | [Keobiz](https://www.keobiz.fr/le-mag/facturation-electronique-calendrier-2026-2027/), [Cegid](https://www.cegid.com/fr/facture-electronique-obligatoire/calendrier-facture-electronique/). **À confirmer sur impots.gouv.fr / Légifrance.** | 11/11/2026 |
| 8 | Twilio, appel vers mobile français : ≈ 0,15–0,16 $/min hors EEE, ≈ 0,04 $/min depuis l'EEE (tarification selon l'origine). | 🟡 | [twilio.com/voice/pricing/fr](https://www.twilio.com/voice/pricing/fr), [Twilio — origin based pricing](https://support.twilio.com/hc/en-us/articles/223183188-Origin-Based-Pricing-for-European-destinations) | 11/11/2026 |
| 9 | Movento.dev : seul le titre de la page a été lisible (rendu côté client). Aucun template consulté. | ✅ (constat) | [movento.dev](https://movento.dev/) | 11/11/2026 |
| 10 | Push web sur iOS disponible pour les PWA ajoutées à l'écran d'accueil depuis iOS 16.4. | ⚪ | Connaissance antérieure. | — |
| 11 | Instagram : API limitée aux comptes professionnels (Basic Display API arrêtée fin 2024). | ⚪ | Connaissance antérieure. | — |
| 12 | Snapchat : pas d'API publique de statistiques organiques pour un créateur ; API Marketing pour la publicité. | ⚪ | Connaissance antérieure. | — |
| 13 | Gmail : scopes de lecture « restreints » ; app non vérifiée en mode test → jetons de rafraîchissement valables 7 jours. | ⚪ | Connaissance antérieure. | — |
| 14 | Supabase Free : pause après inactivité et pas de sauvegardes ; Pro ≈ 25 $/mois. | ⚪ | Connaissance antérieure. | — |
| 15 | Apple Developer Program : 99 $/an ; une app Apple Watch nécessite du natif (watchOS). | ⚪ | Connaissance antérieure. | — |

Toute ligne ⚪ doit passer en ✅ avant que la fonctionnalité correspondante soit développée.
