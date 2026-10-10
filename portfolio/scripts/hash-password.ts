// Génère ADMIN_PASSWORD_HASH et un SESSION_SECRET aléatoire.
// Usage : npm run admin:hash -- "mon mot de passe"
import crypto from "node:crypto";

const pwd = process.argv[2];
if (!pwd || pwd.length < 12) {
  console.error("Mot de passe requis, 12 caractères minimum.");
  process.exit(1);
}
const salt = crypto.randomBytes(16);
const N = 16384, r = 8, p = 1;
const key = crypto.scryptSync(pwd, salt, 32, { N, r, p });
console.log(`ADMIN_PASSWORD_HASH=scrypt:${N}:${r}:${p}:${salt.toString("base64url")}:${key.toString("base64url")}`);
console.log(`SESSION_SECRET=${crypto.randomBytes(32).toString("base64url")}`);
