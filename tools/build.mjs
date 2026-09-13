import { build } from 'esbuild';
import { copyFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
await build({
  entryPoints: [path.join(root, 'src/app.js')],
  outfile: path.join(root, 'game.js'),
  bundle: true,
  format: 'iife',
  target: ['es2020'],
  loader: { '.webp': 'dataurl' },
  minify: true,
  legalComments: 'eof',
  logLevel: 'info'
});
await mkdir(path.join(root, 'licenses'), { recursive: true });
await copyFile(path.join(root, 'node_modules/three/LICENSE'), path.join(root, 'licenses/three.txt'));
