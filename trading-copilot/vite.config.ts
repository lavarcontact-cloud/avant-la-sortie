import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

// Les en-têtes de sécurité de production (vercel.json) sont aussi appliqués en
// prévisualisation locale, pour que les tests de bout en bout s'exécutent sous la même CSP.
const vercel = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8'));
const securityHeaders: Record<string, string> = Object.fromEntries(
  vercel.headers[0].headers.filter((h: { key: string }) => h.key !== 'Strict-Transport-Security').map((h: { key: string; value: string }) => [h.key, h.value]),
);

export default defineConfig({
  plugins: [react()],
  preview: { headers: securityHeaders },
  worker: { format: 'es' },
  test: { include: ['src/**/*.test.ts', 'api/**/*.test.ts'] },
});
