import { cpSync, existsSync, mkdirSync, rmSync, readdirSync, statSync, writeFileSync } from 'node:fs';
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
  'logo.svg',
  'robots.txt',
  '_config.yml'
];
const directories = ['icons'];

/**
 * Build mode:
 *   pages     → for GitHub Pages/web (includes downloads landing + APK)
 *   capacitor → for the Android/Capacitor bundle (excludes downloads/ to avoid shipping the APK inside itself)
 * Default is 'capacitor' (safer: invoked by `npx cap sync`) and CI's Pages step sets MODE=pages.
 */
const MODE = String(process.env.SYNC_WEB_MODE || 'capacitor').toLowerCase();

if (existsSync(webDir)) {
  rmSync(webDir, { recursive: true, force: true });
}

mkdirSync(webDir, { recursive: true });

for (const file of files) {
  const source = join(root, file);
  if (!existsSync(source)) continue;
  cpSync(source, join(webDir, file), { force: true });
}

for (const dir of directories) {
  const source = join(root, dir);
  if (!existsSync(source)) continue;
  cpSync(source, join(webDir, dir), { recursive: true, force: true });
}

if (MODE === 'pages') {
  /** Only ship the downloads landing page + current release APKs (avoid bloating Pages with legacy binaries).
   *  Accept the canonical "latest" file plus any versioned "ai-workspace-studio-vX.Y.Z-android-release.apk"
   *  produced by CI — no per-version hardcoded filename needed. */
  const downloadsSrc = join(root, 'downloads');
  const downloadsDest = join(webDir, 'downloads');
  if (existsSync(downloadsSrc)) {
    mkdirSync(downloadsDest, { recursive: true });
    const indexSrc = join(downloadsSrc, 'index.html');
    if (existsSync(indexSrc)) {
      cpSync(indexSrc, join(downloadsDest, 'index.html'), { force: true });
    }
    const versionedApkRe = /^ai-workspace-studio-v\d+\.\d+(?:\.\d+)?-android-release\.apk$/i;
    const canonicalApk = 'ai-workspace-studio-latest.apk';
    for (const name of readdirSync(downloadsSrc)) {
      if (name !== canonicalApk && !versionedApkRe.test(name)) continue;
      const p = join(downloadsSrc, name);
      if (statSync(p).isFile()) {
        cpSync(p, join(downloadsDest, name), { force: true });
      }
    }
  }
} else {
  /** Capacitor bundle: avoid bundling APK artifacts inside the APK itself. Keep only a stub redirect
   *  so the in-app "downloads" page still resolves if reached via relative URL. */
  const downloadsDest = join(webDir, 'downloads');
  mkdirSync(downloadsDest, { recursive: true });
  writeFileSync(join(downloadsDest, 'index.html'),
`<!doctype html><meta charset="utf-8"><title>Downloads</title>
<script>location.replace('https://app.saddamalkadi.com/downloads/');</script>
<a href="https://app.saddamalkadi.com/downloads/">فتح صفحة التنزيل</a>
`,
    { flag: 'w' }
  );
}
