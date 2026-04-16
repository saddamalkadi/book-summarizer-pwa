#!/usr/bin/env node
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync, unlinkSync, readFileSync } from 'node:fs';
import { extname, isAbsolute, join, normalize, relative, resolve } from 'node:path';
import { execSync } from 'node:child_process';

const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 8080);
const ROOT = resolve(process.env.ROOT_DIR || process.cwd());

// ── Startup: clear git lock and push to GitHub if token available ──────────
try { unlinkSync(join(ROOT, '.git/index.lock')); } catch (_) {}

if (process.env.GITHUB_TOKEN) {
  try {
    const token = process.env.GITHUB_TOKEN;
    // Commit any uncommitted working-tree changes before pushing
    try {
      execSync(`git -C "${ROOT}" config user.email "deploy@aistudio.bot"`, { stdio: 'pipe' });
      execSync(`git -C "${ROOT}" config user.name "AI Studio Deploy"`, { stdio: 'pipe' });
      execSync(`git -C "${ROOT}" add -A`, { stdio: 'pipe' });
      execSync(`git -C "${ROOT}" commit -m "chore: auto-commit working-tree changes [deploy]" --allow-empty`, { stdio: 'pipe' });
      console.log('[startup] Git commit: SUCCESS');
    } catch (ce) {
      // nothing to commit or already clean
      const cmsg = ((ce.stdout||'')+(ce.stderr||'')).toString().substring(0, 100);
      console.log('[startup] Git commit skipped:', cmsg);
    }
    execSync(
      `git -C "${ROOT}" push "https://saddamalkadi:${token}@github.com/saddamalkadi/book-summarizer-pwa.git" main`,
      { timeout: 60000, stdio: 'pipe' }
    );
    console.log('[startup] GitHub push: SUCCESS');
  } catch (e) {
    const msg = ((e.stdout||'')+(e.stderr||'')).toString().replace(process.env.GITHUB_TOKEN,'[TOKEN]');
    console.log('[startup] GitHub push skipped:', msg.substring(0, 200));
  }
}
// ──────────────────────────────────────────────────────────────────────────

