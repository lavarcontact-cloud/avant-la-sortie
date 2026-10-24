// Préparation au démarrage, utilisée en hébergement sans serveur (Vercel) où il
// n'y a pas de processus permanent : migrations, compte administrateur initial,
// démo facultative, et planificateur déclenché par le trafic.
import { migrate } from '../../scripts/migrate.js';
import { one } from '../db.js';
import { hashPassword } from './auth.js';
import { config } from '../config.js';
import { tick } from './scheduler.js';

let ready = null;
export function ensureReady() {
  ready ||= (async () => {
    await migrate({ quiet: true });
    // Compte administrateur initial (variables ADMIN_EMAIL / ADMIN_PASSWORD), créé une seule fois.
    const email = process.env.ADMIN_EMAIL?.toLowerCase();
    if (email && process.env.ADMIN_PASSWORD && !(await one('select 1 from users where email = $1', [email]))) {
      const handle = (process.env.ADMIN_HANDLE || 'regie').slice(0, 24);
      await one(`insert into users (email, password_hash, handle, birth_year, birth_month, role, terms_version)
        values ($1,$2,$3,1990,1,'admin',$4) on conflict do nothing returning id`,
      [email, await hashPassword(process.env.ADMIN_PASSWORD), handle, config.termsVersion]);
    }
    if (process.env.DEMO_SEED === '1') {
      const { seedDemoOnce } = await import('./demo.js');
      await seedDemoOnce();
    }
  })().catch((e) => { ready = null; throw e; });
  return ready;
}

// Planificateur "paresseux" : au plus un tour par minute et par instance,
// déclenché par les requêtes, en plus de la tâche cron quotidienne.
let lastTick = 0;
export async function maybeTick() {
  if (Date.now() - lastTick < 60e3) return;
  lastTick = Date.now();
  await tick().catch((e) => console.error('[scheduler]', e.message));
}
