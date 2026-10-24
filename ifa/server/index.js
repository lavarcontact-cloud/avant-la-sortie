import { createApp } from './app.js';
import { config, pushConfigured, mailConfigured } from './config.js';
import { migrate } from '../scripts/migrate.js';
import { startScheduler } from './lib/scheduler.js';

await migrate({ quiet: true });
await (await import('./lib/official.js')).importOfficialPhotos();
await (await import('./lib/official.js')).importOfficialContent();
createApp().listen(config.port, () => {
  console.log(`Fréquence API sur :${config.port} (${config.env})`);
  console.log(`  push web : ${pushConfigured() ? 'configuré' : 'NON configuré (npm run vapid)'}`);
  console.log(`  e-mail   : ${mailConfigured() ? 'configuré' : 'NON configuré (SMTP_URL)'}`);
});
startScheduler();
