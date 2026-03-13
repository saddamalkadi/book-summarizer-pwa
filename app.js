/* AI Workspace Studio v6.2 - strategic platform skeleton (no build step) */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);

  // ---------------- Storage ----------------
  const KEYS = {
    settings: 'aistudio_settings_v3',
    projects: 'aistudio_projects_v3',
    curProject: 'aistudio_cur_project_v3',
    threads: (pid) => `aistudio_threads_${pid}_v3`,
    curThread: (pid) => `aistudio_cur_thread_${pid}_v3`,
    files: (pid) => `aistudio_files_${pid}_v3`,
    canvas: (pid) => `aistudio_canvas_${pid}_v3`,
    downloads: 'aistudio_downloads_v3',
    modeDeep: 'aistudio_mode_deep_v3',
    modeAgent: 'aistudio_mode_agent_v3',
    webToggle: 'aistudio_webtoggle_v3',
    modelCache: 'aistudio_or_models_cache_v3',
    favorites: 'aistudio_model_favs_v3',
    recent: 'aistudio_model_recent_v3',
    kbSettings: (pid) => `aistudio_kb_settings_${pid}_v3`,
    ragToggle: 'aistudio_rag_toggle_v3',
    deepSearch: 'aistudio_mode_deepsearch_v6',
    headerCollapsed: 'aistudio_header_collapsed_v5',
    chatToolbarCollapsed: 'aistudio_chat_toolbar_collapsed_v5',
    toolbarCollapsedMap: 'aistudio_toolbar_collapsed_map_v1',
    workspaceSectionMap: 'aistudio_workspace_sections_v1',
    projectBrief: (pid) => `aistudio_project_brief_${pid}_v1`,
    sidebarPinned: 'aistudio_sidebar_pinned_v1',
    focusMode: 'aistudio_focus_mode_v1'
  };

  const nowTs = () => Date.now();
  const makeId = (p='id') => `${p}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
  const clamp = (n, min, max) => Math.min(max, Math.max(min, Number.isFinite(n) ? n : min));

  function loadJSON(key, fallback){
    try{
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    }catch(_){ return fallback; }
  }
  function saveJSON(key, val){
    try{ localStorage.setItem(key, JSON.stringify(val)); }catch(_){}
  }

  const DEFAULT_SETTINGS = {
    provider: 'openrouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'openai/gpt-4o-mini',
    apiKey: '',
    geminiKey: '',
    systemPrompt: '',
    maxOut: 2000,
    webMode: 'openrouter_online',
    fileClip: 12000,
    streaming: true,
    rag: false,
    toolsEnabled: false,

    authMode: 'gateway',          // browser | gateway
    gatewayUrl: 'https://sadam-key.tntntt830.workers.dev',
    gatewayToken: '',             // optional extra protection
    cloudConvertEndpoint: 'https://sadam-convert.tntntt830.workers.dev/convert/pdf-to-docx',
    cloudConvertFallbackEndpoint: '',
    cloudRetryMax: 2,
    ocrCloudEndpoint: 'https://sadam-convert.tntntt830.workers.dev/ocr',
    ocrLang: 'ara+eng',

    orReferer: '',
    orTitle: 'AI Workspace Studio'
  };

// ---------------- KB (IndexedDB + RAG) ----------------
const KB_DB_NAME = 'aistudio_kb_db_v3';
const KB_DB_VER = 1;

const DEFAULT_KB = {
  embedModel: '',
  topK: 6,
  chunkSize: 900,
  overlap: 120,
  ragHint: 'استخدم المقاطع التالية من قاعدة المعرفة فقط. ضع الاقتباسات بصيغة [KB:filename#chunk]. إذا لم تجد معلومة قل: غير موجود في الملفات.'
};

function getKbSettings(pid){ return { ...DEFAULT_KB, ...(loadJSON(KEYS.kbSettings(pid), {}) || {}) }; }
function setKbSettings(pid, patch){
  const s = { ...getKbSettings(pid), ...(patch||{}) };
  saveJSON(KEYS.kbSettings(pid), s);
  return s;
}

function openKbDb(){
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(KB_DB_NAME, KB_DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('chunks')){
        const st = db.createObjectStore('chunks', { keyPath: 'id' });
        st.createIndex('by_project', 'projectId', { unique:false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function kbPutMany(items){
  const db = await openKbDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['chunks'], 'readwrite');
    const st = tx.objectStore('chunks');
    for (const it of items) st.put(it);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

async function kbGetAllByProject(projectId){
  const db = await openKbDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['chunks'], 'readonly');
    const idx = tx.objectStore('chunks').index('by_project');
    const req = idx.getAll(projectId);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function kbClearProject(projectId){
  const items = await kbGetAllByProject(projectId);
  if (!items.length) return 0;
  const db = await openKbDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['chunks'], 'readwrite');
    const st = tx.objectStore('chunks');
    for (const it of items) st.delete(it.id);
    tx.oncomplete = () => resolve(items.length);
    tx.onerror = () => reject(tx.error);
  });
}

async function kbCountProject(projectId){
  const items = await kbGetAllByProject(projectId);
  return items.length;
}

function chunkText(text, chunkSize, overlap){
  const t = String(text||'').replace(/\r/g,'');
  const size = clamp(Number(chunkSize||900), 300, 2000);
  const ov = clamp(Number(overlap||120), 0, Math.floor(size/2));
  const out = [];
  let i = 0;
  let idx = 1;
  while (i < t.length){
    const part = t.slice(i, i+size);
    const trimmed = part.trim();
    if (trimmed) out.push({ idx, text: trimmed });
    i += (size - ov);
    idx += 1;
    if (out.length > 4000) break;
  }
  return out;
}

function cosineSim(a, b){
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i=0;i<n;i++){
    const x = a[i], y = b[i];
    dot += x*y;
    na += x*x;
    nb += y*y;
  }
  const denom = (Math.sqrt(na) * Math.sqrt(nb)) || 1e-9;
  return dot / denom;
}

function getRagToggle(){ return (localStorage.getItem(KEYS.ragToggle) || 'false') === 'true'; }
function setRagToggle(v){ localStorage.setItem(KEYS.ragToggle, v ? 'true' : 'false'); }

async function ensureKbStats(){
  const pid = getCurProjectId();
  const count = await kbCountProject(pid).catch(()=>0);
  const el = $('kbStats'); if (el) el.textContent = `Chunks: ${count}`;
  const nav = $('navKbMeta'); if (nav) nav.textContent = String(count);
  return count;
}

async function callEmbeddings({ apiKey, baseUrl, model, inputs, signal, extraHeaders={} }){
  const url = baseUrl.replace(/\/+$/,'') + '/embeddings';
  const body = { model, input: inputs };
  const r = await fetch(url, {
    method:'POST',
    headers: { 'Content-Type':'application/json', ...extraHeaders, ...buildAuthHeaders(getSettings()) },
    body: JSON.stringify(body),
    signal
  });
  const t = await r.text();
  let j; try{ j = JSON.parse(t);}catch(_){ j = null; }
  if (!r.ok) throw new Error(j?.error?.message || t || `HTTP ${r.status}`);
  const data = j?.data || [];
  return data.map(d => d.embedding).filter(Boolean);
}

async function buildKbIndex(){
  const pid = getCurProjectId();
  const kb = getKbSettings(pid);
  const settings = getSettings();
  const embedModel = (kb.embedModel || '').trim();
  if (!embedModel) return toast('⚠️ ضع Embedding Model في صفحة المعرفة.');
  if (!settings.apiKey) return toast('⚠️ ضع API Key.');

  const files = loadFiles(pid).filter(f => (f.text||'').trim());
  if (!files.length) return toast('⚠️ لا توجد نصوص مستخرجة من الملفات.');

  showStatus('فهرسة KB…', true);
  await kbClearProject(pid).catch(()=>0);

  const chunks = [];
  for (const f of files){
    const chs = chunkText(f.text, kb.chunkSize, kb.overlap);
    for (const c of chs){
      chunks.push({ id: makeId('kb'), projectId: pid, fileName: f.name, chunkIdx: c.idx, text: c.text, embedding: null });
    }
  }

  const baseUrl = effectiveBaseUrl(settings) || (settings.provider === 'openrouter' ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1');
  const extraHeaders = buildProviderHeaders(settings);

  const abort = new AbortController();
  const batchSize = 64;
  for (let i=0;i<chunks.length;i+=batchSize){
    const batch = chunks.slice(i, i+batchSize);
    const inputs = batch.map(x => x.text);
    const embs = await callEmbeddings({ apiKey: settings.apiKey, baseUrl, model: embedModel, inputs, signal: abort.signal, extraHeaders });
    for (let k=0;k<batch.length;k++){
      const vec = embs[k];
      if (!vec) continue;
      const fa = new Float32Array(vec.length);
      for (let j=0;j<vec.length;j++) fa[j] = vec[j];
      batch[k].embedding = fa.buffer;
    }
    await kbPutMany(batch);
    showStatus(`فهرسة KB… ${Math.min(i+batchSize, chunks.length)}/${chunks.length}`, true);
  }

  showStatus('', false);
  toast('✅ تم فهرسة KB');
  await ensureKbStats();
}

async function searchKb(query){
  const pid = getCurProjectId();
  const kb = getKbSettings(pid);
  const settings = getSettings();
  const embedModel = (kb.embedModel || '').trim();
  const topK = clamp(Number(kb.topK||6), 1, 20);
  if (!embedModel) throw new Error('Embedding Model غير محدد');
  if (!hasAuthReady(settings)) throw new Error('المصادقة غير مكتملة (API Key أو Gateway URL)');

  const chunks = await kbGetAllByProject(pid);
  const withEmb = chunks.filter(c => c.embedding);
  if (!withEmb.length) return [];

  const baseUrl = effectiveBaseUrl(settings) || (settings.provider === 'openrouter' ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1');
  const extraHeaders = buildProviderHeaders(settings);

  const abort = new AbortController();
  const qEmb = (await callEmbeddings({ apiKey: settings.apiKey, baseUrl, model: embedModel, inputs:[query], signal: abort.signal, extraHeaders }))[0];
  const qv = new Float32Array(qEmb.length);
  for (let i=0;i<qEmb.length;i++) qv[i] = qEmb[i];

  const scored = withEmb.map(c => {
    const cv = new Float32Array(c.embedding);
    return { ...c, score: cosineSim(qv, cv) };
  }).sort((a,b)=> b.score - a.score).slice(0, topK);

  return scored;
}

function formatKbResults(results){
  if (!results.length) return 'لا توجد نتائج.';
  return results.map(r => {
    const cite = `[KB:${r.fileName}#${r.chunkIdx}]`;
    const snippet = r.text.length > 520 ? (r.text.slice(0,520) + '…') : r.text;
    return `${cite}\n${snippet}\n(score=${r.score.toFixed(3)})`;
  }).join('\n\n---\n\n');
}



async function renderKbUI(){
  const pid = getCurProjectId();
  const kb = getKbSettings(pid);
  if ($('embedModel')) $('embedModel').value = kb.embedModel || '';
  if ($('kbTopK')) $('kbTopK').value = String(kb.topK || 6);
  if ($('kbChunkSize')) $('kbChunkSize').value = String(kb.chunkSize || 900);
  if ($('kbOverlap')) $('kbOverlap').value = String(kb.overlap || 120);
  if ($('kbRagHint')) $('kbRagHint').value = kb.ragHint || DEFAULT_KB.ragHint;
  await ensureKbStats();
}

async function buildRagContextIfEnabled(userText){
  if (!getRagToggle()) return { ctx:'', results:[] };
  try{
    const results = await searchKb(userText);
    if (!results.length) return { ctx:'', results:[] };
    const kb = getKbSettings(getCurProjectId());
    const hint = (kb.ragHint || DEFAULT_KB.ragHint).trim();
    const excerpts = results.map(r => {
      const cite = `[KB:${r.fileName}#${r.chunkIdx}]`;
      return `${cite}\n${r.text}`;
    }).join('\n\n');
    return { ctx: `${hint}\n\nمقاطع من قاعدة المعرفة:\n\n${excerpts}`, results };
  }catch(_){
    return { ctx:'', results:[] };
  }
}




  function getSettings(){ return { ...DEFAULT_SETTINGS, ...(loadJSON(KEYS.settings, {}) || {}) }; }
  function setSettings(patch){
    const s = { ...getSettings(), ...(patch||{}) };
    saveJSON(KEYS.settings, s);
    return s;
  }

  function normalizeUrl(u){
    const s = String(u || '').trim();
    return s.replace(/\/+$/,'');
  }

  function normalizeEndpointUrl(u){
    const s = String(u || '').trim();
    if (!s) return '';
    // بعض المستخدمين قد يلصقون الرابط مسبوقًا بشرطة مائلة "/https://..."
    return normalizeUrl(s.replace(/^\/+((?:https?:)?\/\/)/i, '$1'));
  }

  function endpointOrigin(u){
    try{
      const n = normalizeEndpointUrl(u);
      if (!n) return '';
      return new URL(n).origin;
    }catch(_){ return ''; }
  }

  function resolveGatewayApiRoot(settings){
    const rawGateway = normalizeEndpointUrl(settings?.gatewayUrl || '');
    if (!rawGateway) return '';

    // بعض المستخدمين يضعون gatewayUrl منتهيًا بـ /v1؛ نعيده للجذر حتى لا يتكرر /v1 مرتين.
    const gatewayRoot = rawGateway.replace(/\/v1\/?$/i, '');

    // If user explicitly points to a known static keys worker
    // (often "keys.*.workers.dev") as gateway, prefer the API worker origin
    // inferred from cloud endpoints.
    //
    // NOTE:
    // Do NOT auto-switch just because gateway origin === app origin.
    // In many deployments this same Worker serves both static assets and /v1 API.
    // Switching in that case can silently route chat calls to another worker and
    // trigger auth errors (e.g. "No cookie auth credentials found").
    const gatewayOrigin = endpointOrigin(gatewayRoot);
    const cloudOrigins = [
      endpointOrigin(settings?.cloudConvertEndpoint || ''),
      endpointOrigin(settings?.cloudConvertFallbackEndpoint || ''),
      endpointOrigin(settings?.ocrCloudEndpoint || '')
    ].filter(Boolean);
    const inferredApiOrigin = cloudOrigins.find(o => o !== gatewayOrigin) || '';
    const looksLikeStaticWorker = /\/\/keys\./i.test(gatewayRoot);

    if (looksLikeStaticWorker && inferredApiOrigin){
      return inferredApiOrigin;
    }
    return gatewayRoot;
  }

  function buildEndpointCandidates(raw, paths=[]){
    const base = normalizeEndpointUrl(raw);
    if (!base) return [];
    const out = [base];
    for (const p of paths){
      const path = String(p || '').trim();
      if (!path) continue;
      out.push(`${base}/${path.replace(/^\/+/, '')}`);
    }
    return [...new Set(out)];
  }

  function arrayBufferToBase64(ab){
    const bytes = new Uint8Array(ab || new ArrayBuffer(0));
    let binary = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK){
      binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    return btoa(binary);
  }

  function decodeBase64Bytes(raw){
    const normalized = String(raw || '').trim().replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4);
    return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
  }

  function effectiveBaseUrl(settings){
    // Gateway uses a Worker URL and exposes /v1 compatible endpoints.
    if (settings.authMode === 'gateway' && settings.gatewayUrl){
      return normalizeUrl(resolveGatewayApiRoot(settings)) + '/v1';
    }
    return normalizeUrl(settings.baseUrl || '');
  }

  function buildAuthHeaders(settings){
    const h = {};
    if (settings.authMode === 'gateway'){
      if (settings.gatewayToken) h['X-Client-Token'] = settings.gatewayToken;
      // Cloudflare/OpenAI-compatible gateways may still require Bearer auth.
      if (settings.apiKey) h['Authorization'] = `Bearer ${settings.apiKey}`;
    } else {
      if (settings.apiKey) h['Authorization'] = `Bearer ${settings.apiKey}`;
    }
    return h;
  }

  function hasAuthReady(settings){
    if (settings.provider === 'gemini') return !!(settings.geminiKey || '').trim();
    if (settings.authMode === 'gateway') return !!(settings.gatewayUrl || '').trim();
    return !!(settings.apiKey || '').trim();
  }

  function getChatBaseUrlCandidates(settings){
    const defaults = (settings.provider === 'openrouter') ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1';
    const out = [effectiveBaseUrl(settings), settings.baseUrl, defaults]
      .map(normalizeEndpointUrl)
      .filter(Boolean)
      .map(normalizeUrl);
    return [...new Set(out)];
  }

  function resolveGatewayRequestMeta(input){
    try{
      const settings = getSettings();
      if (settings.authMode !== 'gateway') return null;
      const gatewayRoot = resolveGatewayApiRoot(settings);
      const gatewayOrigin = endpointOrigin(gatewayRoot);
      if (!gatewayOrigin) return null;

      const reqUrl = (typeof input === 'string') ? input : (input && input.url) || '';
      if (!reqUrl) return null;
      const reqOrigin = new URL(reqUrl, location.href).origin;
      if (reqOrigin !== gatewayOrigin) return null;
      return {
        gatewayOrigin,
        sameOriginWithApp: reqOrigin === location.origin
      };
    }catch(_){ return null; }
  }

  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const nextInit = init ? { ...init } : {};
    const gatewayMeta = resolveGatewayRequestMeta(input);
    if (gatewayMeta && !('credentials' in nextInit)){
      // Only attach cookies when the gateway is served from the same origin.
      // For cross-origin workers (e.g. GitHub Pages -> workers.dev), forcing
      // `include` can break CORS if the worker responds with wildcard origin.
      nextInit.credentials = gatewayMeta.sameOriginWithApp ? 'include' : 'omit';
    }
    return nativeFetch(input, nextInit);
  };



  // ---------------- UI helpers ----------------
  function showStatus(msg, isBusy=false){
    const el = $('statusBox');
    if (!el) return;
    if (!msg){
      el.style.display='none';
      el.textContent='';
      delete el.dataset.tone;
      return;
    }
    el.style.display='block';
    el.textContent = msg;
    el.dataset.busy = isBusy ? '1' : '0';
    const s = String(msg || '').toLowerCase();
    el.dataset.tone = isBusy
      ? 'busy'
      : (/❌|error|failed|خطأ|فشل/i.test(s) ? 'error'
      : (/✅|success|ready|ok|اكتمل|تم/i.test(s) ? 'success' : 'info'));
  }

  function toast(msg){
    showStatus(msg, false);
    clearTimeout(toast._t);
    toast._t = setTimeout(() => showStatus('', false), 1600);
  }

  async function copyToClipboard(text){
    try{
      if (navigator.clipboard?.writeText){
        await navigator.clipboard.writeText(String(text||''));
        return true;
      }
    }catch(_){}
    try{
      const ta = document.createElement('textarea');
      ta.value = String(text||'');
      ta.style.position='fixed';
      ta.style.top='-1000px'; ta.style.left='-1000px';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return !!ok;
    }catch(_){}
    return false;
  }

  function escapeHtml(s){
    return String(s ?? '').replace(/[&<>"']/g, (c) => (
      c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;'
    ));
  }
  function renderMarkdown(s){
    try{ if (window.marked) return window.marked.parse(String(s||'')); }catch(_){}
    return `<pre style="white-space:pre-wrap">${escapeHtml(s||'')}</pre>`;
  }

  function isOpenRouter(settings){
    const u = String(settings.baseUrl||'').toLowerCase();
    return settings.provider === 'openrouter' || u.includes('openrouter.ai');
  }

  function buildProviderHeaders(settings){
    const headers = {};
    // OpenRouter-specific headers are only needed for direct browser calls.
    // When using Gateway mode, these custom headers can trigger CORS preflight failures.
    if (isOpenRouter(settings) && settings.authMode !== 'gateway'){
      const ref = (settings.orReferer || location.origin || '').trim();
      const title = (settings.orTitle || 'AI Workspace Studio').trim();
      if (ref) headers['HTTP-Referer'] = ref;
      if (title) headers['X-Title'] = title;
    }
    return headers;
  }

  // ---------------- Modes ----------------
  const isDeep = () => (localStorage.getItem(KEYS.modeDeep) || 'false') === 'true';
  const isAgent = () => (localStorage.getItem(KEYS.modeAgent) || 'false') === 'true';
  const setDeep = (v) => localStorage.setItem(KEYS.modeDeep, v ? 'true' : 'false');
  const setAgent = (v) => localStorage.setItem(KEYS.modeAgent, v ? 'true' : 'false');
  
  const isDeepSearch = () => (localStorage.getItem(KEYS.deepSearch) || 'false') === 'true';
  const setDeepSearch = (v) => localStorage.setItem(KEYS.deepSearch, v ? 'true' : 'false');

const getWebToggle = () => (localStorage.getItem(KEYS.webToggle) || 'false') === 'true';
  const setWebToggle = (v) => localStorage.setItem(KEYS.webToggle, v ? 'true' : 'false');

  
const getHeaderCollapsed = () => (localStorage.getItem(KEYS.headerCollapsed) || 'false') === 'true';
const setHeaderCollapsed = (v) => localStorage.setItem(KEYS.headerCollapsed, v ? 'true' : 'false');
const getChatToolbarCollapsed = () => (localStorage.getItem(KEYS.chatToolbarCollapsed) || 'false') === 'true';
const setChatToolbarCollapsed = (v) => localStorage.setItem(KEYS.chatToolbarCollapsed, v ? 'true' : 'false');
const getSidebarPinned = () => (localStorage.getItem(KEYS.sidebarPinned) || 'false') === 'true';
const setSidebarPinned = (v) => localStorage.setItem(KEYS.sidebarPinned, v ? 'true' : 'false');
const getFocusMode = () => (localStorage.getItem(KEYS.focusMode) || 'false') === 'true';
const setFocusMode = (v) => localStorage.setItem(KEYS.focusMode, v ? 'true' : 'false');

const getToolbarCollapsedMap = () => loadJSON(KEYS.toolbarCollapsedMap, {});
const setToolbarCollapsedMap = (map) => saveJSON(KEYS.toolbarCollapsedMap, map || {});
const getWorkspaceSectionMap = () => loadJSON(KEYS.workspaceSectionMap, {});
const setWorkspaceSectionMap = (map) => saveJSON(KEYS.workspaceSectionMap, map || {});

const DEFAULT_PROJECT_BRIEF = {
  goal: '',
  audience: '',
  deliverable: '',
  constraints: '',
  style: 'executive'
};

function getProjectBrief(pid = getCurProjectId()){
  return { ...DEFAULT_PROJECT_BRIEF, ...(loadJSON(KEYS.projectBrief(pid), {}) || {}) };
}

function setProjectBrief(pid, patch){
  const next = { ...getProjectBrief(pid), ...(patch || {}) };
  saveJSON(KEYS.projectBrief(pid), next);
  return next;
}

function hasProjectBrief(brief = getProjectBrief()){
  return ['goal', 'audience', 'deliverable', 'constraints'].some((k) => String(brief?.[k] || '').trim());
}

function briefSnippet(text, limit = 44){
  const value = String(text || '').trim();
  if (!value) return '';
  return value.length > limit ? `${value.slice(0, limit)}…` : value;
}

function summarizeProjectBrief(brief = getProjectBrief()){
  const parts = [brief.goal, brief.deliverable, brief.audience].map((v) => briefSnippet(v)).filter(Boolean);
  return parts.join(' • ') || 'Define goal, audience, and deliverable';
}

function buildProjectBriefContext(pid = getCurProjectId()){
  const brief = getProjectBrief(pid);
  if (!hasProjectBrief(brief)) return '';
  const lines = ['Project brief:'];
  if (brief.goal.trim()) lines.push(`- Goal: ${brief.goal.trim()}`);
  if (brief.audience.trim()) lines.push(`- Audience: ${brief.audience.trim()}`);
  if (brief.deliverable.trim()) lines.push(`- Deliverable: ${brief.deliverable.trim()}`);
  if (brief.constraints.trim()) lines.push(`- Constraints: ${brief.constraints.trim()}`);
  if (brief.style.trim()) lines.push(`- Style: ${brief.style.trim()}`);
  lines.push('- Use this brief to shape structure, clarity, and output format before answering.');
  return lines.join('\n');
}

