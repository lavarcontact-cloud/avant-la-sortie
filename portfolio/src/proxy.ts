import { NextResponse, type NextRequest } from "next/server";

/**
 * Première barrière : sans cookie de session, /admin redirige vers la
 * connexion. La vérification cryptographique complète (signature,
 * expiration) est refaite dans chaque page et action serveur via
 * requireAdmin() : ce proxy n'est qu'un filtre rapide, pas la sécurité.
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === "/admin/login") return NextResponse.next();
  if (!req.cookies.get("sfp_admin")?.value) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/admin", "/admin/:path*"] };
