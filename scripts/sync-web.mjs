import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const webDir = join(root, 'www');
const files = [
  'index.html',
  'app.js',
  'sw.js',
  'manifest.webmanifest',
  'logo.svg'
];

if (existsSync(webDir)) {
  rmSync(webDir, { recursive: true, force: true });
}

mkdirSync(webDir, { recursive: true });

for (const file of files) {
  cpSync(join(root, file), join(webDir, file), { force: true });
}