function isToolbarCollapsed(id){
  const map = getToolbarCollapsedMap();
  return !!map[id];
}

function setToolbarCollapsed(id, v){
  const map = getToolbarCollapsedMap();
  map[id] = !!v;
  setToolbarCollapsedMap(map);
}

function isWorkspaceSectionCollapsed(id){
  const map = getWorkspaceSectionMap();
  return map[id] ?? true;
}

function setWorkspaceSectionCollapsed(id, v){
  const map = getWorkspaceSectionMap();
  map[id] = !!v;
  setWorkspaceSectionMap(map);
}

function applyToolbarCollapses(){
  document.querySelectorAll('.toolbar.has-collapse[data-toolbar-id]').forEach((tb) => {
    const id = tb.dataset.toolbarId;
    const collapsed = isToolbarCollapsed(id);
    tb.classList.toggle('is-collapsed', collapsed);
    const btn = tb.querySelector('.toolbar-collapse-btn');
    if (btn){
      btn.textContent = collapsed ? '▴' : '▾';
      btn.title = collapsed ? 'إظهار الشريط' : 'طي الشريط';
      btn.setAttribute('aria-label', btn.title);
    }
  });
}

function setupCollapsibleToolbars(){
  document.querySelectorAll('.page > .toolbar:not(#chatMiniToolbar):not(.mainToolbar)').forEach((tb, idx) => {
    if (tb.dataset.collapseReady === 'true') return;
    if (!tb.dataset.toolbarId) tb.dataset.toolbarId = tb.id || `toolbar-${idx+1}`;
    tb.classList.add('has-collapse');
    let btn = tb.querySelector('.toolbar-collapse-btn');
    if (!btn){
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn ghost sm with-label toolbar-collapse-btn';
      btn.innerHTML = '<span class="icon">▾</span><span class="label">طي</span>';
      tb.appendChild(btn);
    }
    btn.addEventListener('click', () => {
      const id = tb.dataset.toolbarId;
      setToolbarCollapsed(id, !isToolbarCollapsed(id));
      applyToolbarCollapses();
    });
    tb.dataset.collapseReady = 'true';
  });
  applyToolbarCollapses();
}

function applyUiCollapse(){
  const collapsed = getHeaderCollapsed();
  document.body.classList.toggle('headerCollapsed', collapsed);
  document.body.classList.toggle('chatToolbarCollapsed', getChatToolbarCollapsed());
  const collapseBtn = $('headerCollapseBtn');
  if (collapseBtn){
    collapseBtn.textContent = collapsed ? '▴' : '▾';
    collapseBtn.title = collapsed ? 'إظهار الشريط العلوي' : 'طي الشريط العلوي';
  }
  const tag = document.getElementById('chatMiniModelTag');
  if (tag){ tag.textContent = (getSettings().model || '—'); }
}

function applyShellLayout(){
  const desktop = window.innerWidth > 980;
  const floatingSidebar = desktop && !getSidebarPinned();
  document.body.classList.toggle('sidebarFloating', floatingSidebar);
  document.body.classList.toggle('focusMode', getFocusMode());

  if (!desktop || !floatingSidebar){
    $('side')?.classList.remove('show');
    $('backdrop')?.classList.remove('show');
  }

  const pinBtn = $('pinSideBtn');
  if (pinBtn){
    const pinned = getSidebarPinned();
    pinBtn.classList.toggle('dark', pinned);
    pinBtn.title = pinned ? 'Undock sidebar' : 'Dock sidebar';
    pinBtn.setAttribute('aria-label', pinBtn.title);
    pinBtn.innerHTML = pinned
      ? '<span class="icon">⟷</span><span class="label">Docked</span>'
      : '<span class="icon">⟷</span><span class="label">Float</span>';
  }

  const focusBtn = $('focusModeBtn');
  if (focusBtn){
    const focus = getFocusMode();
    focusBtn.classList.toggle('dark', focus);
    focusBtn.title = focus ? 'Exit focus mode' : 'Enter focus mode';
    focusBtn.setAttribute('aria-label', focusBtn.title);
    focusBtn.innerHTML = focus
      ? '<span class="icon">▣</span><span class="label">Focus</span>'
      : '<span class="icon">▢</span><span class="label">Focus</span>';
  }
}


function refreshDeepSearchBtn(){
    const b = $('deepSearchToggleBtn');
    if (!b) return;
    b.classList.toggle('dark', isDeepSearch());
    b.textContent = isDeepSearch() ? '🔬 Deep ✓' : '🔬 Deep';
  }

  function refreshModeButtons(){
    $('modeDeepBtn')?.classList.toggle('dark', isDeep());
    $('modeAgentBtn')?.classList.toggle('dark', isAgent());
    $('webToggleBtn')?.classList.toggle('dark', getWebToggle());
    $('streamToggle') && ($('streamToggle').checked = !!getSettings().streaming);
    $('ragToggle') && ($('ragToggle').checked = getRagToggle());
    refreshDeepSearchBtn();
    refreshStrategicWorkspace().catch(()=>{});
  }

  function disableModes(){
    setDeep(false);
    setAgent(false);
    setWebToggle(false);
    refreshModeButtons();
    toast('⛔ تم إيقاف الأوضاع');
  }

  function getDisplayModelName(model){
    const value = String(model || '').trim();
    if (!value) return 'Not set';
    return value.length > 34 ? `${value.slice(0, 34)}…` : value;
  }

  function getAuthStateLabel(settings){
    if (settings.provider === 'gemini') return (settings.geminiKey || '').trim() ? 'Gemini key ready' : 'Gemini key needed';
    if (settings.authMode === 'gateway') return (settings.gatewayUrl || '').trim() ? 'Gateway routing' : 'Gateway missing';
    return (settings.apiKey || '').trim() ? 'Browser key ready' : 'API key needed';
  }

  function buildQuickPromptTemplate(kind){
    const templates = {
      strategy_brief: 'أنشئ brief استراتيجي احترافي لهذا الطلب. المطلوب: 1) الهدف 2) الوضع الحالي 3) الفرص 4) المخاطر 5) خطة التنفيذ 6) المخرجات النهائية.',
      deep_research: 'نفّذ بحثًا عميقًا منظمًا. ابدأ بخطة بحث، ثم أسئلة التحقيق، ثم النتائج، ثم الاستنتاجات، ثم التوصيات العملية.',
      system_audit: 'قم بمراجعة تشغيلية للنظام أو التطبيق الحالي. أريد: المشاكل، الأولويات، المخاطر، الإصلاحات السريعة، وخطة تحسين احترافية.',
      build_product: 'ساعدني في بناء منتج احترافي من هذه الفكرة. أريد: positioning، architecture، user flows، roadmap، ومواصفات الإصدار الأول.',
      exec_summary: 'اكتب Executive Summary واضحًا وموجزًا مع النقاط الحاسمة والقرار المقترح.',
      action_board: 'حوّل هذا السياق إلى Action Board: المهمة، المالك، الأولوية، الموعد، الحالة، والخطوة التالية.',
      kb_orchestrator: 'استخدم الملفات وقاعدة المعرفة لبناء إجابة موثقة باقتباسات واضحة، ثم لخص الفجوات والمعلومات غير المؤكدة.',
      launch_plan: 'أنشئ Launch Plan متكاملة: readiness، assets، risks، timeline، owners، success metrics.',
      pm_review: 'قم بدور Product Strategist وراجع الفكرة أو التطبيق: القيمة، UX، gaps، differentiation، ثم توصية تنفيذية.'
    };
    return templates[kind] || '';
  }

  function applyQuickPrompt(kind, shouldSend=false){
    const input = $('chatInput');
    if (!input) return;
    const prompt = buildQuickPromptTemplate(kind);
    if (!prompt) return;
    input.value = prompt;
    resizeComposerInput(input);
    syncComposerMeta();
    input.focus();
    if (shouldSend) sendMessage();
    else toast('✅ تم تجهيز prompt احترافي');
  }

  function resizeComposerInput(input = $('chatInput')){
    if (!input || input.tagName !== 'TEXTAREA') return;
    input.style.height = 'auto';
    input.style.height = `${Math.min(220, Math.max(58, input.scrollHeight))}px`;
  }

  function ensureStrategicChrome(){
    const sideCard = document.querySelector('.sidecard');
    if (sideCard && !sideCard.classList.contains('strategic-sidecard')){
      sideCard.classList.add('strategic-sidecard');
      sideCard.innerHTML = `
        <div class="sidecard-title">Strategic Control</div>
        <div class="sidecard-grid">
          <div class="sidecard-metric"><span>Project</span><strong id="sideProjectMeta">—</strong></div>
          <div class="sidecard-metric"><span>Model</span><strong id="sideModelMeta">—</strong></div>
          <div class="sidecard-metric"><span>Context</span><strong id="sideContextMeta">—</strong></div>
          <div class="sidecard-metric"><span>Modes</span><strong id="sideModeMeta">—</strong></div>
        </div>
        <div class="sidecard-note" id="sideHealthNote">Configure your workspace once, then operate chat, files, retrieval, and workflows from one command center.</div>`;
    }

    const brand = document.querySelector('.brand');
    if (brand && !$('pinSideBtn')){
      const pin = document.createElement('button');
      pin.type = 'button';
      pin.id = 'pinSideBtn';
      pin.className = 'btn ghost sm with-label brand-dock-btn';
      brand.insertBefore(pin, $('closeSideBtn'));
    }

    const topTitle = $('topTitle');
    const topSubtitle = $('topSubtitle');
    const left = document.querySelector('.topbar .left');
    if (left && topTitle && topSubtitle && !$('topRuntimeBadge')){
      const stack = document.createElement('div');
      stack.className = 'title-stack';
      const row = document.createElement('div');
      row.className = 'top-runtime-row';
      const badge = document.createElement('span');
      badge.className = 'runtime-badge';
      badge.id = 'topRuntimeBadge';
      badge.textContent = 'Workspace online';
      left.appendChild(stack);
      stack.appendChild(topTitle);
      row.appendChild(topSubtitle);
      row.appendChild(badge);
      stack.appendChild(row);
    }

    const topActions = document.querySelector('.topbar .topbar-actions');
    if (topActions && !$('focusModeBtn')){
      const focus = document.createElement('button');
      focus.type = 'button';
      focus.id = 'focusModeBtn';
      focus.className = 'btn ghost sm with-label';
      topActions.insertBefore(focus, $('headerCollapseBtn'));
    }

    const input = $('chatInput');
    if (input && input.tagName !== 'TEXTAREA'){
      const area = document.createElement('textarea');
      area.id = input.id;
      area.dir = input.getAttribute('dir') || 'auto';
      area.rows = 2;
      area.placeholder = 'اكتب طلبك بوضوح: الهدف، النتيجة المطلوبة، وأي مرفقات أو قيود. Shift+Enter لسطر جديد.';
      area.value = input.value || '';
      input.replaceWith(area);
      resizeComposerInput(area);
    }

    const chatbar = document.querySelector('#page-chat .chatbar');
    if (chatbar && !$('composerContextMeta')){
      chatbar.insertAdjacentHTML('afterend', `
        <div class="composer-meta">
          <span id="composerHint">Enter للإرسال • Shift+Enter لسطر جديد • المرفقات تندمج تلقائيًا مع السياق.</span>
          <span class="composer-status" id="composerContextMeta">Workspace context —</span>
        </div>`);
    }

    const settingsPage = $('page-settings');
    const settingsToolbar = settingsPage?.querySelector('.toolbar');
    if (settingsPage && settingsToolbar && !$('settingsHealthBtn')){
      settingsToolbar.insertAdjacentHTML('afterend', `
        <div class="settings-overview">
          <div class="settings-overview-card">
            <h3>Strategic configuration layer</h3>
            <p>Turn the app from a simple chat surface into an operational AI workspace: stable gateway routing, stronger defaults, smarter model selection, and clearer runtime diagnostics.</p>
            <div class="settings-actions">
              <button class="btn dark sm with-label" id="settingsHealthBtn" type="button"><span class="icon">◎</span><span class="label">Health Check</span></button>
              <button class="btn ghost sm with-label" id="settingsDefaultsBtn" type="button"><span class="icon">⚙️</span><span class="label">Pro Defaults</span></button>
              <button class="btn ghost sm with-label" id="settingsRecommendModelBtn" type="button"><span class="icon">✨</span><span class="label">Recommend Model</span></button>
            </div>
            <div class="settings-health-output" id="settingsHealthOutput">Run a health check to validate Gateway, model route, and operational readiness.</div>
          </div>
          <div class="settings-overview-card">
            <h3>Runtime readiness</h3>
            <div class="settings-kpis">
              <div class="settings-kpi"><span>Connection</span><strong id="settingsReadyState">—</strong></div>
              <div class="settings-kpi"><span>Gateway</span><strong id="settingsGatewayState">—</strong></div>
              <div class="settings-kpi"><span>Model</span><strong id="settingsModelState">—</strong></div>
              <div class="settings-kpi"><span>Security</span><strong id="settingsSecurityState">—</strong></div>
            </div>
          </div>
        </div>`);
    }

    const mainToolbar = document.querySelector('#page-chat .mainToolbar');
    if (mainToolbar && !$('workspaceBriefSection')){
      mainToolbar.insertAdjacentHTML('beforeend', `
        <section class="tool-group" id="workspaceBriefSection" data-section-id="brief" data-section-title="Project Brief">
          <span class="tool-group-title">Project brief</span>
          <div class="toolbar-strip workspace-brief-grid">
            <div class="brief-field">
              <label class="hint" for="briefGoal">Goal</label>
              <input id="briefGoal" type="text" placeholder="What outcome do you want from this project?" />
            </div>
            <div class="brief-field">
              <label class="hint" for="briefAudience">Audience</label>
              <input id="briefAudience" type="text" placeholder="Who is the response for?" />
            </div>
            <div class="brief-field">
              <label class="hint" for="briefDeliverable">Deliverable</label>
              <input id="briefDeliverable" type="text" placeholder="Brief, plan, report, launch doc, table..." />
            </div>
            <div class="brief-field">
              <label class="hint" for="briefStyle">Style</label>
              <select id="briefStyle">
                <option value="executive">Executive</option>
                <option value="operator">Operator</option>
                <option value="deep_dive">Deep Dive</option>
                <option value="board_ready">Board Ready</option>
              </select>
            </div>
            <div class="brief-field brief-field-wide">
              <label class="hint" for="briefConstraints">Constraints</label>
              <textarea id="briefConstraints" rows="3" placeholder="Any must-have constraints, format rules, deadlines, or scope limits"></textarea>
            </div>
            <div class="workspace-brief-actions">
              <button class="btn dark sm with-label" id="briefApplyBtn" type="button"><span class="icon">✦</span><span class="label">Use in chat</span></button>
              <button class="btn ghost sm with-label" id="briefClearBtn" type="button"><span class="icon">↺</span><span class="label">Clear</span></button>
            </div>
          </div>
        </section>`);
    }

    ensureWorkspaceSections();
    renderProjectBrief();
    applyShellLayout();
  }

  function ensureWorkspaceSections(){
    const mainToolbar = document.querySelector('#page-chat .mainToolbar');
    if (!mainToolbar) return;
    const ids = ['routing', 'modes', 'quick', 'brief'];

    [...mainToolbar.querySelectorAll('.tool-group')].forEach((group, idx) => {
      if (!group.dataset.sectionId) group.dataset.sectionId = ids[idx] || `section-${idx+1}`;
      if (!group.dataset.sectionTitle){
        group.dataset.sectionTitle = group.querySelector('.tool-group-title')?.textContent?.trim() || `Section ${idx+1}`;
      }
      if (group.dataset.accordionReady === 'true') return;

      const title = group.dataset.sectionTitle;
      const titleEl = group.querySelector('.tool-group-title');
      if (titleEl) titleEl.remove();

      const body = document.createElement('div');
      body.className = 'workspace-section-body';
      while (group.firstChild) body.appendChild(group.firstChild);

      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'workspace-section-toggle';
      toggle.innerHTML = `
        <span class="workspace-section-head">
          <span class="workspace-section-title">${escapeHtml(title)}</span>
          <span class="workspace-section-summary" id="workspaceSectionSummary-${group.dataset.sectionId}"></span>
        </span>
        <span class="workspace-section-chevron">▾</span>`;

      group.appendChild(toggle);
      group.appendChild(body);
      group.dataset.accordionReady = 'true';
    });

    applyWorkspaceSectionCollapses();
    syncWorkspaceSectionSummaries();
  }

  function applyWorkspaceSectionCollapses(){
    document.querySelectorAll('#page-chat .tool-group[data-section-id]').forEach((group) => {
      const collapsed = isWorkspaceSectionCollapsed(group.dataset.sectionId);
      group.classList.toggle('is-collapsed', collapsed);
      const chevron = group.querySelector('.workspace-section-chevron');
      if (chevron) chevron.textContent = collapsed ? '▸' : '▾';
    });
  }

  function renderProjectBrief(){
    const brief = getProjectBrief();
    if ($('briefGoal')) $('briefGoal').value = brief.goal || '';
    if ($('briefAudience')) $('briefAudience').value = brief.audience || '';
    if ($('briefDeliverable')) $('briefDeliverable').value = brief.deliverable || '';
    if ($('briefConstraints')) $('briefConstraints').value = brief.constraints || '';
    if ($('briefStyle')) $('briefStyle').value = brief.style || 'executive';
    syncWorkspaceSectionSummaries();
  }

  function saveProjectBriefFromUI(){
    const pid = getCurProjectId();
    const brief = setProjectBrief(pid, {
      goal: $('briefGoal')?.value?.trim() || '',
      audience: $('briefAudience')?.value?.trim() || '',
      deliverable: $('briefDeliverable')?.value?.trim() || '',
      constraints: $('briefConstraints')?.value?.trim() || '',
      style: $('briefStyle')?.value || 'executive'
    });
    syncWorkspaceSectionSummaries();
    clearTimeout(saveProjectBriefFromUI._t);
    saveProjectBriefFromUI._t = setTimeout(() => refreshStrategicWorkspace().catch(()=>{}), 120);
    return brief;
  }

  function applyProjectBriefToComposer(){
    const brief = saveProjectBriefFromUI();
    const input = $('chatInput');
    if (!input) return;
    const lines = [
      'Use this project brief as the operating context for the next response:',
      brief.goal ? `Goal: ${brief.goal}` : '',
      brief.audience ? `Audience: ${brief.audience}` : '',
      brief.deliverable ? `Deliverable: ${brief.deliverable}` : '',
      brief.constraints ? `Constraints: ${brief.constraints}` : '',
      brief.style ? `Style: ${brief.style}` : '',
      '',
      'Now produce the best first draft or plan for this brief.'
    ].filter(Boolean);
    input.value = lines.join('\n');
    resizeComposerInput(input);
    syncComposerMeta();
    input.focus();
    toast('✅ Brief loaded into chat');
  }

  function clearProjectBrief(){
    setProjectBrief(getCurProjectId(), DEFAULT_PROJECT_BRIEF);
    renderProjectBrief();
    refreshStrategicWorkspace().catch(()=>{});
    toast('✅ Brief cleared');
  }

  function syncWorkspaceSectionSummaries(){
    const settings = getSettings();
    const pid = getCurProjectId();
    const files = loadFiles(pid).length;
    const messages = (getCurThread().messages || []).length;
    const brief = getProjectBrief(pid);

    if ($('workspaceSectionSummary-routing')){
      $('workspaceSectionSummary-routing').textContent = `${settings.provider} • ${getDisplayModelName(settings.model)} • ${settings.authMode}`;
    }
    if ($('workspaceSectionSummary-modes')){
      $('workspaceSectionSummary-modes').textContent = [
        settings.streaming ? 'Streaming' : 'One-shot',
        getRagToggle() ? 'RAG' : 'No RAG',
        settings.toolsEnabled ? 'Tools' : 'Tools off',
        getWebToggle() ? 'Web' : 'Local'
      ].join(' • ');
    }
    if ($('workspaceSectionSummary-quick')){
      $('workspaceSectionSummary-quick').textContent = `${messages} messages • ${files} files`;
    }
    if ($('workspaceSectionSummary-brief')){
      $('workspaceSectionSummary-brief').textContent = summarizeProjectBrief(brief);
    }
  }

  function syncComposerMeta(){
    const meta = $('composerContextMeta');
    if (!meta) return;
    const pid = getCurProjectId();
    const files = loadFiles(pid);
    const thread = getCurThread();
    meta.textContent = `Files ${files.length} • Messages ${(thread.messages || []).length} • Attachments ${pendingChatAttachments.length}`;
    resizeComposerInput();
  }

  function syncStrategicLayoutState(hasMessages){
    $('workspaceDeck')?.classList.toggle('workspace-deck-collapsed', !!hasMessages);
    $('strategicStrip')?.classList.toggle('strategic-strip-collapsed', !!hasMessages);
  }

  async function refreshStrategicWorkspace(){
    const settings = getSettings();
    const pid = getCurProjectId();
    const project = getCurProject();
    const thread = getCurThread();
    const messageCount = (thread.messages || []).length;
    const brief = getProjectBrief(pid);
    const files = loadFiles(pid);
    const chunks = await kbCountProject(pid).catch(() => 0);
    const downloads = loadDownloads().length;
    const modeLabels = [
      settings.streaming ? 'Streaming' : 'One-shot',
      getRagToggle() ? 'RAG' : 'No RAG',
      settings.toolsEnabled ? 'Tools' : 'No Tools',
      getWebToggle() ? 'Web' : 'Local'
    ];
    const readiness = getAuthStateLabel(settings);
    syncStrategicLayoutState(messageCount > 0);
    const runtimeBadge = $('topRuntimeBadge');
    if (runtimeBadge) runtimeBadge.textContent = `${settings.provider.toUpperCase()} • ${readiness}`;
    if ($('curProjectName')) $('curProjectName').textContent = project.name;
    if ($('workspaceHeadline')){
      $('workspaceHeadline').textContent = messageCount
        ? `Continue ${project.name} with full operational context.`
        : 'Build, research, and ship from one strategic AI console.';
    }
    if ($('workspaceSummary')){
      const briefPart = hasProjectBrief(brief) ? ` • Brief ${summarizeProjectBrief(brief)}` : '';
      $('workspaceSummary').textContent = `Provider ${settings.provider} on ${getDisplayModelName(settings.model)} • ${files.length} project files • ${chunks} KB chunks • ${downloads} archived outputs${briefPart}.`;
    }
    if ($('signalProvider')) $('signalProvider').textContent = settings.provider.toUpperCase();
    if ($('signalProviderNote')) $('signalProviderNote').textContent = `${readiness} • ${settings.authMode === 'gateway' ? 'Gateway secured flow' : 'Browser-direct flow'}`;
    if ($('signalModel')) $('signalModel').textContent = getDisplayModelName(settings.model);
    if ($('signalModelNote')) $('signalModelNote').textContent = `Max output ${settings.maxOut || 2000} • Web mode ${settings.webMode || 'off'}`;
    if ($('signalContext')) $('signalContext').textContent = `${files.length} files • ${chunks} KB`;
    if ($('signalContextNote')) $('signalContextNote').textContent = `${messageCount} messages • file clip ${settings.fileClip || 12000}`;
    if ($('signalModes')) $('signalModes').textContent = modeLabels.join(' • ');
    if ($('signalModesNote')) $('signalModesNote').textContent = `${isDeep() ? 'Deep' : 'Standard'} • ${isAgent() ? 'Agent' : 'Assistant'} • ${isDeepSearch() ? 'Deep Search' : 'Chat Mode'}`;

    if ($('sideProjectMeta')) $('sideProjectMeta').textContent = `${project.name} (${messageCount})`;
    if ($('sideModelMeta')) $('sideModelMeta').textContent = getDisplayModelName(settings.model);
    if ($('sideContextMeta')) $('sideContextMeta').textContent = `${files.length}F • ${chunks}KB • ${downloads}DL`;
    if ($('sideModeMeta')) $('sideModeMeta').textContent = `${settings.provider} • ${settings.authMode}`;
    if ($('sideHealthNote')) $('sideHealthNote').textContent = hasProjectBrief(brief)
      ? `${readiness}. Brief active: ${summarizeProjectBrief(brief)}.`
      : `${readiness}. Workspace ready for chat, knowledge retrieval, files, and workflows.`;

    if ($('settingsReadyState')) $('settingsReadyState').textContent = readiness;
    if ($('settingsGatewayState')) $('settingsGatewayState').textContent = settings.authMode === 'gateway' ? (settings.gatewayUrl || 'Gateway missing') : 'Direct browser mode';
    if ($('settingsModelState')) $('settingsModelState').textContent = getDisplayModelName(settings.model);
    if ($('settingsSecurityState')) $('settingsSecurityState').textContent = settings.authMode === 'gateway' ? 'Secrets kept server-side' : ((settings.apiKey || '').trim() ? 'Browser key in use' : 'No browser key');

    syncComposerMeta();
    syncWorkspaceSectionSummaries();
  }

  async function runStrategicHealthCheck(){
    const output = $('settingsHealthOutput');
    const settings = saveSettingsFromUI();
    if (output) output.textContent = 'Checking workspace health...';
    try{
      if (settings.provider === 'gemini'){
        const ready = !!(settings.geminiKey || '').trim();
        const msg = ready
          ? 'Gemini mode looks ready. API key is present.'
          : 'Gemini mode is selected but the Gemini API key is missing.';
        if (output) output.textContent = msg;
        toast(ready ? '✅ Gemini ready' : '⚠️ Gemini key missing');
        await refreshStrategicWorkspace();
        return;
      }

      if (settings.authMode === 'gateway'){
        const root = normalizeUrl(resolveGatewayApiRoot(settings));
        if (!root) throw new Error('Gateway URL is missing.');
        const headers = {};
        if (settings.gatewayToken) headers['X-Client-Token'] = settings.gatewayToken;
        const healthResp = await fetch(`${root}/health`, { headers });
        const healthText = await healthResp.text();
        let healthJson; try{ healthJson = JSON.parse(healthText); }catch(_){ healthJson = null; }
        const modelsResp = await fetch(`${root}/v1/models`, { headers: { Accept:'application/json', ...headers } });
        const modelsText = await modelsResp.text();
        let modelsJson; try{ modelsJson = JSON.parse(modelsText); }catch(_){ modelsJson = null; }
        const modelsCount = Array.isArray(modelsJson?.data) ? modelsJson.data.length : 0;
        const lines = [
          `Health status: ${healthResp.status}`,
          `Gateway ready: ${healthJson?.ready === true ? 'yes' : 'no'}`,
          `Configured: ${healthJson?.configured === true ? 'yes' : 'no'}`,
          `Models route: ${modelsResp.status}`,
          `Catalog entries: ${modelsCount}`
        ];
        if (output) output.textContent = lines.join('\n');
        toast((healthResp.ok && modelsResp.ok) ? '✅ Gateway healthy' : '⚠️ Health check completed with warnings');
      } else {
        const ready = !!(settings.apiKey || '').trim();
        if (output) output.textContent = ready
          ? 'Browser-direct mode is active. API key is present.'
          : 'Browser-direct mode is active, but the API key is missing.';
        toast(ready ? '✅ Direct mode ready' : '⚠️ API key missing');
      }
    }catch(e){
      const msg = String(e?.message || e || 'Health check failed');
      if (output) output.textContent = msg;
      toast(`❌ ${msg}`);
    }
    await refreshStrategicWorkspace();
  }

  function applyStrategicDefaults(){
    const current = getSettings();
    const nextGateway = normalizeEndpointUrl(current.gatewayUrl || DEFAULT_SETTINGS.gatewayUrl);
    const next = setSettings({
      provider: 'openrouter',
      authMode: 'gateway',
      gatewayUrl: nextGateway,
      baseUrl: `${normalizeUrl(resolveGatewayApiRoot({ ...current, gatewayUrl: nextGateway })) || normalizeUrl(nextGateway)}/v1`,
      streaming: true,
      toolsEnabled: true,
      webMode: 'openrouter_online',
      maxOut: 2400,
      fileClip: 18000,
      orTitle: 'AI Workspace Studio',
      systemPrompt: current.systemPrompt || 'أنت مساعد استراتيجي احترافي. ابدأ دائمًا بفهم الهدف، ثم قدّم مخرجات تنفيذية واضحة، مختصرة، وقابلة للعمل.'
    });
    renderSettings();
    if ($('provider')) $('provider').value = next.provider;
    if ($('authMode')) $('authMode').value = next.authMode;
    if ($('gatewayUrl')) $('gatewayUrl').value = next.gatewayUrl || '';
    if ($('model')) $('model').value = next.model || 'openai/gpt-4o-mini';
    saveSettingsFromUI();
    refreshStrategicWorkspace().catch(()=>{});
    toast('✅ تم تطبيق الملف الاحترافي');
  }

  function recommendStrategicModel(){
    const settings = getSettings();
    let recommended = settings.model || '';
    if (settings.provider === 'gemini') recommended = 'gemini-2.5-flash';
    else if (settings.provider === 'openai') recommended = 'gpt-4o-mini';
    else {
      const cached = loadJSON(KEYS.modelCache, {})?.models || [];
      const preferred = [
        'openai/gpt-4o-mini',
        'openai/gpt-4o',
        'openai/gpt-4.1',
        'anthropic/claude-sonnet-4',
        'google/gemini-2.0-flash-001'
      ];
      recommended = preferred.find((id) => cached.some((m) => m.id === id)) || 'openai/gpt-4o-mini';
    }
    if ($('model')) $('model').value = recommended;
    saveSettingsFromUI();
    refreshStrategicWorkspace().catch(()=>{});
    toast(`✅ Recommended model: ${recommended}`);
  }

  // ---------------- Projects / Threads ----------------
  function loadProjects(){
    const arr = loadJSON(KEYS.projects, null);
    if (Array.isArray(arr) && arr.length) return arr;
    const def = [{ id:'default', name:'افتراضي', createdAt: nowTs(), updatedAt: nowTs() }];
    saveJSON(KEYS.projects, def);
    return def;
  }
  function saveProjects(arr){ saveJSON(KEYS.projects, arr); }
  function getCurProjectId(){ return localStorage.getItem(KEYS.curProject) || 'default'; }
  function setCurProjectId(pid){ localStorage.setItem(KEYS.curProject, pid); }
  function getCurProject(){
    const pid = getCurProjectId();
    return loadProjects().find(p => p.id === pid) || loadProjects()[0];
  }

  function loadThreads(pid){
    const arr = loadJSON(KEYS.threads(pid), null);
    if (Array.isArray(arr) && arr.length) return arr;
    const t = [{ id: makeId('thr'), title:'محادثة', createdAt: nowTs(), updatedAt: nowTs(), summary:'', messages: [] }];
    saveJSON(KEYS.threads(pid), t);
    localStorage.setItem(KEYS.curThread(pid), t[0].id);
    return t;
  }
  function saveThreads(pid, arr){ saveJSON(KEYS.threads(pid), arr); }
  function getCurThreadId(pid){ return localStorage.getItem(KEYS.curThread(pid)) || loadThreads(pid)[0]?.id; }
  function setCurThreadId(pid, tid){ localStorage.setItem(KEYS.curThread(pid), tid); }
  function getCurThread(){
    const pid = getCurProjectId();
    const tid = getCurThreadId(pid);
    return loadThreads(pid).find(t => t.id === tid) || loadThreads(pid)[0];
  }
  
  function clearCurrentChat(){
    const pid = getCurProjectId();
    const tid = getCurThreadId(pid);
    const threads = loadThreads(pid);
    const idx = threads.findIndex(t => t.id === tid);
    const th = threads[idx] || threads[0];
    if (!th) return;
    if (!confirm('مسح الدردشة الحالية؟')) return;
    th.messages = [];
    th.summary = '';
    th.updatedAt = nowTs();
    threads[idx] = th;
    saveThreads(pid, threads);
    renderChat();
    toast('✅ تم مسح الدردشة');
  }

