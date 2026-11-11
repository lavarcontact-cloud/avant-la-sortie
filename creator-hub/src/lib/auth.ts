import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySessionToken } from "./session";

export async function isAuthed() {
  return verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
}

/** À appeler en tête de chaque page privée et de chaque server action. */
export async function requireAuth() {
  if (!(await isAuthed())) redirect("/login");
}
