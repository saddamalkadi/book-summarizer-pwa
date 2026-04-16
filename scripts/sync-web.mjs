import { cpSync, existsSync, mkdirSync, rmSync, readdirSync, statSync } from 'node:fs';
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

/** Only ship the downloads landing page + current APKs (avoid bloating Pages with legacy binaries). */
const downloadsSrc = join(root, 'downloads');
const downloadsDest = join(webDir, 'downloads');
if (existsSync(downloadsSrc)) {
  mkdirSync(downloadsDest, { recursive: true });
  const indexSrc = join(downloadsSrc, 'index.html');
  if (existsSync(indexSrc)) {
    cpSync(indexSrc, join(downloadsDest, 'index.html'), { force: true });
  }
  const allowedNames = new Set([
    'ai-workspace-studio-latest.apk',
    'ai-workspace-studio-v8.85.0-android-release.apk'
  ]);
  for (const name of readdirSync(downloadsSrc)) {
    if (!allowedNames.has(name)) continue;
    const p = join(downloadsSrc, name);
    if (statSync(p).isFile()) {
      cpSync(p, join(downloadsDest, name), { force: true });
    }
  }
}