function newThread(){
    const pid = getCurProjectId();
    const arr = loadThreads(pid);
    const t = { id: makeId('thr'), title:'محادثة جديدة', createdAt: nowTs(), updatedAt: nowTs(), summary:'', messages: [] };
    arr.unshift(t);
    saveThreads(pid, arr);
    setCurThreadId(pid, t.id);
    renderChat();
    refreshNavMeta();
    toast('✅ تم إنشاء محادثة جديدة');
  }

  // ---------------- Prompt Library ----------------
  const PROMPTS = {
    report_ar: { vars:['topic','audience'], body:`اكتب تقريرًا احترافيًا عن: {{topic}}
الجمهور المستهدف: {{audience}}

الهيكل المطلوب:
1) ملخص تنفيذي
2) خلفية
3) تحليل
4) توصيات عملية
5) مخاطر ونقاط تحقق
6) خطة 30/60/90 يوم (إن كان مناسبًا)

أنشئ أيضًا ملفًا للتنزيل:
\`\`\`file name="report.md" mime="text/markdown"
(ضع التقرير هنا)
\`\`\`` },
    email_ar: { vars:['subject','goal','tone'], body:`اكتب بريدًا رسميًا بعنوان: {{subject}}
الهدف: {{goal}}
النبرة: {{tone}}

ضع البريد جاهز للإرسال مع تحية وخاتمة وتوقيع.` },
    policy_ar: { vars:['policy_name','scope'], body:`اكتب سياسة/إجراء بعنوان: {{policy_name}}
النطاق: {{scope}}

المطلوب:
- الهدف
- التعاريف
- السياسة
- الإجراءات خطوة بخطوة
- الأدوار والمسؤوليات
- الاستثناءات
- النماذج/المرفقات

وأخرج ملف:
\`\`\`file name="policy.md" mime="text/markdown"
...
\`\`\`` },
    analysis_ar: { vars:['problem','constraints'], body:`حلّل المشكلة التالية بعمق: {{problem}}
القيود: {{constraints}}

المطلوب: أسباب محتملة + خيارات حل (3) + تقييم مخاطر + توصية نهائية + خطوات تنفيذ.` },
    json_schema: { vars:['task'], body:`أنشئ JSON منظم للمهمة التالية: {{task}}
أعد JSON فقط بدون شرح.` }
  };

  function applyPromptTemplate(key){
    if (!key || !PROMPTS[key]) return;
    let text = PROMPTS[key].body;
    for (const v of (PROMPTS[key].vars||[])){
      const val = prompt(`أدخل ${v}:`, '') ?? '';
      text = text.replaceAll(`{{${v}}}`, val);
    }
    $('chatInput').value = text;
    resizeComposerInput();
    syncComposerMeta();
    $('chatInput').focus();
    toast('✅ تم إدراج القالب');
    $('promptSelect').value = '';
  }

  const AGENT_TASK_TEMPLATES = {
    site_login_project: `أنت تعمل الآن في "وضع الوكيل لتنفيذ المهام".

المهمة: الدخول إلى موقع وتنفيذ إجراء (إنشاء مشروع أو حساب).

بيانات الإدخال:
- رابط الموقع: 
- نوع العملية: (تسجيل دخول / إنشاء حساب / إنشاء مشروع)
- البريد أو اسم المستخدم: 
- كلمة المرور أو طريقة المصادقة: 
- تفاصيل المشروع أو الحساب المطلوب إنشاؤه: 

المطلوب منك:
1) اعرض "الخطة" بخطوات قصيرة وواضحة.
2) اعرض "قائمة البيانات الناقصة" قبل التنفيذ.
3) بعد اكتمال البيانات، اعرض "تنفيذ محاكى" خطوة بخطوة (Step Log).
4) في النهاية أعرض "النتيجة" + "تحقق" + "إجراءات التراجع" إن لزم.
5) لا تعرض أي بيانات حساسة كاملة؛ أخفِها جزئيًا.
`,
    excel_process: `أنت تعمل الآن في "وضع الوكيل لمعالجة ملف Excel".

المهمة: تحليل/تنظيف/تحويل ملف Excel وإجراء العمليات المطلوبة.

المدخلات:
- وصف الملف (أو ارفع الملف/ألصق عينة CSV):
- الأوراق المطلوبة:
- الأعمدة المهمة:
- العمليات المطلوبة (مثال: حذف التكرار، توحيد التاريخ، Pivot، إجماليات، معادلات):

المطلوب منك:
1) فهم بنية البيانات وذكر الافتراضات.
2) اقتراح خطة معالجة آمنة قبل التطبيق.
3) إنتاج جدول "قبل/بعد" للتغييرات.
4) تقديم صيغ Excel اللازمة (إن وجدت).
5) إنشاء مخرجات نهائية: ملخص تنفيذي + قائمة تحقق جودة البيانات.
`,
    web_task_plan: `وضع الوكيل: تنفيذ مهمة ويب متعددة الخطوات.

المطلوب:
- حلل الطلب.
- أنشئ خطة تنفيذ من 3-7 خطوات.
- لكل خطوة: الهدف، المدخلات، المخرجات، معيار النجاح.
- نفّذ بشكل محاكى (Execution Log).
- أعطِ نتيجة نهائية + مخاطر + الخطوة التالية.
`
  };

  function applyAgentTaskTemplate(){
    const sel = $('agentTaskTemplate');
    if (!sel) return;
    const key = sel.value;
    if (!key || !AGENT_TASK_TEMPLATES[key]) return;
    setAgent(true);
    refreshModeButtons();
    const cur = String($('chatInput')?.value || '').trim();
    $('chatInput').value = (cur ? (cur + '\n\n') : '') + AGENT_TASK_TEMPLATES[key];
    resizeComposerInput();
    syncComposerMeta();
    $('chatInput').focus();
    toast('🤖 تم إدراج مهمة الوكيل');
    sel.value = '';
  }

  function scrollChat(direction){
    const log = $('chatLog');
    if (!log) return;
    const top = direction === 'top';
    log.scrollTo({ top: top ? 0 : log.scrollHeight, behavior: 'smooth' });
  }

  // ---------------- Files ----------------
  function loadFiles(pid){ return loadJSON(KEYS.files(pid), []) || []; }
  function saveFiles(pid, arr){ saveJSON(KEYS.files(pid), arr); }

  async function fileToDataUrl(file){
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ''));
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }
  
