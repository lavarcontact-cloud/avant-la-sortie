// Point d'entrée Vercel : toute l'API Express dans une seule fonction.
import { createApp } from '../server/app.js';

export default createApp({ serverless: true });