// ── Startup: Auto-fix Cloudflare Worker if misconfigured ──────────────────
async function autoFixWorker() {
  const CF_TOKEN = process.env.CF_API_TOKEN;
  const OR_KEY   = process.env.OPENROUTER_API_KEY;
  if (!CF_TOKEN || !OR_KEY) { console.log('[worker-fix] Skipped: missing env vars'); return; }

  const CF_ACCOUNT  = process.env.CF_ACCOUNT_ID || 'ea4e90ec8fbd70faefdddd2153064d6f';
  // Must match production worker serving api.saddamalkadi.com.
  const WORKER_NAME = process.env.CF_WORKER_NAME || 'sadam-key';
  const KV_NS       = process.env.CF_KV_NAMESPACE || '49d87e2d4989452fb3c680ad024ae5b7';
  // Never ship a hardcoded admin password fallback. If not configured,
  // admin password login is simply disabled (Google admin sign-in still works).
  const ADMIN_PASS  = (process.env.ADMIN_PASSWORD_REAL || '').trim();

  try {
    // 1) Check health (with retry for edge propagation lag)
    let health = await fetch('https://api.saddamalkadi.com/health', { signal: AbortSignal.timeout(8000) })
      .then(r => r.json()).catch(() => ({}));
    if (health.upstream_configured) {
      console.log('[worker-fix] Worker OK — upstream key confirmed, no action needed');
      return;
    }

    // 1b) Download deployed code — if it already has injection, just wait for propagation
    const liveCode = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/workers/scripts/${WORKER_NAME}`,
      { headers: { 'Authorization': `Bearer ${CF_TOKEN}` }, signal: AbortSignal.timeout(15000) }
    ).then(r => r.text()).catch(() => '');

    // CF compiles the source and strips comments, so check for the literal key string (not the marker comment)
    if (liveCode.includes(OR_KEY.substring(0, 12))) {
      console.log('[worker-fix] Code already has key — waiting 15s for edge propagation...');
      await new Promise(r => setTimeout(r, 15000));
      health = await fetch('https://api.saddamalkadi.com/health', { signal: AbortSignal.timeout(8000) })
        .then(r => r.json()).catch(() => ({}));
      if (health.upstream_configured) {
        console.log('[worker-fix] Worker OK after propagation wait');
        return;
      }
      console.log('[worker-fix] Still misconfigured after propagation wait — re-uploading fresh...');
    } else {
      console.log('[worker-fix] Worker misconfigured — auto-fixing...');
    }

    // 2) Store keys in KV
    const kvHeaders = { 'Authorization': `Bearer ${CF_TOKEN}`, 'Content-Type': 'text/plain' };
    await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/storage/kv/namespaces/${KV_NS}/values/_config%3Aopenrouter_api_key`,
      { method: 'PUT', headers: kvHeaders, body: OR_KEY }
    );
    if (ADMIN_PASS){
      await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/storage/kv/namespaces/${KV_NS}/values/_config%3Aadmin_password`,
        { method: 'PUT', headers: kvHeaders, body: ADMIN_PASS }
      );
      console.log('[worker-fix] KV values stored (including admin password)');
    } else {
      console.log('[worker-fix] KV values stored (admin password not configured — skipping)');
    }

    // 3) Get Worker source from local file (avoids multipart extraction issues from services endpoint)
    let code;
    try {
      const { readFileSync } = await import('node:fs');
      const localSource = join(ROOT, 'keys-worker.js');
      code = readFileSync(localSource, 'utf8');
      console.log('[worker-fix] Using local source keys-worker.js (' + code.length + ' bytes)');
    } catch (_) {
      // Fallback: download from services endpoint
      let raw = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/workers/services/${WORKER_NAME}/environments/production/content`,
        { headers: { 'Authorization': `Bearer ${CF_TOKEN}` }, signal: AbortSignal.timeout(20000) }
      ).then(r => r.text());
      const jStart = raw.indexOf('var __defProp');
      if (jStart > 0) raw = raw.substring(jStart);
      const jEnd = raw.lastIndexOf('\n--');
      if (jEnd > 0) raw = raw.substring(0, jEnd);
      code = raw;
      console.log('[worker-fix] Using services endpoint fallback (' + code.length + ' bytes)');
    }

    // 4) Patch Worker code
    let patched = false;

    // 4a) Inject platform API key directly into getServerKey function (most reliable approach)
    const INJECT_MARKER = '/*aistudio-key-injected*/';
    if (!code.includes(INJECT_MARKER)) {
      // Support both bundled format (env2) and local source format (env)
      const patchFn = (envVar) => {
        // Try exact match for bundled format: single-line return
        const OLD_BUNDLE = `function getServerKey(${envVar}) {\n  return (${envVar}.OPENROUTER_API_KEY || ${envVar}.OPEN_ROUTER_API_KEY || ${envVar}.OPENROUTER_KEY || "").trim();\n}`;
        const NEW_BUNDLE = `function getServerKey(${envVar}) {\n  ${INJECT_MARKER}\n  return (${envVar}.OPENROUTER_API_KEY || ${envVar}.OPEN_ROUTER_API_KEY || ${envVar}.OPENROUTER_KEY || ${JSON.stringify(OR_KEY)}).trim();\n}`;
        if (code.includes(OLD_BUNDLE)) {
          code = code.replace(OLD_BUNDLE, NEW_BUNDLE);
          return 'bundled';
        }
        // Try multi-line return (local source format)
        const fnStart = code.indexOf(`function getServerKey(${envVar})`);
        if (fnStart < 0) return null;
        const fnEnd = code.indexOf('\n}', fnStart) + 2;
        const oldFnBody = code.substring(fnStart, fnEnd);
        // Replace the empty string fallback with the real key
        const newFnBody = oldFnBody
          .replace(`    ''\n  ).trim();`, `    ${JSON.stringify(OR_KEY)}\n  ).trim(); // ${INJECT_MARKER}`)
          .replace(`    ""\n  ).trim();`, `    ${JSON.stringify(OR_KEY)}\n  ).trim(); // ${INJECT_MARKER}`);
        if (newFnBody !== oldFnBody) {
          code = code.substring(0, fnStart) + newFnBody + code.substring(fnEnd);
          return 'source';
        }
        // Last resort: replace the whole function body
        const newFnFull = `function getServerKey(${envVar}) {\n  ${INJECT_MARKER}\n  return (${envVar}.OPENROUTER_API_KEY || ${envVar}.OPEN_ROUTER_API_KEY || ${envVar}.OPENROUTER_KEY || ${JSON.stringify(OR_KEY)}).trim();\n}`;
        code = code.substring(0, fnStart) + newFnFull + code.substring(fnEnd);
        return 'forced';
      };

      const result = patchFn('env') || patchFn('env2');
      if (result) {
        patched = true;
        console.log(`[worker-fix] Patched: API key injected into getServerKey (${result})`);
      } else {
        console.log('[worker-fix] WARNING: Could not find getServerKey to patch');
      }
    } else {
      console.log('[worker-fix] getServerKey already has injection marker');
    }

    // 4b) KV helpers for admin password — only applicable to bundled format
    if (!code.includes('getAdminPasswordWithKv') && code.includes('__name(getServerKey')) {
      const KV_HELPERS = `
async function getKvConfig(env2,key){try{if(env2&&env2.USER_DATA&&typeof env2.USER_DATA.get==='function'){const v=await env2.USER_DATA.get('_config:'+key);if(v&&String(v).trim())return String(v).trim();}}catch(_){}return '';}
__name(getKvConfig,'getKvConfig');
async function getAdminPasswordWithKv(env2){const p=getAdminPassword(env2);if(p)return p;return await getKvConfig(env2,'admin_password');}
__name(getAdminPasswordWithKv,'getAdminPasswordWithKv');`;
      code = code.replace('__name(getServerKey, "getServerKey");', '__name(getServerKey, "getServerKey");' + KV_HELPERS);
      code = code.replace('const adminPassword = getAdminPassword(env2);', 'const adminPassword = await getAdminPasswordWithKv(env2);');
      patched = true;
      console.log('[worker-fix] Patched: Admin password KV fallback');
    }

    // 4b) Google TTS proxy — free Arabic TTS, no API key needed
    if (!code.includes('handleGoogleTtsProxy')) {
      const GTTS_HANDLER_MINIFIED = `
async function handleGoogleTtsProxy(request){
  try{
    const body=await request.json().catch(()=>({}));
    const text=String(body?.text||'').trim();
    const lang=String(body?.lang||'ar').split('-')[0]||'ar';
    if(!text)return new Response(JSON.stringify({error:'text required'}),{status:400,headers:{'Content-Type':'application/json'}});
    const chunks=[];
    const words=text.split(/\\s+/);
    let cur='';
    for(const w of words){
      if((cur+' '+w).trim().length>180){if(cur.trim())chunks.push(cur.trim());cur=w;}
      else cur=(cur+' '+w).trim();
    }
    if(cur.trim())chunks.push(cur.trim());
    const bufs=[];
    for(const c of chunks){
      const url='https://translate.googleapis.com/translate_tts?ie=UTF-8&q='+encodeURIComponent(c)+'&tl='+encodeURIComponent(lang)+'&client=gtx&ttsspeed=0.9';
      const r=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0','Referer':'https://translate.google.com/','Accept':'audio/mpeg,audio/*;q=0.8'}});
      if(!r.ok)throw new Error('Google TTS '+r.status);
      bufs.push(await r.arrayBuffer());
    }
    const total=bufs.reduce((s,b)=>s+b.byteLength,0);
    const out=new Uint8Array(total);let off=0;
    for(const b of bufs){out.set(new Uint8Array(b),off);off+=b.byteLength;}
    return new Response(out,{status:200,headers:{'Content-Type':'audio/mpeg','Cache-Control':'no-store','Content-Length':String(total)}});
  }catch(e){return new Response(JSON.stringify({error:String(e.message)}),{status:502,headers:{'Content-Type':'application/json'}});}
}`;

      // Try bundled format first (has __name calls)
      const bundledAnchor = '__name(handleVoiceSynthesis, "handleVoiceSynthesis");';
      if (code.includes(bundledAnchor)) {
        code = code.replace(bundledAnchor, bundledAnchor + GTTS_HANDLER_MINIFIED + '\n__name(handleGoogleTtsProxy,\'handleGoogleTtsProxy\');');
        code = code.replace(
          'if (url.pathname === "/voice/speak" && request.method === "POST")',
          'if (url.pathname === "/proxy/tts" && (request.method === "POST" || request.method === "GET")) {\n        return withCors(await handleGoogleTtsProxy(request), request);\n      }\n      if (url.pathname === "/voice/speak" && request.method === "POST")'
        );
        patched = true;
      } else {
        // Local source format (single quotes, no __name wrappers)
        const localAnchor = "async function handleVoiceSynthesis(request, env) {";
        if (code.includes(localAnchor)) {
          code = code.replace(localAnchor, GTTS_HANDLER_MINIFIED + '\n\n' + localAnchor);
          code = code.replace(
            "if (url.pathname === '/voice/speak' && request.method === 'POST')",
            "if (url.pathname === '/proxy/tts' && (request.method === 'POST' || request.method === 'GET')) {\n        return withCors(await handleGoogleTtsProxy(request), request);\n      }\n      if (url.pathname === '/voice/speak' && request.method === 'POST')"
          );
          patched = true;
        }
      }
      console.log('[worker-fix] Patched: Google TTS proxy (/proxy/tts)');
    }

    if (patched) {
      code = '// autofix-' + Date.now() + '\n' + code;
      console.log('[worker-fix] Patched code size:', code.length, '| has-injection:', code.includes('/*aistudio-key-injected*/'), '| has-key:', code.includes(OR_KEY.substring(0,12)));
    } else {
      console.log('[worker-fix] Code already fully patched — just redeploying');
      console.log('[worker-fix] Code size:', code.length, '| has-injection:', code.includes('/*aistudio-key-injected*/'));
    }

    // 5) Redeploy Worker — add OR key as plain_text binding (most reliable; no secrets API needed)
    const boundary = 'fix-' + Date.now();
    const metaJson = JSON.stringify({
      main_module: 'keys-worker.js',
      bindings: [
        {type:'ai',name:'AI'},
        {type:'kv_namespace',name:'USER_DATA',namespace_id:KV_NS},
        {type:'service',name:'CONVERT',service:'sadam-convert',environment:'production'},
        {type:'plain_text',name:'APP_ADMIN_EMAIL',text:'tntntt830@gmail.com'},
        {type:'plain_text',name:'APP_BRAND_NAME',text:'AI Workspace Studio'},
        {type:'plain_text',name:'APP_DEVELOPER_NAME',text:'صدام القاضي'},
        {type:'plain_text',name:'APP_UPGRADE_EMAIL',text:'tntntt830@gmail.com'},
        {type:'plain_text',name:'AUTH_REQUIRE_LOGIN',text:'true'},
        {type:'plain_text',name:'GOOGLE_CLIENT_ID_WEB',text:'320883717933-d8p8877if6u4udo9tfvhbq1en2ps486m.apps.googleusercontent.com'},
        {type:'plain_text',name:'OPENROUTER_REFERER',text:'https://app.saddamalkadi.com/'},
        {type:'plain_text',name:'OPENROUTER_TITLE',text:'AI Workspace Studio'},
        {type:'plain_text',name:'OPENROUTER_API_KEY',text:OR_KEY},
        ...(ADMIN_PASS ? [{type:'plain_text',name:'APP_ADMIN_PASSWORD',text:ADMIN_PASS}] : [])
      ],
      compatibility_date: '2024-09-23',
      compatibility_flags: ['nodejs_compat']
    });
    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="metadata"',
      'Content-Type: application/json',
      '',
      metaJson,
      `--${boundary}`,
      'Content-Disposition: form-data; name="keys-worker.js"; filename="keys-worker.js"',
      'Content-Type: application/javascript+module',
      '',
      code,
      `--${boundary}--`
    ].join('\r\n');

    // PUT to workers/scripts/{name} — updates classic slot and auto-creates a versioned entry
    const result = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/workers/scripts/${WORKER_NAME}`,
      { method: 'PUT', headers: { 'Authorization': `Bearer ${CF_TOKEN}`, 'Content-Type': `multipart/form-data; boundary=${boundary}` }, body, signal: AbortSignal.timeout(30000) }
    ).then(r => r.json());

    if (!result.success) {
      console.log('[worker-fix] ✗ Upload failed:', JSON.stringify(result.errors||[]).substring(0, 300));
      return;
    }

    // PUT /scripts/{name} may not return a UUID — query /versions?limit=1 to find the latest
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let versionId = [result?.result?.id, result?.result?.version_id].find(v => v && UUID_RE.test(v));

    if (!versionId) {
      // Fallback: GET latest version from the versions list
      await new Promise(r => setTimeout(r, 2000)); // wait for CF to index
      const versionsResp = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/workers/scripts/${WORKER_NAME}/versions?limit=1`,
        { headers: { 'Authorization': `Bearer ${CF_TOKEN}` }, signal: AbortSignal.timeout(15000) }
      ).then(r => r.json());
      // API may return result.items[], result[], or items[] depending on endpoint version
      const rawResult = versionsResp?.result;
      const vItems = (Array.isArray(rawResult) ? rawResult : rawResult?.items) || versionsResp?.items || [];
      console.log('[worker-fix] Versions API items count:', vItems.length, '| first id:', vItems[0]?.id?.substring(0,8) || 'none');
      versionId = vItems[0]?.id;
      if (versionId) console.log('[worker-fix] ✓ Version UUID from list:', versionId.substring(0,8));
    } else {
      console.log('[worker-fix] ✓ Version UUID from upload:', versionId.substring(0,8));
    }

    if (!versionId) {
      console.log('[worker-fix] No UUID available — skipping deploy (worker updated but not pinned)');
      return;
    }

    // Deploy THIS EXACT version (atomic — no race)
    const deployResult = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/workers/scripts/${WORKER_NAME}/deployments`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${CF_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy: 'percentage', versions: [{ version_id: versionId, percentage: 100 }] }),
        signal: AbortSignal.timeout(15000)
      }
    ).then(r => r.json());

    if (deployResult.success) {
      console.log('[worker-fix] ✓ Worker deployed version:', versionId.substring(0, 8));
    } else {
      console.log('[worker-fix] Deploy error:', JSON.stringify(deployResult.errors||[]).substring(0,200));
    }
  } catch (e) {
    console.log('[worker-fix] Error:', e.message);
  }
}
autoFixWorker();
// ──────────────────────────────────────────────────────────────────────────

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

const server = createServer(async (req, res) => {
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
});

let _portRetries = 0;
server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    _portRetries++;
    if (_portRetries > 3) {
      console.log(`[server] Port ${PORT} still in use after ${_portRetries} attempts — giving up`);
      process.exit(1);
    }
    console.log(`[server] Port ${PORT} in use — attempt ${_portRetries}/3, freeing port...`);
    try {
      execSync(`fuser -k ${PORT}/tcp 2>/dev/null || true`, { timeout: 4000, shell: '/bin/bash' });
    } catch (_) {}
    setTimeout(() => server.listen(PORT, HOST), 2000);
  } else {
    throw e;
  }
});

server.listen(PORT, HOST, () => {
  console.log(`AI Workspace Studio server running on http://${HOST}:${PORT}`);
  console.log(`Serving static files from: ${ROOT}`);
});
