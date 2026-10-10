import "server-only";
import { one, query } from "../db";

/**
 * Indicateurs du tableau de bord. Règles communes :
 * - trafic interne exclu (internal = false) ; robots déjà filtrés à l'ingestion ;
 * - événements client = visiteurs ayant accepté la mesure d'audience
 *   uniquement (sous-échantillon : voir "couverture") ;
 * - conversions (devis, paiements) = événements serveur, exhaustifs.
 */

const C = `internal = false AND server_side = false AND ts >= now() - make_interval(days => $1)`;
const S = `server_side = true AND ts >= now() - make_interval(days => $1)`;

const n = (v: unknown) => Number(v ?? 0);

export async function getKpis(days: number) {
  const p = [days];
  const [traffic, quotes, checkouts, paymentsOk, revenue, consentStats] = await Promise.all([
    one(`SELECT count(DISTINCT vid) AS visitors, count(DISTINCT sid) AS sessions, count(*) FILTER (WHERE name = 'page_view') AS pageviews FROM events WHERE ${C}`, p),
    one(`SELECT count(*) AS c FROM quotes WHERE created_at >= now() - make_interval(days => $1)`, p),
    one(`SELECT count(*) AS c FROM events WHERE ${S} AND name = 'checkout_started'`, p),
    one(`SELECT count(*) AS c FROM events WHERE ${S} AND name = 'payment_succeeded' AND (props->>'livemode')::boolean IS NOT TRUE`, p).then(async (test) => ({
      test: n(test?.c),
      live: n((await one(`SELECT count(*) AS c FROM events WHERE ${S} AND name = 'payment_succeeded' AND (props->>'livemode')::boolean IS TRUE`, p))?.c),
    })),
    one(
      `SELECT coalesce(sum(amount_cents - refunded_cents) FILTER (WHERE livemode), 0) AS live,
              coalesce(sum(amount_cents - refunded_cents) FILTER (WHERE NOT livemode), 0) AS test
         FROM payments WHERE status IN ('reussi','rembourse_partiel') AND paid_at >= now() - make_interval(days => $1)`,
      p,
    ),
    one(
      `SELECT count(*) FILTER (WHERE (choices->>'audience')::boolean) AS accepted, count(*) AS total
         FROM (SELECT DISTINCT ON (consent_id) choices FROM consents WHERE created_at >= now() - make_interval(days => $1) ORDER BY consent_id, seq DESC) t`,
      p,
    ),
  ]);

  const sessions = n(traffic?.sessions);
  const quoteCount = n(quotes?.c);
  return {
    visitors: n(traffic?.visitors),
    sessions,
    pageviews: n(traffic?.pageviews),
    quotes: quoteCount,
    checkouts: n(checkouts?.c),
    paymentsLive: paymentsOk.live,
    paymentsTest: paymentsOk.test,
    revenueLiveCents: n(revenue?.live),
    revenueTestCents: n(revenue?.test),
    consentAccepted: n(consentStats?.accepted),
    consentTotal: n(consentStats?.total),
  };
}

export async function getBreakdowns(days: number) {
  const p = [days];
  const [topPages, topProjects, videos, bubbles, ctas, outbound, sources, vitals, errors, daily, funnel] = await Promise.all([
    query(`SELECT path AS k, count(*) AS v FROM events WHERE ${C} AND name = 'page_view' GROUP BY path ORDER BY v DESC LIMIT 10`, p),
    query(`SELECT props->>'project' AS k, count(*) AS v FROM events WHERE ${C} AND name = 'project_open' GROUP BY k ORDER BY v DESC LIMIT 10`, p),
    query(
      `SELECT props->>'project' AS k,
              count(*) FILTER (WHERE name = 'video_start') AS starts,
              count(*) FILTER (WHERE name = 'video_progress' AND props->>'pct' = '50') AS half,
              count(*) FILTER (WHERE name = 'video_complete') AS completes
         FROM events WHERE ${C} AND name IN ('video_start','video_progress','video_complete')
        GROUP BY k ORDER BY starts DESC LIMIT 12`,
      p,
    ),
    query(`SELECT props->>'artist' AS k, count(*) AS v FROM events WHERE ${C} AND name = 'artist_bubble_click' GROUP BY k ORDER BY v DESC LIMIT 12`, p),
    query(`SELECT props->>'cta' || ' · ' || coalesce(props->>'surface','') AS k, count(*) AS v FROM events WHERE ${C} AND name = 'cta_click' GROUP BY k ORDER BY v DESC LIMIT 12`, p),
    query(`SELECT props->>'url' AS k, count(*) AS v FROM events WHERE ${C} AND name = 'outbound_click' GROUP BY k ORDER BY v DESC LIMIT 10`, p),
    query(
      `SELECT coalesce(utm_source, referrer_domain, '(direct)') AS k, count(DISTINCT sid) AS v
         FROM events WHERE ${C} AND name = 'page_view' GROUP BY k ORDER BY v DESC LIMIT 10`,
      p,
    ),
    query(
      `SELECT props->>'name' AS k, percentile_cont(0.75) WITHIN GROUP (ORDER BY (props->>'value')::numeric) AS p75, count(*) AS n
         FROM events WHERE ${C} AND name = 'web_vital' GROUP BY k ORDER BY k`,
      p,
    ),
    query(`SELECT props->>'message' AS k, count(*) AS v FROM events WHERE ${C} AND name = 'js_error' GROUP BY k ORDER BY v DESC LIMIT 8`, p),
    query(
      `SELECT to_char(date_trunc('day', ts), 'YYYY-MM-DD') AS day, count(DISTINCT sid) AS sessions, count(*) FILTER (WHERE name = 'video_start') AS plays
         FROM events WHERE ${C} GROUP BY day ORDER BY day`,
      p,
    ),
    one(
      `SELECT
         (SELECT count(DISTINCT sid) FROM events WHERE ${C}) AS sessions,
         (SELECT count(DISTINCT sid) FROM events WHERE ${C} AND name = 'quote_step') AS quote_started,
         (SELECT count(*) FROM quotes WHERE created_at >= now() - make_interval(days => $1)) AS quote_sent,
         (SELECT count(*) FROM events WHERE ${S} AND name = 'checkout_started') AS checkout,
         (SELECT count(*) FROM events WHERE ${S} AND name = 'payment_succeeded') AS paid`,
      p,
    ),
  ]);
  return { topPages, topProjects, videos, bubbles, ctas, outbound, sources, vitals, errors, daily, funnel };
}

/** Purge des données au-delà des durées de conservation documentées. */
export async function purgeExpired() {
  const ev = await query(`DELETE FROM events WHERE ts < now() - interval '25 months' RETURNING 1`);
  const co = await query(`DELETE FROM consents WHERE created_at < now() - interval '25 months' RETURNING 1`);
  const qu = await query(
    `DELETE FROM quotes q WHERE created_at < now() - interval '3 years' AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.quote_id = q.id) RETURNING 1`,
  );
  const rl = await query(`DELETE FROM rate_limits WHERE window_start < now() - interval '1 day' RETURNING 1`);
  return { events: ev.length, consents: co.length, quotes: qu.length, rateLimits: rl.length };
}
