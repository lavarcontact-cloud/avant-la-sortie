// Reformulation OPTIONNELLE d'une analyse déterministe par Claude.
// Le modèle reçoit l'analyse JSON déjà calculée et doit seulement la rendre
// plus naturelle. Il n'a accès à aucune donnée de marché et toute réponse
// contenant un nombre absent de l'analyse est rejetée (garde-fou serveur).
// Désactivée tant que ANTHROPIC_API_KEY n'est pas configurée.

import Anthropic from '@anthropic-ai/sdk';
import { clientKey, json, log, rateLimit } from './_lib';
import { inventedNumbers } from '../src/copilot/guard';
import type { Answer } from '../src/copilot/copilot';

const MODEL = process.env.COPILOT_MODEL ?? 'claude-opus-5-5';
const MAX_BODY = 16_000;

const SYSTEM = `Tu es Vigie, copilote pédagogique d'une application de simulation de trading crypto.
Tu reçois une analyse déjà calculée (JSON) et la question de l'utilisateur.
Ta seule tâche : reformuler l'analyse en français clair, en 120 mots maximum, au niveau indiqué.
Règles impératives :
- N'utilise AUCUN nombre, date, prix, pourcentage ou probabilité qui ne figure pas dans le JSON.
- N'ajoute aucun fait, aucune actualité, aucune cause externe.
- Conserve la séparation entre faits observés, hypothèses et incertitudes.
- Ne dis jamais d'acheter ou de vendre. Si l'analyse s'abstient, explique pourquoi sans combler le vide.
- Pas de promesse de gain, pas de ton d'urgence.`;

export function validate(body: unknown): { question: string; level: string; answer: Answer } | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if (typeof b.question !== 'string' || b.question.length > 500) return null;
  if (!['debutant', 'confirme', 'expert'].includes(String(b.level))) return null;
  const a = b.answer as Answer;
  if (!a || typeof a.title !== 'string' || typeof a.summary !== 'string' || !Array.isArray(a.facts)) return null;
  return { question: b.question, level: String(b.level), answer: a };
}

export async function GET() {
  return json({ llm: Boolean(process.env.ANTHROPIC_API_KEY), model: process.env.ANTHROPIC_API_KEY ? MODEL : null });
}

export async function handleCopilot(req: Request, client?: Pick<Anthropic, 'beta'>) {
  if (!process.env.ANTHROPIC_API_KEY && !client) return json({ error: 'Reformulation IA non configurée' }, 503);
  if (!rateLimit(`copilot:${clientKey(req)}`, 10, 60_000)) return json({ error: 'Trop de requêtes, réessaie dans une minute' }, 429, { 'retry-after': '30' });
  const raw = await req.text();
  if (raw.length > MAX_BODY) return json({ error: 'Requête trop volumineuse' }, 413);
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return json({ error: 'JSON invalide' }, 400); }
  const input = validate(parsed);
  if (!input) return json({ error: 'Requête invalide' }, 400);

  const c = client ?? new Anthropic();
  try {
    const res = await c.beta.messages.create({
      model: MODEL,
      max_tokens: 1024,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system: SYSTEM,
      messages: [{ role: 'user', content: `Niveau : ${input.level}\nQuestion : ${input.question}\nAnalyse (JSON) :\n${JSON.stringify(input.answer)}` }],
    });
    if (res.stop_reason === 'refusal') return json({ fallback: true, reason: 'refus' });
    const text = res.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('').trim();
    const invented = inventedNumbers(text, input.answer);
    log('copilot_llm', { model: res.model, in: res.usage.input_tokens, out: res.usage.output_tokens, rejected: invented.length > 0 });
    if (!text || invented.length) return json({ fallback: true, reason: 'nombres_non_sources', invented });
    return json({ text, model: res.model });
  } catch (e) {
    const status = e instanceof Anthropic.APIError ? e.status : 0;
    log('copilot_llm_error', { status });
    return json({ fallback: true, reason: status === 429 ? 'limite_fournisseur' : 'erreur_fournisseur' }, 200);
  }
}

export const POST = (req: Request) => handleCopilot(req);
