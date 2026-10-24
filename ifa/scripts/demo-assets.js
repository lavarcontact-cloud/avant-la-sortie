// Génère (une fois) les visuels abstraits de la démo dans server/demo/assets/.
// Ce ne sont PAS des images d'Ifa : de simples dégradés et une tonalité.
import { execFileSync } from 'node:child_process';
const out = new URL('../server/demo/assets/', import.meta.url).pathname;
const ff = (name, args) => execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...args, out + name]);
const pal = [['0xFFB81C', '0x2A1F5C'], ['0x8D6BFF', '0x0A0A0B'], ['0x35D9B8', '0x131315'], ['0xFF5A3C', '0x1B1B1F'], ['0xEEE9DF', '0x2A1F5C']];
const img = (i, w, h) => ff(`img${i}.jpg`, ['-f', 'lavfi', '-i', `gradients=s=${w}x${h}:c0=${pal[i % 5][0]}:c1=${pal[i % 5][1]}:x0=0:y0=0:x1=${w}:y1=${h}:seed=${i}`, '-frames:v', '1', '-q:v', '5']);
const vid = (i) => ff(`vid${i}.mp4`, ['-f', 'lavfi', '-i', `gradients=s=540x960:c0=${pal[i % 5][0]}:c1=${pal[i % 5][1]}:speed=0.02:d=6:seed=${i}`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'veryfast', '-crf', '32', '-movflags', '+faststart', '-an']);
for (const i of [0, 1, 2, 3, 4, 5]) img(i, 1080, 1350);
for (const i of [7, 8]) img(i, 1080, 1080);
for (const i of [10, 12, 20]) img(i, 1080, 1440);
for (const i of [0, 1, 2, 3, 6, 8]) vid(i);
ff('preview.mp3', ['-f', 'lavfi', '-i', 'sine=frequency=110:duration=20', '-f', 'lavfi', '-i', 'sine=frequency=165:duration=20', '-filter_complex', 'amix=inputs=2,volume=0.6,afade=t=in:d=1,afade=t=out:st=18:d=2', '-b:a', '64k']);
console.log('assets de démo générés');
