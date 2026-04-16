/* AI Workspace Studio v8.85 - strategic platform skeleton (no build step) */
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
    promptEngineeringMode: 'aistudio_prompt_engineering_mode_v1',
    studyMode: 'aistudio_study_mode_v1',
    transcribeProfile: 'aistudio_transcribe_profile_v1',
    transcribeDocxMode: 'aistudio_transcribe_docx_mode_v1',
    authState: 'aistudio_auth_state_v1',
    authConfigCache: 'aistudio_auth_config_v2',
    usageState: 'aistudio_usage_state_v1',
    authRemember: 'aistudio_auth_remember_v1',
    voiceMode: 'aistudio_voice_mode_v1',
    cloudMeta: 'aistudio_cloud_meta_v1',
    chatReadingMode: 'aistudio_chat_reading_mode_v1',
    uiZoom: 'aistudio_ui_zoom_v1',
    darkMode: 'aistudio_dark_mode_v1'
  };

  const nowTs = () => Date.now();
  const makeId = (p='id') => `${p}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
  const clamp = (n, min, max) => Math.min(max, Math.max(min, Number.isFinite(n) ? n : min));
  const ensureSelectHasValue = (el, value) => {
    if (!el) return;
    const str = String(value ?? '').trim();
    if (!str){
      el.value = '';
      return;
    }
    if (!Array.from(el.options || []).some((opt) => String(opt.value) === str)){
      const dynamic = document.createElement('option');
      dynamic.value = str;
      dynamic.textContent = `${str} (مخصص)`;
      dynamic.dataset.dynamic = '1';
      el.appendChild(dynamic);
    }
    el.value = str;
  };
  const toFiniteNumber = (value, fallback = null) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };

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


  function getSavedZoomLevel(){
    try{
      const raw = Number(localStorage.getItem(KEYS.uiZoom) || 1);
      return Number.isFinite(raw) ? Math.min(1.3, Math.max(0.85, raw)) : 1;
    }catch(_){ return 1; }
  }
  function setSavedZoomLevel(value){
    const next = Math.min(1.3, Math.max(0.85, Number(value || 1)));
    try{ localStorage.setItem(KEYS.uiZoom, String(next)); }catch(_){ }
    applyUiZoom(next);
    return next;
  }
  function applyUiZoom(level = getSavedZoomLevel()){
    const next = Math.min(1.3, Math.max(0.85, Number(level || 1)));
    document.documentElement.style.setProperty('--ui-scale', String(next));
    if ($('zoomLevelBadge')) $('zoomLevelBadge').textContent = `${Math.round(next * 100)}%`;
    if ($('zoomOutBtn')) $('zoomOutBtn').disabled = next <= 0.85 + 0.001;
    if ($('zoomInBtn')) $('zoomInBtn').disabled = next >= 1.3 - 0.001;
    scheduleShellLayoutRefresh();
  }
  function getDarkModeEnabled(){
    try{ return localStorage.getItem(KEYS.darkMode) === '1'; }catch(_){ return false; }
  }
  function setDarkModeEnabled(on){
    try{
      if (on) localStorage.setItem(KEYS.darkMode, '1');
      else localStorage.removeItem(KEYS.darkMode);
    }catch(_){ }
    applyDarkMode();
  }
  function applyDarkMode(){
    const on = getDarkModeEnabled();
    document.body.classList.toggle('dark', on);
    if ($('darkModeBtn')) {
      $('darkModeBtn').classList.toggle('dark', on);
      $('darkModeBtn').setAttribute('aria-pressed', on ? 'true' : 'false');
      const label = $('darkModeBtn').querySelector('.label');
      if (label) label.textContent = on ? 'داكن ✓' : 'داكن';
    }
  }
  let composerExpandedByFocus = false;
  function expandComposerOnFocus(){
    const input = $('chatInput');
    if (!input || input.tagName !== 'TEXTAREA') return;
    composerExpandedByFocus = true;
    input.setAttribute('rows', String(Math.max(3, Number(input.getAttribute('rows') || 1))));
    input.dataset.expanded = 'true';
    resizeComposerInput(input);
  }
  function shrinkComposerToCompact(force = false){
    const input = $('chatInput');
    if (!input || input.tagName !== 'TEXTAREA') return;
    const value = String(input.value || '');
    if (!force && value.trim()) return;
    composerExpandedByFocus = false;
    input.dataset.expanded = 'false';
    const mode = getComposerMode();
    input.setAttribute('rows', mode === 'multi' ? '2' : '1');
    resizeComposerInput(input);
  }
  async function confirmExitApp(){
    const modal = $('exitAppModal');
    if (!modal) return false;
    return await new Promise((resolve) => {
      const close = (answer) => {
        modal.classList.remove('show');
        modal.setAttribute('aria-hidden', 'true');
        resolve(answer);
      };
      const yes = $('exitAppYesBtn');
      const no = $('exitAppNoBtn');
      const backdrop = $('exitAppBackdrop');
      const onYes = () => close(true);
      const onNo = () => close(false);
      const cleanup = () => {
        yes?.removeEventListener('click', onYes);
        no?.removeEventListener('click', onNo);
        backdrop?.removeEventListener('click', onNo);
      };
      yes?.addEventListener('click', () => { cleanup(); onYes(); }, { once:true });
      no?.addEventListener('click', () => { cleanup(); onNo(); }, { once:true });
      backdrop?.addEventListener('click', () => { cleanup(); onNo(); }, { once:true });
      modal.classList.add('show');
      modal.setAttribute('aria-hidden', 'false');
    });
  }
  async function requestExitApp(){
    const ok = await confirmExitApp();
    if (!ok) return;
    if (isNativePlatform()){
      try{ await getCapacitorAppPlugin()?.exitApp?.(); return; }catch(_){ }
    }
    toast('ℹ️ لا يمكن إغلاق التطبيق تلقائيًا من المتصفح. يمكنك إغلاق التبويب يدويًا.');
  }

  function shouldCloudTrackStorageKey(key){
    const normalized = String(key || '').trim();
    return normalized.startsWith('aistudio_') && !UNSYNCED_STORAGE_KEYS.has(normalized);
  }

  (function installStorageHooks(){
    if (window.__AI_STUDIO_STORAGE_HOOKS__) return;
    const storageProto = Object.getPrototypeOf(window.localStorage);
    const rawSetItem = storageProto.setItem;
    const rawRemoveItem = storageProto.removeItem;
    const rawClear = storageProto.clear;

    storageProto.setItem = function patchedSetItem(key, value){
      rawSetItem.call(this, key, value);
      if (!CLOUD_RUNTIME.muted && shouldCloudTrackStorageKey(key)) scheduleCloudSync(`set:${key}`);
    };
    storageProto.removeItem = function patchedRemoveItem(key){
      rawRemoveItem.call(this, key);
      if (!CLOUD_RUNTIME.muted && shouldCloudTrackStorageKey(key)) scheduleCloudSync(`remove:${key}`);
    };
    storageProto.clear = function patchedClear(){
      rawClear.call(this);
      if (!CLOUD_RUNTIME.muted) scheduleCloudSync('clear');
    };
    window.__AI_STUDIO_STORAGE_HOOKS__ = true;
  })();

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
    gatewayUrl: 'https://api.saddamalkadi.com',
    gatewayToken: '',             // optional extra protection
    cloudConvertEndpoint: 'https://api.saddamalkadi.com/convert/pdf-to-docx',
    cloudConvertFallbackEndpoint: '',
    cloudRetryMax: 2,
    ocrCloudEndpoint: 'https://api.saddamalkadi.com/ocr',
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
    authRequired: false,
    brandName: 'AI Workspace Studio',
    developerName: 'صدام القاضي',
    upgradeEmail: 'tntntt830@gmail.com',
    adminEmail: 'tntntt830@gmail.com',
    adminEnabled: false,
    adminPasswordEnabled: false,
    adminLoginMethod: 'google_only',
    googleClientId: '',
    clientIdConfigured: false,
    premiumEnabled: true,
    voiceCloudReady: false,
    voiceSttReady: false,
    voiceTtsReady: false,
    voiceProvider: '',
    voiceRecognitionModel: 'gpt-4o-mini-transcribe',
    voiceSynthesisModel: 'gpt-4o-mini-tts',
    voiceSynthesisVoice: 'alloy',
    voicePreferredLanguage: 'ar-SA',
    voicePremiumOnly: false
  };

  const DEFAULT_USAGE_STATE = {
    email: '',
    provider: '',
    supported: false,
    available: false,
    totalCredits: null,
    totalUsage: null,
    remainingCredits: null,
    lastRequestCost: null,
    lastPromptTokens: null,
    lastCompletionTokens: null,
    lastTotalTokens: null,
    lastModel: '',
    lastGenerationId: '',
    lastUpdatedAt: 0,
    lastCheckedAt: 0,
    lastError: '',
    source: ''
  };

  const AUTH_RUNTIME = {
    config: null,
    configLoadedAt: 0,
    configPromise: null,
    authHealth: null,
    booting: false
  };

  const USAGE_RUNTIME = {
    creditsPromise: null
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

  const CAPACITOR_PLUGIN_CACHE = Object.create(null);

  const CLOUD_RUNTIME = {
    bootPromise: null,
    syncTimer: 0,
    syncPromise: null,
    muted: false,
    hydratedFor: '',
    lastHash: '',
    lastRemoteUpdatedAt: 0
  };

  const VOICE_RUNTIME = {
    speaking: false,
    utterance: null,
    autoSendArmed: false,
    nativeListening: false,
    nativeStarting: false,
    nativeSpeechListener: null,
    continuousConversation: false,
    restartTimer: 0,
    cloudRecorder: null,
    cloudStream: null,
    audioPlayer: null,
    cloudCancelRequested: false,
    cloudSilenceCleanup: null,
    ttsInstallPrompted: false,
    dictationState: 'ready',
    /* Last Capacitor native TTS locale that succeeded isLanguageSupported — avoids N bridge calls per utterance */
    nativeTtsLangCached: ''
  };

  /** Cloud STT segment end: silence hold + max length; post-STT auto-send is separate (see below). */
  const VOICE_CLOUD_MAX_RECORD_MS_VOICE = 16800;
  const VOICE_CLOUD_MAX_RECORD_MS_SINGLE = 14800;
  const VOICE_CLOUD_SILENCE_HOLD_MS = 1500;
  const VOICE_CLOUD_SILENCE_RMS = 0.011;
  const VOICE_CLOUD_SILENCE_TICK_MS = 90;
  const VOICE_CLOUD_MIN_LOUD_MS = 320;
  const VOICE_AUTOSEND_AFTER_TRANSCRIPT_MS = 480;
  const VOICE_WEBSPEECH_END_GRACE_MS = 1200;

  const BROWSER_AUTH_BRIDGE = {
    webPath: 'auth-bridge.html',
    appReturnUrl: 'aiworkspace://auth',
    storageKey: 'aistudio_auth_bridge_result_v1',
    publicBaseUrl: 'https://app.saddamalkadi.com/'
  };
  const WEB_RELEASE_LABEL = 'v8.85';
  const DEFAULT_POST_LOGIN_PAGE = 'home';

  const UNSYNCED_STORAGE_KEYS = new Set([
    KEYS.authState,
    KEYS.authConfigCache,
    KEYS.usageState,
    KEYS.modelCache,
    KEYS.authRemember,
    KEYS.chatReadingMode
  ]);

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
  if ($('embedModelPreset')){
    ensureSelectHasValue($('embedModelPreset'), kb.embedModel || 'openai/text-embedding-3-small');
    const custom = $('embedModelCustom');
    if (custom){
      custom.value = kb.embedModel || '';
      custom.style.display = $('embedModelPreset').value === 'custom' ? '' : 'none';
      custom.setAttribute('aria-hidden', custom.style.display === 'none' ? 'true' : 'false');
    }
  } else if ($('embedModel')){
    $('embedModel').value = kb.embedModel || '';
  }
  if ($('kbTopK')) ensureSelectHasValue($('kbTopK'), String(kb.topK || 6));
  if ($('kbChunkSize')) ensureSelectHasValue($('kbChunkSize'), String(kb.chunkSize || 900));
  if ($('kbOverlap')) ensureSelectHasValue($('kbOverlap'), String(kb.overlap || 120));
  if ($('kbRagHint')) $('kbRagHint').value = kb.ragHint || DEFAULT_KB.ragHint;
  await ensureKbStats();
}

function getKbEmbedModelFromUi(){
  if ($('embedModelPreset')){
    const preset = String($('embedModelPreset').value || '').trim();
    if (preset === 'custom'){
      return String($('embedModelCustom')?.value || '').trim();
    }
    return preset;
  }
  return String($('embedModel')?.value || '').trim();
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
  function normalizeDocxCloudEndpoint(raw){
    const normalized = normalizeEndpointUrl(raw || '');
    if (!normalized) return '';
    try{
      const parsed = new URL(normalized);
      const host = String(parsed.hostname || '').toLowerCase();
      const path = String(parsed.pathname || '').replace(/\/+$/,'');
      const defaultOrigin = endpointOrigin(DEFAULT_SETTINGS.cloudConvertEndpoint || '');
      const targetOrigin = (/dash\.cloudflare\.com$/.test(host)
        || /(^|\.)convert\.saddamalkadi\.com$/i.test(host)
        || /^sadam-convert\./i.test(host)
        || path.includes('/workers/services/view/sadam-convert/'))
        ? defaultOrigin
        : parsed.origin;
      if (!targetOrigin) return normalized.replace(/\/+$/,'');
      if (/\/convert\/pdf-to-docx$/i.test(path)) return `${targetOrigin}/convert/pdf-to-docx`;
      if (/\/pdf-to-docx$/i.test(path)) return `${targetOrigin}/convert/pdf-to-docx`;
      if (/\/api\/convert\/pdf-to-docx$/i.test(path)) return `${targetOrigin}/convert/pdf-to-docx`;
      if (/\/ocr(?:\/image)?$/i.test(path) || /\/api\/ocr$/i.test(path)) return `${targetOrigin}/convert/pdf-to-docx`;
      if (!path || path === '/' || /^\/(?:health|v1)$/i.test(path)) return `${targetOrigin}/convert/pdf-to-docx`;
      return normalized.replace(/\/+$/,'');
    }catch(_){
      return normalized.replace(/\/+$/,'');
    }
  }

  function normalizeOcrCloudEndpoint(raw){
    const normalized = normalizeEndpointUrl(raw || '');
    if (!normalized) return '';
    try{
      const parsed = new URL(normalized);
      const host = String(parsed.hostname || '').toLowerCase();
      const path = String(parsed.pathname || '').replace(/\/+$/,'');
      const defaultOrigin = endpointOrigin(DEFAULT_SETTINGS.ocrCloudEndpoint || '');
      const targetOrigin = (/dash\.cloudflare\.com$/.test(host)
        || /(^|\.)convert\.saddamalkadi\.com$/i.test(host)
        || /^sadam-convert\./i.test(host)
        || path.includes('/workers/services/view/sadam-convert/'))
        ? defaultOrigin
        : parsed.origin;
      if (!targetOrigin) return normalized.replace(/\/+$/,'');
      if (/\/ocr$/i.test(path)) return `${targetOrigin}/ocr`;
      if (/\/ocr\/image$/i.test(path)) return `${targetOrigin}/ocr`;
      if (/\/api\/ocr$/i.test(path)) return `${targetOrigin}/ocr`;
      if (/\/convert\/pdf-to-docx$/i.test(path) || /\/pdf-to-docx$/i.test(path) || /\/api\/convert\/pdf-to-docx$/i.test(path)) return `${targetOrigin}/ocr`;
      if (!path || path === '/' || /^\/(?:health|v1)$/i.test(path)) return `${targetOrigin}/ocr`;
      return normalized.replace(/\/+$/,'');
    }catch(_){
      return normalized.replace(/\/+$/,'');
    }
  }

  function buildDocxCloudEndpoints(settings = getSettings()){
    return [...new Set([
      normalizeDocxCloudEndpoint(settings.cloudConvertEndpoint || ''),
      normalizeDocxCloudEndpoint(settings.cloudConvertFallbackEndpoint || '')
    ].filter(Boolean))];
  }

  function buildOcrCloudEndpoints(settings = getSettings()){
    return [...new Set([
      normalizeOcrCloudEndpoint(settings.ocrCloudEndpoint || '')
    ].filter(Boolean))];
  }

  function normalizeStoredSettings(raw = {}){
    const next = { ...(raw || {}) };
    if ('gatewayUrl' in next || DEFAULT_SETTINGS.gatewayUrl){
      next.gatewayUrl = normalizeManagedGatewayUrl(next.gatewayUrl || DEFAULT_SETTINGS.gatewayUrl);
    }
    if ('cloudConvertEndpoint' in next || DEFAULT_SETTINGS.cloudConvertEndpoint){
      next.cloudConvertEndpoint = normalizeDocxCloudEndpoint(next.cloudConvertEndpoint || DEFAULT_SETTINGS.cloudConvertEndpoint);
    }
    if ('cloudConvertFallbackEndpoint' in next){
      next.cloudConvertFallbackEndpoint = normalizeDocxCloudEndpoint(next.cloudConvertFallbackEndpoint || '');
    }
    if ('ocrCloudEndpoint' in next || DEFAULT_SETTINGS.ocrCloudEndpoint){
      next.ocrCloudEndpoint = normalizeOcrCloudEndpoint(next.ocrCloudEndpoint || DEFAULT_SETTINGS.ocrCloudEndpoint);
    }
    if ((next.authMode || DEFAULT_SETTINGS.authMode) === 'gateway'){
      const resolvedGatewayBase = normalizeUrl(resolveGatewayApiRoot({ ...DEFAULT_SETTINGS, ...next })) || getPlatformServiceRoot();
      if (resolvedGatewayBase){
        next.baseUrl = `${resolvedGatewayBase}/v1`;
      }
    }
    return next;
  }

  function getSettings(){
    const stored = loadJSON(KEYS.settings, {}) || {};
    const normalized = normalizeStoredSettings(stored);
    try{
      if (JSON.stringify(stored) !== JSON.stringify(normalized)){
        saveJSON(KEYS.settings, normalized);
      }
    }catch(_){ }
    return { ...DEFAULT_SETTINGS, ...normalized };
  }
  function setSettings(patch){
    const s = normalizeStoredSettings({ ...getSettings(), ...(patch||{}) });
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

  function getRememberedAuthEntry(){
    const saved = loadJSON(KEYS.authRemember, {}) || {};
    return {
      remember: !!saved.remember,
      name: String(saved.name || '').trim(),
      email: String(saved.email || '').trim(),
      password: String(saved.password || '').trim()
    };
  }

  function saveRememberedAuthEntry(patch = {}){
    const next = { ...getRememberedAuthEntry(), ...(patch || {}) };
    saveJSON(KEYS.authRemember, next);
    return next;
  }

  function clearRememberedAuthEntry(){
    saveJSON(KEYS.authRemember, { remember:false, name:'', email:'', password:'' });
  }

  const getVoiceModeEnabled = () => (localStorage.getItem(KEYS.voiceMode) || 'false') === 'true';
  const setVoiceModeEnabled = (value) => localStorage.setItem(KEYS.voiceMode, value ? 'true' : 'false');

  function normalizeUsageState(raw = {}){
    const next = { ...DEFAULT_USAGE_STATE, ...(raw || {}) };
    next.email = String(next.email || '').trim().toLowerCase();
    next.provider = String(next.provider || '').trim();
    next.supported = !!next.supported;
    next.available = !!next.available;
    next.totalCredits = toFiniteNumber(next.totalCredits);
    next.totalUsage = toFiniteNumber(next.totalUsage);
    next.remainingCredits = toFiniteNumber(next.remainingCredits);
    if (next.remainingCredits == null && next.totalCredits != null && next.totalUsage != null){
      next.remainingCredits = Math.max(0, next.totalCredits - next.totalUsage);
    }
    next.lastRequestCost = toFiniteNumber(next.lastRequestCost);
    next.lastPromptTokens = toFiniteNumber(next.lastPromptTokens);
    next.lastCompletionTokens = toFiniteNumber(next.lastCompletionTokens);
    next.lastTotalTokens = toFiniteNumber(next.lastTotalTokens);
    next.lastModel = String(next.lastModel || '').trim();
    next.lastGenerationId = String(next.lastGenerationId || '').trim();
    next.lastUpdatedAt = Math.max(0, Number(next.lastUpdatedAt || 0));
    next.lastCheckedAt = Math.max(0, Number(next.lastCheckedAt || 0));
    next.lastError = String(next.lastError || '').trim();
    next.source = String(next.source || '').trim();
    return next;
  }

  function getUsageState(){
    const currentAuth = getAuthState();
    const expectedEmail = String(currentAuth.email || '').trim().toLowerCase();
    const stored = normalizeUsageState(loadJSON(KEYS.usageState, {}) || {});
    if (expectedEmail && stored.email && stored.email !== expectedEmail){
      return clearUsageState({ email: expectedEmail });
    }
    if (expectedEmail && stored.email !== expectedEmail){
      const next = normalizeUsageState({ ...stored, email: expectedEmail });
      saveJSON(KEYS.usageState, next);
      return next;
    }
    return stored;
  }

  function saveUsageState(patch){
    const currentAuth = getAuthState();
    const next = normalizeUsageState({
      ...getUsageState(),
      ...(patch || {}),
      email: String((patch || {}).email || currentAuth.email || '').trim().toLowerCase()
    });
    saveJSON(KEYS.usageState, next);
    return next;
  }

  function clearUsageState(patch = {}){
    const currentAuth = getAuthState();
    const next = normalizeUsageState({
      ...DEFAULT_USAGE_STATE,
      email: String(patch.email || currentAuth.email || '').trim().toLowerCase(),
      ...(patch || {})
    });
    saveJSON(KEYS.usageState, next);
    return next;
  }

  function getAccountPlanLabel(plan = getAuthState().plan){
    return plan === 'premium' ? 'الخطة المدفوعة' : 'الخطة المجانية';
  }

  function getGatewayWorkerRoot(settings = getSettings()){
    if (isManagedHostedRuntime()) return getPlatformServiceRoot();
    return normalizeManagedGatewayUrl(settings.gatewayUrl || '').replace(/\/v1\/?$/i, '');
  }

  function getPlatformServiceRoot(){
    return normalizeEndpointUrl(DEFAULT_SETTINGS.gatewayUrl || '').replace(/\/v1\/?$/i, '');
  }

  function isManagedHostedRuntime(){
    try{
      const host = String(window.location.hostname || '').toLowerCase();
      return (
        host === 'app.saddamalkadi.com'
        || host === 'saddamalkadi.com'
        || host.endsWith('.saddamalkadi.com')
        || /(^|\.)saddamalkadi\.github\.io$/i.test(host)
      );
    }catch(_){
      return false;
    }
  }

  /** Remove legacy overflow UI (#topbarScroll clone menu): use native horizontal scroll only. */
  function unwrapLegacyTopbarScroll(){
    const topActions = document.querySelector('.topbar .topbar-actions');
    if (!topActions) return;
    const scroll = $('topbarScroll');
    const moreBtn = $('topbarOverflowMenuBtn');
    const panel = $('topbarOverflowPanel');
    if (moreBtn) moreBtn.remove();
    if (panel){
      try{ panel.remove(); }catch(_){ }
    }
    if (scroll && scroll.parentNode === topActions){
      while (scroll.firstChild){
        topActions.insertBefore(scroll.firstChild, scroll);
      }
      scroll.remove();
    }
  }

  function alignManagedRuntimeSettings(){
    if (!(isManagedHostedRuntime() || (typeof isNativePlatform === 'function' && isNativePlatform()))) return getSettings();
    const current = getSettings();
    const nextGateway = getPlatformServiceRoot();
    if (!nextGateway) return current;
    const nextBase = `${nextGateway}/v1`;
    const nextDocx = normalizeDocxCloudEndpoint(DEFAULT_SETTINGS.cloudConvertEndpoint);
    const nextOcr = normalizeOcrCloudEndpoint(DEFAULT_SETTINGS.ocrCloudEndpoint);
    const needsUpdate = (
      current.authMode !== 'gateway'
      || normalizeEndpointUrl(current.gatewayUrl || '') !== nextGateway
      || normalizeUrl(current.baseUrl || '') !== nextBase
      || normalizeDocxCloudEndpoint(current.cloudConvertEndpoint || '') !== nextDocx
      || normalizeOcrCloudEndpoint(current.ocrCloudEndpoint || '') !== nextOcr
    );
    if (!needsUpdate) return current;
    const next = setSettings({
      authMode: 'gateway',
      gatewayUrl: nextGateway,
      baseUrl: nextBase,
      cloudConvertEndpoint: nextDocx,
      ocrCloudEndpoint: nextOcr
    });
    AUTH_RUNTIME.config = null;
    AUTH_RUNTIME.configPromise = null;
    AUTH_RUNTIME.configLoadedAt = 0;
    return next;
  }

  function getLocalAuthConfig(settings = getSettings()){
    return {
      ...DEFAULT_AUTH_CONFIG,
      googleClientId: '',
      upgradeEmail: String(settings.upgradeEmail || DEFAULT_AUTH_CONFIG.upgradeEmail).trim() || DEFAULT_AUTH_CONFIG.upgradeEmail,
      adminEmail: DEFAULT_AUTH_CONFIG.adminEmail,
      adminEnabled: DEFAULT_AUTH_CONFIG.adminEnabled,
      adminPasswordEnabled: DEFAULT_AUTH_CONFIG.adminPasswordEnabled,
      adminLoginMethod: DEFAULT_AUTH_CONFIG.adminLoginMethod,
      clientIdConfigured: false,
      voiceCloudReady: false,
      voiceSttReady: false,
      voiceTtsReady: false,
      voiceProvider: '',
      voiceRecognitionModel: DEFAULT_AUTH_CONFIG.voiceRecognitionModel,
      voiceSynthesisModel: DEFAULT_AUTH_CONFIG.voiceSynthesisModel,
      voiceSynthesisVoice: DEFAULT_AUTH_CONFIG.voiceSynthesisVoice,
      voicePreferredLanguage: DEFAULT_AUTH_CONFIG.voicePreferredLanguage,
      voicePremiumOnly: DEFAULT_AUTH_CONFIG.voicePremiumOnly
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

  /**
   * When /auth/config fails (network, 401 token, transient worker), do not persist a "blank"
   * auth profile: that overwrote previously-good localStorage and hid admin password + Google IDs.
   */
  function authConfigAfterFetchFailure(settings = getSettings()){
    const local = getLocalAuthConfig(settings);
    let prev = null;
    try{ prev = loadJSON(KEYS.authConfigCache, null); }catch(_){ prev = null; }
    if (!prev || typeof prev !== 'object') return local;
    const merged = { ...local, ...prev };
    if (prev.adminPasswordEnabled === true) merged.adminPasswordEnabled = true;
    if (prev.adminEnabled === true) merged.adminEnabled = true;
    if (String(prev.adminLoginMethod || '').trim()) merged.adminLoginMethod = String(prev.adminLoginMethod).trim();
    else if (prev.adminEnabled === true) merged.adminLoginMethod = 'password_or_google';
    if (String(prev.googleClientId || '').trim()){
      merged.googleClientId = String(prev.googleClientId).trim();
      merged.clientIdConfigured = true;
    }
    if (String(prev.adminEmail || '').trim()) merged.adminEmail = String(prev.adminEmail).trim();
    return merged;
  }

  function authConfigSupportsAdminPassword(config){
    const adminPasswordEnabled = config?.adminPasswordEnabled === true;
    const adminLoginMethod = String(config?.adminLoginMethod || '').trim().toLowerCase();
    return (
      adminPasswordEnabled
      || adminLoginMethod === 'password_or_google'
      || adminLoginMethod === 'password_only'
    );
  }

  function preserveAdminPasswordCapability(nextConfig, previousConfig, healthPayload = null){
    const next = { ...(nextConfig || {}) };
    const prev = previousConfig && typeof previousConfig === 'object' ? previousConfig : null;
    if (healthPayload && healthPayload.admin_password_ready === true){
      next.adminPasswordEnabled = true;
      next.adminEnabled = true;
      if (!String(next.adminLoginMethod || '').trim() || String(next.adminLoginMethod || '').trim().toLowerCase() === 'google_only'){
        next.adminLoginMethod = 'password_or_google';
      }
      return next;
    }
    if (!prev) return next;
    if (authConfigSupportsAdminPassword(next)) return next;
    if (!authConfigSupportsAdminPassword(prev)) return next;

    // If health confirms password readiness, treat google_only from config as stale and keep last known-good capability.
    // During transient mismatch/failure, never collapse a previously password-capable admin state.
    next.adminPasswordEnabled = true;
    next.adminEnabled = true;
    next.adminLoginMethod = String(prev.adminLoginMethod || 'password_or_google').trim() || 'password_or_google';
    if (!String(next.adminEmail || '').trim() && String(prev.adminEmail || '').trim()){
      next.adminEmail = String(prev.adminEmail).trim();
    }
    return next;
  }

  function getEffectiveAuthConfig(settings = getSettings()){
    return { ...getLocalAuthConfig(settings), ...getAuthConfigCached() };
  }

  function getVoiceCloudConfig(settings = getSettings()){
    const config = getEffectiveAuthConfig(settings);
    const account = getAccountRuntimeState(settings);
    const root = getAuthServiceRoot(settings);
    const premiumOnly = config.voicePremiumOnly !== false;
    const eligible = !premiumOnly || account.premium || account.admin;
    return {
      root,
      ready: !!root && !!config.voiceCloudReady && eligible,
      sttReady: !!root && !!config.voiceSttReady && eligible,
      ttsReady: !!root && !!config.voiceTtsReady && eligible,
      provider: String(config.voiceProvider || '').trim(),
      recognitionModel: String(config.voiceRecognitionModel || DEFAULT_AUTH_CONFIG.voiceRecognitionModel).trim(),
      synthesisModel: String(config.voiceSynthesisModel || DEFAULT_AUTH_CONFIG.voiceSynthesisModel).trim(),
      synthesisVoice: String(config.voiceSynthesisVoice || DEFAULT_AUTH_CONFIG.voiceSynthesisVoice).trim(),
      preferredLanguage: String(config.voicePreferredLanguage || DEFAULT_AUTH_CONFIG.voicePreferredLanguage).trim() || 'ar-SA',
      premiumOnly,
      eligible
    };
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

  function normalizeManagedGatewayUrl(raw){
    const normalized = normalizeEndpointUrl(raw || '');
    const fallback = getPlatformServiceRoot();
    if (!normalized) return fallback;
    try{
      const parsed = new URL(normalized);
      const host = String(parsed.hostname || '').toLowerCase();
      const path = String(parsed.pathname || '').toLowerCase();
      const looksManaged = (
        host === 'api.saddamalkadi.com'
        || host === 'app.saddamalkadi.com'
        || host === 'saddamalkadi.com'
        || host.endsWith('.saddamalkadi.com')
        || host === 'convert.saddamalkadi.com'
        || /(^|\.)saddamalkadi\.github\.io$/i.test(host)
        || /(^|\.)ai-workspace-studio\.pages\.dev$/i.test(host)
        || /(^|\.)workers\.dev$/i.test(host)
        || /dash\.cloudflare\.com$/i.test(host)
        || /^sadam-key\./i.test(host)
        || /^sadam-convert\./i.test(host)
      );
      if (looksManaged || path.includes('/workers/services/view/') || path.includes('/production/settings')){
        return fallback;
      }
      return normalized.replace(/\/v1\/?$/i, '').replace(/\/health\/?$/i, '');
    }catch(_){
      return fallback;
    }
  }

  function endpointOrigin(u){
    try{
      const n = normalizeEndpointUrl(u);
      if (!n) return '';
      return new URL(n).origin;
    }catch(_){ return ''; }
  }

  function resolveGatewayApiRoot(settings){
    if (isManagedHostedRuntime()) return getPlatformServiceRoot();
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
    if (settings.authMode === 'gateway'){
      const gatewayRoot = getGatewayWorkerRoot(settings) || normalizeUrl(resolveGatewayApiRoot(settings));
      if (gatewayRoot) return `${normalizeUrl(gatewayRoot)}/v1`;
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
    return getGatewayWorkerRoot(settings) || getPlatformServiceRoot();
  }

  function getAccountRuntimeState(settings = getSettings()){
    const auth = getAuthState();
    const config = getEffectiveAuthConfig(settings);
    const authRequired = config.authRequired === true;
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

  async function fetchAuthResponse(path, init = {}, settings = getSettings()){
    const run = async (activeSettings) => {
      const root = getAuthServiceRoot(activeSettings);
      if (!root) throw new Error('رابط البوابة غير مضبوط لطبقة الخدمات السحابية.');
      const auth = getAuthState();
      const headers = new Headers(init.headers || {});
      if (activeSettings.gatewayToken) headers.set('X-Client-Token', activeSettings.gatewayToken);
      if (auth.sessionToken) headers.set('X-App-Session', auth.sessionToken);
      const response = await fetch(`${root}${path}`, { ...init, headers });
      if (!response.ok){
        const raw = await response.text().catch(() => '');
        let payload = null;
        try{ payload = raw ? JSON.parse(raw) : null; }catch(_){ payload = null; }
        throw new Error(payload?.error || payload?.message || raw || `HTTP ${response.status}`);
      }
      return response;
    };

    try{
      return await run(settings);
    }catch(err){
      const repaired = repairGatewayAfterAccessIssue(err, settings);
      if (repaired){
        return run(repaired);
      }
      throw err;
    }
  }

  async function fetchAuthJson(path, init = {}, settings = getSettings()){
    const run = async (activeSettings) => {
      const root = getAuthServiceRoot(activeSettings);
      if (!root) throw new Error('رابط البوابة غير مضبوط لطبقة الحسابات.');
      const auth = getAuthState();
      const headers = new Headers(init.headers || {});
      headers.set('Content-Type', headers.get('Content-Type') || 'application/json');
      if (activeSettings.gatewayToken) headers.set('X-Client-Token', activeSettings.gatewayToken);
      if (auth.sessionToken) headers.set('X-App-Session', auth.sessionToken);
      const response = await fetch(`${root}${path}`, { ...init, headers });
      const raw = await response.text();
      let payload = null;
      try{ payload = raw ? JSON.parse(raw) : null; }catch(_){ payload = null; }
      if (!response.ok){
        throw new Error(payload?.error || payload?.message || raw || `HTTP ${response.status}`);
      }
      return payload || {};
    };

    try{
      return await run(settings);
    }catch(err){
      const repaired = repairGatewayAfterAccessIssue(err, settings);
      if (repaired){
        return run(repaired);
      }
      throw err;
    }
  }

  async function fetchAuthHealthSnapshot(root){
    if (!root) return null;
    try{
      const response = await fetch(`${root}/health`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, max-age=0',
          Pragma: 'no-cache'
        }
      });
      const raw = await response.text();
      const parsed = raw ? JSON.parse(raw) : null;
      AUTH_RUNTIME.authHealth = parsed && typeof parsed === 'object' ? parsed : null;
      return AUTH_RUNTIME.authHealth;
    }catch(_){
      AUTH_RUNTIME.authHealth = null;
      return null;
    }
  }

  async function loadRemoteAuthConfig(force = false){
    if (!force && AUTH_RUNTIME.config && (Date.now() - AUTH_RUNTIME.configLoadedAt) < 5 * 60 * 1000){
      return AUTH_RUNTIME.config;
    }
    if (!force && AUTH_RUNTIME.configPromise) return AUTH_RUNTIME.configPromise;
    const settings = getSettings();
    const requestRemoteConfig = async (activeSettings) => {
      const root = getAuthServiceRoot(activeSettings);
      if (!root){
        return setAuthConfigCached(authConfigAfterFetchFailure(activeSettings));
      }
      let previous = null;
      try{ previous = loadJSON(KEYS.authConfigCache, null); }catch(_){ previous = null; }
      const response = await fetch(`${root}/auth/config`, {
        cache: 'no-store',
        headers: {
          ...(activeSettings.gatewayToken ? { 'X-Client-Token': activeSettings.gatewayToken } : {}),
          'Cache-Control': 'no-cache, no-store, max-age=0',
          Pragma: 'no-cache'
        }
      });
      const raw = await response.text();
      let payload = null;
      try{ payload = raw ? JSON.parse(raw) : null; }catch(_){ payload = null; }
      if (!response.ok){
        throw new Error(payload?.error || raw || `HTTP ${response.status}`);
      }
      const healthPayload = await fetchAuthHealthSnapshot(root);
      const local = getLocalAuthConfig(activeSettings);
      const remote = payload || {};
      const normalized = {
        ...remote,
        googleClientId: String(remote.googleClientId || '').trim(),
        upgradeEmail: String(remote.upgradeEmail || local.upgradeEmail || DEFAULT_AUTH_CONFIG.upgradeEmail).trim(),
        adminEmail: String(remote.adminEmail || local.adminEmail || DEFAULT_AUTH_CONFIG.adminEmail).trim(),
        adminEnabled: !!remote.adminEnabled,
        adminPasswordEnabled: typeof remote.adminPasswordEnabled === 'boolean'
          ? remote.adminPasswordEnabled
          : !!(remote.adminPasswordEnabled ?? remote.adminEnabled),
        adminLoginMethod: String(remote.adminLoginMethod || (remote.adminEnabled ? 'password_or_google' : 'google_only')).trim(),
        clientIdConfigured: !!String(remote.googleClientId || '').trim(),
        voiceCloudReady: !!remote.voiceCloudReady,
        voiceSttReady: !!remote.voiceSttReady,
        voiceTtsReady: !!remote.voiceTtsReady,
        voiceProvider: String(remote.voiceProvider || '').trim(),
        voiceRecognitionModel: String(remote.voiceRecognitionModel || local.voiceRecognitionModel || DEFAULT_AUTH_CONFIG.voiceRecognitionModel).trim(),
        voiceSynthesisModel: String(remote.voiceSynthesisModel || local.voiceSynthesisModel || DEFAULT_AUTH_CONFIG.voiceSynthesisModel).trim(),
        voiceSynthesisVoice: String(remote.voiceSynthesisVoice || local.voiceSynthesisVoice || DEFAULT_AUTH_CONFIG.voiceSynthesisVoice).trim(),
        voicePreferredLanguage: String(remote.voicePreferredLanguage || local.voicePreferredLanguage || DEFAULT_AUTH_CONFIG.voicePreferredLanguage).trim(),
        voicePremiumOnly: remote.voicePremiumOnly !== false
      };
      const stabilized = preserveAdminPasswordCapability(normalized, previous, healthPayload);
      return setAuthConfigCached(stabilized);
    };

    AUTH_RUNTIME.configPromise = requestRemoteConfig(settings).catch(async (err) => {
      const repaired = repairGatewayAfterAccessIssue(err, settings);
      if (repaired){
        return requestRemoteConfig(repaired).catch(async () => {
          const fallback = authConfigAfterFetchFailure(repaired);
          const healthPayload = await fetchAuthHealthSnapshot(getAuthServiceRoot(repaired));
          return setAuthConfigCached(preserveAdminPasswordCapability(fallback, fallback, healthPayload));
        });
      }
      const fallback = authConfigAfterFetchFailure(settings);
      const healthPayload = await fetchAuthHealthSnapshot(getAuthServiceRoot(settings));
      return setAuthConfigCached(preserveAdminPasswordCapability(fallback, fallback, healthPayload));
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

  function getCloudMeta(){
    return {
      email: '',
      updatedAt: 0,
      hydratedAt: 0,
      ...(loadJSON(KEYS.cloudMeta, {}) || {})
    };
  }

  function saveCloudMeta(patch = {}){
    const next = { ...getCloudMeta(), ...(patch || {}) };
    saveJSON(KEYS.cloudMeta, next);
    return next;
  }

  function getCloudStorageRoot(settings = getSettings()){
    return getAuthServiceRoot(settings);
  }

  function getSyncedSettingsSnapshot(){
    const settings = getSettings();
    return {
      provider: settings.provider,
      baseUrl: settings.baseUrl,
      model: settings.model,
      systemPrompt: settings.systemPrompt,
      maxOut: settings.maxOut,
      webMode: settings.webMode,
      fileClip: settings.fileClip,
      streaming: settings.streaming,
      rag: settings.rag,
      toolsEnabled: settings.toolsEnabled,
      authMode: settings.authMode,
      gatewayUrl: settings.gatewayUrl,
      cloudConvertEndpoint: settings.cloudConvertEndpoint,
      cloudConvertFallbackEndpoint: settings.cloudConvertFallbackEndpoint,
      ocrCloudEndpoint: settings.ocrCloudEndpoint,
      ocrLang: settings.ocrLang,
      freeMode: settings.freeMode,
      costGuard: settings.costGuard,
      maxCloudPdfPages: settings.maxCloudPdfPages,
      maxCloudFileMB: settings.maxCloudFileMB,
      allowCloudOcr: settings.allowCloudOcr,
      allowCloudPolish: settings.allowCloudPolish,
      upgradeEmail: settings.upgradeEmail,
      orReferer: settings.orReferer,
      orTitle: settings.orTitle
    };
  }

  function sanitizeFilesForCloud(files = []){
    return (Array.isArray(files) ? files : []).map((file) => {
      const dataUrl = String(file?.dataUrl || '');
      return {
        ...file,
        dataUrl: dataUrl.length <= 2_000_000 ? dataUrl : '',
        cloudTrimmed: dataUrl.length > 2_000_000
      };
    });
  }

  function buildCloudSnapshot(){
    const projects = loadJSON(KEYS.projects, null) || loadProjects();
    const list = Array.isArray(projects) && projects.length ? projects : loadProjects();
    const projectIds = list.map((project) => String(project?.id || '').trim()).filter(Boolean);
    const snapshot = {
      schema: 1,
      updatedAt: Date.now(),
      settings: getSyncedSettingsSnapshot(),
      projects: list,
      currentProjectId: getCurProjectId(),
      downloads: loadDownloads(),
      favorites: loadFavs(),
      ui: {
        modeDeep: isDeep(),
        modeAgent: isAgent(),
        deepSearch: isDeepSearch(),
        webToggle: getWebToggle(),
        headerCollapsed: getHeaderCollapsed(),
        chatToolbarCollapsed: getChatToolbarCollapsed(),
        chatToolbarPinned: getChatToolbarPinned(),
        sidebarPinned: getSidebarPinned(),
        focusMode: getPromptEngineeringMode(),
        promptEngineeringMode: getPromptEngineeringMode(),
        studyMode: getStudyMode(),
        transcribeProfile: getTranscribeProfile(),
        transcribeDocxMode: getTranscribeDocxMode(),
        voiceMode: getVoiceModeEnabled()
      },
      currentThreadIds: {},
      threads: {},
      files: {},
      canvas: {},
      projectBriefs: {},
      kbSettings: {}
    };

    projectIds.forEach((pid) => {
      snapshot.currentThreadIds[pid] = getCurThreadId(pid);
      snapshot.threads[pid] = loadThreads(pid);
      snapshot.files[pid] = sanitizeFilesForCloud(loadFiles(pid));
      snapshot.canvas[pid] = loadJSON(KEYS.canvas(pid), []) || [];
      snapshot.projectBriefs[pid] = loadJSON(KEYS.projectBrief(pid), {}) || {};
      snapshot.kbSettings[pid] = loadJSON(KEYS.kbSettings(pid), {}) || {};
    });
    return snapshot;
  }

  function applyCloudSnapshot(snapshot){
    if (!snapshot || typeof snapshot !== 'object') return false;
    const remoteProjects = Array.isArray(snapshot.projects) && snapshot.projects.length
      ? snapshot.projects
      : [{ id:'default', name:'افتراضي', createdAt: nowTs(), updatedAt: nowTs() }];
    const remoteProjectIds = new Set(remoteProjects.map((project) => String(project?.id || '').trim()).filter(Boolean));
    const localProjects = loadJSON(KEYS.projects, []) || [];

    CLOUD_RUNTIME.muted = true;
    try{
      saveJSON(KEYS.settings, normalizeStoredSettings({ ...getSettings(), ...(snapshot.settings || {}) }));
      saveProjects(remoteProjects);
      localStorage.setItem(KEYS.curProject, String(snapshot.currentProjectId || remoteProjects[0]?.id || 'default'));
      saveDownloads(Array.isArray(snapshot.downloads) ? snapshot.downloads : []);
      saveFavs(Array.isArray(snapshot.favorites) ? snapshot.favorites : []);

      localStorage.setItem(KEYS.modeDeep, snapshot.ui?.modeDeep ? 'true' : 'false');
      localStorage.setItem(KEYS.modeAgent, snapshot.ui?.modeAgent ? 'true' : 'false');
      localStorage.setItem(KEYS.deepSearch, snapshot.ui?.deepSearch ? 'true' : 'false');
      localStorage.setItem(KEYS.webToggle, snapshot.ui?.webToggle ? 'true' : 'false');
      localStorage.setItem(KEYS.headerCollapsed, snapshot.ui?.headerCollapsed ? 'true' : 'false');
      localStorage.setItem(KEYS.chatToolbarCollapsed, snapshot.ui?.chatToolbarCollapsed ? 'true' : 'false');
      localStorage.setItem(KEYS.chatToolbarPinned, snapshot.ui?.chatToolbarPinned !== false ? 'true' : 'false');
      localStorage.setItem(KEYS.sidebarPinned, snapshot.ui?.sidebarPinned ? 'true' : 'false');
      const promptEngineeringMode = snapshot.ui?.promptEngineeringMode ?? snapshot.ui?.focusMode;
      localStorage.setItem(KEYS.focusMode, promptEngineeringMode ? 'true' : 'false');
      localStorage.setItem(KEYS.promptEngineeringMode, promptEngineeringMode ? 'true' : 'false');
      localStorage.setItem(KEYS.studyMode, snapshot.ui?.studyMode ? 'true' : 'false');
      localStorage.setItem(KEYS.transcribeProfile, snapshot.ui?.transcribeProfile || 'balanced');
      localStorage.setItem(KEYS.transcribeDocxMode, snapshot.ui?.transcribeDocxMode || 'auto');
      localStorage.setItem(KEYS.voiceMode, snapshot.ui?.voiceMode ? 'true' : 'false');

      localProjects.forEach((project) => {
        const pid = String(project?.id || '').trim();
        if (!pid || remoteProjectIds.has(pid)) return;
        localStorage.removeItem(KEYS.threads(pid));
        localStorage.removeItem(KEYS.curThread(pid));
        localStorage.removeItem(KEYS.files(pid));
        localStorage.removeItem(KEYS.canvas(pid));
        localStorage.removeItem(KEYS.projectBrief(pid));
        localStorage.removeItem(KEYS.kbSettings(pid));
      });

      remoteProjects.forEach((project) => {
        const pid = String(project?.id || '').trim();
        if (!pid) return;
        saveThreads(pid, Array.isArray(snapshot.threads?.[pid]) ? snapshot.threads[pid] : []);
        localStorage.setItem(KEYS.curThread(pid), String(snapshot.currentThreadIds?.[pid] || ''));
        saveFiles(pid, Array.isArray(snapshot.files?.[pid]) ? snapshot.files[pid] : []);
        saveCanvas(pid, Array.isArray(snapshot.canvas?.[pid]) ? snapshot.canvas[pid] : []);
        saveJSON(KEYS.projectBrief(pid), snapshot.projectBriefs?.[pid] || {});
        saveJSON(KEYS.kbSettings(pid), snapshot.kbSettings?.[pid] || {});
      });
    } finally {
      CLOUD_RUNTIME.muted = false;
    }

    return true;
  }

  async function rehydrateWorkspaceUiAfterCloud(){
    refreshNavMeta();
    applyShellLayout();
    renderChat();
    renderFiles();
    renderDownloads();
    renderThreadHistory();
    renderProjects();
    renderCanvas();
    renderSettings();
    syncAccountUi();
    await renderKbUI().catch(() => {});
    await refreshStrategicWorkspace().catch(() => {});
  }

  async function syncCloudNow(reason = 'manual'){
    const auth = getAuthState();
    if (!hasValidAuthSession(auth) || !auth.email) return null;
    const root = getCloudStorageRoot();
    if (!root) return null;

    const snapshot = buildCloudSnapshot();
    const hash = JSON.stringify(snapshot);
    if (hash === CLOUD_RUNTIME.lastHash && reason !== 'bootstrap-seed') return { ok:true, skipped:true };

    if (CLOUD_RUNTIME.syncPromise) return CLOUD_RUNTIME.syncPromise;
    CLOUD_RUNTIME.syncPromise = fetchAuthJson('/storage/state', {
      method: 'POST',
      body: JSON.stringify({
        reason,
        state: snapshot,
        appVersion: '8.44.0'
      })
    }).then((payload) => {
      CLOUD_RUNTIME.lastHash = hash;
      CLOUD_RUNTIME.lastRemoteUpdatedAt = Number(payload?.updatedAt || snapshot.updatedAt || Date.now());
      saveCloudMeta({
        email: auth.email,
        updatedAt: CLOUD_RUNTIME.lastRemoteUpdatedAt,
        hydratedAt: Date.now()
      });
      return payload;
    }).finally(() => {
      CLOUD_RUNTIME.syncPromise = null;
    });
    return CLOUD_RUNTIME.syncPromise;
  }

  function scheduleCloudSync(reason = 'change'){
    const auth = getAuthState();
    if (!hasValidAuthSession(auth) || !auth.email || CLOUD_RUNTIME.muted) return;
    clearTimeout(CLOUD_RUNTIME.syncTimer);
    CLOUD_RUNTIME.syncTimer = window.setTimeout(() => {
      syncCloudNow(reason).catch(() => {});
    }, 3200);
  }

  async function hydrateCloudState(force = false){
    const auth = getAuthState();
    if (!hasValidAuthSession(auth) || !auth.email) return null;
    if (!force && CLOUD_RUNTIME.hydratedFor === auth.email) return null;
    if (!force && CLOUD_RUNTIME.bootPromise) return CLOUD_RUNTIME.bootPromise;

    CLOUD_RUNTIME.bootPromise = fetchAuthJson('/storage/state', { method:'GET' }).then(async (payload) => {
      const remoteState = payload?.state || null;
      if (remoteState && typeof remoteState === 'object'){
        applyCloudSnapshot(remoteState);
        CLOUD_RUNTIME.lastHash = JSON.stringify(remoteState);
        CLOUD_RUNTIME.lastRemoteUpdatedAt = Number(payload?.updatedAt || remoteState.updatedAt || Date.now());
        saveCloudMeta({
          email: auth.email,
          updatedAt: CLOUD_RUNTIME.lastRemoteUpdatedAt,
          hydratedAt: Date.now()
        });
        await rehydrateWorkspaceUiAfterCloud();
      } else {
        await syncCloudNow('bootstrap-seed').catch(() => null);
      }
      CLOUD_RUNTIME.hydratedFor = auth.email;
      return payload;
    }).catch(() => null).finally(() => {
      CLOUD_RUNTIME.bootPromise = null;
    });

    return CLOUD_RUNTIME.bootPromise;
  }

  function getConvertWorkerRoot(settings = getSettings()){
    const origins = [
      endpointOrigin(settings?.cloudConvertEndpoint || ''),
      endpointOrigin(settings?.cloudConvertFallbackEndpoint || ''),
      endpointOrigin(settings?.ocrCloudEndpoint || '')
    ].filter(Boolean);
    return origins[0] || '';
  }

  function getConvertHealthUrl(settings = getSettings()){
    const endpoint = normalizeDocxCloudEndpoint(settings?.cloudConvertEndpoint || settings?.cloudConvertFallbackEndpoint || '');
    const root = getConvertWorkerRoot(settings);
    if (!root) return '';
    const gatewayRoot = normalizeUrl(resolveGatewayApiRoot(settings));
    if (endpoint && gatewayRoot && endpoint.startsWith(gatewayRoot)) return `${gatewayRoot}/convert/health`;
    return `${root}/health`;
  }

  function supportsCreditVisibility(settings = getSettings()){
    const source = String(effectiveBaseUrl(settings) || settings.baseUrl || '').toLowerCase();
    return settings.authMode === 'gateway'
      || settings.provider === 'openrouter'
      || source.includes('openrouter.ai');
  }

  function getUsageApiRoot(settings = getSettings()){
    return normalizeUrl(
      effectiveBaseUrl(settings)
      || settings.baseUrl
      || (supportsCreditVisibility(settings) ? 'https://openrouter.ai/api/v1' : '')
    );
  }

  function formatUsd(value){
    const n = toFiniteNumber(value);
    if (n == null) return '—';
    const abs = Math.abs(n);
    const maximumFractionDigits = abs >= 100 ? 0 : abs >= 1 ? 2 : abs >= 0.01 ? 3 : 4;
    try{
      return new Intl.NumberFormat('ar-SA', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: Math.min(2, maximumFractionDigits),
        maximumFractionDigits
      }).format(n);
    }catch(_){
      return `$${n.toFixed(maximumFractionDigits)}`;
    }
  }

  function formatTokenCount(value){
    const n = toFiniteNumber(value);
    if (n == null) return '—';
    return Number(n).toLocaleString('ar-SA');
  }

  function getShortModelLabel(value = ''){
    const raw = String(value || '').trim();
    if (!raw) return 'غير محدد';
    const parts = raw.split('/');
    return parts[parts.length - 1] || raw;
  }

  function getLastUsageLabel(usage = getUsageState()){
    const cost = usage.lastRequestCost != null ? formatUsd(usage.lastRequestCost) : '';
    const tokens = usage.lastTotalTokens != null ? `${formatTokenCount(usage.lastTotalTokens)} token` : '';
    const model = usage.lastModel ? getShortModelLabel(usage.lastModel) : '';
    const parts = [cost, tokens, model].filter(Boolean);
    if (parts.length) return parts.join(' • ');
    if (usage.lastCheckedAt) return `آخر مزامنة ${new Date(usage.lastCheckedAt).toLocaleString('ar-SA')}`;
    return '—';
  }

  function renderUsageIndicators(settings = getSettings(), usage = getUsageState()){
    const supported = supportsCreditVisibility(settings);
    const balanceLabel = usage.available && usage.remainingCredits != null
      ? formatUsd(usage.remainingCredits)
      : (supported
        ? (usage.lastError ? 'غير متاح' : 'بانتظار التحقق')
        : 'غير مدعوم');
    const spentLabel = usage.available && usage.totalUsage != null
      ? formatUsd(usage.totalUsage)
      : (usage.lastTotalTokens != null
        ? `${formatTokenCount(usage.lastTotalTokens)} token`
        : '—');
    const lastLabel = (usage.lastError && usage.lastTotalTokens == null && usage.lastRequestCost == null)
      ? briefSnippet(usage.lastError, 78)
      : getLastUsageLabel(usage);

    if ($('topUsageBadge')){
      $('topUsageBadge').textContent = usage.available && usage.remainingCredits != null
        ? `رصيد OpenRouter ${formatUsd(usage.remainingCredits)}`
        : (usage.lastTotalTokens != null
          ? `آخر استهلاك ${formatTokenCount(usage.lastTotalTokens)} token`
          : (supported ? 'رصيد OpenRouter غير متاح' : 'الاستهلاك غير مدعوم'));
      $('topUsageBadge').title = usage.lastError || 'إجمالي الرصيد وآخر استهلاك متى ما كان المزوّد يدعمه.';
    }
    if ($('settingsBalanceState')) $('settingsBalanceState').textContent = balanceLabel;
    if ($('settingsSpentState')) $('settingsSpentState').textContent = spentLabel;
    if ($('settingsLastUsageState')) $('settingsLastUsageState').textContent = lastLabel;
  }

  function extractUsageMeta(payload){
    const usage = payload?.usage && typeof payload.usage === 'object'
      ? payload.usage
      : (payload?.response?.usage && typeof payload.response.usage === 'object' ? payload.response.usage : {});
    const promptTokens = toFiniteNumber(
      usage?.prompt_tokens ?? usage?.input_tokens ?? usage?.promptTokenCount ?? usage?.inputTokenCount
    );
    const completionTokens = toFiniteNumber(
      usage?.completion_tokens ?? usage?.output_tokens ?? usage?.candidatesTokenCount ?? usage?.outputTokenCount
    );
    const totalTokens = toFiniteNumber(
      usage?.total_tokens ?? usage?.totalTokenCount ?? ((promptTokens != null || completionTokens != null)
        ? Number(promptTokens || 0) + Number(completionTokens || 0)
        : null)
    );
    const cost = toFiniteNumber(
      usage?.cost ?? usage?.total_cost ?? usage?.usd ?? payload?.cost ?? payload?.total_cost
    );
    const generationId = String(payload?.id || payload?.generation_id || payload?.response_id || '').trim();
    const model = String(payload?.model || payload?.response?.model || '').trim();
    return { promptTokens, completionTokens, totalTokens, cost, generationId, model };
  }

  function recordUsageFromPayload(payload, meta = {}){
    const usageMeta = extractUsageMeta(payload);
    const patch = {
      provider: meta.provider || getSettings().provider || '',
      source: meta.source || 'chat',
      lastUpdatedAt: nowTs()
    };
    let changed = false;
    if (usageMeta.promptTokens != null){
      patch.lastPromptTokens = usageMeta.promptTokens;
      changed = true;
    }
    if (usageMeta.completionTokens != null){
      patch.lastCompletionTokens = usageMeta.completionTokens;
      changed = true;
    }
    if (usageMeta.totalTokens != null){
      patch.lastTotalTokens = usageMeta.totalTokens;
      changed = true;
    }
    if (usageMeta.cost != null){
      patch.lastRequestCost = usageMeta.cost;
      changed = true;
    }
    if (usageMeta.model || meta.model){
      patch.lastModel = String(meta.model || usageMeta.model || '').trim();
      changed = true;
    }
    if (usageMeta.generationId || meta.generationId){
      patch.lastGenerationId = String(meta.generationId || usageMeta.generationId || '').trim();
      changed = true;
    }
    if (!changed) return getUsageState();
    const next = saveUsageState(patch);
    renderUsageIndicators(meta.settings || getSettings(), next);
    return next;
  }

  function parseCreditsSnapshot(payload){
    const data = payload?.data && typeof payload.data === 'object' ? payload.data : payload;
    const totalCredits = toFiniteNumber(data?.total_credits ?? data?.totalCredits ?? data?.credits ?? data?.limit);
    const totalUsage = toFiniteNumber(data?.total_usage ?? data?.totalUsage ?? data?.used ?? data?.usage);
    const remainingCredits = toFiniteNumber(
      data?.remaining_credits
      ?? data?.remainingCredits
      ?? ((totalCredits != null && totalUsage != null) ? Math.max(0, totalCredits - totalUsage) : null)
    );
    return { totalCredits, totalUsage, remainingCredits };
  }

  function getFriendlyUsageError(error){
    const raw = String(error?.message || error || '').trim();
    if (!raw) return 'تعذر قراءة بيانات الرصيد الآن.';
    if (/management key|admin key|unauthorized.*credits|forbidden.*credits/i.test(raw)){
      return 'إجمالي الرصيد يحتاج Management Key من OpenRouter، لكن آخر استهلاك الطلبات سيظل ظاهرًا عند توفره.';
    }
    if (/insufficient\s+(credits?|balance)|not enough credits?|quota.*exceeded|billing|payment required|402\b/i.test(raw)){
      return 'نفد رصيد OpenRouter أو تم بلوغ حد الفوترة.';
    }
    if (isCloudflareAccessCookieError(raw)){
      return 'تعذر الوصول إلى بيانات الرصيد لأن رابط البوابة محمي أو غير صحيح.';
    }
    return briefSnippet(raw, 120);
  }

  async function fetchCreditsPayload(settings = getSettings()){
    const run = async (activeSettings) => {
      const root = getUsageApiRoot(activeSettings);
      if (!root) throw new Error('رصيد OpenRouter غير متاح مع الإعداد الحالي.');
      const response = await fetch(`${root}/credits`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          ...buildAuthHeaders(activeSettings)
        }
      });
      const text = await response.text();
      let json;
      try{ json = text ? JSON.parse(text) : null; }catch(_){ json = null; }
      if (!response.ok) throw new Error(extractApiErrorMessage(json, text, response.status));
      return json || {};
    };

    try{
      return await run(settings);
    }catch(err){
      const repaired = repairGatewayAfterAccessIssue(err, settings);
      if (repaired){
        return run(repaired);
      }
      throw err;
    }
  }

  async function refreshUsageState(options = {}){
    const settings = options.settings || getSettings();
    const force = !!options.force;
    const current = getUsageState();

    if (!supportsCreditVisibility(settings)){
      const next = saveUsageState({
        provider: settings.provider || '',
        supported: false,
        available: false,
        totalCredits: null,
        totalUsage: null,
        remainingCredits: null,
        lastError: settings.provider === 'gemini'
          ? 'إجمالي الرصيد غير مدعوم مع Gemini داخل التطبيق الحالي.'
          : 'إجمالي الرصيد متاح حاليًا مع OpenRouter فقط.',
        lastCheckedAt: nowTs(),
        source: 'unsupported'
      });
      renderUsageIndicators(settings, next);
      return next;
    }

    if (!force && current.lastCheckedAt && (nowTs() - current.lastCheckedAt) < 60 * 1000){
      renderUsageIndicators(settings, current);
      return current;
    }
    if (USAGE_RUNTIME.creditsPromise) return USAGE_RUNTIME.creditsPromise;

    USAGE_RUNTIME.creditsPromise = (async () => {
      try{
        const payload = await fetchCreditsPayload(settings);
        const snapshot = parseCreditsSnapshot(payload);
        const next = saveUsageState({
          provider: settings.provider || 'openrouter',
          supported: true,
          available: snapshot.totalCredits != null || snapshot.totalUsage != null || snapshot.remainingCredits != null,
          totalCredits: snapshot.totalCredits,
          totalUsage: snapshot.totalUsage,
          remainingCredits: snapshot.remainingCredits,
          lastError: '',
          lastCheckedAt: nowTs(),
          source: 'openrouter_credits'
        });
        renderUsageIndicators(settings, next);
        return next;
      }catch(err){
        const next = saveUsageState({
          provider: settings.provider || 'openrouter',
          supported: true,
          available: current.available,
          lastError: getFriendlyUsageError(err),
          lastCheckedAt: nowTs(),
          source: 'credits_error'
        });
        renderUsageIndicators(settings, next);
        return next;
      }finally{
        USAGE_RUNTIME.creditsPromise = null;
      }
    })();

    return USAGE_RUNTIME.creditsPromise;
  }

  function isCloudflareAccessCookieError(value){
    const msg = String(value?.message || value || '').trim();
    return /no\s+(?:cookie|kookie)\s+auth\s+credential|cloudflare access|authentication required|access denied/i.test(msg);
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

  function repairGatewayAfterAccessIssue(reason = '', settings = getSettings()){
    const current = { ...DEFAULT_SETTINGS, ...(settings || {}) };
    if (current.authMode !== 'gateway') return null;

    const fallbackGateway = normalizeEndpointUrl(DEFAULT_SETTINGS.gatewayUrl || '');
    if (!fallbackGateway) return null;

    const validation = validateGatewayUrlInput(current.gatewayUrl || '', current);
    const currentGateway = normalizeEndpointUrl(current.gatewayUrl || '').replace(/\/v1\/?$/i, '');
    const accessErr = isCloudflareAccessCookieError(reason);
    // On any managed host (app + all *.saddamalkadi.com), cookie/Access errors mean the
    // browser hit a protected origin — reset to the canonical production API worker root.
    const shouldRepairManaged = isManagedHostedRuntime() && accessErr;
    const shouldRepair = !validation.ok || shouldRepairManaged || (accessErr && currentGateway && currentGateway !== fallbackGateway);
    if (!shouldRepair) return null;

    const nextGateway = fallbackGateway;
    const nextBase = `${normalizeUrl(resolveGatewayApiRoot({ ...current, gatewayUrl: nextGateway })) || normalizeUrl(nextGateway)}/v1`;
    const next = setSettings({
      gatewayUrl: nextGateway,
      baseUrl: nextBase
    });

    if ($('gatewayUrl')) $('gatewayUrl').value = next.gatewayUrl || '';
    if ($('baseUrl')) $('baseUrl').value = next.baseUrl || '';
    AUTH_RUNTIME.config = null;
    AUTH_RUNTIME.configPromise = null;
    AUTH_RUNTIME.configLoadedAt = 0;
    return next;
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
    // Final rule: in gateway mode, never fall back to OpenRouter/OpenAI public endpoints.
    // Falling back can route to a protected/static origin and surface Cloudflare Access/cookie errors.
    if (settings && settings.authMode === 'gateway'){
      const only = normalizeUrl(normalizeEndpointUrl(effectiveBaseUrl(settings)));
      return only ? [only] : [];
    }
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
// Default to pinned on fresh installs to keep navigation discoverable.
const getSidebarPinned = () => {
  const raw = localStorage.getItem(KEYS.sidebarPinned);
  if (raw == null) return true;
  return String(raw) === 'true';
};
const setSidebarPinned = (v) => localStorage.setItem(KEYS.sidebarPinned, v ? 'true' : 'false');
const getPromptEngineeringMode = () => {
  const explicit = localStorage.getItem(KEYS.promptEngineeringMode);
  if (explicit !== null) return explicit === 'true';
  return (localStorage.getItem(KEYS.focusMode) || 'false') === 'true';
};
const setPromptEngineeringMode = (v) => {
  const next = v ? 'true' : 'false';
  localStorage.setItem(KEYS.promptEngineeringMode, next);
  // Backward compatibility for older snapshots/clients.
  localStorage.setItem(KEYS.focusMode, next);
};
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
  syncStickyShellMetrics();
  scheduleChatScrollDockSync();
}

let scrollDockFrame = 0;
let lastStickyShellMetrics = '';
function scheduleChatScrollDockSync(){
  if (scrollDockFrame) cancelAnimationFrame(scrollDockFrame);
  scrollDockFrame = requestAnimationFrame(() => {
    scrollDockFrame = 0;
    syncChatScrollDock();
  });
}

function getChatScrollContainer(){
  const page = $('page-chat');
  const log = $('chatLog');
  if (!page) return log;
  if (!log) return page;
  if (window.innerWidth <= 980 && page.classList.contains('active')){
    return log;
  }
  const pageRange = Math.max(0, Number(page.scrollHeight - page.clientHeight || 0));
  const logRange = Math.max(0, Number(log.scrollHeight - log.clientHeight || 0));
  if (window.innerWidth <= 980 && pageRange > 120 && pageRange >= logRange) return page;
  return logRange > 0 ? log : page;
}

function isMobileSidebarViewport(){
  return window.innerWidth <= 980;
}

function isSidebarOverlayMode(){
  return isMobileSidebarViewport() || document.body.classList.contains('sidebarFloating');
}

function syncSidebarDrawerState(){
  const side = $('side');
  const backdrop = $('backdrop');
  const openBtn = $('openSideBtn');
  const closeBtn = $('closeSideBtn');
  const mobile = isMobileSidebarViewport();
  const overlayMode = isSidebarOverlayMode();
  const requestedOpen = !!(side && side.classList.contains('show'));
  const open = !!(requestedOpen && overlayMode);
  const sidebarMode = mobile ? 'mobile-overlay' : (document.body.classList.contains('sidebarFloating') ? 'desktop-floating' : 'desktop-pinned');

  document.body.classList.toggle('mobileSidebarOpen', mobile && open);
  if (mobile){
    document.body.classList.remove('sidebarFloating');
  }
  document.body.dataset.sidebarMode = sidebarMode;
  if (backdrop){
    backdrop.classList.toggle('show', overlayMode && open);
    backdrop.hidden = !(overlayMode && open);
    backdrop.dataset.sidebarMode = sidebarMode;
  }
  if (side){
    side.classList.toggle('show', overlayMode && open);
    side.dataset.sidebarMode = sidebarMode;
    side.setAttribute('aria-hidden', open ? 'false' : 'true');
  }
  if (openBtn){
    openBtn.setAttribute('aria-controls', 'side');
    openBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  if (closeBtn){
    closeBtn.setAttribute('aria-controls', 'side');
    closeBtn.setAttribute('aria-label', 'إغلاق القائمة');
  }
}

function setSidebarDrawerOpen(open){
  const side = $('side');
  if (!side) return;
  if (open && window.innerWidth > 980 && getSidebarPinned()) return;
  side.classList.toggle('show', !!open);
  syncSidebarDrawerState();
  scheduleChatScrollDockSync();
}

function openSide(){
  setSidebarDrawerOpen(true);
}

function closeSide(){
  setSidebarDrawerOpen(false);
}

function syncStickyShellMetrics(){
  const root = document.documentElement;
  const topbar = document.querySelector('.topbar');
  const subtopbar = document.querySelector('.subtopbar');
  const chatbar = document.querySelector('#page-chat .chatbar');
  const composerMeta = document.querySelector('#page-chat > .composer-meta');
  const attachChips = $('chatAttachChips');
  const topbarHeight = topbar ? Math.ceil(topbar.getBoundingClientRect().height || topbar.offsetHeight || 0) : 0;
  const subtopbarHeight = subtopbar ? Math.ceil(subtopbar.getBoundingClientRect().height || subtopbar.offsetHeight || 0) : 0;
  const chatbarHeight = chatbar ? Math.ceil(chatbar.getBoundingClientRect().height || chatbar.offsetHeight || 0) : 0;
  const metaH = (composerMeta && composerMeta.classList && !composerMeta.classList.contains('composer-meta--idle'))
    ? Math.ceil(composerMeta.getBoundingClientRect().height || composerMeta.offsetHeight || 0)
    : 0;
  const chipsH = (attachChips && !attachChips.classList.contains('chips-empty'))
    ? Math.ceil(attachChips.getBoundingClientRect().height || attachChips.offsetHeight || 0)
    : 0;
  const bottomStack = chatbarHeight + metaH + chipsH;
  const stickyGap = window.innerWidth <= 640 ? 8 : 12;
  const floatingBottom = window.innerWidth <= 640
    ? Math.max(76, bottomStack + 12)
    : Math.max(28, bottomStack + 14);
  const metrics = [
    Math.max(stickyGap, topbarHeight + stickyGap),
    Math.max(stickyGap, topbarHeight + subtopbarHeight + (stickyGap * 2)),
    floatingBottom
  ].join('|');
  if (metrics === lastStickyShellMetrics) return;
  lastStickyShellMetrics = metrics;
  root.style.setProperty('--sticky-subtopbar-top', `${Math.max(stickyGap, topbarHeight + stickyGap)}px`);
  root.style.setProperty('--sticky-toolbar-top', `${Math.max(stickyGap, topbarHeight + subtopbarHeight + (stickyGap * 2))}px`);
  root.style.setProperty('--floating-nav-bottom', `${floatingBottom}px`);
}

function scrollChatToBottom(){
  const log = $('chatLog');
  if (!log) return;
  const page = $('page-chat');
  const mobileChatShell = window.innerWidth <= 980 && page?.classList.contains('active');
  if (!mobileChatShell && window.innerWidth <= 640){
    window.scrollTo(0, document.documentElement.scrollHeight + 1000);
  }
  log.scrollTop = log.scrollHeight + 1000;
}

function syncChatScrollDock(){
  const dock = $('chatScrollDock');
  const scroller = getChatScrollContainer();
  const log = $('chatLog');
  if (!dock || !scroller) return;
  const activeChat = !!document.querySelector('#page-chat.page.active');
  const drawer = $('threadDrawer');
  const side = $('side');
  const drawerOpen = !!(drawer && drawer.classList.contains('show'));
  const sideOpen = !!(side && side.classList.contains('show'));
  const keyboardEditing = document.body.classList.contains('keyboardEditing');
  const hasMessages = (log?.querySelectorAll('.bubble').length || 0) > 0;
  const canScroll = (scroller.scrollHeight - scroller.clientHeight) > 120;
  const visible = activeChat && canScroll && !keyboardEditing && !drawerOpen && !sideOpen;
  dock.classList.toggle('show', visible);
  dock.setAttribute('aria-hidden', visible ? 'false' : 'true');

  const top = Math.max(0, Number(scroller.scrollTop || 0));
  const max = Math.max(0, Number(scroller.scrollHeight - scroller.clientHeight || 0));
  const nearTop = top <= 24;
  const nearBottom = (max - top) <= 24;

  if ($('floatingScrollTopBtn')) $('floatingScrollTopBtn').disabled = !visible || !hasMessages || nearTop;
  if ($('floatingScrollBottomBtn')) $('floatingScrollBottomBtn').disabled = !visible || !hasMessages || nearBottom;
}

function applyShellLayout(){
  const desktop = window.innerWidth > 980;
  const floatingSidebar = desktop && !getSidebarPinned();
  if (desktop){
    document.body.classList.toggle('sidebarFloating', floatingSidebar);
  } else {
    document.body.classList.remove('sidebarFloating');
  }
  document.body.classList.remove('focusMode');
  document.body.classList.toggle('promptEngineeringMode', getPromptEngineeringMode());

  if (desktop && !floatingSidebar){
    $('side')?.classList.remove('show');
  }
  syncSidebarDrawerState();

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
    const promptEngineering = getPromptEngineeringMode();
    focusBtn.classList.toggle('dark', promptEngineering);
    focusBtn.title = promptEngineering ? 'إيقاف هندسة البرومبت' : 'تفعيل هندسة البرومبت';
    focusBtn.setAttribute('aria-label', focusBtn.title);
    focusBtn.innerHTML = promptEngineering
      ? '<span class="icon">🧩</span><span class="label">Prompt Engineering</span>'
      : '<span class="icon">✍️</span><span class="label">Prompt Engineering</span>';
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
  refreshVoiceModeButton();
  syncStickyShellMetrics();
  scheduleChatScrollDockSync();
}

  let composerRecognition = null;
  let composerListening = false;
  let composerDictationBase = '';
  let composerWebVoiceSendTimer = 0;

  function getSpeechRecognitionCtor(){
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }

  function getNativeSpeechRecognitionPlugin(){
    return getCapacitorPluginProxy('SpeechRecognition', { nativeOnly:true });
  }

  function getNativeTextToSpeechPlugin(){
    return getCapacitorPluginProxy('TextToSpeech', { nativeOnly:true });
  }

  function getNativeSpeechPermissionStatus(state){
    const raw = String(
      state?.speechRecognition
      || state?.permission
      || state?.microphone
      || ''
    ).trim().toLowerCase();
    if (state?.permission === true) return 'granted';
    return raw || 'unknown';
  }

  function formatNativeSpeechPermissionState(state){
    try{
      return JSON.stringify(state || {});
    }catch(_){
      return String(state);
    }
  }

  async function ensureNativeSpeechRecognitionPermission(plugin){
    if (!plugin) return false;
    const isGranted = (state) => getNativeSpeechPermissionStatus(state) === 'granted';

    let state = null;
    if (plugin.checkPermissions){
      state = await plugin.checkPermissions().catch(() => null);
      if (isGranted(state)) return true;
    }
    if (plugin.hasPermission){
      state = await plugin.hasPermission().catch(() => null);
      if (state?.permission === true || isGranted(state)) return true;
    }
    if (plugin.requestPermissions){
      state = await plugin.requestPermissions().catch(() => null);
      if (isGranted(state)) return true;
    }
    if (plugin.requestPermission){
      state = await plugin.requestPermission().catch(() => null);
      if (state?.permission === true || isGranted(state)) return true;
    }
    return false;
  }

  function setComposerDictationState(state = 'ready'){
    VOICE_RUNTIME.dictationState = String(state || 'ready').trim() || 'ready';
    syncVoiceInputButton();
  }

  async function clearNativeSpeechStateListener(){
    if (!VOICE_RUNTIME.nativeSpeechListener) return;
    try{ await VOICE_RUNTIME.nativeSpeechListener.remove?.(); }catch(_){ }
    VOICE_RUNTIME.nativeSpeechListener = null;
  }

  async function bindNativeSpeechStateListener(plugin, language){
    await clearNativeSpeechStateListener();
    if (!plugin?.addListener) return;
    VOICE_RUNTIME.nativeSpeechListener = await plugin.addListener('listeningState', (event) => {
      const status = String(event?.status || '').trim().toLowerCase();
      if (status === 'started'){
        composerListening = true;
        VOICE_RUNTIME.nativeListening = true;
        setComposerDictationState('listening');
        showStatus(`الإملاء الصوتي يعمل الآن باللغة ${language}...`, false);
        return;
      }
      if (status === 'stopped'){
        composerListening = false;
        VOICE_RUNTIME.nativeListening = false;
        if (VOICE_RUNTIME.nativeStarting){
          setComposerDictationState('processing');
          showStatus('جارٍ معالجة الإملاء الصوتي…', false);
        } else {
          setComposerDictationState('ready');
          showStatus('', false);
        }
      }
    }).catch(() => null);
  }

  async function chooseSpeechLanguageForNativeTts(plugin, preferred){
    if (!plugin?.isLanguageSupported) return preferred;
    const rawPreferred = String(preferred || '').trim() || 'ar-SA';
    const cached = String(VOICE_RUNTIME.nativeTtsLangCached || '').trim();
    if (cached){
      const again = await plugin.isLanguageSupported({ lang: cached }).catch(() => null);
      if (again?.supported) return cached;
      VOICE_RUNTIME.nativeTtsLangCached = '';
    }
    const wantsArabic = /^ar(?:-|$)/i.test(rawPreferred);
    /* Few candidates + one bridge round-trip each — was ~15 sequential calls before every speak() */
    const candidates = wantsArabic
      ? [rawPreferred, rawPreferred.split('-')[0], 'ar-SA', 'ar']
      : [rawPreferred, rawPreferred.split('-')[0], 'en-US', 'en'];
    for (const lang of candidates){
      const code = String(lang || '').trim();
      if (!code) continue;
      const result = await plugin.isLanguageSupported({ lang: code }).catch(() => null);
      if (result?.supported){
        VOICE_RUNTIME.nativeTtsLangCached = code;
        return code;
      }
    }
    return preferred;
  }

  function chooseSpeechSynthesisVoice(lang = 'ar-SA'){
    try{
      const voices = window.speechSynthesis?.getVoices?.() || [];
      if (!voices.length) return null;
      const isArabic = String(lang || '').toLowerCase().startsWith('ar');
      if (isArabic){
        const arabicVoices = voices.filter((v) => /^ar/i.test(v.lang || '') || /arabic|العربية/i.test(v.name || ''));
        if (arabicVoices.length){
          const priority = [
            arabicVoices.find((v) => /google.*arabic|arabic.*google/i.test(v.name)),
            arabicVoices.find((v) => /microsoft.*arabic|arabic.*microsoft/i.test(v.name)),
            arabicVoices.find((v) => /naayf|hoda|asma|zariyah|tarik|omar|laila|amira/i.test(v.name)),
            arabicVoices.find((v) => /ar-SA/i.test(v.lang)),
            arabicVoices.find((v) => /ar-EG/i.test(v.lang)),
            arabicVoices[0]
          ];
          const chosen = priority.find(Boolean);
          if (chosen) return chosen;
        }
      }
      const exact = voices.find((v) => String(v.lang || '').toLowerCase() === lang.toLowerCase());
      if (exact) return exact;
      const family = voices.find((v) => String(v.lang || '').toLowerCase().startsWith(lang.split('-')[0].toLowerCase()));
      if (family) return family;
      return voices.find((v) => v.default) || voices[0] || null;
    }catch(_){
      return null;
    }
  }

  function buildSpeechLanguageCandidates(preferred = 'ar-SA'){
    const raw = String(preferred || '').trim() || 'ar-SA';
    const browserCandidates = Array.isArray(navigator.languages) ? navigator.languages : [];
    const fallback = /^ar(?:-|$)/i.test(raw)
      ? ['ar-SA', 'ar-EG', 'ar-AE', 'ar-JO', 'ar-KW', 'ar-QA', 'ar-BH', 'ar-OM', 'ar-IQ', 'ar-LB', 'ar-LY', 'ar-DZ', 'ar-MA', 'ar-001', 'ar']
      : [raw, raw.split('-')[0], 'ar-SA', 'ar'];
    return [...new Set([
      raw,
      raw.split('-')[0],
      ...browserCandidates,
      navigator.language || '',
      ...fallback
    ].map((item) => String(item || '').trim()).filter(Boolean))];
  }

  function getPreferredSpeechLanguage(){
    const authConfig = getEffectiveAuthConfig();
    const voiceConfig = getVoiceCloudConfig();
    const candidates = buildSpeechLanguageCandidates(
      voiceConfig.preferredLanguage
      || authConfig.voicePreferredLanguage
      || 'ar-SA'
    );
    return candidates[0] || 'ar-SA';
  }

  async function resolveSpeechRecognitionLanguage(plugin){
    const candidates = buildSpeechLanguageCandidates(getPreferredSpeechLanguage());
    const fallback = candidates[0] || 'ar-SA';
    if (!plugin?.getSupportedLanguages) return fallback;
    /* Android: getSupportedLanguages() can hang (broadcast / OS quirks); use preferred locale and skip the call. */
    if (typeof isNativeAndroidPlatform === 'function' && isNativeAndroidPlatform()){
      return fallback;
    }
    try{
      const result = await Promise.race([
        plugin.getSupportedLanguages(),
        new Promise((_, reject) => {
          window.setTimeout(() => reject(Object.assign(new Error('SPEECH_LANG_LIST_TIMEOUT'), { code: 'SPEECH_LANG_LIST_TIMEOUT' })), 2400);
        })
      ]);
      const supported = Array.isArray(result?.languages)
        ? result.languages
        : (Array.isArray(result) ? result : []);
      const normalized = supported.map((item) => String(item || '').trim().toLowerCase()).filter(Boolean);
      for (const candidate of candidates){
        const exact = String(candidate || '').trim().toLowerCase();
        if (!exact) continue;
        if (normalized.includes(exact)) return candidate;
        const family = exact.split('-')[0];
        if (normalized.some((value) => value === family || value.startsWith(`${family}-`))){
          return candidate;
        }
      }
    }catch(_){}
    return fallback;
  }

  async function resolveSpeechSynthesisLanguage(plugin){
    const preferred = getPreferredSpeechLanguage();
    if (plugin?.isLanguageSupported){
      return chooseSpeechLanguageForNativeTts(plugin, preferred);
    }
    const voice = chooseSpeechSynthesisVoice(preferred) || chooseSpeechSynthesisVoice('ar-SA');
    return String(voice?.lang || preferred || 'ar-SA').trim() || 'ar-SA';
  }

  async function ensureNativeArabicTtsLanguage(plugin, preferred){
    return chooseSpeechLanguageForNativeTts(plugin, preferred || getPreferredSpeechLanguage());
  }

  async function stopNativeSpeechPluginSafely(plugin, timeoutMs = 450){
    if (!plugin?.stop) return;
    try{
      await Promise.race([
        Promise.resolve(plugin.stop()).catch(() => null),
        new Promise((resolve) => window.setTimeout(resolve, timeoutMs))
      ]);
    }catch(_){}
  }

  async function resetNativeSpeechSession(plugin){
    if (!plugin) return;
    await clearNativeSpeechStateListener();
    await stopNativeSpeechPluginSafely(plugin);
    try{ await plugin.removeAllListeners?.(); }catch(_){ }
    VOICE_RUNTIME.nativeListening = false;
    VOICE_RUNTIME.nativeStarting = false;
  }

  function clearVoiceRestartTimer(){
    if (VOICE_RUNTIME.restartTimer){
      clearTimeout(VOICE_RUNTIME.restartTimer);
      VOICE_RUNTIME.restartTimer = 0;
    }
  }

  function shouldKeepContinuousVoiceLoop(){
    return !!getVoiceModeEnabled()
      && !composerListening
      && !VOICE_RUNTIME.speaking
      && !document.hidden
      && !!$('chatInput');
  }

  function scheduleVoiceConversationRestart(delay = 600){
    clearVoiceRestartTimer();
    if (!shouldKeepContinuousVoiceLoop()) return;
    VOICE_RUNTIME.restartTimer = window.setTimeout(() => {
      VOICE_RUNTIME.restartTimer = 0;
      if (shouldKeepContinuousVoiceLoop()) void startComposerDictation();
    }, Math.max(120, Number(delay || 0)));
  }

  function scheduleVoiceConversationRecovery(delay = 420){
    if (!getVoiceModeEnabled()) return;
    scheduleVoiceConversationRestart(delay);
  }

  function cleanupCloudVoiceCapture(){
    VOICE_RUNTIME.cloudCancelRequested = false;
    try{ VOICE_RUNTIME.cloudSilenceCleanup?.(); }catch(_){ }
    VOICE_RUNTIME.cloudSilenceCleanup = null;
    if (VOICE_RUNTIME.cloudRecorder){
      try{
        if (VOICE_RUNTIME.cloudRecorder.state !== 'inactive'){
          VOICE_RUNTIME.cloudRecorder.stop();
        }
      }catch(_){ }
    }
    VOICE_RUNTIME.cloudRecorder = null;
    if (VOICE_RUNTIME.cloudStream){
      try{
        VOICE_RUNTIME.cloudStream.getTracks?.().forEach((track) => {
          try{ track.stop(); }catch(_){ }
        });
      }catch(_){ }
    }
    VOICE_RUNTIME.cloudStream = null;
  }

  /**
   * Stop cloud recording after sustained quiet (post-speech pause) or hard max duration.
   * Separates "end of capture" from auto-send delay in finish().
   */
  function attachCloudSilenceStop(stream, recorder, opts = {}){
    const maxMs = opts.maxMs ?? VOICE_CLOUD_MAX_RECORD_MS_SINGLE;
    const silenceHoldMs = opts.silenceHoldMs ?? VOICE_CLOUD_SILENCE_HOLD_MS;
    const rmsThreshold = opts.rmsThreshold ?? VOICE_CLOUD_SILENCE_RMS;
    const tickMs = opts.tickMs ?? VOICE_CLOUD_SILENCE_TICK_MS;
    const minLoudMs = opts.minLoudMs ?? VOICE_CLOUD_MIN_LOUD_MS;
    let loudMsAccum = 0;
    let silenceStart = 0;
    let audioCtx = null;
    let analyser = null;
    let dataBuf = null;
    let intervalId = 0;
    let maxTimerId = 0;

    const stopMonitoring = () => {
      if (intervalId) clearInterval(intervalId);
      intervalId = 0;
      if (maxTimerId) clearTimeout(maxTimerId);
      maxTimerId = 0;
      try{
        if (audioCtx && audioCtx.state !== 'closed') audioCtx.close();
      }catch(_){ }
      audioCtx = null;
      analyser = null;
      dataBuf = null;
    };

    const tick = () => {
      if (!recorder || recorder.state === 'inactive') return;
      if (!analyser || !dataBuf) return;
      analyser.getByteTimeDomainData(dataBuf);
      let sum = 0;
      for (let i = 0; i < dataBuf.length; i += 1){
        const v = (dataBuf[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / dataBuf.length);
      const now = Date.now();
      if (rms >= rmsThreshold){
        loudMsAccum += tickMs;
        silenceStart = 0;
      } else if (loudMsAccum >= minLoudMs){
        if (!silenceStart) silenceStart = now;
        else if (now - silenceStart >= silenceHoldMs){
          try{ if (recorder.state !== 'inactive') recorder.stop(); }catch(_){ }
          stopMonitoring();
        }
      }
    };

    try{
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx && stream){
        audioCtx = new Ctx();
        const source = audioCtx.createMediaStreamSource(stream);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.62;
        source.connect(analyser);
        dataBuf = new Uint8Array(analyser.frequencyBinCount);
        intervalId = window.setInterval(tick, tickMs);
      }
    }catch(_){
      stopMonitoring();
    }

    maxTimerId = window.setTimeout(() => {
      try{ if (recorder && recorder.state !== 'inactive') recorder.stop(); }catch(_){ }
      stopMonitoring();
    }, maxMs);

    return stopMonitoring;
  }

  function pickVoiceRecordingMimeType(){
    if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
    return [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus'
    ].find((mime) => {
      try{ return MediaRecorder.isTypeSupported(mime); }catch(_){ return false; }
    }) || '';
  }

  async function transcribeAudioBlobByCloud(blob, settings = getSettings()){
    const voice = getVoiceCloudConfig(settings);
    if (!voice.sttReady || !blob) return '';
    const form = new FormData();
    const fileName = `voice-${Date.now()}.${inferExtensionFromMime(blob.type || 'audio/webm')}`;
    form.append('file', blob, fileName);
    form.append('model', voice.recognitionModel);
    form.append('language', voice.preferredLanguage || getPreferredSpeechLanguage());
    const response = await fetchAuthResponse('/voice/transcribe', {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: form
    }, settings);
    const raw = await response.text();
    let payload = null;
    try{ payload = raw ? JSON.parse(raw) : null; }catch(_){ payload = null; }
    const transcript = String(payload?.text || payload?.transcript || '').trim();
    if (!transcript) throw new Error('الخادم أعاد تفريغًا صوتيًا فارغًا.');
    return transcript;
  }

  function isTtsModelArabicCapable(model){
    if (!model) return false;
    const m = String(model).toLowerCase();
    if (/melotts|melo-tts/i.test(m)) return false;
    if (/tts-1|tts-1-hd|gpt-4o|eleven|azure|google.*tts|neural|wavenet|polly|edge-tts|openai/i.test(m)) return true;
    return false;
  }

  async function speakAssistantReplyByProxyTts(text, lang = 'ar'){
    if (!String(text || '').trim()) return false;
    try{
      const apiRoot = (getAuthServiceRoot() || '').replace(/\/+$/, '');
      const proxyUrl = apiRoot ? `${apiRoot}/proxy/tts` : '/proxy/tts';
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, lang }),
        signal: AbortSignal.timeout(30000)
      });
      if (!response.ok) return false;
      const audioBlob = await response.blob();
      if (!audioBlob || !audioBlob.size) return false;

      const audio = new Audio();
      const objectUrl = URL.createObjectURL(audioBlob);
      audio.src = objectUrl;
      audio.__objectUrl = objectUrl;
      audio.preload = 'auto';
      VOICE_RUNTIME.audioPlayer = audio;
      try{ audio.load(); }catch(_){}

      return await new Promise((resolve) => {
        const cleanup = (played) => {
          VOICE_RUNTIME.speaking = false;
          if (VOICE_RUNTIME.audioPlayer === audio) VOICE_RUNTIME.audioPlayer = null;
          try{ if (audio.__objectUrl) URL.revokeObjectURL(audio.__objectUrl); }catch(_){ }
          if (played) scheduleVoiceConversationRestart(700);
          resolve(played);
        };
        audio.onended = () => cleanup(true);
        audio.onerror = () => cleanup(false);
        try{
          VOICE_RUNTIME.speaking = true;
          const p = audio.play();
          if (p && typeof p.then === 'function') p.catch(() => cleanup(false));
        }catch(_){ cleanup(false); }
      });
    }catch(_){
      return false;
    }
  }

  async function waitForSpeechVoices(timeoutMs = 2500){
    return new Promise((resolve) => {
      try{
        const voices = window.speechSynthesis?.getVoices?.() || [];
        if (voices.length > 0){ resolve(voices); return; }
        const timer = setTimeout(() => resolve([]), timeoutMs);
        window.speechSynthesis?.addEventListener?.('voiceschanged', () => {
          clearTimeout(timer);
          resolve(window.speechSynthesis?.getVoices?.() || []);
        }, { once: true });
      }catch(_){ resolve([]); }
    });
  }

  async function speakAssistantReplyByCloud(text, settings = getSettings()){
    const voice = getVoiceCloudConfig(settings);
    if (!voice.ttsReady || !String(text || '').trim()) return false;
    const lang = String(voice.preferredLanguage || getPreferredSpeechLanguage() || '').toLowerCase();
    const isArabic = lang.startsWith('ar');
    if (isArabic && !isTtsModelArabicCapable(voice.synthesisModel)) return false;
    const response = await fetchAuthResponse('/voice/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        model: voice.synthesisModel,
        voice: voice.synthesisVoice,
        language: getSpeechLanguageForText(text, voice.preferredLanguage || getPreferredSpeechLanguage())
      })
    }, settings);
    const audioBlob = await response.blob();
    if (!audioBlob || !audioBlob.size) return false;

    const audio = new Audio();
    const objectUrl = URL.createObjectURL(audioBlob);
    audio.src = objectUrl;
    audio.__objectUrl = objectUrl;
    audio.preload = 'auto';
    VOICE_RUNTIME.audioPlayer = audio;
    try{ audio.load(); }catch(_){}

    return await new Promise((resolve) => {
      const cleanup = (played) => {
        VOICE_RUNTIME.speaking = false;
        if (VOICE_RUNTIME.audioPlayer === audio) VOICE_RUNTIME.audioPlayer = null;
        try{
          if (audio.__objectUrl) URL.revokeObjectURL(audio.__objectUrl);
        }catch(_){ }
        if (played) scheduleVoiceConversationRestart(700);
        resolve(played);
      };
      audio.onended = () => cleanup(true);
      audio.onerror = () => cleanup(false);
      try{
        VOICE_RUNTIME.speaking = true;
        const playPromise = audio.play();
        if (playPromise && typeof playPromise.then === 'function'){
          playPromise.catch(() => cleanup(false));
        }
      }catch(_){
        cleanup(false);
      }
    });
  }

  async function startCloudComposerDictation(){
    const voice = getVoiceCloudConfig();
    const input = $('chatInput');
    if (!voice.sttReady || !input) return false;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined'){
      return { success:false, fallbackAllowed:true, cancelled:false };
    }

    let stream = null;
    try{
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
    }catch(error){
      toast(`تعذّر الوصول إلى الميكروفون: ${error?.message || error}`);
      return { success:false, fallbackAllowed:true, cancelled:false };
    }

    cleanupCloudVoiceCapture();
    VOICE_RUNTIME.cloudStream = stream;
    VOICE_RUNTIME.cloudCancelRequested = false;
    composerDictationBase = String(input.value || '').trimEnd();
    VOICE_RUNTIME.autoSendArmed = true;
    VOICE_RUNTIME.continuousConversation = getVoiceModeEnabled();
    composerListening = true;
    syncVoiceInputButton();
    showStatus(`الإملاء الصوتي السحابي يعمل الآن باللغة ${voice.preferredLanguage || getPreferredSpeechLanguage()}...`, false);

    const mimeType = pickVoiceRecordingMimeType();
    const recorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);
    const chunks = [];
    VOICE_RUNTIME.cloudRecorder = recorder;

    return await new Promise((resolve) => {
      let settled = false;
      const finish = async ({ transcribe = true } = {}) => {
        if (settled) return;
        settled = true;
        try{ VOICE_RUNTIME.cloudSilenceCleanup?.(); }catch(_){ }
        VOICE_RUNTIME.cloudSilenceCleanup = null;
        const wasCancelled = VOICE_RUNTIME.cloudCancelRequested;
        composerListening = false;
        syncVoiceInputButton();
        showStatus('', false);
        VOICE_RUNTIME.cloudRecorder = null;
        cleanupCloudVoiceCapture();
        if (wasCancelled || !transcribe){
          VOICE_RUNTIME.autoSendArmed = false;
          resolve(!wasCancelled);
          return;
        }
        try{
          const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' });
          if (!blob.size){
            VOICE_RUNTIME.autoSendArmed = false;
            if (shouldKeepContinuousVoiceLoop()) scheduleVoiceConversationRestart(650);
            resolve(false);
            return;
          }
          const transcript = await transcribeAudioBlobByCloud(blob);
          if (transcript){
            input.value = [composerDictationBase, transcript].filter(Boolean).join(composerDictationBase ? '\n' : '');
            resizeComposerInput(input);
            syncComposerMeta();
          }
          const shouldAutoSend = VOICE_RUNTIME.autoSendArmed && !!String(input.value || '').trim();
          VOICE_RUNTIME.autoSendArmed = false;
          if (shouldAutoSend){
            window.setTimeout(() => {
              if (String($('chatInput')?.value || '').trim()) void sendMessage();
            }, VOICE_AUTOSEND_AFTER_TRANSCRIPT_MS);
          } else if (shouldKeepContinuousVoiceLoop()){
            scheduleVoiceConversationRestart(650);
          }
          resolve(!!transcript);
        }catch(error){
          VOICE_RUNTIME.autoSendArmed = false;
          toast(`تعذّر الإملاء الصوتي السحابي: ${error?.message || error}`);
          if (shouldKeepContinuousVoiceLoop()) scheduleVoiceConversationRecovery(850);
          resolve(false);
        }
      };

      recorder.ondataavailable = (event) => {
        if (event?.data?.size) chunks.push(event.data);
      };
      recorder.onerror = () => { finish({ transcribe:false }).catch(() => {}); };
      recorder.onstop = () => { finish({ transcribe:true }).catch(() => {}); };

      try{
        recorder.start();
        try{ VOICE_RUNTIME.cloudSilenceCleanup?.(); }catch(_){ }
        VOICE_RUNTIME.cloudSilenceCleanup = attachCloudSilenceStop(stream, recorder, {
          maxMs: getVoiceModeEnabled() ? VOICE_CLOUD_MAX_RECORD_MS_VOICE : VOICE_CLOUD_MAX_RECORD_MS_SINGLE
        });
      }catch(error){
        cleanupCloudVoiceCapture();
        composerListening = false;
        VOICE_RUNTIME.autoSendArmed = false;
        syncVoiceInputButton();
        showStatus('', false);
        toast(`تعذّر بدء الإملاء الصوتي السحابي: ${error?.message || error}`);
        resolve(false);
      }
    });
  }

  function syncVoiceInputButton(){
    const btn = $('voiceInputBtn');
    if (!btn) return;
    const state = composerListening
      ? 'listening'
      : (VOICE_RUNTIME.dictationState || 'ready');
    btn.dataset.state = state;
    btn.classList.toggle('dark', state === 'listening' || state === 'processing');
    btn.classList.toggle('is-recording', state === 'listening');
    btn.disabled = state === 'processing';
    btn.setAttribute('aria-busy', state === 'processing' ? 'true' : 'false');
    btn.title = state === 'listening'
      ? 'إيقاف الإملاء الصوتي'
      : (state === 'processing' ? 'جارٍ تجهيز الإملاء الصوتي' : 'بدء الإملاء الصوتي');
    btn.setAttribute('aria-label', btn.title);
    btn.innerHTML = state === 'listening'
      ? '<span class="icon">🎙️</span><span class="label">إيقاف الإملاء</span>'
      : (state === 'processing'
        ? '<span class="icon">⏳</span><span class="label">جارٍ التحضير</span>'
        : '<span class="icon">🎤</span><span class="label">إملاء صوتي</span>');
  }

  function refreshVoiceModeButton(){
    const btn = $('voiceModeBtn');
    if (!btn) return;
    const active = getVoiceModeEnabled();
    btn.classList.toggle('dark', active);
    btn.title = active ? 'إيقاف الدردشة الصوتية' : 'تفعيل الدردشة الصوتية';
    btn.setAttribute('aria-label', btn.title);
    btn.innerHTML = active
      ? '<span class="icon">🎙</span><span class="label">صوت نشط</span>'
      : '<span class="icon">🎙️</span><span class="label">صوت</span>';
  }

  function stripTextForSpeech(content = ''){
    const raw = stripFileBlocks(String(content || ''));
    return raw
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`[^`]*`/g, ' ')
      .replace(/\[(?:KB|FILE|IMG):[^\]]+\]/gi, ' ')
      .replace(/https?:\/\/\S+/g, ' ')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/^[\s]*[-*+]\s+/gm, '')
      .replace(/^\s*\d+\.\s+/gm, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function containsArabicText(value = ''){
    return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(String(value || ''));
  }

  function getSpeechLanguageForText(value = '', fallback = getPreferredSpeechLanguage()){
    const preferred = String(fallback || 'ar-SA').trim() || 'ar-SA';
    if (containsArabicText(value)) return /^ar(?:-|$)/i.test(preferred) ? preferred : 'ar-SA';
    return preferred;
  }

  function splitTextForSpeech(text = '', maxLen = 220){
    const normalized = String(text || '').replace(/\s+/g, ' ').trim();
    if (!normalized) return [];
    if (normalized.length <= maxLen) return [normalized];
    const parts = normalized
      .split(/(?<=[\.\!\?\u061F\u060C:؛])\s+/)
      .map((item) => String(item || '').trim())
      .filter(Boolean);
    if (!parts.length) return [normalized];
    const out = [];
    let current = '';
    for (const part of parts){
      if (!current){
        current = part;
        continue;
      }
      if ((`${current} ${part}`).trim().length <= maxLen){
        current = `${current} ${part}`.trim();
        continue;
      }
      out.push(current);
      if (part.length <= maxLen){
        current = part;
        continue;
      }
      const words = part.split(/\s+/).filter(Boolean);
      let chunk = '';
      for (const word of words){
        const next = `${chunk} ${word}`.trim();
        if (next.length > maxLen && chunk){
          out.push(chunk);
          chunk = word;
        } else {
          chunk = next;
        }
      }
      current = chunk;
    }
    if (current) out.push(current);
    return out.filter(Boolean);
  }

  async function speakWithBrowserSpeechSynthesis(text, preferredLang){
    try{
      if (window.speechSynthesis && !window.speechSynthesis.getVoices?.()?.length){
        await waitForSpeechVoices(400);
      }
    }catch(_){}
    const parts = splitTextForSpeech(text, 280);
    if (!parts.length) return false;
    return await new Promise((resolve) => {
      let index = 0;
      const language = getSpeechLanguageForText(text, preferredLang);
      const speakNext = () => {
        if (index >= parts.length){
          VOICE_RUNTIME.speaking = false;
          VOICE_RUNTIME.utterance = null;
          scheduleVoiceConversationRestart(700);
          resolve(true);
          return;
        }
        const utter = new SpeechSynthesisUtterance(parts[index]);
        utter.lang = language;
        utter.voice = chooseSpeechSynthesisVoice(language) || chooseSpeechSynthesisVoice('ar-SA') || chooseSpeechSynthesisVoice('ar');
        utter.rate = 0.92;
        utter.pitch = 1;
        utter.onstart = () => {
          VOICE_RUNTIME.speaking = true;
          VOICE_RUNTIME.utterance = utter;
        };
        utter.onend = () => {
          index += 1;
          window.setTimeout(speakNext, 40);
        };
        utter.onerror = () => {
          VOICE_RUNTIME.speaking = false;
          VOICE_RUNTIME.utterance = null;
          resolve(false);
        };
        try{
          window.speechSynthesis.resume?.();
          window.speechSynthesis.speak(utter);
        }catch(_){
          VOICE_RUNTIME.speaking = false;
          VOICE_RUNTIME.utterance = null;
          resolve(false);
        }
      };
      speakNext();
    });
  }

  async function stopVoicePlayback({ awaitNativeStopMaxMs = null } = {}){
    clearVoiceRestartTimer();
    const nativeTts = getNativeTextToSpeechPlugin();
    if (nativeTts?.stop){
      try{
        const stopP = Promise.resolve(nativeTts.stop()).catch(() => null);
        if (awaitNativeStopMaxMs != null && awaitNativeStopMaxMs > 0){
          await Promise.race([
            stopP,
            new Promise((r) => window.setTimeout(r, awaitNativeStopMaxMs))
          ]);
        }else{
          await stopP;
        }
      }catch(_){ }
    }
    if (VOICE_RUNTIME.audioPlayer){
      try{ VOICE_RUNTIME.audioPlayer.pause?.(); }catch(_){ }
      try{
        if (VOICE_RUNTIME.audioPlayer.__objectUrl){
          URL.revokeObjectURL(VOICE_RUNTIME.audioPlayer.__objectUrl);
        }
      }catch(_){ }
      VOICE_RUNTIME.audioPlayer = null;
    }
    try{ window.speechSynthesis?.cancel?.(); }catch(_){ }
    VOICE_RUNTIME.speaking = false;
    VOICE_RUNTIME.utterance = null;
  }

  async function speakAssistantReply(content = '', { force = false } = {}){
    if (!force && !getVoiceModeEnabled()) return false;
    const text = stripTextForSpeech(content);
    if (!text){
      scheduleVoiceConversationRecovery(250);
      return false;
    }

    /* Cap short wait so prior stop() does not block time-to-first-audio (native stop can be slow). */
    await stopVoicePlayback({ awaitNativeStopMaxMs: 160 });

    const preferredLang = String(getPreferredSpeechLanguage() || 'ar-SA');
    const isArabicSession = /^ar/i.test(preferredLang);
    const nativeTts = getNativeTextToSpeechPlugin();
    const langForUtterance = getSpeechLanguageForText(text, preferredLang);

    /* Capacitor: native plugin first — avoids proxy+cloud network before local synthesis (major APK / iOS win). */
    if (nativeTts?.speak){
      const nativeLang = await chooseSpeechLanguageForNativeTts(nativeTts, langForUtterance);
      try{
        VOICE_RUNTIME.speaking = true;
        await nativeTts.speak({
          text,
          lang: nativeLang,
          rate: 0.92,
          pitch: 1,
          volume: 1
        });
        VOICE_RUNTIME.speaking = false;
        VOICE_RUNTIME.utterance = null;
        scheduleVoiceConversationRestart(700);
        return true;
      }catch(error){
        VOICE_RUNTIME.speaking = false;
        VOICE_RUNTIME.utterance = null;
        if (force) toast(`تعذّر تشغيل الرد صوتيًا: ${error?.message || error}`);
      }
    }

    /* Web read-aloud (force): browser engine first — no network wait for first sound. Voice-mode auto: keep cloud/proxy first for quality. */
    const tryBrowserFirst = force && !nativeTts?.speak;
    if (tryBrowserFirst && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance !== 'undefined'){
      try{
        const ok = await speakWithBrowserSpeechSynthesis(text, langForUtterance);
        if (ok) return true;
      }catch(_){}
    }

    if (isArabicSession){
      try{
        const proxyPlayed = await speakAssistantReplyByProxyTts(text, preferredLang.split('-')[0] || 'ar');
        if (proxyPlayed) return true;
      }catch(_){ }
    }

    try{
      const cloudPlayed = await speakAssistantReplyByCloud(text, getSettings());
      if (cloudPlayed) return true;
    }catch(error){
      if (force) toast(`تعذّر تشغيل الرد صوتيًا عبر السحابة: ${error?.message || error}`);
    }

    if (!('speechSynthesis' in window) || typeof window.SpeechSynthesisUtterance === 'undefined'){
      if (force) toast('التشغيل الصوتي غير مدعوم في هذا المتصفح.');
      return false;
    }

    return await speakWithBrowserSpeechSynthesis(text, langForUtterance);
  }

  async function stopComposerDictation(showToast = false){
    clearVoiceRestartTimer();
    if (composerWebVoiceSendTimer){
      clearTimeout(composerWebVoiceSendTimer);
      composerWebVoiceSendTimer = 0;
    }
    const nativeSpeech = getNativeSpeechRecognitionPlugin();
    VOICE_RUNTIME.autoSendArmed = false;
    VOICE_RUNTIME.continuousConversation = getVoiceModeEnabled();
    if (VOICE_RUNTIME.cloudRecorder && VOICE_RUNTIME.cloudRecorder.state !== 'inactive'){
      try{ VOICE_RUNTIME.cloudRecorder.stop(); }catch(_){ }
    } else if (VOICE_RUNTIME.cloudStream){
      cleanupCloudVoiceCapture();
    }
    if (nativeSpeech?.stop){
      await stopNativeSpeechPluginSafely(nativeSpeech);
    }
    await clearNativeSpeechStateListener();
    VOICE_RUNTIME.nativeListening = false;
    VOICE_RUNTIME.nativeStarting = false;
    try{ composerRecognition?.stop?.(); }catch(_){ }
    composerRecognition = null;
    composerListening = false;
    setComposerDictationState('ready');
    showStatus('', false);
    if (showToast) toast('تم إيقاف الإملاء الصوتي');
  }

  async function startNativeComposerDictation(){
    const plugin = getNativeSpeechRecognitionPlugin();
    const input = $('chatInput');
    if (!plugin || !input) return { success:false, fallbackAllowed:true, cancelled:false };

    await resetNativeSpeechSession(plugin);
    const availability = await plugin.available?.().catch(() => ({ available:false }));
    if (!availability?.available){
      toast('التعرّف الصوتي غير متاح على هذا الجهاز.');
      return false;
    }

    const permitted = await ensureNativeSpeechRecognitionPermission(plugin);
    if (!permitted){
      toast('يلزم منح إذن الميكروفون لتفعيل الدردشة الصوتية.');
      return false;
    }

    const language = await resolveSpeechRecognitionLanguage(plugin);
    composerDictationBase = String(input.value || '').trimEnd();
    VOICE_RUNTIME.autoSendArmed = true;
    composerListening = true;
    VOICE_RUNTIME.nativeListening = true;
    VOICE_RUNTIME.continuousConversation = getVoiceModeEnabled();
    syncVoiceInputButton();
    showStatus(`الإملاء الصوتي يعمل الآن باللغة ${language}...`, false);

    try{
      const result = await plugin.start({
        language,
        maxResults: 1,
        prompt: getVoiceModeEnabled() ? 'ابدأ الحديث الآن' : 'تحدث الآن',
        partialResults: false,
        popup: true
      });
      const transcript = Array.isArray(result?.matches)
        ? result.matches.map((item) => String(item || '').trim()).filter(Boolean).join(' ')
        : '';
      if (transcript){
        input.value = [composerDictationBase, transcript].filter(Boolean).join(composerDictationBase ? '\n' : '');
        resizeComposerInput(input);
        syncComposerMeta();
      }
    }catch(error){
      const message = String(error?.message || error || '').trim();
      if (!/cancel/i.test(message)) toast(`تعذّر الإملاء الصوتي: ${message || 'unknown'}`);
    }finally{
      VOICE_RUNTIME.nativeListening = false;
      composerListening = false;
      await resetNativeSpeechSession(plugin);
      syncVoiceInputButton();
      showStatus('', false);
      const shouldAutoSend = VOICE_RUNTIME.autoSendArmed && String(input.value || '').trim();
      VOICE_RUNTIME.autoSendArmed = false;
      if (shouldAutoSend){
        window.setTimeout(() => {
          if (String($('chatInput')?.value || '').trim()) void sendMessage();
        }, VOICE_AUTOSEND_AFTER_TRANSCRIPT_MS);
      } else if (shouldKeepContinuousVoiceLoop()){
        scheduleVoiceConversationRestart(550);
      }
    }
    return true;
  }

  function translateNativeSttError(message = ''){
    const m = String(message || '').trim();
    if (!m) return 'خطأ غير معروف في التعرف الصوتي.';
    if (/^0$/.test(m)) return 'تم إلغاء نافذة التعرف الصوتي.';
    if (/^1$/.test(m)) return 'لم يُكمل الجهاز التعرف الصوتي (رمز 1).';
    if (/No speech input/i.test(m)) return 'لم يُلتقط صوت. حاول مجددًا بميكروفون أوضح.';
    if (/No match/i.test(m)) return 'لم يُتعرّف على الكلام. جرّب جملة أقصر أو أبطأ.';
    if (/Client side error/i.test(m)) return 'تعذّر تشغيل المحرك المحلي للتعرف (خطأ عميل). جرّب إعادة التشغيل أو تحديث تطبيق Google.';
    if (/RecognitionService busy/i.test(m)) return 'خدمة التعرف مشغولة. انتظر ثانية ثم أعد المحاولة.';
    if (/Insufficient permissions|MISSING_PERMISSION/i.test(m)) return 'إذن الميكروفون غير مفعّل لهذا التطبيق.';
    if (/Network error|Network timeout/i.test(m)) return 'مشكلة شبكة أثناء التعرف الصوتي.';
    if (/Audio recording error/i.test(m)) return 'تعذّر تسجيل الصوت من الميكروفون.';
    return m;
  }

  async function startNativeComposerDictationSafe(){
    const plugin = getNativeSpeechRecognitionPlugin();
    const input = $('chatInput');
    if (!plugin || !input) return { success:false, fallbackAllowed:true, cancelled:false };
    if (VOICE_RUNTIME.nativeStarting) return { success:false, fallbackAllowed:false, cancelled:true };

    const useAndroidIntentUi = typeof isNativeAndroidPlatform === 'function' && isNativeAndroidPlatform();

    try{
      VOICE_RUNTIME.nativeStarting = true;
      setComposerDictationState('processing');
      showStatus('جارٍ تجهيز الإملاء الصوتي…', false);
      await stopVoicePlayback();
      await resetNativeSpeechSession(plugin);

      const availability = await plugin.available?.().catch(() => ({ available:false }));
      if (!availability?.available){
        toast('التعرف الصوتي غير متاح على هذا الجهاز (لا يوجد محرك تعرف مثبت).');
        return { success:false, fallbackAllowed:true, cancelled:false };
      }

      const permitted = await ensureNativeSpeechRecognitionPermission(plugin);
      if (!permitted){
        let permSnap = null;
        try{ permSnap = await plugin.checkPermissions?.().catch(() => null); }catch(_){ permSnap = null; }
        toast(`يلزم منح إذن الميكروفون. حالة الصلاحيات: ${formatNativeSpeechPermissionState(permSnap)}`);
        return { success:false, fallbackAllowed:true, cancelled:false };
      }

      const language = await resolveSpeechRecognitionLanguage(plugin);
      composerDictationBase = String(input.value || '').trimEnd();
      VOICE_RUNTIME.autoSendArmed = true;
      VOICE_RUNTIME.continuousConversation = getVoiceModeEnabled();

      let transcriptCaptured = false;
      let result = null;

      if (useAndroidIntentUi){
        /* In-WebView SpeechRecognizer often never reaches onResults; Intent UI is reliable on real devices. */
        await clearNativeSpeechStateListener();
        composerListening = true;
        VOICE_RUNTIME.nativeListening = true;
        setComposerDictationState('listening');
        syncVoiceInputButton();
        showStatus('سيُفتح ميكروفون النظام — تحدّث بعد ظهور النافذة.', false);
        result = await plugin.start({
          language,
          maxResults: 1,
          prompt: getVoiceModeEnabled() ? 'ابدأ الحديث الآن' : 'تحدث الآن',
          partialResults: false,
          popup: true
        });
      }else{
        await bindNativeSpeechStateListener(plugin, language);
        result = await Promise.race([
          plugin.start({
            language,
            maxResults: 1,
            prompt: getVoiceModeEnabled() ? 'ابدأ الحديث الآن' : 'تحدث الآن',
            partialResults: false,
            popup: false
          }),
          new Promise((_, reject) => {
            window.setTimeout(() => reject(new Error('STT_TIMEOUT')), 18000);
          })
        ]);
      }

      const transcript = Array.isArray(result?.matches)
        ? result.matches.map((item) => String(item || '').trim()).filter(Boolean).join(' ')
        : '';
      if (transcript){
        transcriptCaptured = true;
        input.value = [composerDictationBase, transcript].filter(Boolean).join(composerDictationBase ? '\n' : '');
        resizeComposerInput(input);
        syncComposerMeta();
      }

      const shouldAutoSend = VOICE_RUNTIME.autoSendArmed && String(input.value || '').trim();
      VOICE_RUNTIME.autoSendArmed = false;
      if (shouldAutoSend){
        window.setTimeout(() => {
          if (String($('chatInput')?.value || '').trim()) void sendMessage();
        }, VOICE_AUTOSEND_AFTER_TRANSCRIPT_MS);
      } else if (transcriptCaptured && shouldKeepContinuousVoiceLoop()){
        scheduleVoiceConversationRestart(550);
      } else if (!transcriptCaptured && shouldKeepContinuousVoiceLoop()){
        scheduleVoiceConversationRestart(550);
      }
      return {
        success: transcriptCaptured,
        fallbackAllowed: !transcriptCaptured,
        cancelled: false
      };
    }catch(error){
      const message = String(error?.message || error || '').trim();
      const cancelled = /cancel|abort|^0$/i.test(message);
      const timedOut = /STT_TIMEOUT/i.test(message);
      if (!cancelled){
        const human = translateNativeSttError(message);
        toast(timedOut ? 'انتهت مهلة الإملاء دون نتيجة. حاول مرة أخرى.' : `تعذّر الإملاء: ${human}`);
      }
      return {
        success: false,
        fallbackAllowed: !cancelled,
        cancelled
      };
    }finally{
      VOICE_RUNTIME.autoSendArmed = false;
      VOICE_RUNTIME.nativeListening = false;
      VOICE_RUNTIME.nativeStarting = false;
      composerListening = false;
      await resetNativeSpeechSession(plugin);
      setComposerDictationState('ready');
      showStatus('', false);
      syncVoiceInputButton();
    }
  }

  async function startComposerDictation(){
    const voice = getVoiceCloudConfig();
    const preferCloudForWeb = !isNativePlatform() && voice.sttReady;

    if (isNativePlatform()){
      const nativeResult = await startNativeComposerDictationSafe();
      if (nativeResult?.success) return true;
      if (nativeResult?.fallbackAllowed && voice.sttReady && await startCloudComposerDictation()) return true;
      if (nativeResult?.cancelled) return false;
    }
    if (preferCloudForWeb && await startCloudComposerDictation()) return true;

    const Ctor = getSpeechRecognitionCtor();
    if (Ctor){
      const input = $('chatInput');
      if (!input) return false;

      composerDictationBase = String(input.value || '').trimEnd();
      VOICE_RUNTIME.autoSendArmed = true;
      VOICE_RUNTIME.continuousConversation = getVoiceModeEnabled();
      composerRecognition = new Ctor();
      composerRecognition.lang = getPreferredSpeechLanguage();
      composerRecognition.continuous = true;
      composerRecognition.interimResults = true;

      composerRecognition.onstart = () => {
        composerListening = true;
        syncVoiceInputButton();
        showStatus(`الإملاء الصوتي يعمل الآن باللغة ${composerRecognition.lang}...`, false);
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
        VOICE_RUNTIME.autoSendArmed = false;
        syncVoiceInputButton();
        if (event?.error !== 'no-speech') toast(`تعذّر الإملاء الصوتي: ${event?.error || 'unknown'}`);
      };

      composerRecognition.onend = () => {
        const shouldAutoSend = VOICE_RUNTIME.autoSendArmed && String(input.value || '').trim();
        VOICE_RUNTIME.autoSendArmed = false;
        composerListening = false;
        composerRecognition = null;
        syncVoiceInputButton();
        showStatus('', false);
        if (composerWebVoiceSendTimer){
          clearTimeout(composerWebVoiceSendTimer);
          composerWebVoiceSendTimer = 0;
        }
        if (shouldAutoSend){
          composerWebVoiceSendTimer = window.setTimeout(() => {
            composerWebVoiceSendTimer = 0;
            if (String($('chatInput')?.value || '').trim()) void sendMessage();
          }, VOICE_WEBSPEECH_END_GRACE_MS);
        } else if (shouldKeepContinuousVoiceLoop()){
          scheduleVoiceConversationRestart(550);
        }
      };

      try{
        composerRecognition.start();
        return true;
      }catch(error){
        composerListening = false;
        composerRecognition = null;
        syncVoiceInputButton();
        toast(`تعذّر بدء الإملاء الصوتي: ${error?.message || error}`);
      }
    }

    if (await startCloudComposerDictation()) return true;

    const voiceConfig = getVoiceCloudConfig();
    if (!voiceConfig.sttReady && /^android/i.test(String(navigator.userAgent || ''))){
      toast('الصوت غير متاح في هذا المتصفح المحمول لأن التعرف المحلي غير مدعوم والصوت السحابي غير مفعّل لهذا الحساب أو على الخادم.');
    } else {
      toast('الإملاء الصوتي غير مدعوم في هذا المتصفح.');
    }
    return false;
  }

  function toggleComposerDictation(){
    VOICE_RUNTIME.continuousConversation = getVoiceModeEnabled();
    if (composerListening) void stopComposerDictation(true);
    else void startComposerDictation();
  }

  async function toggleVoiceMode(){
    const next = !getVoiceModeEnabled();
    setVoiceModeEnabled(next);
    VOICE_RUNTIME.continuousConversation = next;
    refreshVoiceModeButton();
    if (!next){
      VOICE_RUNTIME.autoSendArmed = false;
      await stopComposerDictation(false);
      await stopVoicePlayback();
      toast('تم إيقاف الدردشة الصوتية');
      return;
    }

    toast('تم تفعيل الدردشة الصوتية المستمرة');
    const started = await startComposerDictation();
    if (!started && shouldKeepContinuousVoiceLoop()){
      scheduleVoiceConversationRestart(600);
    }
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
    const descriptor = getModelDescriptor(value, value.split('/')[0] || '');
    const label = String(descriptor?.name || descriptor?.id || value).trim() || value;
    return label.length > 34 ? `${label.slice(0, 34)}…` : label;
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
      analysis_ar: 'حلّل هذا الملف أو المحتوى تحليلاً عميقًا. أريد: 1) الملخص التنفيذي 2) النقاط الرئيسية 3) التوصيات الفورية 4) المخاطر أو الفجوات 5) الخطوات التالية المقترحة.',
      report_ar: 'اكتب تقريرًا احترافيًا جاهزًا للتسليم. يشمل: صفحة العنوان، الملخص التنفيذي، المحتوى التفصيلي، الجداول والإحصائيات إن وجدت، والخلاصة مع التوصيات.',
      system_audit: 'قم بمراجعة تشغيلية للنظام أو التطبيق الحالي. أريد: المشاكل، الأولويات، المخاطر، الإصلاحات السريعة، وخطة تحسين احترافية.',
      build_product: 'ساعدني في بناء منتج احترافي من هذه الفكرة. أريد: التموضع، البنية، تدفقات الاستخدام، خارطة الطريق، ومواصفات الإصدار الأول.',
      exec_summary: 'اكتب ملخصًا تنفيذيًا واضحًا وموجزًا مع النقاط الحاسمة والقرار المقترح.',
      action_board: 'حوّل هذا السياق إلى لوحة تنفيذ: المهمة، المالك، الأولوية، الموعد، الحالة، والخطوة التالية.',
      kb_orchestrator: 'استخدم الملفات وقاعدة المعرفة لبناء إجابة موثقة باقتباسات واضحة، ثم لخص الفجوات والمعلومات غير المؤكدة.',
      launch_plan: 'أنشئ خطة إطلاق متكاملة: الجاهزية، الأصول المطلوبة، المخاطر، الجدول الزمني، المسؤوليات، ومؤشرات النجاح.',
      pm_review: 'قم بدور خبير استراتيجية منتج وراجع الفكرة أو التطبيق: القيمة، تجربة الاستخدام، الفجوات، عناصر التميز، ثم توصية تنفيذية.',
      task_exec_honest: 'اعمل كمساعد تنفيذ داخل المحادثة فقط (ليس وكيلًا يتحكم بمتصفحي أو جهازي). المطلوب: 1) لخص المهمة في سطر واحد. 2) اذكر صراحة ما يمكن إنجازه هنا الآن (نص، مرفقات، قاعدة المعرفة، توليد ملفات للتنزيل) وما يتطلب خطوة خارجية (تصفح حقيقي، تسجيل دخول خارجي، أتمتة نظام). 3) نفّذ فورًا أول خطوة الممكنة داخل المحادثة وقدّم مخرجات قابلة للنسخ.'
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

  function buildPromptEngineeringInput(originalText){
    const raw = String(originalText || '').trim();
    if (!raw) return { text: raw, transformed: false };
    if (!getPromptEngineeringMode()) return { text: raw, transformed: false };
    if (raw.length < 8) return { text: raw, transformed: false };
    const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const objective = lines[0] || raw;
    const context = lines.slice(1, 3);
    const constraints = lines.filter((line) => /(?:يجب|بدون|لا |ممنوع|within|deadline|حد|قيود)/i.test(line)).slice(0, 4);
    const deliverable = lines.find((line) => /(?:مطلوب|deliver|output|نتيجة|صيغة|format)/i.test(line)) || '';
    const engineered = [
      'مهمة المستخدم (محسّنة للصياغة):',
      `- الهدف الأساسي: ${objective}`,
      context.length ? `- سياق إضافي: ${context.join(' | ')}` : '',
      constraints.length ? `- قيود يجب الالتزام بها: ${constraints.join(' | ')}` : '',
      deliverable ? `- المخرج المتوقع: ${deliverable}` : '',
      '',
      'تعليمات التنفيذ:',
      '1) افهم المقصود دون تغيير النية الأصلية.',
      '2) نفّذ المطلوب بصياغة واضحة ومهنية.',
      '3) رتّب الإجابة بعناوين وخطوات عملية مختصرة.',
      '',
      `النص الأصلي للمستخدم:\n${raw}`
    ].filter(Boolean).join('\n');
    return { text: engineered, transformed: engineered !== raw };
  }

  function resizeComposerInput(input = $('chatInput')){
    if (!input) return;
    if (input.tagName === 'TEXTAREA'){
      const compact = typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 980px), (pointer: coarse)').matches;
      const minH = compact ? 38 : 44;
      const value = String(input.value || '');
      // Compact default: keep one-line height when empty/short. Grow only when needed.
      const shouldStayCompact = !value.trim() || (!value.includes('\n') && value.length < 120);
      input.style.height = 'auto';
      if (shouldStayCompact){
        input.style.height = `${minH}px`;
      } else {
        input.style.height = `${Math.min(220, Math.max(minH, input.scrollHeight))}px`;
      }
    }
    scheduleShellLayoutRefresh();
  }

  function setComposerMode(mode){
    const input = $('chatInput');
    if (!input) return;
    const next = mode === 'multi' ? 'multi' : 'single';
    try{ localStorage.setItem('aistudio_composer_mode_v1', next); }catch(_){}
    document.body.classList.toggle('composer-multi', next === 'multi');
    input.dataset.mode = next;
    input.setAttribute('rows', next === 'multi' ? '2' : '1');
    input.setAttribute('placeholder',
      next === 'multi'
        ? 'اكتب رسالتك… (Ctrl+Enter للإرسال)'
        : 'رسالتك أو سؤالك… (Enter للإرسال، Shift+Enter لسطر جديد)'
    );
    resizeComposerInput(input);
    syncComposerMeta();
    try{
      $('chatInputSingleBtn')?.classList.toggle('active', next === 'single');
      $('chatInputMultiBtn')?.classList.toggle('active', next === 'multi');
    }catch(_){}
  }

  function getComposerMode(){
    try{
      const v = String(localStorage.getItem('aistudio_composer_mode_v1') || '').trim();
      if (v === 'multi' || v === 'single') return v;
    }catch(_){}
    return 'single';
  }

  function syncComposerRtlOrder(){
    const chatbar = document.querySelector('#page-chat .chatbar');
    if (!chatbar) return;
    const voiceBtn = $('voiceInputBtn');
    const sendBtn = $('sendBtn');
    const stopBtn = $('stopBtn');
    const regenBtn = $('regenBtn');
    const cluster = $('chatComposerCluster');
    const attachBtn = $('chatAttachBtn');
    const input = $('chatInput');
    if (!cluster || !attachBtn || !input) return;

    if (attachBtn.parentElement !== cluster) cluster.prepend(attachBtn);
    if (input.parentElement !== cluster) cluster.appendChild(input);
    if (cluster.parentElement !== chatbar) chatbar.prepend(cluster);

    /* RTL visual order from right: send/stop -> voice -> input cluster -> regenerate. */
    if (voiceBtn && voiceBtn.parentElement !== chatbar) chatbar.appendChild(voiceBtn);
    if (sendBtn && sendBtn.parentElement !== chatbar) chatbar.appendChild(sendBtn);
    if (sendBtn) chatbar.prepend(sendBtn);
    if (stopBtn && stopBtn.parentElement !== chatbar) chatbar.appendChild(stopBtn);
    if (stopBtn && sendBtn && sendBtn.parentElement === chatbar) chatbar.insertBefore(stopBtn, sendBtn.nextSibling);
    if (voiceBtn && voiceBtn.parentElement === chatbar) chatbar.insertBefore(voiceBtn, cluster);
    if (regenBtn && regenBtn.parentElement !== chatbar) chatbar.appendChild(regenBtn);
    if (regenBtn) chatbar.appendChild(regenBtn);
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
    // Keep Android auth feedback inside the in-app UI (no native alert popups).
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
    if (/AUTH_ADMIN_PASSWORD_NOT_CONFIGURED|Admin password login is not configured/i.test(raw)){
      return 'دخول الإدارة بكلمة المرور غير متاح حاليًا. استخدم تسجيل Google ببريد الإدارة نفسه أو تواصل مع الدعم.';
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

  function isLikelyNativeAppContext(){
    if (isNativePlatform()) return true;
    try{
      const current = new URL(window.location.href);
      const host = String(current.hostname || '').toLowerCase();
      const protocol = String(current.protocol || '').toLowerCase();
      const agent = String(navigator.userAgent || '').toLowerCase();
      const localhostLike = host === 'localhost' || /^127\./.test(host);
      if ((protocol === 'capacitor:' || localhostLike) && /android|wv|version\/\d+\.\d+.*chrome/i.test(agent)){
        return true;
      }
    }catch(_){}
    return false;
  }

  function isNativeAndroidPlatform(){
    return isNativePlatform() && getCapacitorPlatform() === 'android';
  }

  function getCapacitorPluginProxy(name, { nativeOnly = false } = {}){
    const key = String(name || '').trim();
    if (!key) return null;
    if (nativeOnly && !isNativePlatform()) return null;
    try{
      const direct = window.Capacitor?.Plugins?.[key];
      if (direct) return direct;
    }catch(_){}
    try{
      if (!CAPACITOR_PLUGIN_CACHE[key] && typeof window.Capacitor?.registerPlugin === 'function'){
        CAPACITOR_PLUGIN_CACHE[key] = window.Capacitor.registerPlugin(key);
      }
      return CAPACITOR_PLUGIN_CACHE[key] || null;
    }catch(_){
      return null;
    }
  }

  function getNativeGoogleAuthPlugin(){
    return isNativeAndroidPlatform() ? getCapacitorPluginProxy('GoogleOneTapAuth', { nativeOnly:true }) : null;
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
      setAuthGateStatus('جارٍ فتح تسجيل Google عبر المتصفح ثم العودة إلى التطبيق...', 'busy');
      await openGoogleAuthInBrowser();
    }catch(error){
      setAuthGateStatus(`تعذر فتح تسجيل Google على Android: ${error?.message || error}`, 'error');
    }
  }

  async function renderNativeGoogleButton(slot){
    slot.innerHTML = `
      <div class="native-google-auth">
        <button class="native-google-btn" type="button" id="nativeGoogleSignInBtn">
          <span class="native-google-mark" aria-hidden="true">G</span>
          <span>المتابعة باستخدام Google عبر المتصفح</span>
        </button>
        <div class="hint">سيتم فتح متصفح الجهاز لتسجيل الدخول ثم العودة إلى التطبيق تلقائيًا.</div>
      </div>`;
    $('nativeGoogleSignInBtn')?.addEventListener('click', startNativeGoogleButtonFlow);
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
        <div class="auth-gate auth-gate--v2" id="authGate">
          <div class="auth-shell">
            <section class="auth-hero">
              <div class="brand-identity">
                <div class="brand-mark">${getBrandMarkHtml()}</div>
                <div class="brand-copy">
                  <div class="name">AI Workspace Studio</div>
                  <div class="sub">دردشة، ملفات، ومشاريع في مساحة واحدة</div>
                </div>
              </div>
              <h1 class="auth-title">تسجيل الدخول</h1>
              <p class="auth-copy">واجهة دخول موحّدة: حساب عادي أو إدارة من نفس الشاشة.</p>
            </section>
            <section class="auth-card">
              <div class="auth-form-head">
                <div class="auth-form-head-copy">
                  <h2>متابعة الحساب</h2>
                  <p>أدخل البريد والاسم، وسيتم اختيار المسار الصحيح تلقائيًا.</p>
                </div>
                <span class="plan-pill" id="authCurrentPlanPill">الخطة المجانية</span>
              </div>
              <div class="auth-path-pills" aria-label="مسارات الدخول">
                <span class="auth-path-pill">حساب عادي</span>
                <span class="auth-path-pill">Google</span>
                <span class="auth-path-pill">إدارة (عند الحاجة)</span>
              </div>
              <div class="auth-status status" id="authGateStatus" data-tone="info">جاهز للدخول.</div>
              <form id="authEntryForm" autocomplete="on" onsubmit="return false" style="margin-top:12px">
              <div class="auth-config-grid">
                <div>
                  <label class="hint" for="authEntryName">الاسم</label>
                  <input id="authEntryName" name="name" type="text" placeholder="الاسم الظاهر" autocomplete="name" />
                </div>
                <div>
                  <label class="hint" for="authEntryEmail">البريد الإلكتروني</label>
                  <input id="authEntryEmail" name="email" type="email" placeholder="name@example.com" autocomplete="email" />
                </div>
                <div style="grid-column:1/-1">
                  <label class="hint" for="authEntryPassword" id="authEntryPasswordLabel">كلمة المرور (إدارة)</label>
                  <input id="authEntryPassword" name="password" type="password" placeholder="للبريد الإداري فقط" autocomplete="current-password" />
                </div>
              </div>
              <div class="auth-note" id="authEntryModeHint">يتم تحديد نوع الدخول تلقائيًا من البريد.</div>
              <div class="account-actions" style="margin-top:12px">
                <button class="btn dark sm with-label" type="submit" id="authEntrySubmitBtn"><span class="icon">→</span><span class="label" id="authEntrySubmitLabel">متابعة بالخطة المجانية</span></button>
              </div>
              </form>
              <div class="divider"></div>
              <div class="auth-google-slot" id="googleSignInSlot"></div>
              <div class="auth-note" id="authGatePlanNote">ستُربط جلستك ومشاريعك بهذا الحساب بعد الدخول.</div>
              <div class="account-actions">
                <button class="btn ghost sm with-label" type="button" id="authRetryBtn"><span class="icon">↻</span><span class="label">إعادة التهيئة</span></button>
                <button class="btn ghost sm with-label" type="button" id="authCloseBtn"><span class="icon">✕</span><span class="label">إغلاق</span></button>
              </div>
            </section>
          </div>
        </div>`);
    }

    const authGoogleSlot = $('googleSignInSlot');
    if (authGoogleSlot && !$('authRememberToggle')){
      authGoogleSlot.insertAdjacentHTML('beforebegin', `
        <label class="auth-inline-check">
          <input id="authRememberToggle" type="checkbox" />
          <span>حفظ بيانات الدخول على هذا الجهاز</span>
        </label>`);
    }
    if (authGoogleSlot && !$('authGoogleBrowserBtn')){
      authGoogleSlot.insertAdjacentHTML('afterend', `
        <div class="auth-browser-actions" id="authBrowserActions">
          <button class="btn ghost sm with-label" type="button" id="authGoogleBrowserBtn">
            <span class="icon">🌐</span>
            <span class="label">متابعة Google في المتصفح</span>
          </button>
          <span class="hint" id="authBrowserHint">يفتح تسجيل Google في متصفح الجهاز ثم يعيد الجلسة إلى التطبيق أو الويب.</span>
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
    refineAuthGateLayout();
  }

  function refineAuthGateLayout(){
    const gate = $('authGate');
    if (!gate || gate.dataset.cleaned === '1') return;
    gate.dataset.cleaned = '1';
    const heroCopy = gate.querySelector('.auth-copy');
    if (heroCopy) heroCopy.textContent = 'دخول موحد للحساب العادي والإدارة من نفس الشاشة.';
    gate.querySelector('.auth-feature-grid')?.remove();
    gate.querySelector('.auth-plan-row')?.remove();
    gate.querySelector('.auth-access-note')?.remove();
    gate.querySelector('.auth-kicker')?.remove();
    gate.querySelector('.auth-developer')?.remove();
    const formCopy = gate.querySelector('.auth-form-head-copy p');
    if (formCopy) formCopy.textContent = 'يتم اختيار مسار الدخول تلقائيًا حسب البريد.';
    const planNote = $('authGatePlanNote');
    if (planNote) planNote.textContent = 'تُربط المشاريع والمحادثات بالحساب بعد الدخول.';
    const modeHint = $('authEntryModeHint');
    if (modeHint) modeHint.textContent = 'يتم اختيار نوع الدخول تلقائيًا من البريد.';
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
    if ($('accountTriggerName')) $('accountTriggerName').textContent = displayName;
    if ($('accountTriggerPlan')) $('accountTriggerPlan').textContent = planLabel;

    if ($('settingsAccountAvatar')) $('settingsAccountAvatar').src = avatar;
    if ($('settingsAccountName')) $('settingsAccountName').textContent = signedIn ? displayName : 'الحساب غير مسجل';
    if ($('settingsAccountEmail')) $('settingsAccountEmail').textContent = displayEmail;
    if ($('settingsAccountHint')) $('settingsAccountHint').textContent = signedIn
      ? (role === 'admin'
        ? 'هذا الحساب يملك صلاحيات كاملة للمزايا المدفوعة وأدوات الإدارة عند الحاجة.'
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
        ? 'صلاحيات كاملة مفعّلة. يمكنك إدارة أكواد الترقية والمزايا المدفوعة من نفس الواجهة عند الحاجة.'
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
      ? 'تم تفعيل الصلاحيات الكاملة والمزايا المدفوعة لهذا الحساب.'
      : plan === 'premium'
      ? 'الحساب الحالي مدفوع. يمكنك إغلاق هذه الشاشة أو إعادة المصادقة إذا لزم.'
      : 'بعد تسجيل الدخول ستبدأ بالخطة المجانية. للترقية اطلب كودًا ثم فعّله من صفحة الإعدادات.';
    if ($('authCurrentPlanPill')){
      $('authCurrentPlanPill').textContent = role === 'admin'
        ? 'صلاحيات كاملة'
        : plan === 'premium'
        ? 'الخطة المدفوعة'
        : 'الخطة المجانية';
      $('authCurrentPlanPill').classList.toggle('premium', role === 'admin' || plan === 'premium');
    }

    if ($('sideAccountName')) $('sideAccountName').textContent = signedIn ? (auth.name || auth.email || 'الحساب') : 'تسجيل الدخول';
    if ($('sideAccountPlan')) $('sideAccountPlan').textContent = signedIn ? (role === 'admin' ? 'صلاحيات كاملة' : planLabel) : 'غير مسجل';
    if ($('sideAccountAvatar')){
      const av = $('sideAccountAvatar');
      const n = signedIn ? (auth.name || auth.email || '') : '';
      av.textContent = n ? n.charAt(0).toUpperCase() : '؟';
      if (signedIn && auth.picture){ av.innerHTML = `<img src="${auth.picture}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`; }
    }
    if ($('sideAccountBadge')){
      const isBadgePremium = role === 'admin' || plan === 'premium';
      $('sideAccountBadge').textContent = role === 'admin' ? 'مدير' : (plan === 'premium' ? 'مدفوع' : 'مجاني');
      $('sideAccountBadge').classList.toggle('free', !isBadgePremium);
      $('sideAccountBadge').classList.toggle('premium', isBadgePremium);
    }
    if ($('sideAccountStrip') && !$('sideAccountStrip').dataset.bound){
      $('sideAccountStrip').dataset.bound = '1';
      $('sideAccountStrip').addEventListener('click', () => { $('closeSideBtn')?.click(); openAccountCenter(); });
      $('sideAccountStrip').addEventListener('keydown', e => { if(e.key==='Enter'||e.key===' '){ $('closeSideBtn')?.click(); openAccountCenter(); }});
    }

    renderUsageIndicators(settings);
    const remembered = getRememberedAuthEntry();
    if ($('authRememberToggle')) $('authRememberToggle').checked = remembered.remember;
    if ($('authBrowserActions')) $('authBrowserActions').style.display = isNativePlatform() ? 'none' : 'flex';
    if ($('authBrowserHint')) $('authBrowserHint').textContent = isNativePlatform()
      ? 'يفتح تسجيل Google في متصفح الجهاز ثم يعيد الجلسة إلى التطبيق مباشرة.'
      : 'يفتح تسجيل Google في المتصفح ثم يعيدك إلى نسخة الويب مباشرة.';
    if ($('authEntryName') && !String($('authEntryName').value || '').trim()) $('authEntryName').value = remembered.name || '';
    if ($('authEntryEmail') && !String($('authEntryEmail').value || '').trim()) $('authEntryEmail').value = remembered.email || '';
    if ($('authEntryPassword') && remembered.remember && !String($('authEntryPassword').value || '').trim()) $('authEntryPassword').value = remembered.password || '';
    syncUnifiedAuthEntry();
    syncAccountPlanControls();
  }

function syncUnifiedAuthEntry(){
    const config = getEffectiveAuthConfig();
    const email = String($('authEntryEmail')?.value || '').trim().toLowerCase();
    const isAdminEntry = !!email && email === String(config.adminEmail || DEFAULT_AUTH_CONFIG.adminEmail).trim().toLowerCase();
    const adminPasswordEnabled = config.adminPasswordEnabled === true;
    const adminLoginMethod = String(config.adminLoginMethod || '').trim().toLowerCase();
    const healthPasswordReady = AUTH_RUNTIME.authHealth?.admin_password_ready === true;
    const adminGoogleReady = !!getAuthGoogleClientId();
    // Web regression guard: the admin password input must remain visible on the official web app
    // even when admin is currently "google_only" (so admins can see the option/state clearly).
    const webForceAdminPasswordVisible = isAdminEntry && !isNativePlatform() && isManagedHostedRuntime();
    const showPassword = isAdminEntry && (
      webForceAdminPasswordVisible
      || adminPasswordEnabled
      || adminLoginMethod === 'password_or_google'
      || adminLoginMethod === 'password_only'
      || healthPasswordReady
    );
    const adminGoogleOnly = isAdminEntry && !showPassword && adminGoogleReady;
    const label = $('authEntrySubmitLabel');
    const hint = $('authEntryModeHint');
    const passwordLabel = $('authEntryPasswordLabel');
    const passwordInput = $('authEntryPassword');
    const passwordWrap = passwordInput?.closest('div[style*="grid-column"]') || passwordInput?.parentElement;
    if (label) label.textContent = isAdminEntry
      ? (adminGoogleOnly ? 'متابعة الإدارة عبر Google' : 'دخول الإدارة')
      : 'متابعة بالخطة المجانية';
    if (hint) hint.textContent = isAdminEntry
      ? (adminGoogleOnly
        ? 'تم التعرف على بريد الإدارة. يمكنك المتابعة عبر Google، أو تجربة كلمة المرور إذا تم تفعيلها على الخادم.'
        : 'تم التعرف على بريد الإدارة. أدخل كلمة المرور لفتح الحساب الإداري، ويمكنك أيضًا استخدام Google بنفس البريد.')
      : 'أي بريد شخصي صالح يفتح لك الخطة المجانية فورًا، ويمكنك طلب الترقية لاحقًا من داخل التطبيق.';
    if ($('authCurrentPlanPill')){
      $('authCurrentPlanPill').textContent = isAdminEntry ? 'الإدارة' : 'الخطة المجانية';
      $('authCurrentPlanPill').classList.toggle('premium', isAdminEntry);
    }
    if (passwordLabel) passwordLabel.textContent = isAdminEntry
      ? (adminGoogleOnly ? 'كلمة مرور الإدارة أو Google' : 'كلمة مرور الإدارة')
      : 'كلمة المرور للإدارة فقط';
    if (passwordInput){
      passwordInput.placeholder = isAdminEntry
        ? (adminGoogleOnly ? 'اتركها فارغة لاستخدام Google أو أدخل كلمة المرور' : 'أدخل كلمة مرور الإدارة')
        : 'اختيارية للمستخدم العادي، ومطلوبة فقط إذا كان هذا بريد الإدارة';
      passwordInput.disabled = !showPassword;
      if (!showPassword) passwordInput.value = '';
    }
    if (passwordWrap) passwordWrap.style.display = showPassword ? '' : 'none';
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
      const prevClientId = window._gsiClientId;
      if (!window._gsiInitialized || prevClientId !== clientId){
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleGoogleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: false,
          context: 'signin',
          use_fedcm_for_prompt: true
        });
        window._gsiInitialized = true;
        window._gsiClientId = clientId;
      }
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
      setTimeout(() => {
        if (slot && !slot.querySelector('iframe') && !slot.querySelector('div[data-idom-class]')){
          slot.innerHTML = `<div class="hint" style="display:flex;align-items:center;gap:8px;padding:8px 0">
            <span style="font-size:18px">🔒</span>
            <span>تسجيل الدخول بـ Google متاح على الموقع الرسمي: <a href="https://app.saddamalkadi.com" target="_blank" rel="noopener" style="color:#1b66ff;font-weight:600">app.saddamalkadi.com</a></span>
          </div>`;
        }
      }, 2000);
    }catch(error){
      slot.innerHTML = '<div class="hint">تعذر تهيئة زر تسجيل الدخول حاليًا.</div>';
      setAuthGateStatus(`تعذر تهيئة Google Sign-In: ${error?.message || error}`, 'error');
    }
  }

  function getCapacitorBrowserPlugin(){
    return getCapacitorPluginProxy('Browser');
  }

  function getCapacitorAppPlugin(){
    return getCapacitorPluginProxy('App');
  }

  function normalizeAuthPayload(payload){
    const sessionToken = String(payload?.sessionToken || payload?.session_token || '').trim();
    if (!sessionToken) return null;
    return {
      email: String(payload?.email || '').trim().toLowerCase(),
      name: String(payload?.name || '').trim(),
      picture: String(payload?.picture || '').trim(),
      plan: String(payload?.plan || 'free').trim(),
      role: String(payload?.role || 'user').trim(),
      sessionToken,
      sessionExp: Number(payload?.sessionExp || payload?.session_exp || 0)
    };
  }

  function extractAuthPayloadFromParams(params){
    return normalizeAuthPayload({
      email: params.get('email') || '',
      name: params.get('name') || '',
      picture: params.get('picture') || '',
      plan: params.get('plan') || 'free',
      role: params.get('role') || 'user',
      sessionToken: params.get('sessionToken') || params.get('session_token') || '',
      sessionExp: params.get('sessionExp') || params.get('session_exp') || 0
    });
  }

  async function consumeAuthPayload(payload, extra = {}){
    const normalized = normalizeAuthPayload(payload);
    if (!normalized) return false;
    const targetPage = normalizeTargetPage(extra.targetPage || normalized.targetPage || payload?.targetPage || payload?.target_page) || DEFAULT_POST_LOGIN_PAGE;
    applyAuthResponse(normalized, { upgradeCode: extra.upgradeCode || getAuthState().upgradeCode || '' });
    syncAccountUi();
    refreshModeButtons();
    renderSettings();
    await hydrateCloudState(true).catch(() => null);
    refreshStrategicWorkspace().catch(() => {});
    openWorkspacePage(targetPage);
    closeAuthGate(true);
    setAuthGateStatus('', 'info');
    try{ await getCapacitorBrowserPlugin()?.close?.(); }catch(_){}
    toast('✅ تم تسجيل الدخول عبر Google');
    return true;
  }

  async function consumeAuthRedirectFromUrl(rawUrl){
    try{
      const url = new URL(String(rawUrl || '').trim());
      const searchParams = new URLSearchParams(url.search || '');
      if (await consumeAuthRedirectParams(searchParams)) return true;
      const hash = String(url.hash || '').replace(/^#/, '');
      if (hash && await consumeAuthRedirectParams(new URLSearchParams(hash))) return true;
    }catch(_){}
    return false;
  }

  function consumeAuthBridgeStorage(){
    try{
      const raw = localStorage.getItem(BROWSER_AUTH_BRIDGE.storageKey);
      if (!raw) return Promise.resolve(false);
      localStorage.removeItem(BROWSER_AUTH_BRIDGE.storageKey);
      return consumeAuthPayload(JSON.parse(raw), { upgradeCode: getAuthState().upgradeCode || '' });
    }catch(_){
      try{ localStorage.removeItem(BROWSER_AUTH_BRIDGE.storageKey); }catch(__){}
      return Promise.resolve(false);
    }
  }

  async function consumeAuthBridgeLaunchUrl(){
    if (!isNativePlatform()) return false;
    const appPlugin = getCapacitorAppPlugin();
    if (!appPlugin?.getLaunchUrl) return false;
    try{
      const launch = await appPlugin.getLaunchUrl();
      if (!launch?.url) return false;
      return await consumeAuthRedirectFromUrl(launch.url);
    }catch(_){
      return false;
    }
  }

  async function consumeAuthRedirectParams(params){
    return consumeAuthPayload(extractAuthPayloadFromParams(params), {
      upgradeCode: getAuthState().upgradeCode || '',
      targetPage: normalizeTargetPage(params.get('target_page') || params.get('targetPage') || '')
    });
  }

  async function consumeAuthRedirectFromLocation(){
    const searchConsumed = await consumeAuthRedirectParams(new URLSearchParams(window.location.search || ''));
    if (searchConsumed){
      history.replaceState({}, document.title, window.location.pathname);
      return true;
    }
    const hash = String(window.location.hash || '').replace(/^#/, '');
    if (!hash) return false;
    const consumed = await consumeAuthRedirectParams(new URLSearchParams(hash));
    if (consumed){
      history.replaceState({}, document.title, window.location.href.split('#')[0]);
    }
    return consumed;
  }

  function installBrowserAuthBridgeListeners(){
    if (window.__AI_STUDIO_AUTH_BRIDGE__) return;
    window.__AI_STUDIO_AUTH_BRIDGE__ = true;
    window.addEventListener('hashchange', () => { consumeAuthRedirectFromLocation().catch(() => {}); });
    const syncBridgeFromForeground = () => {
      consumeAuthRedirectFromLocation().catch(() => {});
      consumeAuthBridgeStorage().catch(() => {});
      consumeAuthBridgeLaunchUrl().catch(() => {});
    };
    window.addEventListener('focus', syncBridgeFromForeground);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') syncBridgeFromForeground();
    });
    window.addEventListener('storage', (event) => {
      if (event.key === BROWSER_AUTH_BRIDGE.storageKey && event.newValue){
        consumeAuthBridgeStorage().catch(() => {});
      }
    });
    window.addEventListener('message', (event) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data || {};
      if (data?.type !== 'aistudio-auth' || !data?.payload) return;
      consumeAuthPayload(data.payload, { upgradeCode: getAuthState().upgradeCode || '' }).catch(() => {});
    });
    syncBridgeFromForeground();
    const appPlugin = getCapacitorAppPlugin();
    const browserPlugin = getCapacitorBrowserPlugin();
    if (appPlugin?.addListener){
      appPlugin.addListener('appUrlOpen', ({ url }) => {
        consumeAuthRedirectFromUrl(url).catch(() => {});
      });
      appPlugin.addListener('resume', () => {
        syncBridgeFromForeground();
      });
      appPlugin.addListener('appStateChange', (state) => {
        if (state?.isActive) syncBridgeFromForeground();
      });
    }
    if (browserPlugin?.addListener){
      browserPlugin.addListener('browserFinished', () => {
        syncBridgeFromForeground();
      });
    }
    window.addEventListener('beforeunload', () => {
      syncCloudNow('beforeunload').catch(() => {});
      stopVoicePlayback();
    });
  }

  function getPublicWebAppBaseUrl(){
    if (isLikelyNativeAppContext()) return BROWSER_AUTH_BRIDGE.publicBaseUrl;
    try{
      const current = new URL(window.location.href);
      if (/^https?:$/i.test(current.protocol) && !/^localhost$/i.test(current.hostname) && !/^127\./.test(current.hostname)){
        return `${current.origin}${current.pathname.replace(/[^/]*$/, '')}`;
      }
    }catch(_){}
    return BROWSER_AUTH_BRIDGE.publicBaseUrl;
  }

  function getBrowserAuthReturnUrl(){
    if (isLikelyNativeAppContext()) return BROWSER_AUTH_BRIDGE.appReturnUrl;
    return window.location.href.split('#')[0];
  }

  function buildBrowserGoogleAuthUrl(){
    const workerRoot = getAuthServiceRoot(getSettings());
    if (!workerRoot) throw new Error('رابط البوابة غير مضبوط لتسجيل Google.');
    const base = getPublicWebAppBaseUrl();
    const url = new URL(BROWSER_AUTH_BRIDGE.webPath, base);
    const nativeReturn = isLikelyNativeAppContext();
    const targetPage = DEFAULT_POST_LOGIN_PAGE;
    url.searchParams.set('worker', workerRoot);
    url.searchParams.set('return_to', getBrowserAuthReturnUrl());
    url.searchParams.set('target_page', targetPage);
    url.searchParams.set('gateway', getSettings().gatewayUrl || '');
    url.searchParams.set('app', 'AI Workspace Studio');
    if (nativeReturn) url.searchParams.set('native_return', '1');
    url.searchParams.set('ts', String(Date.now()));
    return url.toString();
  }

  async function openGoogleAuthInBrowser(){
    try{
      const url = buildBrowserGoogleAuthUrl();
      const browser = getCapacitorBrowserPlugin();
      if (isLikelyNativeAppContext() && browser?.open){
        setAuthGateStatus('جارٍ فتح تسجيل Google في متصفح الجهاز...', 'busy');
        await browser.open({
          url,
          toolbarColor: '#1f6bff'
        });
      } else {
        setAuthGateStatus('جارٍ فتح تسجيل Google في نافذة منبثقة...', 'busy');
        const pw = 520, ph = 640;
        const pl = Math.max(0, Math.round(((screen.width || 1024) - pw) / 2));
        const pt = Math.max(0, Math.round(((screen.height || 768) - ph) / 2));
        const popup = window.open(url, 'ai-auth-bridge', `width=${pw},height=${ph},left=${pl},top=${pt},popup=1,resizable=yes,scrollbars=yes`);
        if (!popup || popup.closed) {
          setAuthGateStatus('جارٍ فتح تسجيل Google في نفس الصفحة...', 'busy');
          window.location.assign(url);
        }
      }
    }catch(error){
      setAuthGateStatus(`تعذّر فتح تسجيل Google في المتصفح: ${error?.message || error}`, 'error');
    }
  }

  function openAuthGate(message = '', { force = false } = {}){
    if (!force && getAccountRuntimeState().authRequired !== true) return;
    ensureAccountChrome();
    $('authGate')?.classList.add('show');
    setAuthGateStatus('جارٍ تحميل خيارات تسجيل الدخول...', 'busy');
    syncUnifiedAuthEntry();
    if ($('authCloseBtn')) $('authCloseBtn').style.display = (hasValidAuthSession() || !getAccountRuntimeState().authRequired) ? '' : 'none';
    loadRemoteAuthConfig(true).then(() => {
      syncUnifiedAuthEntry();
      syncAccountPlanControls();
      setAuthGateStatus(message || 'سجّل الدخول ببريدك الشخصي لفتح الخطة المجانية، أو استخدم بريد الإدارة مع كلمة المرور من نفس الشاشة.', 'info');
      return renderGoogleButton(true);
    }).catch((error) => {
      setAuthGateStatus(`تعذر تهيئة تسجيل الدخول: ${error?.message || error}`, 'error');
      return renderGoogleButton(true).catch(() => null);
    }).catch(() => null);
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
      const remember = !!$('authRememberToggle')?.checked;
      if (remember){
        saveRememberedAuthEntry({
          remember: true,
          name: String(payload?.name || $('authEntryName')?.value || '').trim(),
          email: String(payload?.email || $('authEntryEmail')?.value || '').trim(),
          password: ''
        });
      } else {
        clearRememberedAuthEntry();
      }
      syncAccountUi();
      refreshModeButtons();
      renderSettings();
      await hydrateCloudState(true).catch(() => null);
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
    let isAdminEntry = false;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
      setAuthGateStatus('أدخل بريدًا إلكترونيًا صالحًا أولًا.', 'error');
      return;
    }
    try{
      const config = await loadRemoteAuthConfig(true).catch(() => getEffectiveAuthConfig());
      const adminEmail = String(config.adminEmail || DEFAULT_AUTH_CONFIG.adminEmail).trim().toLowerCase();
      isAdminEntry = !!email && email === adminEmail;
      const adminPasswordEnabled = config.adminPasswordEnabled === true;
      const adminLoginMethod = String(config.adminLoginMethod || '').trim().toLowerCase();
      const adminAllowsPassword = adminPasswordEnabled
        || adminLoginMethod === 'password_or_google'
        || adminLoginMethod === 'password_only';
      const adminGoogleReady = !!String(config.googleClientId || '').trim();
      let payload = null;
      if (isAdminEntry){
        if (!adminAllowsPassword && adminGoogleReady){
          setAuthGateStatus('هذا هو بريد الإدارة. جارٍ فتح شاشة Google الوسيطة لهذا الحساب...', 'busy');
          await openGoogleAuthInBrowser();
          return;
        }
        if (!password){
          if (adminGoogleReady){
            setAuthGateStatus('هذا هو بريد الإدارة. أدخل كلمة المرور أو استخدم Google من نفس الشاشة.', 'error');
          } else {
            setAuthGateStatus('هذا هو بريد الإدارة. أدخل كلمة المرور للمتابعة.', 'error');
          }
          return;
        }
        setAuthGateStatus('جارٍ التحقق من حساب الإدارة...', 'busy');
        try{
          payload = await fetchAuthJson('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
          });
        }catch(error){
          const message = String(error?.message || error || '').trim();
          if (/AUTH_ADMIN_PASSWORD_NOT_CONFIGURED|Admin password login is not configured/i.test(message) && adminGoogleReady){
            setAuthGateStatus('الخادم يطلب استخدام Google لهذا الحساب الإداري حاليًا. جارٍ فتح الشاشة الوسيطة...', 'busy');
            await openGoogleAuthInBrowser();
            return;
          }
          throw error;
        }
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
      const remember = !!$('authRememberToggle')?.checked;
      if (remember){
        saveRememberedAuthEntry({
          remember: true,
          name,
          email,
          password: isAdminEntry ? password : ''
        });
      } else {
        clearRememberedAuthEntry();
      }
      syncAccountUi();
      refreshModeButtons();
      renderSettings();
      await hydrateCloudState(true).catch(() => null);
      refreshStrategicWorkspace().catch(()=>{});
      closeAuthGate(true);
      if ($('authEntryPassword')) $('authEntryPassword').value = '';
      toast(isAdminEntry ? '✅ تم تسجيل الدخول الإداري' : '✅ تم فتح الخطة المجانية بنجاح');
    }catch(error){
      const message = explainAuthError(error, { nativeGoogle: false });
      setAuthGateStatus(`${isAdminEntry ? 'فشل دخول الإدارة' : 'فشل تسجيل الدخول'}: ${message}`, 'error');
      toast(`⚠️ ${message}`);
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
      openAuthGate('سجّل الدخول أولاً ثم أرسل طلب الترقية.', { force: true });
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
      openAuthGate('سجّل الدخول أولاً ثم فعّل كود الترقية.', { force: true });
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
    stopVoicePlayback();
    clearAuthState();
    clearUsageState();
    CLOUD_RUNTIME.hydratedFor = '';
    CLOUD_RUNTIME.lastHash = '';
    clearTimeout(CLOUD_RUNTIME.syncTimer);
    try{ window.google?.accounts?.id?.disableAutoSelect(); }catch(_){}
    try{
      const plugin = getNativeGoogleAuthPlugin();
      plugin?.signOut?.().catch?.(()=>{});
    }catch(_){}
    syncAccountUi();
    refreshModeButtons();
    refreshStrategicWorkspace().catch(()=>{});
    openAuthGate('تم تسجيل الخروج. سجّل الدخول مرة أخرى ببريدك الشخصي للمتابعة.', { force: true });
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
      }
    }, keyboardEditing ? 180 : 60);
  }

  function openAccountCenter(){
    if (!hasValidAuthSession()){
      openAuthGate('', { force: true });
      return;
    }
    openWorkspacePage('settings');
    window.setTimeout(() => {
      $('settingsAccountCard')?.scrollIntoView({ behavior:'smooth', block:'start' });
    }, 60);
  }

  async function initializeAuthExperience(){
    ensureAccountChrome();
    installBrowserAuthBridgeListeners();
    if (AUTH_RUNTIME.booting) return;
    AUTH_RUNTIME.booting = true;
    try{
      await loadRemoteAuthConfig(true).catch(() => null);
      await verifyStoredAuthSession(false).catch(() => null);
      syncAccountUi();
      const account = getAccountRuntimeState();
      if (account.authRequired && !hasValidAuthSession()){
        openAuthGate();
      } else {
        await hydrateCloudState(false).catch(() => null);
        closeAuthGate(true);
      }
    }catch(_){
      closeAuthGate(true);
    }finally{
      AUTH_RUNTIME.booting = false;
    }
  }

  function ensureStrategicChrome(){
    ensureAccountChrome();
    renderPrimaryNavigation();
    ensureHomeWorkspaceLanding();
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
      const usageBadge = document.createElement('span');
      usageBadge.className = 'runtime-badge';
      usageBadge.id = 'topUsageBadge';
      usageBadge.textContent = 'الرصيد —';
      left.appendChild(stack);
      stack.appendChild(topTitle);
      row.appendChild(topSubtitle);
      row.appendChild(badge);
      row.appendChild(usageBadge);
      stack.appendChild(row);
    }
    const runtimeRow = document.querySelector('.top-runtime-row');
    if (runtimeRow && !$('topUsageBadge')){
      const usageBadge = document.createElement('span');
      usageBadge.className = 'runtime-badge';
      usageBadge.id = 'topUsageBadge';
      usageBadge.textContent = 'الرصيد —';
      runtimeRow.appendChild(usageBadge);
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
    if (topActions && !$('voiceModeBtn')){
      const voice = document.createElement('button');
      voice.type = 'button';
      voice.id = 'voiceModeBtn';
      voice.className = 'btn ghost sm with-label';
      voice.innerHTML = '<span class="icon">🎙️</span><span class="label">صوت</span>';
      topActions.insertBefore(voice, $('modeOffBtn') || $('newThreadBtn') || null);
    }
    if (topActions && !$('zoomOutBtn')){
      const zoomOut = document.createElement('button');
      zoomOut.type = 'button';
      zoomOut.id = 'zoomOutBtn';
      zoomOut.className = 'btn ghost sm with-label';
      zoomOut.innerHTML = '<span class="icon">➖</span><span class="label">تصغير</span>';
      topActions.insertBefore(zoomOut, $('newThreadBtn') || null);
    }
    if (topActions && !$('zoomLevelBadge')){
      const badge = document.createElement('span');
      badge.id = 'zoomLevelBadge';
      badge.className = 'tag';
      badge.textContent = '100%';
      topActions.insertBefore(badge, $('newThreadBtn') || null);
    }
    if (topActions && !$('zoomInBtn')){
      const zoomIn = document.createElement('button');
      zoomIn.type = 'button';
      zoomIn.id = 'zoomInBtn';
      zoomIn.className = 'btn ghost sm with-label';
      zoomIn.innerHTML = '<span class="icon">➕</span><span class="label">تكبير</span>';
      topActions.insertBefore(zoomIn, $('newThreadBtn') || null);
    }
    if (topActions && !$('darkModeBtn')){
      const dark = document.createElement('button');
      dark.type = 'button';
      dark.id = 'darkModeBtn';
      dark.className = 'btn ghost sm with-label';
      dark.setAttribute('aria-pressed', 'false');
      dark.innerHTML = '<span class="icon">🌙</span><span class="label">داكن</span>';
      topActions.insertBefore(dark, $('newThreadBtn') || null);
    }

    const moreGroupItems = $('moreGroupItems');
    if (moreGroupItems && !$('exitAppNavBtn')){
      const exitBtn = document.createElement('button');
      exitBtn.className = 'navbtn sub';
      exitBtn.id = 'exitAppNavBtn';
      exitBtn.type = 'button';
      exitBtn.innerHTML = '<span class="navbtn-icon">⏻</span><span class="navbtn-label">خروج</span><span class="meta">تأكيد</span>';
      moreGroupItems.appendChild(exitBtn);
    }

    unwrapLegacyTopbarScroll();

    const topbar = document.querySelector('.topbar');
    const statusBox = $('statusBox');
    if (topbar && statusBox && !$('chatQuickActionBar')){
      const quickBar = document.createElement('div');
      quickBar.className = 'subtopbar';
      quickBar.id = 'chatQuickActionBar';
      quickBar.innerHTML = `
        <span class="subtopbar-label" id="chatQuickActionBarLabel">إجراءات</span>
        <div class="subtopbar-actions" id="chatQuickActionBarActions" role="toolbar" aria-label="إجراءات الدردشة"></div>`;
      topbar.insertAdjacentElement('afterend', quickBar);
    }
    const quickBarActions = $('chatQuickActionBarActions');
    ['scrollTopBtn', 'scrollBottomBtn', 'clearChatBtn', 'chatToolbarPinBtn', 'chatToolbarCollapseBtn'].forEach((id) => {
      const el = $(id);
      if (el && quickBarActions && el.parentElement !== quickBarActions){
        quickBarActions.appendChild(el);
      }
    });
    if (quickBarActions && !$('chatReadingModeBtn')){
      const readBtn = document.createElement('button');
      readBtn.type = 'button';
      readBtn.id = 'chatReadingModeBtn';
      readBtn.className = 'btn ghost sm with-label';
      readBtn.innerHTML = '<span class="icon">📖</span><span class="label">قراءة</span>';
      readBtn.title = 'وضع القراءة — إخفاء الأشرطة والمدخل لتوسيع مساحة الدردشة';
      quickBarActions.appendChild(readBtn);
    }
    if (!$('chatReadingModeExitBtn')){
      const fab = document.createElement('button');
      fab.type = 'button';
      fab.id = 'chatReadingModeExitBtn';
      fab.className = 'reading-mode-exit-fab';
      fab.hidden = true;
      fab.setAttribute('aria-label', 'إظهار أشرطة الدردشة والمدخل');
      fab.textContent = '✕ واجهة';
      document.body.appendChild(fab);
    }

    const chatMainToolbar = document.querySelector('#page-chat .toolbar.mainToolbar');
    if (chatMainToolbar && !$('assistantFoundationBar')){
      const wrap = document.createElement('div');
      wrap.id = 'assistantFoundationBar';
      wrap.className = 'assistant-foundation-bar';
      wrap.setAttribute('role', 'region');
      wrap.setAttribute('aria-label', 'تجهيز مهام واقعية داخل المحادثة');
      wrap.innerHTML = `
        <div class="assistant-foundation-inner">
          <span class="assistant-foundation-label">تنفيذ داخل المحادثة</span>
          <div class="assistant-foundation-actions">
            <button type="button" class="btn ghost sm" data-foundation-prompt="task_exec_honest" title="حدود صادقة + أول خطوة قابلة للتنفيذ هنا">حدود + خطوة</button>
            <button type="button" class="btn ghost sm" data-foundation-prompt="action_board" title="لوحة تنفيذ">لوحة مهام</button>
            <button type="button" class="btn ghost sm" data-foundation-prompt="kb_orchestrator" title="ملفات ومعرفة">ملفات + معرفة</button>
            <button type="button" class="btn ghost sm" data-foundation-prompt="analysis_ar" title="تحليل مع مخرجات">تحليل</button>
          </div>
        </div>`;
      chatMainToolbar.insertBefore(wrap, chatMainToolbar.firstChild);
      wrap.querySelectorAll('[data-foundation-prompt]').forEach((btn) => {
        btn.addEventListener('click', () => applyQuickPrompt(btn.getAttribute('data-foundation-prompt'), false));
      });
    }

    $('agentTaskApplyBtn')?.remove();
    const legacyQuickGroup = $('agentTaskTemplate')?.closest('.tool-group')?.nextElementSibling;
    if (legacyQuickGroup && legacyQuickGroup.querySelector('#scrollTopBtn') == null){
      legacyQuickGroup.style.display = 'none';
    }

    const contentRoot = document.querySelector('.content');
    if (contentRoot && !$('page-guide')){
      const page = document.createElement('div');
      page.className = 'page';
      page.id = 'page-guide';
      page.innerHTML = `
        <div class="toolbar">
          <input id="guideSearch" type="text" placeholder="ابحث داخل دليل الاستخدام..." style="max-width:320px" />
          <button class="btn ghost sm with-label" id="guideExportBtn" type="button"><span class="icon">⬇</span><span class="label">تنزيل الدليل</span></button>
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
      area.placeholder = 'اكتب طلبك… Enter للإرسال، Shift+Enter لسطر جديد';
      area.title = 'Enter للإرسال، Shift+Enter لسطر جديد';
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
    syncComposerRtlOrder();
    if (chatbar && !$('composerContextMeta')){
      chatbar.insertAdjacentHTML('afterend', `
        <div class="composer-meta composer-meta--idle">
          <span id="composerHint"></span>
          <span class="composer-status" id="composerContextMeta">—</span>
          <button class="btn ghost sm" id="composerEditCancelBtn" type="button" style="display:none">إلغاء التعديل</button>
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
            <div class="thread-drawer-sub" id="threadDrawerSub">ضمن المشروع الحالي</div>
          </div>
          <div class="row" style="margin:0; gap:6px">
            <button class="btn ghost sm icon" id="threadDrawerCloseBtn" type="button" title="إغلاق" aria-label="إغلاق">✕</button>
          </div>
        </div>
        <div class="thread-drawer-toolbar">
          <input id="threadSearchInput" type="text" placeholder="ابحث في السجل..." />
          <button class="btn ghost sm with-label" id="threadExportAllBtn" type="button"><span class="icon">⬇</span><span class="label">تصدير الكل</span></button>
        </div>
        <div class="thread-drawer-list" id="threadDrawerList"></div>`;
      chatPage.appendChild(drawer);
      const overlay = document.createElement('div');
      overlay.className = 'thread-drawer-overlay';
      overlay.id = 'threadDrawerOverlay';
      chatPage.appendChild(overlay);
    }
    if (chatPage && !$('chatScrollDock')){
      chatPage.insertAdjacentHTML('beforeend', `
        <div class="floating-scroll-nav" id="chatScrollDock" aria-label="التنقل داخل الدردشة" aria-hidden="true">
          <button class="scroll-fab" id="floatingScrollBottomBtn" type="button" title="الانتقال إلى أحدث رسالة" aria-label="الانتقال إلى أحدث رسالة">
            <span class="icon">⬇</span>
            <span class="label">للأسفل</span>
          </button>
        </div>`);
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
              <button class="btn ghost sm with-label" id="settingsDefaultsBtn" type="button"><span class="icon">⚙</span><span class="label">تطبيق الإعدادات</span></button>
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
              <div class="settings-kpi"><span>الرصيد المتبقي</span><strong id="settingsBalanceState">—</strong></div>
              <div class="settings-kpi"><span>المستخدم من الرصيد</span><strong id="settingsSpentState">—</strong></div>
              <div class="settings-kpi"><span>آخر استهلاك</span><strong id="settingsLastUsageState">—</strong></div>
            </div>
          </div>
        </div>`);
    }
    const settingsActions = document.querySelector('#page-settings .settings-actions');
    if (settingsActions && !$('settingsGuideBtn')){
      const guideBtn = document.createElement('button');
      guideBtn.type = 'button';
      guideBtn.id = 'settingsGuideBtn';
      guideBtn.className = 'btn ghost sm with-label';
      guideBtn.innerHTML = '<span class="icon">📘</span><span class="label">دليل الاستخدام</span>';
      settingsActions.appendChild(guideBtn);
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
      ['workspaceHeadline', 'مساعدك الذكي للعمل باللغة العربية'],
      ['workspaceSummary', 'دردش، حلّل ملفاتك، واستخرج النصوص — كل شيء في مكان واحد.'],
      ['signalProviderNote', 'المزوّد الحالي وطريقة المصادقة'],
      ['signalModelNote', 'مسار النموذج الرئيسي'],
      ['signalContextNote', 'الملفات والمعرفة وذاكرة المشروع'],
      ['signalModesNote', 'البث والأدوات والويب وأنماط التشغيل'],
      ['composerHint', '']
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
      downloads: '⬇ التحميلات',
      projects: '🗂 المشاريع',
      settings: '⚙ الإعدادات',
      guide: '📘 دليل الاستخدام'
    };
    document.querySelectorAll('.navbtn[data-page]').forEach((btn) => {
      const label = btn.querySelector('.navbtn-label') || btn.querySelector('span:not(.meta):not(.navbtn-icon)');
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
      if (labels[key] && btn.children.length === 0) btn.textContent = labels[key];
    });
  }

  function openThreadDrawer(){
    $('threadDrawer')?.classList.add('show');
    $('threadDrawerOverlay')?.classList.add('show');
    renderThreadHistory();
    setTimeout(() => $('threadSearchInput')?.focus(), 40);
    scheduleChatScrollDockSync();
  }

  function closeThreadDrawer(){
    $('threadDrawer')?.classList.remove('show');
    $('threadDrawerOverlay')?.classList.remove('show');
    scheduleChatScrollDockSync();
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
    toast('⬇ تم تصدير المحادثة');
  }

  function exportAllThreads(){
    const pid = getCurProjectId();
    const payload = {
      project: getCurProject(),
      brief: getProjectBrief(pid),
      threads: loadThreads(pid)
    };
    downloadBlob(`threads-${pid}.json`, new Blob([JSON.stringify(payload, null, 2)], { type:'application/json;charset=utf-8' }));
    toast('⬇ تم تصدير سجل المشروع');
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
        id: 'account_auth',
        page: 'settings',
        title: 'الحساب والدخول والخطط',
        body: 'التطبيق يدعم دخولًا عبر Google مع ربط المشاريع بالحساب، وخطة مجانية مقيدة، وخطة مدفوعة عبر كود ترقية. بعض الحسابات تمتلك صلاحيات إدارية لإصدار أكواد الترقية.',
        steps: [
          'افتح تسجيل الدخول من الشريط الجانبي أو عندما يطلب التطبيق المصادقة.',
          'استخدم بريدك الشخصي للخطة المجانية، واتبع تعليمات الشاشة إذا كنت تمتلك صلاحيات أعلى.',
          'للترقية: اطلب الترقية أو أدخل كود الترقية من صفحة الإعدادات حسب ما وصلك.',
          'للخروج: استخدم تسجيل الخروج من مركز الحساب عند الحاجة.'
        ],
        tips: ['إذا ظهرت رسائل عن البوابة أو المفتاح فغالبًا الإعدادات تحتاج ضبط Worker/Gateway.', 'الخطة المجانية قد تفرض قيودًا على الموديلات والميزات حسب سياسة التطبيق.']
      },
      {
        id: 'chat_toolbar_overflow',
        page: 'chat',
        title: 'شريط الدردشة: التمرير وقائمة المزيد',
        body: 'على الشاشات الضيقة قد لا تتسع كل الأزرار في سطر واحد. لذلك يوفّر الشريط العلوي تمريرًا أفقيًا وزر «المزيد» يعيد إظهار الأدوات دون إخفاء صامت.',
        steps: [
          'مرّر أفقيًا داخل منطقة الأزرار العلوية إذا لم تظهر كل الأدوات.',
          'اضغط «المزيد» لفتح قائمة تعيد تنفيذ نفس الأزرار الموجودة في الشريط.',
          'زر «سجل الدردشات» يفتح درج المحادثات داخل المشروع الحالي.'
        ],
        tips: ['زر «محادثة جديدة» يبقى ضمن نفس الشريط أو ضمن «المزيد» حسب العرض.', 'لا يزال بإمكانك فتح الدردشة من الصفحة الرئيسية أيضًا.']
      },
      {
        id: 'prompt_engineering',
        page: 'chat',
        title: 'هندسة البرومبت والأوضاع',
        body: 'يمكنك تفعيل أوضاع مثل الويب والوكيل والتفكير العميق من شريط الدردشة. هذه الأوضاع تغيّر سلوك الطلبات (مثلاً إضافة بحث ويب أو تنسيق مهام). كما يوجد قسم «Prompt Engineering» عند تفعيله من الواجهة.',
        steps: [
          ' راقب شارات التشغيل أعلى الشاشة لمعرفة المزود والوضع الحالي.',
          ' استخدم «إيقاف الأوضاع» للعودة لتشغيل افتراضي أنظف.',
          ' راجع إعدادات التكلفة في الإعدادات إذا كنت تستخدم ميزات أعلى تكلفة.'
        ],
        tips: ['الوضع المجاني قد يمنع بعض الأوضاع تلقائيًا.', 'استخدم ذاكرة المشروع لتقليل تكرار التعليمات في كل رسالة.']
      },
      {
        id: 'dashboard_canvas_exports',
        page: 'canvas',
        title: 'اللوحة: الذكاء الاصطناعي والتصدير',
        body: 'اللوحة هي محرر نصوص/Markdown/HTML داخل المشروع. زر الذكاء يفتح قائمة اختيار (إعادة صياغة/تلخيص/تحسين/بناء تطبيق HTML) بدل كتابة أوامر يدويًا. التصدير يدعم TXT وHTML وDOCX عبر اختيار صريح.',
        steps: [
          'احفظ المستند ثم استخدم زر الذكاء واختر المهمة المناسبة.',
          'استخدم زر التصدير واختر الصيغة ثم نفّذ التنزيل.',
          'إصدارات المستند متاحة من زر الإصدارات عبر قائمة اختيار وليس عبر نافذة كتابة.'
        ],
        tips: ['DOCX يعتمد على محرك تحويل HTML→Word المحمّل مع الصفحة.', 'إن فشل DOCX تحقق من اتصال الشبكة لتحميل المكتبة أو جرّب HTML/TXT.']
      },
      {
        id: 'document_lab_docx',
        page: 'transcription',
        title: 'مختبر الوثائق: DOCX ومسارات التحويل',
        body: 'يمكن استخراج النص من PDF/صورة، تحسينه سحابيًا عند السماح، ثم التصدير إلى TXT/JSON/DOCX. تحويل PDF→DOCX قد يكون محليًا (هيكلي) أو سحابيًا حسب الإعدادات والخطة وحدود الملف.',
        steps: [
          'اختر ملفًا ثم «استخراج النص» وراجع الناتج.',
          'للتصدير: اختر الصيغة من القائمة ثم «تصدير».',
          'لـ PDF→DOCX: استخدم الزر المخصص وراقب رسالة المسار في بطاقة المختبر.'
        ],
        tips: ['PDFs الرقمية تعطي نتائج أسرع وأدق من الممسوح ضوئيًا.', 'إذا تعذر المسار السحابي سيعود التطبيق للمسار المحلي عندما يسمح الإعداد.']
      },
      {
        id: 'downloads_android',
        page: 'settings',
        title: 'تنزيل تطبيق Android والويب التقدمي',
        body: 'يوجد قسم تنزيلات داخل الإعدادات يشير إلى ملف APK الرسمي للتثبيت المباشر، ويمكنك أيضًا تثبيت نسخة الويب كتطبيق PWA من المتصفح.',
        steps: [
          'افتح صفحة التنزيلات من الروابط داخل الإعدادات عند الحاجة.',
          'على Android: ثبّت APK عند السماح بالمصادر غير المعروفة وفق سياسة جهازك.',
          'على المتصفح: أضف إلى الشاشة الرئيسية للحصول على تجربة قريبة من التطبيق.'
        ],
        tips: ['تأكد أنك على نفس إصدار الموقع الظاهر في العنوان/الشريط الجانبي.', 'إذا بدا المحتوى قديمًا، حدّث الصفحة أو امسح كاش PWA حسب تعليمات المتصفح.']
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
    toast('⬇ تم تنزيل دليل الاستخدام');
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

  function syncStrategicLayoutState(hasMessages){
    const chatActive = !!$('page-chat')?.classList.contains('active');
    /* Chat-first: on any platform, collapse workspace chrome while chat is open to privilege the transcript. */
    const collapseForChatFocus = chatActive;
    const shouldCollapseDeck = collapseForChatFocus
      || (!!hasMessages && !$('page-home')?.classList.contains('active'));
    $('workspaceDeck')?.classList.toggle('workspace-deck-collapsed', shouldCollapseDeck);
    $('strategicStrip')?.classList.toggle('strategic-strip-collapsed', collapseForChatFocus || !!hasMessages);
  }

  async function refreshStrategicWorkspace(){
    const rawSettings = getSettings();
    const policy = getAppRuntimePolicy(rawSettings);
    const settings = policy.runtime;
    const modelDescriptor = getModelDescriptor(settings.model || '', settings.provider || '');
    const modelCapabilitySummary = summarizeModelCapabilities(modelDescriptor, 4);
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
      $('workspaceHeadline').textContent = 'مساعدك الذكي للعمل باللغة العربية';
    }
    if ($('workspaceSummary')){
      $('workspaceSummary').textContent = 'دردش، حلّل ملفاتك، واستخرج النصوص — كل شيء في مكان واحد.';
    }
    if ($('signalProvider')) $('signalProvider').textContent = settings.provider.toUpperCase();
    if ($('signalProviderNote')) $('signalProviderNote').textContent = `${readiness} • ${settings.authMode === 'gateway' ? 'اتصال محمي عبر البوابة' : 'اتصال مباشر من المتصفح'}`;
    if ($('signalModel')) $('signalModel').textContent = getDisplayModelName(settings.model);
    if ($('signalModelNote')) $('signalModelNote').textContent = `القدرات ${modelCapabilitySummary} • حد الإخراج ${settings.maxOut || 2000} • قص الملفات ${settings.fileClip || 12000} • ${policy.freeMode ? 'نموذج مجاني' : getCostGuardLabel(policy.costGuard)}`;
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
    renderUsageIndicators(settings);
    refreshUsageState({ settings }).catch(() => {});

    if ($('historyDrawerBtn')){
      $('historyDrawerBtn').innerHTML = `<span class="icon">🕘</span><span class="label">السجل (${loadThreads(pid).length})</span>`;
    }

    renderHomeWorkspace().catch(()=>{});
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

      const usage = await refreshUsageState({ force: true, settings });
      if (supportsCreditVisibility(settings)){
        if (usage.available){
          lines.push(`رصيد OpenRouter المتبقي: ${formatUsd(usage.remainingCredits)}`);
          lines.push(`المستخدم من الرصيد: ${formatUsd(usage.totalUsage)} من ${formatUsd(usage.totalCredits)}`);
        } else if (usage.lastTotalTokens != null || usage.lastRequestCost != null){
          lines.push(`آخر استهلاك معروف: ${getLastUsageLabel(usage)}`);
        }
        if (usage.lastError){
          lines.push(`بيانات الرصيد: ${usage.lastError}`);
        }
      }

      const convertRoot = getConvertWorkerRoot(settings);
      const convertHealthUrl = getConvertHealthUrl(settings);
      if (convertRoot && convertHealthUrl){
        try{
          const convertResp = await fetch(convertHealthUrl, {
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
    const page = $('page-chat');
    const log = $('chatLog');
    const scroller = getChatScrollContainer();
    if (!scroller && !log && !page) return;
    const top = direction === 'top';
    const targetTop = top ? 0 : Math.max(
      Number(scroller?.scrollHeight || 0),
      Number(log?.scrollHeight || 0),
      Number(page?.scrollHeight || 0)
    );
    scroller?.scrollTo({ top: targetTop, behavior: 'smooth' });
    if (log && log !== scroller) log.scrollTo({ top: targetTop, behavior: 'smooth' });
    if (page && page !== scroller) page.scrollTo({ top: targetTop, behavior: 'smooth' });
    window.setTimeout(scheduleChatScrollDockSync, 260);
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

  function getHtmlToDocxFn(){
    if (typeof window === 'undefined') return null;
    const candidates = [
      window.htmlToDocx,
      window.HTMLtoDOCX,
      window.HTMLToDOCX,
      window.HTMLToDOCX && window.HTMLToDOCX.default,
      window.html_to_docx,
      window['html-to-docx']
    ].filter(Boolean);
    for (const c of candidates){
      if (typeof c === 'function') return c;
    }
    for (const c of candidates){
      if (c && typeof c.default === 'function') return c.default;
    }
    return null;
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
    const endpoints = buildOcrCloudEndpoints(settings);
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

    const fn = getHtmlToDocxFn();
    if (!fn) throw new Error('محول DOCX غير متاح');
    const blob = toDocxBlob(await Promise.resolve(fn(html)));
    return { text: structured.text, structured, blob, fileName: `${title || 'converted'}.docx` };
  }

  async function convertPdfToDocxByWorker(file){
    const settings = getSettings();
    const endpoints = buildDocxCloudEndpoints(settings);
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

    const endpoints = buildDocxCloudEndpoints(settings);
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
      downloadBlob(`${safeBase}.txt`, new Blob([out], { type:'text/plain;charset=utf-8' }));
      return;
    }

    if (format === 'json'){
      const payload = structured || { text: cleanText };
      downloadBlob(`${safeBase}.json`, new Blob([JSON.stringify(payload, null, 2)], { type:'application/json;charset=utf-8' }));
      return;
    }

    const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;line-height:1.9;white-space:pre-wrap}</style></head><body>${escapeHtml(cleanText)}</body></html>`;
    const fn = getHtmlToDocxFn();
    if (!fn) throw new Error('محول DOCX غير متاح');
    const blob = toDocxBlob(await Promise.resolve(fn(html)));
    downloadBlob(`${safeBase}.docx`, blob);
  }

  // ---------------- Downloads (```file blocks) ----------------
  function loadDownloads(){ return loadJSON(KEYS.downloads, []) || []; }
  function saveDownloads(arr){ saveJSON(KEYS.downloads, arr); }
  const DOWNLOAD_MIME_MAP = {
    txt: 'text/plain',
    md: 'text/markdown',
    csv: 'text/csv',
    json: 'application/json',
    xml: 'application/xml',
    html: 'text/html',
    htm: 'text/html',
    css: 'text/css',
    js: 'text/javascript',
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    zip: 'application/zip',
    rar: 'application/vnd.rar',
    '7z': 'application/x-7z-compressed',
    tar: 'application/x-tar',
    gz: 'application/gzip',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    m4a: 'audio/mp4',
    ogg: 'audio/ogg',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    mkv: 'video/x-matroska',
    webm: 'video/webm',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    bmp: 'image/bmp'
  };
  function getFileBlockRegex(){
    return /```file\b([^\n]*)\n([\s\S]*?)\n```/gi;
  }
  function parseBlockAttributes(raw){
    const attrs = {};
    String(raw || '').replace(/(\w+)=(?:"([^"]*)"|'([^']*)')/g, (_, key, quoted, singleQuoted) => {
      const value = quoted != null ? quoted : (singleQuoted != null ? singleQuoted : '');
      attrs[String(key || '').toLowerCase()] = value || '';
      return '';
    });
    return attrs;
  }
  function sanitizeDownloadUrl(raw){
    const value = String(raw || '').trim();
    if (!value) return '';
    if (/^(https?:|data:|blob:)/i.test(value)) return value;
    return '';
  }
  function inferMimeFromName(name = ''){
    const cleaned = String(name || '').trim().split('?')[0].split('#')[0];
    const match = cleaned.match(/\.([a-z0-9]{1,8})$/i);
    const ext = String(match?.[1] || '').toLowerCase();
    return DOWNLOAD_MIME_MAP[ext] || '';
  }
  function inferMimeFromDataUrl(raw = ''){
    const match = String(raw || '').trim().match(/^data:([^;,]+)[;,]/i);
    return String(match?.[1] || '').trim().toLowerCase();
  }
  function inferExtensionFromMime(mime = ''){
    const clean = String(mime || '').trim().toLowerCase().split(';')[0];
    if (!clean) return 'bin';
    if (clean === 'image/jpeg') return 'jpg';
    if (clean === 'image/png') return 'png';
    if (clean === 'image/webp') return 'webp';
    if (clean === 'image/gif') return 'gif';
    if (clean === 'image/svg+xml') return 'svg';
    if (clean === 'video/mp4') return 'mp4';
    if (clean === 'audio/mpeg') return 'mp3';
    const hit = Object.entries(DOWNLOAD_MIME_MAP).find(([, value]) => String(value || '').toLowerCase() === clean);
    return hit?.[0] || 'bin';
  }
  function sanitizeBlockAttrValue(value = ''){
    return String(value || '').replace(/[\r\n"]/g, ' ').trim();
  }
  function buildInlineFileBlock({ name, mime, url = '', content = '', encoding = 'url' } = {}){
    const safeName = sanitizeBlockAttrValue(name || 'download.bin') || 'download.bin';
    const safeMime = sanitizeBlockAttrValue(mime || inferMimeFromName(safeName) || 'application/octet-stream') || 'application/octet-stream';
    const attrs = [`name="${safeName}"`, `mime="${safeMime}"`];
    const safeUrl = sanitizeDownloadUrl(url || '');
    const isDataUrl = /^data:/i.test(safeUrl);
    if (safeUrl && !isDataUrl) attrs.push(`url="${sanitizeBlockAttrValue(safeUrl)}"`);
    else attrs.push(`encoding="${sanitizeBlockAttrValue(isDataUrl ? 'dataurl' : (encoding || 'text'))}"`);
    const body = safeUrl
      ? (isDataUrl ? safeUrl : '')
      : String(content || '');
    return `\`\`\`file ${attrs.join(' ')}\n${body}\n\`\`\``;
  }
  function extractFilenameFromUrl(rawUrl = '', fallback = 'download.bin'){
    const direct = String(rawUrl || '').trim();
    if (!direct) return fallback;
    if (/^data:/i.test(direct)) return fallback;
    try{
      const url = new URL(direct);
      const fromQuery = url.searchParams.get('filename') || url.searchParams.get('file') || url.searchParams.get('name');
      if (fromQuery) return decodeURIComponent(fromQuery);
      const pathName = decodeURIComponent(String(url.pathname || '').split('/').pop() || '');
      return pathName || fallback;
    }catch(_){
      return fallback;
    }
  }
  function looksLikeDownloadUrl(rawUrl = '', label = ''){
    const value = String(rawUrl || '').trim();
    if (!sanitizeDownloadUrl(value)) return false;
    if (/^data:|^blob:/i.test(value)) return true;
    if (/\.(pdf|docx?|xlsx?|pptx?|zip|rar|7z|csv|json|xml|txt|md|png|jpe?g|webp|gif|svg|mp4|mov|avi|mkv|webm|mp3|wav|m4a)(?:[\?#]|$)/i.test(value)) return true;
    if (/download|attachment|raw=1|response-content-disposition/i.test(value)) return true;
    return /\.[a-z0-9]{2,8}$/i.test(String(label || '').trim());
  }
  function extractDownloadLinksFromText(text){
    const out = [];
    const seen = new Set();
    const pushEntry = (name, url, mime = '') => {
      const cleanUrl = sanitizeDownloadUrl(url);
      if (!cleanUrl || !looksLikeDownloadUrl(cleanUrl, name)) return;
      const derivedName = String(name || '').trim() || extractFilenameFromUrl(cleanUrl);
      const key = `${derivedName}\u241f${cleanUrl}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({
        name: derivedName,
        mime: mime || inferMimeFromName(derivedName) || inferMimeFromName(extractFilenameFromUrl(cleanUrl)) || 'application/octet-stream',
        encoding: 'url',
        url: cleanUrl,
        content: ''
      });
    };

    const source = String(text || '');
    source.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|data:[^)]+|blob:[^)]+)\)/gi, (_, label, url) => {
      pushEntry(String(label || '').trim(), String(url || '').trim());
      return '';
    });
    source.replace(/<a\b[^>]*href=(?:"([^"]+)"|'([^']+)')[^>]*>([\s\S]*?)<\/a>/gi, (_, href1, href2, inner) => {
      const href = String(href1 || href2 || '').trim();
      const label = String(inner || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      pushEntry(label, href);
      return '';
    });
    source.replace(/\b(https?:\/\/[^\s<>"')]+|data:[^\s<>"']+|blob:[^\s<>"']+)/gi, (_, url) => {
      pushEntry('', String(url || '').trim());
      return '';
    });
    return out;
  }
  function inferGeneratedDownloadMeta(text = '', index = 0){
    const source = String(text || '');
    const explicitName = source.match(/(?:name|filename|اسم الملف)\s*[:=]\s*["'`]?([^\s"'`]+?\.[a-z0-9]{2,8})/i);
    if (explicitName?.[1]){
      const name = String(explicitName[1] || '').trim();
      return {
        name,
        mime: inferMimeFromName(name) || 'application/octet-stream'
      };
    }
    const hintedName = source.match(/\b([a-z0-9._-]+\.(?:docx?|xlsx?|pptx?|pdf|zip|rar|7z|csv|txt|md|json|xml|png|jpe?g|webp|gif|svg|mp4|mov|avi|mkv|webm|mp3|wav|m4a))\b/i);
    if (hintedName?.[1]){
      const name = String(hintedName[1] || '').trim();
      return {
        name,
        mime: inferMimeFromName(name) || 'application/octet-stream'
      };
    }
    const catalog = [
      { re: /(?:powerpoint|pptx|بوربوينت|عرض\s+تقديمي)/i, ext: 'pptx' },
      { re: /(?:excel|xlsx|csv|اكسل|جدول)/i, ext: 'xlsx' },
      { re: /(?:word|docx|doc|ورد|مستند)/i, ext: 'docx' },
      { re: /(?:pdf|بي\s*دي\s*اف)/i, ext: 'pdf' },
      { re: /(?:zip|rar|7z|أرشيف|مضغوط)/i, ext: 'zip' },
      { re: /(?:mp4|mov|avi|mkv|webm|video|فيديو)/i, ext: 'mp4' },
      { re: /(?:mp3|wav|m4a|audio|صوت)/i, ext: 'mp3' },
      { re: /(?:png|jpe?g|webp|gif|svg|image|صورة)/i, ext: 'png' }
    ];
    const match = catalog.find((item) => item.re.test(source));
    const ext = match?.ext || 'bin';
    const name = `generated-file-${index + 1}.${ext}`;
    return {
      name,
      mime: inferMimeFromName(name) || 'application/octet-stream'
    };
  }
  function normalizeBase64Payload(raw = ''){
    return String(raw || '')
      .trim()
      .replace(/^[`"'.,:;()[\]{}<>-]+|[`"'.,:;()[\]{}<>-]+$/g, '')
      .replace(/\s+/g, '');
  }
  function isProbablyBase64Payload(raw = ''){
    const value = normalizeBase64Payload(raw);
    if (value.length < 160) return false;
    if (!/^[A-Za-z0-9+/=]+$/.test(value)) return false;
    const paddingCount = (value.match(/=/g) || []).length;
    if (paddingCount > 2) return false;
    const letters = (value.match(/[A-Za-z]/g) || []).length;
    return letters >= Math.floor(value.length * 0.45);
  }
  function extractLooseBinaryPayloads(text){
    const source = String(text || '');
    const lines = source.split(/\r?\n/);
    const kept = [];
    const entries = [];
    let fileIndex = 0;
    for (let i = 0; i < lines.length; ){
      const rawLine = String(lines[i] || '');
      const trimmed = rawLine.trim();
      const dataUrl = trimmed.match(/^(data:[^,\s]+;base64,[A-Za-z0-9+/=\s]+)$/i)?.[1] || '';
      if (dataUrl){
        const payload = String(dataUrl || '').split(',', 2)[1] || '';
        if (isProbablyBase64Payload(payload)){
          const meta = inferGeneratedDownloadMeta(source, fileIndex);
          entries.push({
            name: meta.name,
            mime: meta.mime,
            encoding: 'dataurl',
            content: dataUrl
          });
          fileIndex += 1;
          i += 1;
          continue;
        }
      }
      const chunk = [];
      let j = i;
      while (j < lines.length){
        const normalized = normalizeBase64Payload(lines[j]);
        if (!isProbablyBase64Payload(normalized)) break;
        chunk.push(normalized);
        j += 1;
      }
      if (chunk.length){
        const joined = chunk.join('');
        if (isProbablyBase64Payload(joined)){
          const meta = inferGeneratedDownloadMeta(source, fileIndex);
          entries.push({
            name: meta.name,
            mime: meta.mime,
            encoding: 'base64',
            content: joined
          });
          fileIndex += 1;
          i = j;
          continue;
        }
      }
      kept.push(rawLine);
      i += 1;
    }
    return {
      entries,
      text: kept.join('\n').replace(/\n{3,}/g, '\n\n').trim()
    };
  }
  function normalizeDownloadEntry(entry = {}){
    const rawUrl = sanitizeDownloadUrl(entry.url || entry.href || '');
    const rawEncoding = String(entry.encoding || (rawUrl ? 'url' : 'text')).trim().toLowerCase();
    const encoding = rawEncoding === 'base64'
      ? 'base64'
      : rawEncoding === 'dataurl'
      ? 'dataurl'
      : rawEncoding === 'url'
      ? 'url'
      : 'text';
    const derivedName = String(entry.name || '').trim() || extractFilenameFromUrl(rawUrl, 'download.bin');
    const derivedMime = String(entry.mime || '').trim()
      || inferMimeFromName(derivedName)
      || inferMimeFromName(extractFilenameFromUrl(rawUrl))
      || (encoding === 'text' ? 'text/plain' : 'application/octet-stream');
    const normalized = {
      id: String(entry.id || makeId('dl')),
      name: derivedName,
      mime: derivedMime,
      encoding,
      content: String(entry.content || ''),
      url: rawUrl,
      sizeBytes: toFiniteNumber(entry.sizeBytes ?? entry.bytes),
      createdAt: Number(entry.createdAt || nowTs()),
      pinned: !!entry.pinned,
      sourceMessageId: String(entry.sourceMessageId || ''),
      fingerprint: String(entry.fingerprint || '')
    };
    if (normalized.encoding === 'url' && !normalized.url && /^data:/i.test(normalized.content || '')){
      normalized.url = String(normalized.content || '').trim();
      normalized.content = '';
    }
    if (normalized.encoding === 'dataurl' && !/^data:/i.test(normalized.content || '') && normalized.url && /^data:/i.test(normalized.url)){
      normalized.content = normalized.url;
      normalized.url = '';
    }
    if (!normalized.fingerprint){
      const seed = `${normalized.name}\u241f${normalized.mime}\u241f${normalized.encoding}\u241f${normalized.content}\u241f${normalized.url}\u241f${normalized.sizeBytes || ''}`;
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
    if (normalized.encoding === 'dataurl' && /^data:/i.test(normalized.content || '')){
      const parts = String(normalized.content || '').split(',', 2);
      const meta = parts[0] || '';
      const payload = parts[1] || '';
      if (/;base64/i.test(meta)){
        return new Blob([decodeBase64Bytes(payload)], { type: normalized.mime || meta.replace(/^data:|;base64$/gi,'') });
      }
      return new Blob([decodeURIComponent(payload)], { type: normalized.mime || meta.replace(/^data:/i, '') });
    }
    const needsCharset = /^text\//i.test(normalized.mime) || /(json|xml|javascript|svg)/i.test(normalized.mime);
    const type = !needsCharset || /charset=/i.test(normalized.mime)
      ? normalized.mime
      : `${normalized.mime};charset=utf-8`;
    return new Blob([normalized.content], { type });
  }
  async function downloadUrlEntry(entry){
    const normalized = normalizeDownloadEntry(entry);
    if (!normalized.url) return false;
    if (/^data:/i.test(normalized.url)){
      const anchor = document.createElement('a');
      anchor.href = normalized.url;
      anchor.download = normalized.name;
      anchor.rel = 'noopener';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      return true;
    }
    // Important: keep the download inside the same user gesture chain.
    // Many mobile browsers/WebViews block async fetch->download flows.
    try{
      const href = normalized.url;
      const sameOrigin = (() => {
        try{ return new URL(href, location.href).origin === location.origin; }catch(_){ return false; }
      })();
      const anchor = document.createElement('a');
      anchor.href = href;
      if (sameOrigin) anchor.download = normalized.name;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.style.position = 'fixed';
      anchor.style.left = '-9999px';
      anchor.style.top = '-9999px';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      return true;
    }catch(_){
      return false;
    }
  }
  async function downloadStoredItem(downloadId){
    const entry = resolveDownloadEntry(downloadId);
    if (!entry) return false;
    if (entry.encoding === 'url' && entry.url){
      return await downloadUrlEntry(entry);
    }
    downloadBlob(entry.name, buildBlobFromDownload(entry));
    return true;
  }

  function downloadStoredItemInGesture(downloadId){
    const entry = resolveDownloadEntry(downloadId);
    if (!entry) return false;
    // Keep downloads inside a direct user gesture chain (Android/desktop mobile browsers block async downloads).
    if (entry.encoding === 'url' && entry.url){
      const normalized = normalizeDownloadEntry(entry);
      try{
        const anchor = document.createElement('a');
        anchor.href = normalized.url;
        anchor.rel = 'noopener noreferrer';
        anchor.target = '_blank';
        // Only set download attribute for same-origin / data URLs (cross-origin often ignores it).
        if (/^data:/i.test(normalized.url)) anchor.download = normalized.name;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        return true;
      }catch(_){
        try{ window.open(normalized.url, '_blank', 'noopener'); }catch(__){}
        return true;
      }
    }
    try{
      downloadBlob(entry.name, buildBlobFromDownload(entry));
      return true;
    }catch(_){
      return false;
    }
  }
  function estimateDownloadBytes(entry){
    const normalized = normalizeDownloadEntry(entry);
    if (normalized.encoding === 'base64'){
      return Math.floor((String(normalized.content || '').replace(/\s+/g,'').length * 3) / 4);
    }
    if (normalized.encoding === 'dataurl' && /^data:/i.test(normalized.content || '')){
      const payload = String(normalized.content || '').split(',', 2)[1] || '';
      return Math.floor((payload.replace(/\s+/g,'').length * 3) / 4);
    }
    if (normalized.encoding === 'url'){
      return Number(normalized.sizeBytes || 0);
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
  const downloadPreviewUrlCache = new Map();
  function getDownloadPreviewUrl(entry){
    const normalized = normalizeDownloadEntry(entry);
    if (normalized.url && /^(https?:|data:|blob:)/i.test(normalized.url)) return normalized.url;
    const cacheKey = String(normalized.id || normalized.fingerprint || '');
    if (!cacheKey) return '';
    const cached = downloadPreviewUrlCache.get(cacheKey);
    if (cached) return cached;
    try{
      const url = URL.createObjectURL(buildBlobFromDownload(normalized));
      downloadPreviewUrlCache.set(cacheKey, url);
      return url;
    }catch(_){
      return '';
    }
  }
  if (typeof window !== 'undefined' && !window.__aistudioPreviewCleanupBound){
    window.__aistudioPreviewCleanupBound = true;
    window.addEventListener('beforeunload', () => {
      downloadPreviewUrlCache.forEach((url) => {
        try { if (/^blob:/i.test(url)) URL.revokeObjectURL(url); } catch(_){}
      });
      downloadPreviewUrlCache.clear();
    });
  }
  function isOfficeDocumentMime(mime = ''){
    return /(wordprocessingml|msword|presentationml|ms-powerpoint|spreadsheetml|ms-excel)/i.test(String(mime || ''));
  }
  function isWordDocumentMime(mime = ''){
    return /(wordprocessingml|msword)/i.test(String(mime || ''));
  }
  function buildOfficeViewerUrl(rawUrl = ''){
    const direct = String(rawUrl || '').trim();
    if (!/^https:\/\//i.test(direct)) return '';
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(direct)}`;
  }
  function renderAssistantTextPreview(entry){
    const text = String(entry.content || '').trim();
    if (!text) return '';
    const preview = text.length > 1400 ? `${text.slice(0, 1400)}\n...` : text;
    return `<div class="assistant-preview assistant-preview--text"><pre>${escapeHtml(preview)}</pre></div>`;
  }
  function renderAssistantDownloadPreview(entry){
    const normalized = normalizeDownloadEntry(entry);
    const mime = String(normalized.mime || '').toLowerCase();
    const name = String(normalized.name || '').toLowerCase();
    if (/^image\//i.test(mime)){
      const src = getDownloadPreviewUrl(normalized);
      return src ? `<div class="assistant-preview assistant-preview--media"><img class="assistant-preview-media" loading="lazy" alt="${escapeHtml(normalized.name)}" src="${escapeHtml(src)}" /></div>` : '';
    }
    if (/^video\//i.test(mime)){
      const src = getDownloadPreviewUrl(normalized);
      return src ? `<div class="assistant-preview assistant-preview--media"><video class="assistant-preview-media" controls preload="metadata" src="${escapeHtml(src)}"></video></div>` : '';
    }
    if (/^audio\//i.test(mime)){
      const src = getDownloadPreviewUrl(normalized);
      return src ? `<div class="assistant-preview assistant-preview--audio"><audio controls preload="metadata" src="${escapeHtml(src)}"></audio></div>` : '';
    }
    if (mime === 'application/pdf' || /\.pdf$/i.test(name)){
      const src = getDownloadPreviewUrl(normalized);
      return src ? `<div class="assistant-preview assistant-preview--frame"><iframe class="assistant-preview-frame" loading="lazy" referrerpolicy="no-referrer" src="${escapeHtml(src)}#view=FitH"></iframe></div>` : '';
    }
    if (isWordDocumentMime(mime) && normalized.encoding !== 'url'){
      return `<div class="assistant-preview assistant-preview--docx" data-docx-preview-id="${escapeHtml(normalized.id)}">جارٍ تجهيز معاينة Word داخل الدردشة...</div>`;
    }
    if (isOfficeDocumentMime(mime) && normalized.url){
      const viewerUrl = buildOfficeViewerUrl(normalized.url);
      return viewerUrl ? `<div class="assistant-preview assistant-preview--frame"><iframe class="assistant-preview-frame" loading="lazy" referrerpolicy="no-referrer" src="${escapeHtml(viewerUrl)}"></iframe></div>` : '';
    }
    if (/^text\//i.test(mime) || /(json|xml|markdown|csv)/i.test(mime)){
      return renderAssistantTextPreview(normalized);
    }
    return '';
  }
  async function bindAssistantDocxPreviews(scope){
    const nodes = scope?.querySelectorAll?.('[data-docx-preview-id]') || [];
    for (const node of nodes){
      if (node.dataset.loaded === 'true') continue;
      node.dataset.loaded = 'true';
      const entry = resolveDownloadEntry(node.dataset.docxPreviewId);
      if (!entry){
        node.textContent = 'تعذر العثور على المستند المطلوب للمعاينة.';
        continue;
      }
      if (!window.mammoth?.convertToHtml){
        node.textContent = 'معاينة Word غير متاحة في هذه الجلسة. يمكنك تنزيل المستند مباشرة.';
        continue;
      }
      try{
        const blob = buildBlobFromDownload(entry);
        const arrayBuffer = await blob.arrayBuffer();
        const result = await window.mammoth.convertToHtml({ arrayBuffer });
        const html = sanitizeRenderedHtml(result?.value || '');
        node.innerHTML = html || '<div class="assistant-preview-empty">المستند جاهز للتنزيل.</div>';
      }catch(_){
        node.textContent = 'تعذر معاينة Word داخل الدردشة. يمكنك تنزيله أو فتحه خارجيًا.';
      }
    }
  }

  function downloadBlob(filename, blob){
    const safeName = String(filename || 'download').trim() || 'download';
    const safeBlob = (blob instanceof Blob) ? blob : new Blob([blob], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(safeBlob);
    const isCoarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
    const isNarrow = typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 980px)').matches;
    const isMobileLike = isCoarse || isNarrow;

    const a = document.createElement('a');
    a.href = url;
    a.download = safeName;
    a.rel = 'noopener';
    a.target = '_blank';
    a.style.position = 'fixed';
    a.style.left = '-9999px';
    a.style.top = '-9999px';
    document.body.appendChild(a);

    let clicked = false;
    try{
      a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      clicked = true;
    }catch(_){
      try{
        a.click();
        clicked = true;
      }catch(__){
        clicked = false;
      }
    }

    if (!clicked){
      try{ window.open(url, '_blank', 'noopener'); }catch(_){}
    }

    a.remove();
    setTimeout(() => { try{ URL.revokeObjectURL(url); }catch(_){ } }, isMobileLike ? 120000 : 12000);
  }

  function parseFileBlocks(text){
    const s = String(text || '');
    const re = getFileBlockRegex();
    const out = [];
    let m;
    while ((m = re.exec(s))){
      const attrs = parseBlockAttributes(m[1]);
      const url = sanitizeDownloadUrl(attrs.url || attrs.href || '');
      const name = String(attrs.name || '').trim() || extractFilenameFromUrl(url, '');
      const mime = String(attrs.mime || '').trim() || inferMimeFromName(name || extractFilenameFromUrl(url)) || 'application/octet-stream';
      const encoding = String(attrs.encoding || (url ? 'url' : 'text')).trim().toLowerCase();
      const content = m[2] || '';
      if (!name || (!url && !content)) continue;
      out.push({
        name,
        mime,
        encoding,
        url,
        sizeBytes: toFiniteNumber(attrs.size || attrs.bytes),
        content
      });
    }
    return out;
  }
  function stripFileBlocks(text){
    const withoutBlocks = String(text || '').replace(getFileBlockRegex(), '');
    return extractLooseBinaryPayloads(withoutBlocks).text;
  }
  function ensureDownloadsFromText(text, sourceMessageId=''){
    const blocks = parseFileBlocks(text);
    const withoutBlocks = String(text || '').replace(getFileBlockRegex(), '');
    const loose = extractLooseBinaryPayloads(withoutBlocks);
    const links = extractDownloadLinksFromText(loose.text);
    const items = [...blocks, ...loose.entries, ...links];
    if (!items.length) return { entries: [], newCount: 0 };
    const entries = [];
    let newCount = 0;
    for (const b of items){
      const saved = upsertDownload({
        name: b.name,
        mime: b.mime,
        encoding: b.encoding,
        url: b.url,
        sizeBytes: b.sizeBytes,
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
  async function callOpenAIChat({ apiKey, baseUrl, model, messages, max_tokens, signal, extraHeaders={}, modalities=[] }){
    const url = baseUrl.replace(/\/+$/,'') + '/chat/completions';
    const body = { model, messages, max_tokens, temperature: 0.25 };
    if (Array.isArray(modalities) && modalities.length) body.modalities = modalities;
    const r = await fetch(url, {
      method:'POST',
      headers: { 'Content-Type':'application/json', ...extraHeaders, ...buildAuthHeaders(getSettings()) },
      body: JSON.stringify(body),
      signal
    });
    const t = await r.text();
    let j; try{ j = JSON.parse(t); }catch(_){ j = null; }
    if (!r.ok) throw new Error(extractApiErrorMessage(j, t, r.status));

    const extracted = extractAssistantResponseData(j);
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
  function normalizeGeneratedAssetEntry(raw, index){
    if (!raw || typeof raw !== 'object') return null;
    const directUrl = raw.image_url?.url || raw.url || raw.href || raw.data_url || '';
    const directMime = String(raw.mime_type || raw.mime || inferMimeFromDataUrl(directUrl) || '').trim().toLowerCase();
    const b64 = String(raw.b64_json || raw.base64 || raw.content || '').trim();
    const url = sanitizeDownloadUrl(directUrl) || (b64 ? `data:${directMime || 'image/png'};base64,${b64}` : '');
    if (!url) return null;
    const mime = directMime || inferMimeFromDataUrl(url) || inferMimeFromName(raw.name || extractFilenameFromUrl(url, '')) || 'image/png';
    const ext = inferExtensionFromMime(mime);
    const fallbackName = `generated-asset-${index}.${ext}`;
    const name = sanitizeBlockAttrValue(raw.name || extractFilenameFromUrl(url, fallbackName)) || fallbackName;
    return {
      name,
      mime,
      url,
      encoding: 'url'
    };
  }
  function collectGeneratedAssetEntries(target, candidate){
    const list = Array.isArray(candidate) ? candidate : [candidate];
    for (const item of list){
      if (!item) continue;
      let normalized = null;
      if (item?.type === 'image_url' && item?.image_url?.url){
        normalized = normalizeGeneratedAssetEntry({ image_url: item.image_url, mime_type: item.mime_type, name: item.name }, target.length + 1);
      } else if (item?.type === 'output_image' || item?.type === 'image'){
        normalized = normalizeGeneratedAssetEntry(item, target.length + 1);
      } else if (item?.image_url?.url || item?.url || item?.href || item?.b64_json || item?.base64){
        normalized = normalizeGeneratedAssetEntry(item, target.length + 1);
      }
      if (!normalized) continue;
      const duplicate = target.some((entry) => entry.url === normalized.url || (entry.name === normalized.name && entry.mime === normalized.mime));
      if (!duplicate) target.push(normalized);
    }
  }
  function extractAssistantGeneratedAssets(payload){
    const assets = [];
    collectGeneratedAssetEntries(assets, payload?.images);

    const outputEntries = [
      ...(Array.isArray(payload?.output) ? payload.output : []),
      ...(Array.isArray(payload?.response?.output) ? payload.response.output : [])
    ];
    outputEntries.forEach((entry) => {
      collectGeneratedAssetEntries(assets, entry?.images);
      collectGeneratedAssetEntries(assets, entry?.content);
      collectGeneratedAssetEntries(assets, entry?.message?.images);
    });

    const choices = Array.isArray(payload?.choices) ? payload.choices : [];
    choices.forEach((choice) => {
      collectGeneratedAssetEntries(assets, choice?.images);
      collectGeneratedAssetEntries(assets, choice?.message?.images);
      collectGeneratedAssetEntries(assets, choice?.delta?.images);
      collectGeneratedAssetEntries(assets, choice?.message?.content);
      collectGeneratedAssetEntries(assets, choice?.delta?.content);
    });
    return assets;
  }
  function extractAssistantResponseData(payload){
    const textResult = extractAssistantText(payload);
    const generatedAssets = extractAssistantGeneratedAssets(payload);
    const assetBlocks = generatedAssets.map((entry) => buildInlineFileBlock(entry));
    const combinedText = [String(textResult.text || '').trim(), assetBlocks.join('\n\n')]
      .filter(Boolean)
      .join('\n\n')
      .trim();
    if (combinedText){
      return { text: combinedText, diagnostic:'', assets: generatedAssets };
    }
    return { text:'', diagnostic:textResult.diagnostic || 'EMPTY_ASSISTANT_RESPONSE', assets: generatedAssets };
  }
  function getRequestedOutputModalities(settings, modelId = '', messages = []){
    const descriptor = getModelDescriptor(modelId || settings.model || '', settings.provider || '');
    if (!descriptor?.capabilities?.image_generation) return [];
    const latestUser = [...(Array.isArray(messages) ? messages : [])].reverse().find((message) => message?.role === 'user');
    const promptText = textFromPart(latestUser?.content).toLowerCase();
    if (!/(generate|create|make|draw|render|design|illustrat|image|picture|photo|poster|logo|icon|banner|wallpaper|portrait|thumbnail|storyboard|صورة|صور|ارسم|أنشئ صورة|انشئ صورة|ولد صورة|ولّد صورة|تصميم|شعار|بوستر|بانر|خلفية|أيقونة|ايقونة)/i.test(promptText)){
      return [];
    }
    const outputModalities = (Array.isArray(descriptor.outputModalities) ? descriptor.outputModalities : []).map((value) => String(value || '').toLowerCase());
    if (outputModalities.includes('image') && outputModalities.includes('text')) return ['image', 'text'];
    if (outputModalities.includes('image')) return ['image'];
    return ['image', 'text'];
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

  async function callOpenAIChat({ apiKey, baseUrl, model, messages, max_tokens, signal, extraHeaders={}, modalities=[] }){
    const run = async () => {
      const currentSettings = getSettings();
      const resolvedBaseUrl = String(baseUrl || effectiveBaseUrl(currentSettings) || '').replace(/\/+$/,'');
      const url = resolvedBaseUrl + '/chat/completions';
      const body = { model, messages, max_tokens, temperature: 0.25 };
      if (Array.isArray(modalities) && modalities.length) body.modalities = modalities;
      const r = await fetch(url, {
        method:'POST',
        headers: { 'Content-Type':'application/json', ...extraHeaders, ...buildAuthHeaders(currentSettings) },
        body: JSON.stringify(body),
        signal
      });
      const t = await r.text();
      let j; try{ j = JSON.parse(t); }catch(_){ j = null; }
      if (!r.ok) throw new Error(extractApiErrorMessage(j, t, r.status));

      const extracted = extractAssistantResponseData(j);
      if (!String(extracted.text || '').trim()){
        throw new Error(extracted.diagnostic || 'EMPTY_ASSISTANT_RESPONSE');
      }
      recordUsageFromPayload(j, { source: 'chat_completion', settings: currentSettings, model });
      return extracted.text;
    };

    try{
      return await run();
    }catch(err){
      const repaired = repairGatewayAfterAccessIssue(err);
      if (repaired){
        return run();
      }
      throw err;
    }
  }

  async function streamChatCompletions({ apiKey, baseUrl, model, messages, max_tokens, signal, onDelta, extraHeaders={} }){
    const run = async () => {
      const currentSettings = getSettings();
      const resolvedBaseUrl = String(baseUrl || effectiveBaseUrl(currentSettings) || '').replace(/\/+$/,'');
      const url = resolvedBaseUrl + '/chat/completions';
      const body = { model, messages, max_tokens, temperature: 0.25, stream: true };
      const r = await fetch(url, {
        method:'POST',
        headers: { 'Content-Type':'application/json', ...extraHeaders, ...buildAuthHeaders(currentSettings) },
        body: JSON.stringify(body),
        signal
      });
      if (!r.ok){
        const t = await r.text().catch(()=> '');
        let j; try{ j=JSON.parse(t);}catch(_){j=null;}
        throw new Error(j?.error?.message || t || `HTTP ${r.status}`);
      }

      const contentType = String(r.headers.get('content-type') || '').toLowerCase();
      if (contentType.includes('application/json')){
        const t = await r.text();
        let j; try{ j = JSON.parse(t); }catch(_){ j = null; }
        const oneShot = extractAssistantResponseData(j);
        if (!String(oneShot.text || '').trim()){
          throw new Error(oneShot.diagnostic || 'STREAM_EMPTY_RESPONSE');
        }
        recordUsageFromPayload(j, { source: 'chat_stream_json', settings: currentSettings, model });
        return String(oneShot.text || '');
      }

      const reader = r.body.getReader();
      const dec = new TextDecoder('utf-8');
      let buf = '';
      let full = '';
      const streamMeta = { generationId:'', model:String(model || '').trim(), usage:null };
      let streamDone = false;
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
          if (payload === '[DONE]'){
            streamDone = true;
            break;
          }
          let j; try{ j = JSON.parse(payload); }catch(_){ continue; }
          if (!streamMeta.generationId) streamMeta.generationId = String(j?.id || j?.generation_id || '').trim();
          if (!streamMeta.model) streamMeta.model = String(j?.model || '').trim();
          if (j?.usage && typeof j.usage === 'object') streamMeta.usage = j.usage;
          const delta = textFromPart(j?.choices?.[0]?.delta?.content) || textFromPart(j?.choices?.[0]?.delta);
          if (delta){
            full += delta;
            onDelta?.(delta, full);
          }
        }
        if (streamDone) break;
      }

      const tail = (buf || '').trim();
      if (tail.startsWith('data:')){
        const payload = tail.slice(5).trim();
        if (payload && payload !== '[DONE]'){
          let j; try{ j = JSON.parse(payload); }catch(_){ j = null; }
          if (!streamMeta.generationId) streamMeta.generationId = String(j?.id || j?.generation_id || '').trim();
          if (!streamMeta.model) streamMeta.model = String(j?.model || '').trim();
          if (j?.usage && typeof j.usage === 'object') streamMeta.usage = j.usage;
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
      if (streamMeta.usage || streamMeta.generationId || streamMeta.model){
        recordUsageFromPayload({
          id: streamMeta.generationId,
          model: streamMeta.model,
          usage: streamMeta.usage || {}
        }, { source: 'chat_stream_sse', settings: currentSettings, model: streamMeta.model || model });
      }
      return full;
    };

    try{
      return await run();
    }catch(err){
      const repaired = repairGatewayAfterAccessIssue(err);
      if (repaired){
        return run();
      }
      throw err;
    }
  }

  // ---------------- Prompts and messages ----------------
  function buildSelectedModelCapabilityContract(settings){
    const descriptor = getModelDescriptor(settings.model || '', settings.provider || '');
    const profile = descriptor.capabilities || buildModelCapabilityProfile(descriptor);
    const lines = [];
    if (descriptor.id){
      lines.push(`[Model profile] النموذج الحالي: ${descriptor.name || descriptor.id}. القدرات المرجحة: ${summarizeModelCapabilities(descriptor, 6)}.`);
    }
    if (profile.documents) lines.push('[Documents] عند طلب تقرير أو عرض أو مستند، أخرج المحتوى النهائي داخل file blocks بصيغ مثل markdown أو docx أو pptx أو xlsx عند الحاجة.');
    if (profile.coding) lines.push('[Coding] عند طلب البرمجة، قدّم مشروعًا منظمًا، ملفات قابلة للتنزيل، وتعليمات تشغيل مختصرة بدل الرد النظري فقط.');
    if (profile.image_generation) lines.push('[Images] إذا كان المزود الحالي يعيد أصولًا مرئية مباشرة فأخرجها كملف image داخل file/url blocks. وإذا لم يكن الأصل المباشر متاحًا، فأخرج prompt pack أو SVG/PNG قابلًا للتنزيل.');
    if (profile.video) lines.push('[Video] إذا كان المزود الحالي يدعم مخرجات فيديو مباشرة فاستخدم file/url blocks. وإذا لم تكن الأصول المباشرة متاحة، فاخرج storyboard أو shot list أو script إنتاجي قابل للتنزيل.');
    if (profile.audio) lines.push('[Audio] استخدم file/url blocks لملفات الصوت أو التفريغ، ولا تعرض payload ثنائيًا خامًا داخل النص.');
    if (profile.vision) lines.push('[Vision] عند وجود صور أو ملفات مرئية، استخدم محتوى المرفقات والسياق المرئي قبل الرد.');
    return lines.join('\n');
  }
  function buildSystemPrompt(settings){
    const policy = getAppRuntimePolicy(settings);
    const modes = getEffectiveModeState(settings, policy);
    let sys = settings.systemPrompt || 'أنت مساعد احترافي. أجب بدقة وبأسلوب منظم.';
    const capabilityContract = buildSelectedModelCapabilityContract(settings);
    const voiceContract = buildVoiceInteractionContract(settings);
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
          + "\\n```tool name=\"download_file\"\\n{\"name\":\"slides.pptx\",\"mime\":\"application/vnd.openxmlformats-officedocument.presentationml.presentation\",\"encoding\":\"base64\",\"content\":\"...\"}\\n```"
          + "\\n```tool name=\"download_file\"\\n{\"name\":\"video.mp4\",\"mime\":\"video/mp4\",\"url\":\"https://...\"}\\n```"
          + "\\n- لا تكتب إجابة نهائية في نفس الرد الذي يطلب أداة. بعد نتيجة الأداة سأطلب منك المتابعة.";
    }
    sys += "\\n\\n[Files] إذا أنشأت ملفًا للمستخدم فضعه داخل بلوك file بهذا الشكل:"
        + "\\n```file name=\"report.md\" mime=\"text/markdown\"\\nمحتوى الملف هنا\\n```"
        + "\\n```file name=\"slides.pptx\" mime=\"application/vnd.openxmlformats-officedocument.presentationml.presentation\" encoding=\"base64\"\\n...\\n```"
        + "\\n```file name=\"video.mp4\" mime=\"video/mp4\" url=\"https://...\"\\n```"
        + "\\nاستخدم encoding=\"base64\" للملفات الثنائية مثل PowerPoint وExcel وZIP والصور والفيديو، أو url عندما يكون الملف مستضافًا على رابط مباشر."
        + "\\nوسيحوّل التطبيق هذا البلوك تلقائيًا إلى رابط وزر تنزيل داخل الدردشة. لا تكرر محتوى الملف خارج هذا البلوك إلا إذا طلب المستخدم ذلك."
        + "\\nممنوع إظهار base64 الخام أو البايتات الثنائية كنص مرئي داخل الرسالة.";
    if (voiceContract) sys += `\n\n${voiceContract}`;
    if (capabilityContract) sys += `\n\n${capabilityContract}`;
    return sys;
  }

  function buildVoiceInteractionContract(settings){
    const descriptor = getModelDescriptor(settings.model || '', settings.provider || '');
    const profile = descriptor.capabilities || buildModelCapabilityProfile(descriptor);
    const lines = [
      '[Voice chat]',
      '- This app handles speech recognition and speech playback outside the model.',
      '- Never say that you cannot voice chat, speak, or listen just because the selected model is text-first.',
      '- Treat spoken or transcribed Arabic input exactly like normal chat input, then answer naturally.',
      '- Mention limitations only when the user asks for downloadable audio files, native realtime audio streaming, cloned voices, or studio-grade generated speech from the model itself.'
    ];
    if (profile.arabic_support || profile.arabic_voice_chat){
      lines.push('- Prefer clear Modern Standard Arabic unless the user explicitly asks for another dialect.');
    }
    if (profile.audio){
      lines.push('- If audio assets are requested, return them as file/url blocks instead of binary text.');
    }
    return lines.join('\n');
  }
  function buildActiveVoiceSessionContract(){
    if (!getVoiceModeEnabled()) return '';
    return [
      '[Active voice session]',
      '- Voice mode is enabled in the app right now.',
      '- Keep replies concise, natural, and easy to speak aloud.',
      '- Avoid long lists unless the user explicitly asks for structure.',
      '- Do not repeat meta-disclaimers about voice support unless the user asks.'
    ].join('\n');
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
      const mime = String(args.mime || inferMimeFromName(fname) || 'application/octet-stream').trim() || 'application/octet-stream';
      const content = String(args.content || '');
      const encoding = String(args.encoding || (args.url ? 'url' : 'text')).trim().toLowerCase();
      const url = sanitizeDownloadUrl(args.url || args.href || '');
      const pid = getCurProjectId();
      addDownload(pid, {
        name: fname,
        mime,
        encoding,
        url,
        content,
        sizeBytes: toFiniteNumber(args.size || args.bytes)
      });
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
      const toolMeta = buildAssistantMessageModelMeta(runtimeSettings, runtimeSettings.model);
      thread.messages.push({ id: makeId('m'), role:'assistant', ts: nowTs(),
        content: `🧰 TOOL RESULT (${tc.name})\n\n${result}`, ...toolMeta });
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
      thread2.messages.push({ id: makeId('m'), role:'assistant', ts: nowTs(), content: String(ans||''), ...buildAssistantMessageModelMeta(runtimeSettings, model) });
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
    if (/no\s+(?:cookie|kookie)\s+auth\s+credential/i.test(msg)) return 'تعذر الوصول إلى البوابة بهذه الإعدادات (مسار محمي أو غير صالح). تمت مزامنة رابط البوابة الإنتاجي تلقائيًا؛ إذا استمر الخطأ حدّث الصفحة ثم جرّب مرة أخرى.';
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
    if (/no\s+(?:cookie|kookie)\s+auth\s+credential/i.test(msg)) return 'تعذر الوصول إلى خدمة التحويل السحابي بهذا الرابط. راجع إعدادات رابط التحويل في الإعدادات أو حدّث الصفحة بعد المزامنة التلقائية.';
    if (/insufficient\s+(credits?|balance)|not enough credits?|quota.*exceeded|billing|payment required|402\b/i.test(msg)) return 'نفد رصيد خدمة التحويل أو رصيد المزود المرتبط بها. يلزم شحن الرصيد أو استخدام المسار المحلي.';
    if (/not_found|المسار المطلوب غير موجود/i.test(msg)) return 'رابط التحويل السحابي الحالي غير صحيح أو قديم. تم تحديث التطبيق لاستخدام المسار الصحيح؛ حدّث الصفحة أو أعد فتح التطبيق ثم جرّب مرة أخرى.';
    if (/cloudconvert_base64_limit_exceeded/i.test(msg)) return 'هذا الملف يتجاوز حد الحجم المسموح لمسار المطابقة العالية عبر CloudConvert في الخطة الحالية. استخدم ملفًا أصغر أو المسار المحلي.';
    if (/cloudconvert_(?:job_failed|job_error|export_missing)/i.test(msg)) return 'محرك CloudConvert للمطابقة العالية لم يكمل إنشاء ملف Word صالح. تحقق من الرصيد أو أعد المحاولة أو استخدم المسار المحلي.';
    if (/docx_upstream_failed|docx_upstream_empty|docx_upstream_bad_json/i.test(msg)) return 'خدمة المطابقة العالية لتحويل PDF إلى Word متصلة لكنها لم ترجع ملف Word صالحًا. يمكن استخدام المسار الهيكلي أو ضبط محرك المطابقة العالية.';
    if (/failed to fetch|networkerror|load failed|network request failed|cors/i.test(msg)) return 'تعذر الاتصال بخدمة التحويل السحابي. تحقق من الرابط أو من الحماية على الخدمة.';
    return msg;
  }

  
  function buildAutoFilesContext(settings){
    const explicit = String($('filesText')?.value || '');
    return explicit.trim() ? explicit : '';
  }

  const MAX_CHAT_INLINE_MEDIA_BYTES = 4 * 1024 * 1024;

  function snapshotAttachmentsForMessage(list){
    const arr = Array.isArray(list) ? list : [];
    return arr.map((a) => {
      const kind = String(a?.kind || '').toLowerCase();
      let dataUrl = String(a?.dataUrl || '').trim();
      if (dataUrl && (kind === 'image' || kind === 'video' || kind === 'audio')){
        const approxBytes = Math.floor(dataUrl.length * 0.75);
        if (approxBytes > MAX_CHAT_INLINE_MEDIA_BYTES) dataUrl = '';
      }
      return {
        name: String(a?.name || 'مرفق'),
        kind,
        type: String(a?.type || ''),
        size: Number(a?.size || 0),
        dataUrl
      };
    });
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
    if (kind === 'presentation') return 'عرض';
    if (kind === 'spreadsheet') return 'جدول';
    if (kind === 'audio') return 'صوت';
    if (kind === 'video') return 'فيديو';
    if (kind === 'archive') return 'أرشيف';
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
    const activeVoiceSessionContract = buildActiveVoiceSessionContract();
    if (activeVoiceSessionContract){
      msgs.push({ role:'system', content: activeVoiceSessionContract });
    }
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
  let composerEditState = { active:false, sourceMessageId:'', sourceRole:'', mutateThread:false };

  function getModelDescriptor(modelId = '', fallbackProvider = ''){
    const id = String(modelId || '').replace(/:online$/,'').trim();
    if (!id) return decorateModelRecord({ id:'', name:'', provider:fallbackProvider || '', ctx:null, pp:null, pc:null, tools:false, vision:false, modality:'' });
    const cached = loadJSON(KEYS.modelCache, {})?.models || [];
    const hit = cached.find((model) => String(model.id || '').trim() === id);
    if (hit) return decorateModelRecord(hit);
    return decorateModelRecord({
      id,
      name: id,
      provider: fallbackProvider || String(id).split('/')[0] || '',
      ctx: null,
      pp: null,
      pc: null,
      tools: false,
      vision: false,
      modality: ''
    });
  }
  function buildAssistantMessageModelMeta(settings = getSettings(), modelId = ''){
    const descriptor = getModelDescriptor(modelId || settings.model || '', settings.provider || '');
    return {
      modelId: String(descriptor.id || '').trim(),
      modelName: String(descriptor.name || descriptor.id || '').trim(),
      modelPrimaryCategory: String(descriptor.primaryCategory || '').trim(),
      modelCategories: Array.isArray(descriptor.categories) ? descriptor.categories.slice() : [],
      modelCapabilityKeys: Array.isArray(descriptor.capabilityKeys) ? descriptor.capabilityKeys.slice() : []
    };
  }
  function formatMessageMetaLine(message = {}){
    const parts = [
      message.role === 'user' ? 'المستخدم' : 'المساعد',
      new Date(message.ts || nowTs()).toLocaleString('ar')
    ];
    if (message.role === 'assistant' && (message.modelId || message.modelName)){
      const modelLabel = String(message.modelName || message.modelId || '').trim();
      if (modelLabel) parts.push(`النموذج: ${modelLabel}`);
    }
    if (message.role === 'user' && message.requestModelId){
      const requestDescriptor = getModelDescriptor(String(message.requestModelId || '').trim(), '');
      const requestLabel = String(requestDescriptor.name || requestDescriptor.id || message.requestModelId || '').trim();
      if (requestLabel) parts.push(`الإرسال عبر: ${requestLabel}`);
    }
    if (message.role === 'user' && message.engineeredPrompt){
      parts.push('Prompt Engineering');
    }
    if (message.editedAt) parts.push('معدلة');
    return parts.join(' • ');
  }
  function setComposerEditState(state = null){
    composerEditState = state?.active
      ? {
          active: true,
          sourceMessageId: String(state.sourceMessageId || '').trim(),
          sourceRole: String(state.sourceRole || '').trim(),
          mutateThread: !!state.mutateThread
        }
      : { active:false, sourceMessageId:'', sourceRole:'', mutateThread:false };
    const cancelBtn = $('composerEditCancelBtn');
    if (cancelBtn) cancelBtn.style.display = composerEditState.active ? 'inline-flex' : 'none';
    syncComposerMeta();
  }
  function clearComposerEditState(){
    setComposerEditState(null);
  }
  function loadMessageIntoComposer(message){
    const input = $('chatInput');
    if (!input || !message) return;
    const sourceText = message.role === 'assistant'
      ? (stripFileBlocks(message.content || '') || String(message.content || ''))
      : String(message.content || '');
    input.value = sourceText;
    resizeComposerInput(input);
    setComposerEditState({
      active: true,
      sourceMessageId: String(message.id || '').trim(),
      sourceRole: String(message.role || '').trim(),
      mutateThread: message.role === 'user'
    });
    syncComposerMeta();
    openWorkspacePage('chat');
    input.focus();
    toast(message.role === 'user'
      ? '✅ عدّل الرسالة ثم أرسلها لإعادة التوليد من نفس النقطة.'
      : '✅ تم تحميل نص الرسالة في المحرر لتعديله أو إعادة استخدامه.');
  }

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
          <div class="assistant-download-card">
            ${renderAssistantDownloadPreview(entry)}
            <a href="#" class="assistant-download-link" data-download-id="${escapeHtml(entry.id)}">
              <span class="assistant-download-name">${escapeHtml(entry.name)}</span>
              <span class="assistant-download-meta">${escapeHtml(entry.mime)} • ${escapeHtml(entry.encoding === 'url' ? ((estimateDownloadBytes(entry) > 0 ? formatCompactBytes(estimateDownloadBytes(entry)) : 'رابط تنزيل مباشر')) : formatCompactBytes(estimateDownloadBytes(entry)))}</span>
            </a>
          </div>
        `).join('')}
      </div>`;
  }

  function renderUserAttachmentPreviewsHtml(previews){
    const list = Array.isArray(previews) ? previews : [];
    if (!list.length) return '';
    const blocks = list.map((p) => {
      const name = escapeHtml(p.name || 'مرفق');
      const kind = String(p.kind || '').toLowerCase();
      const src = String(p.dataUrl || '').trim();
      if (kind === 'image' && src){
        return `<div class="chat-inline-media chat-inline-media--dark"><img class="chat-inline-media-el" loading="lazy" alt="${name}" src="${escapeHtml(src)}" /></div>`;
      }
      if (kind === 'video' && src){
        return `<div class="chat-inline-media chat-inline-media--dark"><video class="chat-inline-media-el" controls playsinline preload="metadata" src="${escapeHtml(src)}"></video></div>`;
      }
      if (kind === 'audio' && src){
        return `<div class="chat-inline-media chat-inline-media--audio"><audio controls preload="metadata" src="${escapeHtml(src)}"></audio></div>`;
      }
      const meta = `${escapeHtml(formatAttachmentKindLabel(p))}${p.size ? ` • ${escapeHtml(formatCompactBytes(p.size))}` : ''}`;
      return `<div class="chat-inline-file-card"><span class="chat-inline-file-name">${name}</span><span class="chat-inline-file-meta">${meta}</span></div>`;
    });
    return `<div class="chat-user-attachments">${blocks.join('')}</div>`;
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
        const ok = downloadStoredItemInGesture(el.dataset.downloadId);
        if (!ok) toast('⚠️ تعذر العثور على الملف المطلوب');
      });
    });
    bindAssistantDocxPreviews(scope).catch(() => {});
  }

  // ---------------- Assistant artifacts (download-as) ----------------
  const ARTIFACT_LIBS = {
    jszip: { url: 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js', check: () => !!window.JSZip },
    xlsx: { url: 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js', check: () => !!window.XLSX },
    pptx: { url: 'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js', check: () => !!window.PptxGenJS },
    jspdf: { url: 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js', check: () => !!(window.jspdf && window.jspdf.jsPDF) }
  };
  const ARTIFACT_FORMATS = [
    { id:'txt', label:'TXT' },
    { id:'md', label:'Markdown' },
    { id:'html', label:'HTML' },
    { id:'json', label:'JSON' },
    { id:'csv', label:'CSV' },
    { id:'docx', label:'DOCX' },
    { id:'pdf', label:'PDF' },
    { id:'xlsx', label:'XLSX' },
    { id:'pptx', label:'PPTX' },
    { id:'zip', label:'ZIP (جمع الملفات)' },
  ];

  function loadScriptOnce(url){
    const href = String(url || '').trim();
    if (!href) return Promise.reject(new Error('missing_script_url'));
    if (!window.__aistudioScripts) window.__aistudioScripts = new Map();
    const cache = window.__aistudioScripts;
    if (cache.has(href)) return cache.get(href);
    const p = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = href;
      s.async = true;
      s.onload = () => resolve(true);
      s.onerror = () => reject(new Error(`script_load_failed ${href}`));
      document.head.appendChild(s);
    });
    cache.set(href, p);
    return p;
  }
  async function ensureArtifactLib(kind){
    const spec = ARTIFACT_LIBS[kind];
    if (!spec) return true;
    if (spec.check()) return true;
    await loadScriptOnce(spec.url);
    return !!spec.check();
  }

  function ensureArtifactModal(){
    if ($('artifactModal')) return;
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'artifactModal';
    modal.innerHTML = `
      <div class="backdrop" data-artifact-close="1"></div>
      <div class="panel" role="dialog" aria-modal="true" aria-label="تنزيل الرد كملف">
        <div class="head">
          <div class="title">تنزيل الرد كملف</div>
          <button class="btn ghost sm" data-artifact-close="1">إغلاق</button>
        </div>
        <div class="body">
          <div class="row">
            <div class="col">
              <div class="hint">الصيغة</div>
              <select id="artifactFormat"></select>
            </div>
            <div class="col">
              <div class="hint">اسم الملف</div>
              <input id="artifactFilename" type="text" placeholder="output.txt" />
            </div>
          </div>
          <div class="hint" style="margin-top:10px">سيتم تنزيل محتوى الرد الحالي. في ZIP سيتم جمع الملفات المُستخرجة من الرسالة (إن وجدت).</div>
          <div style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
            <button class="btn" id="artifactDownloadBtn">⬇ تنزيل</button>
            <span class="hint" id="artifactStatus"></span>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);

    const sel = $('artifactFormat');
    if (sel){
      sel.innerHTML = ARTIFACT_FORMATS.map((f) => `<option value="${escapeHtml(f.id)}">${escapeHtml(f.label)}</option>`).join('');
    }
    modal.querySelectorAll('[data-artifact-close="1"]').forEach((el) => {
      el.addEventListener('click', () => closeArtifactModal());
    });
  }
  function openArtifactModal(payload){
    ensureArtifactModal();
    const modal = $('artifactModal');
    if (!modal) return;
    modal.dataset.mid = String(payload?.mid || '');
    modal.dataset.title = String(payload?.title || '');
    modal.dataset.text = String(payload?.text || '');
    modal.dataset.downloadCount = String(payload?.downloads?.length || 0);

    const fmt = $('artifactFormat');
    const name = $('artifactFilename');
    const status = $('artifactStatus');
    if (status) status.textContent = '';
    if (fmt) fmt.value = 'md';
    if (name){
      const base = sanitizeBlockAttrValue(payload?.title || 'assistant') || 'assistant';
      name.value = `${base}.md`;
    }
    if (fmt && name){
      fmt.addEventListener('change', () => {
        const base = (name.value || 'assistant').replace(/\.[a-z0-9]+$/i,'') || 'assistant';
        name.value = `${base}.${fmt.value}`;
      }, { once: true });
    }
    const btn = $('artifactDownloadBtn');
    if (btn && btn.dataset.bound !== 'true'){
      btn.dataset.bound = 'true';
      btn.addEventListener('click', () => runArtifactDownload().catch(() => {}));
    }
    modal.classList.add('show');
  }
  function closeArtifactModal(){
    const modal = $('artifactModal');
    if (!modal) return;
    modal.classList.remove('show');
  }

  function pickMessageDownloads(mid){
    const b = $('chatLog')?.querySelector?.(`.bubble.assistant[data-mid="${CSS.escape(String(mid||''))}"]`);
    if (!b) return [];
    // downloads are already stored in localStorage; we only need the IDs.
    const ids = Array.from(b.querySelectorAll('[data-download-id]')).map((el) => el.dataset.downloadId).filter(Boolean);
    return ids.map((id) => resolveDownloadEntry(id)).filter(Boolean);
  }

  function extractLikelyJson(text){
    const s = String(text || '').trim();
    if (!s) return null;
    // Try direct JSON, or first fenced code block.
    try{ return JSON.parse(s); }catch(_){}
    const m = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (m){
      try{ return JSON.parse(String(m[1] || '').trim()); }catch(_){}
    }
    return null;
  }
  function extractLikelyCsv(text){
    const s = String(text || '').trim();
    if (!s) return '';
    const m = s.match(/```(?:csv)?\s*([\s\S]*?)```/i);
    return String((m ? m[1] : s) || '').trim();
  }

  async function buildArtifactBlob({ format, filename, text, downloads }){
    const fmt = String(format || 'txt').toLowerCase();
    const name = String(filename || 'download').trim() || 'download';
    const rawText = String(text || '');

    if (fmt === 'zip'){
      await ensureArtifactLib('jszip');
      if (!window.JSZip) throw new Error('ZIP_LIB_MISSING');
      const zip = new window.JSZip();
      const list = Array.isArray(downloads) ? downloads.filter(Boolean) : [];
      if (list.length){
        for (const entry of list){
          const n = sanitizeBlockAttrValue(entry.name || '') || 'download.bin';
          const blob = entry.encoding === 'url' && entry.url ? null : buildBlobFromDownload(entry);
          if (blob){
            zip.file(n, blob);
          }else if (entry.url){
            zip.file(`${n}.url.txt`, String(entry.url || '').trim());
          }
        }
      }else{
        zip.file(name.replace(/\.zip$/i,'') + '.md', rawText || '');
      }
      const out = await zip.generateAsync({ type:'blob' });
      return { blob: out, mime:'application/zip', filename: name.endsWith('.zip') ? name : `${name}.zip` };
    }

    if (fmt === 'json'){
      const payload = extractLikelyJson(rawText);
      if (!payload) throw new Error('INVALID_JSON');
      const normalized = JSON.stringify(payload, null, 2);
      return { blob: new Blob([normalized], { type:'application/json;charset=utf-8' }), mime:'application/json', filename: name.endsWith('.json') ? name : `${name}.json` };
    }

    if (fmt === 'csv'){
      const csv = extractLikelyCsv(rawText);
      return { blob: new Blob([csv], { type:'text/csv;charset=utf-8' }), mime:'text/csv', filename: name.endsWith('.csv') ? name : `${name}.csv` };
    }

    if (fmt === 'md'){
      return { blob: new Blob([rawText], { type:'text/markdown;charset=utf-8' }), mime:'text/markdown', filename: name.endsWith('.md') ? name : `${name}.md` };
    }
    if (fmt === 'html'){
      const html = (window.marked ? sanitizeRenderedHtml(window.marked.parse(String(rawText || ''))) : `<pre>${escapeHtml(rawText)}</pre>`);
      const doc = `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>${escapeHtml(name)}</title><body>${html}</body></html>`;
      return { blob: new Blob([doc], { type:'text/html;charset=utf-8' }), mime:'text/html', filename: name.endsWith('.html') ? name : `${name}.html` };
    }
    if (fmt === 'docx'){
      const toDocx = getHtmlToDocxFn?.() || null;
      if (!toDocx) throw new Error('DOCX_CONVERTER_MISSING');
      const html = (window.marked ? sanitizeRenderedHtml(window.marked.parse(String(rawText || ''))) : `<pre>${escapeHtml(rawText)}</pre>`);
      const bin = await toDocx(html, { orientation:'portrait' });
      return { blob: new Blob([bin], { type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), mime:'application/vnd.openxmlformats-officedocument.wordprocessingml.document', filename: name.endsWith('.docx') ? name : `${name}.docx` };
    }
    if (fmt === 'pdf'){
      await ensureArtifactLib('jspdf');
      const jsPDF = window.jspdf?.jsPDF;
      if (!jsPDF) throw new Error('PDF_LIB_MISSING');
      const doc = new jsPDF({ unit:'pt', format:'a4' });
      const margin = 48;
      const maxW = doc.internal.pageSize.getWidth() - margin * 2;
      const lines = doc.splitTextToSize(String(rawText || ''), maxW);
      doc.text(lines, margin, margin);
      const blob = doc.output('blob');
      return { blob, mime:'application/pdf', filename: name.endsWith('.pdf') ? name : `${name}.pdf` };
    }
    if (fmt === 'xlsx'){
      await ensureArtifactLib('xlsx');
      if (!window.XLSX) throw new Error('XLSX_LIB_MISSING');
      const payload = extractLikelyJson(rawText);
      let ws;
      if (Array.isArray(payload)){
        ws = window.XLSX.utils.json_to_sheet(payload);
      }else{
        const csv = extractLikelyCsv(rawText);
        ws = window.XLSX.utils.aoa_to_sheet(csv.split(/\r?\n/).filter(Boolean).map((line) => line.split(',')));
      }
      const wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      const out = window.XLSX.write(wb, { bookType:'xlsx', type:'array' });
      return { blob: new Blob([out], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), mime:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', filename: name.endsWith('.xlsx') ? name : `${name}.xlsx` };
    }
    if (fmt === 'pptx'){
      await ensureArtifactLib('pptx');
      if (!window.PptxGenJS) throw new Error('PPTX_LIB_MISSING');
      const pptx = new window.PptxGenJS();
      pptx.layout = 'LAYOUT_WIDE';
      const slide = pptx.addSlide();
      const content = String(rawText || '').trim() || ' ';
      slide.addText(content.slice(0, 5000), { x:0.6, y:0.6, w:12.0, h:6.2, fontSize:18, color:'2b2b2b', rtl:true });
      const buf = await pptx.write('arraybuffer');
      return { blob: new Blob([buf], { type:'application/vnd.openxmlformats-officedocument.presentationml.presentation' }), mime:'application/vnd.openxmlformats-officedocument.presentationml.presentation', filename: name.endsWith('.pptx') ? name : `${name}.pptx` };
    }

    return { blob: new Blob([rawText], { type:'text/plain;charset=utf-8' }), mime:'text/plain', filename: name.endsWith('.txt') ? name : `${name}.txt` };
  }

  async function runArtifactDownload(){
    const modal = $('artifactModal');
    if (!modal) return;
    const fmt = $('artifactFormat')?.value || 'txt';
    const filename = $('artifactFilename')?.value || 'download.txt';
    const status = $('artifactStatus');
    if (status) status.textContent = '...';
    const mid = modal.dataset.mid || '';
    const title = modal.dataset.title || '';
    const text = modal.dataset.text || '';
    const downloads = pickMessageDownloads(mid);
    try{
      const out = await buildArtifactBlob({ format: fmt, filename, text, downloads, title });
      downloadBlob(out.filename || filename, out.blob);
      if (status) status.textContent = '✅ تم تجهيز التنزيل';
    }catch(err){
      const msg = String(err?.message || err || '').toUpperCase();
      if (msg.includes('INVALID_JSON')) toast('⚠️ لا يوجد JSON صالح في هذا الرد.');
      else if (msg.includes('DOCX_CONVERTER_MISSING')) toast('⚠️ محول DOCX غير متاح في هذه الجلسة.');
      else if (msg.includes('ZIP_LIB_MISSING')) toast('⚠️ تعذر تحميل مكتبة ZIP.');
      else if (msg.includes('PDF_LIB_MISSING')) toast('⚠️ تعذر تحميل مكتبة PDF.');
      else if (msg.includes('XLSX_LIB_MISSING')) toast('⚠️ تعذر تحميل مكتبة Excel.');
      else if (msg.includes('PPTX_LIB_MISSING')) toast('⚠️ تعذر تحميل مكتبة PowerPoint.');
      else toast('⚠️ تعذر تجهيز الملف للتنزيل.');
      if (status) status.textContent = '';
    }
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
    openWorkspacePage('canvas');
    openCanvasDoc(id);
    refreshNavMeta();
    toast('✅ تم إرسال الرد إلى اللوحة');
  }

  const PROMPT_CHIPS = [
    'اشرح لي مفهوم ',
    'ساعدني في كتابة ',
    'لخّص هذا النص:\n',
    'اكتب خطة عمل لـ ',
    'ترجم هذا النص إلى العربية:\n',
    'راجع هذا الكود وأصلح الأخطاء:\n',
  ];

  function fillPromptChip(text){
    const input = $('chatInput');
    if (!input) return;
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    resizeComposerInput(input);
    input.focus();
    const len = text.length;
    input.setSelectionRange(len, len);
  }

  function renderEmptyChatState(log){
    if (!log) return;
    const state = document.createElement('div');
    state.className = 'empty-chat-state empty-chat-state--compact';
    state.innerHTML = `
      <div class="empty-chat-title">المساحة جاهزة لبحث، منتج، أو خطة تنفيذ.</div>
      <div class="empty-chat-text">ابدأ من اللوحة العليا أو اكتب الهدف مباشرة. سيستخدم التطبيق الملفات، المعرفة، وملحقات المحادثة لبناء استجابة أوضح وأكثر احترافية.</div>
      <div class="empty-chat-points">
        <div class="empty-chat-point" data-chip="0">
          <strong>مخرجات مريحة للقراءة</strong>
          <span>تقارير، ملخصات، وخطط عمل مكتوبة بطريقة واضحة ومريحة للقراءة الطويلة.</span>
        </div>
        <div class="empty-chat-point" data-chip="1">
          <strong>سياق غني</strong>
          <span>الملفات، قاعدة المعرفة، والمرفقات تندمج داخل نفس سياق التشغيل بدل الدردشة المعزولة.</span>
        </div>
        <div class="empty-chat-point" data-chip="2">
          <strong>جاهز للتنفيذ</strong>
          <span>استخدم القوالب، سير العمل، ونمط الوكيل لتحويل الطلب إلى مخرجات تنفيذية قابلة للاستخدام.</span>
        </div>
      </div>
      <div class="prompt-chips" id="emptyChatChips"></div>`;
    log.innerHTML = '';
    log.appendChild(state);

    const chipsContainer = state.querySelector('#emptyChatChips');
    PROMPT_CHIPS.forEach((txt) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'prompt-chip';
      btn.textContent = txt.trim().replace(/\n$/, '') + '…';
      btn.addEventListener('click', () => fillPromptChip(txt));
      chipsContainer.appendChild(btn);
    });

    state.querySelectorAll('.empty-chat-point[data-chip]').forEach((point) => {
      const chipIdx = Number(point.dataset.chip);
      const chipTexts = [
        'اكتب تقريراً احترافياً عن ',
        'ساعدني في كتابة ',
        'اكتب خطة تنفيذية لـ ',
      ];
      point.addEventListener('click', () => fillPromptChip(chipTexts[chipIdx] || PROMPT_CHIPS[0]));
    });
  }

  function updateStreamingAssistant(mid, text){
    const log = $('chatLog');
    const b = log?.querySelector(`.bubble.assistant[data-mid="${CSS.escape(mid)}"]`);
    if (!b) return;
    const body = b.querySelector('.body');
    if (body){
      const downloadState = ensureDownloadsFromText(text || '', mid || '');
      body.innerHTML = renderAssistantMessageHtml(text || '', downloadState.entries);
      bindAssistantDownloadLinks(body);
    }
    scrollChatToBottom();
    scheduleChatScrollDockSync();
  }

  function clipText(t, limit){
    const s = String(t || '');
    if (s.length <= limit) return s;
    return s.slice(0, Math.floor(limit*0.55)) + "\n...\n" + s.slice(-Math.floor(limit*0.45));
  }

  function renderChat(){
    const log = $('chatLog');
    if (!log) return;
    const thread = getCurThread();
    const msgs = thread.messages || [];
    log.innerHTML = '';

    if (!msgs.length){
      try{ document.body.classList.remove('chat-has-messages'); }catch(_){}
      renderEmptyChatState(log);
      log.scrollTop = 0;
      refreshNavMeta();
      renderDownloads();
      refreshStrategicWorkspace().catch(()=>{});
      scheduleChatScrollDockSync();
      return;
    }

    try{ document.body.classList.add('chat-has-messages'); }catch(_){}

    msgs.forEach((m) => {
      const bubble = document.createElement('div');
      bubble.className = 'bubble ' + (m.role === 'user' ? 'user' : 'assistant');
      bubble.dataset.mid = m.id || '';

      const meta = document.createElement('div');
      meta.className = 'meta';
      const roleBadge2 = document.createElement('span');
      roleBadge2.className = 'bubble-role-badge';
      roleBadge2.textContent = m.role === 'user' ? '👤 أنت' : '🤖 المساعد';
      const metaText2 = document.createElement('span');
      metaText2.textContent = formatMessageMetaLine(m);
      meta.appendChild(roleBadge2);
      meta.appendChild(metaText2);

      const body = document.createElement('div');
      body.className = 'body';
      const downloadState = m.role === 'assistant'
        ? ensureDownloadsFromText(m.content || '', m.id || '')
        : { entries: [], newCount: 0 };
      body.innerHTML = m.role === 'assistant'
        ? renderAssistantMessageHtml(m.content || '', downloadState.entries)
        : `${m.engineeredPrompt ? '<div class="tag" style="margin-bottom:6px">🧩 Prompt Engineering مفعّل</div>' : ''}${renderUserAttachmentPreviewsHtml(m.attachmentPreviews)}${m.content ? `<pre class="chat-user-text">${escapeHtml(m.content || '')}</pre>` : ''}` || '<pre class="chat-user-text"></pre>';
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

      const editBtn = document.createElement('button');
      editBtn.className = 'btn ghost sm';
      editBtn.textContent = m.role === 'user' ? 'تعديل' : 'إعادة استخدام';
      editBtn.addEventListener('click', () => loadMessageIntoComposer(m));
      actions.appendChild(editBtn);

      if (m.role === 'user' && m.engineeredPrompt){
        const peBtn = document.createElement('button');
        peBtn.className = 'btn ghost sm';
        peBtn.textContent = 'نسخ البرومبت المحسّن';
        peBtn.addEventListener('click', async () => {
          const ok = await copyToClipboard(String(m.engineeredPrompt || ''));
          toast(ok ? '✅ تم نسخ البرومبت المحسّن' : '⚠️ تعذر نسخ البرومبت المحسّن');
        });
        actions.appendChild(peBtn);
      }

      if (m.role === 'assistant'){
        const artifactBtn = document.createElement('button');
        artifactBtn.className = 'btn ghost sm';
        artifactBtn.textContent = '⬇ تنزيل الرد';
        artifactBtn.addEventListener('click', () => {
          openArtifactModal({
            mid: m.id || '',
            title: titleFromMessage(m.content || '', 'assistant'),
            text: String(m.content || ''),
            downloads: []
          });
        });
        actions.appendChild(artifactBtn);

        const canvasBtn = document.createElement('button');
        canvasBtn.className = 'btn ghost sm';
        canvasBtn.textContent = 'إلى اللوحة';
        canvasBtn.addEventListener('click', () => sendMessageToCanvas(m));
        actions.appendChild(canvasBtn);

        const speakBtn = document.createElement('button');
        speakBtn.className = 'speak-btn';
        speakBtn.innerHTML = '<span class="speak-icon">🔊</span><span>استماع</span>';
        speakBtn.title = 'استماع للرد بصوت عربي';
        speakBtn.addEventListener('click', async () => {
          const wasSpeaking = speakBtn.classList.contains('speaking');
          if (wasSpeaking){ window._ttsStop?.(); speakBtn.classList.remove('speaking'); return; }
          speakBtn.classList.add('speaking');
          speakBtn.querySelector('.speak-icon').textContent = '⏹️';
          const played = await speakAssistantReply(m.content || '', { force: true });
          speakBtn.classList.remove('speaking');
          speakBtn.querySelector('.speak-icon').textContent = '🔊';
          if (!played) toast('⚠️ التشغيل الصوتي غير متاح لهذا الرد.');
        });
        actions.appendChild(speakBtn);

        if (downloadState.entries.length){
          const dlBtn = document.createElement('button');
          dlBtn.className = 'btn ghost sm';
          dlBtn.textContent = `التحميلات (${downloadState.entries.length})`;
          dlBtn.addEventListener('click', () => {
            openWorkspacePage('downloads');
          });
          actions.appendChild(dlBtn);

          const info = document.createElement('span');
          info.className = 'hint';
          info.textContent = downloadState.newCount
            ? `⬇ تمت إضافة ${downloadState.newCount} ملف جديد`
            : `⬇ ${downloadState.entries.length} ملف قابل للتنزيل`;
          actions.appendChild(info);
        }
      }

      bubble.appendChild(meta);
      bubble.appendChild(body);
      bubble.appendChild(actions);
      log.appendChild(bubble);
    });

    scrollChatToBottom();
    refreshNavMeta();
    renderDownloads();
    renderThreadHistory();
    refreshStrategicWorkspace().catch(()=>{});
    scheduleChatScrollDockSync();
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
    box.classList.toggle('chips-empty', !pendingChatAttachments.length);
    syncComposerMeta();
  }

  function syncComposerMeta(){
    const meta = $('composerContextMeta');
    if (!meta) return;
    const wrap = meta.closest('.composer-meta');
    const pid = getCurProjectId();
    const files = loadFiles(pid);
    const thread = getCurThread();
    const msgCount = (thread.messages || []).length;
    const flags = [];
    if (hasProjectBrief(getProjectBrief(pid))) flags.push('ذاكرة المشروع');
    if (getStudyMode()) flags.push('دراسي');

    const recognized = pendingChatAttachments.filter((a) => a.hasText).length;
    const visibleImages = pendingChatAttachments.filter((a) => a.kind === 'image' && a.dataUrl).length;
    const attachmentChars = pendingChatAttachments.reduce((sum, a) => sum + Number(a.chars || 0), 0);
    const chatUi = !!$('page-chat')?.classList.contains('active');
    const promptEngineeringOn = getPromptEngineeringMode();
    const showComposerDetails = pendingChatAttachments.length > 0 || composerEditState.active || promptEngineeringOn;
    if (wrap) wrap.classList.toggle('composer-meta--idle', chatUi && !showComposerDetails);
    if (chatUi && !showComposerDetails){
      meta.textContent = '';
      resizeComposerInput();
      scheduleShellLayoutRefresh();
      return;
    }
    const parts = [];
    if (chatUi){
      parts.push(`${files.length} ملف · ${msgCount} رسالة`);
      if (pendingChatAttachments.length){
        parts.push(`مرفقات ${pendingChatAttachments.length}`);
        if (recognized < pendingChatAttachments.length) parts.push(`مقروء ${recognized}/${pendingChatAttachments.length}`);
        if (attachmentChars) parts.push(`${formatCompactChars(attachmentChars)} حرف`);
        if (visibleImages) parts.push(`${visibleImages} صورة`);
      }
    }else{
      parts.push(`الملفات ${files.length}`, `الرسائل ${msgCount}`, `المرفقات ${pendingChatAttachments.length}`);
      if (pendingChatAttachments.length){
        parts.push(`مقروء ${recognized}/${pendingChatAttachments.length}`);
        if (attachmentChars) parts.push(`نص مرفق ${formatCompactChars(attachmentChars)} حرف`);
        if (visibleImages) parts.push(`صور ${visibleImages}`);
      }
    }
    if (composerEditState.active){
      parts.push(composerEditState.sourceRole === 'user' ? 'تعديل' : 'إعادة استخدام');
    }
    if (promptEngineeringOn){
      parts.push('🧩 Prompt Engineering ON');
    }
    if (flags.length) parts.push(...flags);
    meta.textContent = parts.join(' · ');
    resizeComposerInput();
  }

  function inferAttachmentKind(file){
    const name = String(file?.name || '').toLowerCase();
    const type = String(file?.type || '').toLowerCase();
    if (type.startsWith('image/') || /\.(png|jpe?g|webp|bmp|gif|tiff?)$/i.test(name)) return 'image';
    if (name.endsWith('.pdf')) return 'pdf';
    if (/\.(doc|docx)$/i.test(name)) return 'docx';
    if (/\.(ppt|pptx)$/i.test(name)) return 'presentation';
    if (/\.(xls|xlsx|ods)$/i.test(name)) return 'spreadsheet';
    if (type.startsWith('audio/') || /\.(mp3|wav|m4a|ogg|aac|flac)$/i.test(name)) return 'audio';
    if (type.startsWith('video/') || /\.(mp4|mov|webm|mkv|avi|mpeg|mpg)$/i.test(name)) return 'video';
    if (/\.(zip|rar|7z|tar|gz)$/i.test(name)) return 'archive';
    if (/\.(txt|md|csv|json|xml|html|htm|js|jsx|ts|tsx|py|java|kt|kts|c|cc|cpp|h|hpp|cs|go|php|rb|rs|swift|sql|css|scss|less|yml|yaml|toml|ini|env|sh|bat|ps1|log)$/i.test(name)) return 'text';
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
        } else if ((kind === 'video' || kind === 'audio') && file.size <= MAX_CHAT_INLINE_MEDIA_BYTES){
          try{
            dataUrl = await fileToDataUrl(file);
          }catch(_){
            dataUrl = '';
          }
          extractionMode = kind === 'video' ? 'فيديو معاينة' : 'صوت معاينة';
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

  function openChatAttachmentPicker(){
    const input = $('chatAttachFiles');
    if (!input) return;
    input.value = '';
    input.removeAttribute('accept');
    input.setAttribute('multiple', 'multiple');
    input.click();
  }

function updateChips(){
    const box = $('chatChips');
    if (!box) return;
    box.innerHTML = '';
    syncComposerMeta();
  }

  // ---------------- Send message ----------------
  async function sendMessage(){
    if (composerListening) await stopComposerDictation();
    stopVoicePlayback();
    const input = $('chatInput');
    const originalText = (input.value || '').trim();
    if (!originalText) return;
    const promptEngineering = buildPromptEngineeringInput(originalText);
    const modelInputText = promptEngineering.text || originalText;

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
    let historySnapshot = thread.messages.slice();
    let threadSummary = String(thread.summary || '');
    let uMsg = null;
    const attachmentsForRequest = pendingChatAttachments.slice();

    if (composerEditState.active && composerEditState.mutateThread && composerEditState.sourceRole === 'user'){
      const editIndex = thread.messages.findIndex((message) => message.id === composerEditState.sourceMessageId);
      if (editIndex >= 0){
        historySnapshot = thread.messages.slice(0, editIndex);
        uMsg = thread.messages[editIndex];
        uMsg.content = originalText;
        if (promptEngineering.transformed) uMsg.engineeredPrompt = modelInputText;
        else delete uMsg.engineeredPrompt;
        uMsg.ts = nowTs();
        uMsg.editedAt = nowTs();
        uMsg.requestModelId = settings.model;
        thread.messages = thread.messages.slice(0, editIndex + 1);
        thread.summary = '';
        threadSummary = '';
        if (editIndex === 0) ensureThreadTitleFromMessage(thread, originalText);
      }
    }
    if (!uMsg){
      historySnapshot = thread.messages.slice();
      uMsg = { id: makeId('m'), role:'user', content: originalText, ts: nowTs(), requestModelId: settings.model };
      if (promptEngineering.transformed) uMsg.engineeredPrompt = modelInputText;
      thread.messages.push(uMsg);
      ensureThreadTitleFromMessage(thread, originalText);
    }
    if (attachmentsForRequest.length){
      uMsg.attachmentPreviews = snapshotAttachmentsForMessage(attachmentsForRequest);
    }
    thread.updatedAt = nowTs();
    threads[idx] = thread;
    saveThreads(pid, threads);

    clearComposerEditState();
    input.value = '';
    shrinkComposerToCompact(true);
    resizeComposerInput(input);
    syncComposerMeta();
    renderChat();

    const filesText = buildAutoFilesContext(settings);
    const rag = await buildRagContextIfEnabled(originalText, rawSettings);
    const messages = buildMessagesForChat({
      userText: modelInputText,
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
    if (promptEngineering.transformed){
      toast('✨ Prompt Engineering: تم تحسين صياغة الطلب قبل الإرسال');
    }
    $('stopBtn').style.display = 'inline-flex';
    abortCtl?.abort?.();
    abortCtl = new AbortController();

    let model = settings.model;
    if (settings.provider === 'openrouter') model = maybeOnlineModel(model, settings);
    const requestedModalities = getRequestedOutputModalities(settings, model, messages);
    const imageGenerationMode = requestedModalities.includes('image');
    const assistantModelMeta = buildAssistantMessageModelMeta(settings, model);

    const extraHeaders = buildProviderHeaders(settings);

    const aId = makeId('m');
    const aMsg = { id: aId, role:'assistant', content:'', ts: nowTs(), ...assistantModelMeta };
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
      const wantStream = !!settings.streaming && !imageGenerationMode;
      if (imageGenerationMode && settings.streaming){
        showStatus('جاري إنشاء الصورة. هذا النوع من الردود يعود دفعة واحدة بدل البث المباشر…', true);
      }

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
                  extraHeaders,
                  modalities: requestedModalities
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
              ans = await callOpenAIChat({ apiKey: settings.apiKey, baseUrl, model, messages, max_tokens: maxTokens, signal: abortCtl.signal, extraHeaders, modalities: requestedModalities });
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
      scheduleCloudSync('chat-response');

      // v6: tool loop (agent tools)
      if (settings.toolsEnabled) await maybeRunToolsLoop(pid, tid, ans, settings);

      await refreshUsageState({ settings }).catch(() => {});
      if (getVoiceModeEnabled()){
        const played = await speakAssistantReply(ans || aMsg.content || '');
        if (!played) scheduleVoiceConversationRecovery(500);
      }
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

  const pushAssistant = (content, modelId = settings.model) => {
    const threads = loadThreads(pid);
    const idx = threads.findIndex(t => t.id === tid);
    const thread = threads[idx] || threads[0];
    thread.messages = thread.messages || [];
    thread.messages.push({
      id: makeId('m'),
      role:'assistant',
      content,
      ts: nowTs(),
      ...buildAssistantMessageModelMeta(settings, modelId)
    });
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
    pushAssistant(`🧪 Research Plan:\n\n${plan}`, settings.model);
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
    pushAssistant(`🧪 Research Notes:\n\n${notes}`, webModel);
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
      pushAssistant('🧪 تقرير بحث:\n\n' + final, settings.model);
    } else {
      if (settings.streaming){
        const aId = makeId('m');
        const threads = loadThreads(pid);
        const idx = threads.findIndex(t => t.id === tid);
        const thread = threads[idx] || threads[0];
        thread.messages = thread.messages || [];
        thread.messages.push({
          id: aId,
          role:'assistant',
          content:'🧪 تقرير بحث:\n\n',
          ts: nowTs(),
          ...buildAssistantMessageModelMeta(settings, settings.model)
        });
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
        pushAssistant('🧪 تقرير بحث:\n\n' + final, settings.model);
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


  function getCanvasAiActionLabel(value){
    const map = {
      rewrite: 'إعادة صياغة احترافية',
      summarize: 'تلخيص بنقاط',
      improve: 'تحسين وإثراء بدون اختلاق',
      build_app_html: 'بناء تطبيق ويب HTML كامل (ملف واحد)'
    };
    return map[String(value || '').trim()] || String(value || '');
  }
  function getCanvasExportKindLabel(value){
    const map = { txt: 'نص TXT', html: 'صفحة HTML', docx: 'مستند Word (DOCX)' };
    return map[String(value || '').trim().toLowerCase()] || String(value || '');
  }
  function syncCanvasAiModalSummary(){
    const sel = $('canvasAiAction');
    const summary = $('canvasAiModalSummary');
    if (summary && sel){
      summary.textContent = `المهمة المختارة: ${getCanvasAiActionLabel(sel.value)}`;
    }
  }
  function syncCanvasExportModalSummary(){
    const sel = $('canvasExportKind');
    const summary = $('canvasExportModalSummary');
    if (summary && sel){
      summary.textContent = `صيغة التصدير: ${getCanvasExportKindLabel(sel.value)}`;
    }
  }
  function openCanvasAiModal(){
    const modal = $('canvasAiModal');
    if (!modal) return toast('⚠️ واجهة اختيار غير جاهزة');
    syncCanvasAiModalSummary();
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
  }
  function closeCanvasAiModal(){
    const modal = $('canvasAiModal');
    if (!modal) return;
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
  }
  function openCanvasExportModal(){
    const modal = $('canvasExportModal');
    if (!modal) return exportCanvas();
    syncCanvasExportModalSummary();
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
  }
  function closeCanvasExportModal(){
    const modal = $('canvasExportModal');
    if (!modal) return;
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
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
    const modal = $('canvasVersionModal');
    const list = $('canvasVersionList');
    if (!modal || !list){
      const pick = prompt('اختر رقم الإصدار لاستعادته:\n' + vers.map((v,i)=>`${i+1}) ${new Date(v.ts).toLocaleString('ar')} — ${v.title}`).join('\n'), '1');
      const n = Number(pick||'');
      if (!n || n<1 || n>vers.length) return;
      const v = vers[n-1];
      $('canvasTitle').value = v.title || '';
      $('canvasEditor').value = v.content || '';
      toast('✅ تم استعادة الإصدار');
      refreshCanvasPreview();
      return;
    }
    list.innerHTML = '';
    vers.forEach((v, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn ghost sm with-label';
      btn.style.width = '100%';
      btn.style.justifyContent = 'flex-start';
      btn.innerHTML = `<span class="icon">🕘</span><span class="label" style="text-align:start">${escapeHtml(String(i+1))}) ${escapeHtml(new Date(v.ts).toLocaleString('ar'))} — ${escapeHtml(v.title || '')}</span>`;
      btn.addEventListener('click', () => {
        $('canvasTitle').value = v.title || '';
        $('canvasEditor').value = v.content || '';
        modal.classList.remove('show');
        modal.setAttribute('aria-hidden', 'true');
        toast('✅ تم استعادة الإصدار');
        refreshCanvasPreview();
      });
      list.appendChild(btn);
    });
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    modal.querySelector('[data-close-canvas-version="1"]')?.addEventListener('click', () => {
      modal.classList.remove('show');
      modal.setAttribute('aria-hidden', 'true');
    }, { once: true });
  }

  function exportCanvasWithKind(kind){
    const title = ($('canvasTitle').value || 'canvas').trim() || 'canvas';
    const content = $('canvasEditor').value || '';
    const k = String(kind || 'txt').trim().toLowerCase();
    if (k === 'html'){
      let html = content;
      if (!isProbablyHtml(content)){
        html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body><pre style="white-space:pre-wrap">${escapeHtml(content)}</pre></body></html>`;
      }
      downloadBlob(`${title}.html`, new Blob([html], { type:'text/html;charset=utf-8' }));
      toast('⬇ تم تصدير HTML');
      return;
    }
    if (k === 'docx'){
      const fn = getHtmlToDocxFn();
      if (!fn) return toast('⚠️ DOCX غير متاح');
      const html = `<h1>${escapeHtml(title)}</h1><div>${renderMarkdown(content)}</div>`;
      Promise.resolve(fn(html)).then((blob) => {
        downloadBlob(`${title}.docx`, toDocxBlob(blob));
        toast('⬇ تم تصدير DOCX');
      }).catch((e)=> toast('DOCX فشل: ' + (e?.message||e)));
      return;
    }
    downloadBlob(`${title}.txt`, new Blob([content], { type:'text/plain;charset=utf-8' }));
    toast('⬇ تم تصدير TXT');
  }

  function exportCanvas(){
    const sel = $('canvasExportKind');
    const kind = String(sel?.value || 'txt').trim().toLowerCase();
    exportCanvasWithKind(kind);
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
        openWorkspacePage('chat'); $('chatInput').focus(); toast('✅ تم');
      }},
    ]);

    card('📚 تلخيص الملفات (RAG)', 'تلخيص منظم اعتمادًا على KB عند تفعيل RAG.', [
      {label:'إدراج', kind:'btn ghost sm', onClick: () => {
        $('chatInput').value =
          'لخّص محتوى قاعدة المعرفة/الملفات المتاحة بوضوح:\\n'
          + '- ملخص تنفيذي\\n- نقاط رئيسية\\n- تفاصيل مهمّة مع اقتباسات [KB:..]\\n- توصيات/خطوات\\n\\n'
          + 'أنشئ ملف:\\n```file name="kb_summary.md" mime="text/markdown"\\n(ضع الملخص)\\n```\\n';
        openWorkspacePage('chat'); $('chatInput').focus(); toast('✅ تم');
      }},
      {label:'تشغيل', kind:'btn sm', onClick: () => {
        setRagToggle(true); $('ragToggle').checked = true;
        $('chatInput').value = 'لخّص محتوى قاعدة المعرفة/الملفات المتاحة بوضوح مع اقتباسات [KB:..]، وأنشئ ملف kb_summary.md.';
        openWorkspacePage('chat'); sendMessage();
      }},
    ]);

    card('🧩 بناء تطبيق HTML من اللوحة', 'استخدم محتوى اللوحة لإنشاء تطبيق HTML كامل داخل ملف واحد.', [
      {label:'تشغيل على اللوحة', kind:'btn sm', onClick: () => { openWorkspacePage('canvas'); canvasAi('build_app_html'); }},
      {label:'فتح اللوحة', kind:'btn ghost sm', onClick: () => openWorkspacePage('canvas')},
    ]);

    card('📌 عناصر تنفيذ', 'استخراج مهام من آخر محادثة: المهمة + المالك + الموعد + الأولوية + الحالة.', [
      {label:'إدراج', kind:'btn ghost sm', onClick: () => {
        $('chatInput').value =
          'استخرج من المحادثة مهامًا تنفيذية بصيغة جدول:\\n'
          + '- المهمة\\n- المالك\\n- الموعد\\n- الأولوية\\n- الحالة\\n\\n'
          + 'وأنشئ ملف:\\n```file name="action_items.md" mime="text/markdown"\\n...\\n```\\n';
        openWorkspacePage('chat'); $('chatInput').focus();
      }},
      {label:'تشغيل', kind:'btn sm', onClick: () => { openWorkspacePage('chat'); sendMessage(); }},
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
        openWorkspacePage('chat');
        await sendMessage();
      } else if (st.step === 'canvas_build'){
        wfLog('… بناء تطبيق HTML من اللوحة');
        openWorkspacePage('canvas');
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
    const overview = $('downloadsOverview');
    const dl = loadDownloads();
    $('navDlMeta').textContent = String(dl.length);
    if (overview){
      const REPO = 'saddamalkadi/book-summarizer-pwa';
      const WEB_URL = 'https://app.saddamalkadi.com/';
      const DOWNLOADS_URL = `${WEB_URL}downloads/`;
      const APK_LATEST_URL = `${DOWNLOADS_URL}ai-workspace-studio-latest.apk`;
      const APK_BACKUP_URL = `https://github.com/${REPO}/blob/main/downloads/ai-workspace-studio-latest.apk?raw=1`;

      overview.innerHTML = `
        <div class="bubble app-dl-card" style="margin:0;padding:16px">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
            <img src="./logo.svg" style="width:52px;height:52px;border-radius:14px;flex-shrink:0;border:1px solid rgba(10,20,60,.08)" alt="logo" onerror="this.textContent='🤖';this.style.fontSize='32px'"/>
            <div style="flex:1;min-width:0">
              <div style="font-weight:900;font-size:1.08em;letter-spacing:-.01em">AI Workspace Studio</div>
              <div class="hint" id="releaseVersionMeta" style="margin-top:2px">ملف APK واحد يطابق إصدار الويب الحالي، مع رابط احتياطي من GitHub.</div>
            </div>
            <span style="flex-shrink:0;padding:3px 10px;border-radius:20px;background:var(--accent,#2563eb);color:#fff;font-size:.72em;font-weight:800">● مباشر</span>
          </div>
          <div class="actions" style="flex-wrap:wrap;gap:8px">
            <a class="btn" id="apkMainBtn" href="${APK_LATEST_URL}" download="AI-Workspace-Studio-latest.apk" target="_blank" rel="noopener noreferrer">⬇ تنزيل APK — Android</a>
            <a class="btn ghost sm" href="${WEB_URL}" target="_blank" rel="noopener noreferrer">🌐 تطبيق الويب</a>
            <a class="btn ghost sm" href="${DOWNLOADS_URL}" target="_blank" rel="noopener noreferrer">📋 صفحة التنزيل</a>
          </div>
          <div style="margin-top:10px;font-size:.8em;color:var(--muted,#888)">
            إذا تعذر التنزيل المباشر، استخدم الرابط الاحتياطي التالي:
          </div>
          <div class="actions" style="flex-wrap:wrap;gap:8px;margin-top:8px">
            <a class="btn ghost sm" href="${APK_BACKUP_URL}" target="_blank" rel="noopener noreferrer">رابط APK الاحتياطي</a>
          </div>
          <div class="hint" style="margin-top:10px;font-size:.78em">
            Android 7.0+ • قم بتفعيل "تثبيت من مصادر غير معروفة" في الإعدادات قبل التثبيت
          </div>
        </div>`;
    }
    const q = String($('dlSearch')?.value || '').trim().toLowerCase();
    const filtered = dl.filter(d => {
      if (pinOnly && !d.pinned) return false;
      if (!q) return true;
      return (String(d.name||'').toLowerCase().includes(q) || String(d.mime||'').toLowerCase().includes(q));
    });
    box.innerHTML = '';
    filtered.forEach(d => {
      const metaBits = [String(d.mime || '').trim()];
      if (d.encoding === 'url') metaBits.push('رابط مباشر');
      const bytes = estimateDownloadBytes(d);
      if (bytes > 0) metaBits.push(formatCompactBytes(bytes));
      const row = document.createElement('div');
      row.className='bubble';
      row.innerHTML = `<div style="font-weight:1000">${escapeHtml(d.pinned?'📌 ':'')}${escapeHtml(d.name)}</div>
                       <div class="hint">${escapeHtml(metaBits.join(' • '))} • ${new Date(d.createdAt||nowTs()).toLocaleString('ar')}</div>`;
      const actions = document.createElement('div');
      actions.className='actions';

      const b1 = document.createElement('button');
      b1.className='btn sm';
      b1.textContent='تنزيل';
      b1.addEventListener('click', async () => {
        const ok = await downloadStoredItem(d.id);
        if (!ok) toast('⚠️ تعذر تنزيل الملف من هذا الرابط أو استعادته من المحادثة.');
      });
      const bOpen = document.createElement('button');
      bOpen.className='btn ghost sm';
      bOpen.textContent='فتح';
      bOpen.style.display = d.url ? '' : 'none';
      bOpen.addEventListener('click', () => {
        if (!d.url) return;
        window.open(d.url, '_blank', 'noopener,noreferrer');
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
      actions.appendChild(bOpen);
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

    ensureSelectHasValue($('maxOut'), String(s.maxOut || 2000));
    ensureSelectHasValue($('fileClip'), String(s.fileClip || 12000));
    $('webMode').value = s.webMode || 'off';

    $('orReferer').value = s.orReferer || '';
    $('orTitle').value = s.orTitle || 'AI Workspace Studio';

    // v6 secure gateway + tools
    if ($('authMode')) $('authMode').value = s.authMode || 'browser';
    if ($('gatewayUrl')) $('gatewayUrl').value = s.gatewayUrl || '';
    if ($('gatewayPreset')){
      const managedRoot = normalizeManagedGatewayUrl(DEFAULT_SETTINGS.gatewayUrl || getPlatformServiceRoot());
      const currentRoot = normalizeManagedGatewayUrl(s.gatewayUrl || '');
      $('gatewayPreset').value = (!currentRoot || currentRoot === managedRoot) ? 'managed' : 'custom';
      if ($('gatewayUrl')) $('gatewayUrl').disabled = $('gatewayPreset').value !== 'custom';
    }
    if ($('gatewayToken')) $('gatewayToken').value = s.gatewayToken || '';
    if ($('cloudConvertEndpoint')) $('cloudConvertEndpoint').value = s.cloudConvertEndpoint || '';
    if ($('cloudConvertFallbackEndpoint')) $('cloudConvertFallbackEndpoint').value = s.cloudConvertFallbackEndpoint || '';
    if ($('ocrCloudEndpoint')) $('ocrCloudEndpoint').value = s.ocrCloudEndpoint || '';
    if ($('ocrLang')) ensureSelectHasValue($('ocrLang'), s.ocrLang || 'ara+eng');
    if ($('cloudRetryMax')) $('cloudRetryMax').value = String(s.cloudRetryMax || 2);
    if ($('freeMode')) $('freeMode').checked = !!s.freeMode;
    if ($('costGuard')) $('costGuard').value = s.costGuard || 'balanced';
    if ($('upgradeEmail')) $('upgradeEmail').value = s.upgradeEmail || DEFAULT_AUTH_CONFIG.upgradeEmail;
    if ($('maxCloudPdfPages')) ensureSelectHasValue($('maxCloudPdfPages'), String(s.maxCloudPdfPages || DEFAULT_SETTINGS.maxCloudPdfPages));
    if ($('maxCloudFileMB')) ensureSelectHasValue($('maxCloudFileMB'), String(s.maxCloudFileMB || DEFAULT_SETTINGS.maxCloudFileMB));
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
    const gatewayPreset = $('gatewayPreset') ? $('gatewayPreset').value : 'managed';
    const gatewayTyped = $('gatewayUrl') ? normalizeEndpointUrl($('gatewayUrl').value) : '';
    const gatewayInput = gatewayPreset === 'custom'
      ? gatewayTyped
      : normalizeManagedGatewayUrl(DEFAULT_SETTINGS.gatewayUrl || getPlatformServiceRoot());
    const gatewayToken = $('gatewayToken') ? $('gatewayToken').value.trim() : '';
    const cloudConvertEndpoint = $('cloudConvertEndpoint') ? normalizeDocxCloudEndpoint($('cloudConvertEndpoint').value) : '';
    const cloudConvertFallbackEndpoint = $('cloudConvertFallbackEndpoint') ? normalizeDocxCloudEndpoint($('cloudConvertFallbackEndpoint').value) : '';
    const ocrCloudEndpoint = $('ocrCloudEndpoint') ? normalizeOcrCloudEndpoint($('ocrCloudEndpoint').value) : '';
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
    if ($('cloudConvertEndpoint')) $('cloudConvertEndpoint').value = cloudConvertEndpoint;
    if ($('cloudConvertFallbackEndpoint')) $('cloudConvertFallbackEndpoint').value = cloudConvertFallbackEndpoint;
    if ($('ocrCloudEndpoint')) $('ocrCloudEndpoint').value = ocrCloudEndpoint;

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
  const NAV_STRUCTURE = [
    { type:'page', page:'home', label:'الرئيسية', icon:'⌂', metaId:'navHomeMeta' },
    { type:'page', page:'chat', label:'الدردشة', icon:'💬', metaId:'navChatMeta' },
    { type:'page', page:'projects', label:'المشاريع', icon:'🗂', metaId:'navProjMeta' },
    { type:'page', page:'files', label:'الملفات', icon:'📁', metaId:'navFilesMeta' },
    { type:'page', page:'knowledge', label:'المعرفة', icon:'🧠', metaId:'navKbMeta' },
    { type:'page', page:'transcription', label:'التفريغ والتحويل', icon:'🧾', metaId:'navTransMeta' },
    {
      type:'group',
      id:'toolsGroup',
      label:'الأدوات',
      icon:'🛠',
      ariaLabel:'الأدوات المتقدمة',
      items: [
        { type:'page', page:'canvas', label:'اللوحة', icon:'📝', metaId:'navCanvasMeta', sub:true },
        { type:'page', page:'workflows', label:'سير العمل', icon:'⚡', metaId:'navWorkMeta', sub:true }
      ]
    },
    { type:'page', page:'downloads', label:'التنزيلات', icon:'⬇', metaId:'navDlMeta' },
    { type:'page', page:'settings', label:'الإعدادات', icon:'⚙', metaId:'navSetMeta' }
  ];

  const NAV_GROUPS = {
    tools: ['canvas','workflows']
  };

  const NAV_TITLES = {
    home: 'الرئيسية',
    chat: 'الدردشة',
    knowledge: 'المعرفة',
    canvas: 'اللوحة',
    files: 'الملفات',
    transcription: 'التفريغ والتحويل',
    workflows: 'سير العمل',
    downloads: 'التنزيلات',
    projects: 'المشاريع',
    guide: 'دليل الاستخدام',
    settings: 'الإعدادات'
  };

  function renderNavNode(item){
    if (item.type === 'group'){
      return `
        <div class="nav-group" id="${item.id}">
          <button class="navbtn nav-group-toggle" id="${item.id}Toggle" aria-expanded="false" aria-controls="${item.id}Items">
            <span class="navbtn-icon">${item.icon}</span><span class="navbtn-label">${item.label}</span>
            <span class="nav-group-arrow" aria-hidden="true">›</span>
          </button>
          <div class="nav-group-items" id="${item.id}Items" role="group" aria-label="${item.ariaLabel || item.label}">
            ${item.items.map(renderNavNode).join('')}
          </div>
        </div>`;
    }
    const subClass = item.sub ? ' sub' : '';
    return `<button class="navbtn${subClass}" data-page="${item.page}"><span class="navbtn-icon">${item.icon}</span><span class="navbtn-label">${item.label}</span><span class="meta" id="${item.metaId}">—</span></button>`;
  }

  function renderPrimaryNavigation(){
    const nav = $('nav');
    if (!nav) return;
    nav.innerHTML = NAV_STRUCTURE.map(renderNavNode).join('');
    if ($('sideVersionLabel')) $('sideVersionLabel').textContent = WEB_RELEASE_LABEL;
    syncSidebarFooterClearance();
  }

  function syncSidebarFooterClearance(){
    const nav = $('nav');
    const footer = $('sideFooter');
    if (!nav || !footer) return;
    try{
      const h = Math.max(96, Math.ceil(footer.getBoundingClientRect().height || footer.offsetHeight || 0) + 16);
      nav.style.paddingBottom = `${h}px`;
    }catch(_){}
  }

  function setActiveNav(page){
    if (page !== 'chat' && composerListening) stopComposerDictation();
    document.querySelectorAll('.navbtn[data-page]').forEach((b) => {
      const isActive = b.dataset.page === page;
      b.classList.toggle('active', isActive);
      b.setAttribute('aria-current', isActive ? 'page' : 'false');
    });
    document.querySelectorAll('.page').forEach((p) => p.classList.toggle('active', p.id === `page-${page}`));
    if ($('topTitle')) $('topTitle').textContent = NAV_TITLES[page] || 'استوديو الذكاء';
    if (NAV_GROUPS.tools.includes(page)) expandNavGroup('toolsGroup');
    scheduleChatScrollDockSync();
  }

  function isChatReadingModeEnabled(){
    try{ return localStorage.getItem(KEYS.chatReadingMode) === '1'; }catch(_){ return false; }
  }

  function setChatReadingMode(on){
    try{
      if (on) localStorage.setItem(KEYS.chatReadingMode, '1');
      else localStorage.removeItem(KEYS.chatReadingMode);
    }catch(_){ }
    syncChatReadingModeUi();
  }

  function syncChatReadingModeUi(){
    const chatActive = document.body.classList.contains('chat-page-active');
    const on = chatActive && isChatReadingModeEnabled();
    document.body.classList.toggle('chat-reading-mode', on);
    const btn = $('chatReadingModeBtn');
    if (btn){
      btn.classList.toggle('dark', !!on);
      const lab = btn.querySelector('.label');
      if (lab) lab.textContent = on ? 'قراءة ✓' : 'قراءة';
      btn.title = on ? 'إيقاف وضع القراءة وإظهار الأشرطة' : 'وضع القراءة — إخفاء الأشرطة والمدخل لتوسيع مساحة الدردشة';
    }
    const exitFab = $('chatReadingModeExitBtn');
    if (exitFab) exitFab.hidden = !on;
    try{
      scheduleChatScrollDockSync();
      syncStickyShellMetrics();
    }catch(_){ }
  }

  function openWorkspacePage(page, options = {}){
    if (!page) return;
    setActiveNav(page);
    try{
      document.body.classList.toggle('chat-page-active', page === 'chat');
      const na = typeof isNativeAndroidPlatform === 'function' && isNativeAndroidPlatform();
      document.body.classList.toggle('android-chat-focus', na && page === 'chat');
      if (page !== 'chat'){
        document.body.classList.remove('chat-reading-mode');
        if ($('chatReadingModeExitBtn')) $('chatReadingModeExitBtn').hidden = true;
      } else {
        syncChatReadingModeUi();
      }
    }catch(_){}
    if (page === 'home') renderHomeWorkspace().catch(()=>{});
    if (page === 'downloads') renderDownloads();
    if (page === 'workflows') renderWorkflows();
    if (page === 'projects') renderProjects();
    if (page === 'guide') renderGuidePage();
    if (page === 'settings') renderSettings();
    if (page === 'files') renderFiles();
    if (page === 'canvas') { renderCanvasList(); refreshCanvasPreview(); }
    if (page === 'knowledge') renderKbUI().catch(()=>{});
    if (page === 'transcription') renderTranscribeOperationalState();
    if (page === 'chat') { renderChat(); updateChips(); refreshStrategicWorkspace().catch(()=>{}); }
    if (options.closeSidebar) closeSide();
  }

  function expandNavGroup(groupId){
    const group = $(groupId);
    if (!group) return;
    group.classList.add('open');
    const toggle = group.querySelector('.nav-group-toggle');
    if (toggle) toggle.setAttribute('aria-expanded','true');
  }

  function toggleNavGroup(groupId){
    const group = $(groupId);
    if (!group) return;
    const isOpen = group.classList.toggle('open');
    const toggle = group.querySelector('.nav-group-toggle');
    if (toggle) toggle.setAttribute('aria-expanded', String(isOpen));
  }

  function ensureHomeWorkspaceLanding(){
    const homeHost = $('homeHeroHost');
    const deck = $('workspaceDeck');
    if (homeHost && deck && deck.parentElement !== homeHost){
      homeHost.prepend(deck);
    }
    if (deck && $('page-home')?.classList.contains('active')){
      deck.classList.remove('workspace-deck-collapsed');
    }
    if ($('wqaChat') && !$('wqaChat').dataset.boundHomeAction){
      $('wqaChat').dataset.boundHomeAction = '1';
      $('wqaChat').addEventListener('click', () => {
        openWorkspacePage('chat');
        const inp = $('chatInput');
        if (inp) {
          inp.focus();
          inp.scrollIntoView({ behavior:'smooth', block:'end' });
        }
      });
    }
    if ($('wqaFiles') && !$('wqaFiles').dataset.boundHomeAction){
      $('wqaFiles').dataset.boundHomeAction = '1';
      $('wqaFiles').addEventListener('click', () => openWorkspacePage('files'));
    }
    document.querySelectorAll('#homeHeroHost [data-quick-prompt]').forEach((btn) => {
      if (!btn.dataset.openPage) btn.dataset.openPage = 'chat';
    });
  }

  async function renderHomeWorkspace(){
    ensureHomeWorkspaceLanding();
    const pid = getCurProjectId();
    const project = getCurProject();
    const thread = getCurThread();
    const files = loadFiles(pid);
    const downloads = loadDownloads();
    const projects = loadProjects();
    const canvasDocs = loadCanvas(pid);
    const messages = thread.messages || [];
    const chunks = await kbCountProject(pid).catch(() => 0);
    const messageCount = messages.length;
    const threadCount = loadThreads(pid).length;
    const latestUpdate = messageCount ? new Date(thread.updatedAt || nowTs()).toLocaleDateString('ar') : 'لا توجد رسائل بعد';
    if ($('homeChatMeta')) $('homeChatMeta').textContent = messageCount ? `${messageCount} رسالة • آخر تحديث ${latestUpdate}` : `${threadCount} محادثة محفوظة`;
    if ($('homeProjectsMeta')) $('homeProjectsMeta').textContent = `${projects.length} مشروع • الحالي: ${project.name}`;
    if ($('homeFilesMeta')) $('homeFilesMeta').textContent = `${files.length} ملف • ${canvasDocs.length} عناصر في اللوحة`;
    if ($('homeKnowledgeMeta')) $('homeKnowledgeMeta').textContent = `${chunks} مقطع معرفة • RAG من قسم المعرفة`;
    if ($('homeTranscriptionMeta')) $('homeTranscriptionMeta').textContent = `${getTranscribeProfileLabel()} • ${getTranscribeDocxModeLabel()}`;
    if ($('homeDownloadsMeta')) $('homeDownloadsMeta').textContent = `${downloads.length} ملف جاهز للتنزيل`;
    if ($('homeCurrentThreadState')) $('homeCurrentThreadState').textContent = messageCount ? `${thread.title || 'محادثة جارية'} • ${messageCount} رسالة` : 'ابدأ أول محادثة من الشاشة الرئيسية';
    if ($('homeCurrentProjectState')) $('homeCurrentProjectState').textContent = `${project.name} • ${projects.length} مشروع متاح`;
    if ($('homeCurrentFilesState')) $('homeCurrentFilesState').textContent = `${files.length} ملف • ${canvasDocs.length} عناصر قابلة للتحرير`;
    if ($('homeCurrentKnowledgeState')) $('homeCurrentKnowledgeState').textContent = `${chunks} مقطع معرفة • ${downloads.length} تنزيل`;
  }

  function refreshNavMeta(){
    const pid = getCurProjectId();
    const th = getCurThread();
    $('navHomeMeta') && ($('navHomeMeta').textContent = String(loadThreads(pid).length));
    $('navChatMeta') && ($('navChatMeta').textContent = String((th.messages||[]).length));
    $('navCanvasMeta') && ($('navCanvasMeta').textContent = String(loadCanvas(pid).length));
    $('navFilesMeta') && ($('navFilesMeta').textContent = String(loadFiles(pid).length));
    if ($('navKbMeta')){
      $('navKbMeta').textContent = '…';
      kbCountProject(pid).then((count) => {
        if ($('navKbMeta')) $('navKbMeta').textContent = String(count);
      }).catch(() => {
        if ($('navKbMeta')) $('navKbMeta').textContent = '0';
      });
    }
    $('navTransMeta') && ($('navTransMeta').textContent = 'PDF');
    $('navDlMeta') && ($('navDlMeta').textContent = String(loadDownloads().length));
    $('navProjMeta') && ($('navProjMeta').textContent = String(loadProjects().length));
    $('navWorkMeta') && ($('navWorkMeta').textContent = 'OK');
    $('navSetMeta') && ($('navSetMeta').textContent = 'OK');
    renderHomeWorkspace().catch(()=>{});
    refreshStrategicWorkspace().catch(()=>{});
  }

  // ---------------- Model Hub (OpenRouter) ----------------
  function loadFavs(){ const a = loadJSON(KEYS.favorites, []); return Array.isArray(a) ? a : []; }
  function saveFavs(a){ saveJSON(KEYS.favorites, a); }
  const MODEL_CATEGORY_DEFS = [
    { key:'general_text', label:'نصوص ومحتوى', note:'كتابة عامة، دردشة، تلخيص وصياغة.' },
    { key:'documents', label:'مستندات وعروض', note:'تقارير، عروض، ملفات Word وPDF وقوالب العمل.' },
    { key:'coding', label:'برمجة', note:'توليد الشيفرة، الإصلاح، الشرح والتحليل البرمجي.' },
    { key:'research', label:'بحث واستدلال', note:'تفكير عميق، تحليل، مقارنة، واستدلال متعدد الخطوات.' },
    { key:'vision', label:'صور ورؤية', note:'فهم الصور، OCR، واستخراج المعلومات المرئية.' },
    { key:'image_generation', label:'توليد صور', note:'إنشاء الصور والتصميمات من الوصف النصي.' },
    { key:'video', label:'فيديو', note:'إنشاء الفيديو أو التعامل مع مهام الفيديو المتخصصة.' },
    { key:'audio', label:'صوت', note:'تفريغ صوتي، تحويل كلام، ومعالجة الملفات الصوتية.' }
    , { key:'arabic_support', label:'عربي', note:'ملائم للكتابة والمحادثة بالعربية بصورة جيدة داخل المنصة.' },
    { key:'arabic_voice_chat', label:'صوت عربي', note:'موصى به للدردشة الصوتية العربية داخل التطبيق مع طبقة الإملاء والنطق العربية.' }
  ];
  const MODEL_CATEGORY_MAP = Object.fromEntries(MODEL_CATEGORY_DEFS.map((item) => [item.key, item]));
  const MODEL_CAPABILITY_DEFS = [
    { key:'text', label:'نصوص', note:'صياغة، تلخيص، ومحادثة عامة.' },
    { key:'documents', label:'مستندات', note:'تقارير، عروض، وجداول قابلة للتنزيل.' },
    { key:'coding', label:'برمجة', note:'شيفرة ومشاريع ومخرجات تقنية.' },
    { key:'research', label:'بحث', note:'تحليل، استدلال، وتجميع مراجع.' },
    { key:'vision', label:'رؤية', note:'فهم الصور والملفات المرئية.' },
    { key:'image_generation', label:'صور', note:'صور، تصميمات، أو حزم prompts مرئية.' },
    { key:'video', label:'فيديو', note:'Storyboard، shot list، أو أصول فيديو.' },
    { key:'audio', label:'صوت', note:'تفريغ أو ملفات صوتية أو مخرجات كلام.' }
    , { key:'arabic_support', label:'عربي', note:'استيعاب جيد للعربية في المحادثة والصياغة.' },
    { key:'arabic_voice_chat', label:'صوت عربي', note:'ملائم للدردشة الصوتية العربية عبر طبقة الصوت داخل التطبيق.' }
  ];
  const MODEL_CAPABILITY_MAP = Object.fromEntries(MODEL_CAPABILITY_DEFS.map((item) => [item.key, item]));
  function getModelCategoryLabel(key){
    return MODEL_CATEGORY_MAP[String(key || '').trim()]?.label || 'عام';
  }
  function getModelCategoryNote(key){
    return MODEL_CATEGORY_MAP[String(key || '').trim()]?.note || '';
  }
  function getModelCapabilityLabel(key){
    return MODEL_CAPABILITY_MAP[String(key || '').trim()]?.label || 'عام';
  }
  function getModelCapabilityNote(key){
    return MODEL_CAPABILITY_MAP[String(key || '').trim()]?.note || '';
  }
  function inferModelCategories(model){
    const outputModalities = (Array.isArray(model?.outputModalities) ? model.outputModalities : [])
      .map((value) => String(value || '').toLowerCase())
      .filter(Boolean);
    const hay = [
      model?.id,
      model?.name,
      model?.provider,
      model?.modality,
      outputModalities.join(' ')
    ].filter(Boolean).join(' ').toLowerCase();
    const ctx = Number(model?.ctx || 0);
    const categories = new Set();
    const isImageGeneration = outputModalities.includes('image') || /(flux|sdxl|stable[-\s]?diffusion|recraft|imagen|dall[\s-]?e|ideogram|playground|image[-\s]?gen|text[-\s]?to[-\s]?image)/i.test(hay);
    const isVideo = outputModalities.includes('video') || /(video|veo|runway|kling|hailuo|minimax[-\s]?video|pika|luma|wan[-\s]?video|movie[-\s]?gen|text[-\s]?to[-\s]?video)/i.test(hay);
    const isAudio = outputModalities.includes('audio') || /(whisper|tts|speech|audio|transcrib|voice|eleven|sonic|asr)/i.test(hay);
    const isCoding = /(code|coder|coding|codestral|deepseek[-\s]?coder|qwen.*coder|codellama|starcoder|replit|devstral|programming|software\s*engineer|aider)/i.test(hay);
    const isResearch = /(reason|reasoning|thinking|deep[-\s]?research|research|analysis|sonar|r1|o1|o3|o4|grok[-\s]?thinking)/i.test(hay);
    const isVision = !!model?.vision || /(vision|multimodal|vl|llava|pixtral|image[-\s]?understanding|ocr|gpt-4o|gemini|claude-3|claude 3)/i.test(hay);
    const isTextCapable = outputModalities.includes('text') || (!outputModalities.length && !isImageGeneration && !isVideo && !isAudio);
    const isArabicReady = (isTextCapable || isAudio) && /(gpt|gemini|claude|qwen|deepseek|llama|mistral|mixtral|ministral|command[-\s]?r|aya|jamba|grok|phi|granite|nemotron|pixtral|sonar|whisper|voice|speech|audio)/i.test(hay);
    const isArabicVoiceReady = isArabicReady && (isAudio || isTextCapable);
    const isDocumentReady = isTextCapable && (
      ctx >= 32000
      || !!model?.tools
      || /(doc|document|writer|report|office|word|presentation|slides|spreadsheet|pdf|chat|instruct|assistant|claude|gpt|gemini|qwen|mistral|llama)/i.test(hay)
    );

    if (isTextCapable) categories.add('general_text');
    if (isDocumentReady) categories.add('documents');
    if (isCoding) categories.add('coding');
    if (isResearch) categories.add('research');
    if (isVision) categories.add('vision');
    if (isImageGeneration) categories.add('image_generation');
    if (isVideo) categories.add('video');
    if (isAudio) categories.add('audio');
    if (isArabicReady) categories.add('arabic_support');
    if (isArabicVoiceReady) categories.add('arabic_voice_chat');
    if (!categories.size) categories.add('general_text');
    return Array.from(categories);
  }
  function pickPrimaryModelCategory(categories = []){
    const list = Array.isArray(categories) ? categories : [];
    const priority = ['image_generation', 'video', 'audio', 'arabic_voice_chat', 'coding', 'research', 'vision', 'documents', 'arabic_support', 'general_text'];
    return priority.find((key) => list.includes(key)) || 'general_text';
  }
  function buildModelCapabilityProfile(model = {}){
    const categories = Array.isArray(model.categories) && model.categories.length
      ? model.categories
      : inferModelCategories(model);
    return {
      text: categories.some((key) => ['general_text', 'documents', 'coding', 'research'].includes(key)),
      documents: categories.includes('documents'),
      coding: categories.includes('coding'),
      research: categories.includes('research'),
      vision: categories.includes('vision'),
      image_generation: categories.includes('image_generation'),
      video: categories.includes('video'),
      audio: categories.includes('audio'),
      arabic_support: categories.includes('arabic_support'),
      arabic_voice_chat: categories.includes('arabic_voice_chat')
    };
  }
  function getEnabledCapabilityKeys(profile = {}){
    return MODEL_CAPABILITY_DEFS
      .filter((item) => !!profile[item.key])
      .map((item) => item.key);
  }
  function summarizeModelCapabilities(model = {}, limit = 5){
    const profile = model.capabilities || buildModelCapabilityProfile(model);
    if (profile.arabic_voice_chat) return 'موصى به للدردشة الصوتية العربية داخل التطبيق، مع طبقة إملاء ونطق عربية محلية.';
    if (profile.arabic_support) return 'موصى به للمحادثة والكتابة بالعربية داخل المنصة.';
    const keys = getEnabledCapabilityKeys(profile);
    if (!keys.length) return 'عام';
    return keys.slice(0, Math.max(1, limit)).map(getModelCapabilityLabel).join(' • ');
  }
  function getModelRoutingNote(model = {}){
    const profile = model.capabilities || buildModelCapabilityProfile(model);
    if (profile.image_generation) return 'جاهز لمخرجات الصور والملفات المرئية أو روابط الأصول المباشرة.';
    if (profile.video) return 'جاهز لمهام الفيديو، storyboards، والملفات أو الروابط القابلة للتنزيل.';
    if (profile.audio) return 'جاهز للصوت، التفريغ، أو الملفات السمعية.';
    if (profile.coding) return 'جاهز لإنتاج كود ومشاريع وملفات تقنية قابلة للتنزيل.';
    if (profile.documents) return 'جاهز للمستندات والعروض والجداول القابلة للتنزيل.';
    if (profile.vision) return 'جاهز لقراءة الصور والمرفقات وتحليل المحتوى المرئي.';
    if (profile.research) return 'جاهز للمخرجات البحثية والتحليلية المتعددة الخطوات.';
    return 'جاهز لمهام النصوص والمحادثة العامة.';
  }
  function summarizeModelCapabilities(model = {}, limit = 5){
    const profile = model.capabilities || buildModelCapabilityProfile(model);
    const keys = getEnabledCapabilityKeys(profile);
    if (!keys.length) return 'ط¹ط§ظ…';
    return keys.slice(0, Math.max(1, limit)).map(getModelCapabilityLabel).join(' • ');
  }
  function getModelRoutingNote(model = {}){
    const profile = model.capabilities || buildModelCapabilityProfile(model);
    if (profile.arabic_voice_chat) return 'موصى به للدردشة الصوتية العربية داخل التطبيق، مع طبقة إملاء ونطق عربية محلية.';
    if (profile.arabic_support) return 'موصى به للمحادثة والكتابة بالعربية داخل المنصة.';
    if (profile.image_generation) return 'ط¬ط§ظ‡ط² ظ„ظ…ط®ط±ط¬ط§طھ ط§ظ„طµظˆط± ظˆط§ظ„ظ…ظ„ظپط§طھ ط§ظ„ظ…ط±ط¦ظٹط© ط£ظˆ ط±ظˆط§ط¨ط· ط§ظ„ط£طµظˆظ„ ط§ظ„ظ…ط¨ط§ط´ط±ط©.';
    if (profile.video) return 'ط¬ط§ظ‡ط² ظ„ظ…ظ‡ط§ظ… ط§ظ„ظپظٹط¯ظٹظˆطŒ storyboardsطŒ ظˆط§ظ„ظ…ظ„ظپط§طھ ط£ظˆ ط§ظ„ط±ظˆط§ط¨ط· ط§ظ„ظ‚ط§ط¨ظ„ط© ظ„ظ„طھظ†ط²ظٹظ„.';
    if (profile.audio) return 'ط¬ط§ظ‡ط² ظ„ظ„طµظˆطھطŒ ط§ظ„طھظپط±ظٹط؛طŒ ط£ظˆ ط§ظ„ظ…ظ„ظپط§طھ ط§ظ„ط³ظ…ط¹ظٹط©.';
    if (profile.coding) return 'ط¬ط§ظ‡ط² ظ„ط¥ظ†طھط§ط¬ ظƒظˆط¯ ظˆظ…ط´ط§ط±ظٹط¹ ظˆظ…ظ„ظپط§طھ طھظ‚ظ†ظٹط© ظ‚ط§ط¨ظ„ط© ظ„ظ„طھظ†ط²ظٹظ„.';
    if (profile.documents) return 'ط¬ط§ظ‡ط² ظ„ظ„ظ…ط³طھظ†ط¯ط§طھ ظˆط§ظ„ط¹ط±ظˆط¶ ظˆط§ظ„ط¬ط¯ط§ظˆظ„ ط§ظ„ظ‚ط§ط¨ظ„ط© ظ„ظ„طھظ†ط²ظٹظ„.';
    if (profile.vision) return 'ط¬ط§ظ‡ط² ظ„ظ‚ط±ط§ط،ط© ط§ظ„طµظˆط± ظˆط§ظ„ظ…ط±ظپظ‚ط§طھ ظˆطھط­ظ„ظٹظ„ ط§ظ„ظ…ط­طھظˆظ‰ ط§ظ„ظ…ط±ط¦ظٹ.';
    if (profile.research) return 'ط¬ط§ظ‡ط² ظ„ظ„ظ…ط®ط±ط¬ط§طھ ط§ظ„ط¨ط­ط«ظٹط© ظˆط§ظ„طھط­ظ„ظٹظ„ظٹط© ط§ظ„ظ…طھط¹ط¯ط¯ط© ط§ظ„ط®ط·ظˆط§طھ.';
    return 'ط¬ط§ظ‡ط² ظ„ظ…ظ‡ط§ظ… ط§ظ„ظ†طµظˆطµ ظˆط§ظ„ظ…ط­ط§ط¯ط«ط© ط§ظ„ط¹ط§ظ…ط©.';
  }
  function decorateModelRecord(model = {}){
    const categories = inferModelCategories(model);
    const capabilities = buildModelCapabilityProfile({ ...model, categories });
    return {
      ...model,
      categories,
      primaryCategory: pickPrimaryModelCategory(categories),
      capabilities,
      capabilityKeys: getEnabledCapabilityKeys(capabilities),
      routingNote: getModelRoutingNote({ ...model, categories, capabilities })
    };
  }

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
      const outputModalities = Array.isArray(m.output_modalities)
        ? m.output_modalities
        : (Array.isArray(arch.output_modalities) ? arch.output_modalities : []);
      const tools = !!m.supports_tools || !!m.tools;
      const vision = (String(modality).toLowerCase().includes('image') || String(modality).toLowerCase().includes('multimodal') || !!m.vision);
      const provider = String(id).split('/')[0] || '';
      return decorateModelRecord({ id, name, provider, ctx, pp, pc, tools, vision, modality, outputModalities });
    }).filter(x => x.id);
  }

  async function fetchOpenRouterModels(force=false){
    const cache = loadJSON(KEYS.modelCache, null);
    const freshMs = 1000 * 60 * 60 * 12;
    if (!force && cache?.ts && (nowTs() - cache.ts) < freshMs && Array.isArray(cache.models) && cache.models.length){
      const upgraded = cache.models.map((model) => decorateModelRecord(model));
      if (JSON.stringify(upgraded) !== JSON.stringify(cache.models)){
        saveJSON(KEYS.modelCache, { ts: cache.ts, models: upgraded });
      }
      return upgraded;
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
      : [decorateModelRecord({ id:'openrouter/free', name:'OpenRouter Free Router', provider:'openrouter', ctx:null, pp:0, pc:0, tools:false, vision:false, modality:'' }), ...seeded];
    const list = $('modelList');
    const q = String($('modelSearch')?.value || '').trim().toLowerCase();
    const providerFilter = String($('modelProviderFilter')?.value || '');
    const categoryFilter = String($('modelCategoryFilter')?.value || '');
    const sort = String($('modelSort')?.value || 'name');
    const favOnly = ($('modelFavOnlyBtn')?.dataset.on === '1');
    const favs = new Set(loadFavs());
    const hint = $('modelHubHint');
    const summary = $('modelCategorySummary');

    const baseModels = policy.freeMode ? models.filter(isFreeTierModel) : models.slice();
    let filtered = baseModels.slice();
    if (q) filtered = filtered.filter(m => (m.id.toLowerCase().includes(q) || (m.name||'').toLowerCase().includes(q)));
    if (providerFilter) filtered = filtered.filter(m => m.provider === providerFilter);
    if (categoryFilter) filtered = filtered.filter(m => (Array.isArray(m.categories) && m.categories.includes(categoryFilter)) || m.primaryCategory === categoryFilter);
    if (favOnly) filtered = filtered.filter(m => favs.has(m.id));

    const num = (x) => (x==null ? Number.POSITIVE_INFINITY : Number(x));
    if (sort === 'context_desc') filtered.sort((a,b)=> num(b.ctx)-num(a.ctx));
    else if (sort === 'price_prompt_asc') filtered.sort((a,b)=> num(a.pp)-num(b.pp));
    else if (sort === 'price_completion_asc') filtered.sort((a,b)=> num(a.pc)-num(b.pc));
    else filtered.sort((a,b)=> String(a.id).localeCompare(String(b.id)));

    if (hint){
      hint.textContent = policy.freeMode
        ? 'الخطة المجانية تعرض النماذج المجانية فقط، ويمكنك أيضًا فلترتها حسب نوع العمل مثل النصوص أو البرمجة أو الصور.'
        : '⭐ لحفظه كمفضلة. استخدم التصنيف للوصول سريعًا إلى موديلات النصوص، البرمجة، الصور، الفيديو، والعروض.';
    }
    const categorySel = $('modelCategoryFilter');
    if (categorySel){
      categorySel.innerHTML = '<option value="">كل التصنيفات</option>';
      const availableCategories = MODEL_CATEGORY_DEFS.filter((item) => baseModels.some((model) => (model.categories || []).includes(item.key)));
      availableCategories.forEach((item) => {
        const o = document.createElement('option');
        o.value = item.key;
        o.textContent = item.label;
        categorySel.appendChild(o);
      });
      categorySel.value = categoryFilter && availableCategories.some((item) => item.key === categoryFilter) ? categoryFilter : '';
    }
    if (summary){
      const chips = MODEL_CATEGORY_DEFS
        .map((item) => {
          const count = filtered.filter((model) => (model.categories || []).includes(item.key)).length;
          if (!count) return '';
          return `<button class="model-category-chip ${categoryFilter === item.key ? 'active' : ''}" type="button" data-model-category-chip="${escapeHtml(item.key)}">${escapeHtml(item.label)} <span>${count}</span></button>`;
        })
        .filter(Boolean)
        .join('');
      summary.innerHTML = chips || '<div class="hint">لا توجد تصنيفات متاحة للفلاتر الحالية.</div>';
      summary.querySelectorAll('[data-model-category-chip]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const key = String(btn.dataset.modelCategoryChip || '');
          if ($('modelCategoryFilter')) $('modelCategoryFilter').value = categoryFilter === key ? '' : key;
          renderModelHub();
        });
      });
    }

    list.innerHTML = '';
    if (!filtered.length){
      list.innerHTML = `<div class="status" data-tone="info">لا توجد نماذج مطابقة للفلترة الحالية${policy.freeMode ? ' داخل الفئة المجانية' : ''}.</div>`;
      return;
    }
    const groups = new Map();
    filtered.slice(0, 400).forEach((model) => {
      const key = model.primaryCategory || 'general_text';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(model);
    });
    MODEL_CATEGORY_DEFS.forEach((groupDef) => {
      const modelsInGroup = groups.get(groupDef.key);
      if (!modelsInGroup?.length) return;
      const section = document.createElement('section');
      section.className = 'model-section';
      section.innerHTML = `<div class="model-section-head"><strong>${escapeHtml(groupDef.label)} (${modelsInGroup.length})</strong><span class="hint">${escapeHtml(groupDef.note)}</span></div>`;
      const rows = document.createElement('div');
      rows.className = 'model-section-list';
      modelsInGroup.forEach(m => {
      const row = document.createElement('div');
      const freeTier = isFreeTierModel(m);
      row.className = `bubble model-card ${freeTier ? 'is-free' : 'is-paid'}`;
      const badges = [];
      if (m.ctx) badges.push(`<span class="tag">ctx ${escapeHtml(m.ctx)}</span>`);
      if (m.vision) badges.push(`<span class="tag">vision</span>`);
      if (m.tools) badges.push(`<span class="tag">tools</span>`);
      badges.push(`<span class="tag model-type-tag">${escapeHtml(getModelCategoryLabel(m.primaryCategory))}</span>`);
      badges.push(`<span class="tag ${freeTier ? 'tag-free' : 'tag-paid'}">${freeTier ? 'مجاني' : 'مدفوع'}</span>`);
      const prices = [];
      if (freeTier) prices.push('متاح ضمن الخطة المجانية');
      if (m.pp!=null) prices.push(`prompt: ${m.pp}`);
      if (m.pc!=null) prices.push(`completion: ${m.pc}`);
      const usageLabels = Array.from(new Set((m.categories || []).map(getModelCategoryLabel))).slice(0, 4);
      const capabilityLabels = Array.from(new Set((m.capabilityKeys || []).map(getModelCapabilityLabel))).slice(0, 5);
      const routeNote = m.routingNote || getModelRoutingNote(m);

      row.innerHTML = `
        <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start;">
          <div style="min-width:0; flex:1;">
            <div style="font-weight:1000; word-break:break-word">${escapeHtml(m.id)}</div>
            <div class="hint">${escapeHtml(m.name || '')}</div>
            <div style="margin-top:6px; display:flex; gap:8px; flex-wrap:wrap;">${badges.join('')}</div>
            <div class="hint model-usage-line">الاستخدامات: ${escapeHtml(usageLabels.join(' • '))}</div>
            <div class="hint model-usage-line">القدرات: ${escapeHtml(capabilityLabels.join(' • ') || 'عام')}</div>
            <div class="hint model-route-line">${escapeHtml(routeNote)}</div>
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
      rows.appendChild(row);
    });
      section.appendChild(rows);
      list.appendChild(section);
    });

    // provider dropdown
    const provSel = $('modelProviderFilter');
    if (provSel){
      provSel.innerHTML = '<option value="">كل المزوّدين</option>';
    }
    if (provSel && baseModels.length){
      const providerSource = baseModels;
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
    const back = $('backdrop');
    $('openSideBtn').addEventListener('click', openSide);
    $('closeSideBtn').addEventListener('click', closeSide);
    back.addEventListener('click', closeSide);
    $('accountTriggerBtn')?.addEventListener('click', openAccountCenter);
    $('accountSignInBtn')?.addEventListener('click', () => openAuthGate('', { force: true }));
    $('accountUpgradeRequestBtn')?.addEventListener('click', requestUpgradeByEmail);
    $('accountLogoutBtn')?.addEventListener('click', logoutCurrentAccount);
    $('activateUpgradeBtn')?.addEventListener('click', activateUpgradeCodeFromUi);
    $('adminGenerateUpgradeBtn')?.addEventListener('click', generateAdminUpgradeCodeFromUi);
    $('adminCopyUpgradeBtn')?.addEventListener('click', copyAdminUpgradeCode);
    $('authEntrySubmitBtn')?.addEventListener('click', submitUnifiedAuthEntry);
    $('authEntryForm')?.addEventListener('submit', (e) => { e.preventDefault(); submitUnifiedAuthEntry(); });
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
    $('authGoogleBrowserBtn')?.addEventListener('click', openGoogleAuthInBrowser);
    $('authRememberToggle')?.addEventListener('change', () => {
      if (!$('authRememberToggle')?.checked) clearRememberedAuthEntry();
    });

    // nav
    $('nav').addEventListener('click', (e) => {
      const btn = e.target.closest('.navbtn');
      if (!btn) return;
      if (btn.classList.contains('nav-group-toggle')) {
        const group = btn.closest('.nav-group');
        if (group) toggleNavGroup(group.id);
        return;
      }
      if (!btn.dataset.page) return;
      openWorkspacePage(btn.dataset.page, { closeSidebar: true });
    });

    setupCollapsibleToolbars();
    try{
      if (window.innerWidth < 980){
        if (localStorage.getItem(KEYS.chatToolbarCollapsed) === null) setChatToolbarCollapsed(true);
        if (localStorage.getItem(KEYS.headerCollapsed) === null) setHeaderCollapsed(false);
      }
    }catch(_){}
    applyUiCollapse();
    applyToolbarCollapses();
    applyShellLayout();

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
  applyToolbarCollapses();
  applyShellLayout();

  toast(getHeaderCollapsed() ? '✅ تم طي الشريط العلوي' : '✅ تم إظهار الشريط العلوي');
});

$('chatToolbarCollapseBtn')?.addEventListener('click', () => {
  setChatToolbarCollapsed(true);
  applyUiCollapse();
  applyToolbarCollapses();
  applyShellLayout();

  toast('✅ تم طي أدوات الدردشة');
});

$('chatToolbarExpandBtn')?.addEventListener('click', () => {
  setChatToolbarCollapsed(false);
  applyUiCollapse();
  applyToolbarCollapses();
  applyShellLayout();

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

    $('zoomOutBtn')?.addEventListener('click', () => {
      const next = setSavedZoomLevel(getSavedZoomLevel() - 0.05);
      toast(`🔎 تم التصغير إلى ${Math.round(next * 100)}%`);
    });
    $('zoomInBtn')?.addEventListener('click', () => {
      const next = setSavedZoomLevel(getSavedZoomLevel() + 0.05);
      toast(`🔍 تم التكبير إلى ${Math.round(next * 100)}%`);
    });
    $('darkModeBtn')?.addEventListener('click', () => {
      const next = !getDarkModeEnabled();
      setDarkModeEnabled(next);
      toast(next ? '🌙 تم تفعيل الوضع الداكن' : '☀️ تم إلغاء الوضع الداكن');
    });
    $('exitAppNavBtn')?.addEventListener('click', () => { void requestExitApp(); });

    $('newThreadBtn').addEventListener('click', () => { newThread(); openWorkspacePage('chat'); });

    document.addEventListener('click', (e) => {
      const quick = e.target.closest('[data-quick-prompt]');
      if (!quick) return;
      applyQuickPrompt(quick.dataset.quickPrompt || '');
    });

    document.addEventListener('click', (e) => {
      const openPageBtn = e.target.closest('[data-open-page]');
      if (openPageBtn){
        openWorkspacePage(openPageBtn.dataset.openPage || 'chat');
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
    
    // Workspace quick-action buttons (home screen)
    $('settingsGuideBtn')?.addEventListener('click', () => openWorkspacePage('guide'));

    // Workspace nav shortcut cards
    document.querySelectorAll('.wnav-card[data-page]').forEach((card) => {
      card.addEventListener('click', () => {
        const page = card.dataset.page;
        if (page) openWorkspacePage(page);
      });
    });

    // Chat attachments (inline)
    $('chatAttachBtn') && $('chatAttachBtn').addEventListener('click', openChatAttachmentPicker);
    $('chatAttachFiles') && $('chatAttachFiles').addEventListener('change', (e) => {
      const files = e.target.files;
      void addChatAttachments(files);
      e.target.value = '';
    });
    $('chatInput')?.addEventListener('focus', () => expandComposerOnFocus());
    $('chatInput')?.addEventListener('blur', () => {
      window.setTimeout(() => shrinkComposerToCompact(false), 80);
    });

    // New/Clear chat shortcuts in toolbar
    $('newChatBtn') && $('newChatBtn').addEventListener('click', () => { newThread(); openWorkspacePage('chat'); });
    $('clearChatBtn') && $('clearChatBtn').addEventListener('click', clearCurrentChat);
    $('agentTaskApplyBtn') && $('agentTaskApplyBtn').addEventListener('click', applyAgentTaskTemplate);
    $('agentTaskTemplate') && $('agentTaskTemplate').addEventListener('change', applyAgentTaskTemplate);
    $('scrollTopBtn') && $('scrollTopBtn').addEventListener('click', () => scrollChat('top'));
    $('scrollBottomBtn') && $('scrollBottomBtn').addEventListener('click', () => scrollChat('bottom'));
    $('chatReadingModeBtn')?.addEventListener('click', () => {
      const next = !isChatReadingModeEnabled();
      setChatReadingMode(next);
      toast(next ? '📖 وضع القراءة — مساحة أوضح للنص' : '✅ عادت أشرطة الدردشة');
    });
    $('chatReadingModeExitBtn')?.addEventListener('click', () => {
      setChatReadingMode(false);
      toast('✅ عادت أشرطة الدردشة');
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!document.body.classList.contains('chat-reading-mode')) return;
      setChatReadingMode(false);
    });
    $('floatingScrollBottomBtn') && $('floatingScrollBottomBtn').addEventListener('click', () => scrollChat('bottom'));
    $('chatLog') && $('chatLog').addEventListener('scroll', scheduleChatScrollDockSync, { passive:true });
    window.addEventListener('scroll', scheduleChatScrollDockSync, { passive:true });

    // Deep Search toggle (send = Research)
    $('deepSearchToggleBtn') && $('deepSearchToggleBtn').addEventListener('click', () => {
      const policy = getAppRuntimePolicy();
      if (!policy.allowDeepSearch) return toast(`⚠️ ${getPolicyFeatureReason('deepSearch', policy)}`);
      setDeepSearch(!isDeepSearch());
      refreshDeepSearchBtn();
      toast(isDeepSearch() ? '🔬 Deep Search ON' : '🔬 Deep Search OFF');
    });

    $('focusModeBtn')?.addEventListener('click', () => {
      setPromptEngineeringMode(!getPromptEngineeringMode());
      applyShellLayout();
      syncComposerMeta();
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
    $('voiceModeBtn')?.addEventListener('click', toggleVoiceMode);
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
    $('composerEditCancelBtn')?.addEventListener('click', () => {
      clearComposerEditState();
      $('chatInput')?.focus();
      toast('ℹ️ تم إلغاء وضع التعديل');
    });
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
    $('chatInputSingleBtn')?.addEventListener('click', () => setComposerMode('single'));
    $('chatInputMultiBtn')?.addEventListener('click', () => setComposerMode('multi'));
    setComposerMode(getComposerMode());

    $('chatInput').addEventListener('keydown', (e) => {
      const input = $('chatInput');
      if (!input) return;
      const mode = input.dataset.mode || getComposerMode();
      if (e.key !== 'Enter') return;

      // Multi-line mode: send with Ctrl/Cmd+Enter only
      if (mode === 'multi'){
        if (e.ctrlKey || e.metaKey){
          e.preventDefault();
          sendMessage();
        }
        return;
      }

      // Single-line mode: Enter sends; Shift+Enter inserts newline
      if (!e.shiftKey){
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
    $('gatewayPreset') && $('gatewayPreset').addEventListener('change', () => {
      const preset = $('gatewayPreset')?.value || 'managed';
      if ($('gatewayUrl')){
        $('gatewayUrl').disabled = preset !== 'custom';
        if (preset !== 'custom'){
          $('gatewayUrl').value = normalizeManagedGatewayUrl(DEFAULT_SETTINGS.gatewayUrl || getPlatformServiceRoot());
        } else if (!String($('gatewayUrl').value || '').trim()){
          $('gatewayUrl').value = normalizeManagedGatewayUrl(DEFAULT_SETTINGS.gatewayUrl || getPlatformServiceRoot());
        }
      }
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
    $('modelCategoryFilter').addEventListener('change', renderModelHub);
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
      openWorkspacePage('chat');
      toast('✅ تم إدراج النتائج في الدردشة');
      $('chatInput').focus();
    });
    const kbSave = () => {
      const pid = getCurProjectId();
      setKbSettings(pid, {
        embedModel: getKbEmbedModelFromUi(),
        topK: Number($('kbTopK')?.value || 6),
        chunkSize: Number($('kbChunkSize')?.value || 900),
        overlap: Number($('kbOverlap')?.value || 120),
        ragHint: $('kbRagHint')?.value || DEFAULT_KB.ragHint
      });
    };
    ['embedModel','embedModelPreset','embedModelCustom','kbTopK','kbChunkSize','kbOverlap','kbRagHint'].forEach(id => {
      const el = $(id);
      if (el) el.addEventListener('change', () => { kbSave(); toast('✅ تم حفظ إعدادات KB'); });
    });
    $('embedModelPreset')?.addEventListener('change', () => {
      const custom = $('embedModelCustom');
      if (!custom) return;
      const isCustom = $('embedModelPreset')?.value === 'custom';
      custom.style.display = isCustom ? '' : 'none';
      custom.setAttribute('aria-hidden', isCustom ? 'false' : 'true');
      if (!isCustom) custom.value = '';
    });

    // canvas
    $('canvasDoc').addEventListener('change', (e) => openCanvasDoc(e.target.value));
    $('canvasNewBtn').addEventListener('click', () => openCanvasDoc(''));
    $('canvasSaveBtn').addEventListener('click', saveCanvasDoc);
    $('canvasVersionsBtn').addEventListener('click', showCanvasVersions);
    $('canvasPreviewToggle').addEventListener('change', refreshCanvasPreview);
    $('canvasRefreshPreviewBtn').addEventListener('click', refreshCanvasPreview);
    $('canvasAiBtn').addEventListener('click', () => openCanvasAiModal());
    $('canvasExportBtn').addEventListener('click', () => openCanvasExportModal());
    $('canvasAiAction')?.addEventListener('change', () => syncCanvasAiModalSummary());
    $('canvasExportKind')?.addEventListener('change', () => syncCanvasExportModalSummary());
    $('canvasAiRunBtn')?.addEventListener('click', () => {
      const sel = $('canvasAiAction');
      const action = String(sel?.value || 'rewrite').trim();
      closeCanvasAiModal();
      canvasAi(action);
    });
    $('canvasAiCancelBtn')?.addEventListener('click', () => closeCanvasAiModal());
    $('canvasAiDismissBtn')?.addEventListener('click', () => closeCanvasAiModal());
    $('canvasAiModal')?.querySelector('[data-close-canvas-ai="1"]')?.addEventListener('click', () => closeCanvasAiModal());
    $('canvasExportRunBtn')?.addEventListener('click', () => {
      const sel = $('canvasExportKind');
      const kind = String(sel?.value || 'txt').trim().toLowerCase();
      closeCanvasExportModal();
      exportCanvasWithKind(kind);
    });
    $('canvasExportCancelBtn')?.addEventListener('click', () => closeCanvasExportModal());
    $('canvasExportDismissBtn')?.addEventListener('click', () => closeCanvasExportModal());
    $('canvasExportModal')?.querySelector('[data-close-canvas-export="1"]')?.addEventListener('click', () => closeCanvasExportModal());
    $('canvasVersionCloseBtn')?.addEventListener('click', () => {
      const modal = $('canvasVersionModal');
      if (!modal) return;
      modal.classList.remove('show');
      modal.setAttribute('aria-hidden', 'true');
    });
    $('canvasVersionModal')?.querySelector('[data-close-canvas-version="1"]')?.addEventListener('click', () => {
      const modal = $('canvasVersionModal');
      if (!modal) return;
      modal.classList.remove('show');
      modal.setAttribute('aria-hidden', 'true');
    });

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
      openWorkspacePage('chat');
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
        toast('⬇ تم تنزيل ملف Word قابل للتعديل');
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
        // Important: keep the download inside the same user gesture chain (mobile browsers block async downloads).
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
    $('resetSettingsBtn').addEventListener('click', () => {
      saveJSON(KEYS.settings, DEFAULT_SETTINGS);
      renderSettings();
      applyUiCollapse();
      applyToolbarCollapses();
      applyShellLayout();
      toast('\u062A\u0645 \u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0636\u0628\u0637');
    });
    $('refreshModelsBtn').addEventListener('click', () => refreshModelHub(true));
    $('clearModelsCacheBtn').addEventListener('click', clearModelsCache);

    // quick sync
    $('provider').addEventListener('change', () => {
      saveSettingsFromUI();
      applyUiCollapse();
      applyToolbarCollapses();
      applyShellLayout();
    });
    $('baseUrl').addEventListener('change', () => {
      saveSettingsFromUI();
      applyUiCollapse();
      applyToolbarCollapses();
      applyShellLayout();
    });
    $('webMode').addEventListener('change', () => {
      saveSettingsFromUI();
      refreshModeButtons();
    });
    $('model').addEventListener('change', () => {
      saveSettingsFromUI();
      applyUiCollapse();
      applyToolbarCollapses();
      applyShellLayout();
    });
  }

  // ---------------- Init ----------------
  function init(){
    // Never wipe persisted /auth/config snapshot on every boot: if the next fetch fails (token,
    // network, worker blip), authConfigAfterFetchFailure() had no "prev" and persisted
    // DEFAULT_AUTH_CONFIG — hiding admin password and clearing googleClientId (regression v8.61).
    AUTH_RUNTIME.config = null;
    // Migrate legacy focus-mode persistence to dedicated prompt-engineering key.
    if (localStorage.getItem(KEYS.promptEngineeringMode) === null){
      const legacy = localStorage.getItem(KEYS.focusMode);
      if (legacy !== null) localStorage.setItem(KEYS.promptEngineeringMode, legacy);
    }
    alignManagedRuntimeSettings();

    try{
      if (typeof isNativeAndroidPlatform === 'function' && isNativeAndroidPlatform()){
        document.body.classList.add('native-android');
        if (localStorage.getItem(KEYS.chatToolbarCollapsed) === null) setChatToolbarCollapsed(true);
      }
    }catch(_){}

    loadProjects();
    const pid = getCurProjectId();
    loadThreads(pid);
    $('curProjectName').textContent = getCurProject().name;

    ensureStrategicChrome();
    renderSettings();
    if (repairGatewayAfterAccessIssue('boot-invalid-gateway', getSettings())){
      renderSettings();
    }

    try{
      if (localStorage.getItem(KEYS.webToggle) === null) setWebToggle(true);
      const cur = getSettings();
      if (!cur.webMode || cur.webMode === 'off') setSettings({ webMode: 'openrouter_online' });
      const narrowUi = typeof window.matchMedia === 'function'
        ? window.matchMedia('(max-width: 1200px)').matches
        : window.innerWidth < 1200;
      if (narrowUi){
        if (localStorage.getItem(KEYS.chatToolbarCollapsed) === null) setChatToolbarCollapsed(true);
        if (localStorage.getItem(KEYS.headerCollapsed) === null) setHeaderCollapsed(false);
      }
    }catch(_){ }

    setupCollapsibleToolbars();
    applyUiCollapse();
    applyToolbarCollapses();
    applyShellLayout();

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
    applyUiZoom();
    applyDarkMode();

    bind();
    openWorkspacePage(DEFAULT_POST_LOGIN_PAGE);
    syncChatReadingModeUi();
    syncKeyboardEditingState();
    applyShellLayout();
    initializeAuthExperience().catch(()=>{});
    refreshStrategicWorkspace().catch(()=>{});

    try{
      if ('speechSynthesis' in window){
        window.speechSynthesis.getVoices();
        window.speechSynthesis.addEventListener('voiceschanged', () => {
          window.speechSynthesis.getVoices();
        }, { once: true });
        void waitForSpeechVoices(500);
      }
    }catch(_){}
    try{
      window._ttsStop = () => { void stopVoicePlayback(); };
    }catch(_){}
  }

  init();
})();


