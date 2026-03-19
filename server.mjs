#!/usr/bin/env node
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, isAbsolute, join, normalize, relative, resolve } from 'node:path';

const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 8080);
const ROOT = resolve(process.env.ROOT_DIR || process.cwd());

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
  '.webp': 'image/webp'
};

function setCommonHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function splitTextForTts(text, maxLen = 180) {
  const sentences = [];
  const raw = String(text || '').trim();
  if (!raw) return [];
  const parts = raw.split(/(?<=[.!?؟،؛\n])\s+|(?<=[\.\!\?؟،؛])/);
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
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://translate.google.com/',
      'Accept': 'audio/mpeg,audio/*;q=0.8,*/*;q=0.5'
    },
    signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) throw new Error(`Google TTS ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

function concatMp3Buffers(buffers) {
  return Buffer.concat(buffers);
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
      const urlObj = new URL(req.url, 'http://localhost');
      text = String(urlObj.searchParams.get('text') || '').trim();
      lang = String(urlObj.searchParams.get('lang') || 'ar').trim().split('-')[0] || 'ar';
    }
  } catch (_) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Invalid request body' }));
  }

  if (!text) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'text is required' }));
  }

  const chunks = splitTextForTts(text, 180);
  if (!chunks.length) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'text is empty after cleaning' }));
  }

  try {
    const audioBuffers = [];
    for (const chunk of chunks) {
      const buf = await fetchGoogleTts(chunk, lang);
      audioBuffers.push(buf);
    }
    const combined = concatMp3Buffers(audioBuffers);
    res.writeHead(200, {
      'Content-Type': 'audio/mpeg',
      'Content-Length': combined.length,
      'Cache-Control': 'no-store'
    });
    res.end(combined);
  } catch (err) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `TTS fetch failed: ${err.message}` }));
  }
}

function resolvePath(urlPath) {
  let clean = '/';
  try {
    clean = decodeURIComponent((urlPath || '/').split('?')[0]);
  } catch (_) {
    return null;
  }

  const requested = clean === '/' ? '/index.html' : clean;
  const fullPath = resolve(normalize(join(ROOT, `.${requested}`)));

  const rel = relative(ROOT, fullPath);
  if ((rel && rel.startsWith('..')) || isAbsolute(rel)) return null;
  if (existsSync(fullPath)) return fullPath;

  if (!extname(requested)) {
    const fallback = resolve(normalize(join(ROOT, './index.html')));
    const fallbackRel = relative(ROOT, fallback);
    if ((!fallbackRel || !fallbackRel.startsWith('..')) && !isAbsolute(fallbackRel) && existsSync(fallback)) return fallback;
  }

  return fullPath;
}

createServer(async (req, res) => {
  setCommonHeaders(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const urlPath = (req.url || '/').split('?')[0];

  if (urlPath === '/proxy/tts' && (req.method === 'POST' || req.method === 'GET')) {
    return handleTtsProxy(req, res);
  }

  if (urlPath === '/download' || urlPath === '/download/') {
    res.writeHead(302, { Location: '/downloads/' });
    return res.end();
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Method Not Allowed');
  }

  const path = resolvePath(req.url || '/');
  if (!path || !existsSync(path)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Not Found');
  }

  const stats = statSync(path);
  if (!stats.isFile()) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Forbidden');
  }

  const type = MIME[extname(path).toLowerCase()] || 'application/octet-stream';
  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': stats.size,
    'Cache-Control': 'no-cache, no-store, must-revalidate'
  });

  if (req.method === 'HEAD') return res.end();
  createReadStream(path).pipe(res);
}).listen(PORT, HOST, () => {
  console.log(`AI Workspace Studio server running on http://${HOST}:${PORT}`);
  console.log(`Serving static files from: ${ROOT}`);
});
