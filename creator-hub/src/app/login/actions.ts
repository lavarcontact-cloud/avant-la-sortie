"use server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { authConfigured, checkPassword, createSessionToken, SESSION_COOKIE, SESSION_DAYS } from "@/lib/session";
import { audit } from "@/lib/audit";

const attempts = new Map<string, { n: number; until: number }>();

export async function login(_: { error?: string; next?: string } | undefined, fd: FormData): Promise<{ error?: string; next?: string }> {
  if (!authConfigured()) return { error: "Accès non configuré : définissez ADMIN_PASSWORD (et DATABASE_URL ou SESSION_SECRET) dans les variables d'environnement." };
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const a = attempts.get(ip);
  if (a && a.n >= 5 && a.until > Date.now()) return { error: "Trop de tentatives. Réessayez dans quelques minutes." };
  const ok = await checkPassword(String(fd.get("password") ?? ""));
  if (!ok) {
    attempts.set(ip, { n: (a && a.until > Date.now() ? a.n : 0) + 1, until: Date.now() + 10 * 60000 });
    await audit("auth.failed");
    return { error: "Mot de passe incorrect." };
  }
  attempts.delete(ip);
  (await cookies()).set(SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_DAYS * 86400,
  });
  await audit("auth.login");
  const next = String(fd.get("next") || "/hub");
  // Pas de redirect() ici : le navigateur recharge /hub en pleine page (plus fiable, notamment sur Safari iOS).
  return { next: /^\/hub(\/|$|\?)/.test(next) ? next : "/hub" };
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