async function extractTextFromPdf(arrayBuffer){
  if (!window.pdfjsLib) throw new Error('pdf.js غير متاح');
  const pdfjsLib = window.pdfjsLib;
  try{ pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"; }catch(_){}
  const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let all = '';
  for (let p=1; p<=doc.numPages; p++){
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const strings = content.items.map(it => it.str || '').filter(Boolean);
    const txt = strings.join(' ').replace(/\s+/g,' ').trim();
    if (txt) all += `\n\n[Page ${p}]\n` + txt;
  }
  return all.trim();
}

async function extractTextFromDocx(arrayBuffer){
  if (!window.mammoth) throw new Error('mammoth غير متاح');
  const res = await window.mammoth.extractRawText({ arrayBuffer });
  return String(res?.value || '').trim();
}

async function fileToText(file){
    const name = (file?.name || '').toLowerCase();
    if (name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.csv') || name.endsWith('.json') || name.endsWith('.xml') || name.endsWith('.html') || name.endsWith('.htm')){
      return await file.text();
    }
    if (name.endsWith('.pdf')){
      const ab = await file.arrayBuffer();
      return await extractTextFromPdf(ab);
    }
    if (name.endsWith('.docx')){
      const ab = await file.arrayBuffer();
      return await extractTextFromDocx(ab);
    }
    return '';
  }

  function toDocxBlob(out){
    if (out instanceof Blob) return out;
    if (out instanceof ArrayBuffer) return new Blob([out], { type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    if (ArrayBuffer.isView(out)) return new Blob([out.buffer], { type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    throw new Error('صيغة DOCX غير مدعومة');
  }

  function getOcrLang(){
    const s = getSettings();
    return (s.ocrLang || 'ara+eng').trim() || 'ara+eng';
  }

  function isOcrEnabled(){
    const toggle = $('ocrToggle') || $('useOcrToggle');
    return toggle ? !!toggle.checked : true;
  }

  async function preprocessImageDataUrl(dataUrl){
    return new Promise((resolve) => {
      try{
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext('2d', { willReadFrequently:true });
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const d = imageData.data;
          for (let i=0; i<d.length; i+=4){
            const gray = Math.round(0.299*d[i] + 0.587*d[i+1] + 0.114*d[i+2]);
            const bw = gray > 165 ? 255 : 0;
            d[i] = d[i+1] = d[i+2] = bw;
          }
          ctx.putImageData(imageData, 0, 0);
          resolve(canvas.toDataURL('image/png', 0.95));
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
      }catch(_){ resolve(dataUrl); }
    });
  }

  async function runTesseract(dataUrl, lang, psm){
    const opts = { logger: () => {}, preserve_interword_spaces: '1' };
    if (typeof psm !== 'undefined') opts.tessedit_pageseg_mode = psm;
    const res = await window.Tesseract.recognize(dataUrl, lang, opts);
    return String(res?.data?.text || '').trim();
  }

  async function cloudOcrDataUrl(dataUrl, meta={}){
    const settings = getSettings();
    const endpoints = buildEndpointCandidates(settings.ocrCloudEndpoint, ['ocr', 'ocr/image', 'api/ocr']).filter(Boolean);
    if (!endpoints.length) return '';
    const b64 = String(dataUrl || '').split(',')[1] || '';
    if (!b64) return '';
    for (const endpoint of endpoints){
      try{
        const r = await fetch(endpoint, {
          method:'POST',
          headers: { 'Content-Type':'application/json', ...buildAuthHeaders(settings) },
          body: JSON.stringify({ imageBase64: b64, fileName: meta.fileName || 'page.png', page: meta.page || 1, lang: getOcrLang() })
        });
        if (!r.ok) continue;
        const ct = (r.headers.get('content-type') || '').toLowerCase();
        if (ct.includes('application/json')){
          const j = await r.json();
          const txt = String(j?.text || j?.result || j?.ocrText || '').trim();
          if (txt) return txt;
          continue;
        }
        const txt = String(await r.text()).trim();
        if (txt) return txt;
      }catch(_){ }
    }
    return '';
  }

  function scoreArabicQuality(txt){
    const s = String(txt || '').trim();
    if (!s) return 0;
    const letters = (s.match(/[\p{L}]/gu) || []).length;
    if (!letters) return 0;
    const arabic = (s.match(/[\u0600-\u06FF]/g) || []).length;
    const weird = (s.match(/[\\|_~`^]/g) || []).length;
    return (arabic / letters) - (weird / Math.max(letters, 1));
  }

  function needsArabicOcrFallback(text, lang){
    const s = String(text || '').trim();
    if (!s) return true;
    const usedLang = String(lang || '').toLowerCase();
    if (!usedLang.includes('ara')) return false;
    const letters = (s.match(/[\p{L}]/gu) || []).length;
    if (letters < 20) return true;
    return scoreArabicQuality(s) < 0.2;
  }

  async function ocrDataUrl(dataUrl, lang, meta={}){
    if (!dataUrl) return '';
    if (!isOcrEnabled()) return '';
    if (!window.Tesseract) throw new Error('Tesseract غير متاح');
    const usedLang = (lang || getOcrLang() || 'ara+eng').trim();
    const enhanced = await preprocessImageDataUrl(dataUrl);
    const psmList = [window.Tesseract?.PSM?.AUTO, window.Tesseract?.PSM?.SINGLE_BLOCK, window.Tesseract?.PSM?.SPARSE_TEXT].filter(v => typeof v !== 'undefined');
    const candidates = [];
    for (const src of [dataUrl, enhanced]){
      for (const psm of psmList){
        try{
          const t = await runTesseract(src, usedLang, psm);
          if (t) candidates.push(t);
        }catch(_){ }
      }
    }
    if (!candidates.length){
      try{
        const fallback = await runTesseract(enhanced, 'eng', window.Tesseract?.PSM?.AUTO);
        if (fallback) candidates.push(fallback);
      }catch(_){ }
    }
    let best = candidates.sort((a,b)=>b.length-a.length)[0] || '';
    if (best.length < 80){
      try{
        const cloud = await cloudOcrDataUrl(enhanced, meta);
        if (cloud && cloud.length > best.length) best = cloud;
      }catch(_){ }
    }
    return best.trim();
  }

  async function renderPdfPageToDataUrl(page, scale=2){
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently:true });
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas.toDataURL('image/png', 0.92);
  }

  function buildLinesFromTextItems(items){
    const list = (items || []).map((it) => {
      const text = String(it?.str || '').trim();
      if (!text) return null;
      const t = Array.isArray(it?.transform) ? it.transform : [1,0,0,1,0,0];
      return {
        text,
        x: Number(t[4] || 0),
        y: Number(t[5] || 0),
        w: Number(it?.width || 0),
        h: Math.abs(Number(it?.height || t[3] || 0))
      };
    }).filter(Boolean).sort((a,b) => Math.abs(a.y - b.y) < 0.1 ? a.x - b.x : b.y - a.y);

    const lines = [];
    for (const it of list){
      const current = lines[lines.length - 1];
      const threshold = Math.max(3, Math.min(8, it.h * 0.65 || 4));
      if (current && Math.abs(current.y - it.y) <= threshold){
        current.items.push(it);
        current.y = (current.y + it.y) / 2;
      } else {
        lines.push({ y: it.y, items: [it] });
      }
    }

    return lines.map((line) => {
      const parts = line.items.sort((a,b)=>a.x-b.x);
      const joined = parts.map((p, idx) => {
        if (!idx) return p.text;
        const prev = parts[idx - 1];
        const gap = p.x - (prev.x + prev.w);
        return `${gap > 4 ? ' ' : ''}${p.text}`;
      }).join('').replace(/\s+/g, ' ').trim();
      return {
        y: line.y,
        text: joined,
        xMin: Math.min(...parts.map(p=>p.x)),
        xMax: Math.max(...parts.map(p=>p.x+p.w))
      };
    }).filter((l) => l.text);
  }

  async function extractPdfStrategic(file, opts={}){
    const { onProgress } = opts;
    if (!window.pdfjsLib) throw new Error('pdf.js غير متاح');
    const pdfjsLib = window.pdfjsLib;
    try{ pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"; }catch(_){ }

    const ab = await file.arrayBuffer();
    const doc = await pdfjsLib.getDocument({ data: ab }).promise;
    const pages = [];

    for (let p=1; p<=doc.numPages; p++){
      const page = await doc.getPage(p);
      const viewport = page.getViewport({ scale: 1.4 });
      const content = await page.getTextContent();
      const lines = buildLinesFromTextItems(content.items || []);
      let pageText = lines.map((l) => l.text).join('\n').trim();
      let method = 'native';

      if (isOcrEnabled() && (!pageText || pageText.length < 30 || needsArabicOcrFallback(pageText, getOcrLang()))){
        const dataUrl = await renderPdfPageToDataUrl(page, 2);
        const ocrText = await ocrDataUrl(dataUrl, undefined, { fileName: file?.name || 'document.pdf', page: p });
        if (ocrText && (!pageText || ocrText.length > pageText.length || scoreArabicQuality(ocrText) >= scoreArabicQuality(pageText))){
          pageText = ocrText.trim();
          method = 'ocr';
        }
      }

      pages.push({
        page: p,
        width: viewport.width,
        height: viewport.height,
        method,
        lines: method === 'native' ? lines : [{ y: viewport.height - 20, text: pageText, xMin: 0, xMax: viewport.width }],
        text: pageText
      });

      if (typeof onProgress === 'function') onProgress(p, doc.numPages, { method, chars: pageText.length });
    }

    const text = pages.map((pg) => `[Page ${pg.page}]\n${pg.text}`.trim()).join('\n\n').trim();
    return { pages, text, totalPages: doc.numPages, extractedPages: pages.filter(p => !!p.text).length };
  }

  async function extractTextFromPdfSmart(file, opts={}){
    const result = await extractPdfStrategic(file, opts);
    return result.text;
  }

  async function convertPdfToEditableDocx(file, opts={}){
    const structured = await extractPdfStrategic(file, opts);
    const title = String(file?.name || 'document').replace(/\.pdf$/i, '');

    const sections = structured.pages.map((pg) => {
      let prevY = null;
      const body = (pg.lines || []).map((ln) => {
        const topGap = prevY === null ? 0 : Math.max(0, (prevY - ln.y) * 0.45);
        prevY = ln.y;
        return `<div class="line" style="margin-top:${topGap.toFixed(2)}px">${escapeHtml(ln.text)}</div>`;
      }).join('');
      return `<section class="page"><div class="marker">Page ${pg.page} • ${pg.method.toUpperCase()}</div>${body}</section>`;
    }).join('');

    const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8" /><title>${escapeHtml(title)}</title><style>body{font-family:Arial,sans-serif;line-height:1.55} .page{margin:0 0 18px 0;padding:0 0 12px 0;border-bottom:1px dashed #cfd5e6;} .marker{font-size:12px;color:#6a738f;margin-bottom:8px} .line{white-space:pre-wrap}</style></head><body>${sections}</body></html>`;

    const fn = window.htmlToDocx || window.HTMLtoDOCX || null;
    if (!fn) throw new Error('محول DOCX غير متاح');
    const blob = toDocxBlob(await Promise.resolve(fn(html)));
    return { text: structured.text, structured, blob, fileName: `${title || 'converted'}.docx` };
  }

  async function convertPdfToDocxByWorker(file){
    const settings = getSettings();
    const endpoints = [
      ...buildEndpointCandidates(settings.cloudConvertEndpoint, ['convert/pdf-to-docx', 'pdf-to-docx', 'api/convert/pdf-to-docx']),
      ...buildEndpointCandidates(settings.cloudConvertFallbackEndpoint, ['convert/pdf-to-docx', 'pdf-to-docx', 'api/convert/pdf-to-docx'])
    ].filter(Boolean);
    if (!endpoints.length) throw new Error('Cloud PDF→Word endpoint غير مضبوط في الإعدادات');
    const tries = clamp(Number(settings.cloudRetryMax || 2), 1, 5);
    const ab = await file.arrayBuffer();
    const base64 = arrayBufferToBase64(ab);
    let lastErr = null;
    for (const endpoint of endpoints){
      for (let t=1; t<=tries; t++){
        try{
          const r = await fetch(endpoint, {
            method:'POST',
            headers: { 'Content-Type':'application/json', ...buildAuthHeaders(settings) },
            body: JSON.stringify({ fileName: file.name, mimeType: file.type || 'application/pdf', fileBase64: base64 })
          });
          if (!r.ok){
            const msg = await r.text().catch(()=> '');
            throw new Error(msg || `HTTP ${r.status}`);
          }
          const ct = (r.headers.get('content-type') || '').toLowerCase();
          if (ct.includes('application/json')){
            const j = await r.json();
            const b64 = String(j?.docxBase64 || j?.fileBase64 || j?.data?.docxBase64 || '').trim();
            if (!b64) throw new Error(String(j?.error || j?.message || 'استجابة تحويل سحابي غير صالحة'));
            const bin = decodeBase64Bytes(b64);
            return { blob: new Blob([bin], { type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), fileName: String(j?.fileName || file.name.replace(/\.pdf$/i, '.docx')) };
          }
          const blob = await r.blob();
          return { blob: toDocxBlob(blob), fileName: file.name.replace(/\.pdf$/i, '.docx') };
        }catch(err){
          lastErr = err;
          await new Promise(res => setTimeout(res, 500 * t));
        }
      }
    }
    throw new Error(`فشل التحويل السحابي بعد عدة محاولات: ${lastErr?.message || 'unknown'}`);
  }

  async function cloudPolishText(rawText){
    const source = String(rawText || '').trim();
    if (!source) return '';
    const settings = getSettings();
    if (!hasAuthReady(settings)) throw new Error('المصادقة غير مكتملة (API Key أو Gateway URL)');

    const prompt = [
      'نظّف النص التالي المستخرج من OCR بدون تغيير المعنى.',
      '- أصلح فواصل الأسطر وعلامات الترقيم.',
      '- حافظ على نفس اللغة كما هي.',
      '- لا تضف أي شرح أو مقدمة، أعد النص المنظف فقط.',
      '',
      source
    ].join('\n');

    if (settings.provider === 'gemini'){
      const model = (settings.model || 'gemini-1.5-flash').trim();
      return await callGemini({ apiKey: settings.geminiKey, model, prompt, maxOut: settings.maxOut || 2000 });
    }

    const baseUrl = effectiveBaseUrl(settings) || (settings.provider === 'openrouter' ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1');
    let model = settings.model || 'openai/gpt-4o-mini';
    if (settings.provider === 'openrouter') model = maybeOnlineModel(model, { ...settings, webMode: 'off' });

    const messages = [
      { role: 'system', content: 'أنت مدقق OCR محترف. أعد النص نظيفًا فقط بدون أي تعليقات.' },
      { role: 'user', content: prompt }
    ];
    return await callOpenAIChat({ apiKey: settings.apiKey, baseUrl, model, messages, max_tokens: clamp(Number(settings.maxOut||2000), 256, 8000) });
  }

  async function fileToTextSmart(file){
    const name = (file?.name || '').toLowerCase();
    const type = (file?.type || '').toLowerCase();
    const isImg = type.startsWith('image/') || /\.(png|jpe?g|webp|bmp|gif|tiff?)$/i.test(name);
    if (isImg){
      const dataUrl = await fileToDataUrl(file);
      return await ocrDataUrl(dataUrl, undefined, { fileName: file?.name || "image", page: 1 });
    }
    return await fileToText(file);
  }

  async function exportTranscriptionResult({ format='docx', text='', structured=null, fileBaseName='transcription' }){
    const safeBase = String(fileBaseName || 'transcription').replace(/[^\w؀-ۿ\-\.]+/g, '_');
    const cleanText = String(text || '').trim();
    if (!cleanText && !structured) throw new Error('لا يوجد محتوى للتصدير');

    if (format === 'txt'){
      const out = cleanText || String(structured?.pages?.map(p => p?.text || '').join('\n\n') || '').trim();
      return downloadBlob(`${safeBase}.txt`, new Blob([out], { type:'text/plain;charset=utf-8' }));
    }

    if (format === 'json'){
      const payload = structured || { text: cleanText };
      return downloadBlob(`${safeBase}.json`, new Blob([JSON.stringify(payload, null, 2)], { type:'application/json;charset=utf-8' }));
    }

    const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;line-height:1.9;white-space:pre-wrap}</style></head><body>${escapeHtml(cleanText)}</body></html>`;
    const fn = window.htmlToDocx || window.HTMLtoDOCX;
    if (!fn) throw new Error('محول DOCX غير متاح');
    const blob = toDocxBlob(await Promise.resolve(fn(html)));
    return downloadBlob(`${safeBase}.docx`, blob);
  }

  // ---------------- Downloads (```file blocks) ----------------
  function loadDownloads(){ return loadJSON(KEYS.downloads, []) || []; }
  function saveDownloads(arr){ saveJSON(KEYS.downloads, arr); }

  function downloadBlob(filename, blob){
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 8000);
  }

  function parseFileBlocks(text){
    const s = String(text || '');
    const re = /```file\s+name="([^"]+)"\s+mime="([^"]+)"(?:\s+encoding="([^"]+)")?\s*\n([\s\S]*?)\n```/g;
    const out = [];
    let m;
    while ((m = re.exec(s))){
      out.push({ name:m[1], mime:m[2], encoding: m[3] || 'text', content: m[4] || '' });
    }
    return out;
  }
  function ingestDownloadsFromText(text){
    const blocks = parseFileBlocks(text);
    if (!blocks.length) return 0;
    const dl = loadDownloads();
    for (const b of blocks){
      dl.unshift({ id: makeId('dl'), name: b.name, mime: b.mime, encoding: b.encoding, content: b.content, createdAt: nowTs(), pinned:false });
    }
    saveDownloads(dl.slice(0, 120));
    return blocks.length;
  }

  // ---------------- Provider calls ----------------
  async function callOpenAIChat({ apiKey, baseUrl, model, messages, max_tokens, signal, extraHeaders={} }){
    const url = baseUrl.replace(/\/+$/,'') + '/chat/completions';
    const body = { model, messages, max_tokens, temperature: 0.25 };
    const r = await fetch(url, {
      method:'POST',
      headers: { 'Content-Type':'application/json', ...extraHeaders, ...buildAuthHeaders(getSettings()) },
      body: JSON.stringify(body),
      signal
    });
    const t = await r.text();
    let j; try{ j = JSON.parse(t); }catch(_){ j = null; }
    if (!r.ok) throw new Error(extractApiErrorMessage(j, t, r.status));

    const extracted = extractAssistantText(j);
    if (!String(extracted.text || '').trim()){
      throw new Error(extracted.diagnostic || 'EMPTY_ASSISTANT_RESPONSE');
    }
    return extracted.text;
  }

  function textFromPart(part){
    if (part == null) return '';
    if (typeof part === 'string') return part;
    if (typeof part === 'number' || typeof part === 'boolean') return String(part);
    if (Array.isArray(part)) return part.map(textFromPart).filter(Boolean).join('');

    if (typeof part === 'object'){
      if (typeof part.text === 'string') return part.text;
      if (typeof part.value === 'string') return part.value;
      if (typeof part.content === 'string') return part.content;
      if (Array.isArray(part.content)) return part.content.map(textFromPart).filter(Boolean).join('');
      if (Array.isArray(part.parts)) return part.parts.map(textFromPart).filter(Boolean).join('');
      if (Array.isArray(part.items)) return part.items.map(textFromPart).filter(Boolean).join('');
      if (typeof part.output_text === 'string') return part.output_text;
      if (typeof part.refusal === 'string') return part.refusal;
      if (part.type === 'output_text' && typeof part.text === 'string') return part.text;
      if (part.type === 'text' && typeof part.text === 'string') return part.text;
      if (typeof part.message === 'string') return part.message;
      if (part.message && typeof part.message === 'object') return textFromPart(part.message);
    }
    return '';
  }

  function extractApiErrorMessage(payload, fallbackText, status){
    const direct = textFromPart(payload?.error?.message)
      || textFromPart(payload?.message)
      || textFromPart(payload?.detail);
    if (direct) return direct;
    const raw = String(fallbackText || '').trim();
    if (raw) return raw;
    return `HTTP ${status}`;
  }

  function describeResponseShape(payload){
    if (!payload || typeof payload !== 'object') return 'payload=none';
    const keys = Object.keys(payload).slice(0, 8).join(',') || 'none';
    const choices = Array.isArray(payload.choices) ? payload.choices.length : 0;
    const output = Array.isArray(payload.output) ? payload.output.length : 0;
    const responseOutput = Array.isArray(payload.response?.output) ? payload.response.output.length : 0;
    return `keys=${keys} choices=${choices} output=${output} response_output=${responseOutput}`;
  }

  function extractAssistantText(payload){
    if (!payload || typeof payload !== 'object'){
      return { text:'', diagnostic:'EMPTY_ASSISTANT_RESPONSE payload=none' };
    }

    const directCandidates = [
      textFromPart(payload.output_text),
      textFromPart(payload.response?.output_text),
      textFromPart(payload.message),
      textFromPart(payload.content)
    ].filter(Boolean);
    if (directCandidates.length){
      return { text: directCandidates.join('\n\n').trim(), diagnostic:'' };
    }

    const outputEntries = [
      ...(Array.isArray(payload.output) ? payload.output : []),
      ...(Array.isArray(payload.response?.output) ? payload.response.output : [])
    ];
    for (const entry of outputEntries){
      const fromOutput = textFromPart(entry?.content)
        || textFromPart(entry?.text)
        || textFromPart(entry?.output_text)
        || textFromPart(entry);
      if (fromOutput) return { text: fromOutput, diagnostic:'' };
    }

    const choices = Array.isArray(payload.choices) ? payload.choices : [];
    for (const ch of choices){
      const fromMessage = textFromPart(ch?.message?.content)
        || textFromPart(ch?.message)
        || textFromPart(ch?.delta?.content)
        || textFromPart(ch?.delta)
        || textFromPart(ch?.text);
      if (fromMessage) return { text: fromMessage, diagnostic:'' };
    }

    const hasStructuredPayload = !!(
      payload.output_text != null
      || payload.response?.output_text != null
      || outputEntries.length
      || choices.length
    );
    const diagnosticCode = hasStructuredPayload ? 'EMPTY_ASSISTANT_RESPONSE' : 'UNRECOGNIZED_ASSISTANT_RESPONSE';
    return { text:'', diagnostic:`${diagnosticCode} ${describeResponseShape(payload)}` };
  }

  async function callGemini({ apiKey, model, prompt, signal, maxOut=2048 }){
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const body = { contents: [{ role:'user', parts:[{ text: prompt }] }], generationConfig: { temperature: 0.25, maxOutputTokens: maxOut } };
    const r = await fetch(url, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(body), signal });
    const t = await r.text();
    let j; try{ j = JSON.parse(t); }catch(_){ j = null; }
    if (!r.ok) throw new Error(j?.error?.message || t || `HTTP ${r.status}`);
    const parts = j?.candidates?.[0]?.content?.parts || [];
    return parts.map(p => p?.text || '').join('');
  }

  async function streamChatCompletions({ apiKey, baseUrl, model, messages, max_tokens, signal, onDelta, extraHeaders={} }){
    const url = baseUrl.replace(/\/+$/,'') + '/chat/completions';
    const body = { model, messages, max_tokens, temperature: 0.25, stream: true };
    const r = await fetch(url, {
      method:'POST',
      headers: { 'Content-Type':'application/json', ...extraHeaders, ...buildAuthHeaders(getSettings()) },
      body: JSON.stringify(body),
      signal
    });
    if (!r.ok){
      const t = await r.text().catch(()=> '');
      let j; try{ j=JSON.parse(t);}catch(_){j=null;}
      throw new Error(j?.error?.message || t || `HTTP ${r.status}`);
    }

    const contentType = String(r.headers.get('content-type') || '').toLowerCase();
    // Some gateways ignore stream=true and return a normal JSON completion response.
    if (contentType.includes('application/json')){
      const t = await r.text();
      let j; try{ j = JSON.parse(t); }catch(_){ j = null; }
      const oneShot = extractAssistantText(j);
      if (!String(oneShot.text || '').trim()){
        throw new Error(oneShot.diagnostic || 'STREAM_EMPTY_RESPONSE');
      }
      return String(oneShot.text || '');
    }

    const reader = r.body.getReader();
    const dec = new TextDecoder('utf-8');
    let buf = '';
    let full = '';
    while (true){
      const {value, done} = await reader.read();
      if (done) break;
      buf += dec.decode(value, {stream:true});
      const lines = buf.split(/\r?\n/);
      buf = lines.pop() || '';
      for (const line of lines){
        const s = line.trim();
        if (!s || !s.startsWith) continue;
        if (!s.startsWith('data:')) continue;
        const payload = s.slice(5).trim();
        if (payload === '[DONE]') return full;
        let j; try{ j = JSON.parse(payload); }catch(_){ continue; }
        const delta = textFromPart(j?.choices?.[0]?.delta?.content) || textFromPart(j?.choices?.[0]?.delta);
        if (delta){
          full += delta;
          onDelta?.(delta, full);
        }
      }
    }

    // Handle any final buffered line when stream closes without trailing newline.
    const tail = (buf || '').trim();
    if (tail.startsWith('data:')){
      const payload = tail.slice(5).trim();
      if (payload && payload !== '[DONE]'){
        let j; try{ j = JSON.parse(payload); }catch(_){ j = null; }
        const lastDelta = textFromPart(j?.choices?.[0]?.delta?.content)
          || textFromPart(j?.choices?.[0]?.delta)
          || textFromPart(j?.choices?.[0]?.message?.content)
          || textFromPart(j?.choices?.[0]?.message)
          || '';
        if (lastDelta){
          full += lastDelta;
          onDelta?.(lastDelta, full);
        }
      }
    }

    if (!String(full || '').trim()){
      throw new Error('STREAM_EMPTY_RESPONSE');
    }
    return full;
  }

  // ---------------- Prompts and messages ----------------
  function buildSystemPrompt(settings){
    let sys = settings.systemPrompt || 'أنت مساعد احترافي. أجب بدقة وبأسلوب منظم.';
    if (isDeep()){
      sys += '\n\n[وضع التفكير العميق] التزم بالبنية: (1) ملخص سريع (2) شرح مفصل (3) خطوات/أمثلة (4) مخاطر/تحقق (5) خلاصة.';
    }
    if (isAgent()){
      sys += '\n\n[وضع الوكيل] ابدأ بـ "الخطة:" (3-6 خطوات مرقمة) ثم "التنفيذ:" ثم "النتيجة النهائية:". إذا استخدمت الويب اذكر "المصادر:" بروابط.';
    }
    if (settings.toolsEnabled){
      sys += "\\n\\n[Tools] لديك أدوات مسموحة: kb_search, web_search, download_file."
          + "\\n- إذا احتجت أداة: اخرج فقط بلوك واحد بالشكل التالي ثم توقف:"
          + "\\n```tool name=\"kb_search\"\\n{\"query\":\"...\",\"topK\":6}\\n```"
          + "\\n```tool name=\"web_search\"\\n{\"query\":\"...\"}\\n```"
          + "\\n```tool name=\"download_file\"\\n{\"name\":\"report.md\",\"mime\":\"text/markdown\",\"content\":\"...\"}\\n```"
          + "\\n- لا تكتب إجابة نهائية في نفس الرد الذي يطلب أداة. بعد نتيجة الأداة سأطلب منك المتابعة.";
    }
    return sys;
  }

  // ---------------- Tools (v6) ----------------
  function parseFirstToolCall(text){
    const s = String(text||'');
    // ```tool name="kb_search"\n{...}\n```
    let m = s.match(/```tool\s+name="([^"]+)"\s*\n([\s\S]*?)```/i);
    if (!m) m = s.match(/<tool\s+name="([^"]+)"\s*>\s*([\s\S]*?)<\/tool>/i);
    if (!m) return null;
    const name = (m[1]||'').trim();
    const rawArgs = (m[2]||'').trim();
    let args = {};
    try { args = rawArgs ? JSON.parse(rawArgs) : {}; } catch(e){ args = { _raw: rawArgs }; }
    return { name, args, raw: m[0] };
  }

  async function executeToolCall(tool, settings){
    const name = tool.name;
    const args = tool.args || {};
    if (name === 'kb_search'){
      const q = String(args.query || '').trim();
      if (!q) throw new Error('kb_search: query مطلوب');
      const hits = await searchKb(q);
      return String(hits || '').trim();
    }
    if (name === 'web_search'){
      const q = String(args.query || '').trim();
      if (!q) throw new Error('web_search: query مطلوب');
      // Use :online suffix for OpenRouter models
      if (!isOpenRouter(settings)) throw new Error('web_search متاح مع OpenRouter فقط');
      const onlineModel = maybeOnlineModel(settings.model || 'openai/gpt-4o-mini', { ...settings, webMode:'openrouter_online' });
      const baseUrl = effectiveBaseUrl(settings) || 'https://openrouter.ai/api/v1';
      const extraHeaders = buildProviderHeaders(settings);

      const messages = [
        { role:'system', content:'أنت مساعد بحث. ابحث في الويب وأعد إجابة دقيقة مع قائمة مصادر بروابط.' },
        { role:'user', content:`ابحث عن: ${q}\nأعد: (1) ملخص (2) نقاط رئيسية (3) مصادر بروابط.` }
      ];
      const ans = await callOpenAIChat({
        apiKey: settings.apiKey,
        baseUrl,
        model: onlineModel,
        messages,
        max_tokens: clamp(Number(settings.maxOut||2000), 256, 4000),
        signal: abortCtl?.signal,
        extraHeaders
      });
      return String(ans||'').trim();
    }
    if (name === 'download_file'){
      const fname = String(args.name || 'output.txt').trim() || 'output.txt';
      const mime = String(args.mime || 'text/plain').trim() || 'text/plain';
      const content = String(args.content || '');
      const pid = getCurProjectId();
      addDownload(pid, { name: fname, mime, content });
      renderDownloads();
      refreshNavMeta();
      return `Saved: ${fname}`;
    }
    throw new Error('Tool غير معروف: ' + name);
  }

  async function maybeRunToolsLoop(pid, tid, initialAnswer, settings){
    if (!settings.toolsEnabled) return null;
    let ans = String(initialAnswer || '').trim();
    let steps = 0;
    while (steps < 5){
      const tc = parseFirstToolCall(ans);
      if (!tc) break;

      showStatus(`🧰 Tool: ${tc.name}…`, true);
      let result = '';
      try{
        result = await executeToolCall(tc, settings);
      }catch(e){
        result = `❌ Tool error: ${e?.message||e}`;
      }

      // append tool result message (assistant)
      const threads = loadThreads(pid);
      const idx = threads.findIndex(t => t.id === tid);
      const thread = threads[idx] || threads[0];
      thread.messages = thread.messages || [];
      thread.messages.push({ id: makeId('m'), role:'assistant', ts: nowTs(),
        content: `🧰 TOOL RESULT (${tc.name})\n\n${result}` });
      thread.updatedAt = nowTs();
      threads[idx] = thread;
      saveThreads(pid, threads);
      renderChat();

      // ask model to continue based on tool result
      const filesText = String($('filesText')?.value || '');
      const rag = await buildRagContextIfEnabled(''); // keep rag stable
      const follow = `تابع الآن بناءً على نتيجة الأداة أعلاه. لا تكرر مخرجات الأداة حرفيًا. إذا احتجت أداة أخرى اطلبها ببلوك tool فقط.`;
      const threadSnapshot = getCurThread();
      const messages = buildMessagesForChat({
        userText: follow,
        settings,
        filesText,
        ragCtx: rag.ctx,
        historyMessages: threadSnapshot.messages || [],
        threadSummary: threadSnapshot.summary || ''
      });

      const extraHeaders = buildProviderHeaders(settings);
      const baseUrl = effectiveBaseUrl(settings) || (settings.provider === 'openrouter' ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1');
      let model = settings.model;
      if (settings.provider === 'openrouter') model = maybeOnlineModel(model, settings);

      ans = await callOpenAIChat({
        apiKey: settings.apiKey,
        baseUrl,
        model,
        messages,
        max_tokens: clamp(Number(settings.maxOut||2000), 256, 8000),
        signal: abortCtl?.signal,
        extraHeaders
      });

      // append final assistant step output
      const threads2 = loadThreads(pid);
      const idx2 = threads2.findIndex(t => t.id === tid);
      const thread2 = threads2[idx2] || threads2[0];
      thread2.messages = thread2.messages || [];
      thread2.messages.push({ id: makeId('m'), role:'assistant', ts: nowTs(), content: String(ans||'') });
      thread2.updatedAt = nowTs();
      threads2[idx2] = thread2;
      saveThreads(pid, threads2);
      renderChat();

      steps++;
    }
    return ans;
  }




async function maybeUpdateThreadSummary(pid, tid){
  const settings = getSettings();
  if (!hasAuthReady(settings)) return;

  const threads = loadThreads(pid);
  const t = threads.find(x => x.id === tid);
  if (!t) return;
  const msgs = t.messages || [];
  if (msgs.length < 18) return;

  const totalChars = msgs.map(m => (m.content||'')).join('\n').length;
  if (totalChars < 16000) return;

  const old = msgs.slice(0, Math.max(8, msgs.length - 10));
  const text = old.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n').slice(0, 14000);

  const sys = 'لخّص المحادثة القديمة في نقاط موجزة تحافظ على القرارات والمعلومات المهمة. لا تضف معلومات جديدة.';
  const user = `المحتوى:\n${text}\n\nأعد ملخصًا موجزًا جدًا (200-400 كلمة).`;

  const extraHeaders = buildProviderHeaders(settings);

  try{
    const abort = new AbortController();
    let sum = '';
    if (settings.provider === 'gemini'){
      sum = await callGemini({ apiKey: settings.geminiKey, model: settings.model, prompt: `${sys}\n\n${user}`, signal: abort.signal, maxOut: 1024 });
    } else {
      const baseUrl = effectiveBaseUrl(settings) || (settings.provider === 'openrouter' ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1');
      sum = await callOpenAIChat({ apiKey: settings.apiKey, baseUrl, model: settings.model, messages: [{role:'system', content: sys},{role:'user', content: user}], max_tokens: 900, signal: abort.signal, extraHeaders });
    }

    t.summary = (t.summary ? (t.summary + "\n\n") : "") + sum.trim();
    t.updatedAt = nowTs();
    saveThreads(pid, threads);
  }catch(_){}
}

  function maybeOnlineModel(model, settings){
    if (isOpenRouter(settings) && settings.webMode === 'openrouter_online' && getWebToggle()){
      if (!String(model).includes(':online')) return String(model) + ':online';
    }
    return model;
  }

  function answerHasAgentPlan(ans){
    const text = String(ans || '').toLowerCase();
    return text.includes('plan:') || text.includes('الخطة:');
  }

  function shouldRetryWithoutStreaming(err){
    const msg = String(err?.message || err || '');
    return /failed to fetch|networkerror|load failed|network request failed|stream_empty_response|empty_assistant_response|unrecognized_assistant_response/i.test(msg);
  }

  function getFriendlyChatError(err){
    const msg = String(err?.message || err || '').trim();
    if (!msg) return 'حدث خطأ غير معروف أثناء الدردشة.';
    if (/unauthorized client token/i.test(msg)) return 'تم الوصول إلى Gateway، لكن Gateway Client Token غير صحيح أو مفقود.';
    if (/missing api key|gateway_missing_upstream_key/i.test(msg)) return 'تم الوصول إلى Gateway، لكن مفتاح OpenRouter غير مضبوط داخل الـ Worker.';
    if (/failed to fetch|networkerror|load failed|network request failed|cors/i.test(msg)) return 'تعذر الوصول إلى خدمة الدردشة. تحقق من Gateway URL أو CORS أو الاتصال.';
    if (/stream_empty_response|empty_assistant_response|unrecognized_assistant_response/i.test(msg)) return 'تم الاتصال بالمزوّد لكن الرد رجع فارغًا أو بصيغة غير متوقعة.';
    if (/missing authentication/i.test(msg)) return 'ضع API Key الصحيح ثم احفظ الإعدادات.';
    if (/upstream/i.test(msg) || /gateway_upstream_/i.test(msg)) return 'فشل مزود الذكاء الاصطناعي في الرد من جهة الخادم.';
    return msg;
  }

  
  function buildAutoFilesContext(settings){
    // If filesText area is empty, build a clipped context from project files automatically.
    const explicit = String($('filesText')?.value || '');
    if (explicit.trim()) return explicit;

    const pid = getCurProjectId();
    const files = loadFiles(pid).filter(f => (f.text||'').trim());
    if (!files.length) return '';

    const totalLimit = Number(settings.fileClip || 12000);
    const perLimit = Math.max(1200, Math.floor(totalLimit / Math.min(files.length, 4)));
    let out = '';
    for (const f of files){
      const block = `--- ${f.name} ---\n` + clipText(f.text, perLimit);
      if ((out + "\n\n" + block).length > totalLimit) break;
      out += (out ? "\n\n" : "") + block;
    }
    return out;
  }

  function buildAttachmentsBlock(settings){
    if (!pendingChatAttachments.length) return '';
    const totalLimit = Math.min(14000, Number(settings.fileClip || 12000));
    let out = '[مرفقات المستخدم]\n';
    for (const a of pendingChatAttachments){
      const block = `--- ${a.name} (${a.kind}) ---\n` + (a.text ? a.text : '(لا يوجد نص — صورة/ملف غير مقروء)');
      if ((out + "\n\n" + block).length > totalLimit) break;
      out += "\n\n" + block;
    }
    return out.trim();
  }

  function modelSupportsVision(settings){
    if (settings.provider === 'gemini') return true;
    const id = String(settings.model || '').replace(/:online$/,'');
    const models = loadJSON(KEYS.modelCache, {})?.models || [];
    const hit = models.find(m => m.id === id);
    if (hit) return !!hit.vision;
    return /(vision|multimodal|gpt-4o|gemini|claude-3|llava|pixtral)/i.test(id);
  }

  function buildUserMessageWithAttachments(userText, settings, attachments){
    const list = Array.isArray(attachments) ? attachments : [];
    if (!list.length) return { role:'user', content: String(userText||'') };

    const textParts = [];
    const vision = modelSupportsVision(settings);
    const content = [{ type:'text', text: String(userText||'') }];

    list.forEach((a) => {
      const label = `المرفق: ${a.name} (${a.kind})`;
      if (a.text && a.text.trim()) textParts.push(`${label}\n${a.text}`);
      else textParts.push(`${label}\n(لا يوجد نص مستخرج)`);

      if (vision && a.kind === 'image' && a.dataUrl){
        content.push({ type:'image_url', image_url:{ url: a.dataUrl } });
      }
    });

    content.push({ type:'text', text: `\n\n[محتوى/وصف المرفقات]\n${textParts.join('\n\n')}` });

    if (settings.provider === 'gemini'){
      return { role:'user', content: String(userText||'') + "\n\n[محتوى/وصف المرفقات]\n" + textParts.join('\n\n') };
    }
    return { role:'user', content };
  }

function buildMessagesForChat({ userText, settings, filesText, ragCtx, attachments, historyMessages=[], threadSummary='' }){
    const sys = buildSystemPrompt(settings);
    const msgs = [{ role:'system', content: sys }];
    const briefCtx = buildProjectBriefContext();
    if (briefCtx){
      msgs.push({ role:'system', content: briefCtx });
    }
    if (threadSummary && threadSummary.trim()){
      msgs.push({ role:'system', content: `Conversation memory:\n${threadSummary.trim()}` });
    }
    const tail = (Array.isArray(historyMessages) ? historyMessages : []).slice(-14);
    for (const m of tail){
      if (!m?.role || !m?.content) continue;
      msgs.push({ role: m.role, content: m.content });
    }
    if (filesText && filesText.trim()){
      const clipLimit = Number(settings.fileClip || 12000);
      const clip = filesText.length > clipLimit ? clipText(filesText, clipLimit) : filesText;
      msgs.push({ role:'system', content: `User files context:
${clip}` });
    }
    if (ragCtx && ragCtx.trim()){
      msgs.push({ role:'system', content: ragCtx });
    }
    msgs.push(buildUserMessageWithAttachments(userText, settings, attachments));
    return msgs;
  }

  // ---------------- Chat rendering ----------------
  let abortCtl = null;
  let pendingChatAttachments = [];

  function titleFromMessage(content, fallback='Artifact'){
    const first = String(content || '')
      .replace(/[`#>*_-]/g, ' ')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean);
    if (!first) return fallback;
    return first.length > 56 ? `${first.slice(0, 56)}…` : first;
  }

  function sendMessageToCanvas(message){
    const pid = getCurProjectId();
    const docs = loadCanvas(pid);
    const title = titleFromMessage(message?.content, 'Chat Artifact');
    const now = nowTs();
    const id = makeId('doc');
    docs.unshift({
      id,
      title,
      content: String(message?.content || ''),
      createdAt: now,
      updatedAt: now,
      versions: [{ ts: now, title, content: String(message?.content || '') }]
    });
    saveCanvas(pid, docs);
    setCurCanvasId(pid, id);
    renderCanvasList();
    setActiveNav('canvas');
    openCanvasDoc(id);
    refreshNavMeta();
    toast('✅ Sent to Canvas');
  }

  function renderEmptyChatState(log){
    if (!log) return;
    log.innerHTML = `
      <div class="empty-chat-state empty-chat-state--compact">
        <div class="empty-chat-title">المساحة جاهزة لبحث، منتج، أو خطة تنفيذ.</div>
        <div class="empty-chat-text">ابدأ من اللوحة العليا أو اكتب الهدف مباشرة. سيستخدم التطبيق الملفات، المعرفة، وملحقات المحادثة لبناء استجابة أوضح وأكثر احترافية.</div>
        <div class="empty-chat-points">
          <div class="empty-chat-point">
            <strong>Readable Outputs</strong>
            <span>تقارير، ملخصات، وخطط عمل مكتوبة بطريقة واضحة ومريحة للقراءة الطويلة.</span>
          </div>
          <div class="empty-chat-point">
            <strong>Context-Rich</strong>
            <span>الملفات، قاعدة المعرفة، والمرفقات تندمج داخل نفس سياق التشغيل بدل الدردشة المعزولة.</span>
          </div>
          <div class="empty-chat-point">
            <strong>Operator Ready</strong>
            <span>استخدم القوالب، الـ Workflows، ونمط الوكيل لتحويل الطلب إلى مخرجات تنفيذية قابلة للاستخدام.</span>
          </div>
        </div>
      </div>`;
  }

  function renderChat(){
    const log = $('chatLog');
    if (!log) return;
    const thread = getCurThread();
    const msgs = thread.messages || [];
    log.innerHTML = '';

    if (!msgs.length){
      renderEmptyChatState(log);
      log.scrollTop = 0;
      refreshNavMeta();
      refreshStrategicWorkspace().catch(()=>{});
      return;
    }

    msgs.forEach((m) => {
      const b = document.createElement('div');
      b.className = 'bubble ' + (m.role === 'user' ? 'user' : 'assistant');
      b.dataset.mid = m.id || '';
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.textContent = (m.role === 'user' ? 'USER' : 'ASSISTANT') + ' • ' + new Date(m.ts || nowTs()).toLocaleString('ar');

      const body = document.createElement('div');
      body.className = 'body';
      body.innerHTML = (m.role === 'assistant') ? renderMarkdown(m.content || '') : `<pre style="margin:0; white-space:pre-wrap">${escapeHtml(m.content||'')}</pre>`;

      const actions = document.createElement('div');
      actions.className = 'actions';

      const copyBtn = document.createElement('button');
      copyBtn.className = 'btn ghost sm';
      copyBtn.textContent = 'نسخ';
      copyBtn.addEventListener('click', async () => {
        const ok = await copyToClipboard(m.content || '');
        toast(ok ? '✅ تم النسخ' : '⚠️ تعذر النسخ');
      });
      actions.appendChild(copyBtn);

      if (m.role === 'assistant'){
        const canvasBtn = document.createElement('button');
        canvasBtn.className = 'btn ghost sm';
        canvasBtn.textContent = 'Canvas';
        canvasBtn.addEventListener('click', () => sendMessageToCanvas(m));
        actions.appendChild(canvasBtn);

        const dlCount = ingestDownloadsFromText(m.content || '');
        if (dlCount){
          const info = document.createElement('span');
          info.className = 'hint';
          info.textContent = `📄 اكتشاف ${dlCount} ملف(ات) — راجع التحميلات`;
          actions.appendChild(info);
          refreshNavMeta();
        }
      }

      b.appendChild(meta);
      b.appendChild(body);
      b.appendChild(actions);
      log.appendChild(b);
    });

    log.scrollTop = log.scrollHeight + 1000;
    refreshNavMeta();
    refreshStrategicWorkspace().catch(()=>{});
  }

  function updateStreamingAssistant(mid, text){
    const log = $('chatLog');
    const b = log?.querySelector(`.bubble.assistant[data-mid="${CSS.escape(mid)}"]`);
    if (!b) return;
    const body = b.querySelector('.body');
    if (body) body.innerHTML = renderMarkdown(text);
    log.scrollTop = log.scrollHeight + 1000;
  }

  
  function updateChatAttachChips(){
    const box = $('chatAttachChips');
    if (!box) return;
    box.innerHTML = '';
    pendingChatAttachments.forEach((a, idx) => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.innerHTML = `<span>${escapeHtml(a.name)}</span><span class="meta">${escapeHtml(a.kind)}</span>`;
      const x = document.createElement('button');
      x.className = 'x';
      x.textContent = '✕';
      x.addEventListener('click', () => {
        pendingChatAttachments.splice(idx, 1);
        updateChatAttachChips();
      });
      chip.appendChild(x);
      box.appendChild(chip);
    });
    syncComposerMeta();
  }

  function clipText(t, limit){
    const s = String(t || '');
    if (s.length <= limit) return s;
    return s.slice(0, Math.floor(limit*0.55)) + "\n...\n" + s.slice(-Math.floor(limit*0.45));
  }

  async function addChatAttachments(fileList){
    const settings = getSettings();
    const maxPer = 4500; // per attachment
    const files = Array.from(fileList || []);
    if (!files.length) return;
    showStatus('إرفاق الملفات…', true);
    for (const file of files){
      const name = file.name || 'file';
      const type = file.type || '';
      const isImg = type.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(name);
      let kind = isImg ? 'image' : 'file';
      let text = '';
      let dataUrl = '';
      try{
        if (isImg){
          dataUrl = await fileToDataUrl(file);
          // OCR by default for images (so model can see content)
          try{
            text = await ocrDataUrl(dataUrl, 'ara+eng');
          }catch(_){ text = ''; }
        }else{
          text = await fileToTextSmart(file);
        }
      }catch(_){ text = ''; }
      pendingChatAttachments.push({
        id: makeId('att'),
        name,
        kind,
        type,
        size: file.size || 0,
        dataUrl,
        text: clipText(text, maxPer),
        hasText: !!(text && text.trim())
      });
    }
    showStatus('', false);
    updateChatAttachChips();
    toast('✅ تم إرفاق الملفات');
  }

function updateChips(){
    const box = $('chatChips');
    if (!box) return;
    const pid = getCurProjectId();
    const files = loadFiles(pid);
    box.innerHTML = '';
    files.forEach((f) => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.innerHTML = `<span>${escapeHtml(f.name)}</span>`;
      const x = document.createElement('button');
      x.className = 'x';
      x.textContent = '✕';
      x.addEventListener('click', () => {
        const arr = loadFiles(pid).filter(x => x.id !== f.id);
        saveFiles(pid, arr);
        renderFiles();
        updateChips();
        refreshNavMeta();
      });
      chip.appendChild(x);
      box.appendChild(chip);
    });
    syncComposerMeta();
  }

  // ---------------- Send message ----------------
  async function sendMessage(){
    const input = $('chatInput');
    const text = (input.value || '').trim();
    if (!text) return;

    const settings = getSettings();
    if (settings.provider === 'gemini'){
      if (!(settings.geminiKey||'').trim()) return toast('⚠️ ضع Gemini API Key في الإعدادات.');
    } else if (settings.authMode === 'gateway'){
      if (!(settings.gatewayUrl||'').trim()) return toast('⚠️ ضع Gateway URL في الإعدادات (Auth Mode = Gateway).');
    } else {
      if (!(settings.apiKey||'').trim()) return toast('⚠️ ضع API Key في الإعدادات.');
    }

    const pid = getCurProjectId();
    const tid = getCurThreadId(pid);
    const threads = loadThreads(pid);
    const idx = threads.findIndex(t => t.id === tid);
    const thread = threads[idx] || threads[0];
    thread.messages = thread.messages || [];
    const historySnapshot = thread.messages.slice();
    const threadSummary = String(thread.summary || '');

    const uMsg = { id: makeId('m'), role:'user', content: text, ts: nowTs() };
    thread.messages.push(uMsg);
    thread.updatedAt = nowTs();
    threads[idx] = thread;
    saveThreads(pid, threads);

    input.value = '';
    resizeComposerInput(input);
    syncComposerMeta();
    renderChat();

    const filesText = buildAutoFilesContext(settings);
    const attachmentsForRequest = pendingChatAttachments.slice();
    
    const rag = await buildRagContextIfEnabled(text);
    const messages = buildMessagesForChat({
      userText: text,
      settings,
      filesText,
      ragCtx: rag.ctx,
      attachments: attachmentsForRequest,
      historyMessages: historySnapshot,
      threadSummary
    });

    // clear pending attachments after being embedded into the request
    pendingChatAttachments = [];
    updateChatAttachChips();

    showStatus('جاري التوليد…', true);
    $('stopBtn').style.display = 'inline-flex';
    abortCtl?.abort?.();
    abortCtl = new AbortController();

    let model = settings.model;
    if (settings.provider === 'openrouter') model = maybeOnlineModel(model, settings);

    const extraHeaders = buildProviderHeaders(settings);

    const aId = makeId('m');
    const aMsg = { id: aId, role:'assistant', content:'', ts: nowTs() };
    const threadsP = loadThreads(pid);
    const idxP = threadsP.findIndex(t => t.id === tid);
    const thP = threadsP[idxP] || threadsP[0];
    thP.messages = thP.messages || [];
    thP.messages.push(aMsg);
    thP.updatedAt = nowTs();
    threadsP[idxP] = thP;
    saveThreads(pid, threadsP);
    renderChat();

    try{
      let ans = '';
      const wantStream = !!settings.streaming;

      if (settings.provider === 'gemini'){
        const prompt = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
        ans = await callGemini({ apiKey: settings.geminiKey, model: settings.model, prompt, signal: abortCtl.signal, maxOut: Math.min(2048, Number(settings.maxOut||2000)) });
      } else {
        const baseCandidates = getChatBaseUrlCandidates(settings);
        const maxTokens = Number(settings.maxOut || 2000);
        if (wantStream){
          let streamErrLast = null;
          for (let i=0; i<baseCandidates.length; i++){
            const baseUrl = baseCandidates[i];
            try{
              ans = await streamChatCompletions({
                apiKey: settings.apiKey, baseUrl, model, messages,
                max_tokens: maxTokens,
                signal: abortCtl.signal,
                extraHeaders,
                onDelta: (_d, full) => {
                  updateStreamingAssistant(aId, full);
                  aMsg.content = full;
                }
              });
              streamErrLast = null;
              break;
            }catch(streamErr){
              streamErrLast = streamErr;
              const streamUnavailable = shouldRetryWithoutStreaming(streamErr);
              const isLast = i === baseCandidates.length - 1;
              if (!streamUnavailable || isLast) break;
            }
          }

          if (streamErrLast){
            showStatus('⚠️ تعذر البث المباشر على هذا الاتصال، سيتم المتابعة بدون Streaming…', true);
            let callErrLast = null;
            for (let i=0; i<baseCandidates.length; i++){
              const baseUrl = baseCandidates[i];
              try{
                ans = await callOpenAIChat({
                  apiKey: settings.apiKey,
                  baseUrl,
                  model,
                  messages,
                  max_tokens: maxTokens,
                  signal: abortCtl.signal,
                  extraHeaders
                });
                callErrLast = null;
                break;
                }catch(callErr){
                  callErrLast = callErr;
                }
              }
              if (callErrLast) throw callErrLast;
              if (!String(ans || '').trim()) throw new Error('EMPTY_ASSISTANT_RESPONSE');
              updateStreamingAssistant(aId, ans);
            }
          } else {
          let callErrLast = null;
          for (let i=0; i<baseCandidates.length; i++){
            const baseUrl = baseCandidates[i];
            try{
              ans = await callOpenAIChat({ apiKey: settings.apiKey, baseUrl, model, messages, max_tokens: maxTokens, signal: abortCtl.signal, extraHeaders });
              callErrLast = null;
              break;
            }catch(callErr){
                callErrLast = callErr;
              }
            }
            if (callErrLast) throw callErrLast;
            if (!String(ans || '').trim()) throw new Error('EMPTY_ASSISTANT_RESPONSE');
            updateStreamingAssistant(aId, ans);
          }
        }

        if (!String(ans || '').trim()) throw new Error('EMPTY_ASSISTANT_RESPONSE');

        if (isAgent() && ans && !answerHasAgentPlan(ans)){
        ans = `الخطة:\n1) تحليل\n2) تنفيذ\n3) نتيجة\n\nالتنفيذ:\n${ans}\n\nالنتيجة النهائية:\n—`;
      }

      const threads2 = loadThreads(pid);
      const idx2 = threads2.findIndex(t => t.id === tid);
      const thread2 = threads2[idx2] || threads2[0];
      const msg2 = (thread2.messages || []).find(m => m.id === aId);
      if (msg2) msg2.content = ans || aMsg.content || '';
      thread2.updatedAt = nowTs();
      threads2[idx2] = thread2;
      saveThreads(pid, threads2);

      // v6: tool loop (agent tools)
      if (settings.toolsEnabled) await maybeRunToolsLoop(pid, tid, ans, settings);

      showStatus('', false);
      $('stopBtn').style.display = 'none';
      renderChat();
      toast('✅ تم');
    }catch(e){
      const friendly = getFriendlyChatError(e);
      showStatus(`❌ خطأ:\n${friendly}`, false);
      $('stopBtn').style.display = 'none';
      const threads2 = loadThreads(pid);
      const idx2 = threads2.findIndex(t => t.id === tid);
      const thread2 = threads2[idx2] || threads2[0];
      const msg2 = (thread2.messages || []).find(m => m.id === aId);
      if (msg2 && !msg2.content) msg2.content = `❌ ${friendly}`;
      threads2[idx2] = thread2;
      saveThreads(pid, threads2);
      renderChat();
    }
  }

  function stopGeneration(){
    abortCtl?.abort?.();
    $('stopBtn').style.display='none';
    showStatus('⛔ تم إيقاف التوليد', false);
  }

  function regenLast(){
    const th = getCurThread();
    const lastUser = [...(th.messages||[])].reverse().find(m => m.role === 'user');
    if (!lastUser) return;
    $('chatInput').value = lastUser.content || '';
    resizeComposerInput();
    syncComposerMeta();
    sendMessage();
  }


// ---------------- Research Agent (3 steps) ----------------
async function runResearchAgent(topicOverride){
  const topic = (topicOverride != null ? String(topicOverride) : (prompt('موضوع البحث التفصيلي:', '') || '')) || '';
  if (!topic.trim()) return;

  const settings = getSettings();
  if (settings.provider !== 'gemini' && !settings.apiKey) return toast('⚠️ ضع API Key في الإعدادات.');
  if (settings.provider === 'gemini' && !settings.geminiKey) return toast('⚠️ ضع Gemini API Key في الإعدادات.');

  const pid = getCurProjectId();
  const tid = getCurThreadId(pid);
  const baseUrl = effectiveBaseUrl(settings) || (settings.provider === 'openrouter' ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1');

  const extraHeaders = buildProviderHeaders(settings);

  const pushAssistant = (content) => {
    const threads = loadThreads(pid);
    const idx = threads.findIndex(t => t.id === tid);
    const thread = threads[idx] || threads[0];
    thread.messages = thread.messages || [];
    thread.messages.push({ id: makeId('m'), role:'assistant', content, ts: nowTs() });
    thread.updatedAt = nowTs();
    threads[idx] = thread;
    saveThreads(pid, threads);
    renderChat();
  };

  abortCtl?.abort?.();
  abortCtl = new AbortController();
  const sys = buildSystemPrompt(settings);

  // 1) Plan
  showStatus('🧪 Research: 1/3 التخطيط…', true);
  const planPrompt = `ضع خطة بحث تفصيلية عن الموضوع التالي، مع أسئلة رئيسية وكلمات بحث:\n\n${topic}\n\nأعد: 1) خطة مرقمة 2) أسئلة 3) Keywords.`;
  let plan = '';
  try{
    if (settings.provider === 'gemini'){
      plan = await callGemini({ apiKey: settings.geminiKey, model: settings.model, prompt: `${sys}\n\n${planPrompt}`, signal: abortCtl.signal, maxOut: 1024 });
    } else {
      plan = await callOpenAIChat({ apiKey: settings.apiKey, baseUrl, model: settings.model, messages: [{role:'system', content: sys},{role:'user', content: planPrompt}], max_tokens: 900, signal: abortCtl.signal, extraHeaders });
    }
    pushAssistant(`🧪 Research Plan:\n\n${plan}`);
  }catch(e){
    showStatus(`❌ Research فشل في التخطيط:\n${e?.message||e}`, false);
    return;
  }

  // 2) Gather (KB + optional web)
  showStatus('🧪 Research: 2/3 جمع المعلومات (Web/KB)…', true);

  let kbNotes = '';
  try{
    const res = await searchKb(topic);
    if (res.length){
      kbNotes = 'مقاطع KB (للاستشهاد):\n' + res.map(r => `[KB:${r.fileName}#${r.chunkIdx}]\n${r.text}`).join('\n\n');
    }
  }catch(_){}

  const webModel = (settings.provider === 'openrouter' && settings.webMode === 'openrouter_online')
    ? (String(settings.model).includes(':online') ? settings.model : (settings.model + ':online'))
    : settings.model;

  const gatherPrompt = `الموضوع: ${topic}\n\nالخطة:\n${plan}\n\n${kbNotes ? ('\n' + kbNotes + '\n') : ''}\nالمطلوب الآن:\n- اجمع معلومات دقيقة ومحدثة قدر الإمكان.\n- إذا توفر Web Search استخدمه، ثم قدم "ملاحظات بحث" منظمة بنقاط.\n- اذكر المصادر كروابط أو مراجع واضحة.\n- إذا استخدمت KB أشر للاقتباسات بصيغة [KB:..].`;
  let notes = '';
  try{
    if (settings.provider === 'gemini'){
      notes = await callGemini({ apiKey: settings.geminiKey, model: settings.model, prompt: `${sys}\n\n${gatherPrompt}`, signal: abortCtl.signal, maxOut: 2048 });
    } else {
      notes = await callOpenAIChat({ apiKey: settings.apiKey, baseUrl, model: webModel, messages: [{role:'system', content: sys},{role:'user', content: gatherPrompt}], max_tokens: Math.min(2200, Number(settings.maxOut||2000)), signal: abortCtl.signal, extraHeaders });
    }
    pushAssistant(`🧪 Research Notes:\n\n${notes}`);
  }catch(e){
    showStatus(`❌ Research فشل في جمع المعلومات:\n${e?.message||e}`, false);
    return;
  }

  // 3) Synthesize report + file
  showStatus('🧪 Research: 3/3 تركيب تقرير + ملف…', true);
  const synthPrompt = `اعتمد على ملاحظات البحث التالية فقط (ولا تختلق حقائق):\n${notes}\n\nاكتب تقريرًا نهائيًا منظمًا بالعربية:\n- ملخص تنفيذي\n- خلفية\n- نقاط رئيسية\n- تحليل\n- توصيات\n- مصادر/مراجع\n\nوأنشئ ملف Markdown للتنزيل:\n\`\`\`file name="research_report.md" mime="text/markdown"\n(ضع التقرير هنا)\n\`\`\`\n`;
  try{
    let final = '';
    if (settings.provider === 'gemini'){
      final = await callGemini({ apiKey: settings.geminiKey, model: settings.model, prompt: `${sys}\n\n${synthPrompt}`, signal: abortCtl.signal, maxOut: Math.min(2048, Number(settings.maxOut||2000)) });
      pushAssistant('🧪 Research Report:\n\n' + final);
    } else {
      if (settings.streaming){
        const aId = makeId('m');
        const threads = loadThreads(pid);
        const idx = threads.findIndex(t => t.id === tid);
        const thread = threads[idx] || threads[0];
        thread.messages = thread.messages || [];
        thread.messages.push({ id: aId, role:'assistant', content:'🧪 Research Report:\n\n', ts: nowTs() });
        threads[idx] = thread;
        saveThreads(pid, threads);
        renderChat();

        final = await streamChatCompletions({
          apiKey: settings.apiKey,
          baseUrl,
          model: settings.model,
          messages: [{role:'system', content: sys},{role:'user', content: synthPrompt}],
          max_tokens: Math.min(2400, Number(settings.maxOut||2000)),
          signal: abortCtl.signal,
          extraHeaders,
          onDelta: (_d, full) => updateStreamingAssistant(aId, '🧪 Research Report:\n\n' + full)
        });

        const threads2 = loadThreads(pid);
        const thread2 = threads2.find(t => t.id === tid) || threads2[0];
        const msg2 = (thread2.messages||[]).find(m => m.id === aId);
        if (msg2) msg2.content = '🧪 Research Report:\n\n' + final;
        saveThreads(pid, threads2);
        renderChat();
      } else {
        final = await callOpenAIChat({ apiKey: settings.apiKey, baseUrl, model: settings.model, messages: [{role:'system', content: sys},{role:'user', content: synthPrompt}], max_tokens: Math.min(2400, Number(settings.maxOut||2000)), signal: abortCtl.signal, extraHeaders });
        pushAssistant('🧪 Research Report:\n\n' + final);
      }
    }
    showStatus('', false);
    toast('✅ اكتمل البحث التفصيلي');
    await ensureKbStats();
  }catch(e){
    showStatus(`❌ Research فشل في التقرير:\n${e?.message||e}`, false);
  }
}

  // ---------------- Canvas ----------------
  function loadCanvas(pid){
    const arr = loadJSON(KEYS.canvas(pid), []) || [];
    return Array.isArray(arr) ? arr : [];
  }
  function saveCanvas(pid, arr){ saveJSON(KEYS.canvas(pid), arr); }
  function curCanvasId(pid){ return localStorage.getItem(`aistudio_canvas_cur_${pid}_v3`) || ''; }
  function setCurCanvasId(pid, id){ localStorage.setItem(`aistudio_canvas_cur_${pid}_v3`, id || ''); }

  function renderCanvasList(){
    const pid = getCurProjectId();
    const sel = $('canvasDoc');
    const docs = loadCanvas(pid);
    const cur = curCanvasId(pid);
    sel.innerHTML = '';
    const o0 = document.createElement('option');
    o0.value=''; o0.textContent='اختر مستند...';
    sel.appendChild(o0);
    docs.forEach(d => {
      const o = document.createElement('option');
      o.value = d.id;
      o.textContent = d.title || d.id;
      sel.appendChild(o);
    });
    sel.value = cur;
    $('navCanvasMeta').textContent = String(docs.length);
  }

  function openCanvasDoc(id){
    const pid = getCurProjectId();
    const docs = loadCanvas(pid);
    const doc = docs.find(d => d.id === id);
    if (!doc){
      $('canvasTitle').value='';
      $('canvasEditor').value='';
      setCurCanvasId(pid,'');
      renderCanvasList();
      refreshCanvasPreview();
      return;
    }
    $('canvasTitle').value = doc.title || '';
    $('canvasEditor').value = doc.content || '';
    setCurCanvasId(pid, doc.id);
    renderCanvasList();
    refreshCanvasPreview();
  }

  function saveCanvasDoc(){
    const pid = getCurProjectId();
    const title = ($('canvasTitle').value||'').trim() || 'مستند';
    const content = $('canvasEditor').value || '';
    let docs = loadCanvas(pid);
    let id = curCanvasId(pid);
    if (!id) id = makeId('doc');
    const now = nowTs();
    const idx = docs.findIndex(d => d.id === id);
    const snap = { ts: now, title, content };
    if (idx >= 0){
      const versions = Array.isArray(docs[idx].versions) ? docs[idx].versions : [];
      versions.unshift(snap);
      docs[idx] = { ...docs[idx], title, content, updatedAt: now, versions: versions.slice(0,20) };
    } else {
      docs.unshift({ id, title, content, createdAt: now, updatedAt: now, versions: [snap] });
    }
    saveCanvas(pid, docs);
    setCurCanvasId(pid, id);
    renderCanvasList();
    toast('✅ تم حفظ المستند');
  }

  function isProbablyHtml(s){
    const t = String(s||'').trim().toLowerCase();
    return t.startsWith('<!doctype') || t.startsWith('<html') || (t.includes('<body') && t.includes('</'));
  }

  function refreshCanvasPreview(){
    const frame = $('canvasPreview');
    const on = !!$('canvasPreviewToggle')?.checked;
    $('previewPanel').style.display = on ? 'flex' : 'none';
    if (!on) return;
    const raw = $('canvasEditor').value || '';
    let html = raw;
    if (!isProbablyHtml(raw)){
      html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>Preview</title></head><body><pre style="white-space:pre-wrap;font-family:system-ui">${escapeHtml(raw)}</pre></body></html>`;
    }
    const blob = new Blob([html], { type:'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    frame.src = url;
    setTimeout(() => { try{ URL.revokeObjectURL(url); }catch(_){ } }, 8000);
  }

  async function canvasAi(action){
    const settings = getSettings();
    if (settings.provider !== 'gemini' && !settings.apiKey) return toast('⚠️ ضع API Key في الإعدادات.');
    const raw = $('canvasEditor').value || '';
    if (!raw.trim()) return;

    let instr = '';
    if (action === 'rewrite') instr = 'أعد صياغة النص ليصبح احترافيًا ومنظمًا.';
    if (action === 'summarize') instr = 'لخص النص في نقاط واضحة.';
    if (action === 'improve') instr = 'حسّن النص وأضف ما ينقصه دون اختلاق حقائق.';
    if (action === 'build_app_html') instr = 'أنشئ تطبيق ويب HTML كامل في ملف واحد (CSS+JS داخل نفس الملف). أعد الناتج HTML فقط دون شرح.';

    const sys = buildSystemPrompt(settings);
    showStatus('جاري تنفيذ كانفس…', true);
    abortCtl?.abort?.();
    abortCtl = new AbortController();

    try{
      let out = '';
      if (settings.provider === 'gemini'){
        const prompt = `${sys}\n\n${instr}\n\nالنص:\n${raw}`;
        out = await callGemini({ apiKey: settings.geminiKey, model: settings.model, prompt, signal: abortCtl.signal, maxOut: Math.min(2048, Number(settings.maxOut||2000)) });
      } else {
        const baseUrl = (effectiveBaseUrl(settings) || (settings.provider === 'openrouter' ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1'));
        const extraHeaders = buildProviderHeaders(settings);
        const messages = [{ role:'system', content: sys }, { role:'user', content: `${instr}\n\n${raw}` }];
        out = await callOpenAIChat({ apiKey: settings.apiKey, baseUrl, model: maybeOnlineModel(settings.model, settings), messages, max_tokens: Math.min(2200, Number(settings.maxOut||2000)), signal: abortCtl.signal, extraHeaders });
      }
      $('canvasEditor').value = out;
      saveCanvasDoc();
      showStatus('', false);
      refreshCanvasPreview();
      toast('✅ تم');
    }catch(e){
      showStatus(`❌ خطأ:\n${e?.message || e}`, false);
    }
  }

  function showCanvasVersions(){
    const pid = getCurProjectId();
    const id = curCanvasId(pid);
    if (!id) return toast('احفظ المستند أولاً.');
    const doc = loadCanvas(pid).find(d => d.id === id);
    const vers = (doc?.versions || []).slice(0, 10);
    if (!vers.length) return toast('لا توجد إصدارات.');
    const pick = prompt('اختر رقم الإصدار لاستعادته:\n' + vers.map((v,i)=>`${i+1}) ${new Date(v.ts).toLocaleString('ar')} — ${v.title}`).join('\n'), '1');
    const n = Number(pick||'');
    if (!n || n<1 || n>vers.length) return;
    const v = vers[n-1];
    $('canvasTitle').value = v.title || '';
    $('canvasEditor').value = v.content || '';
    toast('✅ تم استعادة الإصدار');
    refreshCanvasPreview();
  }

  function exportCanvas(){
    const title = ($('canvasTitle').value || 'canvas').trim() || 'canvas';
    const content = $('canvasEditor').value || '';
    const kind = (prompt('اختر التصدير: txt / html / docx', 'txt') || 'txt').trim().toLowerCase();
    if (kind === 'html'){
      let html = content;
      if (!isProbablyHtml(content)){
        html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body><pre style="white-space:pre-wrap">${escapeHtml(content)}</pre></body></html>`;
      }
      downloadBlob(`${title}.html`, new Blob([html], { type:'text/html;charset=utf-8' }));
      return toast('⬇️ تم تصدير HTML');
    }
    if (kind === 'docx'){
      const fn = window.htmlToDocx || window.HTMLtoDOCX || null;
      if (!fn) return toast('⚠️ DOCX غير متاح');
      const html = `<h1>${escapeHtml(title)}</h1><div>${renderMarkdown(content)}</div>`;
      Promise.resolve(fn(html)).then((blob) => {
        downloadBlob(`${title}.docx`, toDocxBlob(blob));
        toast('⬇️ تم تصدير DOCX');
      }).catch((e)=> toast('DOCX فشل: ' + (e?.message||e)));
      return;
    }
    downloadBlob(`${title}.txt`, new Blob([content], { type:'text/plain;charset=utf-8' }));
    toast('⬇️ تم تصدير TXT');
  }

  // ---------------- Files page ----------------
  function renderFiles(){
    const pid = getCurProjectId();
    const list = $('filesList');
    const files = loadFiles(pid);
    $('filesCount').textContent = String(files.length);
    $('navFilesMeta').textContent = String(files.length);
    list.innerHTML = '';
    files.forEach(f => {
      const div = document.createElement('div');
      div.style.border='1px solid rgba(10,20,60,0.10)';
      div.style.borderRadius='14px';
      div.style.padding='10px';
      div.style.marginBottom='10px';
      div.style.background='#fff';
      const kindIcon = f.kind === 'image' ? '🖼️' : '📄';
      div.innerHTML = `<div style="font-weight:1000">${kindIcon} ${escapeHtml(f.name)}</div>
                       <div class="hint">${escapeHtml(f.kind)} • ${Math.round((f.size||0)/1024)}KB</div>`;
      const row = document.createElement('div');
      row.style.display='flex';
      row.style.gap='8px';
      row.style.flexWrap='wrap';
      row.style.marginTop='10px';

      const btnUse = document.createElement('button');
      btnUse.className='btn ghost sm';
      btnUse.textContent='إضافة للنص';
      btnUse.addEventListener('click', () => {
        const cur = $('filesText').value || '';
        $('filesText').value = (cur ? (cur + '\n\n') : '') + (f.text || `[${f.kind}] ${f.name}`);
        toast('✅ أُضيف');
      });

      const btnCopy = document.createElement('button');
      btnCopy.className='btn ghost sm';
      btnCopy.textContent='نسخ';
      btnCopy.addEventListener('click', async () => {
        const ok = await copyToClipboard(f.text || f.name);
        toast(ok ? '✅ تم النسخ' : '⚠️ تعذر النسخ');
      });

      const btnDel = document.createElement('button');
      btnDel.className='btn danger sm';
      btnDel.textContent='حذف';
      btnDel.addEventListener('click', () => {
        saveFiles(pid, loadFiles(pid).filter(x => x.id !== f.id));
        renderFiles();
        updateChips();
        refreshNavMeta();
      });

      row.appendChild(btnUse);
      row.appendChild(btnCopy);
      row.appendChild(btnDel);
      div.appendChild(row);
      list.appendChild(div);
    });
    updateChips();
  }

  async function addFiles(fileList){
    const pid = getCurProjectId();
    const arr = loadFiles(pid);
    for (const file of Array.from(fileList || [])){
      const id = makeId('f');
      const name = file.name || 'file';
      const kind = (file.type || '').startsWith('image/') ? 'image' : 'file';
      let dataUrl = '';
      if (kind === 'image'){
        try{ dataUrl = await fileToDataUrl(file); }catch(_){}
      }
      let text = '';
      try{ text = await fileToText(file); }catch(_){}
      arr.unshift({ id, name, kind, size: file.size || 0, type: file.type || '', dataUrl, text });
    }
    saveFiles(pid, arr.slice(0, 80));
    renderFiles();
    refreshNavMeta();
    toast('✅ تم إضافة الملفات');
  }

  // ---------------- Downloads page ----------------
  
  function renderWorkflows(){
    const box = $('workflowsList');
    if (!box) return;
    box.innerHTML = '';

    const card = (title, desc, buttons=[]) => {
      const wrap = document.createElement('div');
      wrap.className = 'bubble';
      wrap.innerHTML = '<div style="font-weight:1000">'+escapeHtml(title)+'</div>'
        + '<div class="hint" style="margin-top:6px">'+escapeHtml(desc)+'</div>';
      const actions = document.createElement('div');
      actions.className = 'actions';
      for (const b of buttons){
        const btn = document.createElement('button');
        btn.className = b.kind || 'btn ghost sm';
        btn.textContent = b.label;
        btn.addEventListener('click', b.onClick);
        actions.appendChild(btn);
      }
      wrap.appendChild(actions);
      box.appendChild(wrap);
    };

    card('🧪 Research (3 steps)', 'خطة → ملاحظات (Web/KB) → تقرير + ملف تنزيل.', [
      {label:'تشغيل', kind:'btn sm', onClick: runResearchAgent},
      {label:'إدراج برومبت', kind:'btn ghost sm', onClick: () => {
        $('chatInput').value =
          'نفّذ بحثًا تفصيليًا حول: (اكتب موضوعك)\\n\\n'
          + 'المطلوب: خطة → بحث → تقرير نهائي + ملف Markdown باستخدام قالب ```file```.';
        setActiveNav('chat'); $('chatInput').focus(); toast('✅ تم');
      }},
    ]);

    card('📚 تلخيص الملفات (RAG)', 'تلخيص منظم اعتمادًا على KB عند تفعيل RAG.', [
      {label:'إدراج', kind:'btn ghost sm', onClick: () => {
        $('chatInput').value =
          'لخّص محتوى قاعدة المعرفة/الملفات المتاحة بوضوح:\\n'
          + '- ملخص تنفيذي\\n- نقاط رئيسية\\n- تفاصيل مهمّة مع اقتباسات [KB:..]\\n- توصيات/خطوات\\n\\n'
          + 'أنشئ ملف:\\n```file name="kb_summary.md" mime="text/markdown"\\n(ضع الملخص)\\n```\\n';
        setActiveNav('chat'); $('chatInput').focus(); toast('✅ تم');
      }},
      {label:'تشغيل', kind:'btn sm', onClick: () => {
        setRagToggle(true); $('ragToggle').checked = true;
        $('chatInput').value = 'لخّص محتوى قاعدة المعرفة/الملفات المتاحة بوضوح مع اقتباسات [KB:..]، وأنشئ ملف kb_summary.md.';
        setActiveNav('chat'); sendMessage();
      }},
    ]);

    card('🧩 بناء تطبيق HTML من كانفس', 'استخدم محتوى كانفس لإنشاء تطبيق HTML كامل (ملف واحد).', [
      {label:'تشغيل على كانفس', kind:'btn sm', onClick: () => { setActiveNav('canvas'); canvasAi('build_app_html'); }},
      {label:'فتح كانفس', kind:'btn ghost sm', onClick: () => setActiveNav('canvas')},
    ]);

    card('📌 Action Items', 'استخراج مهام من آخر محادثة: المهمة + المالك + الموعد + الأولوية + الحالة.', [
      {label:'إدراج', kind:'btn ghost sm', onClick: () => {
        $('chatInput').value =
          'استخرج من المحادثة مهامًا تنفيذية بصيغة جدول:\\n'
          + '- المهمة\\n- المالك\\n- الموعد\\n- الأولوية\\n- الحالة\\n\\n'
          + 'وأنشئ ملف:\\n```file name="action_items.md" mime="text/markdown"\\n...\\n```\\n';
        setActiveNav('chat'); $('chatInput').focus();
      }},
      {label:'تشغيل', kind:'btn sm', onClick: () => { setActiveNav('chat'); sendMessage(); }},
    ]);

    $('navWorkMeta') && ($('navWorkMeta').textContent = '4');
  }




  // ---------------- Workflows Builder (v6) ----------------
  function wfLog(line){
    const el = $('workflowLog');
    if (!el) return;
    el.textContent = (el.textContent ? el.textContent + "\n" : "") + String(line||'');
    el.scrollTop = el.scrollHeight;
  }
  function wfClear(){
    const el = $('workflowLog'); if (el) el.textContent = '';
  }
  function getWorkflowTemplate(id){
    const templates = {
      research: [
        { step:'research', note:'Research report (multi-step)'}
      ],
      ocr_index: [
        { step:'ocr_images', note:'OCR all images in Files'},
        { step:'kb_index', note:'Re-index Knowledge Base'}
      ],
      kb_summary: [
        { step:'chat', prompt:'لخّص قاعدة المعرفة الحالية بوضوح مع اقتباسات [KB:...] وأنشئ ملف kb_summary.md باستخدام قالب ```file```.'}
      ],
      action_items: [
        { step:'chat', prompt:'استخرج Action Items من المحادثة بصيغة جدول وأنشئ ملف action_items.md باستخدام قالب ```file```.'}
      ],
      canvas_app: [
        { step:'canvas_build', note:'Canvas → Build HTML App'}
      ]
    };
    return templates[id] || templates.research;
  }

  function workflowLoadSelected(){
    const sel = $('workflowTemplate');
    const ed = $('workflowEditor');
    if (!sel || !ed) return;
    ed.value = JSON.stringify(getWorkflowTemplate(sel.value), null, 2);
    toast('✅ تم تحميل القالب');
  }

  async function ocrAllImages(){
    const pid = getCurProjectId();
    const files = loadFiles(pid);
    const imgs = files.filter(f => f.kind === 'image' && f.dataUrl);
    if (!imgs.length) { wfLog('لا توجد صور.'); return; }
    if (!window.Tesseract) { wfLog('Tesseract غير متاح.'); return; }
    for (let i=0;i<imgs.length;i++){
      const f = imgs[i];
      wfLog(`OCR: ${f.name} (${i+1}/${imgs.length})`);
      try{
        const res = await window.Tesseract.recognize(f.dataUrl, 'ara+eng');
        f.text = String(res?.data?.text || '').trim();
      }catch(e){
        wfLog(`❌ OCR failed: ${e?.message||e}`);
      }
      saveFiles(pid, files);
    }
    wfLog('✅ اكتمل OCR للصور');
    await renderFiles();
  }

  async function runWorkflowSelected(){
    const sel = $('workflowTemplate');
    const ed = $('workflowEditor');
    const id = sel ? sel.value : 'research';
    wfClear();
    wfLog('▶ تشغيل Workflow: ' + id);

    let steps = [];
    try{
      if (ed && ed.value.trim()){
        steps = JSON.parse(ed.value.trim());
      }else{
        steps = getWorkflowTemplate(id);
      }
    }catch(e){
      steps = getWorkflowTemplate(id);
      wfLog('⚠️ تعذر قراءة JSON — استخدمت القالب الافتراضي.');
    }

    for (let i=0;i<steps.length;i++){
      const st = steps[i] || {};
      wfLog(`\nStep ${i+1}: ${st.step || 'unknown'}`);
      if (st.step === 'research'){
        wfLog('… فتح Research');
        await runResearchAgent();
      } else if (st.step === 'ocr_images'){
        await ocrAllImages();
      } else if (st.step === 'kb_index'){
        wfLog('… إعادة فهرسة KB');
        await buildKb();
        wfLog('✅ KB Indexed');
      } else if (st.step === 'chat'){
        const prompt = String(st.prompt || '').trim();
        if (!prompt){ wfLog('⚠️ لا يوجد prompt'); continue; }
        // push prompt to chat and send
        $('chatInput').value = prompt;
        setActiveNav('chat');
        await sendMessage();
      } else if (st.step === 'canvas_build'){
        wfLog('… Canvas build_app_html');
        setActiveNav('canvas');
        canvasAi('build_app_html');
      } else {
        wfLog('⚠️ خطوة غير معروفة: ' + st.step);
      }
    }
    wfLog('\n✅ انتهى Workflow');
    toast('✅ Workflow done');
  }

let pinOnly = false;
  function renderDownloads(){
    const box = $('downloadsList');
    const dl = loadDownloads();
    $('navDlMeta').textContent = String(dl.length);
    const q = String($('dlSearch')?.value || '').trim().toLowerCase();
    const filtered = dl.filter(d => {
      if (pinOnly && !d.pinned) return false;
      if (!q) return true;
      return (String(d.name||'').toLowerCase().includes(q) || String(d.mime||'').toLowerCase().includes(q));
    });
    box.innerHTML = '';
    filtered.forEach(d => {
      const row = document.createElement('div');
      row.className='bubble';
      row.innerHTML = `<div style="font-weight:1000">${escapeHtml(d.pinned?'📌 ':'')}${escapeHtml(d.name)}</div>
                       <div class="hint">${escapeHtml(d.mime)} • ${new Date(d.createdAt||nowTs()).toLocaleString('ar')}</div>`;
      const actions = document.createElement('div');
      actions.className='actions';

      const b1 = document.createElement('button');
      b1.className='btn sm';
      b1.textContent='تنزيل';
      b1.addEventListener('click', () => {
        if (d.encoding === 'base64'){
          const bin = atob(d.content || '');
          const bytes = new Uint8Array(bin.length);
          for (let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
          downloadBlob(d.name, new Blob([bytes], { type: d.mime }));
        } else {
          downloadBlob(d.name, new Blob([String(d.content||'')], { type: d.mime + ';charset=utf-8' }));
        }
      });

      const b2 = document.createElement('button');
      b2.className='btn ghost sm';
      b2.textContent = d.pinned ? 'إلغاء تثبيت' : 'تثبيت';
      b2.addEventListener('click', () => {
        const arr = loadDownloads();
        const it = arr.find(x => x.id === d.id);
        if (it) it.pinned = !it.pinned;
        saveDownloads(arr);
        renderDownloads();
      });

      const b3 = document.createElement('button');
      b3.className='btn ghost sm';
      b3.textContent='إعادة تسمية';
      b3.addEventListener('click', () => {
        const name = prompt('اسم جديد:', d.name);
        if (!name) return;
        const arr = loadDownloads();
        const it = arr.find(x => x.id === d.id);
        if (it) it.name = name;
        saveDownloads(arr);
        renderDownloads();
      });

      const b4 = document.createElement('button');
      b4.className='btn danger sm';
      b4.textContent='حذف';
      b4.addEventListener('click', () => {
        saveDownloads(loadDownloads().filter(x => x.id !== d.id));
        renderDownloads();
        refreshNavMeta();
      });

      actions.appendChild(b1);
      actions.appendChild(b2);
      actions.appendChild(b3);
      actions.appendChild(b4);
      row.appendChild(actions);
      box.appendChild(row);
    });
  }

  // ---------------- Projects page ----------------
  function renderProjects(){
    const box = $('projectsList');
    const projects = loadProjects();
    const cur = getCurProjectId();
    $('navProjMeta').textContent = String(projects.length);
    box.innerHTML = '';
    projects.forEach(p => {
      const row = document.createElement('div');
      row.className = 'bubble ' + (p.id === cur ? 'user' : 'assistant');
      row.innerHTML = `<div style="font-weight:1000">${escapeHtml(p.name)}</div>
                       <div class="hint">ID: ${escapeHtml(p.id)} • تحديث: ${new Date(p.updatedAt||nowTs()).toLocaleDateString('ar')}</div>`;
      const actions = document.createElement('div');
      actions.className='actions';
      const btn = document.createElement('button');
      btn.className='btn ghost sm';
      btn.textContent='فتح';
      btn.addEventListener('click', () => {
        setCurProjectId(p.id);
        $('curProjectName').textContent = p.name;
        loadThreads(p.id);
        renderCanvasList();
        renderFiles();
        renderProjectBrief();
        renderChat();
        refreshNavMeta();
        toast('✅ تم فتح المشروع');
      });
      actions.appendChild(btn);
      row.appendChild(actions);
      box.appendChild(row);
    });
  }

  function newProject(){
    const name = prompt('اسم المشروع:', 'مشروع جديد');
    if (!name) return;
    const arr = loadProjects();
    const p = { id: makeId('proj'), name, createdAt: nowTs(), updatedAt: nowTs() };
    arr.unshift(p);
    saveProjects(arr);
    setCurProjectId(p.id);
    localStorage.setItem(KEYS.curThread(p.id), '');
    loadThreads(p.id);
    saveFiles(p.id, []);
    saveCanvas(p.id, []);
    $('curProjectName').textContent = p.name;
    renderProjectBrief();
    renderProjects(); renderFiles(); renderCanvasList(); renderChat(); refreshNavMeta();
  }

  function renameProject(){
    const cur = getCurProject();
    if (cur.id === 'default') return toast('لا يمكن إعادة تسمية الافتراضي.');
    const name = prompt('الاسم الجديد:', cur.name);
    if (!name) return;
    const arr = loadProjects();
    const idx = arr.findIndex(x => x.id === cur.id);
    arr[idx] = { ...arr[idx], name, updatedAt: nowTs() };
    saveProjects(arr);
    $('curProjectName').textContent = name;
    renderProjects();
    toast('✅ تم');
  }

  function deleteProject(){
    const cur = getCurProject();
    if (cur.id === 'default') return toast('لا يمكن حذف الافتراضي.');
    if (!confirm('حذف المشروع؟')) return;
    saveProjects(loadProjects().filter(x => x.id !== cur.id));
    try{ localStorage.removeItem(KEYS.threads(cur.id)); }catch(_){}
    try{ localStorage.removeItem(KEYS.files(cur.id)); }catch(_){}
    try{ localStorage.removeItem(KEYS.canvas(cur.id)); }catch(_){}
    try{ localStorage.removeItem(KEYS.curThread(cur.id)); }catch(_){}
    try{ localStorage.removeItem(`aistudio_canvas_cur_${cur.id}_v3`); }catch(_){}
    setCurProjectId('default');
    $('curProjectName').textContent='افتراضي';
    loadThreads('default');
    renderProjectBrief();
    renderProjects(); renderFiles(); renderCanvasList(); renderChat(); refreshNavMeta();
    toast('✅ تم حذف المشروع');
  }

  // ---------------- Settings ----------------
  function renderSettings(){
    const s = getSettings();

    $('provider').value = s.provider;
    // show effective baseUrl (gateway overrides)
    $('baseUrl').value = effectiveBaseUrl(s) || s.baseUrl || '';
    $('model').value = s.model;

    $('apiKey').value = s.apiKey || '';
    $('geminiKey').value = s.geminiKey || '';
    $('systemPrompt').value = s.systemPrompt || '';

    $('maxOut').value = String(s.maxOut || 2000);
    $('fileClip').value = String(s.fileClip || 12000);
    $('webMode').value = s.webMode || 'off';

    $('orReferer').value = s.orReferer || '';
    $('orTitle').value = s.orTitle || 'AI Workspace Studio';

    // v6 secure gateway + tools
    if ($('authMode')) $('authMode').value = s.authMode || 'browser';
    if ($('gatewayUrl')) $('gatewayUrl').value = s.gatewayUrl || '';
    if ($('gatewayToken')) $('gatewayToken').value = s.gatewayToken || '';
    if ($('cloudConvertEndpoint')) $('cloudConvertEndpoint').value = s.cloudConvertEndpoint || '';
    if ($('cloudConvertFallbackEndpoint')) $('cloudConvertFallbackEndpoint').value = s.cloudConvertFallbackEndpoint || '';
    if ($('ocrCloudEndpoint')) $('ocrCloudEndpoint').value = s.ocrCloudEndpoint || '';
    if ($('ocrLang')) $('ocrLang').value = s.ocrLang || 'ara+eng';
    if ($('toolsDefault')) $('toolsDefault').checked = !!s.toolsEnabled;
    if ($('toolsToggle')) $('toolsToggle').checked = !!s.toolsEnabled;

    $('streamDefault').checked = !!s.streaming;
    $('streamToggle').checked = !!s.streaming;

    // keep RAG toggle persisted
    setRagToggle(!!s.rag);
    $('ragToggle').checked = !!s.rag;

    refreshModeButtons();
    refreshStrategicWorkspace().catch(()=>{});
  }

  function saveSettingsFromUI(){
    const authMode = $('authMode') ? $('authMode').value : 'browser';
    const gatewayUrl = $('gatewayUrl') ? normalizeEndpointUrl($('gatewayUrl').value) : '';
    const gatewayToken = $('gatewayToken') ? $('gatewayToken').value.trim() : '';
    const cloudConvertEndpoint = $('cloudConvertEndpoint') ? normalizeEndpointUrl($('cloudConvertEndpoint').value) : '';
    const cloudConvertFallbackEndpoint = $('cloudConvertFallbackEndpoint') ? normalizeEndpointUrl($('cloudConvertFallbackEndpoint').value) : '';
    const ocrCloudEndpoint = $('ocrCloudEndpoint') ? normalizeEndpointUrl($('ocrCloudEndpoint').value) : '';
    const ocrLang = $('ocrLang') ? $('ocrLang').value.trim() : 'ara+eng';
    const toolsEnabled = $('toolsDefault') ? !!$('toolsDefault').checked : (!!$('toolsToggle')?.checked);

    // if gateway is enabled and url provided, we force baseUrl to gateway/v1
    let baseUrl = $('baseUrl').value.trim();
    if (authMode === 'gateway' && gatewayUrl){
      const resolvedGatewayBase = normalizeUrl(resolveGatewayApiRoot({
        gatewayUrl,
        cloudConvertEndpoint,
        cloudConvertFallbackEndpoint,
        ocrCloudEndpoint
      }));
      baseUrl = resolvedGatewayBase + '/v1';
      $('baseUrl').value = baseUrl;
      if (resolvedGatewayBase !== normalizeUrl(gatewayUrl)){
        toast('ℹ️ تم اكتشاف Gateway ثابت؛ تم استخدام Cloud API worker تلقائيًا.');
      }
      if ($('provider').value === 'openrouter'){
        // ok
      }
    }

    const s = setSettings({
      provider: $('provider').value,
      baseUrl,
      model: $('model').value.trim(),

      apiKey: $('apiKey').value.trim(),
      geminiKey: $('geminiKey').value.trim(),
      systemPrompt: $('systemPrompt').value,

      maxOut: Number($('maxOut').value || 2000),
      webMode: $('webMode').value,
      fileClip: Number($('fileClip').value || 12000),

      streaming: !!$('streamDefault').checked,
      rag: !!$('ragToggle').checked,

      toolsEnabled,

      authMode,
      gatewayUrl,
      gatewayToken,
      cloudConvertEndpoint,
      cloudConvertFallbackEndpoint,
      ocrCloudEndpoint,
      ocrLang: ocrLang || 'ara+eng',

      orReferer: $('orReferer').value.trim(),
      orTitle: $('orTitle').value.trim()
    });

    // sync toggles
    $('streamToggle').checked = !!s.streaming;
    setRagToggle(!!s.rag);
    $('ragToggle').checked = !!s.rag;
    if ($('toolsToggle')) $('toolsToggle').checked = !!s.toolsEnabled;

    toast('✅ تم حفظ الإعدادات');
    refreshModeButtons();
    refreshStrategicWorkspace().catch(()=>{});
    return s;
  }

  // ---------------- Navigation ----------------
  function setActiveNav(page){
    document.querySelectorAll('.navbtn').forEach(b => b.classList.toggle('active', b.dataset.page === page));
    document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === `page-${page}`));
    const titles = { chat:'الدردشة', knowledge:'المعرفة (KB)', canvas:'كانفس', files:'الملفات', transcription:'التفريغ النصي', workflows:'Workflows', downloads:'التحميلات', projects:'المشاريع', settings:'الإعدادات' };
    $('topTitle').textContent = titles[page] || 'AI Studio';
    refreshStrategicWorkspace().catch(()=>{});
  }

  function refreshNavMeta(){
    const pid = getCurProjectId();
    const th = getCurThread();
    $('navChatMeta').textContent = String((th.messages||[]).length);
    $('navCanvasMeta').textContent = String(loadCanvas(pid).length);
    $('navFilesMeta').textContent = String(loadFiles(pid).length);
    $('navTransMeta') && ($('navTransMeta').textContent = 'PDF');
    $('navDlMeta').textContent = String(loadDownloads().length);
    $('navProjMeta').textContent = String(loadProjects().length);
    $('navWorkMeta') && ($('navWorkMeta').textContent = '4');
    $('navSetMeta').textContent = 'OK';
    refreshStrategicWorkspace().catch(()=>{});
  }

  // ---------------- Model Hub (OpenRouter) ----------------
  function loadFavs(){ const a = loadJSON(KEYS.favorites, []); return Array.isArray(a) ? a : []; }
  function saveFavs(a){ saveJSON(KEYS.favorites, a); }

  function normalizeOrModels(payload){
    const data = payload?.data || payload?.models || payload || [];
    const arr = Array.isArray(data) ? data : [];
    return arr.map(m => {
      const id = m.id || m.model || '';
      const name = m.name || id;
      const ctx = m.context_length || m.contextLength || m.top_provider?.context_length || null;
      const pricing = m.pricing || {};
      const pp = pricing.prompt ?? pricing.input ?? null;
      const pc = pricing.completion ?? pricing.output ?? null;
      const arch = m.architecture || {};
      const modality = arch.modality || arch.input_modality || '';
      const tools = !!m.supports_tools || !!m.tools;
      const vision = (String(modality).toLowerCase().includes('image') || String(modality).toLowerCase().includes('multimodal') || !!m.vision);
      const provider = String(id).split('/')[0] || '';
      return { id, name, provider, ctx, pp, pc, tools, vision };
    }).filter(x => x.id);
  }

  async function fetchOpenRouterModels(force=false){
    const cache = loadJSON(KEYS.modelCache, null);
    const freshMs = 1000 * 60 * 60 * 12;
    if (!force && cache?.ts && (nowTs() - cache.ts) < freshMs && Array.isArray(cache.models) && cache.models.length){
      return cache.models;
    }
    const s = getSettings();
    if (!hasAuthReady(s)) throw new Error('المصادقة غير مكتملة (API Key أو Gateway URL)');
    const headers = { 'Content-Type':'application/json', ...buildAuthHeaders(s) };
    Object.assign(headers, buildProviderHeaders(s));

    const candidates = [];
    if (s.authMode === 'gateway'){
      const roots = [
        normalizeUrl(resolveGatewayApiRoot(s)),
        normalizeUrl(normalizeEndpointUrl(s.gatewayUrl || '')),
        normalizeUrl(normalizeEndpointUrl(s.baseUrl || '').replace(/\/v1$/i, ''))
      ].filter(Boolean);
      for (const root of roots){
        candidates.push(`${root}/v1/models`);
        candidates.push(`${root}/models`);
      }
    } else {
      const base = (effectiveBaseUrl(s) || 'https://openrouter.ai/api/v1').replace(/\/+$/,'');
      candidates.push(base + '/models');
    }

    const urls = [...new Set(candidates.map(normalizeEndpointUrl).filter(Boolean))];
    const errs = [];
    for (const url of urls){
      try{
        const r = await fetch(url, { headers });
        const t = await r.text();
        let j; try{ j = JSON.parse(t);}catch(_){ j = null; }
        if (!r.ok){
          errs.push(`${url} -> ${j?.error?.message || t || `HTTP ${r.status}`}`);
          continue;
        }
        const models = normalizeOrModels(j);
        if (models.length){
          saveJSON(KEYS.modelCache, { ts: nowTs(), models });
          return models;
        }
        errs.push(`${url} -> Empty models response`);
      }catch(e){
        errs.push(`${url} -> ${e?.message || e}`);
      }
    }
    throw new Error(errs.join('\n') || 'فشل تحميل قائمة الموديلات');
  }

  function openModelModal(open){
    const m = $('modelModal');
    m.classList.toggle('show', !!open);
    m.setAttribute('aria-hidden', open ? 'false' : 'true');
  }

  async function renderModelHub(){
    const models = await fetchOpenRouterModels(false).catch(()=>[]);
    const list = $('modelList');
    const q = String($('modelSearch')?.value || '').trim().toLowerCase();
    const providerFilter = String($('modelProviderFilter')?.value || '');
    const sort = String($('modelSort')?.value || 'name');
    const favOnly = ($('modelFavOnlyBtn')?.dataset.on === '1');
    const favs = new Set(loadFavs());

    let filtered = models.slice();
    if (q) filtered = filtered.filter(m => (m.id.toLowerCase().includes(q) || (m.name||'').toLowerCase().includes(q)));
    if (providerFilter) filtered = filtered.filter(m => m.provider === providerFilter);
    if (favOnly) filtered = filtered.filter(m => favs.has(m.id));

    const num = (x) => (x==null ? Number.POSITIVE_INFINITY : Number(x));
    if (sort === 'context_desc') filtered.sort((a,b)=> num(b.ctx)-num(a.ctx));
    else if (sort === 'price_prompt_asc') filtered.sort((a,b)=> num(a.pp)-num(b.pp));
    else if (sort === 'price_completion_asc') filtered.sort((a,b)=> num(a.pc)-num(b.pc));
    else filtered.sort((a,b)=> String(a.id).localeCompare(String(b.id)));

    list.innerHTML = '';
    filtered.slice(0, 400).forEach(m => {
      const row = document.createElement('div');
      row.className = 'bubble';
      const badges = [];
      if (m.ctx) badges.push(`<span class="tag">ctx ${escapeHtml(m.ctx)}</span>`);
      if (m.vision) badges.push(`<span class="tag">vision</span>`);
      if (m.tools) badges.push(`<span class="tag">tools</span>`);
      const prices = [];
      if (m.pp!=null) prices.push(`prompt: ${m.pp}`);
      if (m.pc!=null) prices.push(`completion: ${m.pc}`);

      row.innerHTML = `
        <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start;">
          <div style="min-width:0; flex:1;">
            <div style="font-weight:1000; word-break:break-word">${escapeHtml(m.id)}</div>
            <div class="hint">${escapeHtml(m.name || '')}</div>
            <div style="margin-top:6px; display:flex; gap:8px; flex-wrap:wrap;">${badges.join('')}</div>
            <div class="hint" style="margin-top:6px">${escapeHtml(prices.join(' • '))}</div>
          </div>
          <div style="display:flex; flex-direction:column; gap:8px; align-items:flex-end;">
            <button class="btn ghost sm" type="button">${favs.has(m.id) ? '⭐' : '☆'}</button>
            <button class="btn sm" type="button">اختيار</button>
          </div>
        </div>`;
      const starBtn = row.querySelectorAll('button')[0];
      const pickBtn = row.querySelectorAll('button')[1];

      starBtn.addEventListener('click', () => {
        const arr = loadFavs();
        const has = arr.includes(m.id);
        const next = has ? arr.filter(x=>x!==m.id) : [m.id, ...arr];
        saveFavs(next.slice(0,60));
        renderModelHub();
      });

      pickBtn.addEventListener('click', () => {
        $('model').value = m.id;
        saveSettingsFromUI();
        openModelModal(false);
        toast('✅ تم اختيار الموديل');
      });

      list.appendChild(row);
    });

    // provider dropdown
    const provSel = $('modelProviderFilter');
    if (provSel && provSel.options.length <= 1 && models.length){
      const providers = Array.from(new Set(models.map(x => x.provider).filter(Boolean))).sort();
      for (const p of providers){
        const o = document.createElement('option');
        o.value = p; o.textContent = p;
        provSel.appendChild(o);
      }
    }
  }

  async function openModelHub(){
    try{
      showStatus('جاري تحميل الموديلات…', true);
      await fetchOpenRouterModels(false);
      showStatus('', false);
      openModelModal(true);
      await renderModelHub();
    }catch(e){
      showStatus(`❌ فشل تحميل الموديلات:\n${e?.message || e}`, false);
      openModelModal(true);
      $('modelList').innerHTML = `<div class="hint">تعذر تحميل الموديلات. تأكد من Base URL و API Key. وإذا كنت تستخدم Gateway اجعل Gateway URL بدون <span class="kbd">/v1</span>.</div>`;
    }
  }

  async function refreshModelHub(force=true){
    try{
      showStatus('تحديث موديلات OpenRouter…', true);
      await fetchOpenRouterModels(force);
      showStatus('', false);
      toast('✅ تم تحديث القائمة');
      if ($('modelModal').classList.contains('show')) await renderModelHub();
    }catch(e){
      showStatus(`❌ تحديث الموديلات فشل:\n${e?.message || e}`, false);
    }
  }

  function clearModelsCache(){
    try{ localStorage.removeItem(KEYS.modelCache); }catch(_){}
    toast('✅ تم مسح كاش الموديلات');
  }

  // ---------------- Events ----------------
  function bind(){
    // sidebar mobile
    const side = $('side');
    const back = $('backdrop');
    const openSide = () => {
      if (window.innerWidth > 980 && getSidebarPinned()) return;
      side.classList.add('show');
      back.classList.add('show');
    };
    const closeSide = () => {
      side.classList.remove('show');
      back.classList.remove('show');
    };
    $('openSideBtn').addEventListener('click', openSide);
    $('closeSideBtn').addEventListener('click', closeSide);
    back.addEventListener('click', closeSide);

    // nav
    $('nav').addEventListener('click', (e) => {
      const btn = e.target.closest('.navbtn');
      if (!btn) return;
      setActiveNav(btn.dataset.page);
      closeSide();
      if (btn.dataset.page === 'downloads') renderDownloads();
      if (btn.dataset.page === 'workflows') renderWorkflows();
      if (btn.dataset.page === 'projects') renderProjects();
      if (btn.dataset.page === 'settings') renderSettings();
    setupCollapsibleToolbars();
    applyUiCollapse();
    applyToolbarCollapses();
    applyShellLayout();
    // Default collapse on mobile (first run)
    try{
      if (window.innerWidth < 980){
        if (localStorage.getItem(KEYS.chatToolbarCollapsed) === null) setChatToolbarCollapsed(true);
        if (localStorage.getItem(KEYS.headerCollapsed) === null) setHeaderCollapsed(false);
        applyUiCollapse();
    applyToolbarCollapses();
      }
    }catch(_){ }

      if (btn.dataset.page === 'files') renderFiles();
      if (btn.dataset.page === 'canvas') { renderCanvasList(); refreshCanvasPreview(); }
      if (btn.dataset.page === 'chat') { renderChat(); updateChips(); }
    });

    // modes
    $('modeDeepBtn').addEventListener('click', () => { setDeep(!isDeep()); refreshModeButtons(); toast(isDeep() ? '🧠 مفعّل' : '🧠 متوقف'); });
    $('modeAgentBtn').addEventListener('click', () => { setAgent(!isAgent()); refreshModeButtons(); toast(isAgent() ? '🤖 مفعّل' : '🤖 متوقف'); });
    $('modeOffBtn').addEventListener('click', disableModes);

// v5: Collapse UI
$('headerCollapseBtn')?.addEventListener('click', () => {
  setHeaderCollapsed(!getHeaderCollapsed());
  applyUiCollapse();
    // Default collapse on mobile (first run)
    try{
      if (window.innerWidth < 980){
        if (localStorage.getItem(KEYS.chatToolbarCollapsed) === null) setChatToolbarCollapsed(true);
        if (localStorage.getItem(KEYS.headerCollapsed) === null) setHeaderCollapsed(false);
        applyUiCollapse();
    applyToolbarCollapses();
      }
    }catch(_){ }

  toast(getHeaderCollapsed() ? '✅ تم طي الشريط العلوي' : '✅ تم إظهار الشريط العلوي');
});

$('chatToolbarCollapseBtn')?.addEventListener('click', () => {
  setChatToolbarCollapsed(true);
  applyUiCollapse();
    // Default collapse on mobile (first run)
    try{
      if (window.innerWidth < 980){
        if (localStorage.getItem(KEYS.chatToolbarCollapsed) === null) setChatToolbarCollapsed(true);
        if (localStorage.getItem(KEYS.headerCollapsed) === null) setHeaderCollapsed(false);
        applyUiCollapse();
    applyToolbarCollapses();
      }
    }catch(_){ }

  toast('✅ تم طي أدوات الدردشة');
});

$('chatToolbarExpandBtn')?.addEventListener('click', () => {
  setChatToolbarCollapsed(false);
  applyUiCollapse();
    // Default collapse on mobile (first run)
    try{
      if (window.innerWidth < 980){
        if (localStorage.getItem(KEYS.chatToolbarCollapsed) === null) setChatToolbarCollapsed(true);
        if (localStorage.getItem(KEYS.headerCollapsed) === null) setHeaderCollapsed(false);
        applyUiCollapse();
    applyToolbarCollapses();
      }
    }catch(_){ }

  toast('✅ تم إظهار أدوات الدردشة');
});


    $('webToggleBtn').addEventListener('click', () => { setWebToggle(!getWebToggle()); refreshModeButtons(); toast(getWebToggle() ? '🔎 Web ON' : '🔎 Web OFF'); });

    $('newThreadBtn').addEventListener('click', () => { newThread(); setActiveNav('chat'); });

    document.addEventListener('click', (e) => {
      const quick = e.target.closest('[data-quick-prompt]');
      if (!quick) return;
      applyQuickPrompt(quick.dataset.quickPrompt || '');
    });

    document.addEventListener('click', (e) => {
      const toggle = e.target.closest('.workspace-section-toggle');
      if (!toggle) return;
      const group = toggle.closest('.tool-group[data-section-id]');
      if (!group) return;
      const id = group.dataset.sectionId;
      setWorkspaceSectionCollapsed(id, !isWorkspaceSectionCollapsed(id));
      applyWorkspaceSectionCollapses();
    });

    // chat
    
    // Chat attachments (inline)
    $('chatAttachBtn') && $('chatAttachBtn').addEventListener('click', () => $('chatAttachFiles')?.click());
    $('chatAttachFiles') && $('chatAttachFiles').addEventListener('change', (e) => addChatAttachments(e.target.files));

    // New/Clear chat shortcuts in toolbar
    $('newChatBtn') && $('newChatBtn').addEventListener('click', () => { newThread(); setActiveNav('chat'); });
    $('clearChatBtn') && $('clearChatBtn').addEventListener('click', clearCurrentChat);
    $('agentTaskApplyBtn') && $('agentTaskApplyBtn').addEventListener('click', applyAgentTaskTemplate);
    $('agentTaskTemplate') && $('agentTaskTemplate').addEventListener('change', applyAgentTaskTemplate);
    $('scrollTopBtn') && $('scrollTopBtn').addEventListener('click', () => scrollChat('top'));
    $('scrollBottomBtn') && $('scrollBottomBtn').addEventListener('click', () => scrollChat('bottom'));

    // Deep Search toggle (send = Research)
    $('deepSearchToggleBtn') && $('deepSearchToggleBtn').addEventListener('click', () => {
      setDeepSearch(!isDeepSearch());
      refreshDeepSearchBtn();
      toast(isDeepSearch() ? '🔬 Deep Search ON' : '🔬 Deep Search OFF');
    });

    $('focusModeBtn')?.addEventListener('click', () => {
      setFocusMode(!getFocusMode());
      applyShellLayout();
      refreshStrategicWorkspace().catch(()=>{});
    });
    $('pinSideBtn')?.addEventListener('click', () => {
      setSidebarPinned(!getSidebarPinned());
      applyShellLayout();
    });
    ['briefGoal','briefAudience','briefDeliverable','briefConstraints','briefStyle'].forEach((id) => {
      const el = $(id);
      if (!el) return;
      el.addEventListener('input', saveProjectBriefFromUI);
      el.addEventListener('change', saveProjectBriefFromUI);
    });
    $('briefApplyBtn')?.addEventListener('click', applyProjectBriefToComposer);
    $('briefClearBtn')?.addEventListener('click', clearProjectBrief);

$('sendBtn').addEventListener('click', sendMessage);
    $('stopBtn').addEventListener('click', stopGeneration);
    $('regenBtn').addEventListener('click', regenLast);
    $('chatInput').addEventListener('input', () => {
      syncComposerMeta();
    });
    window.addEventListener('resize', () => {
      resizeComposerInput();
      applyShellLayout();
      refreshStrategicWorkspace().catch(()=>{});
    });
    $('chatInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey){
        e.preventDefault();
        sendMessage();
      }
    });

    // templates
    $('promptSelect').addEventListener('change', (e) => applyPromptTemplate(e.target.value));

    // streaming toggle
    $('streamToggle').addEventListener('change', (e) => {
      const s = setSettings({ streaming: !!e.target.checked });
      $('streamDefault').checked = !!s.streaming;
      toast(s.streaming ? 'Streaming ON' : 'Streaming OFF');
    });

    $('ragToggle') && $('ragToggle').addEventListener('change', (e) => {
      setRagToggle(!!e.target.checked);
      toast(e.target.checked ? 'RAG ON' : 'RAG OFF');
    });


    $('toolsToggle') && $('toolsToggle').addEventListener('change', (e) => {
      const s = setSettings({ toolsEnabled: !!e.target.checked });
      if ($('toolsDefault')) $('toolsDefault').checked = !!s.toolsEnabled;
      toast(s.toolsEnabled ? 'Tools ON' : 'Tools OFF');
    });

    $('toolsDefault') && $('toolsDefault').addEventListener('change', (e) => {
      const s = setSettings({ toolsEnabled: !!e.target.checked });
      if ($('toolsToggle')) $('toolsToggle').checked = !!s.toolsEnabled;
      toast(s.toolsEnabled ? 'Tools ON' : 'Tools OFF');
    });

    $('authMode') && $('authMode').addEventListener('change', () => {
      saveSettingsFromUI();
    });
    $('gatewayUrl') && $('gatewayUrl').addEventListener('change', () => {
      saveSettingsFromUI();
    });
    $('researchBtn') && $('researchBtn').addEventListener('click', runResearchAgent);

    $('workflowRunBtn') && $('workflowRunBtn').addEventListener('click', runWorkflowSelected);
    $('workflowLoadBtn') && $('workflowLoadBtn').addEventListener('click', workflowLoadSelected);
    $('workflowClearLogBtn') && $('workflowClearLogBtn').addEventListener('click', wfClear);

    // model hub
    $('pickModelBtn').addEventListener('click', openModelHub);
    $('modelModalClose').addEventListener('click', () => openModelModal(false));
    $('modelModalBackdrop').addEventListener('click', () => openModelModal(false));
    $('modelSearch').addEventListener('input', renderModelHub);
    $('modelProviderFilter').addEventListener('change', renderModelHub);
    $('modelSort').addEventListener('change', renderModelHub);
    $('modelRefreshBtn').addEventListener('click', () => refreshModelHub(true));
    $('modelFavOnlyBtn').addEventListener('click', async () => {
      const on = $('modelFavOnlyBtn').dataset.on === '1';
      $('modelFavOnlyBtn').dataset.on = on ? '0' : '1';
      $('modelFavOnlyBtn').classList.toggle('dark', !on);
      await renderModelHub();
    });

    // knowledge base
    $('kbBuildBtn') && $('kbBuildBtn').addEventListener('click', buildKbIndex);
    $('kbClearBtn') && $('kbClearBtn').addEventListener('click', async () => {
      const pid = getCurProjectId();
      if (!confirm('مسح KB لهذا المشروع؟')) return;
      showStatus('مسح KB…', true);
      const n = await kbClearProject(pid).catch(()=>0);
      showStatus('', false);
      toast(`✅ تم مسح ${n} chunk`);
      await ensureKbStats();
    });
    $('kbSearchBtn') && $('kbSearchBtn').addEventListener('click', async () => {
      const q = ($('kbQuery').value || '').trim();
      if (!q) return;
      try{
        showStatus('بحث KB…', true);
        const res = await searchKb(q);
        showStatus('', false);
        $('kbResults').textContent = formatKbResults(res);
        toast('✅ تم');
      }catch(e){
        showStatus(`❌ KB search:\n${e?.message||e}`, false);
      }
    });
    $('kbInsertBtn') && $('kbInsertBtn').addEventListener('click', () => {
      const txt = ($('kbResults').textContent || '').trim();
      if (!txt) return;
      $('chatInput').value = `استخدم نتائج KB التالية للإجابة:\n\n${txt}\n\nسؤالي:`;
      setActiveNav('chat');
      toast('✅ تم إدراج النتائج في الدردشة');
      $('chatInput').focus();
    });
    const kbSave = () => {
      const pid = getCurProjectId();
      setKbSettings(pid, {
        embedModel: $('embedModel')?.value?.trim() || '',
        topK: Number($('kbTopK')?.value || 6),
        chunkSize: Number($('kbChunkSize')?.value || 900),
        overlap: Number($('kbOverlap')?.value || 120),
        ragHint: $('kbRagHint')?.value || DEFAULT_KB.ragHint
      });
    };
    ['embedModel','kbTopK','kbChunkSize','kbOverlap','kbRagHint'].forEach(id => {
      const el = $(id);
      if (el) el.addEventListener('change', () => { kbSave(); toast('✅ تم حفظ إعدادات KB'); });
    });

    // canvas
    $('canvasDoc').addEventListener('change', (e) => openCanvasDoc(e.target.value));
    $('canvasNewBtn').addEventListener('click', () => openCanvasDoc(''));
    $('canvasSaveBtn').addEventListener('click', saveCanvasDoc);
    $('canvasVersionsBtn').addEventListener('click', showCanvasVersions);
    $('canvasPreviewToggle').addEventListener('change', refreshCanvasPreview);
    $('canvasRefreshPreviewBtn').addEventListener('click', refreshCanvasPreview);
    $('canvasAiBtn').addEventListener('click', () => {
      const action = prompt('اختر: rewrite / summarize / improve / build_app_html', 'rewrite');
      if (!action) return;
      canvasAi(action.trim());
    });
    $('canvasExportBtn').addEventListener('click', exportCanvas);

    // files
    $('addFilesBtn').addEventListener('click', () => $('filePicker').click());
    $('filePicker').addEventListener('change', (e) => addFiles(e.target.files));
    $('clearFilesBtn').addEventListener('click', () => {
      const pid = getCurProjectId();
      saveFiles(pid, []);
      $('filesText').value = '';
      renderFiles();
      refreshNavMeta();
      toast('✅ تم مسح الملفات');
    });


    // transcription
    let transcribeSelectedFile = null;
    let transcribeLastStructured = null;

    const setTranscribeFile = (f) => {
      transcribeSelectedFile = f || null;
      transcribeLastStructured = null;
      if ($('transcribeFileName')) $('transcribeFileName').textContent = f ? `الملف: ${f.name}` : 'لم يتم اختيار ملف بعد';
      if ($('transcribeStats')) $('transcribeStats').textContent = f ? 'جاهز للاستخراج' : 'جاهز';
    };
    const updateTranscribeLiveStats = () => {
      const txt = String($('transcribeOutput')?.value || '');
      const chars = txt.length;
      const words = (txt.trim().match(/\S+/g) || []).length;
      const lines = txt ? txt.split(/\r?\n/).length : 0;
      if ($('transcribeChars')) $('transcribeChars').textContent = String(chars);
      if ($('transcribeWords')) $('transcribeWords').textContent = String(words);
      if ($('transcribeLines')) $('transcribeLines').textContent = String(lines);
    };

    $('transcribeOutput')?.addEventListener('input', updateTranscribeLiveStats);
    $('transcribePickBtn')?.addEventListener('click', () => $('transcribePdfPicker')?.click());
    $('transcribePdfPicker')?.addEventListener('change', (e) => {
      const f = e.target?.files?.[0] || null;
      setTranscribeFile(f);
    });

    const drop = $('transcribeDropZone');
    ['dragenter','dragover'].forEach((ev) => drop?.addEventListener(ev, (e) => {
      e.preventDefault();
      drop.style.borderColor = 'var(--accent)';
    }));
    ['dragleave','drop'].forEach((ev) => drop?.addEventListener(ev, (e) => {
      e.preventDefault();
      drop.style.borderColor = 'var(--line)';
    }));
    drop?.addEventListener('drop', (e) => {
      const f = e.dataTransfer?.files?.[0] || null;
      if (f) setTranscribeFile(f);
    });

    $('transcribePasteBtn')?.addEventListener('click', async () => {
      try{
        const items = await navigator.clipboard.read();
        for (const it of items){
          const t = (it.types || []).find((x) => x.startsWith('image/'));
          if (!t) continue;
          const blob = await it.getType(t);
          const ext = t.split('/')[1] || 'png';
          const file = new File([blob], `clipboard-${Date.now()}.${ext}`, { type: t });
          setTranscribeFile(file);
          toast('✅ تم لصق الصورة من الحافظة');
          return;
        }
        toast('⚠️ لا توجد صورة في الحافظة');
      }catch(e){
        toast('⚠️ تعذر الوصول إلى الحافظة');
      }
    });

    $('transcribeExtractBtn')?.addEventListener('click', async () => {
      if (!transcribeSelectedFile) return toast('⚠️ اختر ملف PDF أو صورة أولاً');
      try{
        const f = transcribeSelectedFile;
        const isPdf = /\.pdf$/i.test(String(f.name || '')) || String(f.type || '').includes('pdf');
        showStatus('استخراج النص…', true);
        $('transcribeStats').textContent = 'جاري الاستخراج...';
        if (isPdf){
          const result = await extractPdfStrategic(f, {
            onProgress: (p, total, info) => { $('transcribeStats').textContent = `صفحة ${p}/${total} • ${info?.method || 'native'}`; }
          });
          transcribeLastStructured = result;
          $('transcribeOutput').value = result?.text || '';
          $('transcribeStats').textContent = `استخراج ${result.extractedPages}/${result.totalPages} صفحة • ${result.text.length} حرف`;
        } else {
          const txt = await fileToTextSmart(f);
          $('transcribeOutput').value = txt || '';
          $('transcribeStats').textContent = txt ? `استخراج صورة • ${txt.length} حرف` : 'لم يتم العثور على نص';
        }
        updateTranscribeLiveStats();
        showStatus('', false);
      }catch(e){
        showStatus(`❌ فشل استخراج النص:
${e?.message||e}`, false);
      }
    });
    $('transcribeCopyBtn')?.addEventListener('click', async () => {
      const txt = String($('transcribeOutput')?.value || '').trim();
      if (!txt) return toast('⚠️ لا يوجد نص لنسخه');
      const ok = await copyToClipboard(txt);
      toast(ok ? '✅ تم نسخ النص' : '⚠️ تعذر النسخ');
    });
    $('transcribeSaveArchiveBtn')?.addEventListener('click', () => {
      const txt = String($('transcribeOutput')?.value || '').trim();
      if (!txt) return toast('⚠️ لا يوجد نص للحفظ');
      const dl = loadDownloads();
      const name = `${String(transcribeSelectedFile?.name || 'ocr').replace(/\.[^\.]+$/,'')}-archive.txt`;
      dl.unshift({ id: makeId('dl'), name, mime:'text/plain', encoding:'text', content: txt, createdAt: nowTs(), pinned:false });
      saveDownloads(dl.slice(0, 120));
      renderDownloads();
      refreshNavMeta();
      toast('✅ تم الحفظ في الأرشيف');
    });
    $('transcribeSendChatBtn')?.addEventListener('click', () => {
      const txt = String($('transcribeOutput')?.value || '').trim();
      if (!txt) return toast('⚠️ لا يوجد نص للإرسال');
      $('chatInput').value = `لخّص النص التالي واذكر النقاط الرئيسية:

${txt}`;
      setActiveNav('chat');
      $('chatInput').focus();
      toast('✅ تم إرسال النص إلى الدردشة');
    });
    $('transcribeClearBtn')?.addEventListener('click', () => {
      setTranscribeFile(null);
      if ($('transcribeOutput')) $('transcribeOutput').value = '';
      if ($('transcribeStats')) $('transcribeStats').textContent = 'جاهز';
      updateTranscribeLiveStats();
      toast('✅ تم المسح');
    });
    $('transcribeConvertBtn')?.addEventListener('click', async () => {
      if (!transcribeSelectedFile) return toast('⚠️ اختر ملف PDF أولاً');
      try{
        showStatus('تحويل PDF إلى DOCX احترافي قابل للتعديل…', true);
        $('transcribeStats').textContent = 'جاري التحويل...';
        const s = getSettings();
        let result = null;
        if ((s.cloudConvertEndpoint || '').trim()){
          $('transcribeStats').textContent = 'تحويل عبر CloudConvert Worker...';
          result = await convertPdfToDocxByWorker(transcribeSelectedFile);
        } else {
          result = await convertPdfToEditableDocx(transcribeSelectedFile, {
            onProgress: (p, total, info) => { $('transcribeStats').textContent = `تحويل صفحة ${p}/${total} • ${info?.method || 'native'}`; }
          });
          transcribeLastStructured = result?.structured || transcribeLastStructured;
          if ($('transcribeOutput') && result?.text) $('transcribeOutput').value = result.text;
        }
        downloadBlob(result.fileName, result.blob);
        showStatus('', false);
        $('transcribeStats').textContent = 'اكتمل التحويل';
        updateTranscribeLiveStats();
        toast('⬇️ تم تنزيل ملف DOCX قابل للتعديل');
      }catch(e){
        showStatus(`❌ فشل التحويل:
${e?.message||e}`, false);
      }
    });
    $('transcribeExportWordBtn')?.addEventListener('click', async () => {
      const txt = String($('transcribeOutput')?.value || '').trim();
      if (!txt && !transcribeLastStructured) return toast('⚠️ لا يوجد محتوى لتصديره');
      try{
        const format = String($('transcribeExportFormat')?.value || 'docx').toLowerCase();
        const base = String(transcribeSelectedFile?.name || 'ocr-export').replace(/\.pdf$/i, '-extracted');
        await exportTranscriptionResult({ format, text: txt, structured: transcribeLastStructured, fileBaseName: base });
        toast(`✅ تم تصدير ${format.toUpperCase()}`);
      }catch(e){
        toast(`❌ ${e?.message || e}`);
      }
    });
    $('transcribeCloudBtn')?.addEventListener('click', async () => {
      const txt = String($('transcribeOutput')?.value || '').trim();
      if (!txt) return toast('⚠️ استخرج النص أولاً ثم جرّب التحسين السحابي');
      try{
        showStatus('تحسين النص عبر السحابة…', true);
        $('transcribeStats').textContent = 'جاري التحسين السحابي...';
        const polished = await cloudPolishText(txt);
        if (polished) $('transcribeOutput').value = polished.trim();
        showStatus('', false);
        $('transcribeStats').textContent = polished ? `تم التحسين (${polished.length} حرف)` : 'لم يرجع النص من المزود';
        updateTranscribeLiveStats();
        toast(polished ? '☁️ تم التحسين السحابي' : '⚠️ لم يتم إرجاع نص');
      }catch(e){
        showStatus(`❌ فشل التحسين السحابي:
${e?.message||e}`, false);
      }
    });
    updateTranscribeLiveStats();

    // downloads
    $('refreshDlBtn').addEventListener('click', renderDownloads);
    $('clearDlBtn').addEventListener('click', () => { saveDownloads([]); renderDownloads(); toast('✅ تم'); });
    $('dlSearch').addEventListener('input', renderDownloads);
    $('pinFilterBtn').addEventListener('click', () => { pinOnly = !pinOnly; toast(pinOnly ? '📌 عرض المثبت' : 'عرض الكل'); renderDownloads(); });

    // projects
    $('newProjectBtn').addEventListener('click', newProject);
    $('renameProjectBtn').addEventListener('click', renameProject);
    $('deleteProjectBtn').addEventListener('click', deleteProject);

    // settings
    $('saveSettingsBtn').addEventListener('click', saveSettingsFromUI);
    $('settingsHealthBtn')?.addEventListener('click', runStrategicHealthCheck);
    $('settingsDefaultsBtn')?.addEventListener('click', applyStrategicDefaults);
    $('settingsRecommendModelBtn')?.addEventListener('click', recommendStrategicModel);
    $('resetSettingsBtn').addEventListener('click', () => { saveJSON(KEYS.settings, DEFAULT_SETTINGS); renderSettings();
    applyUiCollapse();
    applyToolbarCollapses();
    // Default collapse on mobile (first run)
    try{
      if (window.innerWidth < 980){
        if (localStorage.getItem(KEYS.chatToolbarCollapsed) === null) setChatToolbarCollapsed(true);
        if (localStorage.getItem(KEYS.headerCollapsed) === null) setHeaderCollapsed(false);
        applyUiCollapse();
    applyToolbarCollapses();
      }
    }catch(_){ }
 toast('✅ تم'); });
    $('refreshModelsBtn').addEventListener('click', () => refreshModelHub(true));
    $('clearModelsCacheBtn').addEventListener('click', clearModelsCache);

    // quick sync
    $('provider').addEventListener('change', () => { saveSettingsFromUI(); applyUiCollapse();
    // Default collapse on mobile (first run)
    try{
      if (window.innerWidth < 980){
        if (localStorage.getItem(KEYS.chatToolbarCollapsed) === null) setChatToolbarCollapsed(true);
        if (localStorage.getItem(KEYS.headerCollapsed) === null) setHeaderCollapsed(false);
        applyUiCollapse();
    applyToolbarCollapses();
      }
    }catch(_){ }
 });
    $('baseUrl').addEventListener('change', () => { saveSettingsFromUI(); applyUiCollapse();
    // Default collapse on mobile (first run)
    try{
      if (window.innerWidth < 980){
        if (localStorage.getItem(KEYS.chatToolbarCollapsed) === null) setChatToolbarCollapsed(true);
        if (localStorage.getItem(KEYS.headerCollapsed) === null) setHeaderCollapsed(false);
        applyUiCollapse();
    applyToolbarCollapses();
      }
    }catch(_){ }
 });
    $('webMode').addEventListener('change', () => { saveSettingsFromUI(); refreshModeButtons(); });
    $('model').addEventListener('change', () => { saveSettingsFromUI(); applyUiCollapse();
    // Default collapse on mobile (first run)
    try{
      if (window.innerWidth < 980){
        if (localStorage.getItem(KEYS.chatToolbarCollapsed) === null) setChatToolbarCollapsed(true);
        if (localStorage.getItem(KEYS.headerCollapsed) === null) setHeaderCollapsed(false);
        applyUiCollapse();
    applyToolbarCollapses();
      }
    }catch(_){ }
 });
  }

  // ---------------- Init ----------------
  function init(){
    loadProjects();
    const pid = getCurProjectId();
    loadThreads(pid);
    $('curProjectName').textContent = getCurProject().name;

    renderSettings();
    ensureStrategicChrome();

    // Enable web search by default for first-time users
    try{
      if (localStorage.getItem(KEYS.webToggle) === null) setWebToggle(true);
      const cur = getSettings();
      if (!cur.webMode || cur.webMode === 'off') setSettings({ webMode: 'openrouter_online' });
    }catch(_){ }

    setupCollapsibleToolbars();
    applyUiCollapse();
    applyToolbarCollapses();
    // Default collapse on mobile (first run)
    try{
      if (window.innerWidth < 980){
        if (localStorage.getItem(KEYS.chatToolbarCollapsed) === null) setChatToolbarCollapsed(true);
        if (localStorage.getItem(KEYS.headerCollapsed) === null) setHeaderCollapsed(false);
        setupCollapsibleToolbars();
    applyUiCollapse();
    applyToolbarCollapses();
      }
    }catch(_){ }

    renderChat();
    renderFiles();
    renderCanvasList();
    renderDownloads();
    renderProjects();
    renderProjectBrief();
    renderKbUI().catch(()=>{});
    refreshNavMeta();
    ensureKbStats().catch(()=>{});
    refreshCanvasPreview();
    refreshModeButtons();
    updateChips();

    bind();
    applyShellLayout();
    refreshStrategicWorkspace().catch(()=>{});
  }

  init();
})();
