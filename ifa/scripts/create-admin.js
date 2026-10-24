// Crée (ou promeut) un compte d'équipe.
// Usage : npm run create-admin -- email@exemple.fr pseudo motdepasse [admin|editor|moderator] [--official]
import { migrate } from './migrate.js';
import { pool, one } from '../server/db.js';
import { hashPassword } from '../server/lib/auth.js';
import { config } from '../server/config.js';

const [email, handle, password, role = 'admin', flag] = process.argv.slice(2);
if (!email || !handle || !password) {
  console.error('Usage : npm run create-admin -- email pseudo motdepasse [admin|editor|moderator] [--official]');
  process.exit(1);
}
if (password.length < 10) { console.error('Mot de passe : 10 caractères minimum pour un compte équipe'); process.exit(1); }
await migrate({ quiet: true });
const u = await one(`insert into users (email, password_hash, handle, birth_year, birth_month, role, is_official, terms_version)
  values ($1,$2,$3,1990,1,$4,$5,$6)
  on conflict (email) do update set role = $4, is_official = $5, password_hash = $2 returning id, handle, role, is_official`,
[email.toLowerCase(), await hashPassword(password), handle, role, flag === '--official', config.termsVersion]);
console.log(`✓ ${u.handle} → ${u.role}${u.is_official ? ' (compte officiel vérifié)' : ''}`);
await pool.end();
