import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const webDir = join(root, 'www');
const files = [
  'CNAME',
  'index.html',
  'auth-bridge.html',
  'app.js',
  'sw.js',
  'manifest.webmanifest',
  'logo.svg'
];
const directories = ['icons'];

if (existsSync(webDir)) {
  rmSync(webDir, { recursive: true, force: true });
}

mkdirSync(webDir, { recursive: true });

for (const file of files) {
  cpSync(join(root, file), join(webDir, file), { force: true });
}

for (const dir of directories) {
  const source = join(root, dir);
  if (!existsSync(source)) continue;
  cpSync(source, join(webDir, dir), { recursive: true, force: true });
}
