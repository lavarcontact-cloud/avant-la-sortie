// Classification des réponses par règles (FR/EN). Ce n'est PAS une IA :
// le niveau de confiance reflète la force des indices trouvés, et toute
// classification est corrigeable manuellement.
import type { Classification, Intent } from "./constants";

type Rule = { re: RegExp; w: number };
const R = (re: RegExp, w = 1): Rule => ({ re, w });

const AUTO: Rule[] = [
  R(/réponse automatique|message automatique|auto[- ]?reply|automatic reply|out of (the )?office|absent(e)? du bureau|en congés?|je suis actuellement absent|currently out|ne pas répondre|do not reply|noreply/i, 3),
  R(/nous avons bien reçu votre (message|demande)|we have received your (message|request)|ticket (n°|#|number)/i, 2),
];
const NEG: Rule[] = [
  R(/pas intéress|not interested|ne (sommes|suis) pas en mesure|unable to|malheureusement|unfortunately|décliner|decline|pas de budget|no budget|pas pour le moment|not at this time|ne correspond pas|not a fit|n'avons pas de besoin|pas de collaboration/i, 2),
  R(/\bnon merci\b|no thanks|pass on this/i, 2),
];
const OPT_OUT = /ne plus (me |nous )?(contacter|solliciter|écrire)|retirez[- ](moi|nous)|désinscri|unsubscribe|remove (me|us) from|stop (contacting|emailing)|do not contact/i;
const POS: Rule[] = [
  R(/intéress|interested|avec plaisir|with pleasure|ravi|delighted|happy to|volontiers|let'?s (talk|discuss|chat)|on aimerait|we('d| would) love|great fit|super projet|ça nous plait|ça nous plaît|partant/i, 2),
  R(/collaborer|collaboration|work together|travailler ensemble|partenariat|partnership/i, 1),
  R(/envoyer (un|le|des) produits?|send (you )?(a |the )?products?|gifting|on peut vous envoyer|we can send/i, 2),
];
const INFO: Rule[] = [
  R(/\?|pourriez-vous|could you|can you|pouvez-vous|merci de (nous )?(envoyer|préciser)|plus d'infos|more info|en savoir plus|quels sont|what are/i, 1),
];

const INTENT_RULES: Record<Exclude<Intent, "opt_out">, RegExp> = {
  pricing_request: /tarif|prix|rate card|rates|pricing|devis|quote|budget|combien|how much|coût|cost/i,
  media_kit_request: /media ?kit|kit média|press kit|statistiques|stats|insights|audience/i,
  meeting: /rendez[- ]vous|\brdv\b|appel|call|visio|meeting|réunion|disponibilités|disponible (pour|le)|availability|calendly|zoom|teams|meet\b/i,
  partnership: /partenariat|partnership|ambassad|collaboration|collaborer|campagne|campaign/i,
};

function score(text: string, rules: Rule[]) {
  return rules.reduce((s, r) => s + (r.re.test(text) ? r.w : 0), 0);
}

export interface ClassificationResult {
  classification: Classification;
  intents: Intent[];
  confidence: number; // 0..1
  reasons: string[];
}

export function classifyResponse(raw: string): ClassificationResult {
  const text = (raw || "").trim();
  if (!text) return { classification: "neutral", intents: [], confidence: 0, reasons: ["Texte vide"] };

  const intents: Intent[] = [];
  for (const [k, re] of Object.entries(INTENT_RULES)) if (re.test(text)) intents.push(k as Intent);
  const optOut = OPT_OUT.test(text);
  if (optOut) intents.push("opt_out");

  const auto = score(text, AUTO);
  const neg = score(text, NEG) + (optOut ? 3 : 0);
  // Les formules négatives (« pas intéressés ») ne doivent pas compter comme marqueurs positifs.
  const NEGATED = /(ne |n')?(sommes|suis|est|sont)? ?pas (du tout )?(intéress\w*|partant\w*)|not (really )?interested|no longer interested/gi;
  const pos = score(text.replace(NEGATED, " "), POS);
  const info = score(text, INFO) + (intents.includes("pricing_request") || intents.includes("media_kit_request") ? 1 : 0);

  const reasons: string[] = [];
  let classification: Classification;
  let strength: number;
  if (auto >= 2 && pos < 2) {
    classification = "automatic"; strength = auto; reasons.push("Formule de réponse automatique détectée");
  } else if (neg > pos && neg >= 2) {
    classification = "negative"; strength = neg - pos; reasons.push(optOut ? "Demande de ne plus être contacté" : "Formule de refus détectée");
  } else if (pos >= 2 && pos >= neg) {
    classification = "positive"; strength = pos - neg; reasons.push("Marqueurs d'intérêt détectés");
    if (intents.includes("meeting")) { strength += 1; reasons.push("Proposition d'échange / rendez-vous"); }
  } else if (info >= 1 || intents.includes("pricing_request") || intents.includes("media_kit_request")) {
    classification = "info_request"; strength = info; reasons.push("Questions ou demande d'éléments");
  } else {
    classification = "neutral"; strength = 0; reasons.push("Aucun indice net");
  }
  // Une demande de tarifs ou de media kit sans refus est un signal positif fort.
  if (classification === "info_request" && (intents.includes("pricing_request") || intents.includes("media_kit_request")) && neg === 0) {
    reasons.push("Demande de tarifs / Media Kit : signal d'intérêt");
  }
  const confidence = classification === "neutral" ? 0.3 : Math.min(0.95, 0.45 + strength * 0.12);
  return { classification, intents: [...new Set(intents)], confidence: Math.round(confidence * 100) / 100, reasons };
}
