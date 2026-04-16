#!/usr/bin/env node
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, isAbsolute, join, normalize, relative, resolve } from 'node:path';

const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 8080);
const ROOT = resolve(process.env.ROOT_DIR || process.cwd());
const ENABLE_TTS_PROXY = String(process.env.ENABLE_TTS_PROXY || '').trim().toLowerCase() === 'true';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.webp': 'image/webp',
  '.apk': 'application/vnd.android.package-archive',
  '.aab': 'application/octet-stream'
};

const HIDDEN_SEGMENTS = new Set([
  '.git',
  '.github',
  '.cursor',
  'docs',
  'android',
  'node_modules',
  'scripts'
]);

const BLOCKED_FILES = new Set([
  'package.json',
  'package-lock.json',
  'server.mjs',
  'keys-worker.js',
  'convert-worker.js',
  'wrangler.jsonc',
  'wrangler.convert.jsonc',
  'replit.md',
  'README.md',
  '.env',
  '.env.local',
  '.env.production'
]);

function setCommonHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function splitTextForTts(text, maxLen = 180) {
  const sentences = [];
  const raw = String(text || '').trim();
  if (!raw) return [];
  const parts = raw.split(/(?<=[.!?؟،؛\n])\s+|(?<=[.!?؟،؛])/);
  let current = '';
  for (const part of parts) {
    if (!part.trim()) continue;
    if ((current + part).length > maxLen) {
      if (current.trim()) sentences.push(current.trim());
      if (part.length > maxLen) {
        const words = part.split(/\s+/);
        let chunk = '';
        for (const word of words) {
          if ((chunk + ' ' + word).trim().length > maxLen) {
            if (chunk.trim()) sentences.push(chunk.trim());
            chunk = word;
          } else {
            chunk = (chunk + ' ' + word).trim();
          }
        }
        if (chunk.trim()) sentences.push(chunk.trim());
      } else {
        current = part;
      }
    } else {
      current = (current + ' ' + part).trim();
    }
  }
  if (current.trim()) sentences.push(current.trim());
  return sentences.filter(Boolean);
}

async function fetchGoogleTts(text, lang = 'ar') {
  const url = `https://translate.googleapis.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${encodeURIComponent(lang)}&client=gtx&ttsspeed=0.9`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Referer': 'https://translate.google.com/',
      'Accept': 'audio/mpeg,audio/*;q=0.8,*/*;q=0.5'
    },
    signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) throw new Error(`Google TTS ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function handleTtsProxy(req, res) {
  let text = '';
  let lang = 'ar';
  try {
    if (req.method === 'POST') {
      const body = await readBody(req);
      const parsed = JSON.parse(body);
      text = String(parsed.text || '').trim();
      lang = String(parsed.lang || 'ar').trim().split('-')[0] || 'ar';
    } else {
      const urlObj = new URL(req.url || '/', 'http://localhost');
      text = String(urlObj.searchParams.get('text') || '').trim();
      lang = String(urlObj.searchParams.get('lang') || 'ar').trim().split('-')[0] || 'ar';
    }
  } catch (_) {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Invalid request body.' }));
    return;
  }

  if (!text) {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'text is required.' }));
    return;
  }

  try {
    const chunks = splitTextForTts(text, 180);
    const audioBuffers = [];
    for (const chunk of chunks) {
      audioBuffers.push(await fetchGoogleTts(chunk, lang));
    }
    const combined = Buffer.concat(audioBuffers);
    res.writeHead(200, {
      'Content-Type': 'audio/mpeg',
      'Content-Length': combined.length,
      'Cache-Control': 'no-store'
    });
    res.end(combined);
  } catch (error) {
    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: `TTS fetch failed: ${error.message}` }));
  }
}

function isPubliclyServable(requestedPath) {
  const normalized = String(requestedPath || '').replace(/^\/+/, '');
  if (!normalized) return true;
  const segments = normalized.split('/').filter(Boolean);
  if (segments.some((segment) => HIDDEN_SEGMENTS.has(segment) || segment.startsWith('.'))) return false;
  const leaf = segments[segments.length - 1] || '';
  if (BLOCKED_FILES.has(leaf)) return false;
  return true;
}

function resolvePath(urlPath) {
  let clean = '/';
  try {
    clean = decodeURIComponent((urlPath || '/').split('?')[0]);
  } catch (_) {
    return null;
  }

  const requested = clean === '/'
    ? '/index.html'
    : (clean.endsWith('/') ? `${clean}index.html` : clean);
  if (!isPubliclyServable(requested)) return null;

  const fullPath = resolve(normalize(join(ROOT, `.${requested}`)));
  const rel = relative(ROOT, fullPath);
  if ((rel && rel.startsWith('..')) || isAbsolute(rel)) return null;
  if (existsSync(fullPath)) return fullPath;

  if (!extname(requested)) {
    const fallback = resolve(normalize(join(ROOT, './index.html')));
    const fallbackRel = relative(ROOT, fallback);
    if ((!fallbackRel || !fallbackRel.startsWith('..')) && !isAbsolute(fallbackRel) && existsSync(fallback)) {
      return fallback;
    }
  }

  return null;
}

const server = createServer(async (req, res) => {
  setCommonHeaders(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const urlPath = (req.url || '/').split('?')[0];

  if (ENABLE_TTS_PROXY && urlPath === '/proxy/tts' && (req.method === 'POST' || req.method === 'GET')) {
    await handleTtsProxy(req, res);
    return;
  }

  if (urlPath === '/download' || urlPath === '/download/') {
    res.writeHead(302, { Location: '/downloads/' });
    res.end();
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Method Not Allowed');
    return;
  }

  const path = resolvePath(req.url || '/');
  if (!path || !existsSync(path)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
    return;
  }

  const stats = statSync(path);
  if (!stats.isFile()) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  const type = MIME[extname(path).toLowerCase()] || 'application/octet-stream';
  const cacheControl = /(?:^|\/)(index\.html|sw\.js|app\.js|manifest\.webmanifest)$/i.test(path)
    ? 'no-cache, no-store, must-revalidate'
    : /\/downloads\/.+\.(?:apk|aab)$/i.test(path)
      ? 'no-store'
      : 'public, max-age=300, must-revalidate';

  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': stats.size,
    'Cache-Control': cacheControl
  });

  if (req.method === 'HEAD') {
    res.end();
    return;
  }

  createReadStream(path).pipe(res);
});

server.on('error', (error) => {
  console.error(`[server] ${error.code || 'ERROR'}: ${error.message}`);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`AI Workspace Studio server running on http://${HOST}:${PORT}`);
  console.log(`Serving static files from: ${ROOT}`);
  if (!ENABLE_TTS_PROXY) {
    console.log('Local /proxy/tts disabled by default. Set ENABLE_TTS_PROXY=true only for controlled internal use.');
  }
});
