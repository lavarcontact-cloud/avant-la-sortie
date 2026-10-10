import { describe, expect, it, vi } from 'vitest';
import { handleCandles } from './candles';
import { handleCopilot, validate } from './copilot';
import { rateLimit } from './_lib';

const answer = { title: 'BTC : -1,0 %', summary: 'Clôture à 74 072 €.', facts: ['Volume 1,2×'], data: [], hypotheses: [], scenarios: [], risks: [], uncertainty: [] };
const post = (body: unknown, ip = '1.1.1.1') => new Request('https://x/api/copilot', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body), headers: { 'x-forwarded-for': ip } });

function fakeClient(text: string, extra: Record<string, unknown> = {}) {
  const create = vi.fn().mockResolvedValue({ content: [{ type: 'text', text }], stop_reason: 'end_turn', model: 'm', usage: { input_tokens: 1, output_tokens: 1 }, ...extra });
  return { client: { beta: { messages: { create } } } as never, create };
}

describe('/api/candles', () => {
  it('refuse les produits hors liste blanche (pas de relais arbitraire)', async () => {
    const f = vi.fn();
    const r = await handleCandles(new Request('https://x/api/candles?product=../../admin&granularity=86400'), f);
    expect(r.status).toBe(400);
    expect(f).not.toHaveBeenCalled();
  });
  it('relaie et met en cache une réponse valide', async () => {
    const f = vi.fn().mockResolvedValue(new Response(JSON.stringify([[1, 1, 2, 1, 2, 3]])));
    const r = await handleCandles(new Request('https://x/api/candles?product=BTC-EUR&granularity=86400', { headers: { 'x-forwarded-for': '9.9.9.9' } }), f);
    expect(r.status).toBe(200);
    expect(r.headers.get('cache-control')).toMatch(/s-maxage=60/);
    expect((await r.json()).source).toBe('Coinbase Exchange');
  });
  it('erreur amont : 502 sans fuite de détail', async () => {
    const f = vi.fn().mockResolvedValue(new Response('secret stack', { status: 500 }));
    const r = await handleCandles(new Request('https://x/api/candles?product=ETH-EUR', { headers: { 'x-forwarded-for': '8.8.8.8' } }), f);
    expect(r.status).toBe(502);
    expect(await r.text()).not.toMatch(/secret/);
  });
});

describe('/api/copilot', () => {
  it('validation des entrées', () => {
    expect(validate({ question: 'x'.repeat(501), level: 'debutant', answer })).toBeNull();
    expect(validate({ question: 'ok', level: 'admin', answer })).toBeNull();
    expect(validate({ question: 'ok', level: 'expert', answer })).not.toBeNull();
  });
  it('sans clé API : 503 explicite', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect((await handleCopilot(post({ question: 'q', level: 'debutant', answer }))).status).toBe(503);
  });
  it('JSON invalide et corps trop gros rejetés', async () => {
    const { client } = fakeClient('ok');
    expect((await handleCopilot(post('{oops', '2.2.2.1'), client)).status).toBe(400);
    expect((await handleCopilot(post('x'.repeat(20_000), '2.2.2.2'), client)).status).toBe(413);
  });
  it('accepte une reformulation fidèle', async () => {
    const { client, create } = fakeClient('Le bitcoin a clôturé à 74 072 €, je ne connais pas la cause.');
    const r = await (await handleCopilot(post({ question: 'q', level: 'debutant', answer }, '3.3.3.3'), client)).json();
    expect(r.text).toMatch(/74 072/);
    const args = create.mock.calls[0][0];
    expect(args.fallbacks).toBe('default');
    expect(args.output_config.effort).toBe('low');
  });
  it('rejette une reformulation qui invente un chiffre', async () => {
    const { client } = fakeClient('Objectif 90 000 € d\'ici vendredi.');
    const r = await (await handleCopilot(post({ question: 'q', level: 'debutant', answer }, '4.4.4.4'), client)).json();
    expect(r.fallback).toBe(true);
    expect(r.invented).toContain('90000');
  });
  it('refus du modèle : repli déterministe', async () => {
    const { client } = fakeClient('', { stop_reason: 'refusal' });
    const r = await (await handleCopilot(post({ question: 'q', level: 'debutant', answer }, '5.5.5.5'), client)).json();
    expect(r.fallback).toBe(true);
  });
  it('limitation de débit', () => {
    const now = 1_000_000;
    for (let i = 0; i < 3; i++) expect(rateLimit('k-test', 3, 60_000, now)).toBe(true);
    expect(rateLimit('k-test', 3, 60_000, now)).toBe(false);
    expect(rateLimit('k-test', 3, 60_000, now + 20_001)).toBe(true);
  });
});
