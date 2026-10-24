// Données de démonstration : `npm run seed:demo` (ou `-- --remove` pour tout supprimer).
// Le contenu est défini dans server/lib/demo.js. À ne jamais lancer en production publique.
import { migrate } from './migrate.js';
import { pool } from '../server/db.js';
import { seedDemo, removeDemo, DEMO_DOMAIN, PASSWORD } from '../server/lib/demo.js';

await migrate({ quiet: true });
if (process.argv.includes('--remove')) {
  await removeDemo();
  console.log('✓ données de démonstration supprimées');
} else {
  await seedDemo();
  console.log(`✓ démo prête. Comptes (mot de passe « ${PASSWORD} ») :`);
  console.log(`  demo_admin@${DEMO_DOMAIN} (admin) · demo_edition@${DEMO_DOMAIN} (édition) · demo_modo@${DEMO_DOMAIN} (modération) · nora.19@${DEMO_DOMAIN} (fan)`);
}
await pool.end();
