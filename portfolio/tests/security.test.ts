import { beforeAll, describe, expect, it } from "vitest";
import { createSessionToken, hashPassword, verifyPassword, verifySessionToken } from "@/lib/admin-auth";
import { assertStripeKeyAllowed } from "@/lib/env";
import { isBot, validateEvent } from "@/lib/analytics/events";
import { CONSENT_MAX_AGE_DAYS, POLICY_VERSION, parseConsent, serializeConsent } from "@/lib/consent";
import { quoteInput } from "@/lib/quote";

beforeAll(() => {
  process.env.SESSION_SECRET = "x".repeat(40);
});

describe("authentification admin", () => {
  it("vérifie le bon mot de passe et rejette le mauvais", () => {
    const h = hashPassword("correct horse battery");
    expect(verifyPassword("correct horse battery", h)).toBe(true);
    expect(verifyPassword("wrong", h)).toBe(false);
    expect(verifyPassword("x", undefined)).toBe(false);
    expect(verifyPassword("x", "garbage")).toBe(false);
  });
  it("accepte une session signée et rejette les jetons falsifiés ou expirés", () => {
    const t = createSessionToken();
    expect(verifySessionToken(t)).toBe(true);
    const [payload, sig] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ sub: "admin", exp: 9999999999 })).toString("base64url");
    expect(verifySessionToken(`${forged}.${sig}`)).toBe(false);
    expect(verifySessionToken(`${payload}.AAAA`)).toBe(false);
    expect(verifySessionToken(createSessionToken(Date.now() - 9 * 3600_000))).toBe(false);
    expect(verifySessionToken(undefined)).toBe(false);
  });
  it("refuse de signer sans secret suffisant", () => {
    const old = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = "court";
    expect(verifySessionToken("a.b")).toBe(false);
    expect(() => createSessionToken()).toThrow();
    process.env.SESSION_SECRET = old;
  });
});

describe("garde-fou Stripe", () => {
  it("refuse une clé live sans autorisation explicite", () => {
    delete process.env.STRIPE_LIVE_APPROVED;
    expect(() => assertStripeKeyAllowed("sk_live_123")).toThrow();
    expect(() => assertStripeKeyAllowed("sk_test_123")).not.toThrow();
  });
});

describe("plan de marquage", () => {
  it("rejette les événements inconnus et les paramètres invalides", () => {
    expect(validateEvent("hack", {})).toBeNull();
    expect(validateEvent("video_progress", { project: "a", video: "b", pct: 33 })).toBeNull();
    expect(validateEvent("video_progress", { project: "a", video: "b", pct: 50 })).toEqual({ project: "a", video: "b", pct: 50 });
  });
  it("détecte les robots déclarés", () => {
    expect(isBot("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(isBot("Mozilla/5.0 HeadlessChrome/120")).toBe(true);
    expect(isBot(null)).toBe(true);
    expect(isBot("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1")).toBe(false);
  });
});

describe("consentement", () => {
  const rec = { v: POLICY_VERSION, id: "abc", choices: { audience: true }, ts: Date.now() };
  it("relit un choix valide", () => expect(parseConsent(serializeConsent(rec))?.choices.audience).toBe(true));
  it("redemande le choix après 6 mois", () => expect(parseConsent(serializeConsent({ ...rec, ts: Date.now() - (CONSENT_MAX_AGE_DAYS + 1) * 86400_000 }))).toBeNull());
  it("redemande le choix si la politique change", () => expect(parseConsent(serializeConsent({ ...rec, v: "ancienne" }))).toBeNull());
  it("ignore un cookie corrompu", () => expect(parseConsent("%%%")).toBeNull());
});

describe("formulaire de devis", () => {
  const ok = { service: "clip", description: "Un clip pour un single qui sort en décembre.", budget: "1k-3k", name: "Test", email: "t@example.com", role: "manager", clientType: "pro", startedAt: 1 };
  it("accepte une demande valide", () => expect(quoteInput.safeParse(ok).success).toBe(true));
  it("rejette un e-mail invalide, une description trop courte, un rôle inconnu", () => {
    expect(quoteInput.safeParse({ ...ok, email: "nope" }).success).toBe(false);
    expect(quoteInput.safeParse({ ...ok, description: "court" }).success).toBe(false);
    expect(quoteInput.safeParse({ ...ok, role: "admin" }).success).toBe(false);
  });
  it("rejette le champ piège rempli", () => expect(quoteInput.safeParse({ ...ok, website: "http://spam" }).success).toBe(false));
});
