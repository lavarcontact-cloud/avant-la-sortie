import express from 'express';
import cookieParser from 'cookie-parser';
import fs from 'node:fs';
import path from 'node:path';
import { config, pushConfigured } from './config.js';
import { loadUser } from './lib/auth.js';
import { HttpError } from './lib/http.js';
import authRoutes from './routes/auth.js';
import contentRoutes from './routes/content.js';
import interactRoutes from './routes/interact.js';
import laboRoutes from './routes/labo.js';
import communityRoutes from './routes/community.js';
import notifRoutes from './routes/notifs.js';
import mediaRoutes from './routes/media.js';
import adminRoutes from './routes/admin.js';
import uploadRoutes from './routes/uploads.js';
import reminderRoutes from './routes/reminders.js';

export function createApp({ serverless = false } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use((req, res, next) => {
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(self)');
    next();
  });
  app.use(express.json({ limit: '200kb' }));
  app.use(cookieParser());

  // Protection CSRF : toute requête d'écriture doit porter un en-tête que seul
  // notre propre front (même origine) peut poser. Les cookies sont SameSite=Lax.
  app.use('/api', (req, _res, next) => {
    // exception : /uploads/blob reçoit aussi le rappel signé de Vercel Blob ; la
    // route vérifie elle-même l'en-tête pour les demandes venant du navigateur
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && req.get('x-frq') !== '1' && req.path !== '/uploads/blob') {
      return next(new HttpError(403, 'Requête refusée', 'csrf'));
    }
    next();
  });
  if (serverless) {
    // pas de processus permanent : migrations et planificateur déclenchés par les requêtes
    app.get('/api/cron/tick', async (req, res, next) => {
      if (!process.env.CRON_SECRET || req.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return next(new HttpError(401, 'Non autorisé'));
      const { ensureReady } = await import('./lib/bootstrap.js');
      const { tick } = await import('./lib/scheduler.js');
      await ensureReady();
      res.json(await tick());
    });
    app.use('/api', async (req, _res, next) => {
      const { ensureReady, maybeTick } = await import('./lib/bootstrap.js');
      await ensureReady();
      if (req.path !== '/health') await maybeTick();
      next();
    });
  }
  app.use('/api', loadUser);
  app.get('/api/health', async (_req, res) => {
    const { pool } = await import('./db.js');
    const { driver } = await import('./lib/storage.js');
    let db = 'ok';
    try { await pool.query('select 1'); } catch (e) { db = `erreur : ${e.message}`; }
    res.json({ ok: db === 'ok', db, storage: driver, push: pushConfigured() });
  });
  for (const r of [uploadRoutes, reminderRoutes, authRoutes, contentRoutes, interactRoutes, laboRoutes, communityRoutes, notifRoutes, mediaRoutes, adminRoutes]) app.use('/api', r);
  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Route inconnue')));

  // Front compilé (production). En dev, Vite sert le front et proxifie /api.
  const dist = new URL('../web/dist', import.meta.url).pathname;
  if (fs.existsSync(dist)) {
    app.use(express.static(dist, {
      index: false,
      setHeaders: (res, file) => {
        if (file.endsWith('sw.js') || file.endsWith('.webmanifest')) res.setHeader('Cache-Control', 'no-cache');
        else if (file.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      },
    }));
    app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Fichier trop lourd' });
    if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON invalide' });
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, code: err.code });
    if (err?.code === '23505') return res.status(409).json({ error: 'Cet élément existe déjà' });
    if (err?.code === '23503') return res.status(400).json({ error: 'Référence invalide' });
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  });
  return app;
}
