import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const versionName = String(pkg.version || '').trim();

if (!/^\d+\.\d+\.\d+$/.test(versionName)) {
  throw new Error(`Unsupported package.json version: ${versionName}`);
}

const [major, minor] = versionName.split('.');
const appVersionShort = `${major}.${minor}`;
const versionCode = `${major}${minor.padStart(2, '0')}`;
const releaseLabel = `v${appVersionShort}`;

const replacements = [
  {
    file: 'index.html',
    pairs: [
      [/data-appver="[^"]+"/g, `data-appver="${appVersionShort}"`],
      [/<title>AI Workspace Studio v[^<]+<\/title>/g, `<title>AI Workspace Studio ${releaseLabel}</title>`],
      [/<script src="app\.js\?v=\d+"><\/script>/g, `<script src="app.js?v=${versionCode}"></script>`],
      [/const CURRENT_CACHE = "aistudio-cache-v\d+";/g, `const CURRENT_CACHE = "aistudio-cache-v${versionCode}";`],
      [/register\("\.\/sw\.js\?v=\d+"\)/g, `register("./sw.js?v=${versionCode}")`],
      [/>v\d+\.\d+</g, `>${releaseLabel}<`]
    ]
  },
  {
    file: 'sw.js',
    pairs: [
      [/const APP_VERSION = "\d+";/g, `const APP_VERSION = "${versionCode}";`]
    ]
  },
  {
    file: 'manifest.webmanifest',
    pairs: [
      [/"name": "AI Workspace Studio v[^"]+"/g, `"name": "AI Workspace Studio ${releaseLabel}"`]
    ]
  },
  {
    file: 'downloads/index.html',
    pairs: [
      [/>v\d+\.\d+ release</g, `>${releaseLabel} release<`],
      [/ai-workspace-studio-v\d+\.\d+-android-release\.apk/g, `ai-workspace-studio-v${appVersionShort}-android-release.apk`],
      [/ai-workspace-studio-v\d+\.\d+-android-release\.aab/g, `ai-workspace-studio-v${appVersionShort}-android-release.aab`]
    ]
  },
  {
    file: 'android/app/build.gradle',
    pairs: [
      [/versionCode \d+/g, `versionCode ${versionCode}`],
      [/versionName "[^"]+"/g, `versionName "${versionName}"`]
    ]
  },
  {
    file: 'app.js',
    pairs: [
      [/const WEB_RELEASE_LABEL = 'v\d+\.\d+';/g, `const WEB_RELEASE_LABEL = '${releaseLabel}';`]
    ]
  }
];

for (const entry of replacements) {
  const path = join(root, entry.file);
  let source = readFileSync(path, 'utf8');
  for (const [pattern, replacement] of entry.pairs) {
    source = source.replace(pattern, replacement);
  }
  writeFileSync(path, source);
}
