/* AI Workspace Studio v8.5 - strategic platform skeleton (no build step) */
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
    chatToolbarPinned: 'aistudio_chat_toolbar_pinned_v1',
    toolbarCollapsedMap: 'aistudio_toolbar_collapsed_map_v1',
    workspaceSectionMap: 'aistudio_workspace_sections_v1',
    projectBrief: (pid) => `aistudio_project_brief_${pid}_v1`,
    sidebarPinned: 'aistudio_sidebar_pinned_v1',
    focusMode: 'aistudio_focus_mode_v1',
    studyMode: 'aistudio_study_mode_v1',
    transcribeProfile: 'aistudio_transcribe_profile_v1',
    transcribeDocxMode: 'aistudio_transcribe_docx_mode_v1',
    authState: 'aistudio_auth_state_v1',
    authConfigCache: 'aistudio_auth_config_v1'
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
    freeMode: false,
    costGuard: 'balanced',
    maxCloudPdfPages: 25,
    maxCloudFileMB: 12,
    allowCloudOcr: true,
    allowCloudPolish: true,
    googleClientId: '',
    upgradeEmail: 'tntntt830@gmail.com',

    orReferer: '',
    orTitle: 'AI Workspace Studio'
  };

  const DEFAULT_AUTH_STATE = {
    signedIn: false,
    plan: 'free',
    role: 'user',
    email: '',
    name: '',
    picture: '',
    sessionToken: '',
    sessionExp: 0,
    upgradeCode: '',
    lastVerifiedAt: 0
  };

  const DEFAULT_AUTH_CONFIG = {
    authRequired: true,
    brandName: 'AI Workspace Studio',
    developerName: 'صدام القاضي',
    upgradeEmail: 'tntntt830@gmail.com',
    adminEmail: 'tntntt830@gmail.com',
    adminEnabled: true,
    googleClientId: '',
    clientIdConfigured: false,
    premiumEnabled: true
  };

  const AUTH_RUNTIME = {
    config: null,
    configLoadedAt: 0,
    configPromise: null,
    booting: false
  };

  const ANDROID_GOOGLE_SETUP = {
    packageName: 'com.saddamalkadi.aiworkspace',
    releaseSha1: '56:DA:BC:F0:F5:A4:7A:19:05:1A:07:F2:94:0F:FD:FA:DF:7C:AF:03'
  };

  const NATIVE_GOOGLE_RUNTIME = {
    initialized: false,
    initPromise: null,
    autoAttempted: false,
    lastDialogMessage: ''
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

async function callEmbeddings({ settings = getSettings(), apiKey, baseUrl, model, inputs, signal, extraHeaders={} }){
  const url = baseUrl.replace(/\/+$/,'') + '/embeddings';
  const body = { model, input: inputs };
  const r = await fetch(url, {
    method:'POST',
    headers: { 'Content-Type':'application/json', ...extraHeaders, ...buildAuthHeaders({ ...settings, apiKey }) },
    body: JSON.stringify(body),
    signal
  });
  const t = await r.text();
  let j; try{ j = JSON.parse(t);}catch(_){ j = null; }
  if (!r.ok) throw new Error(j?.error?.message || t || `HTTP ${r.status}`);
  const data = j?.data || [];
  return data.map(d => d.embedding).filter(Boolean);
}

async function buildKbIndex(rawSettings = getSettings()){
  const pid = getCurProjectId();
  const kb = getKbSettings(pid);
  const policy = getAppRuntimePolicy(rawSettings);
  if (!policy.allowEmbeddings) return toast(getPolicyFeatureReason('embeddings', policy));
  const settings = policy.runtime;
  const embedModel = (kb.embedModel || '').trim();
  if (!embedModel) return toast('⚠️ حدّد نموذج التضمين في صفحة المعرفة.');
  if (!hasAuthReady(settings)) return toast(getMissingAuthMessage(settings));

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
    const embs = await callEmbeddings({ settings, apiKey: settings.apiKey, baseUrl, model: embedModel, inputs, signal: abort.signal, extraHeaders });
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

async function searchKb(query, rawSettings = getSettings()){
  const pid = getCurProjectId();
  const kb = getKbSettings(pid);
  const policy = getAppRuntimePolicy(rawSettings);
  if (!policy.allowEmbeddings) throw new Error(getPolicyFeatureReason('embeddings', policy));
  const settings = policy.runtime;
  const embedModel = (kb.embedModel || '').trim();
  const topK = clamp(Number(kb.topK||6), 1, 20);
  if (!embedModel) throw new Error('نموذج التضمين غير محدد');
  if (!hasAuthReady(settings)) throw new Error('المصادقة غير مكتملة (مفتاح API أو رابط البوابة)');

  const chunks = await kbGetAllByProject(pid);
  const withEmb = chunks.filter(c => c.embedding);
  if (!withEmb.length) return [];

  const baseUrl = effectiveBaseUrl(settings) || (settings.provider === 'openrouter' ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1');
  const extraHeaders = buildProviderHeaders(settings);

  const abort = new AbortController();
  const qEmb = (await callEmbeddings({ settings, apiKey: settings.apiKey, baseUrl, model: embedModel, inputs:[query], signal: abort.signal, extraHeaders }))[0];
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

async function buildRagContextIfEnabled(userText, rawSettings = getSettings()){
  const policy = getAppRuntimePolicy(rawSettings);
  const modes = getEffectiveModeState(rawSettings, policy);
  if (!policy.allowRag || !modes.rag) return { ctx:'', results:[] };
  try{
    const results = await searchKb(userText, rawSettings);
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

  function getAuthState(){
    return { ...DEFAULT_AUTH_STATE, ...(loadJSON(KEYS.authState, {}) || {}) };
  }

  function saveAuthState(patch){
    const next = { ...getAuthState(), ...(patch || {}) };
    saveJSON(KEYS.authState, next);
    return next;
  }

  function clearAuthState(options = {}){
    const current = getAuthState();
    saveJSON(KEYS.authState, {
      ...DEFAULT_AUTH_STATE,
      upgradeCode: options.preserveUpgradeCode ? (current.upgradeCode || '') : ''
    });
    return getAuthState();
  }

  function hasValidAuthSession(state = getAuthState()){
    return !!state.sessionToken && Number(state.sessionExp || 0) > (Date.now() + 30 * 1000);
  }

  function getAccountPlanLabel(plan = getAuthState().plan){
    return plan === 'premium' ? 'الخطة المدفوعة' : 'الخطة المجانية';
  }

  function getGatewayWorkerRoot(settings = getSettings()){
    return normalizeEndpointUrl(settings.gatewayUrl || '').replace(/\/v1\/?$/i, '');
  }

  function getLocalAuthConfig(settings = getSettings()){
    return {
      ...DEFAULT_AUTH_CONFIG,
      googleClientId: '',
      upgradeEmail: String(settings.upgradeEmail || DEFAULT_AUTH_CONFIG.upgradeEmail).trim() || DEFAULT_AUTH_CONFIG.upgradeEmail,
      adminEmail: DEFAULT_AUTH_CONFIG.adminEmail,
      adminEnabled: true,
      clientIdConfigured: false
    };
  }

  function getAuthConfigCached(){
    if (AUTH_RUNTIME.config) return AUTH_RUNTIME.config;
    const cached = loadJSON(KEYS.authConfigCache, null);
    if (cached && typeof cached === 'object'){
      AUTH_RUNTIME.config = { ...DEFAULT_AUTH_CONFIG, ...cached };
      return AUTH_RUNTIME.config;
    }
    const local = getLocalAuthConfig();
    AUTH_RUNTIME.config = local;
    return local;
  }

  function setAuthConfigCached(config){
    AUTH_RUNTIME.config = { ...DEFAULT_AUTH_CONFIG, ...(config || {}) };
    AUTH_RUNTIME.configLoadedAt = Date.now();
    saveJSON(KEYS.authConfigCache, AUTH_RUNTIME.config);
    return AUTH_RUNTIME.config;
  }

  function getEffectiveAuthConfig(settings = getSettings()){
    return { ...getLocalAuthConfig(settings), ...getAuthConfigCached() };
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

  function getAuthServiceRoot(settings = getSettings()){
    return getGatewayWorkerRoot(settings);
  }

  function getAccountRuntimeState(settings = getSettings()){
    const auth = getAuthState();
    const config = getEffectiveAuthConfig(settings);
    const authRequired = config.authRequired !== false;
    const signedIn = hasValidAuthSession(auth);
    const premium = signedIn && auth.plan === 'premium';
    return {
      auth,
      config,
      authRequired,
      signedIn,
      premium,
      admin: signedIn && auth.role === 'admin',
      plan: premium ? 'premium' : 'free'
    };
  }

  async function fetchAuthJson(path, init = {}, settings = getSettings()){
    const root = getAuthServiceRoot(settings);
    if (!root) throw new Error('رابط البوابة غير مضبوط لطبقة الحسابات.');
    const auth = getAuthState();
    const headers = new Headers(init.headers || {});
    headers.set('Content-Type', headers.get('Content-Type') || 'application/json');
    if (settings.gatewayToken) headers.set('X-Client-Token', settings.gatewayToken);
    if (auth.sessionToken) headers.set('X-App-Session', auth.sessionToken);
    const response = await fetch(`${root}${path}`, { ...init, headers });
    const raw = await response.text();
    let payload = null;
    try{ payload = raw ? JSON.parse(raw) : null; }catch(_){ payload = null; }
    if (!response.ok){
      throw new Error(payload?.error || payload?.message || raw || `HTTP ${response.status}`);
    }
    return payload || {};
  }

  async function loadRemoteAuthConfig(force = false){
    if (!force && AUTH_RUNTIME.config && (Date.now() - AUTH_RUNTIME.configLoadedAt) < 5 * 60 * 1000){
      return AUTH_RUNTIME.config;
    }
    if (!force && AUTH_RUNTIME.configPromise) return AUTH_RUNTIME.configPromise;
    const settings = getSettings();
    const root = getAuthServiceRoot(settings);
    if (!root){
      return setAuthConfigCached(getLocalAuthConfig(settings));
    }
    AUTH_RUNTIME.configPromise = fetch(`${root}/auth/config`, {
      headers: settings.gatewayToken ? { 'X-Client-Token': settings.gatewayToken } : {}
    }).then(async (response) => {
      const raw = await response.text();
      let payload = null;
      try{ payload = raw ? JSON.parse(raw) : null; }catch(_){ payload = null; }
      if (!response.ok){
        throw new Error(payload?.error || raw || `HTTP ${response.status}`);
      }
      const local = getLocalAuthConfig(settings);
      const remote = payload || {};
      return setAuthConfigCached({
        ...remote,
        googleClientId: String(remote.googleClientId || '').trim(),
        upgradeEmail: String(remote.upgradeEmail || local.upgradeEmail || DEFAULT_AUTH_CONFIG.upgradeEmail).trim(),
        adminEmail: String(remote.adminEmail || local.adminEmail || DEFAULT_AUTH_CONFIG.adminEmail).trim(),
        adminEnabled: remote.adminEnabled !== false,
        clientIdConfigured: !!String(remote.googleClientId || '').trim()
      });
    }).catch(() => {
      return setAuthConfigCached(getLocalAuthConfig(settings));
    }).finally(() => {
      AUTH_RUNTIME.configPromise = null;
    });
    return AUTH_RUNTIME.configPromise;
  }

  function applyAuthResponse(payload, extra = {}){
    const next = saveAuthState({
      signedIn: true,
      plan: payload?.plan === 'premium' ? 'premium' : 'free',
      role: payload?.role === 'admin' ? 'admin' : 'user',
      email: payload?.email || '',
      name: payload?.name || payload?.email || '',
      picture: payload?.picture || '',
      sessionToken: payload?.sessionToken || payload?.session_token || '',
      sessionExp: Number(payload?.sessionExp || payload?.session_exp || 0),
      upgradeCode: extra.upgradeCode || payload?.upgradeCode || getAuthState().upgradeCode || '',
      lastVerifiedAt: Date.now()
    });
    return next;
  }

  async function verifyStoredAuthSession(force = false){
    const current = getAuthState();
    if (!hasValidAuthSession(current)) return clearAuthState({ preserveUpgradeCode: true });
    if (!force && (Date.now() - Number(current.lastVerifiedAt || 0)) < 3 * 60 * 1000){
      return current;
    }
    try{
      const payload = await fetchAuthJson('/auth/session', { method:'GET' });
      return applyAuthResponse(payload, { upgradeCode: current.upgradeCode || '' });
    }catch(_){
      return clearAuthState({ preserveUpgradeCode: true });
    }
  }

  function getConvertWorkerRoot(settings = getSettings()){
    const origins = [
      endpointOrigin(settings?.cloudConvertEndpoint || ''),
      endpointOrigin(settings?.cloudConvertFallbackEndpoint || ''),
      endpointOrigin(settings?.ocrCloudEndpoint || '')
    ].filter(Boolean);
    return origins[0] || '';
  }

  function validateGatewayUrlInput(gatewayUrl, settings = {}){
    const raw = normalizeEndpointUrl(gatewayUrl || '');
    if (!raw) return { ok:true, normalized:'', warning:'' };
    let parsed;
    try{
      parsed = new URL(raw);
    }catch(_){
      return { ok:false, reason:'رابط البوابة غير صالح. استخدم رابطًا مباشرًا يبدأ بـ https://.' };
    }
    const host = String(parsed.hostname || '').toLowerCase();
    const path = String(parsed.pathname || '').toLowerCase();
    if (/dash\.cloudflare\.com$/.test(host) || path.includes('/workers/services/view/') || path.includes('/production/settings')){
      return {
        ok:false,
        reason:'هذا رابط لوحة Cloudflare وليس رابط الـ Worker المباشر. استخدم Gateway URL مثل https://sadam-key...workers.dev'
      };
    }
    if (/github\.io$/.test(host)){
      return {
        ok:false,
        reason:'هذا رابط الموقع أو صفحة التنزيل، وليس رابط بوابة API. استخدم رابط الـ Worker المباشر للدردشة.'
      };
    }
    if (/(^|\/)(convert\/pdf-to-docx|pdf-to-docx|ocr)(\/|$)/.test(path)){
      return {
        ok:false,
        reason:'هذا رابط خدمة التحويل أو OCR، وليس رابط بوابة الدردشة. استخدم Worker الدردشة مثل sadam-key...workers.dev.'
      };
    }
    const normalized = raw
      .replace(/\/v1\/?$/i, '')
      .replace(/\/health\/?$/i, '')
      .replace(/\/auth\/(config|session|google|login|register)\/?$/i, '');
    const warning = normalized !== raw
      ? 'تم تنظيف رابط البوابة تلقائيًا إلى الجذر الصحيح.'
      : '';
    return { ok:true, normalized, warning };
  }

  function getCostGuardLabel(value = getSettings().costGuard){
    return ({
      strict: 'اقتصادي صارم',
      balanced: 'متوازن',
      open: 'جودة قصوى'
    })[value] || 'متوازن';
  }

  function getFreeModeLabel(enabled = !!getSettings().freeMode){
    return enabled ? 'الوضع المجاني' : 'الوضع الاحترافي';
  }

  function getMissingAuthMessage(settings){
    if (settings.provider === 'gemini') return 'أضف مفتاح Gemini من صفحة الإعدادات قبل المتابعة.';
    if (settings.authMode === 'gateway') return 'أضف رابط البوابة أو فعّل Cloudflare Worker المتوافق قبل المتابعة.';
    return 'أضف مفتاح API من صفحة الإعدادات قبل المتابعة.';
  }

  function getCostGuardCaps(mode = getSettings().costGuard){
    return ({
      strict: { maxOut: 1200, fileClip: 9000 },
      balanced: { maxOut: 2000, fileClip: 14000 },
      open: { maxOut: 3200, fileClip: 24000 }
    })[mode] || { maxOut: 2000, fileClip: 14000 };
  }

  function getBudgetModelForSettings(settings = getSettings()){
    if (settings.provider === 'gemini') return 'gemini-2.5-flash';
    if (settings.provider === 'openai') return 'gpt-4o-mini';
    return 'openai/gpt-4o-mini';
  }

  function getPolicyFeatureReason(feature, policy = getAppRuntimePolicy()){
    const reasons = {
      chat: policy.blockedReason || '',
      deepMode: policy.freeMode
        ? 'الوضع المجاني يوقف التفكير العميق على مستوى التطبيق لتقليل التكلفة.'
        : 'وضع التكلفة الصارم يوقف التفكير العميق حتى تبقى الجلسات أقل كلفة.',
      agentMode: policy.freeMode
        ? 'الوضع المجاني يوقف وضع الوكيل لأنه قد يضاعف عدد الطلبات.'
        : 'وضع التكلفة الصارم يوقف وضع الوكيل لأنه قد يطلق خطوات إضافية.',
      web: policy.freeMode
        ? 'الوضع المجاني يوقف الويب والبحث الشبكي على مستوى التطبيق.'
        : 'وضع التكلفة الصارم يوقف الويب والبحث الشبكي للتحكم في التكلفة.',
      deepSearch: policy.freeMode
        ? 'الوضع المجاني يوقف البحث العميق متعدد الخطوات.'
        : 'وضع التكلفة الصارم يوقف البحث العميق لأنه يستهلك عدة طلبات.',
      research: policy.freeMode
        ? 'الوضع المجاني يوقف البحث التفصيلي متعدد الخطوات.'
        : 'وضع التكلفة الصارم يوقف البحث التفصيلي لأنه يطلق عدة مراحل.',
      tools: policy.freeMode
        ? 'الوضع المجاني يوقف الأدوات الآلية مثل KB والويب والتنزيلات الذكية.'
        : 'وضع التكلفة الصارم يوقف الأدوات الآلية لتقليل الاستدعاءات الإضافية.',
      rag: policy.freeMode
        ? 'الوضع المجاني يوقف RAG لأنه يعتمد على استدعاءات تضمين واسترجاع إضافية.'
        : 'وضع التكلفة الصارم يوقف RAG لتقليل كلفة الفهرسة والاسترجاع.',
      embeddings: policy.freeMode
        ? 'الوضع المجاني يوقف فهرسة المعرفة والبحث الدلالي على مستوى التطبيق.'
        : 'وضع التكلفة الصارم يوقف فهرسة المعرفة والبحث الدلالي لتقليل الكلفة.',
      summary: policy.freeMode
        ? 'الوضع المجاني يوقف تلخيص السجل التلقائي لأنه يستهلك طلبات إضافية.'
        : 'وضع التكلفة الصارم يوقف تلخيص السجل التلقائي للحفاظ على الحد الأدنى من الكلفة.'
    };
    return reasons[feature] || policy.blockedReason || 'هذه الميزة متوقفة حسب سياسة التشغيل الحالية.';
  }

  function getAppRuntimePolicy(raw = getSettings()){
    const source = { ...DEFAULT_SETTINGS, ...(raw || {}) };
    const account = getAccountRuntimeState(source);
    const freeMode = account.authRequired ? (!account.premium || !!source.freeMode) : !!source.freeMode;
    const costGuard = freeMode ? 'strict' : (source.costGuard || 'balanced');
    const caps = getCostGuardCaps(costGuard);
    const notes = [];
    const runtime = { ...source };

    const strictLike = freeMode || costGuard === 'strict';
    const allowTools = !strictLike;
    const allowWeb = !strictLike;
    const allowDeepMode = !strictLike;
    const allowAgentMode = !strictLike;
    const allowDeepSearch = !strictLike;
    const allowResearch = !strictLike;
    const allowEmbeddings = !strictLike;
    const allowRag = !strictLike;
    const allowThreadSummary = !strictLike;

    if (account.authRequired){
      notes.push(account.premium ? 'حساب مدفوع نشط' : 'حساب مجاني');
    }

    if (freeMode){
      const gatewayRoot = normalizeUrl(resolveGatewayApiRoot(source));
      if (gatewayRoot){
        runtime.provider = 'openrouter';
        runtime.authMode = 'gateway';
        runtime.gatewayUrl = gatewayRoot;
        runtime.baseUrl = `${gatewayRoot}/v1`;
        runtime.model = 'openrouter/free';
        notes.push('تشغيل مجاني عبر البوابة');
      } else if (isOpenRouter(source)){
        runtime.provider = 'openrouter';
        runtime.baseUrl = effectiveBaseUrl(source) || normalizeUrl(source.baseUrl || DEFAULT_SETTINGS.baseUrl) || 'https://openrouter.ai/api/v1';
        runtime.model = 'openrouter/free';
        notes.push('تشغيل مجاني عبر OpenRouter');
      }
    } else if (costGuard === 'strict'){
      runtime.model = getBudgetModelForSettings(source);
      notes.push('فرض نموذج اقتصادي');
    }

    if (!runtime.model) runtime.model = getBudgetModelForSettings(runtime);
    runtime.maxOut = clamp(Number(source.maxOut || DEFAULT_SETTINGS.maxOut), 256, caps.maxOut);
    runtime.fileClip = clamp(Number(source.fileClip || DEFAULT_SETTINGS.fileClip), 2000, caps.fileClip);
    runtime.toolsEnabled = !!source.toolsEnabled && allowTools;
    runtime.rag = !!source.rag && allowRag;
    runtime.webMode = allowWeb ? (source.webMode || 'off') : 'off';

    let blockedReason = '';
    if (account.authRequired && !account.signedIn){
      blockedReason = account.config.clientIdConfigured
        ? 'سجّل الدخول ببريدك الشخصي للمتابعة والوصول إلى الخطة المجانية أو المدفوعة.'
        : 'تسجيل Google غير مضبوط بعد. أضف Google Client ID في إعدادات المنصة أو من تهيئة الـ Worker.';
    }
    if (!blockedReason && freeMode && !(normalizeUrl(resolveGatewayApiRoot(runtime)) || isOpenRouter(runtime))){
      blockedReason = 'الوضع المجاني يحتاج Gateway أو OpenRouter مباشر حتى يعمل على مستوى التطبيق بالكامل.';
    } else if (!blockedReason && !hasAuthReady(runtime)){
      blockedReason = freeMode
        ? 'الوضع المجاني يحتاج Gateway أو OpenRouter مباشر مع إعداد مصادقة صالح.'
        : getMissingAuthMessage(runtime);
    }

    return {
      freeMode,
      costGuard,
      caps,
      runtime,
      notes,
      allowChat: !blockedReason,
      blockedReason,
      allowTools,
      allowWeb,
      allowDeepMode,
      allowAgentMode,
      allowDeepSearch,
      allowResearch,
      allowEmbeddings,
      allowRag,
      allowThreadSummary,
      modeLabel: `${getFreeModeLabel(freeMode)} • ${getCostGuardLabel(costGuard)}`
    };
  }

  function getRuntimeSettings(raw = getSettings()){
    return getAppRuntimePolicy(raw).runtime;
  }

  function getEffectiveModeState(raw = getSettings(), policy = getAppRuntimePolicy(raw)){
    return {
      deep: policy.allowDeepMode && isDeep(),
      agent: policy.allowAgentMode && isAgent(),
      web: policy.allowWeb && getWebToggle(),
      deepSearch: policy.allowDeepSearch && isDeepSearch(),
      rag: policy.allowRag && getRagToggle(),
      tools: !!policy.runtime.toolsEnabled
    };
  }

  function estimateTranscribeComplexity(meta = {}){
    const pages = Math.max(0, Number(meta.pages || meta.pageCount || 0));
    const sizeMB = Math.max(0, Number(meta.sizeMB || 0));
    if (pages >= 80 || sizeMB >= 30) return 'ضخم';
    if (pages >= 36 || sizeMB >= 15) return 'كبير';
    if (pages >= 12 || sizeMB >= 5) return 'متوسط';
    if (pages || sizeMB) return 'خفيف';
    return 'غير محسوب';
  }

  function buildTranscribeSourceMeta(file, partial = {}){
    const fallbackName = partial?.name || partial?.fileName || file?.name || 'document';
    const isPdf = (typeof partial?.isPdf === 'boolean')
      ? partial.isPdf
      : (/\.pdf$/i.test(String(fallbackName || '')) || String(partial?.mimeType || file?.type || '').includes('pdf'));
    const sizeMB = Number.isFinite(Number(partial?.sizeMB))
      ? Number(partial.sizeMB)
      : Number(((Number(file?.size || 0) || 0) / 1048576).toFixed(2));
    const pages = Number.isFinite(Number(partial?.pages || partial?.pageCount))
      ? Number(partial.pages || partial.pageCount)
      : 0;
    const textLength = Number.isFinite(Number(partial?.textLength))
      ? Number(partial.textLength)
      : Number(String(partial?.text || '').length || 0);
    const base = {
      name: fallbackName,
      mimeType: partial?.mimeType || file?.type || '',
      isPdf,
      isImage: !isPdf && String(partial?.mimeType || file?.type || '').startsWith('image/'),
      sizeMB,
      pages,
      pageCount: pages,
      textLength
    };
    return {
      ...base,
      ...partial,
      complexity: partial?.complexity || estimateTranscribeComplexity({ ...base, ...partial })
    };
  }

  function getCloudPolicyLimits(settings = getSettings()){
    return {
      maxPages: clamp(Number(settings.maxCloudPdfPages || DEFAULT_SETTINGS.maxCloudPdfPages), 1, 400),
      maxFileMB: clamp(Number(settings.maxCloudFileMB || DEFAULT_SETTINGS.maxCloudFileMB), 1, 200)
    };
  }

  function canUseCloudFeature(feature, meta = {}, settings = getSettings()){
    const sourceMeta = buildTranscribeSourceMeta(meta?.file || null, meta);
    const { maxPages, maxFileMB } = getCloudPolicyLimits(settings);

    if (settings.freeMode){
      return { ok:false, reason:'الوضع المجاني يفرض المعالجة المحلية ويوقف الخدمات السحابية.' };
    }
    if (feature === 'ocr' && !settings.allowCloudOcr){
      return { ok:false, reason:'OCR السحابي متوقف من الإعدادات.' };
    }
    if (feature === 'polish' && !settings.allowCloudPolish){
      return { ok:false, reason:'التحسين السحابي متوقف من الإعدادات.' };
    }
    if (feature === 'docx' && !normalizeEndpointUrl(settings.cloudConvertEndpoint || settings.cloudConvertFallbackEndpoint || '')){
      return { ok:false, reason:'رابط تحويل PDF إلى Word السحابي غير مضبوط.' };
    }
    if ((feature === 'docx' || feature === 'ocr') && sourceMeta.isPdf){
      if (sourceMeta.pages && sourceMeta.pages > maxPages){
        return { ok:false, reason:`عدد الصفحات ${sourceMeta.pages} يتجاوز حد السحابة (${maxPages}).` };
      }
      if (sourceMeta.sizeMB && sourceMeta.sizeMB > maxFileMB){
        return { ok:false, reason:`حجم الملف ${sourceMeta.sizeMB.toFixed(1)}MB يتجاوز حد السحابة (${maxFileMB}MB).` };
      }
    }
    if (settings.costGuard === 'strict'){
      if (feature === 'polish'){
        return { ok:false, reason:'وضع التكلفة الصارم يمنع التحسين السحابي للنص.' };
      }
      if (feature === 'ocr' && sourceMeta.pages && sourceMeta.pages > Math.max(6, Math.floor(maxPages * 0.5))){
        return { ok:false, reason:'وضع التكلفة الصارم يقيّد OCR السحابي للملفات الكبيرة.' };
      }
    }
    if (settings.costGuard === 'balanced' && feature === 'polish' && sourceMeta.textLength > 24000){
      return { ok:false, reason:'النص طويل جدًا للتحسين السحابي ضمن وضع التكلفة المتوازن.' };
    }
    return {
      ok: true,
      reason: settings.costGuard === 'open'
        ? 'إعدادات التكلفة الحالية تسمح باستخدام المسار السحابي لهذا الملف.'
        : 'الملف ضمن حدود التكلفة الحالية.'
    };
  }

  function decidePdfDocxRoute(mode, meta = {}, settings = getSettings()){
    if (mode === 'local'){
      return { route:'local', reason:'تم اختيار التحويل المحلي يدويًا.' };
    }
    const policy = canUseCloudFeature('docx', meta, settings);
    if (mode === 'cloud'){
      return policy.ok
        ? { route:'cloud', reason:'تم اختيار التحويل السحابي وهو متاح لهذا الملف.' }
        : { route:'local', reason:`تعذر استخدام التحويل السحابي: ${policy.reason}` };
    }
    if (policy.ok){
      return {
        route:'cloud',
        reason: settings.costGuard === 'open'
          ? 'المسار السحابي متاح لهذا الملف حسب الإعدادات الحالية.'
          : 'المسار السحابي متاح لهذا الملف ضمن حدود التكلفة الحالية.'
      };
    }
    return { route:'local', reason: policy.reason || 'تمت العودة إلى التحويل المحلي.' };
  }

  async function readPdfPageCount(file){
    if (!file || !window.pdfjsLib) return 0;
    const pdfjsLib = window.pdfjsLib;
    try{ pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"; }catch(_){ }
    const ab = await file.arrayBuffer();
    const doc = await pdfjsLib.getDocument({ data: ab }).promise;
    const pages = Number(doc?.numPages || 0);
    try{ await doc.destroy(); }catch(_){ }
    return pages;
  }

  let transcribeRuntimeMeta = buildTranscribeSourceMeta(null, { name:'بدون ملف', sizeMB:0, pages:0 });
  let transcribeCloudHealthState = { ready:null, docxReady:null, ocrReady:null, fidelityReady:null, docxMode:'structured', note:'' };

  function renderTranscribeOperationalState(meta = transcribeRuntimeMeta){
    transcribeRuntimeMeta = buildTranscribeSourceMeta(meta?.file || null, meta);
    const rawSettings = getSettings();
    const policy = getAppRuntimePolicy(rawSettings);
    const settings = policy.runtime;
    const routeDecision = decidePdfDocxRoute(getTranscribeDocxMode(), transcribeRuntimeMeta, settings);
    const cloudRoot = getConvertWorkerRoot(settings);

    let cloudLabel = 'غير مضبوط';
    if (cloudRoot){
      if (transcribeCloudHealthState.docxReady === true || transcribeCloudHealthState.ready === true){
        if (transcribeCloudHealthState.fidelityReady){
          cloudLabel = transcribeCloudHealthState.ocrReady === false
            ? 'DOCX عالي المطابقة • جاهز • OCR فقط غير مهيأ'
            : 'DOCX عالي المطابقة • جاهز';
        } else {
          cloudLabel = transcribeCloudHealthState.ocrReady === false
            ? 'DOCX جاهز • المطابقة العالية غير مفعلة • OCR فقط غير مهيأ'
            : 'DOCX جاهز • المطابقة العالية غير مفعلة';
        }
      } else if (transcribeCloudHealthState.ready === false){
        cloudLabel = transcribeCloudHealthState.note || 'الخدمة غير جاهزة';
      } else {
        cloudLabel = 'مضبوط • بانتظار الفحص';
      }
    }

    const sourceBits = [];
    if (transcribeRuntimeMeta.isPdf && transcribeRuntimeMeta.pages) sourceBits.push(`${transcribeRuntimeMeta.pages} صفحة`);
    if (transcribeRuntimeMeta.sizeMB) sourceBits.push(`${transcribeRuntimeMeta.sizeMB.toFixed(1)}MB`);
    sourceBits.push(transcribeRuntimeMeta.complexity || 'غير محسوب');

    if ($('transcribeRouteState')) $('transcribeRouteState').textContent = routeDecision.route === 'cloud' ? 'سحابي' : 'محلي';
    if ($('transcribeBudgetState')) $('transcribeBudgetState').textContent = `${getCostGuardLabel(policy.costGuard)} • ${policy.freeMode ? 'مجاني' : 'مدفوع حسب الاستخدام'}`;
    if ($('transcribeCloudState')) $('transcribeCloudState').textContent = cloudLabel;
    if ($('transcribeDocProfile')) $('transcribeDocProfile').textContent = sourceBits.join(' • ');

    if ($('settingsConvertState')) $('settingsConvertState').textContent = cloudRoot ? cloudLabel : 'غير مضبوط';
    if ($('settingsCostState')) $('settingsCostState').textContent = policy.modeLabel;
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
  function sanitizeRenderedHtml(html){
    if (typeof document === 'undefined') return String(html || '');
    const tpl = document.createElement('template');
    tpl.innerHTML = String(html || '');
    tpl.content.querySelectorAll('script,iframe,object,embed,link,meta').forEach((el) => el.remove());
    tpl.content.querySelectorAll('*').forEach((el) => {
      [...el.attributes].forEach((attr) => {
        const name = String(attr.name || '').toLowerCase();
        const value = String(attr.value || '');
        if (name.startsWith('on') || name === 'srcdoc'){
          el.removeAttribute(attr.name);
          return;
        }
        if ((name === 'href' || name === 'src') && /^\s*javascript:/i.test(value)){
          el.removeAttribute(attr.name);
        }
      });
      if (el.tagName === 'A'){
        const href = String(el.getAttribute('href') || '').trim();
        if (/^(https?:|mailto:|tel:)/i.test(href)){
          el.setAttribute('target', '_blank');
          el.setAttribute('rel', 'noopener noreferrer');
        }
        if (/^(data:|blob:)/i.test(href)){
          el.setAttribute('download', '');
        }
      }
    });
    return tpl.innerHTML;
  }
  function renderMarkdown(s){
    try{
      if (window.marked) return sanitizeRenderedHtml(window.marked.parse(String(s||'')));
    }catch(_){}
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
const getChatToolbarPinned = () => (localStorage.getItem(KEYS.chatToolbarPinned) || 'true') === 'true';
const setChatToolbarPinned = (v) => localStorage.setItem(KEYS.chatToolbarPinned, v ? 'true' : 'false');
const getSidebarPinned = () => (localStorage.getItem(KEYS.sidebarPinned) || 'false') === 'true';
const setSidebarPinned = (v) => localStorage.setItem(KEYS.sidebarPinned, v ? 'true' : 'false');
const getFocusMode = () => (localStorage.getItem(KEYS.focusMode) || 'false') === 'true';
const setFocusMode = (v) => localStorage.setItem(KEYS.focusMode, v ? 'true' : 'false');
const getStudyMode = () => (localStorage.getItem(KEYS.studyMode) || 'false') === 'true';
const setStudyMode = (v) => localStorage.setItem(KEYS.studyMode, v ? 'true' : 'false');
const getTranscribeProfile = () => localStorage.getItem(KEYS.transcribeProfile) || 'balanced';
const setTranscribeProfile = (v) => localStorage.setItem(KEYS.transcribeProfile, v || 'balanced');
const getTranscribeDocxMode = () => localStorage.getItem(KEYS.transcribeDocxMode) || 'auto';
const setTranscribeDocxMode = (v) => localStorage.setItem(KEYS.transcribeDocxMode, v || 'auto');

const getToolbarCollapsedMap = () => loadJSON(KEYS.toolbarCollapsedMap, {});
const setToolbarCollapsedMap = (map) => saveJSON(KEYS.toolbarCollapsedMap, map || {});
const getWorkspaceSectionMap = () => loadJSON(KEYS.workspaceSectionMap, {});
const setWorkspaceSectionMap = (map) => saveJSON(KEYS.workspaceSectionMap, map || {});

const DEFAULT_PROJECT_BRIEF = {
  goal: '',
  audience: '',
  deliverable: '',
  constraints: '',
  memory: '',
  responseRules: '',
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
  return ['goal', 'audience', 'deliverable', 'constraints', 'memory', 'responseRules'].some((k) => String(brief?.[k] || '').trim());
}

function briefSnippet(text, limit = 44){
  const value = String(text || '').trim();
  if (!value) return '';
  return value.length > limit ? `${value.slice(0, limit)}…` : value;
}

function summarizeProjectBrief(brief = getProjectBrief()){
  const parts = [
    brief.goal,
    brief.deliverable,
    brief.audience,
    brief.memory ? 'ذاكرة محفوظة' : '',
    brief.responseRules ? 'قواعد رد' : ''
  ].map((v) => briefSnippet(v)).filter(Boolean);
  return parts.join(' • ') || 'حدّد الهدف والجمهور والمخرج المطلوب';
}

function getBriefStyleLabel(style = 'executive'){
  return ({
    executive: 'تنفيذي',
    operator: 'تشغيلي',
    deep_dive: 'تحليل عميق',
    board_ready: 'جاهز للإدارة'
  })[style] || 'تنفيذي';
}

function buildProjectBriefContext(pid = getCurProjectId()){
  const brief = getProjectBrief(pid);
  if (!hasProjectBrief(brief)) return '';
  const lines = ['سياق المشروع الدائم:'];
  if (brief.goal.trim()) lines.push(`- الهدف: ${brief.goal.trim()}`);
  if (brief.audience.trim()) lines.push(`- الجمهور: ${brief.audience.trim()}`);
  if (brief.deliverable.trim()) lines.push(`- المخرج المطلوب: ${brief.deliverable.trim()}`);
  if (brief.constraints.trim()) lines.push(`- القيود: ${brief.constraints.trim()}`);
  if (brief.memory.trim()) lines.push(`- ذاكرة المشروع: ${brief.memory.trim()}`);
  if (brief.responseRules.trim()) lines.push(`- قواعد الرد: ${brief.responseRules.trim()}`);
  if (brief.style.trim()) lines.push(`- أسلوب الرد: ${getBriefStyleLabel(brief.style.trim())}`);
  lines.push('- استخدم هذا السياق لتشكيل الإجابة والمخرجات قبل البدء في الرد.');
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
  const pinned = getChatToolbarPinned();
  document.body.classList.toggle('headerCollapsed', collapsed);
  document.body.classList.toggle('chatToolbarCollapsed', getChatToolbarCollapsed());
  document.body.classList.toggle('chatToolbarPinned', pinned);
  const collapseBtn = $('headerCollapseBtn');
  if (collapseBtn){
    collapseBtn.textContent = collapsed ? '▴' : '▾';
    collapseBtn.title = collapsed ? 'إظهار الشريط العلوي' : 'طي الشريط العلوي';
  }
  const pinBtn = $('chatToolbarPinBtn');
  if (pinBtn){
    const icon = pinBtn.querySelector('.icon');
    const label = pinBtn.querySelector('.label');
    pinBtn.classList.toggle('dark', pinned);
    pinBtn.classList.toggle('ghost', !pinned);
    pinBtn.title = pinned ? 'إلغاء تثبيت شريط الأدوات' : 'تثبيت شريط الأدوات';
    pinBtn.setAttribute('aria-label', pinBtn.title);
    if (icon) icon.textContent = pinned ? '📌' : '📍';
    if (label) label.textContent = pinned ? 'مثبت' : 'تثبيت';
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
    pinBtn.title = pinned ? 'تحويل الشريط الجانبي إلى لوحة عائمة' : 'تثبيت الشريط الجانبي';
    pinBtn.setAttribute('aria-label', pinBtn.title);
    pinBtn.innerHTML = pinned
      ? '<span class="icon">⟷</span><span class="label">مثبّت</span>'
      : '<span class="icon">⟷</span><span class="label">عائم</span>';
  }

  const historyBtn = $('historyDrawerBtn');
  if (historyBtn){
    historyBtn.title = 'فتح سجل الدردشات';
    historyBtn.setAttribute('aria-label', historyBtn.title);
    historyBtn.innerHTML = '<span class="icon">🕘</span><span class="label">السجل</span>';
  }

  const focusBtn = $('focusModeBtn');
  if (focusBtn){
    const focus = getFocusMode();
    focusBtn.classList.toggle('dark', focus);
    focusBtn.title = focus ? 'الخروج من وضع التركيز' : 'الدخول إلى وضع التركيز';
    focusBtn.setAttribute('aria-label', focusBtn.title);
    focusBtn.innerHTML = focus
      ? '<span class="icon">▣</span><span class="label">تركيز</span>'
      : '<span class="icon">▢</span><span class="label">تركيز</span>';
  }

  const studyBtn = $('studyModeBtn');
  if (studyBtn){
    const study = getStudyMode();
    studyBtn.classList.toggle('dark', study);
    studyBtn.title = study ? 'إيقاف وضع الدراسة' : 'تفعيل وضع الدراسة';
    studyBtn.setAttribute('aria-label', studyBtn.title);
    studyBtn.innerHTML = study
      ? '<span class="icon">📚</span><span class="label">وضع دراسي</span>'
      : '<span class="icon">📖</span><span class="label">وضع دراسي</span>';
  }
}

  let composerRecognition = null;
  let composerListening = false;
  let composerDictationBase = '';

  function getSpeechRecognitionCtor(){
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }

  function syncVoiceInputButton(){
    const btn = $('voiceInputBtn');
    if (!btn) return;
    btn.classList.toggle('dark', composerListening);
    btn.classList.toggle('is-recording', composerListening);
    btn.title = composerListening ? 'إيقاف الإملاء الصوتي' : 'بدء الإملاء الصوتي';
    btn.setAttribute('aria-label', btn.title);
    btn.innerHTML = composerListening
      ? '<span class="icon">🎙️</span><span class="label">إيقاف الإملاء</span>'
      : '<span class="icon">🎤</span><span class="label">إملاء صوتي</span>';
  }

  function stopComposerDictation(showToast = false){
    try{ composerRecognition?.stop?.(); }catch(_){}
    composerRecognition = null;
    composerListening = false;
    syncVoiceInputButton();
    if (showToast) toast('⏹️ تم إيقاف الإملاء الصوتي');
  }

  function startComposerDictation(){
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return toast('⚠️ الإملاء الصوتي غير مدعوم في هذا المتصفح');
    const input = $('chatInput');
    if (!input) return;

    composerDictationBase = String(input.value || '').trimEnd();
    composerRecognition = new Ctor();
    composerRecognition.lang = document.documentElement.lang === 'ar' ? 'ar-SA' : 'en-US';
    composerRecognition.continuous = true;
    composerRecognition.interimResults = true;

    composerRecognition.onstart = () => {
      composerListening = true;
      syncVoiceInputButton();
      showStatus('🎙️ الإملاء الصوتي يعمل الآن…', false);
    };

    composerRecognition.onresult = (event) => {
      const parts = [];
      for (let i = event.resultIndex; i < event.results.length; i += 1){
        const transcript = String(event.results[i]?.[0]?.transcript || '').trim();
        if (transcript) parts.push(transcript);
      }
      const dictation = parts.join(' ').trim();
      input.value = [composerDictationBase, dictation].filter(Boolean).join(composerDictationBase ? '\n' : '');
      resizeComposerInput(input);
      syncComposerMeta();
    };

    composerRecognition.onerror = (event) => {
      composerListening = false;
      syncVoiceInputButton();
      if (event?.error !== 'no-speech') toast(`⚠️ تعذّر الإملاء الصوتي: ${event?.error || 'unknown'}`);
    };

    composerRecognition.onend = () => {
      composerListening = false;
      composerRecognition = null;
      syncVoiceInputButton();
      showStatus('', false);
    };

    try{
      composerRecognition.start();
    }catch(e){
      composerListening = false;
      composerRecognition = null;
      syncVoiceInputButton();
      toast(`⚠️ تعذّر بدء الإملاء الصوتي: ${e?.message || e}`);
    }
  }

  function toggleComposerDictation(){
    if (composerListening) stopComposerDictation(true);
    else startComposerDictation();
  }


function refreshDeepSearchBtn(){
    const b = $('deepSearchToggleBtn');
    if (!b) return;
    const raw = getSettings();
    const policy = getAppRuntimePolicy(raw);
    const modes = getEffectiveModeState(raw, policy);
    b.classList.toggle('dark', modes.deepSearch);
    b.textContent = modes.deepSearch ? '🔬 بحث عميق ✓' : '🔬 بحث عميق';
    b.disabled = !policy.allowDeepSearch;
    b.title = policy.allowDeepSearch ? 'تشغيل/إيقاف البحث العميق' : getPolicyFeatureReason('deepSearch', policy);
  }

  function setControlAvailability(el, enabled, note=''){
    if (!el) return;
    if (!el.dataset.baseTitle) el.dataset.baseTitle = el.getAttribute('title') || '';
    el.disabled = !enabled;
    el.classList.toggle('is-disabled', !enabled);
    if (enabled){
      el.removeAttribute('aria-disabled');
      if (el.dataset.baseTitle) el.setAttribute('title', el.dataset.baseTitle);
    } else {
      el.setAttribute('aria-disabled', 'true');
      if (note) el.setAttribute('title', note);
    }
  }

  function refreshModeButtons(){
    const raw = getSettings();
    const policy = getAppRuntimePolicy(raw);
    const modes = getEffectiveModeState(raw, policy);

    const deepBtn = $('modeDeepBtn');
    if (deepBtn){
      deepBtn.classList.toggle('dark', modes.deep);
      deepBtn.innerHTML = '<span class="icon">🧠</span><span class="label">عميق</span>';
      setControlAvailability(deepBtn, policy.allowDeepMode, getPolicyFeatureReason('deepMode', policy));
    }
    const agentBtn = $('modeAgentBtn');
    if (agentBtn){
      agentBtn.classList.toggle('dark', modes.agent);
      agentBtn.innerHTML = '<span class="icon">🤖</span><span class="label">وكيل</span>';
      setControlAvailability(agentBtn, policy.allowAgentMode, getPolicyFeatureReason('agentMode', policy));
    }
    const webBtn = $('webToggleBtn');
    if (webBtn){
      webBtn.classList.toggle('dark', modes.web);
      webBtn.innerHTML = '<span class="icon">🔎</span><span class="label">ويب</span>';
      setControlAvailability(webBtn, policy.allowWeb, getPolicyFeatureReason('web', policy));
    }
    $('streamToggle') && ($('streamToggle').checked = !!raw.streaming);
    if ($('ragToggle')){
      $('ragToggle').checked = modes.rag;
      setControlAvailability($('ragToggle'), policy.allowRag, getPolicyFeatureReason('rag', policy));
    }
    if ($('toolsToggle')){
      $('toolsToggle').checked = !!policy.runtime.toolsEnabled;
      setControlAvailability($('toolsToggle'), policy.allowTools, getPolicyFeatureReason('tools', policy));
    }
    if ($('toolsDefault')){
      $('toolsDefault').checked = !!policy.runtime.toolsEnabled;
      setControlAvailability($('toolsDefault'), policy.allowTools, getPolicyFeatureReason('tools', policy));
    }
    if ($('researchBtn')) setControlAvailability($('researchBtn'), policy.allowResearch, getPolicyFeatureReason('research', policy));
    if ($('kbBuildBtn')) setControlAvailability($('kbBuildBtn'), policy.allowEmbeddings, getPolicyFeatureReason('embeddings', policy));
    if ($('kbSearchBtn')) setControlAvailability($('kbSearchBtn'), policy.allowEmbeddings, getPolicyFeatureReason('embeddings', policy));
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

  function getNumericModelPrice(value){
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  function isFreeTierModel(model){
    const id = String(model?.id || model || '').trim().toLowerCase();
    if (!id) return false;
    if (id === 'openrouter/free' || id.includes(':free')) return true;
    const promptPrice = getNumericModelPrice(model?.pp);
    const completionPrice = getNumericModelPrice(model?.pc);
    if (promptPrice !== null && promptPrice <= 0 && (completionPrice === null || completionPrice <= 0)) return true;
    return false;
  }

  function getAuthStateLabel(settings){
    if (settings.provider === 'gemini') return (settings.geminiKey || '').trim() ? 'مفتاح Gemini جاهز' : 'يلزم مفتاح Gemini';
    if (settings.authMode === 'gateway') return (settings.gatewayUrl || '').trim() ? 'ربط عبر البوابة' : 'البوابة غير مضبوطة';
    return (settings.apiKey || '').trim() ? 'مفتاح المتصفح جاهز' : 'يلزم مفتاح API';
  }

  function buildQuickPromptTemplate(kind){
    const templates = {
      strategy_brief: 'أنشئ brief استراتيجي احترافي لهذا الطلب. المطلوب: 1) الهدف 2) الوضع الحالي 3) الفرص 4) المخاطر 5) خطة التنفيذ 6) المخرجات النهائية.',
      deep_research: 'نفّذ بحثًا عميقًا منظمًا. ابدأ بخطة بحث، ثم أسئلة التحقيق، ثم النتائج، ثم الاستنتاجات، ثم التوصيات العملية.',
      system_audit: 'قم بمراجعة تشغيلية للنظام أو التطبيق الحالي. أريد: المشاكل، الأولويات، المخاطر، الإصلاحات السريعة، وخطة تحسين احترافية.',
      build_product: 'ساعدني في بناء منتج احترافي من هذه الفكرة. أريد: التموضع، البنية، تدفقات الاستخدام، خارطة الطريق، ومواصفات الإصدار الأول.',
      exec_summary: 'اكتب ملخصًا تنفيذيًا واضحًا وموجزًا مع النقاط الحاسمة والقرار المقترح.',
      action_board: 'حوّل هذا السياق إلى لوحة تنفيذ: المهمة، المالك، الأولوية، الموعد، الحالة، والخطوة التالية.',
      kb_orchestrator: 'استخدم الملفات وقاعدة المعرفة لبناء إجابة موثقة باقتباسات واضحة، ثم لخص الفجوات والمعلومات غير المؤكدة.',
      launch_plan: 'أنشئ خطة إطلاق متكاملة: الجاهزية، الأصول المطلوبة، المخاطر، الجدول الزمني، المسؤوليات، ومؤشرات النجاح.',
      pm_review: 'قم بدور خبير استراتيجية منتج وراجع الفكرة أو التطبيق: القيمة، تجربة الاستخدام، الفجوات، عناصر التميز، ثم توصية تنفيذية.'
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
    else toast('✅ تم تجهيز طلب احترافي');
  }

  function resizeComposerInput(input = $('chatInput')){
    if (!input || input.tagName !== 'TEXTAREA') return;
    input.style.height = 'auto';
    input.style.height = `${Math.min(220, Math.max(58, input.scrollHeight))}px`;
  }

  function getBrandMarkHtml(){
    return `<img src="logo.svg" alt="شعار AI Workspace Studio" />`;
  }

  function getAuthGoogleClientId(settings = getSettings()){
    const config = getEffectiveAuthConfig(settings);
    return String(config.googleClientId || '').trim();
  }

  function getAndroidGoogleSetupHint(){
    return `أضف Android OAuth Client في Google Cloud باستخدام Package Name: ${ANDROID_GOOGLE_SETUP.packageName} وSHA-1: ${ANDROID_GOOGLE_SETUP.releaseSha1}.`;
  }

  function maybeShowNativeAuthDialog(message, tone = 'error'){
    if (!isNativeAndroidPlatform() || tone !== 'error') return;
    if (!$('authGate')?.classList.contains('show')) return;
    const text = String(message || '').trim();
    if (!text) return;
    const signature = `${tone}:${text}`;
    if (NATIVE_GOOGLE_RUNTIME.lastDialogMessage === signature) return;
    NATIVE_GOOGLE_RUNTIME.lastDialogMessage = signature;
    window.setTimeout(() => {
      try{ window.alert(text); }catch(_){}
    }, 30);
  }

  function explainAuthError(error, { nativeGoogle = false } = {}){
    const raw = String(error?.message || error || '').trim();
    if (!raw) return 'تعذر إكمال عملية تسجيل الدخول.';
    if (/Missing Google credential|Malformed Google credential/i.test(raw)){
      return nativeGoogle
        ? `تم اختيار الحساب لكن التطبيق لم يستلم رمز الدخول الكامل من Google على Android. ${getAndroidGoogleSetupHint()}`
        : 'لم يصل رمز الدخول الكامل من Google. حاول مرة أخرى.';
    }
    if (/Only Gmail accounts are allowed/i.test(raw)){
      return 'هذا التطبيق يسمح حاليًا فقط بحسابات Gmail الشخصية.';
    }
    if (/Google credential audience mismatch/i.test(raw)){
      return nativeGoogle
        ? `تم اختيار الحساب لكن الخادم رفض رمز Google لهذا التطبيق على Android. ${getAndroidGoogleSetupHint()}`
        : 'رمز Google لا يطابق إعدادات التطبيق الحالية. تحقق من Google Client ID.';
    }
    if (/Google Client ID is not configured/i.test(raw)){
      return 'Google Client ID غير مضبوط على الخادم بعد.';
    }
    if (/This email is configured as the admin account/i.test(raw)){
      return 'هذا البريد هو بريد الإدارة. استخدم كلمة مرور الإدارة من نفس شاشة الدخول.';
    }
    return raw;
  }

  function isEditableElement(element = document.activeElement){
    if (!element || !(element instanceof HTMLElement)) return false;
    if (element.isContentEditable) return true;
    const tag = String(element.tagName || '').toUpperCase();
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  }

  function isAndroidKeyboardEditing(){
    return isNativeAndroidPlatform() && isEditableElement();
  }

  function syncKeyboardEditingState(){
    document.body.classList.toggle('keyboardEditing', isAndroidKeyboardEditing());
  }

  function getCapacitorPlatform(){
    try{
      const platform = window.Capacitor?.getPlatform?.();
      return platform ? String(platform).toLowerCase() : 'web';
    }catch(_){
      return 'web';
    }
  }

  function isNativePlatform(){
    try{
      return !!window.Capacitor?.isNativePlatform?.();
    }catch(_){
      return getCapacitorPlatform() !== 'web';
    }
  }

  function isNativeAndroidPlatform(){
    return isNativePlatform() && getCapacitorPlatform() === 'android';
  }

  function getNativeGoogleAuthPlugin(){
    return window.Capacitor?.Plugins?.GoogleOneTapAuth || null;
  }

  async function ensureNativeGoogleAuthReady(){
    if (!isNativeAndroidPlatform()) return null;
    const plugin = getNativeGoogleAuthPlugin();
    const clientId = getAuthGoogleClientId();
    if (!plugin || !clientId) return null;
    if (NATIVE_GOOGLE_RUNTIME.initialized) return plugin;
    if (!NATIVE_GOOGLE_RUNTIME.initPromise){
      NATIVE_GOOGLE_RUNTIME.initPromise = Promise.resolve(plugin.initialize({ clientId }))
        .then(() => {
          NATIVE_GOOGLE_RUNTIME.initialized = true;
          return plugin;
        })
        .catch((error) => {
          NATIVE_GOOGLE_RUNTIME.initPromise = null;
          throw error;
        });
    }
    return NATIVE_GOOGLE_RUNTIME.initPromise;
  }

  function getNativeGoogleFailureMessage(result, fallback = 'تعذر تسجيل الدخول من Google على هذا الجهاز.'){
    if (result?.isSuccess && !String(result?.success?.idToken || '').trim()){
      const info = String(result?.success?.message || result?.noSuccess?.noSuccessAdditionalInfo || '').trim();
      return info
        ? `تم اختيار الحساب لكن Google لم يرسل رمز الدخول الكامل لهذا التطبيق على Android.\n${info}`
        : `تم اختيار الحساب لكن Google لم يرسل رمز الدخول الكامل لهذا التطبيق على Android. ${getAndroidGoogleSetupHint()}`;
    }
    const reason = String(result?.noSuccess?.noSuccessReasonCode || '').trim();
    const info = String(result?.noSuccess?.noSuccessAdditionalInfo || '').trim();
    if (reason === 'SIGN_IN_CANCELLED'){
      if (/activity.*cancelled|cancell?ed by the user|dismissed by the user/i.test(info)){
        return 'تم إلغاء تسجيل الدخول من Google.';
      }
      if (/ApiException:\s*10|Caller not whitelisted|OAuth 2\.0 Client ID of type 'Android'|SHA-1 certificate fingerprint|Package name:/i.test(info)){
        return `تم اختيار الحساب لكن Google أوقف تسجيل الدخول لأن إعداد Android OAuth غير مكتمل أو لا يطابق توقيع التطبيق. ${getAndroidGoogleSetupHint()}\n${info}`;
      }
      if (info){
        return `تم إيقاف تسجيل Google على Android بعد اختيار الحساب.\n${info}`;
      }
      return 'تم إلغاء تسجيل الدخول من Google.';
    }
    if (reason === 'NO_CREDENTIAL'){
      return 'لم يجد Android جلسة Google جاهزة لهذا التطبيق بعد. اضغط زر المتابعة لاختيار الحساب من الجهاز.';
    }
    if (/Caller not whitelisted|ApiException:\s*10|OAuth 2\.0 Client ID of type 'Android'/i.test(info)){
      return `تم اختيار الحساب لكن Google رفض إصدار رمز الدخول لهذا التطبيق على Android. ${getAndroidGoogleSetupHint()}`;
    }
    if (/GooglePlayService|GooglePlay is not installed|must be logged in/i.test(info)){
      return 'خدمات Google Play غير جاهزة على الجهاز. حدّث Google Play وسجّل الدخول فيه ثم أعد المحاولة.';
    }
    if (info) return `${fallback}\n${info}`;
    return fallback;
  }

  async function handleNativeGoogleSignInResult(result, { silent = false } = {}){
    if (result?.isSuccess && result?.success?.idToken){
      NATIVE_GOOGLE_RUNTIME.lastDialogMessage = '';
      setAuthGateStatus('تم اختيار حساب Google بنجاح. جارٍ إنشاء الجلسة...', 'busy');
      await handleGoogleCredentialResponse({ credential: result.success.idToken });
      return true;
    }
    if (!silent){
      const tone = String(result?.noSuccess?.noSuccessReasonCode || '').trim() === 'SIGN_IN_CANCELLED' ? 'info' : 'error';
      const message = getNativeGoogleFailureMessage(result);
      setAuthGateStatus(message, tone);
      toast(`${tone === 'info' ? 'ℹ️' : '⚠️'} ${message}`);
    }
    return false;
  }

  async function tryNativeGoogleAutoSignIn(){
    if (!isNativeAndroidPlatform() || NATIVE_GOOGLE_RUNTIME.autoAttempted || hasValidAuthSession()) return false;
    NATIVE_GOOGLE_RUNTIME.autoAttempted = true;
    try{
      const plugin = await ensureNativeGoogleAuthReady();
      if (!plugin) return false;
      const result = await plugin.tryAutoSignIn();
      return await handleNativeGoogleSignInResult(result, { silent: true });
    }catch(error){
      setAuthGateStatus(`تعذر تهيئة Google على Android: ${error?.message || error}`, 'error');
      return false;
    }
  }

  async function startNativeGoogleButtonFlow(){
    try{
      NATIVE_GOOGLE_RUNTIME.lastDialogMessage = '';
      setAuthGateStatus('جارٍ فتح تسجيل Google الأصلي على Android...', 'busy');
      const plugin = await ensureNativeGoogleAuthReady();
      if (!plugin){
        throw new Error('Google Sign-In غير متاح داخل نسخة Android الحالية.');
      }
      const result = await plugin.signInWithGoogleButtonFlowForNativePlatform();
      const success = await handleNativeGoogleSignInResult(result);
      if (!success && String(result?.noSuccess?.noSuccessReasonCode || '').trim() === 'SIGN_IN_CANCELLED'){
        setAuthGateStatus('تم إلغاء تسجيل الدخول من Google.', 'info');
      }
    }catch(error){
      setAuthGateStatus(`تعذر فتح تسجيل Google على Android: ${error?.message || error}`, 'error');
    }
  }

  async function renderNativeGoogleButton(slot){
    const plugin = getNativeGoogleAuthPlugin();
    if (!plugin){
      slot.innerHTML = '<div class="hint">نسخة Android الحالية لا تحتوي على إضافة Google الأصلية. أعد تثبيت التطبيق بعد التحديث.</div>';
      setAuthGateStatus('إضافة Google الأصلية غير متاحة داخل نسخة Android الحالية.', 'error');
      return;
    }
    slot.innerHTML = `
      <div class="native-google-auth">
        <button class="native-google-btn" type="button" id="nativeGoogleSignInBtn">
          <span class="native-google-mark" aria-hidden="true">G</span>
          <span>المتابعة باستخدام Google</span>
        </button>
        <div class="hint">على Android سيظهر تسجيل Google الأصلي للجهاز بدل زر الويب.</div>
      </div>`;
    $('nativeGoogleSignInBtn')?.addEventListener('click', startNativeGoogleButtonFlow);
    await tryNativeGoogleAutoSignIn();
  }

  function setAuthGateStatus(message, tone = 'info'){
    const box = $('authGateStatus');
    if (!box) return;
    const text = String(message || 'سجّل الدخول ببريدك الشخصي لفتح الخطة المجانية، أو استخدم بريد الإدارة مع كلمة المرور من نفس الشاشة.').trim();
    if (!text){
      box.hidden = true;
      box.style.display = 'none';
      box.textContent = '';
      delete box.dataset.tone;
      return;
    }
    box.hidden = false;
    box.style.display = 'block';
    box.dataset.tone = tone;
    box.textContent = text;
    box.setAttribute('role', tone === 'error' ? 'alert' : 'status');
    box.setAttribute('aria-live', tone === 'error' ? 'assertive' : 'polite');
    requestAnimationFrame(() => {
      try{ box.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }catch(_){}
    });
    maybeShowNativeAuthDialog(text, tone);
  }

  function syncAccountPlanControls(){
    const account = getAccountRuntimeState();
    const freeLocked = account.authRequired && !account.premium;
    if ($('freeMode')){
      $('freeMode').checked = freeLocked ? true : !!getSettings().freeMode;
      $('freeMode').disabled = freeLocked;
      $('freeMode').title = freeLocked ? 'الخطة المجانية تفرض الوضع المجاني تلقائيًا.' : '';
    }
    if ($('costGuard')){
      if (freeLocked) $('costGuard').value = 'strict';
      $('costGuard').disabled = freeLocked;
      $('costGuard').title = freeLocked ? 'الخطة المجانية تفرض سياسة تكلفة اقتصادية صارمة.' : '';
    }
    if ($('provider')){
      if (freeLocked) $('provider').value = 'openrouter';
      $('provider').disabled = freeLocked;
      $('provider').title = freeLocked ? 'الخطة المجانية تفرض تشغيل OpenRouter Free فقط.' : '';
    }
    if ($('model')){
      if (freeLocked) $('model').value = 'openrouter/free';
      $('model').disabled = freeLocked;
      $('model').title = freeLocked ? 'الخطة المجانية تمنع تفعيل أي موديل مدفوع.' : '';
    }
    if ($('pickModelBtn')){
      $('pickModelBtn').disabled = false;
      $('pickModelBtn').title = freeLocked
        ? 'يمكنك استعراض النماذج المجانية فقط داخل الخطة المجانية.'
        : 'الموديلات';
    }
  }

  function ensureAccountChrome(){
    const brand = document.querySelector('.brand');
    if (brand && !brand.querySelector('.brand-identity')){
      brand.innerHTML = `
        <div class="brand-identity">
          <div class="brand-mark">${getBrandMarkHtml()}</div>
          <div class="brand-copy">
            <div class="name">AI Workspace Studio</div>
            <div class="sub">منصة عربية للدردشة والبحث والملفات وسير العمل</div>
            <span class="developer-credit">تم تطوير التطبيق بواسطة صدام القاضي</span>
          </div>
        </div>
        <button class="iconbtn" id="closeSideBtn" title="إغلاق">✕</button>`;
    }

    const topActions = document.querySelector('.topbar .topbar-actions');
    if (topActions && !$('accountTriggerBtn')){
      const button = document.createElement('button');
      button.type = 'button';
      button.id = 'accountTriggerBtn';
      button.className = 'btn ghost sm with-label account-trigger';
      button.innerHTML = `
        <img class="account-avatar" id="accountTriggerAvatar" alt="" />
        <span>
          <strong id="accountTriggerName">الحساب</strong>
          <span id="accountTriggerPlan">الخطة المجانية</span>
        </span>`;
      topActions.insertBefore(button, $('historyDrawerBtn') || $('focusModeBtn') || $('headerCollapseBtn'));
    }

    if (!$('authGate')){
      document.body.insertAdjacentHTML('afterbegin', `
        <div class="auth-gate" id="authGate">
          <div class="auth-shell">
            <section class="auth-hero">
              <div class="brand-identity">
                <div class="brand-mark">${getBrandMarkHtml()}</div>
                <div class="brand-copy">
                  <div class="name">AI Workspace Studio</div>
                  <div class="sub">دردشة • معرفة • ملفات • مشاريع • تحويلات</div>
                </div>
              </div>
              <div class="auth-kicker">بوابة الدخول</div>
              <h1 class="auth-title">واجهة دخول واحدة، وخطة مناسبة لكل حساب.</h1>
              <p class="auth-copy">ابدأ بالخطة المجانية من بريدك الشخصي، ثم اطلب الترقية من داخل التطبيق عند الحاجة. إذا كان البريد هو بريد الإدارة فسيُفعّل نفس النموذج دخول الإدارة.</p>
              <div class="auth-plan-row">
                <div class="auth-plan-pill"><b>الخطة المجانية</b><span>نماذج مجانية وحدود تكلفة آمنة</span></div>
                <div class="auth-plan-pill"><b>الخطة المدفوعة</b><span>تُفعّل بعد كود ترقية أو دخول الإدارة</span></div>
              </div>
              <div class="auth-feature-grid">
                <div class="auth-feature"><strong>دخول مباشر</strong><span>Google أو البريد من نفس الشاشة، بدون خطوات منفصلة.</span></div>
                <div class="auth-feature"><strong>ترقية داخلية</strong><span>طلب الترقية وإدخال الكود يتمان من داخل الحساب نفسه.</span></div>
                <div class="auth-feature"><strong>سجل مرتبط بالحساب</strong><span>المشاريع والمحادثات والملفات تبقى ضمن جلستك الحالية.</span></div>
                <div class="auth-feature"><strong>سياسة تكلفة واضحة</strong><span>الخطة المجانية لا تفعّل الموديلات المدفوعة أو المزايا الأعلى تكلفة.</span></div>
              </div>
              <div class="auth-developer">تم تطوير التطبيق بواسطة صدام القاضي</div>
            </section>
            <section class="auth-card">
              <div class="auth-form-head">
                <div class="auth-form-head-copy">
                  <h2>تسجيل الدخول إلى المنصة</h2>
                  <p>استخدم بريدك الشخصي للدخول إلى الخطة المجانية، أو تابع عبر Google إذا كان الربط متاحًا.</p>
                </div>
                <span class="plan-pill" id="authCurrentPlanPill">الخطة المجانية</span>
              </div>
              <div class="auth-status status" id="authGateStatus" data-tone="info">سجّل الدخول ببريدك الشخصي لفتح الخطة المجانية، أو استخدم بريد الإدارة مع كلمة المرور من نفس الشاشة.</div>
              <div class="auth-config-grid" style="margin-top:12px">
                <div>
                  <label class="hint">الاسم</label>
                  <input id="authEntryName" type="text" placeholder="الاسم الظاهر داخل التطبيق" />
                </div>
                <div>
                  <label class="hint">البريد الإلكتروني</label>
                  <input id="authEntryEmail" type="email" placeholder="name@example.com" />
                </div>
                <div style="grid-column:1/-1">
                  <label class="hint" id="authEntryPasswordLabel">كلمة المرور للإدارة فقط</label>
                  <input id="authEntryPassword" type="password" placeholder="اختيارية للمستخدم العادي، ومطلوبة فقط إذا كان هذا بريد الإدارة" />
                </div>
              </div>
              <div class="auth-note" id="authEntryModeHint">أي بريد شخصي صالح يفتح لك الخطة المجانية تلقائيًا. إذا أدخلت بريد الإدارة، سيتحول الزر تلقائيًا إلى دخول الإدارة.</div>
              <div class="auth-access-note">
                <strong>ماذا يحدث بعد الدخول؟</strong>
                <span>يفتح الحساب العادي بالخطة المجانية مع الميزات المسموح بها فقط، ويمكن طلب الترقية لاحقًا من صفحة الإعدادات.</span>
              </div>
              <div class="account-actions" style="margin-top:12px">
                <button class="btn dark sm with-label" type="button" id="authEntrySubmitBtn"><span class="icon">→</span><span class="label" id="authEntrySubmitLabel">متابعة بالخطة المجانية</span></button>
              </div>
              <div class="divider"></div>
              <div class="auth-google-slot" id="googleSignInSlot"></div>
              <div class="auth-note" id="authGatePlanNote">بعد تسجيل الدخول ستبدأ بالخطة المناسبة للحساب. يمكن الترقية لاحقًا عبر طلب ترقية وكود تفعيل.</div>
              <div class="account-actions">
                <button class="btn ghost sm with-label" type="button" id="authRetryBtn"><span class="icon">↻</span><span class="label">إعادة التهيئة</span></button>
                <button class="btn ghost sm with-label" type="button" id="authCloseBtn"><span class="icon">✕</span><span class="label">إغلاق</span></button>
              </div>
            </section>
          </div>
        </div>`);
    }

    const settingsBody = document.querySelector('#page-settings .panel .body');
    if (settingsBody && !$('settingsAccountCard')){
      settingsBody.insertAdjacentHTML('afterbegin', `
        <div class="account-card" id="settingsAccountCard" style="margin-bottom:16px">
          <div class="account-summary">
            <img class="account-avatar" id="settingsAccountAvatar" alt="" />
            <div class="account-meta">
              <strong id="settingsAccountName">الحساب غير مسجل</strong>
              <span id="settingsAccountEmail">سجّل الدخول ببريدك الشخصي لتفعيل الخطة المجانية أو المدفوعة.</span>
              <span id="settingsAccountHint">تُفرض الخطة المجانية تلقائيًا بعد تسجيل الدخول، ويمكنك ترقية الحساب بكود يصل إليك عبر البريد.</span>
            </div>
            <span class="plan-pill" id="settingsPlanPill">الخطة المجانية</span>
          </div>
          <div class="status" id="settingsPlanBanner" data-tone="info">الخطة المجانية تفعّل نموذجًا مجانيًا فقط وتوقف الميزات الأعلى تكلفة تلقائيًا.</div>
          <div class="account-actions">
            <button class="btn sm with-label" type="button" id="accountSignInBtn"><span class="icon">🔐</span><span class="label">تسجيل الدخول</span></button>
            <button class="btn ghost sm with-label" type="button" id="accountUpgradeRequestBtn"><span class="icon">✉️</span><span class="label">طلب ترقية</span></button>
            <button class="btn ghost sm with-label" type="button" id="accountLogoutBtn"><span class="icon">↩</span><span class="label">تسجيل الخروج</span></button>
          </div>
          <div class="upgrade-inline" id="upgradeRedeemRow">
            <input id="upgradeCodeInput" type="text" placeholder="أدخل كود الترقية الذي وصلك عبر البريد" />
            <button class="btn dark sm with-label" type="button" id="activateUpgradeBtn"><span class="icon">⚡</span><span class="label">تفعيل الكود</span></button>
          </div>
          <details class="tool-group" id="adminUpgradePanel" style="margin-top:12px; display:none">
            <summary class="workspace-section-toggle">
              <span class="workspace-section-head">
                <span class="workspace-section-title">إدارة أكواد الترقية</span>
                <span class="workspace-section-summary">إنشاء كود ترقية مرتبط ببريد مستخدم محدد من داخل حساب الإدارة.</span>
              </span>
              <span class="workspace-section-chevron">⌄</span>
            </summary>
            <div class="tool-group-body" style="padding-top:14px">
              <div class="auth-config-grid">
                <div>
                  <label class="hint">بريد المستخدم</label>
                  <input id="adminUpgradeEmail" type="email" placeholder="user@gmail.com" />
                </div>
                <div>
                  <label class="hint">مدة الكود بالأيام</label>
                  <input id="adminUpgradeDays" type="number" min="1" max="3650" value="365" />
                </div>
              </div>
              <div class="account-actions" style="margin-top:12px">
                <button class="btn dark sm with-label" type="button" id="adminGenerateUpgradeBtn"><span class="icon">⚙</span><span class="label">إنشاء كود ترقية</span></button>
                <button class="btn ghost sm with-label" type="button" id="adminCopyUpgradeBtn" disabled><span class="icon">⧉</span><span class="label">نسخ الكود</span></button>
              </div>
              <div class="upgrade-inline" style="margin-top:12px">
                <input id="adminGeneratedCode" type="text" placeholder="سيظهر كود الترقية هنا" readonly />
              </div>
              <div class="hint" id="adminUpgradeMeta" style="margin-top:10px">هذا القسم متاح فقط لحساب الإدارة، والكود الناتج يرتبط ببريد المستخدم المحدد.</div>
            </div>
          </details>
          <div class="row" style="margin-top:10px">
            <div class="col" style="grid-column:1/-1">
              <label class="hint">بريد طلب الترقية</label>
              <input id="upgradeEmail" type="email" placeholder="tntntt830@gmail.com" />
            </div>
          </div>
        </div>`);
    }
  }

  function syncAccountUi(){
    ensureAccountChrome();
    const settings = getSettings();
    const auth = getAuthState();
    const config = getEffectiveAuthConfig(settings);
    const signedIn = hasValidAuthSession(auth);
    const plan = signedIn && auth.plan === 'premium' ? 'premium' : 'free';
    const role = auth.role === 'admin' ? 'admin' : 'user';
    const displayName = signedIn ? (auth.name || auth.email || 'الحساب') : 'تسجيل الدخول';
    const displayEmail = signedIn ? (auth.email || 'الحساب المسجل') : 'سجّل الدخول ببريدك الشخصي';
    const planLabel = getAccountPlanLabel(plan);
    const avatar = signedIn && auth.picture ? auth.picture : 'logo.svg';

    if ($('accountTriggerAvatar')) $('accountTriggerAvatar').src = avatar;
    if ($('accountTriggerName')) $('accountTriggerName').textContent = signedIn && role === 'admin' ? `الإدارة • ${displayName}` : displayName;
    if ($('accountTriggerPlan')) $('accountTriggerPlan').textContent = planLabel;

    if ($('settingsAccountAvatar')) $('settingsAccountAvatar').src = avatar;
    if ($('settingsAccountName')) $('settingsAccountName').textContent = signedIn ? (role === 'admin' ? `حساب الإدارة • ${displayName}` : displayName) : 'الحساب غير مسجل';
    if ($('settingsAccountEmail')) $('settingsAccountEmail').textContent = displayEmail;
    if ($('settingsAccountHint')) $('settingsAccountHint').textContent = signedIn
      ? (role === 'admin'
        ? 'أنت داخل حساب الإدارة. جميع المزايا المدفوعة وطبقات التحكم متاحة لهذا الحساب.'
        : plan === 'premium'
        ? 'الحساب يعمل الآن على الخطة المدفوعة. يمكنك استخدام المزايا المدفوعة أو تشغيل الوضع المجاني يدويًا لتقليل التكلفة.'
        : 'الحساب يعمل الآن على الخطة المجانية. الترقية متاحة عبر طلب بريدي ثم كود تفعيل.')
      : 'سجّل الدخول أولاً، ثم اطلب الترقية أو فعّل الكود إذا وصلك من الإدارة.';
    if ($('settingsPlanPill')){
      $('settingsPlanPill').textContent = planLabel;
      $('settingsPlanPill').classList.toggle('premium', plan === 'premium');
    }
    if ($('settingsPlanBanner')){
      $('settingsPlanBanner').dataset.tone = role === 'admin' || plan === 'premium' ? 'success' : 'info';
      $('settingsPlanBanner').textContent = role === 'admin'
        ? 'حساب الإدارة يعمل بصلاحيات كاملة ويمكنه إدارة الأكواد والمزايا المدفوعة من نفس الواجهة.'
        : plan === 'premium'
        ? 'الخطة المدفوعة نشطة. يمكنك استخدام جميع الموديلات والميزات حسب إعدادات التكلفة.'
        : 'الخطة المجانية تفرض OpenRouter Free فقط وتمنع تفعيل الموديلات المدفوعة والميزات الأعلى تكلفة.';
    }
    if ($('accountSignInBtn')) $('accountSignInBtn').textContent = signedIn ? 'إعادة المصادقة' : 'تسجيل الدخول';
    if ($('accountUpgradeRequestBtn')){
      $('accountUpgradeRequestBtn').disabled = !signedIn || role === 'admin';
      $('accountUpgradeRequestBtn').style.display = signedIn && role === 'admin' ? 'none' : '';
    }
    if ($('accountLogoutBtn')) $('accountLogoutBtn').disabled = !signedIn;
    if ($('activateUpgradeBtn')) $('activateUpgradeBtn').disabled = !signedIn;
    if ($('upgradeRedeemRow')) $('upgradeRedeemRow').style.display = signedIn && role === 'admin' ? 'none' : '';
    if ($('upgradeCodeInput') && auth.upgradeCode && !$('upgradeCodeInput').value) $('upgradeCodeInput').value = auth.upgradeCode;

    if ($('upgradeEmail')) $('upgradeEmail').value = settings.upgradeEmail || config.upgradeEmail || DEFAULT_AUTH_CONFIG.upgradeEmail;
    if ($('adminUpgradePanel')) $('adminUpgradePanel').style.display = signedIn && role === 'admin' ? '' : 'none';
    if ($('adminUpgradeEmail') && signedIn && role === 'admin' && !$('adminUpgradeEmail').value) $('adminUpgradeEmail').value = '';
    if ($('adminGenerateUpgradeBtn')) $('adminGenerateUpgradeBtn').disabled = !(signedIn && role === 'admin');
    if ($('adminCopyUpgradeBtn')) $('adminCopyUpgradeBtn').disabled = !String($('adminGeneratedCode')?.value || '').trim();
    if ($('adminUpgradeMeta') && signedIn && role === 'admin'){
      $('adminUpgradeMeta').textContent = 'أنشئ الكود ثم أرسله للمستخدم. لن يعمل الكود إلا مع البريد الذي أدخلته هنا.';
    }
    if ($('authEntryName') && !$('authEntryName').value && signedIn) $('authEntryName').value = auth.name || '';
    if ($('authEntryEmail') && !$('authEntryEmail').value && signedIn) $('authEntryEmail').value = auth.email || '';
    if ($('authGatePlanNote')) $('authGatePlanNote').textContent = role === 'admin'
      ? 'الحساب الإداري يفتح التطبيق مباشرة مع الصلاحيات الكاملة والمزايا المدفوعة.'
      : plan === 'premium'
      ? 'الحساب الحالي مدفوع. يمكنك إغلاق هذه الشاشة أو إعادة المصادقة إذا لزم.'
      : 'بعد تسجيل الدخول ستبدأ بالخطة المجانية. للترقية اطلب كودًا ثم فعّله من صفحة الإعدادات.';
    if ($('authCurrentPlanPill')){
      $('authCurrentPlanPill').textContent = role === 'admin'
        ? 'الإدارة'
        : plan === 'premium'
        ? 'الخطة المدفوعة'
        : 'الخطة المجانية';
      $('authCurrentPlanPill').classList.toggle('premium', role === 'admin' || plan === 'premium');
    }

    syncUnifiedAuthEntry();
    syncAccountPlanControls();
  }

  function syncUnifiedAuthEntry(){
    const config = getEffectiveAuthConfig();
    const email = String($('authEntryEmail')?.value || '').trim().toLowerCase();
    const isAdminEntry = !!email && email === String(config.adminEmail || DEFAULT_AUTH_CONFIG.adminEmail).trim().toLowerCase();
    const label = $('authEntrySubmitLabel');
    const hint = $('authEntryModeHint');
    const passwordLabel = $('authEntryPasswordLabel');
    const passwordInput = $('authEntryPassword');
    if (label) label.textContent = isAdminEntry ? 'دخول الإدارة' : 'متابعة بالخطة المجانية';
    if (hint) hint.textContent = isAdminEntry
      ? 'تم التعرف على بريد الإدارة. أدخل كلمة المرور لفتح الحساب الإداري من نفس الشاشة.'
      : 'أي بريد شخصي صالح يفتح لك الخطة المجانية فورًا، ويمكنك طلب الترقية لاحقًا من داخل التطبيق.';
    if ($('authCurrentPlanPill')){
      $('authCurrentPlanPill').textContent = isAdminEntry ? 'الإدارة' : 'الخطة المجانية';
      $('authCurrentPlanPill').classList.toggle('premium', isAdminEntry);
    }
    if (passwordLabel) passwordLabel.textContent = isAdminEntry ? 'كلمة مرور الإدارة' : 'كلمة المرور للإدارة فقط';
    if (passwordInput){
      passwordInput.placeholder = isAdminEntry
        ? 'أدخل كلمة مرور الإدارة'
        : 'اختيارية للمستخدم العادي، ومطلوبة فقط إذا كان هذا بريد الإدارة';
    }
  }

  function waitForGoogleIdentity(timeoutMs = 12000){
    return new Promise((resolve) => {
      const ready = () => !!(window.google && window.google.accounts && window.google.accounts.id);
      if (ready()) return resolve(true);
      const startedAt = Date.now();
      const timer = setInterval(() => {
        if (ready()){
          clearInterval(timer);
          resolve(true);
          return;
        }
        if ((Date.now() - startedAt) >= timeoutMs){
          clearInterval(timer);
          resolve(false);
        }
      }, 200);
    });
  }

  async function renderGoogleButton(force = false){
    const slot = $('googleSignInSlot');
    if (!slot) return;
    const clientId = getAuthGoogleClientId();
    if (!clientId){
      slot.innerHTML = '<div class="hint">سيظهر زر Google هنا تلقائيًا عند تفعيل الربط على الخادم. يمكنك الآن الدخول بالبريد من النموذج نفسه.</div>';
      return;
    }
    if (isNativeAndroidPlatform()){
      await renderNativeGoogleButton(slot);
      return;
    }
    const ready = await waitForGoogleIdentity();
    if (!ready){
      slot.innerHTML = '<div class="hint">تعذر تحميل خدمة Google Sign-In. تأكد من الاتصال ثم أعد المحاولة.</div>';
      setAuthGateStatus('تعذر تحميل خدمة تسجيل الدخول من Google.', 'error');
      return;
    }
    try{
      if (force) slot.innerHTML = '';
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleGoogleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: false,
        context: 'signin',
        use_fedcm_for_prompt: true
      });
      slot.innerHTML = '';
      window.google.accounts.id.renderButton(slot, {
        theme: 'filled_blue',
        size: 'large',
        shape: 'pill',
        text: 'signin_with',
        logo_alignment: 'right',
        width: Math.min(360, Math.max(260, slot.clientWidth || 320)),
        use_fedcm_for_button: true
      });
    }catch(error){
      slot.innerHTML = '<div class="hint">تعذر تهيئة زر تسجيل الدخول حاليًا.</div>';
      setAuthGateStatus(`تعذر تهيئة Google Sign-In: ${error?.message || error}`, 'error');
    }
  }

  function openAuthGate(message = ''){
    ensureAccountChrome();
    $('authGate')?.classList.add('show');
    setAuthGateStatus(message || 'سجّل الدخول ببريدك الشخصي لفتح الخطة المجانية، أو استخدم بريد الإدارة مع كلمة المرور من نفس الشاشة.', 'info');
    syncUnifiedAuthEntry();
    if ($('authCloseBtn')) $('authCloseBtn').style.display = hasValidAuthSession() ? '' : 'none';
    renderGoogleButton().catch((error) => {
      setAuthGateStatus(`تعذر تهيئة تسجيل Google: ${error?.message || error}`, 'error');
    });
  }

  function closeAuthGate(force = false){
    const account = getAccountRuntimeState();
    if (!force && account.authRequired && !hasValidAuthSession()){
      return;
    }
    $('authGate')?.classList.remove('show');
  }

  async function handleGoogleCredentialResponse(response){
    try{
      setAuthGateStatus('جارٍ التحقق من حساب Google وتأسيس الجلسة...', 'busy');
      const credential = String(response?.credential || '').trim();
      if (!credential){
        throw new Error(isNativeAndroidPlatform()
          ? `تم اختيار الحساب لكن Android لم يرسل رمز Google الكامل إلى التطبيق. ${getAndroidGoogleSetupHint()}`
          : 'لم يصل رمز تسجيل الدخول من Google. حاول مرة أخرى.');
      }
      const code = ($('upgradeCodeInput')?.value || getAuthState().upgradeCode || '').trim();
      const payload = await fetchAuthJson('/auth/google', {
        method: 'POST',
        body: JSON.stringify({
          credential,
          clientId: getAuthGoogleClientId(),
          upgradeCode: code
        })
      });
      applyAuthResponse(payload, { upgradeCode: code });
      syncAccountUi();
      refreshModeButtons();
      renderSettings();
      refreshStrategicWorkspace().catch(()=>{});
      closeAuthGate(true);
      toast('✅ تم تسجيل الدخول بنجاح');
    }catch(error){
      const message = explainAuthError(error, { nativeGoogle: isNativeAndroidPlatform() });
      setAuthGateStatus(`فشل تسجيل الدخول: ${message}`, 'error');
      toast(`⚠️ ${message}`);
    }
  }

  async function submitUnifiedAuthEntry(){
    const name = String($('authEntryName')?.value || '').trim();
    const email = String($('authEntryEmail')?.value || '').trim().toLowerCase();
    const password = String($('authEntryPassword')?.value || '').trim();
    const config = getEffectiveAuthConfig();
    const adminEmail = String(config.adminEmail || DEFAULT_AUTH_CONFIG.adminEmail).trim().toLowerCase();
    const isAdminEntry = !!email && email === adminEmail;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
      setAuthGateStatus('أدخل بريدًا إلكترونيًا صالحًا أولًا.', 'error');
      return;
    }
    try{
      let payload = null;
      if (isAdminEntry){
        if (!password){
          setAuthGateStatus('هذا هو بريد الإدارة. أدخل كلمة المرور للمتابعة.', 'error');
          return;
        }
        setAuthGateStatus('جارٍ التحقق من حساب الإدارة...', 'busy');
        payload = await fetchAuthJson('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password })
        });
      } else {
        setAuthGateStatus('جارٍ إنشاء جلسة الخطة المجانية...', 'busy');
        payload = await fetchAuthJson('/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            name,
            email,
            upgradeCode: ($('upgradeCodeInput')?.value || getAuthState().upgradeCode || '').trim()
          })
        });
      }
      applyAuthResponse(payload, { upgradeCode: payload?.plan === 'premium' ? (($('upgradeCodeInput')?.value || getAuthState().upgradeCode || '').trim()) : getAuthState().upgradeCode || '' });
      syncAccountUi();
      refreshModeButtons();
      renderSettings();
      refreshStrategicWorkspace().catch(()=>{});
      closeAuthGate(true);
      if ($('authEntryPassword')) $('authEntryPassword').value = '';
      toast(isAdminEntry ? '✅ تم تسجيل الدخول الإداري' : '✅ تم فتح الخطة المجانية بنجاح');
    }catch(error){
      setAuthGateStatus(`${isAdminEntry ? 'فشل دخول الإدارة' : 'فشل تسجيل الدخول'}: ${error?.message || error}`, 'error');
    }
  }

  function buildUpgradeMailto(account = getAuthState(), config = getEffectiveAuthConfig()){
    const to = encodeURIComponent(config.upgradeEmail || DEFAULT_AUTH_CONFIG.upgradeEmail);
    const subject = encodeURIComponent(`طلب ترقية حساب - ${account.email || 'مستخدم جديد'}`);
    const body = encodeURIComponent([
      'مرحبًا،',
      '',
      'أرغب في ترقية حسابي إلى الخطة المدفوعة.',
      `الاسم: ${account.name || ''}`,
      `البريد: ${account.email || ''}`,
      `الخطة الحالية: ${getAccountPlanLabel(account.plan)}`,
      `التاريخ: ${new Date().toLocaleString('ar-SA')}`,
      '',
      'يرجى إرسال كود الترقية لهذا الحساب.'
    ].join('\n'));
    return `mailto:${to}?subject=${subject}&body=${body}`;
  }

  async function requestUpgradeByEmail(){
    const account = getAuthState();
    if (!hasValidAuthSession(account)){
      openAuthGate('سجّل الدخول أولاً ثم أرسل طلب الترقية.');
      return;
    }
    try{
      const payload = await fetchAuthJson('/auth/upgrade/request', {
        method: 'POST',
        body: JSON.stringify({ appVersion: '8.0' })
      }).catch(() => null);
      const mailto = payload?.mailto || buildUpgradeMailto(account, getEffectiveAuthConfig());
      window.location.href = mailto;
      toast('✉️ تم تجهيز رسالة طلب الترقية');
    }catch(error){
      toast(`⚠️ تعذر تجهيز طلب الترقية: ${error?.message || error}`);
    }
  }

  async function activateUpgradeCodeFromUi(){
    const auth = getAuthState();
    if (!hasValidAuthSession(auth)){
      openAuthGate('سجّل الدخول أولاً ثم فعّل كود الترقية.');
      return;
    }
    const code = String($('upgradeCodeInput')?.value || '').trim();
    if (!code) return toast('⚠️ أدخل كود الترقية أولاً.');
    try{
      const payload = await fetchAuthJson('/auth/upgrade/activate', {
        method: 'POST',
        body: JSON.stringify({ code })
      });
      applyAuthResponse(payload, { upgradeCode: code });
      syncAccountUi();
      refreshModeButtons();
      renderSettings();
      refreshStrategicWorkspace().catch(()=>{});
      toast('✅ تم تفعيل الخطة المدفوعة');
    }catch(error){
      toast(`⚠️ تعذر تفعيل الكود: ${error?.message || error}`);
    }
  }

  async function generateAdminUpgradeCodeFromUi(){
    const auth = getAuthState();
    if (!hasValidAuthSession(auth) || auth.role !== 'admin'){
      return toast('⚠️ هذا الإجراء متاح فقط داخل حساب الإدارة.');
    }
    const email = String($('adminUpgradeEmail')?.value || '').trim().toLowerCase();
    const days = clamp(Number($('adminUpgradeDays')?.value || 365), 1, 3650);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
      return toast('⚠️ أدخل بريد المستخدم أولاً.');
    }
    try{
      if ($('adminUpgradeMeta')) $('adminUpgradeMeta').textContent = 'جارٍ إنشاء كود الترقية...';
      const payload = await fetchAuthJson('/auth/admin/generate-upgrade-code', {
        method: 'POST',
        body: JSON.stringify({
          email,
          plan: 'premium',
          days
        })
      });
      const code = String(payload?.code || '').trim();
      if (!code) throw new Error('لم يتم استلام كود من الخادم.');
      if ($('adminGeneratedCode')) $('adminGeneratedCode').value = code;
      if ($('adminCopyUpgradeBtn')) $('adminCopyUpgradeBtn').disabled = false;
      if ($('adminUpgradeMeta')){
        const expiresAt = Number(payload?.expiresAt || 0);
        const expiresLabel = expiresAt ? new Date(expiresAt).toLocaleString('ar-SA') : `بعد ${days} يوم`;
        $('adminUpgradeMeta').textContent = `تم إنشاء كود مرتبط بالبريد ${email} وصالح حتى ${expiresLabel}.`;
      }
      toast('✅ تم إنشاء كود الترقية');
    }catch(error){
      if ($('adminUpgradeMeta')) $('adminUpgradeMeta').textContent = `تعذر إنشاء الكود: ${error?.message || error}`;
      toast(`⚠️ تعذر إنشاء كود الترقية: ${error?.message || error}`);
    }
  }

  async function copyAdminUpgradeCode(){
    const code = String($('adminGeneratedCode')?.value || '').trim();
    if (!code) return toast('⚠️ لا يوجد كود لنسخه بعد.');
    try{
      await navigator.clipboard.writeText(code);
      toast('✅ تم نسخ كود الترقية');
    }catch(_){
      $('adminGeneratedCode')?.select?.();
      toast('ℹ️ تم تحديد الكود. انسخه يدويًا إذا لزم.');
    }
  }

  function logoutCurrentAccount(){
    clearAuthState();
    try{ window.google?.accounts?.id?.disableAutoSelect(); }catch(_){}
    try{
      const plugin = getNativeGoogleAuthPlugin();
      plugin?.signOut?.().catch?.(()=>{});
    }catch(_){}
    syncAccountUi();
    refreshModeButtons();
    refreshStrategicWorkspace().catch(()=>{});
    openAuthGate('تم تسجيل الخروج. سجّل الدخول مرة أخرى ببريدك الشخصي للمتابعة.');
  }

  let shellResizeTimer = 0;
  function scheduleShellLayoutRefresh(){
    clearTimeout(shellResizeTimer);
    const keyboardEditing = isAndroidKeyboardEditing();
    shellResizeTimer = window.setTimeout(() => {
      syncKeyboardEditingState();
      resizeComposerInput();
      if (!keyboardEditing){
        applyShellLayout();
        refreshStrategicWorkspace().catch(()=>{});
      }
    }, keyboardEditing ? 180 : 60);
  }

  function openAccountCenter(){
    if (!hasValidAuthSession()){
      openAuthGate();
      return;
    }
    setActiveNav('settings');
    renderSettings();
    window.setTimeout(() => {
      $('settingsAccountCard')?.scrollIntoView({ behavior:'smooth', block:'start' });
    }, 60);
  }

  async function initializeAuthExperience(){
    ensureAccountChrome();
    if (AUTH_RUNTIME.booting) return;
    AUTH_RUNTIME.booting = true;
    try{
      await loadRemoteAuthConfig(false);
      await verifyStoredAuthSession(false);
      syncAccountUi();
      const account = getAccountRuntimeState();
      if (account.authRequired && !hasValidAuthSession()){
        openAuthGate();
      } else {
        closeAuthGate(true);
      }
    }finally{
      AUTH_RUNTIME.booting = false;
    }
  }

  function ensureStrategicChrome(){
    ensureAccountChrome();
    const sideCard = document.querySelector('.sidecard');
    if (sideCard) sideCard.remove();

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
      badge.textContent = 'جاهز';
      left.appendChild(stack);
      stack.appendChild(topTitle);
      row.appendChild(topSubtitle);
      row.appendChild(badge);
      stack.appendChild(row);
    }

    const topActions = document.querySelector('.topbar .topbar-actions');
    if (topActions && !$('historyDrawerBtn')){
      const historyBtn = document.createElement('button');
      historyBtn.type = 'button';
      historyBtn.id = 'historyDrawerBtn';
      historyBtn.className = 'btn ghost sm with-label';
      topActions.insertBefore(historyBtn, $('focusModeBtn') || $('headerCollapseBtn'));
    }
    if (topActions && !$('studyModeBtn')){
      const study = document.createElement('button');
      study.type = 'button';
      study.id = 'studyModeBtn';
      study.className = 'btn ghost sm with-label';
      topActions.insertBefore(study, $('focusModeBtn') || $('headerCollapseBtn'));
    }
    if (topActions && !$('focusModeBtn')){
      const focus = document.createElement('button');
      focus.type = 'button';
      focus.id = 'focusModeBtn';
      focus.className = 'btn ghost sm with-label';
      topActions.insertBefore(focus, $('headerCollapseBtn'));
    }

    const nav = $('nav');
    if (nav && !nav.querySelector('[data-page="guide"]')){
      const guideBtn = document.createElement('button');
      guideBtn.className = 'navbtn';
      guideBtn.dataset.page = 'guide';
      guideBtn.innerHTML = '<span>دليل الاستخدام</span><span class="meta" id="navGuideMeta">AR</span>';
      nav.appendChild(guideBtn);
    }

    const contentRoot = document.querySelector('.content');
    if (contentRoot && !$('page-guide')){
      const page = document.createElement('div');
      page.className = 'page';
      page.id = 'page-guide';
      page.innerHTML = `
        <div class="toolbar">
          <input id="guideSearch" type="text" placeholder="ابحث داخل دليل الاستخدام..." style="max-width:320px" />
          <button class="btn ghost sm with-label" id="guideExportBtn" type="button"><span class="icon">⬇️</span><span class="label">تنزيل الدليل</span></button>
        </div>
        <div class="guide-shell">
          <aside class="guide-index" id="guideIndex"></aside>
          <div class="guide-content" id="guideContent"></div>
        </div>`;
      contentRoot.appendChild(page);
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
    if (chatbar && !$('voiceInputBtn')){
      const voiceBtn = document.createElement('button');
      voiceBtn.type = 'button';
      voiceBtn.id = 'voiceInputBtn';
      voiceBtn.className = 'btn ghost';
      voiceBtn.title = 'إملاء صوتي';
      voiceBtn.setAttribute('aria-label', voiceBtn.title);
      voiceBtn.textContent = '🎤';
      chatbar.insertBefore(voiceBtn, $('regenBtn') || $('stopBtn') || $('sendBtn'));
    }
    if (chatbar && !$('composerContextMeta')){
      chatbar.insertAdjacentHTML('afterend', `
        <div class="composer-meta">
          <span id="composerHint">Enter للإرسال • Shift+Enter لسطر جديد • تُضاف المرفقات إلى السياق تلقائيًا.</span>
          <span class="composer-status" id="composerContextMeta">سياق مساحة العمل —</span>
        </div>`);
    }

    const chatPage = $('page-chat');
    if (chatPage && !$('threadDrawer')){
      const drawer = document.createElement('aside');
      drawer.className = 'thread-drawer';
      drawer.id = 'threadDrawer';
      drawer.innerHTML = `
        <div class="thread-drawer-head">
          <div>
            <div class="thread-drawer-title">سجل الدردشات</div>
            <div class="thread-drawer-sub" id="threadDrawerSub">المحادثات المحفوظة داخل المشروع الحالي</div>
          </div>
          <div class="row" style="margin:0; gap:6px">
            <button class="btn ghost sm icon" id="threadDrawerCloseBtn" type="button" title="إغلاق" aria-label="إغلاق">✕</button>
          </div>
        </div>
        <div class="thread-drawer-toolbar">
          <input id="threadSearchInput" type="text" placeholder="ابحث في السجل..." />
          <button class="btn ghost sm with-label" id="threadExportAllBtn" type="button"><span class="icon">⬇️</span><span class="label">تصدير الكل</span></button>
        </div>
        <div class="thread-drawer-list" id="threadDrawerList"></div>`;
      chatPage.appendChild(drawer);
      const overlay = document.createElement('div');
      overlay.className = 'thread-drawer-overlay';
      overlay.id = 'threadDrawerOverlay';
      chatPage.appendChild(overlay);
    }

    const settingsPage = $('page-settings');
    const settingsToolbar = settingsPage?.querySelector('.toolbar');
    if (settingsPage && settingsToolbar && !$('settingsHealthBtn')){
      settingsToolbar.insertAdjacentHTML('afterend', `
        <div class="settings-overview">
          <div class="settings-overview-card">
            <h3>تشغيل المنصة</h3>
            <p>راجع حالة الاتصال، الإعدادات الحالية، ومسارات التحويل من مكان واحد.</p>
            <div class="settings-actions">
              <button class="btn dark sm with-label" id="settingsHealthBtn" type="button"><span class="icon">◎</span><span class="label">فحص الصحة</span></button>
              <button class="btn ghost sm with-label" id="settingsDefaultsBtn" type="button"><span class="icon">⚙️</span><span class="label">تطبيق الإعدادات</span></button>
              <button class="btn ghost sm with-label" id="settingsRecommendModelBtn" type="button"><span class="icon">✨</span><span class="label">اقتراح نموذج</span></button>
            </div>
            <div class="settings-health-output" id="settingsHealthOutput">شغّل الفحص للتحقق من البوابة والنموذج وخدمات التحويل.</div>
          </div>
          <div class="settings-overview-card">
            <h3>جاهزية التشغيل</h3>
            <div class="settings-kpis">
              <div class="settings-kpi"><span>الاتصال</span><strong id="settingsReadyState">—</strong></div>
              <div class="settings-kpi"><span>البوابة</span><strong id="settingsGatewayState">—</strong></div>
              <div class="settings-kpi"><span>النموذج</span><strong id="settingsModelState">—</strong></div>
              <div class="settings-kpi"><span>الأمان</span><strong id="settingsSecurityState">—</strong></div>
              <div class="settings-kpi"><span>التحويل السحابي</span><strong id="settingsConvertState">—</strong></div>
              <div class="settings-kpi"><span>التكلفة</span><strong id="settingsCostState">—</strong></div>
            </div>
          </div>
        </div>`);
    }

    const mainToolbar = document.querySelector('#page-chat .mainToolbar');
    if (mainToolbar && !$('workspaceBriefSection')){
      mainToolbar.insertAdjacentHTML('beforeend', `
        <section class="tool-group" id="workspaceBriefSection" data-section-id="brief" data-section-title="ذاكرة المشروع">
          <span class="tool-group-title">ذاكرة المشروع</span>
          <div class="toolbar-strip workspace-brief-grid">
            <div class="brief-field">
              <label class="hint" for="briefGoal">الهدف</label>
              <input id="briefGoal" type="text" placeholder="ما النتيجة التي تريد الوصول إليها في هذا المشروع؟" />
            </div>
            <div class="brief-field">
              <label class="hint" for="briefAudience">الجمهور</label>
              <input id="briefAudience" type="text" placeholder="لمن ستكون الإجابة أو المستند النهائي؟" />
            </div>
            <div class="brief-field">
              <label class="hint" for="briefDeliverable">المخرج المطلوب</label>
              <input id="briefDeliverable" type="text" placeholder="خطة، تقرير، عرض، بريد، جدول، مستند تنفيذي..." />
            </div>
            <div class="brief-field">
              <label class="hint" for="briefStyle">أسلوب الرد</label>
              <select id="briefStyle">
                <option value="executive">تنفيذي</option>
                <option value="operator">تشغيلي</option>
                <option value="deep_dive">تحليل عميق</option>
                <option value="board_ready">جاهز للإدارة</option>
              </select>
            </div>
            <div class="brief-field brief-field-wide">
              <label class="hint" for="briefConstraints">القيود</label>
              <textarea id="briefConstraints" rows="3" placeholder="أي قيود مهمة: تنسيق إلزامي، موعد نهائي، حدود نطاق، أو متطلبات يجب عدم تجاوزها"></textarea>
            </div>
            <div class="brief-field brief-field-wide">
              <label class="hint" for="briefMemory">ذاكرة المشروع</label>
              <textarea id="briefMemory" rows="3" placeholder="حقائق ثابتة، قرارات سابقة، أسماء، مصطلحات، أو سياق يجب أن يتذكره المساعد دائمًا"></textarea>
            </div>
            <div class="brief-field brief-field-wide">
              <label class="hint" for="briefResponseRules">قواعد الرد</label>
              <textarea id="briefResponseRules" rows="3" placeholder="مثل: اكتب بالعربية فقط، استخدم جداول عند المقارنة، ابدأ بملخص تنفيذي، لا تستخدم مصطلحات تقنية معقدة..."></textarea>
            </div>
            <div class="workspace-brief-actions">
              <button class="btn dark sm with-label" id="briefApplyBtn" type="button"><span class="icon">✦</span><span class="label">إدراج في الدردشة</span></button>
              <button class="btn ghost sm with-label" id="briefClearBtn" type="button"><span class="icon">↺</span><span class="label">مسح</span></button>
            </div>
          </div>
        </section>`);
    }

    const transToolbar = document.querySelector('#page-transcription .toolbar');
    if (transToolbar && !$('transcribeProfile')){
      transToolbar.insertAdjacentHTML('beforeend', `
        <select id="transcribeProfile" title="ملف تشغيل الاستخراج" style="max-width:220px">
          <option value="fast">سريع</option>
          <option value="balanced" selected>متوازن</option>
          <option value="fidelity">دقة أعلى</option>
        </select>
        <select id="transcribeDocxMode" title="طريقة تحويل PDF إلى Word" style="max-width:220px">
          <option value="auto">تحويل ذكي تلقائي</option>
          <option value="cloud">أعلى مطابقة سحابي</option>
          <option value="local">تحويل محلي قابل للتعديل</option>
        </select>`);
    }

    const transPage = $('page-transcription');
    if (transPage && !$('transcribeLabCard')){
      const body = transPage.querySelector('.panel .body');
      if (body){
        body.insertAdjacentHTML('afterbegin', `
          <div class="transcribe-lab-card" id="transcribeLabCard">
            <div class="transcribe-lab-grid">
              <div class="transcribe-lab-metric"><span>الملف</span><strong id="transcribeSourceState">لا يوجد</strong></div>
              <div class="transcribe-lab-metric"><span>الملف الشخصي</span><strong id="transcribeProfileState">متوازن</strong></div>
              <div class="transcribe-lab-metric"><span>المعالجة</span><strong id="transcribeEngineState">جاهز</strong></div>
              <div class="transcribe-lab-metric"><span>المطابقة</span><strong id="transcribeQualityState">—</strong></div>
              <div class="transcribe-lab-metric"><span>قرار المسار</span><strong id="transcribeRouteState">محلي افتراضي</strong></div>
              <div class="transcribe-lab-metric"><span>الميزانية</span><strong id="transcribeBudgetState">متوازن</strong></div>
              <div class="transcribe-lab-metric"><span>السحابة</span><strong id="transcribeCloudState">قيد الفحص</strong></div>
              <div class="transcribe-lab-metric"><span>ملف المصدر</span><strong id="transcribeDocProfile">بدون بيانات</strong></div>
            </div>
            <div class="transcribe-lab-note" id="transcribeLabNote">اختر ملفًا ثم حدّد السرعة أو الدقة المطلوبة. سيعرض المختبر قرار المسار وحدود التكلفة قبل أي تحويل سحابي.</div>
          </div>`);
      }
    }

    ensureWorkspaceSections();
    renderProjectBrief();
    renderGuidePage();
    renderThreadHistory();
    syncTranscribeControls();
    applyArabicProductCopy();
    applyShellLayout();
    syncVoiceInputButton();
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
    if ($('briefMemory')) $('briefMemory').value = brief.memory || '';
    if ($('briefResponseRules')) $('briefResponseRules').value = brief.responseRules || '';
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
      memory: $('briefMemory')?.value?.trim() || '',
      responseRules: $('briefResponseRules')?.value?.trim() || '',
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
      'استخدم هذا السياق الدائم للمهمة التالية:',
      brief.goal ? `الهدف: ${brief.goal}` : '',
      brief.audience ? `الجمهور: ${brief.audience}` : '',
      brief.deliverable ? `المخرج المطلوب: ${brief.deliverable}` : '',
      brief.constraints ? `القيود: ${brief.constraints}` : '',
      brief.memory ? `ذاكرة المشروع: ${brief.memory}` : '',
      brief.responseRules ? `قواعد الرد: ${brief.responseRules}` : '',
      brief.style ? `أسلوب الرد: ${getBriefStyleLabel(brief.style)}` : '',
      '',
      'الآن أنشئ أفضل مسودة أولى أو خطة تنفيذية بناءً على هذا السياق.'
    ].filter(Boolean);
    input.value = lines.join('\n');
    resizeComposerInput(input);
    syncComposerMeta();
    input.focus();
    toast('✅ تم إدراج سياق المشروع داخل الدردشة');
  }

  function clearProjectBrief(){
    setProjectBrief(getCurProjectId(), DEFAULT_PROJECT_BRIEF);
    renderProjectBrief();
    refreshStrategicWorkspace().catch(()=>{});
    toast('✅ تم مسح ذاكرة المشروع');
  }

  function syncWorkspaceSectionSummaries(){
    const settings = getSettings();
    const pid = getCurProjectId();
    const files = loadFiles(pid).length;
    const messages = (getCurThread().messages || []).length;
    const brief = getProjectBrief(pid);

    if ($('workspaceSectionSummary-routing')){
      $('workspaceSectionSummary-routing').textContent = `${settings.provider} • ${getDisplayModelName(settings.model)} • ${settings.authMode === 'gateway' ? 'بوابة' : 'مباشر'}`;
    }
    if ($('workspaceSectionSummary-modes')){
      $('workspaceSectionSummary-modes').textContent = [
        settings.streaming ? 'بث مباشر' : 'دفعة واحدة',
        getRagToggle() ? 'RAG' : 'بدون RAG',
        settings.toolsEnabled ? 'أدوات' : 'الأدوات متوقفة',
        getWebToggle() ? 'ويب' : 'محلي',
        getStudyMode() ? 'دراسي' : ''
      ].filter(Boolean).join(' • ');
    }
    if ($('workspaceSectionSummary-quick')){
      $('workspaceSectionSummary-quick').textContent = `${messages} رسالة • ${files} ملف`;
    }
    if ($('workspaceSectionSummary-brief')){
      $('workspaceSectionSummary-brief').textContent = summarizeProjectBrief(brief);
    }
  }

  function applyArabicProductCopy(){
    if ($('topRuntimeBadge')){
      $('topRuntimeBadge').textContent = 'جاهز';
    }
    const fixedCopy = [
      ['workspaceHeadline', 'ابدأ من مساحة عمل عربية للدردشة والملفات والمعرفة.'],
      ['workspaceSummary', 'اعمل داخل مشروع واحد مع واجهة منظمة وخيارات تشغيل واضحة.'],
      ['signalProviderNote', 'المزوّد الحالي وطريقة المصادقة'],
      ['signalModelNote', 'مسار النموذج الرئيسي'],
      ['signalContextNote', 'الملفات والمعرفة وذاكرة المشروع'],
      ['signalModesNote', 'البث والأدوات والويب وأنماط التشغيل'],
      ['composerHint', 'Enter للإرسال • Shift+Enter لسطر جديد • تُضاف المرفقات والذاكرة إلى السياق تلقائيًا.']
    ];
    fixedCopy.forEach(([id, text]) => {
      const el = $(id);
      if (el) el.textContent = text;
    });

    const signalLabels = ['المزوّد', 'النموذج', 'السياق', 'أوضاع التشغيل'];
    document.querySelectorAll('.signal-card .signal-label').forEach((label, idx) => {
      if (signalLabels[idx]) label.textContent = signalLabels[idx];
    });

    const navLabels = {
      chat: '💬 الدردشة',
      knowledge: '🧠 المعرفة',
      canvas: '📝 اللوحة',
      files: '📎 الملفات',
      transcription: '🧾 مختبر الوثائق',
      workflows: '⚡ سير العمل',
      downloads: '⬇️ التحميلات',
      projects: '🗂️ المشاريع',
      settings: '⚙️ الإعدادات',
      guide: '📘 دليل الاستخدام'
    };
    document.querySelectorAll('.navbtn[data-page]').forEach((btn) => {
      const label = btn.querySelector('span:not(.meta)');
      if (label && navLabels[btn.dataset.page]) label.textContent = navLabels[btn.dataset.page];
    });

    document.querySelectorAll('[data-quick-prompt]').forEach((btn) => {
      const key = btn.dataset.quickPrompt || '';
      const labels = {
        strategy_brief: 'ملف تنفيذي',
        deep_research: 'بحث عميق',
        system_audit: 'مراجعة نظام',
        build_product: 'بناء منتج',
        exec_summary: 'ملخص تنفيذي',
        action_board: 'لوحة تنفيذ',
        kb_orchestrator: 'تنسيق المعرفة',
        launch_plan: 'خطة إطلاق',
        pm_review: 'مراجعة منتج'
      };
      if (labels[key]) btn.textContent = labels[key];
    });
  }

  function openThreadDrawer(){
    $('threadDrawer')?.classList.add('show');
    $('threadDrawerOverlay')?.classList.add('show');
    renderThreadHistory();
    setTimeout(() => $('threadSearchInput')?.focus(), 40);
  }

  function closeThreadDrawer(){
    $('threadDrawer')?.classList.remove('show');
    $('threadDrawerOverlay')?.classList.remove('show');
  }

  function threadMessageCount(thread){
    return Array.isArray(thread?.messages) ? thread.messages.length : 0;
  }

  function threadPreview(thread){
    const firstUser = (thread?.messages || []).find((m) => m.role === 'user')?.content || '';
    const value = briefSnippet(thread?.summary || firstUser || '', 90);
    return value || 'لا يوجد محتوى بعد';
  }

  function suggestThreadTitleFromText(text){
    const cleaned = String(text || '')
      .replace(/\s+/g, ' ')
      .replace(/[^\p{L}\p{N}\s\-–—:]/gu, '')
      .trim();
    if (!cleaned) return 'محادثة جديدة';
    return cleaned.length > 38 ? `${cleaned.slice(0, 38)}…` : cleaned;
  }

  function ensureThreadTitleFromMessage(thread, text){
    if (!thread) return thread;
    const current = String(thread.title || '').trim();
    const isGeneric = !current || /محادثة جديدة|محادثة$|chat/i.test(current);
    if (isGeneric){
      thread.title = suggestThreadTitleFromText(text);
    }
    return thread;
  }

  function renameThreadInteractive(threadId){
    const pid = getCurProjectId();
    const threads = loadThreads(pid);
    const idx = threads.findIndex((t) => t.id === threadId);
    if (idx < 0) return;
    const next = prompt('اسم المحادثة:', threads[idx].title || 'محادثة');
    if (!next) return;
    threads[idx].title = next.trim();
    threads[idx].updatedAt = nowTs();
    saveThreads(pid, threads);
    renderThreadHistory();
    refreshNavMeta();
    toast('✅ تم تحديث اسم المحادثة');
  }

  function deleteThreadInteractive(threadId){
    const pid = getCurProjectId();
    const threads = loadThreads(pid);
    if (threads.length <= 1) return toast('⚠️ لا يمكن حذف آخر محادثة في المشروع');
    const idx = threads.findIndex((t) => t.id === threadId);
    if (idx < 0) return;
    if (!confirm('حذف هذه المحادثة من السجل؟')) return;
    const [removed] = threads.splice(idx, 1);
    saveThreads(pid, threads);
    if (getCurThreadId(pid) === removed.id){
      setCurThreadId(pid, threads[0].id);
      renderChat();
    }
    renderThreadHistory();
    refreshNavMeta();
    toast('✅ تم حذف المحادثة');
  }

  function exportThread(threadId){
    const pid = getCurProjectId();
    const thread = loadThreads(pid).find((t) => t.id === threadId);
    if (!thread) return;
    const lines = [`# ${thread.title || 'محادثة'}`, '', `- المشروع: ${getCurProject().name}`, `- عدد الرسائل: ${threadMessageCount(thread)}`, `- آخر تحديث: ${new Date(thread.updatedAt || nowTs()).toLocaleString('ar')}`, ''];
    (thread.messages || []).forEach((m) => {
      lines.push(`## ${m.role === 'user' ? 'المستخدم' : 'المساعد'}`);
      lines.push('');
      lines.push(String(m.content || ''));
      lines.push('');
    });
    downloadBlob(`${(thread.title || 'chat').replace(/[^\w\u0600-\u06FF\-]+/g,'_')}.md`, new Blob([lines.join('\n')], { type:'text/markdown;charset=utf-8' }));
    toast('⬇️ تم تصدير المحادثة');
  }

  function exportAllThreads(){
    const pid = getCurProjectId();
    const payload = {
      project: getCurProject(),
      brief: getProjectBrief(pid),
      threads: loadThreads(pid)
    };
    downloadBlob(`threads-${pid}.json`, new Blob([JSON.stringify(payload, null, 2)], { type:'application/json;charset=utf-8' }));
    toast('⬇️ تم تصدير سجل المشروع');
  }

  function renderThreadHistory(){
    const box = $('threadDrawerList');
    if (!box) return;
    const pid = getCurProjectId();
    const cur = getCurThreadId(pid);
    const query = String($('threadSearchInput')?.value || '').trim().toLowerCase();
    const rows = loadThreads(pid)
      .slice()
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .filter((thread) => {
        if (!query) return true;
        const hay = `${thread.title || ''}\n${threadPreview(thread)}`.toLowerCase();
        return hay.includes(query);
      });

    if ($('threadDrawerSub')) $('threadDrawerSub').textContent = `${rows.length} محادثة محفوظة داخل مشروع ${getCurProject().name}`;
    box.innerHTML = '';

    if (!rows.length){
      box.innerHTML = `
        <div class="thread-card thread-card-empty">
          <div class="thread-card-title">لا توجد محادثات مطابقة</div>
          <div class="thread-card-preview">جرّب البحث بكلمات مختلفة أو أنشئ محادثة جديدة وسيتم حفظها تلقائيًا داخل سجل المشروع.</div>
        </div>`;
      return;
    }

    rows.forEach((thread) => {
      const card = document.createElement('div');
      card.className = `thread-card${thread.id === cur ? ' active' : ''}`;
      card.innerHTML = `
        <div class="thread-card-head">
          <div class="thread-card-title">${escapeHtml(thread.title || 'محادثة')}</div>
          <div class="thread-card-meta">${threadMessageCount(thread)} رسالة</div>
        </div>
        <div class="thread-card-preview">${escapeHtml(threadPreview(thread))}</div>
        <div class="thread-card-footer">
          <span>${new Date(thread.updatedAt || nowTs()).toLocaleString('ar')}</span>
          <div class="thread-card-actions"></div>
        </div>`;
      const actions = card.querySelector('.thread-card-actions');

      const openBtn = document.createElement('button');
      openBtn.className = 'btn ghost sm';
      openBtn.textContent = 'فتح';
      openBtn.addEventListener('click', () => {
        setCurThreadId(pid, thread.id);
        renderChat();
        refreshNavMeta();
        closeThreadDrawer();
      });

      const renameBtn = document.createElement('button');
      renameBtn.className = 'btn ghost sm';
      renameBtn.textContent = 'تسمية';
      renameBtn.addEventListener('click', () => renameThreadInteractive(thread.id));

      const exportBtn = document.createElement('button');
      exportBtn.className = 'btn ghost sm';
      exportBtn.textContent = 'تصدير';
      exportBtn.addEventListener('click', () => exportThread(thread.id));

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn danger sm';
      deleteBtn.textContent = 'حذف';
      deleteBtn.addEventListener('click', () => deleteThreadInteractive(thread.id));

      [openBtn, renameBtn, exportBtn, deleteBtn].forEach((btn) => actions.appendChild(btn));
      box.appendChild(card);
    });
  }

  function buildGuideSections(){
    return [
      {
        id: 'chat',
        page: 'chat',
        title: 'الدردشة الذكية',
        body: 'واجهة الدردشة هي مركز التشغيل الرئيسي. اكتب الطلب، أرفق الملفات، استخدم الإملاء الصوتي، وافتح سجل المحادثات عند الحاجة.',
        steps: [
          'اكتب الهدف المطلوب بوضوح ثم حدّد النتيجة التي تريد استلامها.',
          'أرفق الملفات أو الصور مباشرة من زر الإرفاق داخل صندوق الدردشة.',
          'استخدم زر السجل لفتح أي محادثة محفوظة أو تصديرها.'
        ],
        tips: ['فعّل وضع التركيز عندما تريد أكبر مساحة قراءة ممكنة.', 'استخدم وضع الدراسة إذا كنت تريد شرحًا تدريجيًا وتعليميًا.']
      },
      {
        id: 'history',
        page: 'chat',
        title: 'سجل الدردشات',
        body: 'كل محادثة تُحفَظ تلقائيًا داخل المشروع الحالي مع إمكانية الفتح، التسمية، التصدير، والحذف.',
        steps: [
          'اضغط زر السجل من أعلى الصفحة لفتح محفوظات المشروع.',
          'استخدم البحث للعثور على محادثة سابقة بالعنوان أو بالمحتوى.',
          'صدّر محادثة واحدة أو السجل كاملًا بصيغة مناسبة.'
        ],
        tips: ['يتم إنشاء عنوان تلقائي من أول رسالة، ويمكنك تغييره يدويًا.', 'يمكنك الاحتفاظ بعدة محادثات منفصلة داخل نفس المشروع.']
      },
      {
        id: 'cost_control',
        page: 'settings',
        title: 'الوضع المجاني والتحكم في التكلفة',
        body: 'سياسة التكلفة أصبحت تعمل على مستوى التطبيق بالكامل، وليس فقط على التفريغ النصي. هذا يعني أن الدردشة والبحث والأدوات وKB وRAG تتأثر فورًا حسب الوضع المختار.',
        steps: [
          'فعّل الوضع المجاني إذا كنت تريد تشغيلًا أساسيًا على مستوى التطبيق مع نموذج مجاني وإيقاف الميزات الأعلى تكلفة.',
          'استخدم الوضع الاقتصادي الصارم إذا أردت استمرار الدردشة والتحرير مع تعطيل الأدوات والبحث العميق وKB.',
          'اختر الوضع المتوازن للإبقاء على أغلب الميزات مع حدود إخراج وسياق أقل، أو الجودة القصوى لفتح كامل القدرات.'
        ],
        tips: ['المنصة تعرض الآن التشغيل الفعلي في بطاقات الإشارات حتى لو كانت الإعدادات الخام مختلفة.', 'إذا كانت ميزة ما متوقفة بسبب السياسة فستظهر لك رسالة واضحة بدل تنفيذ صامت مكلف.']
      },
      {
        id: 'brief',
        page: 'chat',
        title: 'ذاكرة المشروع',
        body: 'هذه الطبقة تشبه الذاكرة والتعليمات الدائمة: الهدف، الجمهور، المخرج، القيود، ذاكرة المشروع، وقواعد الرد.',
        steps: [
          'عبّئ حقول الهدف والجمهور والمخرج المطلوب مرة واحدة لكل مشروع.',
          'أضف في ذاكرة المشروع أي حقائق أو قرارات سابقة يجب عدم نسيانها.',
          'استخدم قواعد الرد لفرض أسلوب إخراج ثابت مثل الجداول أو الملخص التنفيذي.'
        ],
        tips: ['يتم حقن هذه المعلومات تلقائيًا داخل سياق المحادثة.', 'زر "إدراج في الدردشة" يحول الذاكرة الحالية إلى مطالبة جاهزة.']
      },
      {
        id: 'files',
        page: 'files',
        title: 'الملفات والمعرفة',
        body: 'ارفع ملفات PDF وDOCX والنصوص والصور لتستخدمها في الدردشة أو تضيفها إلى قاعدة المعرفة.',
        steps: [
          'ارفع الملفات من قسم الملفات أو أرفقها مباشرة من الدردشة.',
          'استخدم المعرفة KB لفهرسة الملفات عندما تريد استرجاعًا موثقًا.',
          'فعّل RAG عند الإجابة من المعرفة بدل الاعتماد على المحادثة فقط.'
        ],
        tips: ['الملفات الرقمية أفضل من الصور من حيث السرعة والدقة.', 'يمكنك الجمع بين الملفات والمعرفة والدردشة داخل نفس المشروع.']
      },
      {
        id: 'knowledge',
        page: 'knowledge',
        title: 'قاعدة المعرفة (KB)',
        body: 'قاعدة المعرفة تحول الملفات إلى مقاطع قابلة للاسترجاع حتى يجيب المساعد باقتباسات وسياق أدق.',
        steps: [
          'اذهب إلى قسم المعرفة ثم شغّل الفهرسة.',
          'بعد اكتمال الفهرسة فعّل RAG من شريط الدردشة.',
          'اطلب من المساعد الاستشهاد بما ورد في الملفات بدل الرد العام.'
        ],
        tips: ['يفضل تقسيم المواد الكبيرة داخل مشروع واحد منظم.', 'حدّث الفهرسة عند تغيير الملفات الأساسية.']
      },
      {
        id: 'canvas',
        page: 'canvas',
        title: 'اللوحة والمخرجات',
        body: 'أي رد مهم يمكن تحويله إلى اللوحة لتحريره وتطويره إلى مستند أو صفحة HTML قابلة للتسليم.',
        steps: [
          'من أي رد للمساعد اضغط "إلى اللوحة".',
          'حرر النص أو حوله إلى بنية أوضح داخل اللوحة.',
          'صدر النتيجة كملف أو استخدمها كنقطة انطلاق لمخرجات جديدة.'
        ],
        tips: ['هذه الآلية تقرّب التجربة من اللوحات التفاعلية في المنصات الحديثة.', 'استخدمها للمقترحات، الخطط، والسياسات.']
      },
      {
        id: 'transcription',
        page: 'transcription',
        title: 'التفريغ النصي والوثائق',
        body: 'قسم الوثائق يوفّر استخراج نص، تحسين OCR، وتحويل PDF إلى Word قابل للتعديل مع عدة أوضاع دقة.',
        steps: [
          'اختر ملف PDF أو صورة ثم حدّد ملف التشغيل: سريع، متوازن، أو دقة أعلى.',
          'اضغط استخراج النص لمراجعة المحتوى قبل أي تحويل نهائي.',
          'لأعلى مطابقة عند تحويل PDF إلى Word استخدم الوضع السحابي متى كان متاحًا.'
        ],
        tips: ['التحويل المطابق تمامًا يعتمد على طبيعة الملف الأصلي ونوعية الخطوط والصور.', 'ملفات PDF الرقمية ذات طبقة النص تعطي نتائج أفضل من الملفات الممسوحة ضوئيًا.']
      },
      {
        id: 'transcription_cost',
        page: 'settings',
        title: 'التكلفة والوضع المجاني',
        body: 'يمكنك التحكم في التكلفة من الإعدادات عبر الوضع المجاني، حدود الصفحات والحجم، وتحديد ما إذا كان OCR السحابي أو تحسين النص السحابي مسموحًا.',
        steps: [
          'افتح الإعدادات ثم اختر وضع التكلفة المناسب: اقتصادي صارم، متوازن، أو جودة قصوى.',
          'فعّل الوضع المجاني إذا أردت فرض المعالجة المحلية بالكامل داخل قسم الوثائق.',
          'اضبط الحد الأقصى للصفحات والحجم قبل السماح بالتحويل السحابي للملفات الكبيرة.'
        ],
        tips: ['عند تفعيل الوضع المجاني سيعود التطبيق تلقائيًا للمسار المحلي حتى لو اخترت الوضع السحابي.', 'بطاقة المختبر في قسم الوثائق تعرض قرار المسار والحدود قبل بدء التحويل.']
      },
      {
        id: 'workflows',
        page: 'workflows',
        title: 'سير العمل',
        body: 'سير العمل الجاهز يختصر المهام المتكررة: بحث، OCR، تلخيص، أو بناء صفحة ومخرجات منسقة.',
        steps: [
          'اختر سير العمل المناسب من القائمة.',
          'راجع المدخلات المطلوبة أو الملفات المرتبطة به.',
          'دع المنصة تنفذ التسلسل بدل إعادة نفس الخطوات يدويًا.'
        ],
        tips: ['سير العمل مفيد للفرق والمهام التشغيلية المتكررة.', 'يمكنك استخدامه مع الملفات أو المعرفة أو اللوحة.']
      },
      {
        id: 'projects',
        page: 'projects',
        title: 'المشاريع',
        body: 'كل مشروع يحتفظ بدردشاته وذاكرته وملفاته ولوحاته بشكل منفصل حتى لا تختلط السياقات.',
        steps: [
          'أنشئ مشروعًا جديدًا لكل عميل أو منتج أو مهمة كبيرة.',
          'انقل العمل داخله بدل فتح كل شيء في مشروع واحد.',
          'استخدم اسمًا واضحًا لكل مشروع ليسهل الرجوع إليه لاحقًا.'
        ],
        tips: ['المشروع هو طبقة التنظيم الأساسية في المنصة.', 'سجل الدردشات والذاكرة محفوظان على مستوى المشروع.']
      },
      {
        id: 'settings',
        page: 'settings',
        title: 'الإعدادات',
        body: 'من صفحة الإعدادات يمكنك تحديد المزوّد، النموذج، طريقة المصادقة، والبوابة، ثم فحص الجاهزية الفعلية.',
        steps: [
          'اختر المزوّد وطريقة المصادقة المناسبة.',
          'شغّل فحص الصحة للتحقق من البوابة ومسار النموذج.',
          'استخدم الإعدادات الاحترافية للوصول إلى أفضل الإعدادات الموصى بها بسرعة.'
        ],
        tips: ['الوضع عبر Gateway أنسب للنشر وحماية المفاتيح.', 'راجع الإعدادات بعد أي تغيير في المزود أو الـ Worker.']
      }
    ];
  }

  const buildGuideSectionsBase = buildGuideSections;
  buildGuideSections = function(){
    const sections = buildGuideSectionsBase().map((section) => ({
      ...section,
      steps: [...(section.steps || [])],
      tips: [...(section.tips || [])]
    }));
    const chat = sections.find((section) => section.id === 'chat');
    if (chat){
      chat.steps.push('إذا أنشأ المساعد ملفًا داخل الرد فستجد رابط تنزيل مباشر داخل الرسالة نفسها، ويمكنك أيضًا فتح قسم التحميلات للاحتفاظ به.');
      chat.tips.push('زر تثبيت الشريط يبقي إعدادات النموذج والوضع ظاهرة أثناء التمرير الطويل.', 'المرفقات المضافة من الدردشة تُفهم الآن بعمق أكبر قبل الإرسال بدل الاعتماد على مقتطف صغير فقط.');
    }
    const files = sections.find((section) => section.id === 'files');
    if (files){
      files.tips.push('مرفقات الدردشة تستفيد من مسار قراءة أوسع، خصوصًا ملفات PDF والصور، قبل دخولها إلى سياق المحادثة.');
    }
    sections.push({
      id: 'chatDownloads',
      page: 'chat',
      title: 'ملفات الدردشة والتنزيل',
      body: 'إذا أنشأ المساعد ملفًا داخل المحادثة فإن التطبيق يحوّله تلقائيًا إلى بطاقة تنزيل ظاهرة داخل نفس الرسالة ويؤرشفه أيضًا داخل صفحة التحميلات.',
      steps: [
        'اطلب من المساعد إنشاء ملف عند الحاجة مثل تقرير أو JSON أو Markdown.',
        'اضغط بطاقة التنزيل داخل الرسالة لتنزيل الملف مباشرة.',
        'افتح قسم التحميلات إذا أردت إعادة تنزيل الملف أو تثبيته أو إعادة تسميته لاحقًا.'
      ],
      tips: ['إذا احتوت الرسالة على أكثر من ملف فسيعرض التطبيق بطاقة مستقلة لكل ملف.', 'الروابط الخارجية القابلة للتنزيل تبقى قابلة للفتح أيضًا مع حماية أفضل داخل الواجهة.']
    });
    return sections;
  };

  function renderGuidePage(){
    const sections = buildGuideSections();
    const query = String($('guideSearch')?.value || '').trim().toLowerCase();
    const filtered = sections.filter((section) => {
      if (!query) return true;
      return `${section.title}\n${section.body}\n${(section.steps || []).join('\n')}\n${(section.tips || []).join('\n')}`.toLowerCase().includes(query);
    });
    if ($('guideIndex')){
      $('guideIndex').innerHTML = filtered.map((section) => `
        <button class="guide-index-btn" type="button" data-guide-target="${section.id}">
          <strong>${escapeHtml(section.title)}</strong>
          <span>${escapeHtml(briefSnippet(section.body, 66))}</span>
        </button>`).join('');
    }
    if ($('guideContent')){
      $('guideContent').innerHTML = filtered.map((section) => `
        <article class="guide-section" id="guide-${section.id}">
          <h3>${escapeHtml(section.title)}</h3>
          <p>${escapeHtml(section.body)}</p>
          ${(section.steps || []).length ? `
            <div class="guide-block">
              <h4>خطوات الاستخدام</h4>
              <ol>${section.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}</ol>
            </div>` : ''}
          ${(section.tips || []).length ? `
            <div class="guide-block">
              <h4>نصائح عملية</h4>
              <ul>${section.tips.map((tip) => `<li>${escapeHtml(tip)}</li>`).join('')}</ul>
            </div>` : ''}
          <div class="guide-jump-row">
            <button class="btn ghost sm" type="button" data-open-page="${section.page || (section.id === 'brief' ? 'chat' : section.id)}">فتح القسم</button>
          </div>
        </article>`).join('');
    }
  }

  function exportGuideDoc(){
    const sections = buildGuideSections();
    const out = ['# دليل استخدام AI Workspace Studio', ''];
    sections.forEach((section) => {
      out.push(`## ${section.title}`);
      out.push(section.body);
      if ((section.steps || []).length){
        out.push('');
        out.push('### خطوات الاستخدام');
        section.steps.forEach((step, idx) => out.push(`${idx + 1}. ${step}`));
      }
      if ((section.tips || []).length){
        out.push('');
        out.push('### نصائح عملية');
        section.tips.forEach((tip) => out.push(`- ${tip}`));
      }
      out.push('');
    });
    downloadBlob('دليل-الاستخدام-العربي.md', new Blob([out.join('\n')], { type:'text/markdown;charset=utf-8' }));
    toast('⬇️ تم تنزيل دليل الاستخدام');
  }

  function syncTranscribeControls(){
    if ($('transcribeProfile')) $('transcribeProfile').value = getTranscribeProfile();
    if ($('transcribeDocxMode')) $('transcribeDocxMode').value = getTranscribeDocxMode();
    if ($('transcribeProfileState')){
      const labels = { fast:'سريع', balanced:'متوازن', fidelity:'دقة أعلى' };
      $('transcribeProfileState').textContent = labels[getTranscribeProfile()] || 'متوازن';
    }
    renderTranscribeOperationalState();
  }

  function getTranscribeProfileLabel(value = getTranscribeProfile()){
    return ({ fast:'سريع', balanced:'متوازن', fidelity:'دقة أعلى' })[value] || 'متوازن';
  }

  function getTranscribeDocxModeLabel(value = getTranscribeDocxMode()){
    return ({ auto:'ذكي تلقائي', cloud:'سحابي', local:'محلي' })[value] || 'ذكي تلقائي';
  }

  function updateTranscribeLabState(partial = {}){
    if ($('transcribeSourceState') && Object.prototype.hasOwnProperty.call(partial, 'source')) $('transcribeSourceState').textContent = partial.source;
    if ($('transcribeEngineState') && Object.prototype.hasOwnProperty.call(partial, 'engine')) $('transcribeEngineState').textContent = partial.engine;
    if ($('transcribeQualityState') && Object.prototype.hasOwnProperty.call(partial, 'quality')) $('transcribeQualityState').textContent = partial.quality;
    if ($('transcribeLabNote') && Object.prototype.hasOwnProperty.call(partial, 'note')) $('transcribeLabNote').textContent = partial.note;
  }

  function syncComposerMeta(){
    const meta = $('composerContextMeta');
    if (!meta) return;
    const pid = getCurProjectId();
    const files = loadFiles(pid);
    const thread = getCurThread();
    const flags = [];
    if (hasProjectBrief(getProjectBrief(pid))) flags.push('ذاكرة المشروع مفعّلة');
    if (getStudyMode()) flags.push('وضع دراسي');
    meta.textContent = `الملفات ${files.length} • الرسائل ${(thread.messages || []).length} • المرفقات ${pendingChatAttachments.length}${flags.length ? ` • ${flags.join(' • ')}` : ''}`;
    resizeComposerInput();
  }

  function syncStrategicLayoutState(hasMessages){
    $('workspaceDeck')?.classList.toggle('workspace-deck-collapsed', !!hasMessages);
    $('strategicStrip')?.classList.toggle('strategic-strip-collapsed', !!hasMessages);
  }

  async function refreshStrategicWorkspace(){
    const rawSettings = getSettings();
    const policy = getAppRuntimePolicy(rawSettings);
    const settings = policy.runtime;
    const modes = getEffectiveModeState(rawSettings, policy);
    const pid = getCurProjectId();
    const project = getCurProject();
    const thread = getCurThread();
    const messageCount = (thread.messages || []).length;
    const brief = getProjectBrief(pid);
    const files = loadFiles(pid);
    const chunks = await kbCountProject(pid).catch(() => 0);
    const downloads = loadDownloads().length;
    const runtime = policy.runtime;
    const modeLabels = [
      settings.streaming ? 'بث مباشر' : 'دفعة واحدة',
      modes.rag ? 'RAG مفعّل' : 'RAG متوقف',
      settings.toolsEnabled ? 'الأدوات مفعّلة' : 'الأدوات متوقفة',
      modes.web ? 'ويب' : 'محلي',
      policy.modeLabel,
      getStudyMode() ? 'وضع دراسي' : ''
    ];
    const readiness = policy.blockedReason || getAuthStateLabel(settings);
    syncStrategicLayoutState(messageCount > 0);
    const runtimeBadge = $('topRuntimeBadge');
    if (runtimeBadge) runtimeBadge.textContent = `${settings.provider.toUpperCase()} • ${policy.freeMode ? 'مجاني' : getCostGuardLabel(policy.costGuard)}`;
    if ($('curProjectName')) $('curProjectName').textContent = project.name;
    if ($('workspaceHeadline')){
      $('workspaceHeadline').textContent = messageCount
        ? `تابع العمل على ${project.name} من شاشة دردشة واسعة وواضحة.`
        : 'ابدأ مشروعًا جديدًا أو افتح مشروعًا موجودًا لمتابعة العمل.';
    }
    if ($('workspaceSummary')){
      const briefPart = hasProjectBrief(brief) ? ` • الذاكرة: ${summarizeProjectBrief(brief)}` : '';
      const policyPart = policy.blockedReason ? ` • تنبيه: ${policy.blockedReason}` : '';
      $('workspaceSummary').textContent = `التشغيل الفعلي ${policy.modeLabel} • المزوّد ${settings.provider} • النموذج ${getDisplayModelName(settings.model)} • ${files.length} ملفًا • ${chunks} مقطع معرفة • ${downloads} ملفًا مؤرشفًا${briefPart}${policyPart}.`;
    }
    if ($('signalProvider')) $('signalProvider').textContent = settings.provider.toUpperCase();
    if ($('signalProviderNote')) $('signalProviderNote').textContent = `${readiness} • ${settings.authMode === 'gateway' ? 'اتصال محمي عبر البوابة' : 'اتصال مباشر من المتصفح'}`;
    if ($('signalModel')) $('signalModel').textContent = getDisplayModelName(settings.model);
    if ($('signalModelNote')) $('signalModelNote').textContent = `حد الإخراج ${settings.maxOut || 2000} • قص الملفات ${settings.fileClip || 12000} • ${policy.freeMode ? 'نموذج مجاني' : getCostGuardLabel(policy.costGuard)}`;
    if ($('signalContext')) $('signalContext').textContent = `${files.length} ملف • ${chunks} معرفة`;
    if ($('signalContextNote')) $('signalContextNote').textContent = `${messageCount} رسالة • ${modes.rag ? 'RAG متاح' : 'RAG موقوف'} • ${policy.allowEmbeddings ? 'KB متاحة' : 'KB اقتصادية'}`;
    if ($('signalModes')) $('signalModes').textContent = modeLabels.filter(Boolean).join(' • ');
    if ($('signalModesNote')) $('signalModesNote').textContent = `${modes.deep ? 'عميق' : 'قياسي'} • ${modes.agent ? 'وكيل' : 'مساعد'} • ${modes.deepSearch ? 'بحث عميق' : 'محادثة'}`;

    if ($('sideProjectMeta')) $('sideProjectMeta').textContent = `${project.name} (${messageCount})`;
    if ($('sideModelMeta')) $('sideModelMeta').textContent = getDisplayModelName(settings.model);
    if ($('sideContextMeta')) $('sideContextMeta').textContent = `${files.length} ملف • ${chunks} معرفة • ${downloads} تنزيل`;
    if ($('sideModeMeta')) $('sideModeMeta').textContent = `${settings.provider} • ${settings.authMode === 'gateway' ? 'بوابة' : 'مباشر'}`;
    if ($('sideHealthNote')) $('sideHealthNote').textContent = hasProjectBrief(brief)
      ? `${readiness}. الذاكرة الحالية: ${summarizeProjectBrief(brief)}.`
      : `${readiness}.`;

    if ($('settingsReadyState')) $('settingsReadyState').textContent = readiness;
    if ($('settingsGatewayState')) $('settingsGatewayState').textContent = settings.authMode === 'gateway' ? (settings.gatewayUrl || 'البوابة غير مضبوطة') : 'وضع مباشر من المتصفح';
    if ($('settingsModelState')) $('settingsModelState').textContent = getDisplayModelName(settings.model);
    if ($('settingsSecurityState')) $('settingsSecurityState').textContent = settings.authMode === 'gateway' ? 'المفاتيح محفوظة على الخادم' : ((settings.apiKey || '').trim() ? 'مفتاح المتصفح مستخدم' : 'لا يوجد مفتاح في المتصفح');
    if ($('settingsCostState')) $('settingsCostState').textContent = policy.modeLabel;

    if ($('historyDrawerBtn')){
      $('historyDrawerBtn').innerHTML = `<span class="icon">🕘</span><span class="label">السجل (${loadThreads(pid).length})</span>`;
    }

    syncComposerMeta();
    syncWorkspaceSectionSummaries();
    renderTranscribeOperationalState();
  }

  async function runStrategicHealthCheck(){
    const output = $('settingsHealthOutput');
    const settings = saveSettingsFromUI();
    if (output) output.textContent = 'جارٍ فحص صحة مساحة العمل...';
    try{
      if (settings.provider === 'gemini'){
        const ready = !!(settings.geminiKey || '').trim();
        const msg = ready
          ? 'وضع Gemini جاهز ويحتوي على المفتاح المطلوب.'
          : 'تم اختيار Gemini لكن مفتاح Gemini غير موجود.';
        if (output) output.textContent = msg;
        toast(ready ? '✅ Gemini جاهز' : '⚠️ مفتاح Gemini مفقود');
        await refreshStrategicWorkspace();
        return;
      }

      if (settings.authMode === 'gateway'){
        const root = normalizeUrl(resolveGatewayApiRoot(settings));
        if (!root) throw new Error('رابط البوابة غير موجود.');
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
          `حالة الفحص: ${healthResp.status}`,
          `جاهزية البوابة: ${healthJson?.ready === true ? 'نعم' : 'لا'}`,
          `الإعدادات مكتملة: ${healthJson?.configured === true ? 'نعم' : 'لا'}`,
          `مسار النماذج: ${modelsResp.status}`,
          `عدد النماذج: ${modelsCount}`
        ];
        if (output) output.textContent = lines.join('\n');
        toast((healthResp.ok && modelsResp.ok) ? '✅ البوابة تعمل بشكل سليم' : '⚠️ اكتمل الفحص مع تنبيهات');
      } else {
        const ready = !!(settings.apiKey || '').trim();
        if (output) output.textContent = ready
          ? 'وضع المتصفح المباشر نشط والمفتاح موجود.'
          : 'وضع المتصفح المباشر نشط لكن مفتاح API مفقود.';
        toast(ready ? '✅ الوضع المباشر جاهز' : '⚠️ مفتاح API مفقود');
      }
    }catch(e){
      const msg = String(e?.message || e || 'فشل فحص الصحة');
      if (output) output.textContent = msg;
      toast(`❌ ${msg}`);
    }
    await refreshStrategicWorkspace();
  }

  async function runStrategicHealthCheckPro(){
    const output = $('settingsHealthOutput');
    const settings = saveSettingsFromUI();
    if (output) output.textContent = 'جاري فحص صحة مساحة العمل...';
    try{
      const lines = [];
      let runtimeReady = false;

      if (settings.provider === 'gemini'){
        runtimeReady = !!(settings.geminiKey || '').trim();
        lines.push(runtimeReady
          ? 'Gemini: جاهز والمفتاح موجود.'
          : 'Gemini: تم اختياره لكن مفتاح Gemini غير موجود.');
      } else if (settings.authMode === 'gateway'){
        const root = normalizeUrl(resolveGatewayApiRoot(settings));
        if (!root) throw new Error('رابط البوابة غير موجود.');
        const headers = {};
        if (settings.gatewayToken) headers['X-Client-Token'] = settings.gatewayToken;
        const healthResp = await fetch(`${root}/health`, { headers });
        const healthText = await healthResp.text();
        let healthJson; try{ healthJson = JSON.parse(healthText); }catch(_){ healthJson = null; }
        const modelsResp = await fetch(`${root}/v1/models`, { headers: { Accept:'application/json', ...headers } });
        const modelsText = await modelsResp.text();
        let modelsJson; try{ modelsJson = JSON.parse(modelsText); }catch(_){ modelsJson = null; }
        const modelsCount = Array.isArray(modelsJson?.data) ? modelsJson.data.length : 0;
        runtimeReady = !!(healthResp.ok && modelsResp.ok && healthJson?.ready === true);
        lines.push(
          `حالة البوابة: ${healthResp.status}`,
          `جاهزية البوابة: ${healthJson?.ready === true ? 'نعم' : 'لا'}`,
          `الإعدادات مكتملة: ${healthJson?.configured === true ? 'نعم' : 'لا'}`,
          `مسار النماذج: ${modelsResp.status}`,
          `عدد النماذج: ${modelsCount}`
        );
      } else {
        runtimeReady = !!(settings.apiKey || '').trim();
        lines.push(runtimeReady
          ? 'وضع المتصفح المباشر نشط والمفتاح موجود.'
          : 'وضع المتصفح المباشر نشط لكن مفتاح API مفقود.');
      }

      const convertRoot = getConvertWorkerRoot(settings);
      if (convertRoot){
        try{
          const convertResp = await fetch(`${convertRoot}/health`, {
            headers: { Accept:'application/json', ...buildAuthHeaders(settings) }
          });
          const convertText = await convertResp.text();
          let convertJson; try{ convertJson = JSON.parse(convertText); }catch(_){ convertJson = null; }
          transcribeCloudHealthState = {
            ready: convertJson?.ready === true,
            docxReady: convertJson?.docxReady === true,
            fidelityReady: convertJson?.fidelityReady === true,
            docxMode: String(convertJson?.docxMode || 'structured'),
            ocrReady: convertJson?.ocrReady === true,
            note: convertJson?.message || (convertResp.ok ? 'جاهز' : `HTTP ${convertResp.status}`)
          };
          lines.push(`محول الوثائق: ${convertResp.status}`);
          lines.push(`DOCX السحابي: ${convertJson?.docxReady === true ? 'جاهز' : 'غير جاهز'}`);
          lines.push(`المطابقة العالية للأصل: ${convertJson?.fidelityReady === true ? 'مفعلة' : 'غير مفعلة بعد'}`);
          lines.push(`وضع التحويل: ${String(convertJson?.docxMode || '') === 'cloudconvert'
            ? 'مطابقة عالية عبر CloudConvert'
            : (String(convertJson?.docxMode || '') === 'upstream'
              ? 'مطابقة عالية عبر محرك خارجي'
              : 'تحويل هيكلي قابل للتعديل')}`);
          lines.push(`OCR السحابي: ${convertJson?.ocrReady === true ? 'جاهز' : 'غير جاهز أو غير مهيأ'}`);
          if (convertJson?.limits){
            lines.push(`حدود السحابة: ${convertJson.limits.maxPdfPages || '-'} صفحة • ${convertJson.limits.maxFileMB || '-'}MB`);
          }
        }catch(err){
          transcribeCloudHealthState = {
            ready: false,
            docxReady: false,
            fidelityReady: false,
            docxMode: 'structured',
            ocrReady: false,
            note: String(err?.message || err || 'تعذر الاتصال')
          };
          lines.push(`محول الوثائق: تعذر الاتصال (${transcribeCloudHealthState.note})`);
        }
      } else {
        transcribeCloudHealthState = { ready:null, docxReady:null, fidelityReady:null, docxMode:'structured', ocrReady:null, note:'غير مضبوط' };
        lines.push('محول الوثائق: غير مضبوط في الإعدادات.');
      }

      renderTranscribeOperationalState();
      if (output) output.textContent = lines.join('\n');
      const convertReady = !convertRoot || transcribeCloudHealthState.docxReady === true || transcribeCloudHealthState.ready === true;
      toast((runtimeReady && convertReady) ? '✅ الخدمات جاهزة' : '⚠️ اكتمل الفحص مع تنبيهات');
    }catch(e){
      const msg = String(e?.message || e || 'فشل فحص الصحة');
      if (output) output.textContent = msg;
      toast(`⛌ ${msg}`);
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
      freeMode: false,
      costGuard: 'balanced',
      maxCloudPdfPages: DEFAULT_SETTINGS.maxCloudPdfPages,
      maxCloudFileMB: DEFAULT_SETTINGS.maxCloudFileMB,
      allowCloudOcr: true,
      allowCloudPolish: true,
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
    const policy = getAppRuntimePolicy(settings);
    let recommended = settings.model || '';
    if (policy.freeMode && settings.provider !== 'gemini') recommended = 'openrouter/free';
    else if (policy.costGuard === 'strict') recommended = getBudgetModelForSettings(settings);
    else if (settings.provider === 'gemini') recommended = 'gemini-2.5-flash';
    else if (settings.provider === 'openai') recommended = 'gpt-4o-mini';
    else {
      const cached = loadJSON(KEYS.modelCache, {})?.models || [];
      const preferred = [
        'openrouter/free',
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
    toast(`✅ النموذج المقترح: ${recommended}`);
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
    renderThreadHistory();
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
    renderThreadHistory();
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

  function getTranscribeProfileConfig(profile = getTranscribeProfile()){
    if (profile === 'fast'){
      return {
        label: 'سريع',
        scale: 1.2,
        parallel: 3,
        runOcrOnDigital: false,
        useCloudOcr: false,
        minNativeChars: 45,
        preferNative: true
      };
    }
    if (profile === 'fidelity'){
      return {
        label: 'دقة أعلى',
        scale: 2.2,
        parallel: 2,
        runOcrOnDigital: true,
        useCloudOcr: true,
        minNativeChars: 80,
        preferNative: false
      };
    }
    return {
      label: 'متوازن',
      scale: 1.7,
      parallel: 2,
      runOcrOnDigital: false,
      useCloudOcr: true,
      minNativeChars: 60,
      preferNative: false
    };
  }

  async function mapWithConcurrency(items, worker, limit=2){
    const out = new Array(items.length);
    let cursor = 0;
    const runners = new Array(Math.max(1, Math.min(limit, items.length))).fill(0).map(async () => {
      while (cursor < items.length){
        const idx = cursor++;
        out[idx] = await worker(items[idx], idx);
      }
    });
    await Promise.all(runners);
    return out;
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
    const policy = canUseCloudFeature('ocr', meta, settings);
    if (!policy.ok) return '';
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
    const profile = getTranscribeProfileConfig();
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
    if (profile.useCloudOcr && best.length < 80){
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

  function detectLineAlignment(line, pageWidth){
    const leftGap = Math.max(0, Number(line?.xMin || 0));
    const rightGap = Math.max(0, pageWidth - Number(line?.xMax || 0));
    const centerDiff = Math.abs(leftGap - rightGap);
    if (centerDiff < pageWidth * 0.06) return 'center';
    if (rightGap < pageWidth * 0.12) return 'right';
    return 'left';
  }

  function groupLinesIntoBlocks(lines, pageHeight){
    const blocks = [];
    let current = null;
    let prevY = null;
    lines.forEach((line, idx) => {
      const gap = prevY === null ? 0 : Math.abs(prevY - line.y);
      const lineHeight = idx === 0 ? 18 : Math.max(14, gap || 18);
      const align = line.align || 'left';
      if (!current || gap > 26 || current.align !== align){
        current = {
          align,
          marginTop: prevY === null ? 0 : Math.min(36, gap * 0.55),
          lines: [],
          xMin: Number.POSITIVE_INFINITY,
          xMax: 0
        };
        blocks.push(current);
      }
      const entry = {
        text: line.text,
        y: line.y,
        lineHeight: Math.max(18, lineHeight),
        xMin: Number(line.xMin || 0),
        xMax: Number(line.xMax || 0)
      };
      current.lines.push(entry);
      current.xMin = Math.min(current.xMin, entry.xMin);
      current.xMax = Math.max(current.xMax, entry.xMax);
      prevY = line.y;
    });
    if (!blocks.length){
      return [{ align:'left', marginTop:0, xMin:0, xMax:0, lines:[{ text:'', y: pageHeight, lineHeight:20, xMin:0, xMax:0 }] }];
    }
    return blocks;
  }

  function estimateTranscriptionQuality(pages){
    const nativePages = pages.filter((p) => p.method === 'native').length;
    const ocrPages = pages.filter((p) => p.method === 'ocr').length;
    const chars = pages.reduce((sum, p) => sum + String(p.text || '').length, 0);
    const avg = pages.length ? Math.round(chars / pages.length) : 0;
    if (!pages.length) return 'لا توجد بيانات';
    if (nativePages === pages.length && avg > 200) return 'مرتفعة';
    if (nativePages >= ocrPages) return 'جيدة';
    return 'تحتاج مراجعة';
  }

  async function extractPdfStrategic(file, opts={}){
    const { onProgress } = opts;
    if (!window.pdfjsLib) throw new Error('pdf.js غير متاح');
    const profile = getTranscribeProfileConfig();
    const pdfjsLib = window.pdfjsLib;
    try{ pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"; }catch(_){ }

    const ab = await file.arrayBuffer();
    const doc = await pdfjsLib.getDocument({ data: ab }).promise;
    let done = 0;
    const pages = await mapWithConcurrency(
      Array.from({ length: doc.numPages }, (_, i) => i + 1),
      async (p) => {
        const page = await doc.getPage(p);
        const viewport = page.getViewport({ scale: profile.scale });
        const content = await page.getTextContent();
        const lines = buildLinesFromTextItems(content.items || []).map((line) => ({
          ...line,
          align: detectLineAlignment(line, viewport.width)
        }));
        let pageText = lines.map((l) => l.text).join('\n').trim();
        let method = 'native';
        const nativeLooksWeak = !pageText || pageText.length < profile.minNativeChars || needsArabicOcrFallback(pageText, getOcrLang());
        const shouldRunOcr = isOcrEnabled() && (nativeLooksWeak || profile.runOcrOnDigital);

        if (shouldRunOcr){
          const dataUrl = await renderPdfPageToDataUrl(page, Math.max(1.6, profile.scale));
          const ocrText = await ocrDataUrl(dataUrl, undefined, {
            file,
            fileName: file?.name || 'document.pdf',
            page: p,
            pages: doc.numPages,
            sizeMB: Number(((Number(file?.size || 0) || 0) / 1048576).toFixed(2))
          });
          if (ocrText && (!pageText || !profile.preferNative || ocrText.length > pageText.length || scoreArabicQuality(ocrText) >= scoreArabicQuality(pageText))){
            pageText = ocrText.trim();
            method = 'ocr';
          }
        }

        done += 1;
        if (typeof onProgress === 'function') onProgress(done, doc.numPages, { method, chars: pageText.length, profile: profile.label });

        return {
          page: p,
          width: viewport.width,
          height: viewport.height,
          method,
          lines: method === 'native'
            ? lines
            : [{ y: viewport.height - 20, text: pageText, xMin: 0, xMax: viewport.width, align:'left' }],
          blocks: groupLinesIntoBlocks(method === 'native'
            ? lines
            : [{ y: viewport.height - 20, text: pageText, xMin: 0, xMax: viewport.width, align:'left' }], viewport.height),
          text: pageText
        };
      },
      profile.parallel
    );

    const sortedPages = pages.sort((a, b) => a.page - b.page);
    const text = sortedPages.map((pg) => `[Page ${pg.page}]\n${pg.text}`.trim()).join('\n\n').trim();
    return {
      pages: sortedPages,
      text,
      totalPages: doc.numPages,
      extractedPages: sortedPages.filter(p => !!p.text).length,
      nativePages: sortedPages.filter(p => p.method === 'native').length,
      ocrPages: sortedPages.filter(p => p.method === 'ocr').length,
      profile: profile.label,
      quality: estimateTranscriptionQuality(sortedPages)
    };
  }

  async function extractTextFromPdfSmart(file, opts={}){
    const result = await extractPdfStrategic(file, opts);
    return result.text;
  }

  async function convertPdfToEditableDocx(file, opts={}){
    const structured = await extractPdfStrategic(file, opts);
    const title = String(file?.name || 'document').replace(/\.pdf$/i, '');
    const sections = structured.pages.map((pg) => {
      const blocks = (pg.blocks || []).map((block) => {
        const text = block.lines.map((line) => escapeHtml(line.text)).join('<br/>');
        const align = block.align === 'center' ? 'center' : (block.align === 'right' ? 'right' : 'left');
        return `<div class="block ${align}" style="margin-top:${Math.max(0, block.marginTop || 0).toFixed(1)}px">${text}</div>`;
      }).join('');
      return `<section class="page">
        <div class="marker">صفحة ${pg.page} • ${pg.method === 'native' ? 'نص رقمي' : 'OCR'}</div>
        ${blocks}
      </section>`;
    }).join('');

    const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8" /><title>${escapeHtml(title)}</title><style>
      body{font-family:Arial,sans-serif;line-height:1.6;color:#101828}
      .page{margin:0 0 22px 0;padding:0 0 16px 0;border-bottom:1px dashed #cfd5e6}
      .marker{font-size:12px;color:#6a738f;margin-bottom:12px}
      .block{white-space:pre-wrap;font-size:13.5px;line-height:1.75}
      .block.center{text-align:center}
      .block.right{text-align:right}
      .block.left{text-align:left}
    </style></head><body>${sections}</body></html>`;

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

  async function convertPdfToDocxByWorkerPro(file, opts={}){
    const settings = getSettings();
    const fileMeta = buildTranscribeSourceMeta(file, {
      ...(opts.meta || {}),
      file,
      pages: Number(opts?.structured?.totalPages || opts?.meta?.pages || 0)
    });
    const policy = canUseCloudFeature('docx', fileMeta, settings);
    if (!policy.ok) throw new Error(policy.reason);

    const endpoints = [
      ...buildEndpointCandidates(settings.cloudConvertEndpoint, ['convert/pdf-to-docx', 'pdf-to-docx', 'api/convert/pdf-to-docx']),
      ...buildEndpointCandidates(settings.cloudConvertFallbackEndpoint, ['convert/pdf-to-docx', 'pdf-to-docx', 'api/convert/pdf-to-docx'])
    ].filter(Boolean);
    if (!endpoints.length) throw new Error('رابط تحويل PDF إلى Word السحابي غير مضبوط في الإعدادات');

    const structured = opts.structured || await extractPdfStrategic(file, opts);
    const fileBase64 = arrayBufferToBase64(await file.arrayBuffer());
    const tries = clamp(Number(settings.cloudRetryMax || 2), 1, 5);
    let lastErr = null;
    for (const endpoint of endpoints){
      for (let t=1; t<=tries; t++){
        try{
          const r = await fetch(endpoint, {
            method:'POST',
            headers: { 'Content-Type':'application/json', ...buildAuthHeaders(settings) },
            body: JSON.stringify({
              fileName: file.name,
              mimeType: file.type || 'application/pdf',
              fileBase64,
              budgetMode: settings.costGuard || 'balanced',
              freeMode: !!settings.freeMode,
              fileSizeMB: fileMeta.sizeMB,
              pageCount: structured?.totalPages || fileMeta.pages || 0,
              preferFidelity: true,
              structured
            })
          });
          if (!r.ok){
            const msg = await r.text().catch(()=> '');
            throw new Error(msg || `HTTP ${r.status}`);
          }
          const ct = (r.headers.get('content-type') || '').toLowerCase();
          if (ct.includes('application/json')){
            const j = await r.json();
            const b64 = String(j?.docxBase64 || j?.fileBase64 || j?.data?.docxBase64 || '').trim();
            if (!b64) throw new Error(String(j?.error || j?.message || 'استجابة التحويل السحابي غير صالحة'));
            const bin = decodeBase64Bytes(b64);
            return {
              blob: new Blob([bin], { type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }),
              fileName: String(j?.fileName || file.name.replace(/\.pdf$/i, '.docx')),
              text: String(j?.text || structured?.text || ''),
              structured,
              cloudMode: String(j?.mode || j?.docxMode || 'structured'),
              cloudMessage: String(j?.message || '')
            };
          }
          const blob = await r.blob();
          return {
            blob: toDocxBlob(blob),
            fileName: file.name.replace(/\.pdf$/i, '.docx'),
            text: structured?.text || '',
            structured,
            cloudMode: 'upstream'
          };
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
    const policy = canUseCloudFeature('polish', { textLength: source.length }, settings);
    if (!policy.ok) throw new Error(policy.reason);

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

  async function fileToTextSmart(file, opts={}){
    const name = (file?.name || '').toLowerCase();
    const type = (file?.type || '').toLowerCase();
    const isImg = type.startsWith('image/') || /\.(png|jpe?g|webp|bmp|gif|tiff?)$/i.test(name);
    if (isImg){
      const dataUrl = await fileToDataUrl(file);
      return await ocrDataUrl(dataUrl, undefined, { fileName: file?.name || "image", page: 1 });
    }
    if (name.endsWith('.pdf')){
      return await extractTextFromPdfSmart(file, opts);
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
  function getFileBlockRegex(){
    return /```file\b([^\n]*)\n([\s\S]*?)\n```/gi;
  }
  function parseBlockAttributes(raw){
    const attrs = {};
    String(raw || '').replace(/(\w+)="([^"]*)"/g, (_, key, value) => {
      attrs[String(key || '').toLowerCase()] = value || '';
      return '';
    });
    return attrs;
  }
  function normalizeDownloadEntry(entry = {}){
    const normalized = {
      id: String(entry.id || makeId('dl')),
      name: String(entry.name || 'output.txt').trim() || 'output.txt',
      mime: String(entry.mime || 'text/plain').trim() || 'text/plain',
      encoding: String(entry.encoding || 'text').trim().toLowerCase() === 'base64' ? 'base64' : 'text',
      content: String(entry.content || ''),
      createdAt: Number(entry.createdAt || nowTs()),
      pinned: !!entry.pinned,
      sourceMessageId: String(entry.sourceMessageId || ''),
      fingerprint: String(entry.fingerprint || '')
    };
    if (!normalized.fingerprint){
      const seed = `${normalized.name}\u241f${normalized.mime}\u241f${normalized.encoding}\u241f${normalized.content}`;
      let hash = 2166136261;
      for (let i=0; i<seed.length; i++){
        hash ^= seed.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }
      normalized.fingerprint = `dl_${(hash >>> 0).toString(16)}`;
    }
    return normalized;
  }
  function upsertDownload(entry = {}){
    const normalized = normalizeDownloadEntry(entry);
    const downloads = loadDownloads().map(normalizeDownloadEntry);
    const existing = downloads.find((item) => item.fingerprint === normalized.fingerprint);
    if (existing){
      let changed = false;
      if (!existing.sourceMessageId && normalized.sourceMessageId){
        existing.sourceMessageId = normalized.sourceMessageId;
        changed = true;
      }
      if (changed) saveDownloads(downloads.slice(0, 160));
      return { entry: existing, created: false };
    }
    downloads.unshift(normalized);
    saveDownloads(downloads.slice(0, 160));
    return { entry: normalized, created: true };
  }
  function addDownload(_pid, entry = {}){
    return upsertDownload(entry).entry;
  }
  function resolveDownloadEntry(downloadId){
    return loadDownloads().map(normalizeDownloadEntry).find((item) => item.id === downloadId) || null;
  }
  function buildBlobFromDownload(entry){
    const normalized = normalizeDownloadEntry(entry);
    if (normalized.encoding === 'base64'){
      return new Blob([decodeBase64Bytes(normalized.content)], { type: normalized.mime });
    }
    const needsCharset = /^text\//i.test(normalized.mime) || /(json|xml|javascript|svg)/i.test(normalized.mime);
    const type = !needsCharset || /charset=/i.test(normalized.mime)
      ? normalized.mime
      : `${normalized.mime};charset=utf-8`;
    return new Blob([normalized.content], { type });
  }
  function downloadStoredItem(downloadId){
    const entry = resolveDownloadEntry(downloadId);
    if (!entry) return false;
    downloadBlob(entry.name, buildBlobFromDownload(entry));
    return true;
  }
  function estimateDownloadBytes(entry){
    const normalized = normalizeDownloadEntry(entry);
    if (normalized.encoding === 'base64'){
      return Math.floor((String(normalized.content || '').replace(/\s+/g,'').length * 3) / 4);
    }
    return new Blob([String(normalized.content || '')]).size;
  }
  function formatCompactBytes(size){
    const value = Number(size || 0);
    if (value <= 0) return '0 B';
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(value >= 10 * 1024 ? 0 : 1)} KB`;
    return `${(value / (1024 * 1024)).toFixed(value >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  }

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
    const re = getFileBlockRegex();
    const out = [];
    let m;
    while ((m = re.exec(s))){
      const attrs = parseBlockAttributes(m[1]);
      if (!attrs.name || !attrs.mime) continue;
      out.push({ name:attrs.name, mime:attrs.mime, encoding: attrs.encoding || 'text', content: m[2] || '' });
    }
    return out;
  }
  function stripFileBlocks(text){
    return String(text || '')
      .replace(getFileBlockRegex(), '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
  function ensureDownloadsFromText(text, sourceMessageId=''){
    const blocks = parseFileBlocks(text);
    if (!blocks.length) return { entries: [], newCount: 0 };
    const entries = [];
    let newCount = 0;
    for (const b of blocks){
      const saved = upsertDownload({
        name: b.name,
        mime: b.mime,
        encoding: b.encoding,
        content: b.content,
        sourceMessageId
      });
      entries.push(saved.entry);
      if (saved.created) newCount += 1;
    }
    return { entries, newCount };
  }
  function ingestDownloadsFromText(text){
    return ensureDownloadsFromText(text).entries.length;
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
    const policy = getAppRuntimePolicy(settings);
    const modes = getEffectiveModeState(settings, policy);
    let sys = settings.systemPrompt || 'أنت مساعد احترافي. أجب بدقة وبأسلوب منظم.';
    if (modes.deep){
      sys += '\n\n[وضع التفكير العميق] التزم بالبنية: (1) ملخص سريع (2) شرح مفصل (3) خطوات/أمثلة (4) مخاطر/تحقق (5) خلاصة.';
    }
    if (modes.agent){
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
    sys += "\\n\\n[Files] إذا أنشأت ملفًا للمستخدم فضعه داخل بلوك file بهذا الشكل:"
        + "\\n```file name=\"report.md\" mime=\"text/markdown\"\\nمحتوى الملف هنا\\n```"
        + "\\nوسيحوّل التطبيق هذا البلوك تلقائيًا إلى رابط وزر تنزيل داخل الدردشة. لا تكرر محتوى الملف خارج هذا البلوك إلا إذا طلب المستخدم ذلك.";
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
    const policy = getAppRuntimePolicy(settings);
    const name = tool.name;
    const args = tool.args || {};
    if (name === 'kb_search'){
      if (!policy.allowEmbeddings) throw new Error(getPolicyFeatureReason('embeddings', policy));
      const q = String(args.query || '').trim();
      if (!q) throw new Error('kb_search: query مطلوب');
      const hits = await searchKb(q, settings);
      return String(hits || '').trim();
    }
    if (name === 'web_search'){
      if (!policy.allowWeb) throw new Error(getPolicyFeatureReason('web', policy));
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
    const policy = getAppRuntimePolicy(settings);
    const runtimeSettings = policy.runtime;
    if (!runtimeSettings.toolsEnabled || !policy.allowTools) return null;
    let ans = String(initialAnswer || '').trim();
    let steps = 0;
    while (steps < 5){
      const tc = parseFirstToolCall(ans);
      if (!tc) break;

      showStatus(`🧰 Tool: ${tc.name}…`, true);
      let result = '';
      try{
        result = await executeToolCall(tc, runtimeSettings);
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
      const rag = await buildRagContextIfEnabled('', settings); // keep rag stable
      const follow = `تابع الآن بناءً على نتيجة الأداة أعلاه. لا تكرر مخرجات الأداة حرفيًا. إذا احتجت أداة أخرى اطلبها ببلوك tool فقط.`;
      const threadSnapshot = getCurThread();
      const messages = buildMessagesForChat({
        userText: follow,
        settings: runtimeSettings,
        filesText,
        ragCtx: rag.ctx,
        historyMessages: threadSnapshot.messages || [],
        threadSummary: threadSnapshot.summary || ''
      });

      const extraHeaders = buildProviderHeaders(runtimeSettings);
      const baseUrl = effectiveBaseUrl(runtimeSettings) || (runtimeSettings.provider === 'openrouter' ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1');
      let model = runtimeSettings.model;
      if (runtimeSettings.provider === 'openrouter') model = maybeOnlineModel(model, runtimeSettings);

      ans = await callOpenAIChat({
        apiKey: runtimeSettings.apiKey,
        baseUrl,
        model,
        messages,
        max_tokens: clamp(Number(runtimeSettings.maxOut||2000), 256, 8000),
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
  const rawSettings = getSettings();
  const policy = getAppRuntimePolicy(rawSettings);
  if (!policy.allowThreadSummary) return;
  const settings = policy.runtime;
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
    const policy = getAppRuntimePolicy(settings);
    const modes = getEffectiveModeState(settings, policy);
    if (isOpenRouter(settings) && settings.webMode === 'openrouter_online' && modes.web){
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
    if (/no\s+(?:cookie|kookie)\s+auth\s+credential/i.test(msg)) return 'رابط البوابة الحالي يطلب مصادقة Cookies أو Cloudflare Access، بينما التطبيق يستخدم جلسة API. استخدم Gateway URL مباشرًا للـ Worker مثل sadam-key...workers.dev.';
    if (/insufficient\s+(credits?|balance)|not enough credits?|quota.*exceeded|billing|payment required|exceeded your current quota|402\b/i.test(msg)) return 'نفد رصيد مزود الذكاء الاصطناعي أو تم بلوغ حد الفوترة. يلزم شحن الرصيد أو استخدام وضع مجاني/نموذج مجاني.';
    if (/unauthorized client token/i.test(msg)) return 'تم الوصول إلى Gateway، لكن Gateway Client Token غير صحيح أو مفقود.';
    if (/missing api key|gateway_missing_upstream_key/i.test(msg)) return 'تم الوصول إلى Gateway، لكن مفتاح OpenRouter غير مضبوط داخل الـ Worker.';
    if (/failed to fetch|networkerror|load failed|network request failed|cors/i.test(msg)) return 'تعذر الوصول إلى خدمة الدردشة. تحقق من رابط البوابة أو CORS أو الاتصال.';
    if (/stream_empty_response|empty_assistant_response|unrecognized_assistant_response/i.test(msg)) return 'تم الاتصال بالمزوّد لكن الرد رجع فارغًا أو بصيغة غير متوقعة.';
    if (/missing authentication/i.test(msg)) return 'ضع مفتاح API الصحيح ثم احفظ الإعدادات.';
    if (/upstream/i.test(msg) || /gateway_upstream_/i.test(msg)) return 'فشل مزود الذكاء الاصطناعي في الرد من جهة الخادم.';
    return msg;
  }

  function getFriendlyDocxCloudError(err){
    const msg = String(err?.message || err || '').trim();
    if (!msg) return 'تعذر إكمال التحويل السحابي إلى Word.';
    if (/free_mode_blocks_cloud/i.test(msg) || /الوضع المجاني يمنع استخدام التحويل السحابي/i.test(msg)) return 'الوضع المجاني يوقف التحويل السحابي. عطّل الوضع المجاني أو استخدم المسار المحلي.';
    if (/rابط تحويل pdf.*غير مضبوط|cloud pdf|pdf.*word.*غير مضبوط|endpoint.*غير مضبوط/i.test(msg)) return 'رابط التحويل السحابي PDF إلى Word غير مضبوط في الإعدادات.';
    if (/no\s+(?:cookie|kookie)\s+auth\s+credential/i.test(msg)) return 'رابط خدمة التحويل السحابي محمي بـ Cookies أو Cloudflare Access، لذلك لا يستطيع التطبيق استخدامه. استخدم رابط Worker مباشر.';
    if (/insufficient\s+(credits?|balance)|not enough credits?|quota.*exceeded|billing|payment required|402\b/i.test(msg)) return 'نفد رصيد خدمة التحويل أو رصيد المزود المرتبط بها. يلزم شحن الرصيد أو استخدام المسار المحلي.';
    if (/cloudconvert_base64_limit_exceeded/i.test(msg)) return 'هذا الملف يتجاوز حد الحجم المسموح لمسار المطابقة العالية عبر CloudConvert في الخطة الحالية. استخدم ملفًا أصغر أو المسار المحلي.';
    if (/cloudconvert_(?:job_failed|job_error|export_missing)/i.test(msg)) return 'محرك CloudConvert للمطابقة العالية لم يكمل إنشاء ملف Word صالح. تحقق من الرصيد أو أعد المحاولة أو استخدم المسار المحلي.';
    if (/docx_upstream_failed|docx_upstream_empty|docx_upstream_bad_json/i.test(msg)) return 'خدمة المطابقة العالية لتحويل PDF إلى Word متصلة لكنها لم ترجع ملف Word صالحًا. يمكن استخدام المسار الهيكلي أو ضبط محرك المطابقة العالية.';
    if (/failed to fetch|networkerror|load failed|network request failed|cors/i.test(msg)) return 'تعذر الاتصال بخدمة التحويل السحابي. تحقق من الرابط أو من الحماية على الخدمة.';
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
    const totalLimit = clamp(Math.max(Number(settings.fileClip || 12000), 18000), 18000, 42000);
    let remaining = totalLimit;
    const blocks = ['[مرفقات الدردشة]'];
    pendingChatAttachments.forEach((a, idx) => {
      const fullText = String(a.textFull || a.text || '').trim();
      const itemsLeft = Math.max(1, pendingChatAttachments.length - idx);
      const budget = Math.max(1400, Math.floor(remaining / itemsLeft));
      const snippet = fullText ? (fullText.length <= budget ? fullText : clipText(fullText, budget)) : '';
      const state = snippet
        ? (snippet.length >= fullText.length ? 'مضمن كاملًا' : 'مضمن مختصرًا')
        : (a.kind === 'image' && a.dataUrl ? 'مرئي للنموذج' : 'بدون نص');
      const note = snippet || (a.kind === 'image' && a.dataUrl
        ? '(سيتم إرسال الصورة مباشرة للنموذج مع أي نص OCR متاح)'
        : '(لا يوجد نص مستخرج)');
      blocks.push(`--- ${a.name} (${formatAttachmentKindLabel(a)} • ${state}) ---\n${note}`);
      remaining = Math.max(0, remaining - snippet.length);
    });
    return blocks.join('\n\n').trim();
  }

  function modelSupportsVision(settings){
    if (settings.provider === 'gemini') return true;
    const id = String(settings.model || '').replace(/:online$/,'');
    const models = loadJSON(KEYS.modelCache, {})?.models || [];
    const hit = models.find(m => m.id === id);
    if (hit) return !!hit.vision;
    return /(vision|multimodal|gpt-4o|gemini|claude-3|llava|pixtral)/i.test(id);
  }

  function formatAttachmentKindLabel(att){
    const kind = String(att?.kind || '').toLowerCase();
    if (kind === 'image') return 'صورة';
    if (kind === 'pdf') return 'PDF';
    if (kind === 'docx') return 'Word';
    if (kind === 'text') return 'نص';
    return 'ملف';
  }

  function formatCompactChars(count){
    const value = Number(count || 0);
    if (value <= 0) return '0';
    if (value < 1000) return String(value);
    if (value < 1000000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}K`;
    return `${(value / 1000000).toFixed(1)}M`;
  }

  function buildUserMessageWithAttachments(userText, settings, attachments){
    const list = Array.isArray(attachments) ? attachments : [];
    if (!list.length) return { role:'user', content: String(userText||'') };

    const textParts = [];
    const vision = modelSupportsVision(settings);
    const content = [{ type:'text', text: String(userText||'') }];
    const totalBudget = clamp(Math.max(Number(settings.fileClip || 12000) * 2, 18000), 18000, 42000);
    let remainingBudget = totalBudget;

    list.forEach((a, idx) => {
      const fullText = String(a.textFull || a.text || '').trim();
      const itemsLeft = Math.max(1, list.length - idx);
      const budget = Math.max(1400, Math.floor(remainingBudget / itemsLeft));
      const snippet = fullText ? (fullText.length <= budget ? fullText : clipText(fullText, budget)) : '';
      const inclusion = snippet
        ? (snippet.length >= fullText.length ? 'مضمن كاملًا' : 'مضمن مختصرًا')
        : (a.kind === 'image' && a.dataUrl ? 'صورة مرئية للنموذج' : 'بدون نص مستخرج');
      const label = [
        `الملف: ${a.name}`,
        `النوع: ${formatAttachmentKindLabel(a)}`,
        a.size ? `الحجم: ${formatCompactBytes(a.size)}` : '',
        a.extractionMode ? `المعالجة: ${a.extractionMode}` : '',
        a.hasText && a.chars ? `النص: ${formatCompactChars(a.chars)} حرف` : '',
        `حالة الإرسال: ${inclusion}`
      ].filter(Boolean).join(' • ');
      if (snippet){
        textParts.push(`${label}\n${snippet}`);
        remainingBudget = Math.max(0, remainingBudget - snippet.length);
      } else if (a.kind === 'image' && a.dataUrl){
        textParts.push(`${label}\n(سيُرسل هذا المرفق كصورة مرئية للنموذج حتى مع غياب نص OCR كامل)`);
      } else {
        textParts.push(`${label}\n(لا يوجد نص مستخرج قابل للإرسال)`);
      }

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
    if (getStudyMode()){
      msgs.push({
        role:'system',
        content:'وضع الدراسة مفعّل: اشرح بطريقة تعليمية تدريجية، استخدم أمثلة قصيرة، جزّئ الحل إلى خطوات واضحة، واذكر سؤال تحقق قصيرًا عندما يكون ذلك مفيدًا للفهم.'
      });
    }
    if (threadSummary && threadSummary.trim()){
      msgs.push({ role:'system', content: `ملخص المحادثة السابقة:\n${threadSummary.trim()}` });
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

  function renderAssistantDownloadCards(downloads){
    const list = Array.isArray(downloads) ? downloads : [];
    if (!list.length) return '';
    return `
      <div class="assistant-downloads">
        ${list.map((entry) => `
          <a href="#" class="assistant-download-link" data-download-id="${escapeHtml(entry.id)}">
            <span class="assistant-download-name">${escapeHtml(entry.name)}</span>
            <span class="assistant-download-meta">${escapeHtml(entry.mime)} • ${escapeHtml(formatCompactBytes(estimateDownloadBytes(entry)))}</span>
          </a>
        `).join('')}
      </div>`;
  }

  function renderAssistantMessageHtml(text, downloads=[]){
    const visibleText = stripFileBlocks(text);
    const main = visibleText
      ? renderMarkdown(visibleText)
      : (downloads.length
          ? `<div class="assistant-files-placeholder">${downloads.length > 1 ? 'تم إنشاء ملفات قابلة للتنزيل داخل هذه الرسالة.' : 'تم إنشاء ملف قابل للتنزيل داخل هذه الرسالة.'}</div>`
          : renderMarkdown(text || ''));
    return `${main}${renderAssistantDownloadCards(downloads)}`;
  }

  function bindAssistantDownloadLinks(scope){
    scope?.querySelectorAll?.('[data-download-id]')?.forEach((el) => {
      if (el.dataset.bound === 'true') return;
      el.dataset.bound = 'true';
      el.addEventListener('click', (ev) => {
        ev.preventDefault();
        const ok = downloadStoredItem(el.dataset.downloadId);
        if (!ok) toast('⚠️ تعذر العثور على الملف المطلوب');
      });
    });
  }

  function describeAttachmentChip(a){
    const parts = [formatAttachmentKindLabel(a)];
    if (a.hasText && a.chars) parts.push(`${formatCompactChars(a.chars)} حرف`);
    else if (a.kind === 'image' && a.dataUrl) parts.push('مرئي');
    else parts.push('بدون نص');
    if (a.textWasClippedForPrompt) parts.push('مختصر للإرسال');
    return parts.join(' • ');
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
    toast('✅ تم إرسال الرد إلى اللوحة');
  }

  function renderEmptyChatState(log){
    if (!log) return;
    log.innerHTML = `
      <div class="empty-chat-state empty-chat-state--compact">
        <div class="empty-chat-title">المساحة جاهزة لبحث، منتج، أو خطة تنفيذ.</div>
        <div class="empty-chat-text">ابدأ من اللوحة العليا أو اكتب الهدف مباشرة. سيستخدم التطبيق الملفات، المعرفة، وملحقات المحادثة لبناء استجابة أوضح وأكثر احترافية.</div>
        <div class="empty-chat-points">
          <div class="empty-chat-point">
            <strong>مخرجات مريحة للقراءة</strong>
            <span>تقارير، ملخصات، وخطط عمل مكتوبة بطريقة واضحة ومريحة للقراءة الطويلة.</span>
          </div>
          <div class="empty-chat-point">
            <strong>سياق غني</strong>
            <span>الملفات، قاعدة المعرفة، والمرفقات تندمج داخل نفس سياق التشغيل بدل الدردشة المعزولة.</span>
          </div>
          <div class="empty-chat-point">
            <strong>جاهز للتنفيذ</strong>
            <span>استخدم القوالب، سير العمل، ونمط الوكيل لتحويل الطلب إلى مخرجات تنفيذية قابلة للاستخدام.</span>
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
      meta.textContent = (m.role === 'user' ? 'المستخدم' : 'المساعد') + ' • ' + new Date(m.ts || nowTs()).toLocaleString('ar');

      const body = document.createElement('div');
      body.className = 'body';
      const downloadState = m.role === 'assistant' ? ensureDownloadsFromText(m.content || '', m.id || '') : { entries: [], newCount: 0 };
      body.innerHTML = (m.role === 'assistant')
        ? renderAssistantMessageHtml(m.content || '', downloadState.entries)
        : `<pre style="margin:0; white-space:pre-wrap">${escapeHtml(m.content||'')}</pre>`;
      if (m.role === 'assistant') bindAssistantDownloadLinks(body);

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
        canvasBtn.textContent = 'إلى اللوحة';
        canvasBtn.addEventListener('click', () => sendMessageToCanvas(m));
        actions.appendChild(canvasBtn);

        const dlCount = ingestDownloadsFromText(m.content || '');
        if (dlCount){
          const info = document.createElement('span');
          info.className = 'hint';
          info.textContent = `📄 تم اكتشاف ${dlCount} ملفًا — راجع التحميلات`;
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
    renderThreadHistory();
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
      renderDownloads();
      refreshStrategicWorkspace().catch(()=>{});
      return;
    }

    msgs.forEach((m) => {
      const bubble = document.createElement('div');
      bubble.className = 'bubble ' + (m.role === 'user' ? 'user' : 'assistant');
      bubble.dataset.mid = m.id || '';

      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.textContent = (m.role === 'user' ? 'المستخدم' : 'المساعد') + ' • ' + new Date(m.ts || nowTs()).toLocaleString('ar');

      const body = document.createElement('div');
      body.className = 'body';
      const downloadState = m.role === 'assistant'
        ? ensureDownloadsFromText(m.content || '', m.id || '')
        : { entries: [], newCount: 0 };
      body.innerHTML = m.role === 'assistant'
        ? renderAssistantMessageHtml(m.content || '', downloadState.entries)
        : `<pre style="margin:0; white-space:pre-wrap">${escapeHtml(m.content || '')}</pre>`;
      if (m.role === 'assistant') bindAssistantDownloadLinks(body);

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
        canvasBtn.textContent = 'إلى اللوحة';
        canvasBtn.addEventListener('click', () => sendMessageToCanvas(m));
        actions.appendChild(canvasBtn);

        if (downloadState.entries.length){
          const dlBtn = document.createElement('button');
          dlBtn.className = 'btn ghost sm';
          dlBtn.textContent = `التحميلات (${downloadState.entries.length})`;
          dlBtn.addEventListener('click', () => {
            setActiveNav('downloads');
            renderDownloads();
          });
          actions.appendChild(dlBtn);

          const info = document.createElement('span');
          info.className = 'hint';
          info.textContent = downloadState.newCount
            ? `⬇️ تمت إضافة ${downloadState.newCount} ملف جديد`
            : `⬇️ ${downloadState.entries.length} ملف قابل للتنزيل`;
          actions.appendChild(info);
        }
      }

      bubble.appendChild(meta);
      bubble.appendChild(body);
      bubble.appendChild(actions);
      log.appendChild(bubble);
    });

    log.scrollTop = log.scrollHeight + 1000;
    refreshNavMeta();
    renderDownloads();
    renderThreadHistory();
    refreshStrategicWorkspace().catch(()=>{});
  }

  function updateChatAttachChips(){
    const box = $('chatAttachChips');
    if (!box) return;
    box.innerHTML = '';
    pendingChatAttachments.forEach((a, idx) => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.title = `${a.name}\n${describeAttachmentChip(a)}`;
      chip.innerHTML = `<span>${escapeHtml(a.name)}</span><span class="meta">${escapeHtml(describeAttachmentChip(a))}</span>`;
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

  function syncComposerMeta(){
    const meta = $('composerContextMeta');
    if (!meta) return;
    const pid = getCurProjectId();
    const files = loadFiles(pid);
    const thread = getCurThread();
    const flags = [];
    if (hasProjectBrief(getProjectBrief(pid))) flags.push('ذاكرة المشروع مفعّلة');
    if (getStudyMode()) flags.push('وضع دراسي');

    const recognized = pendingChatAttachments.filter((a) => a.hasText).length;
    const visibleImages = pendingChatAttachments.filter((a) => a.kind === 'image' && a.dataUrl).length;
    const attachmentChars = pendingChatAttachments.reduce((sum, a) => sum + Number(a.chars || 0), 0);
    const parts = [
      `الملفات ${files.length}`,
      `الرسائل ${(thread.messages || []).length}`,
      `المرفقات ${pendingChatAttachments.length}`
    ];
    if (pendingChatAttachments.length){
      parts.push(`مقروء ${recognized}/${pendingChatAttachments.length}`);
      if (attachmentChars) parts.push(`نص مرفق ${formatCompactChars(attachmentChars)} حرف`);
      if (visibleImages) parts.push(`صور ${visibleImages}`);
    }
    if (flags.length) parts.push(...flags);
    meta.textContent = parts.join(' • ');
    resizeComposerInput();
  }

  function inferAttachmentKind(file){
    const name = String(file?.name || '').toLowerCase();
    const type = String(file?.type || '').toLowerCase();
    if (type.startsWith('image/') || /\.(png|jpe?g|webp|bmp|gif|tiff?)$/i.test(name)) return 'image';
    if (name.endsWith('.pdf')) return 'pdf';
    if (name.endsWith('.docx')) return 'docx';
    if (/\.(txt|md|csv|json|xml|html|htm)$/i.test(name)) return 'text';
    return 'file';
  }

  async function addChatAttachments(fileList){
    const settings = getSettings();
    const files = Array.from(fileList || []);
    if (!files.length) return;

    showStatus('إرفاق الملفات وتحليلها…', true);
    for (let idx=0; idx<files.length; idx++){
      const file = files[idx];
      const name = file.name || 'file';
      const kind = inferAttachmentKind(file);
      const stepLabel = `إرفاق ${idx + 1}/${files.length}: ${name}`;
      let textFull = '';
      let dataUrl = '';
      let extractionMode = kind === 'image' ? 'صورة' : 'استخراج نص';

      try{
        showStatus(`${stepLabel}…`, true);
        if (kind === 'image'){
          dataUrl = await fileToDataUrl(file);
          extractionMode = 'OCR + صورة مرئية';
          try{
            textFull = await ocrDataUrl(dataUrl, getOcrLang(), { fileName: name, page: 1 });
          }catch(_){
            textFull = '';
          }
        } else if (kind === 'pdf'){
          extractionMode = `PDF ${getTranscribeProfileLabel()}`;
          textFull = await fileToTextSmart(file, {
            onProgress: (done, total, meta = {}) => {
              const method = meta.method === 'ocr' ? 'OCR' : 'نص رقمي';
              showStatus(`${stepLabel} • ${done}/${total} • ${method}`, true);
            }
          });
        } else {
          extractionMode = kind === 'docx' ? 'Word قابل للقراءة' : 'تحليل نص مباشر';
          textFull = await fileToTextSmart(file);
        }
      }catch(_){
        textFull = '';
        extractionMode = kind === 'image' ? 'صورة مرئية فقط' : 'تعذر استخراج النص';
      }

      const cleanText = String(textFull || '').trim();
      pendingChatAttachments.push({
        id: makeId('att'),
        name,
        kind,
        type: file.type || '',
        size: file.size || 0,
        dataUrl,
        text: cleanText ? clipText(cleanText, 360) : '',
        textFull: cleanText,
        chars: cleanText.length,
        hasText: !!cleanText,
        extractionMode,
        textWasClippedForPrompt: false
      });
    }

    showStatus('', false);
    updateChatAttachChips();
    toast('✅ تم إرفاق الملفات وإدراجها في سياق الدردشة');
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
    if (composerListening) stopComposerDictation();
    const input = $('chatInput');
    const text = (input.value || '').trim();
    if (!text) return;

    const rawSettings = getSettings();
    const policy = getAppRuntimePolicy(rawSettings);
    const settings = policy.runtime;
    if (!policy.allowChat){
      if (getAccountRuntimeState().authRequired && !hasValidAuthSession()) openAuthGate(policy.blockedReason);
      return toast(`⚠️ ${policy.blockedReason}`);
    }
    if (!hasAuthReady(settings)) return toast(`⚠️ ${getMissingAuthMessage(settings)}`);

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
    ensureThreadTitleFromMessage(thread, text);
    thread.updatedAt = nowTs();
    threads[idx] = thread;
    saveThreads(pid, threads);

    input.value = '';
    resizeComposerInput(input);
    syncComposerMeta();
    renderChat();

    const filesText = buildAutoFilesContext(settings);
    const attachmentsForRequest = pendingChatAttachments.slice();
    
    const rag = await buildRagContextIfEnabled(text, rawSettings);
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
            showStatus('⚠️ تعذر البث المباشر على هذا الاتصال، سيتم المتابعة بدون بث مباشر…', true);
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

      if (getEffectiveModeState(rawSettings, policy).agent && ans && !answerHasAgentPlan(ans)){
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

  const rawSettings = getSettings();
  const policy = getAppRuntimePolicy(rawSettings);
  if (!policy.allowResearch) return toast(`⚠️ ${getPolicyFeatureReason('research', policy)}`);
  const settings = policy.runtime;
  if (!hasAuthReady(settings)) return toast(`⚠️ ${getMissingAuthMessage(settings)}`);

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
    const res = await searchKb(topic, rawSettings);
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
      pushAssistant('🧪 تقرير بحث:\n\n' + final);
    } else {
      if (settings.streaming){
        const aId = makeId('m');
        const threads = loadThreads(pid);
        const idx = threads.findIndex(t => t.id === tid);
        const thread = threads[idx] || threads[0];
        thread.messages = thread.messages || [];
        thread.messages.push({ id: aId, role:'assistant', content:'🧪 تقرير بحث:\n\n', ts: nowTs() });
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
          onDelta: (_d, full) => updateStreamingAssistant(aId, '🧪 تقرير بحث:\n\n' + full)
        });

        const threads2 = loadThreads(pid);
        const thread2 = threads2.find(t => t.id === tid) || threads2[0];
        const msg2 = (thread2.messages||[]).find(m => m.id === aId);
        if (msg2) msg2.content = '🧪 تقرير بحث:\n\n' + final;
        saveThreads(pid, threads2);
        renderChat();
      } else {
        final = await callOpenAIChat({ apiKey: settings.apiKey, baseUrl, model: settings.model, messages: [{role:'system', content: sys},{role:'user', content: synthPrompt}], max_tokens: Math.min(2400, Number(settings.maxOut||2000)), signal: abortCtl.signal, extraHeaders });
        pushAssistant('🧪 تقرير بحث:\n\n' + final);
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
    const rawSettings = getSettings();
    const policy = getAppRuntimePolicy(rawSettings);
    const settings = policy.runtime;
    if (!policy.allowChat){
      if (getAccountRuntimeState().authRequired && !hasValidAuthSession()) openAuthGate(policy.blockedReason);
      return toast(`⚠️ ${policy.blockedReason}`);
    }
    if (!hasAuthReady(settings)) return toast(`⚠️ ${getMissingAuthMessage(settings)}`);
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

    card('🧪 بحث متكامل (3 مراحل)', 'خطة → ملاحظات (الويب/المعرفة) → تقرير + ملف تنزيل.', [
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

    card('🧩 بناء تطبيق HTML من اللوحة', 'استخدم محتوى اللوحة لإنشاء تطبيق HTML كامل داخل ملف واحد.', [
      {label:'تشغيل على اللوحة', kind:'btn sm', onClick: () => { setActiveNav('canvas'); canvasAi('build_app_html'); }},
      {label:'فتح اللوحة', kind:'btn ghost sm', onClick: () => setActiveNav('canvas')},
    ]);

    card('📌 عناصر تنفيذ', 'استخراج مهام من آخر محادثة: المهمة + المالك + الموعد + الأولوية + الحالة.', [
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
        { step:'research', note:'تقرير بحث متعدد المراحل'}
      ],
      ocr_index: [
        { step:'ocr_images', note:'OCR لكل الصور داخل الملفات'},
        { step:'kb_index', note:'إعادة فهرسة قاعدة المعرفة'}
      ],
      kb_summary: [
        { step:'chat', prompt:'لخّص قاعدة المعرفة الحالية بوضوح مع اقتباسات [KB:...] وأنشئ ملف kb_summary.md باستخدام قالب ```file```.'}
      ],
      action_items: [
        { step:'chat', prompt:'استخرج عناصر التنفيذ من المحادثة بصيغة جدول وأنشئ ملف action_items.md باستخدام قالب ```file```.'}
      ],
      canvas_app: [
        { step:'canvas_build', note:'اللوحة → بناء تطبيق HTML'}
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
    wfLog('▶ تشغيل سير العمل: ' + id);

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
      wfLog(`\nالخطوة ${i+1}: ${st.step || 'غير معروف'}`);
      if (st.step === 'research'){
        wfLog('… تشغيل البحث');
        await runResearchAgent();
      } else if (st.step === 'ocr_images'){
        await ocrAllImages();
      } else if (st.step === 'kb_index'){
        wfLog('… إعادة فهرسة KB');
        await buildKb();
        wfLog('✅ اكتملت فهرسة قاعدة المعرفة');
      } else if (st.step === 'chat'){
        const prompt = String(st.prompt || '').trim();
        if (!prompt){ wfLog('⚠️ لا يوجد طلب'); continue; }
        // push prompt to chat and send
        $('chatInput').value = prompt;
        setActiveNav('chat');
        await sendMessage();
      } else if (st.step === 'canvas_build'){
        wfLog('… بناء تطبيق HTML من اللوحة');
        setActiveNav('canvas');
        canvasAi('build_app_html');
      } else {
        wfLog('⚠️ خطوة غير معروفة: ' + st.step);
      }
    }
    wfLog('\n✅ اكتمل سير العمل');
    toast('✅ اكتمل سير العمل');
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
    if ($('cloudRetryMax')) $('cloudRetryMax').value = String(s.cloudRetryMax || 2);
    if ($('freeMode')) $('freeMode').checked = !!s.freeMode;
    if ($('costGuard')) $('costGuard').value = s.costGuard || 'balanced';
    if ($('upgradeEmail')) $('upgradeEmail').value = s.upgradeEmail || DEFAULT_AUTH_CONFIG.upgradeEmail;
    if ($('maxCloudPdfPages')) $('maxCloudPdfPages').value = String(s.maxCloudPdfPages || DEFAULT_SETTINGS.maxCloudPdfPages);
    if ($('maxCloudFileMB')) $('maxCloudFileMB').value = String(s.maxCloudFileMB || DEFAULT_SETTINGS.maxCloudFileMB);
    if ($('allowCloudOcr')) $('allowCloudOcr').checked = !!s.allowCloudOcr;
    if ($('allowCloudPolish')) $('allowCloudPolish').checked = !!s.allowCloudPolish;
    if ($('toolsDefault')) $('toolsDefault').checked = !!s.toolsEnabled;
    if ($('toolsToggle')) $('toolsToggle').checked = !!s.toolsEnabled;
    renderTranscribeOperationalState();

    $('streamDefault').checked = !!s.streaming;
    $('streamToggle').checked = !!s.streaming;

    // keep RAG toggle persisted
    setRagToggle(!!s.rag);
    $('ragToggle').checked = !!s.rag;

    refreshModeButtons();
    syncAccountUi();
    refreshStrategicWorkspace().catch(()=>{});
  }

  function saveSettingsFromUI(){
    const authMode = $('authMode') ? $('authMode').value : 'browser';
    const gatewayInput = $('gatewayUrl') ? normalizeEndpointUrl($('gatewayUrl').value) : '';
    const gatewayToken = $('gatewayToken') ? $('gatewayToken').value.trim() : '';
    const cloudConvertEndpoint = $('cloudConvertEndpoint') ? normalizeEndpointUrl($('cloudConvertEndpoint').value) : '';
    const cloudConvertFallbackEndpoint = $('cloudConvertFallbackEndpoint') ? normalizeEndpointUrl($('cloudConvertFallbackEndpoint').value) : '';
    const ocrCloudEndpoint = $('ocrCloudEndpoint') ? normalizeEndpointUrl($('ocrCloudEndpoint').value) : '';
    const ocrLang = $('ocrLang') ? $('ocrLang').value.trim() : 'ara+eng';
    const cloudRetryMax = $('cloudRetryMax') ? clamp(Number($('cloudRetryMax').value || 2), 1, 5) : 2;
    const freeMode = $('freeMode') ? !!$('freeMode').checked : false;
    const costGuard = $('costGuard') ? $('costGuard').value : 'balanced';
    const upgradeEmail = $('upgradeEmail') ? $('upgradeEmail').value.trim() : DEFAULT_AUTH_CONFIG.upgradeEmail;
    const maxCloudPdfPages = $('maxCloudPdfPages') ? clamp(Number($('maxCloudPdfPages').value || DEFAULT_SETTINGS.maxCloudPdfPages), 1, 400) : DEFAULT_SETTINGS.maxCloudPdfPages;
    const maxCloudFileMB = $('maxCloudFileMB') ? clamp(Number($('maxCloudFileMB').value || DEFAULT_SETTINGS.maxCloudFileMB), 1, 200) : DEFAULT_SETTINGS.maxCloudFileMB;
    const allowCloudOcr = $('allowCloudOcr') ? !!$('allowCloudOcr').checked : true;
    const allowCloudPolish = $('allowCloudPolish') ? !!$('allowCloudPolish').checked : true;
    const toolsEnabled = $('toolsDefault') ? !!$('toolsDefault').checked : (!!$('toolsToggle')?.checked);
    const account = getAccountRuntimeState();
    const freeLocked = account.authRequired && !account.premium;
    const selectedProvider = freeLocked ? 'openrouter' : $('provider').value;
    const selectedModel = freeLocked ? 'openrouter/free' : $('model').value.trim();
    const gatewayValidation = authMode === 'gateway'
      ? validateGatewayUrlInput(gatewayInput, { cloudConvertEndpoint, cloudConvertFallbackEndpoint, ocrCloudEndpoint })
      : { ok:true, normalized:gatewayInput, warning:'' };

    if (!gatewayValidation.ok){
      showStatus(`❌ ${gatewayValidation.reason}`, false);
      if ($('gatewayUrl')) $('gatewayUrl').focus();
      return getSettings();
    }
    const gatewayUrl = gatewayValidation.normalized || '';
    if ($('gatewayUrl')) $('gatewayUrl').value = gatewayUrl;

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
      if (gatewayValidation.warning){
        toast(`ℹ️ ${gatewayValidation.warning}`);
      }
      if ($('provider').value === 'openrouter'){
        // ok
      }
    }

    const s = setSettings({
      provider: selectedProvider,
      baseUrl,
      model: selectedModel,

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
      cloudRetryMax,
      ocrCloudEndpoint,
      ocrLang: ocrLang || 'ara+eng',
      freeMode,
      costGuard,
      googleClientId: '',
      upgradeEmail: upgradeEmail || DEFAULT_AUTH_CONFIG.upgradeEmail,
      maxCloudPdfPages,
      maxCloudFileMB,
      allowCloudOcr,
      allowCloudPolish,

      orReferer: $('orReferer').value.trim(),
      orTitle: $('orTitle').value.trim()
    });

    // sync toggles
    $('streamToggle').checked = !!s.streaming;
    setRagToggle(!!s.rag);
    $('ragToggle').checked = !!s.rag;
    if ($('toolsToggle')) $('toolsToggle').checked = !!s.toolsEnabled;

    toast('✅ تم حفظ الإعدادات');
    if (freeLocked){
      if ($('provider')) $('provider').value = 'openrouter';
      if ($('model')) $('model').value = 'openrouter/free';
    }
    loadRemoteAuthConfig(true).then(() => syncAccountUi()).catch(() => syncAccountUi());
    refreshModeButtons();
    refreshStrategicWorkspace().catch(()=>{});
    return s;
  }

  // ---------------- Navigation ----------------
  function setActiveNav(page){
    if (page !== 'chat' && composerListening) stopComposerDictation();
    document.querySelectorAll('.navbtn').forEach(b => b.classList.toggle('active', b.dataset.page === page));
    document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === `page-${page}`));
    const titles = { chat:'الدردشة', knowledge:'المعرفة (KB)', canvas:'اللوحة', files:'الملفات', transcription:'مختبر الوثائق', workflows:'سير العمل', downloads:'التحميلات', projects:'المشاريع', guide:'دليل الاستخدام', settings:'الإعدادات' };
    $('topTitle').textContent = titles[page] || 'استوديو الذكاء';
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
    $('navGuideMeta') && ($('navGuideMeta').textContent = 'AR');
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
    const s = getAppRuntimePolicy(getSettings()).runtime;
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
    const policy = getAppRuntimePolicy(getSettings());
    const seeded = await fetchOpenRouterModels(false).catch(()=>[]);
    const models = seeded.some(m => m.id === 'openrouter/free')
      ? seeded.slice()
      : [{ id:'openrouter/free', name:'OpenRouter Free Router', provider:'openrouter', ctx:null, pp:0, pc:0, tools:false, vision:false }, ...seeded];
    const list = $('modelList');
    const q = String($('modelSearch')?.value || '').trim().toLowerCase();
    const providerFilter = String($('modelProviderFilter')?.value || '');
    const sort = String($('modelSort')?.value || 'name');
    const favOnly = ($('modelFavOnlyBtn')?.dataset.on === '1');
    const favs = new Set(loadFavs());
    const hint = $('modelHubHint');

    let filtered = models.slice();
    if (q) filtered = filtered.filter(m => (m.id.toLowerCase().includes(q) || (m.name||'').toLowerCase().includes(q)));
    if (providerFilter) filtered = filtered.filter(m => m.provider === providerFilter);
    if (favOnly) filtered = filtered.filter(m => favs.has(m.id));
    if (policy.freeMode) filtered = filtered.filter(isFreeTierModel);

    const num = (x) => (x==null ? Number.POSITIVE_INFINITY : Number(x));
    if (sort === 'context_desc') filtered.sort((a,b)=> num(b.ctx)-num(a.ctx));
    else if (sort === 'price_prompt_asc') filtered.sort((a,b)=> num(a.pp)-num(b.pp));
    else if (sort === 'price_completion_asc') filtered.sort((a,b)=> num(a.pc)-num(b.pc));
    else filtered.sort((a,b)=> String(a.id).localeCompare(String(b.id)));

    if (hint){
      hint.textContent = policy.freeMode
        ? 'الخطة المجانية تعرض النماذج المجانية فقط، وسيتم فرض OpenRouter Free عند الحفظ والتنفيذ.'
        : '⭐ لحفظه كمفضلة. يمكنك اختيار أي موديل أو كتابته يدويًا.';
    }

    list.innerHTML = '';
    if (!filtered.length){
      list.innerHTML = `<div class="status" data-tone="info">لا توجد نماذج مطابقة للفلترة الحالية${policy.freeMode ? ' داخل الفئة المجانية' : ''}.</div>`;
      return;
    }

    filtered.slice(0, 400).forEach(m => {
      const row = document.createElement('div');
      const freeTier = isFreeTierModel(m);
      row.className = `bubble model-card ${freeTier ? 'is-free' : 'is-paid'}`;
      const badges = [];
      if (m.ctx) badges.push(`<span class="tag">ctx ${escapeHtml(m.ctx)}</span>`);
      if (m.vision) badges.push(`<span class="tag">vision</span>`);
      if (m.tools) badges.push(`<span class="tag">tools</span>`);
      badges.push(`<span class="tag ${freeTier ? 'tag-free' : 'tag-paid'}">${freeTier ? 'مجاني' : 'مدفوع'}</span>`);
      const prices = [];
      if (freeTier) prices.push('متاح ضمن الخطة المجانية');
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
    if (provSel){
      provSel.innerHTML = '<option value="">كل المزوّدين</option>';
    }
    if (provSel && models.length){
      const providerSource = policy.freeMode ? filtered : models;
      const providers = Array.from(new Set(providerSource.map(x => x.provider).filter(Boolean))).sort();
      for (const p of providers){
        const o = document.createElement('option');
        o.value = p; o.textContent = p;
        provSel.appendChild(o);
      }
      provSel.value = providerFilter && providers.includes(providerFilter) ? providerFilter : '';
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
      $('modelList').innerHTML = `<div class="hint">تعذر تحميل النماذج. تأكد من الرابط الأساسي والمفتاح. وإذا كنت تستخدم البوابة فاجعل رابطها بدون <span class="kbd">/v1</span>.</div>`;
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
    $('accountTriggerBtn')?.addEventListener('click', openAccountCenter);
    $('accountSignInBtn')?.addEventListener('click', () => openAuthGate());
    $('accountUpgradeRequestBtn')?.addEventListener('click', requestUpgradeByEmail);
    $('accountLogoutBtn')?.addEventListener('click', logoutCurrentAccount);
    $('activateUpgradeBtn')?.addEventListener('click', activateUpgradeCodeFromUi);
    $('adminGenerateUpgradeBtn')?.addEventListener('click', generateAdminUpgradeCodeFromUi);
    $('adminCopyUpgradeBtn')?.addEventListener('click', copyAdminUpgradeCode);
    $('authEntrySubmitBtn')?.addEventListener('click', submitUnifiedAuthEntry);
    $('authRetryBtn')?.addEventListener('click', async () => {
      AUTH_RUNTIME.config = null;
      await loadRemoteAuthConfig(true);
      syncAccountUi();
      renderGoogleButton(true).catch(()=>{});
    });
    $('authCloseBtn')?.addEventListener('click', () => closeAuthGate());
    $('upgradeCodeInput')?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter'){
        event.preventDefault();
        activateUpgradeCodeFromUi();
      }
    });
    ['adminUpgradeEmail', 'adminUpgradeDays'].forEach((id) => {
      $(id)?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter'){
          event.preventDefault();
          generateAdminUpgradeCodeFromUi();
        }
      });
    });
    ['authEntryName', 'authEntryEmail', 'authEntryPassword'].forEach((id) => {
      $(id)?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter'){
          event.preventDefault();
          submitUnifiedAuthEntry();
        }
      });
    });
    $('authEntryEmail')?.addEventListener('input', syncUnifiedAuthEntry);

    // nav
    $('nav').addEventListener('click', (e) => {
      const btn = e.target.closest('.navbtn');
      if (!btn) return;
      setActiveNav(btn.dataset.page);
      closeSide();
      if (btn.dataset.page === 'downloads') renderDownloads();
      if (btn.dataset.page === 'workflows') renderWorkflows();
      if (btn.dataset.page === 'projects') renderProjects();
      if (btn.dataset.page === 'guide') renderGuidePage();
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
    $('modeDeepBtn').addEventListener('click', () => {
      const policy = getAppRuntimePolicy();
      if (!policy.allowDeepMode) return toast(`⚠️ ${getPolicyFeatureReason('deepMode', policy)}`);
      setDeep(!isDeep());
      refreshModeButtons();
      toast(isDeep() ? '🧠 تم تفعيل التفكير العميق' : '🧠 تم إيقاف التفكير العميق');
    });
    $('modeAgentBtn').addEventListener('click', () => {
      const policy = getAppRuntimePolicy();
      if (!policy.allowAgentMode) return toast(`⚠️ ${getPolicyFeatureReason('agentMode', policy)}`);
      setAgent(!isAgent());
      refreshModeButtons();
      toast(isAgent() ? '🤖 تم تفعيل وضع الوكيل' : '🤖 تم إيقاف وضع الوكيل');
    });
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

$('chatToolbarPinBtn')?.addEventListener('click', () => {
  setChatToolbarPinned(!getChatToolbarPinned());
  applyUiCollapse();
  toast(getChatToolbarPinned() ? '📌 تم تثبيت شريط أدوات الدردشة' : '📍 تم إلغاء تثبيت شريط الأدوات');
});


    $('webToggleBtn').addEventListener('click', () => {
      const policy = getAppRuntimePolicy();
      if (!policy.allowWeb) return toast(`⚠️ ${getPolicyFeatureReason('web', policy)}`);
      setWebToggle(!getWebToggle());
      refreshModeButtons();
      toast(getWebToggle() ? '🔎 تم تفعيل الويب' : '🔎 تم إيقاف الويب');
    });

    $('newThreadBtn').addEventListener('click', () => { newThread(); setActiveNav('chat'); });

    document.addEventListener('click', (e) => {
      const quick = e.target.closest('[data-quick-prompt]');
      if (!quick) return;
      applyQuickPrompt(quick.dataset.quickPrompt || '');
    });

    document.addEventListener('click', (e) => {
      const openPageBtn = e.target.closest('[data-open-page]');
      if (openPageBtn){
        setActiveNav(openPageBtn.dataset.openPage || 'chat');
      }
      const guideBtn = e.target.closest('[data-guide-target]');
      if (guideBtn){
        document.getElementById(`guide-${guideBtn.dataset.guideTarget}`)?.scrollIntoView({ behavior:'smooth', block:'start' });
      }
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
      const policy = getAppRuntimePolicy();
      if (!policy.allowDeepSearch) return toast(`⚠️ ${getPolicyFeatureReason('deepSearch', policy)}`);
      setDeepSearch(!isDeepSearch());
      refreshDeepSearchBtn();
      toast(isDeepSearch() ? '🔬 Deep Search ON' : '🔬 Deep Search OFF');
    });

    $('focusModeBtn')?.addEventListener('click', () => {
      setFocusMode(!getFocusMode());
      applyShellLayout();
      refreshStrategicWorkspace().catch(()=>{});
    });
    $('historyDrawerBtn')?.addEventListener('click', openThreadDrawer);
    $('threadDrawerCloseBtn')?.addEventListener('click', closeThreadDrawer);
    $('threadDrawerOverlay')?.addEventListener('click', closeThreadDrawer);
    $('threadSearchInput')?.addEventListener('input', renderThreadHistory);
    $('threadExportAllBtn')?.addEventListener('click', exportAllThreads);
    $('pinSideBtn')?.addEventListener('click', () => {
      setSidebarPinned(!getSidebarPinned());
      applyShellLayout();
    });
    $('studyModeBtn')?.addEventListener('click', () => {
      setStudyMode(!getStudyMode());
      applyShellLayout();
      syncComposerMeta();
      refreshStrategicWorkspace().catch(()=>{});
      toast(getStudyMode() ? '📚 تم تفعيل وضع الدراسة' : '📚 تم إيقاف وضع الدراسة');
    });
    $('voiceInputBtn')?.addEventListener('click', toggleComposerDictation);
    ['briefGoal','briefAudience','briefDeliverable','briefConstraints','briefMemory','briefResponseRules','briefStyle'].forEach((id) => {
      const el = $(id);
      if (!el) return;
      el.addEventListener('input', saveProjectBriefFromUI);
      el.addEventListener('change', saveProjectBriefFromUI);
    });
    $('briefApplyBtn')?.addEventListener('click', applyProjectBriefToComposer);
    $('briefClearBtn')?.addEventListener('click', clearProjectBrief);
    $('guideSearch')?.addEventListener('input', renderGuidePage);
    $('guideExportBtn')?.addEventListener('click', exportGuideDoc);
    $('transcribeProfile')?.addEventListener('change', (e) => {
      setTranscribeProfile(e.target.value);
      syncTranscribeControls();
      updateTranscribeLabState({ note:'تم تحديث ملف التشغيل. اختر ملفًا أو أعد الاستخراج لتطبيقه.' });
    });
    $('transcribeDocxMode')?.addEventListener('change', (e) => {
      setTranscribeDocxMode(e.target.value);
      syncTranscribeControls();
      updateTranscribeLabState({ note:'تم تحديث مسار التحويل. استخدم الوضع السحابي عند البحث عن أفضل تطابق ممكن.' });
    });

$('sendBtn').addEventListener('click', sendMessage);
    $('stopBtn').addEventListener('click', stopGeneration);
    $('regenBtn').addEventListener('click', regenLast);
    $('chatInput').addEventListener('input', () => {
      syncComposerMeta();
    });
    window.addEventListener('resize', scheduleShellLayoutRefresh);
    document.addEventListener('focusin', syncKeyboardEditingState, true);
    document.addEventListener('focusout', () => {
      window.setTimeout(() => {
        syncKeyboardEditingState();
        scheduleShellLayoutRefresh();
      }, 120);
    }, true);
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
      toast(s.streaming ? '📡 تم تفعيل البث المباشر' : '📡 تم إيقاف البث المباشر');
    });

    $('ragToggle') && $('ragToggle').addEventListener('change', (e) => {
      const policy = getAppRuntimePolicy();
      if (!policy.allowRag){
        e.preventDefault();
        e.target.checked = false;
        return toast(`⚠️ ${getPolicyFeatureReason('rag', policy)}`);
      }
      setRagToggle(!!e.target.checked);
      toast(e.target.checked ? '🧠 تم تفعيل RAG' : '🧠 تم إيقاف RAG');
    });


    $('toolsToggle') && $('toolsToggle').addEventListener('change', (e) => {
      const policy = getAppRuntimePolicy();
      if (!policy.allowTools){
        e.preventDefault();
        e.target.checked = false;
        if ($('toolsDefault')) $('toolsDefault').checked = false;
        return toast(`⚠️ ${getPolicyFeatureReason('tools', policy)}`);
      }
      const s = setSettings({ toolsEnabled: !!e.target.checked });
      if ($('toolsDefault')) $('toolsDefault').checked = !!s.toolsEnabled;
      toast(s.toolsEnabled ? '🧰 تم تفعيل الأدوات' : '🧰 تم إيقاف الأدوات');
    });

    $('toolsDefault') && $('toolsDefault').addEventListener('change', (e) => {
      const policy = getAppRuntimePolicy();
      if (!policy.allowTools){
        e.preventDefault();
        e.target.checked = false;
        if ($('toolsToggle')) $('toolsToggle').checked = false;
        return toast(`⚠️ ${getPolicyFeatureReason('tools', policy)}`);
      }
      const s = setSettings({ toolsEnabled: !!e.target.checked });
      if ($('toolsToggle')) $('toolsToggle').checked = !!s.toolsEnabled;
      toast(s.toolsEnabled ? '🧰 تم تفعيل الأدوات' : '🧰 تم إيقاف الأدوات');
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
    let transcribeFileMeta = buildTranscribeSourceMeta(null, { name:'بدون ملف', pages:0, sizeMB:0 });
    let transcribeFileInspectNonce = 0;

    const inspectTranscribeFile = async (f) => {
      const nonce = ++transcribeFileInspectNonce;
      if (!f){
        transcribeFileMeta = buildTranscribeSourceMeta(null, { name:'بدون ملف', pages:0, sizeMB:0 });
        renderTranscribeOperationalState(transcribeFileMeta);
        return;
      }
      const baseMeta = buildTranscribeSourceMeta(f, { file:f });
      transcribeFileMeta = baseMeta;
      renderTranscribeOperationalState(baseMeta);
      if (!baseMeta.isPdf) return;
      try{
        const pages = await readPdfPageCount(f);
        if (nonce !== transcribeFileInspectNonce || transcribeSelectedFile !== f) return;
        transcribeFileMeta = buildTranscribeSourceMeta(f, { file:f, pages });
        renderTranscribeOperationalState(transcribeFileMeta);
      }catch(_){
        if (nonce !== transcribeFileInspectNonce || transcribeSelectedFile !== f) return;
        transcribeFileMeta = buildTranscribeSourceMeta(f, { file:f });
        renderTranscribeOperationalState(transcribeFileMeta);
      }
    };

    const setTranscribeFile = (f) => {
      transcribeSelectedFile = f || null;
      transcribeLastStructured = null;
      transcribeFileMeta = buildTranscribeSourceMeta(f, { file:f });
      if ($('transcribeFileName')) $('transcribeFileName').textContent = f ? `الملف: ${f.name}` : 'لم يتم اختيار ملف بعد';
      if ($('transcribeStats')) $('transcribeStats').textContent = f ? 'جاهز للاستخراج' : 'جاهز';
      updateTranscribeLabState({
        source: f ? briefSnippet(f.name, 36) : 'لا يوجد',
        engine: f ? `جاهز • ${getTranscribeProfileLabel()}` : 'جاهز',
        quality: '—',
        note: f
          ? `تم اختيار الملف. يمكنك الآن استخراج النص أو التحويل إلى Word عبر وضع ${getTranscribeDocxModeLabel()}.`
          : 'اختر ملفًا لبدء الاستخراج أو التحويل.'
      });
      renderTranscribeOperationalState(transcribeFileMeta);
      inspectTranscribeFile(f);
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
        const profileLabel = getTranscribeProfileLabel();
        showStatus('استخراج النص…', true);
        $('transcribeStats').textContent = `جاري الاستخراج • ${profileLabel}...`;
        updateTranscribeLabState({
          source: briefSnippet(f.name, 36),
          engine: isPdf ? `استخراج PDF • ${profileLabel}` : `OCR/قراءة ملف • ${profileLabel}`,
          quality: 'قيد التحليل',
          note: 'يتم الآن تحليل الملف واختيار أفضل مسار بين النص الرقمي وOCR حسب جودة الصفحات.'
        });
        if (isPdf){
          const result = await extractPdfStrategic(f, {
            onProgress: (p, total, info) => { $('transcribeStats').textContent = `صفحة ${p}/${total} • ${info?.method || 'native'}`; }
          });
          transcribeLastStructured = result;
          $('transcribeOutput').value = result?.text || '';
          $('transcribeStats').textContent = `استخراج ${result.extractedPages}/${result.totalPages} صفحة • ${result.text.length} حرف`;
          updateTranscribeLabState({
            source: `${briefSnippet(f.name, 26)} • ${result.totalPages} صفحة`,
            engine: `PDF • ${profileLabel} • أصلي ${result.nativePages}/${result.totalPages}`,
            quality: result.quality || 'جيدة',
            note: result.ocrPages
              ? `اكتمل الاستخراج. تم استخدام OCR في ${result.ocrPages} صفحة عند الحاجة مع الحفاظ على النص الرقمي حيث كان صالحًا.`
              : 'اكتمل الاستخراج من الطبقة النصية الأصلية بدون حاجة كبيرة إلى OCR.'
          });
        } else {
          const txt = await fileToTextSmart(f);
          $('transcribeOutput').value = txt || '';
          $('transcribeStats').textContent = txt ? `استخراج صورة • ${txt.length} حرف` : 'لم يتم العثور على نص';
          updateTranscribeLabState({
            source: briefSnippet(f.name, 26),
            engine: 'OCR/قراءة ملف',
            quality: txt ? 'قابل للمراجعة' : 'غير كافٍ',
            note: txt
              ? 'اكتمل استخراج النص. راجع الأسطر وعلامات الترقيم قبل التصدير النهائي إذا كان الملف صورة أو مسحًا ضوئيًا.'
              : 'لم يتم العثور على نص واضح داخل الملف الحالي.'
          });
        }
        transcribeFileMeta = buildTranscribeSourceMeta(f, {
          file:f,
          pages: transcribeLastStructured?.totalPages || transcribeFileMeta.pages || 0,
          textLength: String($('transcribeOutput')?.value || '').length
        });
        updateTranscribeLiveStats();
        renderTranscribeOperationalState(transcribeFileMeta);
        showStatus('', false);
      }catch(e){
        updateTranscribeLabState({ engine:'فشل الاستخراج', quality:'توقف', note:String(e?.message || e) });
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
      resizeComposerInput($('chatInput'));
      syncComposerMeta();
      $('chatInput').focus();
      toast('✅ تم إرسال النص إلى الدردشة');
    });
    $('transcribeClearBtn')?.addEventListener('click', () => {
      setTranscribeFile(null);
      if ($('transcribeOutput')) $('transcribeOutput').value = '';
      if ($('transcribeStats')) $('transcribeStats').textContent = 'جاهز';
      updateTranscribeLabState({
        source: 'لا يوجد',
        engine: 'جاهز',
        quality: '—',
        note: 'تمت إعادة ضبط مختبر الوثائق. اختر ملفًا جديدًا للبدء.'
      });
      updateTranscribeLiveStats();
      toast('✅ تم المسح');
    });
    $('transcribeConvertBtn')?.addEventListener('click', async () => {
      if (!transcribeSelectedFile) return toast('⚠️ اختر ملف PDF أولاً');
      try{
        const isPdf = /\.pdf$/i.test(String(transcribeSelectedFile.name || '')) || String(transcribeSelectedFile.type || '').includes('pdf');
        if (!isPdf) return toast('⚠️ التحويل إلى Word مخصص لملفات PDF');
        showStatus('تحويل PDF إلى DOCX احترافي قابل للتعديل…', true);
        $('transcribeStats').textContent = 'جاري التحويل...';
        const s = getSettings();
        const mode = getTranscribeDocxMode();
        const routeDecision = decidePdfDocxRoute(mode, transcribeFileMeta, s);
        const route = routeDecision.route;
        let result = null;
        renderTranscribeOperationalState(transcribeFileMeta);
        if (route !== mode && routeDecision.reason) toast(`ℹ️ ${routeDecision.reason}`);
        if (route === 'cloud'){
          $('transcribeStats').textContent = 'تحويل عبر المسار السحابي...';
          const cloudEngineLabel = transcribeCloudHealthState?.docxMode === 'cloudconvert'
            ? 'تحويل DOCX • CloudConvert مطابق'
            : (transcribeCloudHealthState?.fidelityReady
              ? 'تحويل DOCX • سحابي مطابق'
              : 'تحويل DOCX • سحابي هيكلي');
          updateTranscribeLabState({
            source: briefSnippet(transcribeSelectedFile.name, 26),
            engine: cloudEngineLabel,
            quality: 'سحابي',
            note: transcribeCloudHealthState?.docxMode === 'cloudconvert'
              ? 'تم اختيار مسار CloudConvert للمطابقة العالية لهذا الملف.'
              : (transcribeCloudHealthState?.fidelityReady
                ? 'تم اختيار المسار السحابي المرتبط بمحرك تحويل خارجي لهذا الملف.'
                : 'تم اختيار المسار السحابي الهيكلي لهذا الملف. قد يحتاج المستند النهائي إلى مراجعة إذا كان معقدًا.')
          });
          if (!transcribeLastStructured){
            $('transcribeStats').textContent = 'تحضير الملف للمسار السحابي...';
            transcribeLastStructured = await extractPdfStrategic(transcribeSelectedFile, {
              onProgress: (p, total, info) => { $('transcribeStats').textContent = `تحضير صفحة ${p}/${total} • ${info?.method || 'native'}`; }
            });
            transcribeFileMeta = buildTranscribeSourceMeta(transcribeSelectedFile, {
              file: transcribeSelectedFile,
              pages: transcribeLastStructured?.totalPages || 0
            });
            renderTranscribeOperationalState(transcribeFileMeta);
          }
          result = await convertPdfToDocxByWorkerPro(transcribeSelectedFile, {
            structured: transcribeLastStructured,
            meta: transcribeFileMeta
          });
        } else {
          $('transcribeStats').textContent = 'تحويل محلي قابل للتعديل...';
          result = await convertPdfToEditableDocx(transcribeSelectedFile, {
            onProgress: (p, total, info) => { $('transcribeStats').textContent = `تحويل صفحة ${p}/${total} • ${info?.method || 'native'}`; }
          });
          transcribeLastStructured = result?.structured || transcribeLastStructured;
          if ($('transcribeOutput') && result?.text) $('transcribeOutput').value = result.text;
          updateTranscribeLabState({
            source: briefSnippet(transcribeSelectedFile.name, 26),
            engine: `تحويل DOCX • محلي • ${getTranscribeProfileLabel()}`,
            quality: result?.structured?.quality || 'جيدة',
            note: 'اكتمل التحويل المحلي. الملف الناتج قابل للتعديل ويهدف إلى أفضل محاكاة عملية للتنسيق الأصلي، لكنه قد يحتاج مراجعة نهائية في المستندات المعقدة جدًا.'
          });
        }
        transcribeLastStructured = result?.structured || transcribeLastStructured;
        if ($('transcribeOutput') && result?.text) $('transcribeOutput').value = result.text;
        transcribeFileMeta = buildTranscribeSourceMeta(transcribeSelectedFile, {
          file: transcribeSelectedFile,
          pages: transcribeLastStructured?.totalPages || transcribeFileMeta.pages || 0,
          textLength: String($('transcribeOutput')?.value || '').length
        });
        renderTranscribeOperationalState(transcribeFileMeta);
        downloadBlob(result.fileName, result.blob);
        showStatus('', false);
        $('transcribeStats').textContent = 'اكتمل التحويل';
        updateTranscribeLiveStats();
        if (route === 'cloud'){
          const exactMode = ['upstream', 'cloudconvert'].includes(String(result?.cloudMode || ''));
          const exactEngineLabel = result?.cloudMode === 'cloudconvert'
            ? 'تحويل DOCX • CloudConvert مطابق'
            : (exactMode ? 'تحويل DOCX • سحابي مطابق' : 'تحويل DOCX • سحابي هيكلي');
          updateTranscribeLabState({
            source: briefSnippet(transcribeSelectedFile.name, 26),
            engine: exactEngineLabel,
            quality: exactMode ? 'مطابقة عالية' : 'مطابقة جيدة قابلة للتعديل',
            note: exactMode
              ? (result?.cloudMessage || 'اكتمل التحويل عبر المسار السحابي الخارجي.')
              : 'اكتمل التحويل عبر المسار السحابي الهيكلي. راجع النتيجة إذا كان المستند يحتوي على جداول أو هوامش معقدة.'
          });
        }
        toast('⬇️ تم تنزيل ملف Word قابل للتعديل');
      }catch(e){
        const friendly = getFriendlyDocxCloudError(e);
        updateTranscribeLabState({ engine:'فشل التحويل', quality:'توقف', note:friendly });
        showStatus(`❌ فشل التحويل:
${friendly}`, false);
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
        updateTranscribeLabState({
          engine: 'تحسين سحابي',
          quality: polished ? 'منقّح' : 'بدون تغيير',
          note: polished
            ? 'اكتمل تحسين النص سحابيًا مع تنظيف الأسطر وعلامات الترقيم والحفاظ على المعنى.'
            : 'لم يتم إرجاع نص محسّن من المزود الحالي.'
        });
        showStatus('', false);
        $('transcribeStats').textContent = polished ? `تم التحسين (${polished.length} حرف)` : 'لم يرجع النص من المزود';
        updateTranscribeLiveStats();
        toast(polished ? '☁️ تم التحسين السحابي' : '⚠️ لم يتم إرجاع نص');
      }catch(e){
        updateTranscribeLabState({ engine:'فشل التحسين', quality:'توقف', note:String(e?.message || e) });
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
    $('settingsHealthBtn')?.addEventListener('click', runStrategicHealthCheckPro);
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

    ensureStrategicChrome();
    renderSettings();

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
    syncKeyboardEditingState();
    applyShellLayout();
    initializeAuthExperience().catch(()=>{});
    refreshStrategicWorkspace().catch(()=>{});
  }

  init();
})();
