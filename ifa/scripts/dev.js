// Lance l'API et le front Vite ensemble.
import { spawn } from 'node:child_process';
const run = (args) => spawn('npm', ['run', ...args], { stdio: 'inherit', shell: process.platform === 'win32' });
const procs = [run(['dev:api']), run(['dev:web'])];
const stop = () => { procs.forEach((p) => p.kill()); process.exit(); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
