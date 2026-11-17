import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "./lib/session";

/**
 * Filtre rapide : sans cookie de session, on renvoie vers la connexion.
 * La vérification cryptographique complète (signature HMAC, expiration) est faite
 * côté serveur par requireAuth() / isAuthed() dans chaque page, action et API du Hub —
 * dans le même environnement d'exécution que la connexion, donc toujours avec la même clé.
 */
export async function proxy(req: NextRequest) {
  if (req.cookies.get(SESSION_COOKIE)?.value) return NextResponse.next();
  if (req.nextUrl.pathname.startsWith("/api/")) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const url = new URL("/login", req.url);
  url.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/hub/:path*", "/api/hub/:path*"] };
