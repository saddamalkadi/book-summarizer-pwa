/* Book Summarizer Pro v11 — Strategic multi-format ingestion + OCR -> AI Fix -> Export + Knowledge Base (Embeddings RAG)
   Supported ingestion: PDF, DOCX, TXT/MD/CSV/JSON/XML, HTML, RTF, Images (OCR), XLSX/XLS, PPTX/PPT (basic), EPUB (basic), ZIP (extract supported). */
(() => {
  const APP_VER = 54;

  const DB_NAME = 'book_summarizer_pro';
  const DB_VER  = 4;
  const STORE   = 'records';
  const KB_DOCS = 'kb_docs';
  const KB_CHUNKS = 'kb_chunks';
  const FILE_CACHE = 'file_cache';
  const DOWNLOADS = 'downloads';

  const $ = (id) => document.getElementById(id);



// -------- Chat Modes (Deep / Agent) --------
const CHAT_DEEP_KEY = 'chat_deep_mode_v1';
const CHAT_AGENT_KEY = 'chat_agent_mode_v1';

function isDeepMode(){ return (localStorage.getItem(CHAT_DEEP_KEY) || 'false') === 'true'; }
function setDeepMode(v){ localStorage.setItem(CHAT_DEEP_KEY, v ? 'true' : 'false'); }
function isAgentMode(){ return (localStorage.getItem(CHAT_AGENT_KEY) || 'false') === 'true'; }
function setAgentMode(v){ localStorage.setItem(CHAT_AGENT_KEY, v ? 'true' : 'false'); }

function updateChatModeButtons(){
  const deep = $('chatDeepBtn');
  const agent = $('chatAgentBtn');
  if (deep){ deep.classList.toggle('primary', isDeepMode()); }
  if (agent){ agent.classList.toggle('primary', isAgentMode()); }
}
  function setStatus(id, msg, show=true){
    const el = $(id);
    if (!el) return;
    el.style.display = show ? 'block' : 'none';
    el.textContent = msg || '';
  }

  function escapeHtml(s){
    return (s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }


  // -------- Strategic: Usage / Cost estimator (approx) --------
  function estimateTokensApprox(text){
    const s = String(text || '');
    return Math.max(1, Math.ceil(s.length / 4));
  }
  function getOpenRouterModelPricing(modelId){
    try{
      const cache = (typeof readOpenRouterModelsCache === 'function') ? readOpenRouterModelsCache() : null;
      const items = Array.isArray(cache?.items) ? cache.items : [];
      const m = items.find(x => (x.id || x.name) === modelId) || null;
      if (!m) return null;
      const p = m.pricing || {};
      const prompt = Number(m.pricing_prompt ?? p.prompt ?? p.input ?? p.prompt_price ?? null);
      const completion = Number(m.pricing_completion ?? p.completion ?? p.output ?? p.completion_price ?? null);
      if (!Number.isFinite(prompt) && !Number.isFinite(completion)) return null;
      return { prompt: (Number.isFinite(prompt) ? prompt : 0), completion: (Number.isFinite(completion) ? completion : 0) };
    }catch(_){}
    return null;
  }
  function formatUsd(v){
    const n = Number(v);
    if (!Number.isFinite(n)) return '—';
    if (n === 0) return '$0';
    if (Math.abs(n) < 0.01) return '$' + n.toFixed(6).replace(/0+$/,'').replace(/\.$/,'');
    return '$' + n.toFixed(4).replace(/0+$/,'').replace(/\.$/,'');
  }
  function readSessionUsage(){
    try{
      const raw = localStorage.getItem('chat_usage_totals_v1');
      if (!raw) return { tin:0, tout:0, cost:0 };
      const j = JSON.parse(raw);
      return { tin: Number(j.tin||0), tout: Number(j.tout||0), cost: Number(j.cost||0) };
    }catch(_){}
    return { tin:0, tout:0, cost:0 };
  }
  function writeSessionUsage(u){
    try{ localStorage.setItem('chat_usage_totals_v1', JSON.stringify(u)); }catch(_){}
  }
  function resetSessionUsage(){
    const u = { tin:0, tout:0, cost:0 };
    writeSessionUsage(u);
    updateUsageBar({ lastIn:0, lastOut:0, lastCost:null });
  }
  function updateUsageBar({ lastIn=0, lastOut=0, lastCost=null } = {}){
    const el = $('chatUsageBar');
    if (!el) return;
    const baseUrl = ($('baseUrl')?.value || '').trim();
    const isOR = (typeof isOpenRouterUrl === 'function') ? isOpenRouterUrl(baseUrl) : false;
    const model = ($('model')?.value || '').trim();
    const totals = readSessionUsage();
    const pricing = isOR ? getOpenRouterModelPricing(model) : null;

    const parts = [];
    parts.push(`النموذج: <b>${escapeHtml(model || '—')}</b>`);
    if (lastIn || lastOut){
      parts.push(`آخر طلب: ~${lastIn} tokens إدخال • ~${lastOut} tokens إخراج`);
      if (lastCost !== null) parts.push(`تكلفة تقديرية: <b>${formatUsd(lastCost)}</b>`);
    }
    parts.push(`إجمالي الجلسة: ~${Math.round(totals.tin)} / ~${Math.round(totals.tout)} tokens`);
    if (pricing) parts.push(`≈ <b>${formatUsd(totals.cost)}</b>`);
    parts.push(`<button id="resetUsageBtn" class="btn ghost sm" type="button" style="margin-right:10px">تصفير</button>`);
    el.innerHTML = parts.join(' • ');

    $('resetUsageBtn')?.addEventListener('click', (e)=>{ e.preventDefault(); resetSessionUsage(); }, { once:true });
  }
  
function recordProjectUsageForTurn(lastIn, lastOut, addCost){
  try{
    const pid = getCurrentProjectId ? getCurrentProjectId() : DEFAULT_PROJECT_ID;
    const u = loadProjectUsage(pid);
    u.tin += Number(lastIn||0);
    u.tout += Number(lastOut||0);
    u.cost += Number(addCost||0);
    saveProjectUsage(pid, u);

    const meta = getProjectMeta(pid);
    const budget = Number(meta?.budgetUsd||0);
    const alertPct = Number(meta?.alertPct||80);
    if (budget > 0){
      const pct = (u.cost / budget) * 100;
      if (pct >= alertPct){
        // show a gentle warning once per session per project
        const key = `budget_warned_${pid}`;
        if ((localStorage.getItem(key)||'false') !== 'true'){
          localStorage.setItem(key,'true');
          alert(`تنبيه: تكلفة مشروع "${meta.name}" وصلت تقريباً إلى ${pct.toFixed(1)}% من الميزانية.`);
        }
      }
    }
    updateProjectMeta(pid, { updatedAt: nowTs(), budgetUsd: budget, alertPct: alertPct });
  }catch(_){}
}

function recordUsageForTurn(userText, assistantText){
    const lastIn = estimateTokensApprox(userText || '');
    const lastOut = estimateTokensApprox(assistantText || '');
    const baseUrl = ($('baseUrl')?.value || '').trim();
    const isOR = (typeof isOpenRouterUrl === 'function') ? isOpenRouterUrl(baseUrl) : false;
    const model = ($('model')?.value || '').trim();

    let lastCost = null;
    let addCost = 0;
    if (isOR){
      const pricing = getOpenRouterModelPricing(model);
      if (pricing){
        addCost = (lastIn * (pricing.prompt || 0)) + (lastOut * (pricing.completion || 0));
        lastCost = addCost;
      }
    }
    const totals = readSessionUsage();
    totals.tin += lastIn;
    totals.tout += lastOut;
    totals.cost += addCost;
    writeSessionUsage(totals);
    updateUsageBar({ lastIn, lastOut, lastCost });
  }



const OR_FAV_KEY = 'openrouter_model_favorites_v1';
const OR_RECENT_KEY = 'openrouter_model_recent_v1';

function readJsonLS(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  }catch(_){}
  return fallback;
}

function writeJsonLS(key, value){
  try{ localStorage.setItem(key, JSON.stringify(value)); }catch(_){}
}

function getFavSet(){
  const arr = readJsonLS(OR_FAV_KEY, []);
  return new Set(Array.isArray(arr) ? arr : []);
}

function toggleFavorite(modelId){
  const s = getFavSet();
  if (s.has(modelId)) s.delete(modelId); else s.add(modelId);
  writeJsonLS(OR_FAV_KEY, Array.from(s));
  return s;
}

function addRecentModel(modelId){
  const arr = readJsonLS(OR_RECENT_KEY, []);
  const list = Array.isArray(arr) ? arr : [];
  const next = [modelId, ...list.filter(x => x !== modelId)].slice(0, 20);
  writeJsonLS(OR_RECENT_KEY, next);
  return next;
}

function getRecentModels(){
  const arr = readJsonLS(OR_RECENT_KEY, []);
  return Array.isArray(arr) ? arr : [];
}

  const STATIC_OR_MODELS = ["openai/gpt-5.3-chat", "openai/gpt-5.2", "openai/gpt-4.1", "openai/gpt-4o-mini", "anthropic/claude-3.7-sonnet", "anthropic/claude-3.5-sonnet", "anthropic/claude-3.5-haiku", "google/gemini-2.5-flash", "google/gemini-2.5-pro", "google/gemini-2.0-flash", "meta-llama/llama-3.1-70b-instruct", "meta-llama/llama-3.1-8b-instruct", "mistralai/mistral-large", "mistralai/mistral-medium", "mistralai/mistral-small", "deepseek/deepseek-chat", "qwen/qwen-2.5-72b-instruct", "qwen/qwen-2.5-7b-instruct"];
const OR_MODELS_CACHE_KEY = 'openrouter_models_cache_v1';

function readOpenRouterModelsCache(){
  try{
    const raw = localStorage.getItem(OR_MODELS_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  }catch(_){}
  return null;
}

function writeOpenRouterModelsCache(obj){
  try{ localStorage.setItem(OR_MODELS_CACHE_KEY, JSON.stringify(obj)); }catch(_){}
}

function clearOpenRouterModelsCache(){
  try{ localStorage.removeItem(OR_MODELS_CACHE_KEY); }catch(_){}
}


async function fetchOpenRouterModels(){
  const res = await fetch('https://openrouter.ai/api/v1/models', {
    method: 'GET',
    headers: { 'Accept': 'application/json' }
  });
  if (!res.ok){
    const txt = await res.text().catch(()=> '');
    throw new Error(`OpenRouter models error: ${res.status} ${res.statusText}${txt?`\n${txt}`:''}`);
  }
  const data = await res.json();
  const arr = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);

  return arr.map(m => {
    const id = m.id || m.name;
    const name = m.name || m.id || id;

    const ctx = m.context_length || m.contextLength || (m.top_provider && m.top_provider.context_length) || null;
    const pricing = m.pricing || {};
    const pPrompt = (pricing.prompt ?? pricing.input ?? pricing.prompt_price ?? null);
    const pComp = (pricing.completion ?? pricing.output ?? pricing.completion_price ?? null);

    const provider = (m.top_provider && m.top_provider.provider) || m.provider || m.publisher || m.organization || '';
    const modality = m.modality || (m.architecture && m.architecture.modality) || (m.architecture && m.architecture.modality_type) || '';
    const modStr = String(modality||'').toLowerCase();
    const vision = /multi|image|vision/.test(modStr);

    const sp = m.supported_parameters || m.supportedParameters || [];
    const spStr = Array.isArray(sp) ? sp.join(',').toLowerCase() : String(sp||'').toLowerCase();
    const tools = /tool|function|json_schema|response_format/.test(spStr);

    return {
      id, name,
      context_length: ctx,
      pricing: pricing,
      pricing_prompt: pPrompt,
      pricing_completion: pComp,
      provider, modality,
      vision, tools,
      raw: m
    };
  }).filter(x => x.id);
}
function populateOpenRouterDatalist(items){
  const dl = $('orModelsDatalist');
  if (!dl) return;
  dl.innerHTML = '';
  items.forEach(it => {
    const opt = document.createElement('option');
    opt.value = it.id;
    opt.label = it.id;
    dl.appendChild(opt);
  });
}

function filterOpenRouterItems(items, q){
  const query = String(q||'').trim().toLowerCase();
  if (!query) return items;
  return items.filter(it => String(it.id||'').toLowerCase().includes(query));
}

async function ensureOpenRouterModelsLoaded({force=false}={}){
  const baseUrl = ($('baseUrl')?.value || '').trim();
  const provider = ($('chatProvider')?.value || 'openai').trim();
  const shouldShow = (provider !== 'gemini' && isOpenRouterUrl(baseUrl));
  const toolbar = $('orModelsToolbar');
  const hint = $('orModelsHint');
  const status = $('orModelsStatus');

  if (toolbar) toolbar.style.display = shouldShow ? 'flex' : 'none';
  if (hint) hint.style.display = 'none';
  if (status) status.style.display = 'none';

  if (!shouldShow) return;

  const cache = readOpenRouterModelsCache();
  const isFresh = cache && Array.isArray(cache.items) && (Date.now() - (cache.ts||0) < 1000*60*60*24);

  try{
    if (!force && isFresh){
      populateOpenRouterDatalist(cache.items);
        try{ renderChatModelMenu(); }catch(_){ }
        try{ updateChatModelBtn(); }catch(_){ }
  try{ renderChatModelMenu(); }catch(_){ }
      if (hint) hint.style.display = 'block';
      return;
    }
    if (status){ status.style.display='block'; status.textContent='جاري تحميل قائمة موديلات OpenRouter...'; }
    const items = await fetchOpenRouterModels();
    writeOpenRouterModelsCache({ ts: Date.now(), items });
    populateOpenRouterDatalist(items);
      try{ renderChatModelMenu(); }catch(_){ }
      try{ updateChatModelBtn(); }catch(_){ }
  try{ renderChatModelMenu(); }catch(_){ }
    if (status){ status.textContent = `✅ تم تحميل ${items.length} موديل.`; }
    if (hint) hint.style.display='block';
  }catch(e){
      // Fallback to a small static list if network/CORS blocks OpenRouter models
      try{
        const existing = readOpenRouterModelsCache();
        const has = Array.isArray(existing?.items) && existing.items.length;
        if (!has && Array.isArray(STATIC_OR_MODELS) && STATIC_OR_MODELS.length){
          const items = STATIC_OR_MODELS.map(id => ({ id }));
          writeOpenRouterModelsCache({ ts: Date.now(), items, static: true });
          populateOpenRouterDatalist(items);
      try{ renderChatModelMenu(); }catch(_){ }
          try{ renderChatModelMenu(); }catch(_){ }
        }
      }catch(_){ }

    if (status){ status.style.display='block'; status.textContent = '❌ فشل تحميل قائمة الموديلات: ' + (e?.message||e); }
  }
}


function guessMimeByName(name){
  const n = String(name||'').toLowerCase();
  const ext = n.split('.').pop();
  const map = {
    'txt':'text/plain;charset=utf-8',
    'md':'text/markdown;charset=utf-8',
    'csv':'text/csv;charset=utf-8',
    'json':'application/json;charset=utf-8',
    'xml':'application/xml;charset=utf-8',
    'html':'text/html;charset=utf-8',
    'htm':'text/html;charset=utf-8',
    'js':'text/javascript;charset=utf-8',
    'css':'text/css;charset=utf-8',
    'pdf':'application/pdf',
    'docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'pptx':'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'zip':'application/zip',
    'png':'image/png',
    'jpg':'image/jpeg',
    'jpeg':'image/jpeg',
    'webp':'image/webp'
  };
  return map[ext] || 'application/octet-stream';
}

function decodeBase64ToBytes(b64){
  const clean = String(b64||'').replace(/\s+/g,'').trim();
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i=0; i<bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function parseAIFileBlocks(text){
  const files = [];
  const src = String(text || '');

  // Pattern: ```file name="x.ext" mime="..." encoding="base64"\n...``` 
  const re = /```file\s*([^\n`]*)\n([\s\S]*?)```/g;
  let cleaned = src.replace(re, (m, header, body) => {
    const meta = {};
    String(header||'').replace(/(\w+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s]+))/g, (_m, k, _v, v1, v2, v3) => {
      meta[k.toLowerCase()] = (v1 ?? v2 ?? v3 ?? '').trim();
      return '';
    });
    const name = meta.name || meta.filename || meta.file || `file_${Date.now()}.txt`;
    const mime = meta.mime || meta.type || guessMimeByName(name);
    const encoding = (meta.encoding || 'text').toLowerCase();
    files.push({ name, mime, encoding, body: String(body||'') });
    return `\n\n[ملف مُنشأ: ${name}]\n\n`;
  });

  // Also accept: <!--FILE name="x" mime="..." encoding="base64"--> ... <!--/FILE-->
  const re2 = /<!--\s*FILE\s*([^>]*)-->\s*([\s\S]*?)\s*<!--\s*\/FILE\s*-->/g;
  cleaned = cleaned.replace(re2, (m, header, body) => {
    const meta = {};
    String(header||'').replace(/(\w+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s]+))/g, (_m, k, _v, v1, v2, v3) => {
      meta[k.toLowerCase()] = (v1 ?? v2 ?? v3 ?? '').trim();
      return '';
    });
    const name = meta.name || meta.filename || meta.file || `file_${Date.now()}.txt`;
    const mime = meta.mime || meta.type || guessMimeByName(name);
    const encoding = (meta.encoding || 'text').toLowerCase();
    files.push({ name, mime, encoding, body: String(body||'') });
    return `\n\n[ملف مُنشأ: ${name}]\n\n`;
  });

  return { cleanedText: cleaned.trim(), files };
}

async function createDownloadsFromAIBlocks(messageObj){
  try{
    const parsed = parseAIFileBlocks(messageObj?.content || '');
    if (!parsed.files.length) return;

    messageObj.content = parsed.cleanedText;
    messageObj.aiFiles = [];

    for (const f of parsed.files){
      let blob;
      if (f.encoding === 'base64' || f.encoding === 'b64'){
        const bytes = decodeBase64ToBytes(f.body);
        blob = new Blob([bytes], { type: f.mime || 'application/octet-stream' });
      } else {
        blob = new Blob([f.body], { type: f.mime || guessMimeByName(f.name) });
      }

      const id = await addDownloadRecord(f.name, blob);
      messageObj.aiFiles.push({
        id,
        name: f.name,
        mime: blob.type || f.mime,
        size: blob.size || 0
      });
    }
  }catch(e){
    console.warn('createDownloadsFromAIBlocks error', e);

// Append clickable links into the assistant message
if (Array.isArray(messageObj.aiFiles) && messageObj.aiFiles.length){
  const lines = messageObj.aiFiles.map(f => `- [⬇ تنزيل ${f.name}](#download:${f.id}) (${humanSize(f.size||0)})`);
  messageObj.content = (String(messageObj.content||'').trim() + `\n\n### ملفات قابلة للتنزيل\n` + lines.join('\n')).trim();
}


  }
}

async function downloadFromDownloadsStore(id){
  try{
    const rec = await dbGet(DOWNLOADS, id);
    if (!rec?.blob) return alert('الملف غير متاح (قد يكون تم مسحه من التحميلات).');
    triggerDownload(rec.name || 'file', rec.blob);
  }catch(e){
    alert('فشل تنزيل الملف: ' + (e?.message || e));
  }
}


function openrouterSourcesFromAnnotations(annotations){
  try{
    const anns = Array.isArray(annotations) ? annotations : [];
    const links = [];
    for (const a of anns){
      const url = a?.url || a?.uri;
      const title = a?.title || url;
      if (url) links.push({url, title});
    }
    const seen = new Set();
    const uniq = [];
    for (const l of links){
      if (seen.has(l.url)) continue;
      seen.add(l.url);
      uniq.push(l);
    }
    if (!uniq.length) return '';
    const lines = uniq.slice(0, 12).map((l,i)=> `- [${escapeHtml(l.title || ('Source ' + (i+1)))}](${l.url})`);
    return `\n\n### المصادر\n${lines.join('\n')}`;
  }catch(_){}
  return '';
}


function renderMarkdown(text){
  const raw = String(text || '');
  const safe = raw.replace(/</g,'&lt;').replace(/>/g,'&gt;');
  try{
    if (window.marked && typeof window.marked.parse === 'function'){
      return window.marked.parse(safe, { breaks:true, gfm:true });
    }
  }catch(_){}
  return `<pre style="white-space:pre-wrap;margin:0">${safe}</pre>`;
}

function enhanceCodeBlocks(container){
  if (!container) return;
  const pres = container.querySelectorAll('pre');
  pres.forEach(pre => {
    if (pre.dataset.enhanced) return;
    pre.dataset.enhanced = '1';
    const code = pre.querySelector('code');
    if (!code) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'copycode';
    btn.textContent = 'نسخ';
    btn.onclick = async () => {
      const ok = await copyToClipboard(code.textContent || '');
      btn.textContent = ok ? 'تم' : 'فشل';
      setTimeout(()=> btn.textContent='نسخ', 900);
    };
    pre.appendChild(btn);
  });
}

  function detectRTL(text){
    return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(text || '');
  }


function enhanceLinks(container){
  if (!container) return;
  const links = container.querySelectorAll('a[href]');
  links.forEach(a => {
    const href = a.getAttribute('href') || '';
    if (!href) return;

    // Internal download handler: #download:<id>
    if (href.startsWith('#download:')){
      const id = href.replace('#download:','').trim();
      a.addEventListener('click', (e) => {
        e.preventDefault();
        downloadFromDownloadsStore(id);
      });
      a.setAttribute('role','button');
      a.style.cursor = 'pointer';
      return;
    }

    
// ChatGPT sandbox links are NOT valid on GitHub Pages; try map to downloads by filename
if (href.startsWith('sandbox:/mnt/data/')){
  const name = href.split('/').pop();
  a.addEventListener('click', async (e) => {
    e.preventDefault();
    try{
      const items = await listDownloads();
      const found = items.find(x => String(x.name||'') === String(name||''));
      if (found){ downloadFromDownloadsStore(found.id); return; }
    }catch(_){}
    alert('هذا الرابط (sandbox:/mnt/data) خاص ببيئة ChatGPT ولن يعمل على موقعك. اطلب من النموذج إنشاء الملف بصيغة ```file``` ليظهر زر تنزيل.');
  });
  a.setAttribute('role','button');
  a.style.cursor = 'pointer';
  return;
}


      // External links open in new tab
    if (href.startsWith('http://') || href.startsWith('https://')){
      a.setAttribute('target','_blank');
      a.setAttribute('rel','noopener');
    }


function linkifyPlainText(container){
  if (!container) return;
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode(node){
      if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      const p = node.parentElement;
      if (!p) return NodeFilter.FILTER_REJECT;
      if (p.closest('a,pre,code,textarea')) return NodeFilter.FILTER_REJECT;
      const v = node.nodeValue;
      if (!/https?:\/\//i.test(v) && !/sandbox:\/mnt\/data\//i.test(v)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);

  const urlRe = /(https?:\/\/[^\s)\]]+)/ig;
  const sbRe = /(sandbox:\/mnt\/data\/[A-Za-z0-9._-]+)/ig;

  for (const node of nodes){
    const text = node.nodeValue;
    let parts = [];
    let i = 0;

    // Combine matches from both regexes
    const matches = [];
    for (const re of [urlRe, sbRe]){
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(text))){
        matches.push({ start: m.index, end: m.index + m[0].length, value: m[0] });
      }
    }
    matches.sort((a,b)=> a.start - b.start);
    // remove overlaps
    const filtered = [];
    let lastEnd = -1;
    for (const m of matches){
      if (m.start < lastEnd) continue;
      filtered.push(m);
      lastEnd = m.end;
    }

    if (!filtered.length) continue;

    const frag = document.createDocumentFragment();
    for (const m of filtered){
      if (m.start > i){
        frag.appendChild(document.createTextNode(text.slice(i, m.start)));
      }
      const a = document.createElement('a');
      a.href = m.value;
      a.textContent = m.value;
      a.className = 'autolink';
      frag.appendChild(a);
      frag.appendChild(document.createTextNode(' ')); // space separator
      i = m.end;
    }
    if (i < text.length){
      frag.appendChild(document.createTextNode(text.slice(i)));
    }
    node.parentNode.replaceChild(frag, node);
  }
}
  });
}


async function readSSEStream(res, onEvent, signal){
  const reader = res.body.getReader();
  const dec = new TextDecoder('utf-8');
  let buf = '';
  while (true){
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const {value, done} = await reader.read();
    if (done) break;
    buf += dec.decode(value, {stream:true});
    let idx;
    while ((idx = buf.indexOf('\n\n')) >= 0){
      const chunk = buf.slice(0, idx);
      buf = buf.slice(idx+2);
      const lines = chunk.split('\n');
      let event = 'message';
      let dataLines = [];
      for (const ln of lines){
        if (ln.startsWith('event:')) event = ln.slice(6).trim();
        else if (ln.startsWith('data:')) dataLines.push(ln.slice(5).trim());
      }
      const dataStr = dataLines.join('\n');
      if (dataStr === '[DONE]') return;
      if (dataStr) onEvent({event, data: dataStr});
    }
  }
}

async function callGeminiStream({ geminiKey, geminiModel, systemInstructionText, contents, temperature=0.25, maxOutputTokens=4096, signal, onDelta , enableWebSearch}){
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:streamGenerateContent?alt=sse`;
  const body = {
    contents: Array.isArray(contents) ? contents : [],
    generationConfig: { temperature, maxOutputTokens }
  };
  if (systemInstructionText && systemInstructionText.trim()){
    body.system_instruction = { parts: [{ text: systemInstructionText.trim() }] };
  }
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type':'application/json', 'x-goog-api-key': geminiKey },
    body: JSON.stringify(body),
    signal
  });
  if (!res.ok){
    const txt = await res.text().catch(()=> '');
    throw new Error(`Gemini API Error: ${res.status} ${res.statusText}${txt ? ('\n' + txt) : ''}`);
  }

  let combined = '';
  let finishReason = null;
    let gmStream = null;

  await readSSEStream(res, ({data}) => {
    try{
      const json = JSON.parse(data);
      const cand = json?.candidates?.[0] || {};
      finishReason = cand.finishReason || finishReason;
        if (cand.groundingMetadata) gmStream = cand.groundingMetadata;
      const parts = cand?.content?.parts || [];
      const text = parts.map(p => p?.text).filter(Boolean).join('');
      if (text){
        combined += text;
        onDelta && onDelta(text, combined);
      }
    }catch(_){}
  }, signal);

  const sourcesMd = gmStream ? geminiSourcesMarkdown(gmStream) : '';
    return { text: ((combined||'').trim() + (sourcesMd||'')).trim(), finishReason };
}

async function callOpenAIResponsesStream({ apiKey, baseUrl, model, instructions, input, temperature=0.25, max_output_tokens=4096, signal, onDelta }){
  const payload = {
    model,
    instructions,
    input,
    temperature,
    max_output_tokens,
    stream: true,
    text: { format: { type: "text" } }
  };
  const res = await fetch(baseUrl.replace(/\/+$/,'') + '/responses', {
    method:'POST',
    headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer ' + apiKey },
    body: JSON.stringify(payload),
    signal
  });
  if (!res.ok){
    const data = await res.text().catch(()=> '');
    throw new Error(`OpenAI Error: ${res.status} ${res.statusText}${data ? ('\n' + data) : ''}`);
  }
  let combined='';
  await readSSEStream(res, ({data}) => {
    try{
      const j = JSON.parse(data);
      const delta = j?.delta;
      if (typeof delta === 'string' && delta){
        combined += delta;
        onDelta && onDelta(delta, combined);
      } else if (j?.type === 'response.output_text.delta' && typeof j?.delta === 'string'){
        combined += j.delta;
        onDelta && onDelta(j.delta, combined);
      }
    }catch(_){}
  }, signal);
  return combined.trim();
}

  function sanitizeApiKey(k){
    return (k||'')
      .replace(/\s+/g,'')
      .replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g,'');
  }

  function isAsciiOnly(str){ return /^[\x00-\x7F]+$/.test(str); }

  function nowTs(){ return Date.now(); }

  function fmtTime(ts){
    try{ return new Date(ts).toLocaleString(); } catch { return String(ts); }
  }


  function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

  function makeId(prefix='rec'){
    if (crypto?.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
    return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
  }

  // -------------------- IndexedDB --------------------
  function openDB(){
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = () => {
        const db = req.result;

        if (!db.objectStoreNames.contains(STORE)){
          const os = db.createObjectStore(STORE, { keyPath: 'id' });
          os.createIndex('by_type', 'type', { unique: false });
          os.createIndex('by_updatedAt', 'updatedAt', { unique: false });
        }

        if (!db.objectStoreNames.contains(KB_DOCS)){
          const ds = db.createObjectStore(KB_DOCS, { keyPath: 'id' });
          ds.createIndex('by_name', 'name', { unique: false });
          ds.createIndex('by_updatedAt', 'updatedAt', { unique: false });
        }
        if (!db.objectStoreNames.contains(KB_CHUNKS)){
          const cs = db.createObjectStore(KB_CHUNKS, { keyPath: 'id' });
          cs.createIndex('by_docId', 'docId', { unique: false });
          cs.createIndex('by_updatedAt', 'updatedAt', { unique: false });
        }

        if (!db.objectStoreNames.contains(FILE_CACHE)){
          const fs = db.createObjectStore(FILE_CACHE, { keyPath: 'hash' });
          fs.createIndex('by_fileId', 'fileId', { unique: false });
          fs.createIndex('by_updatedAt', 'updatedAt', { unique: false });
        }

        if (!db.objectStoreNames.contains(DOWNLOADS)){
          const ds = db.createObjectStore(DOWNLOADS, { keyPath: 'id' });
          ds.createIndex('by_createdAt', 'createdAt', { unique: false });
          ds.createIndex('by_name', 'name', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function dbPut(storeName, record){
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(record);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function dbDelete(storeName, id){
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete(id);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function dbClearAll(storeName){
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).clear();
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function dbGet(storeName, key){
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async function dbGetAll(storeName){
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  // -------------------- Settings --------------------
  function loadSettings(){
    const saved = {
      apiKey: localStorage.getItem('apiKey') || '',
      chatProvider: localStorage.getItem('chatProvider') || 'openai',
      geminiKey: localStorage.getItem('geminiKey') || '',
      geminiModel: localStorage.getItem('geminiModel') || 'gemini-2.0-flash',
      baseUrl: localStorage.getItem('baseUrl') || 'https://api.openai.com/v1',
      model: localStorage.getItem('model') || 'gpt-3.5-turbo',
      embedModel: localStorage.getItem('embedModel') || 'text-embedding-3-small',
      language: localStorage.getItem('language') || 'ar',
      ocrLang: localStorage.getItem('ocrLang') || 'auto',
      aiFixMode: localStorage.getItem('aiFixMode') || 'safe',
      chatUseDoc: localStorage.getItem('chatUseDoc') || 'on',
      chatUseKB: localStorage.getItem('chatUseKB') || 'on',
      chatSystemPrompt: localStorage.getItem('chatSystemPrompt') || '',
      chatMaxOutTokens: parseInt(localStorage.getItem('chatMaxOutTokens') || '4096', 10),
      chatMaxParts: parseInt(localStorage.getItem('chatMaxParts') || '6', 10),
      chatHistoryTurns: parseInt(localStorage.getItem('chatHistoryTurns') || '14', 10),
      chatStreaming: (localStorage.getItem('chatStreaming') || 'true') === 'true',
      openrouterWebSearch: (localStorage.getItem('openrouterWebSearch') || 'false') === 'true',
      chatSmartMemory: (localStorage.getItem('chatSmartMemory') || 'true') === 'true',
      apiMode: localStorage.getItem('apiMode') || 'chat',
      reasoningEffort: localStorage.getItem('reasoningEffort') || 'medium',
      reasoningSummary: localStorage.getItem('reasoningSummary') || 'off',
      chatDirectFiles: localStorage.getItem('chatDirectFiles') || 'auto',
      visionMode: localStorage.getItem('visionMode') || 'auto',
      ccWorkerUrl: localStorage.getItem('ccWorkerUrl') || '',
      ccCloudOcr: localStorage.getItem('ccCloudOcr') || 'on',
    };

    $('apiKey') && ($('apiKey').value = saved.apiKey);
    
    $('chatProvider') && ($('chatProvider').value = saved.chatProvider);
    $('geminiKey') && ($('geminiKey').value = saved.geminiKey);
    $('geminiModel') && ($('geminiModel').value = saved.geminiModel);
    $('geminiWebSearch') && ($('geminiWebSearch').checked = !!saved.geminiWebSearch);
    toggleChatProviderUI();
$('baseUrl') && ($('baseUrl').value = saved.baseUrl);
    $('model') && ($('model').value = saved.model);
    $('embedModel') && ($('embedModel').value = saved.embedModel);
    $('language') && ($('language').value = saved.language);
    $('ocrLang') && ($('ocrLang').value = saved.ocrLang);
    $('aiFixMode') && ($('aiFixMode').value = saved.aiFixMode);
    $('chatUseDoc') && ($('chatUseDoc').value = saved.chatUseDoc);
    $('chatUseKB') && ($('chatUseKB').value = saved.chatUseKB);
    $('chatSystemPrompt') && ($('chatSystemPrompt').value = saved.chatSystemPrompt);
    $('chatMaxOutTokens') && ($('chatMaxOutTokens').value = saved.chatMaxOutTokens);
    $('chatMaxParts') && ($('chatMaxParts').value = saved.chatMaxParts);
    $('chatHistoryTurns') && ($('chatHistoryTurns').value = saved.chatHistoryTurns);
    $('chatStreaming') && ($('chatStreaming').checked = !!saved.chatStreaming);
    $('openrouterWebSearch') && ($('openrouterWebSearch').checked = !!saved.openrouterWebSearch);
    $('chatSmartMemory') && ($('chatSmartMemory').checked = !!saved.chatSmartMemory);
    $('apiMode') && ($('apiMode').value = saved.apiMode);
    $('reasoningEffort') && ($('reasoningEffort').value = saved.reasoningEffort);
    $('reasoningSummary') && ($('reasoningSummary').value = saved.reasoningSummary);
    $('chatDirectFiles') && ($('chatDirectFiles').value = saved.chatDirectFiles);
    $('visionMode') && ($('visionMode').value = saved.visionMode);
    $('ccWorkerUrl') && ($('ccWorkerUrl').value = saved.ccWorkerUrl);
    $('ccCloudOcr') && ($('ccCloudOcr').value = saved.ccCloudOcr);
  }

  function saveSettings(){
    localStorage.setItem('apiKey', sanitizeApiKey($('apiKey')?.value || ''));
    localStorage.setItem('chatProvider', ($('chatProvider')?.value || 'openai').trim());
    localStorage.setItem('geminiKey', sanitizeApiKey($('geminiKey')?.value || ''));
    localStorage.setItem('geminiModel', ($('geminiModel')?.value || '').trim());
    localStorage.setItem('geminiWebSearch', String(!!$('geminiWebSearch')?.checked));
    localStorage.setItem('baseUrl', ($('baseUrl')?.value || '').trim());
    localStorage.setItem('model', ($('model')?.value || '').trim());
    localStorage.setItem('embedModel', ($('embedModel')?.value || '').trim());
    localStorage.setItem('language', $('language')?.value || 'ar');
    localStorage.setItem('ocrLang', $('ocrLang')?.value || 'auto');
    localStorage.setItem('aiFixMode', $('aiFixMode')?.value || 'safe');
    localStorage.setItem('chatUseDoc', $('chatUseDoc')?.value || 'on');
    localStorage.setItem('chatUseKB', $('chatUseKB')?.value || 'on');
    localStorage.setItem('chatSystemPrompt', ($('chatSystemPrompt')?.value || '').trim());
    localStorage.setItem('chatMaxOutTokens', String(parseInt($('chatMaxOutTokens')?.value || '4096', 10) || 4096));
    localStorage.setItem('chatMaxParts', String(parseInt($('chatMaxParts')?.value || '6', 10) || 6));
    localStorage.setItem('chatHistoryTurns', String(parseInt($('chatHistoryTurns')?.value || '14', 10) || 14));
    localStorage.setItem('apiMode', $('apiMode')?.value || 'chat');
    localStorage.setItem('reasoningEffort', $('reasoningEffort')?.value || 'medium');
    localStorage.setItem('reasoningSummary', $('reasoningSummary')?.value || 'off');
    localStorage.setItem('chatDirectFiles', $('chatDirectFiles')?.value || 'auto');
    localStorage.setItem('visionMode', $('visionMode')?.value || 'auto');
    localStorage.setItem('ccWorkerUrl', ($('ccWorkerUrl')?.value || '').trim());
    localStorage.setItem('ccCloudOcr', $('ccCloudOcr')?.value || 'on');
    alert('تم حفظ الإعدادات.');
  }

  function getSettingsOrThrow(){
    const apiKey = sanitizeApiKey($('apiKey')?.value || '');
    const baseUrl = ($('baseUrl')?.value || '').trim();
    const model = ($('model')?.value || '').trim();
    const embedModel = ($('embedModel')?.value || '').trim();
    const language = $('language')?.value || 'ar';
    const apiMode = ($('apiMode')?.value || 'chat').trim();
    const reasoningEffort = ($('reasoningEffort')?.value || 'medium').trim();
    const reasoningSummary = ($('reasoningSummary')?.value || 'off').trim();
    const chatDirectFiles = ($('chatDirectFiles')?.value || 'auto').trim();
    const visionMode = ($('visionMode')?.value || 'auto').trim();

    if (!apiKey) throw new Error('يرجى إدخال API key');
    if (!isAsciiOnly(apiKey)) throw new Error('API key يجب أن يكون إنجليزي فقط (بدون أحرف عربية/رموز مخفية).');
    if (!baseUrl) throw new Error('Base URL فارغ');
    if (!model) throw new Error('Model فارغ');
    if (!embedModel) throw new Error('Embedding Model فارغ');

    return { apiKey, baseUrl, model, embedModel, language, apiMode, reasoningEffort, reasoningSummary, chatDirectFiles, visionMode };
  }


  function getCloudConvertSettings(){
    const ccWorkerUrl = (($('ccWorkerUrl')?.value || '').trim()).replace(/\/+$/,'');
    const ccCloudOcr  = (($('ccCloudOcr')?.value || 'on').trim());
    return { ccWorkerUrl, ccCloudOcr };
  }


  function toggleChatProviderUI(){
    const prov = ($('chatProvider')?.value || 'openai').trim();
    const showGem = prov === 'gemini';
    $('geminiKeyField') && ($('geminiKeyField').style.display = showGem ? 'block' : 'none');
    $('geminiModelField') && ($('geminiModelField').style.display = showGem ? 'block' : 'none');
    // OpenAI-only fields remain visible; this is just a quick experimental switch.
  }


  function getOcrLangSelection(){
    const v = ($('ocrLang')?.value || 'auto').trim();
    return v === 'auto' ? 'ara+eng' : v;
  }

  // -------------------- UI --------------------
  
function showTab(name){
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  ['text','summary','chat','canvas','downloads','history'].forEach(n => {
    const el = $(`page-${n}`);
    if (el) el.classList.toggle('active', n === name);
  });

  // Track active tab for scoped focus mode / UX
  try{
    document.body.classList.toggle('tab-chat', name === 'chat');
    document.body.classList.toggle('tab-canvas', name === 'canvas');
    document.body.classList.toggle('tab-text', name === 'text');
    localStorage.setItem('activeTab', name);
  }catch(_){}
}
  function openSettings(open){
    $('overlay')?.classList.toggle('show', !!open);
    $('settingsDrawer')?.classList.toggle('show', !!open);
  }
  function openExport(open){
    $('overlay')?.classList.toggle('show', !!open);
    $('exportSheet')?.classList.toggle('show', !!open);
  }
  function openKBDrawer(open){
    $('overlay')?.classList.toggle('show', !!open);
    $('kbDrawer')?.classList.toggle('show', !!open);
  }

  // -------------------- OCR (PDF.js + Tesseract) --------------------
  function initPdfJs(){
    const pdfjsLib = window.pdfjsLib;
    if (!pdfjsLib) throw new Error('pdf.js لم يتم تحميله');
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
    return pdfjsLib;
  }

  function enhanceCanvas(canvas){
    const ctx = canvas.getContext('2d');
    const img = ctx.getImageData(0,0,canvas.width,canvas.height);
    const d = img.data;
    const contrast = 1.15;
    const intercept = 128 * (1 - contrast);
    for (let i=0;i<d.length;i+=4){
      const r = d[i], g = d[i+1], b = d[i+2];
      let y = 0.299*r + 0.587*g + 0.114*b;
      y = contrast * y + intercept;
      const t = 180;
      const v = y > t ? 255 : 0;
      d[i]=d[i+1]=d[i+2]=v;
      d[i+3]=255;
    }
    ctx.putImageData(img,0,0);
  }

  async function extractTextFromPDF(file, useOcr, enhance, statusBoxId){
    const pdfjsLib = initPdfJs();
    const typedarray = new Uint8Array(await file.arrayBuffer());
    const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;

    let fullText = '';
    const ocrLangs = getOcrLangSelection();

    for (let pageNum=1; pageNum<=pdf.numPages; pageNum++){
      const page = await pdf.getPage(pageNum);

      if (useOcr){
        setStatus(statusBoxId, `OCR جاري... صفحة ${pageNum}/${pdf.numPages}`, true);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;
        if (enhance) enhanceCanvas(canvas);

        const result = await Tesseract.recognize(canvas, ocrLangs, {
          logger: (m) => {
            if (m?.status){
              const pct = m.progress ? Math.round(m.progress*100) : null;
              setStatus(statusBoxId, `OCR: ${m.status}${pct!==null?` (${pct}%)`:''} — صفحة ${pageNum}/${pdf.numPages}`, true);
            }
          }
        });

        fullText += (result?.data?.text || '') + `\n\n--- صفحة ${pageNum} ---\n\n`;
      } else {
        setStatus(statusBoxId, `استخراج نص... صفحة ${pageNum}/${pdf.numPages}`, true);
        const content = await page.getTextContent();
        const strings = content.items.map(it => it.str);
        fullText += strings.join(' ').trim() + `\n\n--- صفحة ${pageNum} ---\n\n`;
      }
    }

    setStatus(statusBoxId, '', false);
    return fullText.trim();
  }

  async function ocrImageFile(file, statusBoxId){
    const ocrLangs = getOcrLangSelection();
    setStatus(statusBoxId, 'OCR للصورة...', true);
    const imgUrl = URL.createObjectURL(file);
    try{
      const result = await Tesseract.recognize(imgUrl, ocrLangs, {
        logger: (m) => {
          if (m?.status){
            const pct = m.progress ? Math.round(m.progress*100) : null;
            setStatus(statusBoxId, `OCR: ${m.status}${pct!==null?` (${pct}%)`:''}`, true);
          }
        }
      });
      return (result?.data?.text || '').trim();
    } finally {
      URL.revokeObjectURL(imgUrl);
      setStatus(statusBoxId, '', false);
    }
  }

  // -------------------- AI --------------------
  function chunkText(text, maxLen=7000){
    const chunks=[];
    for (let i=0;i<text.length;i+=maxLen) chunks.push(text.slice(i,i+maxLen));
    return chunks;
  }

  async function sha256Hex(arrayBuffer){
    const h = await crypto.subtle.digest('SHA-256', arrayBuffer);
    return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2,'0')).join('');
  }

  function fileExt(name=''){
    const m = (name || '').toLowerCase().match(/\.([a-z0-9]+)$/);
    return m ? m[1] : '';
  }

  async function fileToDataUrl(file){
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ''));
      r.onerror = () => reject(r.error || new Error('FileReader error'));
      r.readAsDataURL(file);
    });
  }

  async function uploadFileToAPI(file, statusBoxId='statusBox'){
    const { apiKey, baseUrl } = getSettingsOrThrow();
    // try cache by SHA-256
    const buf = await file.arrayBuffer();
    const hash = await sha256Hex(buf);
    try{
      const cached = await dbGet(FILE_CACHE, hash);
      if (cached?.fileId && cached?.baseUrl === baseUrl) return cached.fileId;
    }catch{}

    setStatus(statusBoxId, `رفع الملف للـ API: ${file.name}`, true);
    const fd = new FormData();
    fd.append('purpose', 'user_data');
    fd.append('file', new Blob([buf], { type: file.type || 'application/octet-stream' }), file.name || 'upload.bin');

    const res = await fetch(`${baseUrl}/files`, {
      method:'POST',
      headers:{ 'Authorization':`Bearer ${apiKey}` },
      body: fd
    });
    if (!res.ok){
      const txt = await res.text().catch(()=> '');
      throw new Error(`File upload failed: ${res.status} ${res.statusText}${txt ? ('\n' + txt) : ''}`);
    }
    const data = await res.json();
      const gm = data?.candidates?.[0]?.groundingMetadata;
      if (gm){ sourcesMd = sourcesMd || geminiSourcesMarkdown(gm); }
    const fileId = data?.id;
    if (fileId){
      try{
        await dbPut(FILE_CACHE, { hash, fileId, baseUrl, name: file.name, mime: file.type, size: file.size, updatedAt: nowTs() });
      }catch{}
    }
    setStatus(statusBoxId, '', false);
    return fileId;
  }


  
async function callChatCompletions({ apiKey, baseUrl, model, messages, max_tokens=1400, temperature=0.25, plugins=null, signal=null }){
  const payload = Object.assign({ model, messages, max_tokens, temperature }, plugins ? { plugins } : {});
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method:'POST',
    headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${apiKey}` },
    body: JSON.stringify(payload),
    signal: signal || undefined
  });
  if (!res.ok){
    const txt = await res.text().catch(()=> '');
    throw new Error(`API Error: ${res.status} ${res.statusText}${txt ? ('\n' + txt) : ''}`);
  }
  const data = await res.json();
  const msg = (data?.choices?.[0]?.message?.content || '').trim();
  const ann = data?.choices?.[0]?.message?.annotations || [];
  return (msg + openrouterSourcesFromAnnotations(ann)).trim();
}

async function callChatCompletionsStream({ apiKey, baseUrl, model, messages, max_tokens=1400, temperature=0.25, plugins=null, signal, onDelta }){
  const payload = Object.assign({ model, messages, max_tokens, temperature, stream: true }, plugins ? { plugins } : {});
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method:'POST',
    headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${apiKey}` },
    body: JSON.stringify(payload),
    signal
  });
  if (!res.ok){
    const txt = await res.text().catch(()=> '');
    throw new Error(`API Error: ${res.status} ${res.statusText}${txt?`\n${txt}`:''}`);
  }
  let combined = '';
  let annotations = [];
  await readSSEStream(res, ({data}) => {
    try{
      const j = JSON.parse(data);
      const ch = j?.choices?.[0] || {};
      const d = ch?.delta || {};
      if (Array.isArray(d.annotations)) annotations = annotations.concat(d.annotations);
      const t = d?.content;
      if (typeof t === 'string' && t){
        combined += t;
        onDelta && onDelta(t, combined);
      }
      const msgAnn = j?.choices?.[0]?.message?.annotations;
      if (Array.isArray(msgAnn)) annotations = annotations.concat(msgAnn);
    }catch(_){}
  }, signal);

  const out = (combined || '').trim();
  const src = openrouterSourcesFromAnnotations(annotations);
  return (out + src).trim();
}  async function callResponses({ apiKey, baseUrl, model, input, max_output_tokens=1600, temperature=0.25, reasoningEffort='medium', reasoningSummary='off' }){
    const body = { model, input, max_output_tokens, temperature };
    if (reasoningEffort){
      body.reasoning = { effort: reasoningEffort };
      if (reasoningSummary && reasoningSummary !== 'off') body.reasoning.summary = reasoningSummary;
    }
    const res = await fetch(`${baseUrl}/responses`, {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${apiKey}` },
      body: JSON.stringify(body)
    });
    if (!res.ok){
      const txt = await res.text().catch(()=> '');
      throw new Error(`API Error: ${res.status} ${res.statusText}${txt ? ('\n' + txt) : ''}`);
    }
    const data = await res.json();
      const gm = data?.candidates?.[0]?.groundingMetadata;
      if (gm){ sourcesMd = sourcesMd || geminiSourcesMarkdown(gm); }
    // Prefer convenience field if present
    const out = (data?.output_text || '').trim();
    if (out) return out;
    // Fallback: search output items
    try{
      const items = data?.output || [];
      for (const it of items){
        if (it?.type === 'message'){
          const parts = it?.content || [];
          const textParts = parts.filter(p=>p?.type?.includes('text') && typeof p.text === 'string').map(p=>p.text);
          if (textParts.length) return textParts.join('\n').trim();
        }
      }
    }catch{}
    return '';
  }



  async function callGeminiGenerateContent({ geminiKey, geminiModel, systemInstructionText, contents, temperature=0.25, maxOutputTokens=4096, autoContinue=true, maxParts=6 , signal, enableWebSearch}){
    // Auto-continue: if the model stops بسبب MAX_TOKENS سنطلب "تابع" حتى يكتمل (بعدد أجزاء محدود).
    let combined = '';
    let sourcesMd = '';
    let curContents = Array.isArray(contents) ? contents.slice() : [];
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent`;

    for (let partNo = 0; partNo < Math.max(1, maxParts); partNo++){
      const body = {
        contents: curContents,
        generationConfig: { temperature, maxOutputTokens }
      };
      if (enableWebSearch){ body.tools = [{ google_search: {} }]; }
      if (systemInstructionText && systemInstructionText.trim()){
        body.system_instruction = { parts: [{ text: systemInstructionText.trim() }] };
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'x-goog-api-key': geminiKey },
        body: JSON.stringify(body),
        signal
      });

      if (!res.ok){
        const txt = await res.text().catch(()=> '');
        throw new Error(`Gemini API Error: ${res.status} ${res.statusText}${txt ? ('\n' + txt) : ''}`);
      }

      const data = await res.json();
      const gm = data?.candidates?.[0]?.groundingMetadata;
      if (gm){ sourcesMd = sourcesMd || geminiSourcesMarkdown(gm); }
      const cand = data?.candidates?.[0] || {};
      const finish = cand.finishReason;
      const parts = cand?.content?.parts || [];
      const text = parts.map(p => p?.text).filter(Boolean).join('\n').trim();

      if (text){
        combined += (combined ? '\n' : '') + text;
      }

      const isMax = (finish === 'MAX_TOKENS' || finish === 2);
      if (!autoContinue || !isMax) break;

      // Prepare continuation: add model output then ask to continue without repeating
      const contPrompt =
        "تابع من حيث توقفت بدون إعادة ما سبق، وأكمل بنفس الأسلوب. إذا كان هناك تعداد/كود/أقسام فأكملها مباشرة.";

      curContents = curContents.concat([
        { role:'model', parts: [{ text: text || '' }] },
        { role:'user',  parts: [{ text: contPrompt }] }
      ]);
    }

    return ((combined || '').trim() + (sourcesMd || '')).trim();
  }

  function dataUrlToInlineData(dataUrl){
    // data:[mime];base64,[data]
    const m = String(dataUrl||'').match(/^data:([^;]+);base64,(.*)$/);
    if (!m) return null;
    return { mime_type: m[1], data: m[2] };
  }

  function toGeminiRole(role){
    if (role === 'assistant') return 'model';
    if (role === 'user') return 'user';
    return null;
  }

  async function buildGeminiSystemInstruction(){
    const language = $('language')?.value || 'ar';
    const useDoc = ($('chatUseDoc')?.value || 'on') === 'on';
    const useKB = ($('chatUseKB')?.value || 'on') === 'on';
    const sysCustom = ($('chatSystemPrompt')?.value || '').trim();

    let system = sysCustom
      ? sysCustom
      : (language === 'ar'
          ? 'أنت مساعد احترافي. أجب بدقة وبأسلوب منظم.'
          : 'You are a professional assistant. Answer accurately and clearly.'
        );

    if (useKB){
      // Quick/experimental: KB retrieval requires embeddings; we skip it in Gemini browser mode.
      system += (language === 'ar')
        ? '\n\n[ملاحظة] وضع Gemini التجريبي: تم تعطيل الاسترجاع من قاعدة المعرفة (KB) في هذه النسخة.'
        : '\n\n[Note] Gemini experimental mode: Knowledge Base retrieval is disabled in this build.';
    }

    if (useDoc){
      const docText = ($('textInput')?.value || '').trim();
      if (docText){
        const maxContext = 9000;
        let ctx = docText.length > maxContext ? (docText.slice(0,4500) + '\n\n...\n\n' + docText.slice(-4500)) : docText;
        system += `\n\nنص التفريغ الحالي (مرجع إضافي):\n${ctx}`;
      }
    }
    return system;
  }


  async function summarizeText(text, statusBoxId){
    const { apiKey, baseUrl, model, language } = getSettingsOrThrow();
    const chunks = chunkText(text, 7000);
    let out = '';
    for (let i=0;i<chunks.length;i++){
      setStatus(statusBoxId, `تلخيص... جزء ${i+1}/${chunks.length}`, true);
      const messages=[
        { role:'system', content:'لخّص النص بدقة وبشكل منظم: ملخص تنفيذي، نقاط رئيسية، أفكار وتطبيقات عملية، مصطلحات مهمة. بدون حشو.' },
        { role:'user', content:`النص:\n${chunks[i]}\n\nاكتب باللغة: ${language==='ar'?'العربية':'English'}.` }
      ];
      const part = await callChatCompletions({ apiKey, baseUrl, model, messages, max_tokens: 2200, temperature: 0.25 });
      out += part + '\n\n';
    }
    setStatus(statusBoxId, '', false);
    return out.trim();
  }

  async function aiFixOcrText(text, statusBoxId){
    const { apiKey, baseUrl, model } = getSettingsOrThrow();
    const mode = ($('aiFixMode')?.value || 'safe');
    const chunks = chunkText(text, 6500);
    let out = '';
    for (let i=0;i<chunks.length;i++){
      setStatus(statusBoxId, `تصحيح OCR... جزء ${i+1}/${chunks.length}`, true);
      const sys = mode === 'strong'
        ? `أنت مدقق لغوي وتصحيح OCR محترف. أصلح أخطاء OCR العربية والإنجليزية (الحروف/الأرقام/الهمزات/التشكيل/المسافات/الترقيم) مع الحفاظ على المعنى. لا تكتب أي شرح. أعد النص فقط. حافظ قدر الإمكان على فواصل الأسطر والعناوين. لا تترجم.`
        : `أنت مدقق OCR. أصلح أخطاء OCR العربية والإنجليزية بدون إعادة صياغة كبيرة. لا تكتب أي شرح. أعد النص فقط. حافظ على نفس عدد الأسطر تقريبًا، ولا تدمج فقرات كثيرة. لا تترجم.`;
      const messages=[
        { role:'system', content: sys },
        { role:'user', content: chunks[i] }
      ];
      const part = await callChatCompletions({ apiKey, baseUrl, model, messages, max_tokens: 2200, temperature: 0.10 });
      out += part + '\n\n';
    }
    setStatus(statusBoxId, '', false);
    return out.trim();
  }

  // -------------------- Embeddings + RAG --------------------
  function cosineSim(a,b){
    let dot=0, na=0, nb=0;
    for (let i=0;i<a.length;i++){
      dot += a[i]*b[i];
      na += a[i]*a[i];
      nb += b[i]*b[i];
    }
    na = Math.sqrt(na); nb = Math.sqrt(nb);
    return (na && nb) ? dot/(na*nb) : 0;
  }

  async function createEmbedding(input){
    const { apiKey, baseUrl, embedModel } = getSettingsOrThrow();
    const res = await fetch(`${baseUrl}/embeddings`, {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${apiKey}` },
      body: JSON.stringify({ model: embedModel, input })
    });
    if (!res.ok){
      const txt = await res.text().catch(()=> '');
      throw new Error(`Embeddings API Error: ${res.status} ${res.statusText}${txt ? ('\n' + txt) : ''}`);
    }
    const data = await res.json();
      const gm = data?.candidates?.[0]?.groundingMetadata;
      if (gm){ sourcesMd = sourcesMd || geminiSourcesMarkdown(gm); }
    const v = data?.data?.[0]?.embedding;
    if (!Array.isArray(v)) throw new Error('Embedding غير صالح');
    return v;
  }

  function chunkForKB(text, maxChars=1400){
    const paras = (text || '').split(/\n{2,}/);
    const chunks=[];
    let buf='';
    for (const p of paras){
      const s = p.trim();
      if (!s) continue;
      if ((buf + '\n\n' + s).length > maxChars){
        if (buf) chunks.push(buf);
        buf = s;
      } else {
        buf = buf ? (buf + '\n\n' + s) : s;
      }
    }
    if (buf) chunks.push(buf);

    const fixed=[];
    for (const c of chunks){
      if (c.length <= maxChars*1.3){ fixed.push(c); continue; }
      for (let i=0;i<c.length;i+=maxChars) fixed.push(c.slice(i,i+maxChars));
    }
    return fixed;
  }

  async function kbAddDocument({ name, type, text }){
    const doc = {
      id: makeId('doc'),
      name,
      type,
      text,
      createdAt: nowTs(),
      updatedAt: nowTs(),
      indexed: false
    };
    await dbPut(KB_DOCS, doc);
    return doc;
  }

  async function kbListDocs(){
    const docs = await dbGetAll(KB_DOCS);
    docs.sort((a,b)=> (b.updatedAt||0)-(a.updatedAt||0));
    return docs;
  }

  async function kbDeleteDoc(docId){
    const chunks = await dbGetAll(KB_CHUNKS);
    const toDel = chunks.filter(c => c.docId === docId);
    for (const c of toDel) await dbDelete(KB_CHUNKS, c.id);
    await dbDelete(KB_DOCS, docId);
  }

  async function kbClearAll(){
    await dbClearAll(KB_CHUNKS);
    await dbClearAll(KB_DOCS);
  }

  async function kbIndexAll(statusBoxId){
    const docs = await kbListDocs();
    if (!docs.length){
      setStatus(statusBoxId, 'لا توجد ملفات للفهرسة.', true);
      return;
    }

    await dbClearAll(KB_CHUNKS);

    let docCount=0, chunkCount=0;
    for (const doc of docs){
      docCount++;
      setStatus(statusBoxId, `فهرسة: ${doc.name} (${docCount}/${docs.length})`, true);

      const pieces = chunkForKB(doc.text, 1400);
      for (let i=0;i<pieces.length;i++){
        setStatus(statusBoxId, `Embeddings: ${doc.name} — جزء ${i+1}/${pieces.length}`, true);
        const vec = await createEmbedding(pieces[i]);

        const chunkRec = {
          id: makeId('chunk'),
          docId: doc.id,
          docName: doc.name,
          index: i,
          text: pieces[i],
          vec,
          createdAt: nowTs(),
          updatedAt: nowTs(),
        };
        await dbPut(KB_CHUNKS, chunkRec);
        chunkCount++;
      }

      doc.indexed = true;
      doc.updatedAt = nowTs();
      await dbPut(KB_DOCS, doc);
    }

    setStatus(statusBoxId, `اكتملت الفهرسة: ${docCount} ملف / ${chunkCount} جزء.`, true);
    await refreshKBUI();
  }

  async function kbRetrieve(query, topK=6){
    const qVec = await createEmbedding(query);
    const chunks = await dbGetAll(KB_CHUNKS);
    if (!chunks.length) return [];
    const scored = chunks.map(c => ({ c, s: cosineSim(qVec, c.vec) }));
    scored.sort((a,b)=> b.s - a.s);
    return scored.slice(0, topK).filter(x => x.s > 0.15).map(x => x.c);
  }

  // -------------------- Chat Thread --------------------
  let currentChatId = null;
let currentChatAbort = null;
  let chatMessages = [];
      try{ resetSessionUsage(); }catch(_){ }
  let chatAttachments = [];
  let lastSourceFile = null; // { kind:'docx'|'pdf'|'img'|'other', name, file }

  function newChatThread(){
    currentChatId = makeId('chat');
    chatMessages = [];
      try{ resetSessionUsage(); }catch(_){ }
    chatAttachments = [];
    renderChat();
    renderChatAttachments();
    persistChatDraft();
  }

  function renderChat(){
    const log = $('chatLog');
    if (!log) return;
    log.innerHTML = '';
    chatMessages.forEach(m => {
      const div = document.createElement('div');
      div.className = `bubble ${m.role === 'user' ? 'user' : 'assistant'}`;

      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.textContent = `${m.role === 'user' ? 'أنت' : 'المساعد'} • ${fmtTime(m.ts)}`;

      const body = document.createElement('div');
      if (m.role === 'user'){
        body.textContent = m.content;
      } else {
        body.className = 'md';
        body.innerHTML = renderMarkdown(m.content);
        if (typeof linkifyPlainText === 'function') linkifyPlainText(body);
      }

      div.appendChild(meta);
      div.appendChild(body);
      if (m.role !== 'user') { enhanceCodeBlocks(body); if (typeof enhanceLinks === 'function') enhanceLinks(body); }
      if (m.role !== 'user') { enhanceCodeBlocks(body); if (typeof enhanceLinks === 'function') enhanceLinks(body); }

      // Download buttons for AI messages
      if (m.role !== 'user'){
        const actions = document.createElement('div');
        actions.className = 'actions';

        const ts = (m.ts || Date.now());
        const stamp = new Date(ts).toISOString().replace(/[:.]/g,'-').slice(0,19);
        const baseName = `chat_${stamp}`;

        const bTxt = document.createElement('button');
        bTxt.type = 'button';
        bTxt.className = 'btn ghost sm';
        bTxt.textContent = 'تنزيل TXT';
        bTxt.onclick = () => {
          const blob = new Blob([m.content || ''], { type:'text/plain;charset=utf-8' });
          downloadBlob(`${baseName}.txt`, blob);
        };

        const bHtml = document.createElement('button');
        bHtml.type = 'button';
        bHtml.className = 'btn ghost sm';
        bHtml.textContent = 'تنزيل HTML';
        bHtml.onclick = () => {
          const safe = escapeHtml(m.content || '');
          const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${baseName}</title></head><body style="font-family:Arial;line-height:1.8;direction:rtl;padding:18px"><pre style="white-space:pre-wrap;margin:0">${safe}</pre></body></html>`;
          const blob = new Blob([html], { type:'text/html;charset=utf-8' });
          downloadBlob(`${baseName}.html`, blob);
        };

        const bDocx = document.createElement('button');
        bDocx.type = 'button';
        bDocx.className = 'btn primary sm';
        bDocx.textContent = 'تنزيل DOCX';
        bDocx.onclick = async () => {
          try{
            await exportDocx(`${baseName}.docx`, 'Chat Output', m.content || '');
          }catch(err){
            alert('فشل إنشاء DOCX: ' + (err?.message || err));
          }
        };

        actions.appendChild(bTxt);
        actions.appendChild(bHtml);
        actions.appendChild(bDocx);
        div.appendChild(actions);
      }

      
// AI-generated files (parsed from ```file``` blocks)
if (m.role !== 'user' && Array.isArray(m.aiFiles) && m.aiFiles.length){
  const box = document.createElement('div');
  box.className = 'filechips';
  m.aiFiles.forEach(f => {
    const chip = document.createElement('div');
    chip.className = 'filechip';
    const left = document.createElement('div');
    left.innerHTML = `<div>${escapeHtml(f.name || 'file')}</div><div class="meta">${humanSize(f.size || 0)}</div>`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn ghost sm';
    btn.textContent = 'تنزيل';
    btn.onclick = () => downloadFromDownloadsStore(f.id);
    chip.appendChild(left);
    chip.appendChild(btn);
    box.appendChild(chip);
  });
  div.appendChild(box);
}

log.appendChild(div);
    });
    log.scrollTop = log.scrollHeight;
  }

  

function renderChatImageTools(){
  const box=$('chatImageTools');
  if(!box) return;
  const imgs = chatAttachments.filter(a=>a.isImage);
  if(!imgs.length){ box.style.display='none'; box.innerHTML=''; return; }
  box.style.display='flex';
  box.innerHTML='';

  function addBtn(text, addPrompt){
    const b=document.createElement('button');
    b.type='button'; b.className='pill';
    b.textContent=text;
    b.addEventListener('click', ()=>{
      const input=$('chatInput');
      if(input){
        input.value = (input.value?input.value+'\n\n':'') + addPrompt;
        input.focus();
      }
    });
    box.appendChild(b);
  }

  addBtn('وصف الصور','صف الصور المرفقة بدقة ثم قدّم ملخصًا.');
  addBtn('OCR بالذكاء','استخرج النص الموجود داخل الصور المرفقة بدقة وأعده كنص منظم.');
  addBtn('تحليل/ملاحظات','حلّل الصور المرفقة واستخرج أهم النقاط والأخطاء المحتملة والتوصيات.');
}

function renderChatAttachments(){
    const box = $('chatAttachments');
    if (!box) return;
    box.innerHTML = '';
    if (!chatAttachments.length) return;
    chatAttachments.forEach(att => {
      const chip = document.createElement('div');
      chip.className = 'chip';
      const label = document.createElement('span');
      label.className = 'meta';
      const icon = att.isImage ? '🖼️' : (att.kind === 'pdf' ? '📄' : '📎');
      const suffix = att.kbDocId ? '• محفوظ' : '';
      label.textContent = `${icon} ${att.name || 'ملف'} ${suffix}`.trim();
      const x = document.createElement('button');
      x.className = 'x';
      x.textContent = '×';
      x.addEventListener('click', () => {
        chatAttachments = chatAttachments.filter(a => a.id !== att.id);
        renderChatAttachments();
        persistChatDraft();
      });
      chip.appendChild(label);
      chip.appendChild(x);
      box.appendChild(chip);
    });
  }

  async function addChatAttachments(fileList, statusBoxId='statusBox3'){
    const files = Array.from(fileList || []);
    if (!files.length) return;
    for (const file of files){
      const att = {
        id: makeId('att'),
        name: file.name || 'file',
        kind: (file.type || '').includes('pdf') ? 'pdf' : (fileExt(file.name) || 'other'),
        isImage: (file.type || '').startsWith('image/'),
        file,
        fileId: null,
        dataUrl: null,
        kbDocId: null,
        text: ''
      };

      try{
        // Save a dataUrl for images to enable "ask about the image itself" (Vision models)
        if (att.isImage){
          try{ att.dataUrl = await fileToDataUrl(file); }catch{}
        }

        // Always extract text (for persistence + KB)
        const t = await parseFileToText(file, statusBoxId);
        att.text = t || '';

        if (att.text.trim()){
          const doc = { id: makeId('doc'), name: `(Chat) ${att.name}`, text: att.text, indexed:false, createdAt: nowTs(), updatedAt: nowTs() };
          await dbPut(KB_DOCS, doc);
          att.kbDocId = doc.id;
        }
      }catch(e){
        console.warn('attach parse failed', e);
      }

      chatAttachments.push(att);
    }

    try{ await refreshKBUI(); }catch{}
    renderChatAttachments();
    persistChatDraft();
    setStatus(statusBoxId, '', false);
  }




  function getChatSettingsOrThrow(){
    const chatProvider = ($('chatProvider')?.value || 'openai').trim();
    const language = $('language')?.value || 'ar';
    const chatDirectFiles = ($('chatDirectFiles')?.value || 'auto').trim();
    const visionMode = ($('visionMode')?.value || 'auto').trim();
    const chatSystemPrompt = ($('chatSystemPrompt')?.value || '').trim();

    const chatMaxOutTokens = parseInt($('chatMaxOutTokens')?.value || '4096', 10) || 4096;
    const chatMaxParts = parseInt($('chatMaxParts')?.value || '6', 10) || 6;
    const chatHistoryTurns = parseInt($('chatHistoryTurns')?.value || '14', 10) || 14;
    const chatStreaming = !!$('chatStreaming')?.checked;

    if (chatProvider === 'gemini'){
      const geminiKey = sanitizeApiKey($('geminiKey')?.value || '');
      const geminiModel = ($('geminiModel')?.value || 'gemini-2.5-flash').trim();
      if (!geminiKey) throw new Error('يرجى إدخال Gemini API key');
      if (!isAsciiOnly(geminiKey)) throw new Error('Gemini key يجب أن يكون إنجليزي فقط (بدون أحرف عربية/رموز مخفية).');
      if (!geminiModel) throw new Error('Gemini Model فارغ');
      return {
        chatProvider,
        geminiKey,
        geminiModel,
        geminiWebSearch: !!$('geminiWebSearch')?.checked,
        language,
        chatDirectFiles,
        visionMode,
        chatSystemPrompt,
        chatMaxOutTokens,
        chatMaxParts,
        chatHistoryTurns,
        chatStreaming
      };
    }

    const s = getSettingsOrThrow(); // OpenAI full settings
    s.chatProvider = 'openai';
    s.language = language;
    s.chatDirectFiles = chatDirectFiles;
    s.visionMode = visionMode;
    s.chatSystemPrompt = chatSystemPrompt;
    s.chatMaxOutTokens = chatMaxOutTokens;
    s.chatMaxParts = chatMaxParts;
    s.chatHistoryTurns = chatHistoryTurns;
    s.chatStreaming = chatStreaming;
    s.openrouterWebSearch = !!$('openrouterWebSearch')?.checked;
    s.chatSmartMemory = !!$('chatSmartMemory')?.checked;
        s.deepMode = isDeepMode();
    s.agentMode = isAgentMode();
    if (s.deepMode){ s.chatMaxOutTokens = Math.max(Number(s.chatMaxOutTokens||0), 2500); }
return s;
  }



function isOpenRouterUrl(u){
  return /openrouter\.ai/i.test(String(u||''));
}

function updateSettingsVisibility(){
  const provider = ($('chatProvider')?.value || 'openai').trim();
  const baseUrl = ($('baseUrl')?.value || '').trim();
  const gemRow = $('geminiWebSearchRow');
  const orRow = $('openrouterWebSearchRow');
  if (gemRow) gemRow.style.display = (provider === 'gemini') ? 'block' : 'none';
  if (orRow) orRow.style.display = (provider !== 'gemini' && isOpenRouterUrl(baseUrl)) ? 'block' : 'none';
}


  async function buildChatMessagesForAPI(userQuestion){
    const settings = getChatSettingsOrThrow();
  try{ await ensureSmartMemoryForProject(userQuestion); }catch(_){ }
    const { language } = settings;
    const useDoc = ($('chatUseDoc')?.value || 'on') === 'on';
    const useKB = ($('chatUseKB')?.value || 'on') === 'on';
    const sysCustom = ($('chatSystemPrompt')?.value || '').trim();

    let system = sysCustom
      ? sysCustom
      : (language === 'ar'
          ? 'أنت مساعد احترافي. أجب بدقة وبأسلوب منظم. عند الاستناد إلى ملفات قاعدة المعرفة، اذكر اسم الملف. إن لم تجد معلومة قل: غير مذكور في المصادر.'
          : 'You are a professional assistant. Answer accurately and clearly. If using the knowledge base, cite the document name. If not found, say it is not in the sources.'
        );


// Modes
if (isDeepMode()){
  system += "\n\n[وضع التفكير العميق] أجب بإجابة شاملة ومنظمة. اعرض: الفكرة العامة، التفاصيل، أمثلة/خطوات، ثم خلاصة واضحة.";
}
if (isAgentMode()){
  system += "\n\n[وضع الوكيل] قبل الإجابة: اكتب خطة قصيرة (3-6 خطوات). ثم نفّذ الخطة. إذا احتجت بحث ويب: اذكر المصادر كرابط أو اسم مصدر.";
}

    const messages = [{ role:'system', content: system }];

    if (useKB){
      try{
        const top = await kbRetrieve(userQuestion, 6);
        if (top.length){
          const ctx = top.map((c,i)=>`[${i+1}] (${c.docName})\n${c.text}`).join('\n\n---\n\n');
          messages.push({ role:'system', content: `مصادر قاعدة المعرفة (مقاطع ذات صلة):\n\n${ctx}` });
        }
      }catch(e){
        console.warn('KB retrieval failed', e);
      }
    }

    if (useDoc){
      const docText = ($('textInput')?.value || '').trim();
      if (docText){
        const maxContext = 9000;
        let ctx = docText;
        if (ctx.length > maxContext){
          ctx = ctx.slice(0, 4500) + '\n\n...\n\n' + ctx.slice(-4500);
        }
        messages.push({ role:'system', content: `نص التفريغ الحالي (مرجع إضافي):\n${ctx}` });
      }
    }


    // Smart memory summary (per project)
    try{
      const settings2 = getChatSettingsOrThrow();
      if (settings2.chatSmartMemory){
        const pid = getCurrentProjectId ? getCurrentProjectId() : DEFAULT_PROJECT_ID;
        const mem = loadProjectMemory(pid);
        if (mem){
          messages.push({ role:'system', content: `ملخص الذاكرة الذكية (سياق سابق):\n${mem}` });
        }
      }
    }catch(_){ }

    let tail = chatMessages.slice(-(settings.chatHistoryTurns || 14)).map(m => ({ role: m.role, content: m.content }));
    // avoid duplicating the current user question if it was already pushed to chatMessages
    const uq = String(userQuestion || '').trim();
    if (tail.length && tail[tail.length-1].role === 'user' && String(tail[tail.length-1].content || '').trim() === uq){
      tail = tail.slice(0, -1);
    }
    messages.push(...tail);

    // رسالة المستخدم النهائية تُبنى في sendChat (لتضمين المرفقات/الملفات)
    return messages;
  }

  
async function ensureSmartMemoryForProject(userQuestion){
  const settings = getChatSettingsOrThrow();
  if (!settings.chatSmartMemory) return;
  const pid = getCurrentProjectId ? getCurrentProjectId() : DEFAULT_PROJECT_ID;
  const maxTurns = Number(settings.chatHistoryTurns || 14);
  const buffer = 24;
  if (chatMessages.length <= maxTurns + buffer) return;

  // Summarize older part (exclude last maxTurns messages)
  const older = chatMessages.slice(0, Math.max(0, chatMessages.length - maxTurns));
  if (older.length < 10) return;

  // Build summarization prompt (Arabic-focused)
  const prev = loadProjectMemory(pid);
  const transcript = older.map(m => `${m.role === 'user' ? 'USER' : 'ASSISTANT'}: ${String(m.content||'')}`).join('\n');
  const prompt = [
    { role:'system', content: 'أنت تلخص محادثات. أعد ملخصًا موجزًا ودقيقًا للاستخدام كسياق مستقبلي. ركّز على: الأهداف، القرارات، المتطلبات، القيود، الأسماء، الروابط المهمة، وما تم إنجازه وما تبقى.' },
    { role:'user', content: `هذا ملخص سابق (إن وجد):\n${prev || '(لا يوجد)'}\n\nوهذه رسائل أقدم من المحادثة:\n${transcript}\n\nاكتب ملخصًا مُحدّثًا (منظم بنقاط قصيرة).` }
  ];

  try{
    // Use same provider but low output
    const baseUrl = settings.baseUrl || 'https://api.openai.com/v1';
    const isOR = (typeof isOpenRouterUrl === 'function') ? isOpenRouterUrl(baseUrl) : false;
    let model = settings.model;
    const maxOut = 700;

    let summary = '';
    if (isOR || settings.apiMode !== 'responses'){
      summary = await callChatCompletions({
        apiKey: settings.apiKey,
        baseUrl,
        model,
        messages: prompt,
        max_tokens: maxOut,
        temperature: 0.2,
        plugins: null
      });
    } else {
      // OpenAI responses: use responses call as a fallback
      const input = [{ role:'user', content:[{ type:'input_text', text: prompt.map(x=>x.content).join('\n\n') }]}];
      summary = await callResponses({
        apiKey: settings.apiKey,
        baseUrl,
        model,
        instructions: 'لخص المحادثة كسياق',
        input,
        temperature: 0.2,
        max_output_tokens: maxOut
      });
    }
    if (summary){
      saveProjectMemory(pid, summary.trim());
    }
  }catch(e){
    console.warn('Smart memory summarization failed', e);
  }
}

async function sendChat(userQuestion, statusBoxId){
    const settings = getChatSettingsOrThrow();
    setStatus(statusBoxId, 'جاري إرسال السؤال...', true);
    try{ await ensureSmartMemoryForProject(userQuestion); }catch(_){ }

    // Abort previous request if any
    try{ if (currentChatAbort) currentChatAbort.abort(); }catch(_){ }
    currentChatAbort = new AbortController();
    const signal = currentChatAbort.signal;

    // Gemini experimental (browser) - text/vision only, KB retrieval disabled
    if (settings.chatProvider === 'gemini'){
      const visionEnabled = settings.visionMode !== 'ocr';
      const systemInstructionText = await buildGeminiSystemInstruction();
      const history = chatMessages.slice(-settings.chatHistoryTurns).map(m => {
        const role = toGeminiRole(m.role);
        if (!role) return null;
        return { role, parts: [{ text: String(m.content||'') }] };
      }).filter(Boolean);
      const parts = [];
      // Attachments (images supported, other files as extracted text only)
      if (settings.chatDirectFiles !== 'off' && chatAttachments.length > 0){
        for (const att of chatAttachments){
          if (att.isImage){
            if (!visionEnabled) continue;
            if (!att.dataUrl && att.file){ try{ att.dataUrl = await fileToDataUrl(att.file); }catch{} }
            const inline = dataUrlToInlineData(att.dataUrl);
            if (inline) parts.push({ inline_data: inline });
            continue;
          }
          if (att.text && att.text.trim()){
            const clip = att.text.length > 6000 ? (att.text.slice(0,3000) + '\n\n...\n\n' + att.text.slice(-3000)) : att.text;
            parts.push({ text: `[ملف: ${att.name}]\n${clip}` });
          }
        }
      }
      parts.push({ text: userQuestion });
      const contents = history.concat([{ role:'user', parts }]);
      try{
        const answer = await callGeminiGenerateContent({
          enableWebSearch: !!settings.geminiWebSearch,
          signal,
          geminiKey: settings.geminiKey,
          geminiModel: settings.geminiModel,
          systemInstructionText,
          contents,
          temperature: 0.25,
          maxOutputTokens: settings.chatMaxOutTokens,
          autoContinue: true,
          maxParts: settings.chatMaxParts
        });
        setStatus(statusBoxId, '', false);
        return answer || '';
    try{ currentChatAbort = null; }catch(_){ }
      } finally {
        setStatus(statusBoxId, '', false);
        try{ currentChatAbort = null; }catch(_){ }
      }
    }

    const baseMessages = await buildChatMessagesForAPI(userQuestion);
    const useAttachments = settings.chatDirectFiles !== 'off' && chatAttachments.length > 0;
    const visionEnabled = settings.visionMode !== 'ocr';
    const apiKey = settings.apiKey;
    const maxOut = settings.chatMaxOutTokens;
    const baseUrl = settings.baseUrl;
    let model = settings.model;
    const isOR = isOpenRouterUrl(baseUrl);
    if (isOR && settings.openrouterWebSearch){
      if (!String(model).includes(':online')) model = String(model) + ':online';
    }

    // Build the final user message parts (text + files/images)
    async function buildUserPartsForChat(){
  const parts = [];
  if (useAttachments){
    for (const att of chatAttachments){
      // Images: send as image_url (data URL) when vision enabled
      if (att.isImage){
        if (!visionEnabled) continue;
        if (!att.dataUrl && att.file){
          try{ att.dataUrl = await fileToDataUrl(att.file); }catch{}
        }
        if (att.dataUrl){
          parts.push({ type:'image_url', image_url:{ url: att.dataUrl } });
        }
        continue;
      }

      // Documents/other files: ALWAYS send extracted text (Chat Completions doesn't support raw file payloads)
      if ((!att.text || !att.text.trim()) && att.file){
        try{ att.text = await parseFileToText(att.file, statusBoxId); }catch{}
      }
      if (att.text && att.text.trim()){
        const clip = att.text.length > 12000
          ? (att.text.slice(0,6000) + '\n\n...\n\n' + att.text.slice(-6000))
          : att.text;
        parts.push({ type:'text', text: `[ملف: ${att.name}]\n${clip}` });
      } else {
        // fallback: include file name only
        parts.push({ type:'text', text: `[ملف مرفق: ${att.name}] (تعذر استخراج النص)` });
      }
    }
  }
  parts.push({ type:'text', text: userQuestion });
  return parts;
}

    async function buildUserPartsForResponses(){
      const parts = [];
      if (useAttachments){
        for (const att of chatAttachments){
          if (att.isImage){
            if (!visionEnabled) continue;
            if (!att.dataUrl && att.file){
              try{ att.dataUrl = await fileToDataUrl(att.file); }catch{}
            }
            if (att.dataUrl){
              parts.push({ type:'input_image', image_url: att.dataUrl });
            }
            continue;
          }

          // Other files: send as Base64 `input_file` (preferred) — fallback to extracted text if too big
          const MAX_DIRECT_FILE_BYTES = 12 * 1024 * 1024; // 12MB
          let fileData = null;
          if (att.file && att.file.size <= MAX_DIRECT_FILE_BYTES){
            try{ fileData = await fileToDataUrl(att.file); }catch(e){ fileData = null; }
          }
          if (fileData){
            parts.push({ type:'input_file', filename: att.name, file_data: fileData });
          } else if (att.text && att.text.trim()){
            const clip = att.text.length > 6000 ? (att.text.slice(0,3000) + '\n\n...\n\n' + att.text.slice(-3000)) : att.text;
            parts.push({ type:'input_text', text: `[ملف: ${att.name}]\n${clip}` });
          }
        }
      }
      parts.push({ type:'input_text', text: userQuestion });
      return parts;
    }

    try{
      const apiMode = (isOR ? 'chat' : settings.apiMode);
      if (apiMode === 'responses'){
        const input = baseMessages.map(m => ({ role: m.role, content: [{ type:'input_text', text: String(m.content||'') }] }));
        const userParts = await buildUserPartsForResponses();
        input.push({ role:'user', content: userParts });

        const answer = await callResponses({
          apiKey, baseUrl, model,
          input,
          max_output_tokens: maxOut,
          temperature: 0.25,
          reasoningEffort: settings.reasoningEffort,
          reasoningSummary: settings.reasoningSummary
        });
        setStatus(statusBoxId, '', false);
        return answer || '';
    try{ currentChatAbort = null; }catch(_){ }
      } else {
        const userParts = await buildUserPartsForChat();
        const finalMessages = baseMessages.concat([{ role:'user', content: userParts }]);

        const answer = await callChatCompletions({ apiKey, baseUrl, model, messages: finalMessages, max_tokens: maxOut, temperature: 0.25 });
        setStatus(statusBoxId, '', false);
        return answer || '';
    try{ currentChatAbort = null; }catch(_){ }
      }
    } finally {
      setStatus(statusBoxId, '', false);
    }
  }

async function sendChatStream(userText, statusBoxId, onDelta){
  const settings = getChatSettingsOrThrow();
  setStatus(statusBoxId, 'جاري إرسال السؤال...', true);

  try{ if (currentChatAbort) currentChatAbort.abort(); }catch(_){ }
  currentChatAbort = new AbortController();
  const signal = currentChatAbort.signal;

  const maxOut = settings.chatMaxOutTokens;
  const baseUrl = settings.baseUrl || 'https://api.openai.com/v1';
  let model = settings.model;
  const isOR = isOpenRouterUrl(baseUrl);
  if (isOR && settings.openrouterWebSearch){
    if (!String(model).includes(':online')) model = String(model) + ':online';
  }

  try{
    if (settings.chatProvider === 'gemini'){
      const ctx = chatMessages.slice(-settings.chatHistoryTurns).map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(m.content || '') }]
      }));

      try{
      let combinedAll = '';
            let curContents = ctx.concat([{ role:'user', parts:[{text:String(userText||'')}] }]);
            for (let i=0; i<Math.max(1, settings.chatMaxParts); i++){
              setStatus(statusBoxId, `جاري التوليد... (${i+1}/${settings.chatMaxParts})`, true);
              const { text, finishReason } = await callGeminiStream({
            enableWebSearch: !!settings.geminiWebSearch,
                geminiKey: settings.geminiKey,
                geminiModel: settings.geminiModel,
                systemInstructionText: settings.chatSystemPrompt,
                contents: curContents,
                temperature: settings.temperature || 0.25,
                maxOutputTokens: maxOut,
                signal,
                onDelta: (d, full) => {
                  const joined = (combinedAll ? (combinedAll + '\n' + full) : full);
                  onDelta && onDelta(d, joined);
                }
              });

              if (text){
                combinedAll += (combinedAll ? '\n' : '') + text;
              }

              const isMax = (finishReason === 'MAX_TOKENS' || finishReason === 2);
              if (!isMax) break;

              const contPrompt = "تابع من حيث توقفت بدون إعادة ما سبق، وأكمل بنفس الأسلوب.";
              curContents = curContents.concat([
                { role:'model', parts:[{text:text || ''}] },
                { role:'user', parts:[{text:contPrompt}] }
              ]);
            }
            return (combinedAll || '').trim();
      } catch(e){
      // Fallback إذا فشل Streaming (v26) (غالبًا بسبب CORS في المتصفح)
      setStatus(statusBoxId, 'جاري التوليد (Fallback بدون Streaming)...', true);

      const full = await callGeminiGenerateContent({
          enableWebSearch: !!settings.geminiWebSearch,
        geminiKey: settings.geminiKey,
        geminiModel: settings.geminiModel,
        systemInstructionText: settings.chatSystemPrompt,
        contents: ctx.concat([{ role:'user', parts:[{text:String(userText||'')}] }]),
        temperature: settings.temperature || 0.25,
        maxOutputTokens: maxOut,
        autoContinue: true,
        maxParts: settings.chatMaxParts,
        signal
      });

      // محاكاة Streaming بشكل آمن (Typewriter)
      if (onDelta){
        let built = '';
        const step = 140;
        for (let p=0; p<(full||'').length; p+=step){
          const chunk = (full||'').slice(p, p+step);
          built += chunk;
          onDelta(chunk, built);
          await sleep(18);
        }
      }

      return (full || '').trim();
      }
    }

if (isOR || settings.apiMode !== 'responses'){
  // OpenRouter / chat-completions streaming
  
// Build user parts (attachments as extracted text + images)
const parts = [];
const useAttachments = settings.chatDirectFiles !== 'off' && chatAttachments.length > 0;
const visionEnabled = settings.visionMode !== 'ocr';
if (useAttachments){
  for (const att of chatAttachments){
    if (att.isImage){
      if (!visionEnabled) continue;
      if (!att.dataUrl && att.file){ try{ att.dataUrl = await fileToDataUrl(att.file); }catch{} }
      if (att.dataUrl) parts.push({ type:'image_url', image_url:{ url: att.dataUrl } });
      continue;
    }
    if ((!att.text || !att.text.trim()) && att.file){
      try{ att.text = await parseFileToText(att.file, statusBoxId); }catch{}
    }
    if (att.text && att.text.trim()){
      const clip = att.text.length > 12000 ? (att.text.slice(0,6000) + '\n\n...\n\n' + att.text.slice(-6000)) : att.text;
      parts.push({ type:'text', text: `[ملف: ${att.name}]\n${clip}` });
    } else {
      parts.push({ type:'text', text: `[ملف مرفق: ${att.name}] (تعذر استخراج النص)` });
    }
  }
}
parts.push({ type:'text', text: String(userText||'') });

      const messages = await buildChatMessagesForAPI(userText);
      messages.push({ role:'user', content: parts });
  const out = await callChatCompletionsStream({
    apiKey: settings.apiKey,
    baseUrl,
    model,
    messages,
    max_tokens: maxOut,
    temperature: settings.temperature || 0.25,
    signal,
    onDelta: (_d, full) => { onDelta && onDelta(_d, full); }
  });
  return (out || '').trim();
}

const input = [
  { role:'user', content:[{ type:'input_text', text:String(userText||'') }]} 
];

const out = await callOpenAIResponsesStream({
  apiKey: settings.apiKey,
  baseUrl: baseUrl,
  model: model,
  instructions: settings.chatSystemPrompt,
  input,
  temperature: settings.temperature || 0.25,
  max_output_tokens: maxOut,
  signal,
  onDelta: (_d, full) => { onDelta && onDelta(_d, full); }
});

return (out || '').trim();

  } finally {
    try{ currentChatAbort = null; }catch(_){}
    setStatus(statusBoxId, '', false);
  }
}


  // -------------------- Draft persistence --------------------
  function persistDraft(){
    const payload = {
      text: $('textInput')?.value || '',
      summary: $('summaryOutput')?.value || '',
    };
    localStorage.setItem('draft_v11', JSON.stringify(payload));
  }

  function restoreDraft(){
    try{
      const raw = localStorage.getItem('draft_v11');
      if (!raw) return;
      const d = JSON.parse(raw);
      if ($('textInput') && typeof d.text === 'string') $('textInput').value = d.text;
      if ($('summaryOutput') && typeof d.summary === 'string') $('summaryOutput').value = d.summary;
    }catch{}
  }

  function persistChatDraft(){
    const payload = {
      currentChatId,
      chatMessages,
      chatAttachments: chatAttachments.map(a => ({
        id: a.id, name: a.name, kind: a.kind, isImage: !!a.isImage, kbDocId: a.kbDocId || null
      })),
    };
    localStorage.setItem('chat_draft_v11', JSON.stringify(payload));
    try{ saveCurrentProjectDraft(); }catch(_){ }
  }

  function restoreChatDraft(){
    try{
      const raw = localStorage.getItem('chat_draft_v11');
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d?.currentChatId) currentChatId = d.currentChatId;
      if (Array.isArray(d?.chatMessages)) chatMessages = d.chatMessages;
      if (Array.isArray(d?.chatAttachments)){
        chatAttachments = d.chatAttachments.map(a => ({
          id: a.id || makeId('att'),
          name: a.name || 'ملف',
          kind: a.kind || 'other',
          isImage: !!a.isImage,
          kbDocId: a.kbDocId || null,
          file: null,
          fileId: null,
          dataUrl: null,
        }));
      }
    }catch{}
  }

// -------------------- Projects / Workspaces --------------------
const PROJECTS_KEY = 'bspro_projects_v1';
const CURRENT_PROJECT_KEY = 'bspro_current_project_v1';
const DEFAULT_PROJECT_ID = 'default';

function loadProjects(){
  try{
    const raw = localStorage.getItem(PROJECTS_KEY);
    if (!raw) return [{ id: DEFAULT_PROJECT_ID, name: 'مشروع افتراضي', createdAt: nowTs(), updatedAt: nowTs(), budgetUsd: 0, alertPct: 80, memorySummary: '' }];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || !arr.length) throw new Error('empty');
    return arr;
  }catch(_){
    return [{ id: DEFAULT_PROJECT_ID, name: 'مشروع افتراضي', createdAt: nowTs(), updatedAt: nowTs(), budgetUsd: 0, alertPct: 80, memorySummary: '' }];
  }
}

function saveProjects(arr){
  try{ localStorage.setItem(PROJECTS_KEY, JSON.stringify(arr)); }catch(_){}
}

function getCurrentProjectId(){
  return localStorage.getItem(CURRENT_PROJECT_KEY) || DEFAULT_PROJECT_ID;
}

function setCurrentProjectId(id){
  localStorage.setItem(CURRENT_PROJECT_KEY, id || DEFAULT_PROJECT_ID);
}

function projectDraftKey(pid){ return `chat_draft_${pid}_v1`; }
function projectUsageKey(pid){ return `proj_usage_${pid}_v1`; }
function projectMemoryKey(pid){ return `proj_memory_${pid}_v1`; }
function projectSettingsKey(pid){ return `proj_settings_${pid}_v1`; }

function loadProjectUsage(pid){
  try{
    const raw = localStorage.getItem(projectUsageKey(pid));
    if (!raw) return { tin:0, tout:0, cost:0 };
    const j = JSON.parse(raw);
    return { tin: Number(j.tin||0), tout: Number(j.tout||0), cost: Number(j.cost||0) };
  }catch(_){}
  return { tin:0, tout:0, cost:0 };
}

function saveProjectUsage(pid, u){
  try{ localStorage.setItem(projectUsageKey(pid), JSON.stringify(u)); }catch(_){}
}

function loadProjectMemory(pid){
  try{ return localStorage.getItem(projectMemoryKey(pid)) || ''; }catch(_){}
  return '';
}
function saveProjectMemory(pid, txt){
  try{ localStorage.setItem(projectMemoryKey(pid), String(txt||'')); }catch(_){}
}

function loadProjectSettings(pid){
  try{
    const raw = localStorage.getItem(projectSettingsKey(pid));
    if (!raw) return null;
    return JSON.parse(raw);
  }catch(_){}
  return null;
}
function saveProjectSettings(pid, s){
  try{ localStorage.setItem(projectSettingsKey(pid), JSON.stringify(s||{})); }catch(_){}
}

function ensureProjectExists(pid){
  const projects = loadProjects();
  if (!projects.find(p=>p.id===pid)){
    projects.push({ id: pid, name: 'مشروع', createdAt: nowTs(), updatedAt: nowTs(), budgetUsd: 0, alertPct: 80, memorySummary: '' });
    saveProjects(projects);
  }
}

function getProjectMeta(pid){
  const projects = loadProjects();
  return projects.find(p=>p.id===pid) || projects[0];
}

function updateProjectMeta(pid, patch){
  const projects = loadProjects();
  const idx = projects.findIndex(p=>p.id===pid);
  if (idx>=0){
    projects[idx] = Object.assign({}, projects[idx], patch, { updatedAt: nowTs() });
    saveProjects(projects);
  }
}

function renderProjectSelect(){
  const sel = $('projectSelect');
  if (!sel) return;
  const projects = loadProjects();
  const cur = getCurrentProjectId();
  sel.innerHTML = '';
  projects.forEach(p=>{
    const o = document.createElement('option');
    o.value = p.id;
    o.textContent = p.name;
    sel.appendChild(o);
  });
  sel.value = cur;
  const meta = getProjectMeta(cur);
  $('projectBudgetUsd') && ($('projectBudgetUsd').value = meta?.budgetUsd ? String(meta.budgetUsd) : '');
  $('projectAlertPct') && ($('projectAlertPct').value = meta?.alertPct ? String(meta.alertPct) : '80');
}

function saveCurrentProjectDraft(){
  const pid = getCurrentProjectId();
  const payload = {
    currentChatId,
    chatMessages,
    chatAttachments: chatAttachments.map(a => ({ id:a.id, name:a.name, kind:a.kind, isImage:!!a.isImage, kbDocId:a.kbDocId||null })),
  };
  try{ localStorage.setItem(projectDraftKey(pid), JSON.stringify(payload)); }catch(_){}
  // also store chat settings snapshot
  try{
    const snap = {
      baseUrl: ($('baseUrl')?.value||'').trim(),
      model: ($('model')?.value||'').trim(),
      chatProvider: ($('chatProvider')?.value||'openai').trim(),
      apiMode: ($('apiMode')?.value||'responses').trim(),
    };
    saveProjectSettings(pid, snap);
  }catch(_){}
}

function restoreProjectDraft(pid){
  try{
    const raw = localStorage.getItem(projectDraftKey(pid));
    if (!raw){
      newChatThread();
      return;
    }
    const d = JSON.parse(raw);
    if (d?.currentChatId) currentChatId = d.currentChatId;
    if (Array.isArray(d?.chatMessages)) chatMessages = d.chatMessages;
    if (Array.isArray(d?.chatAttachments)){
      chatAttachments = d.chatAttachments.map(a => ({
        id: a.id || makeId('att'),
        name: a.name || 'ملف',
        kind: a.kind || 'other',
        isImage: !!a.isImage,
        kbDocId: a.kbDocId || null,
        file: null,
        fileId: null,
        dataUrl: null,
      }));
    } else {
      chatAttachments = [];
    }
    renderChat();
    renderChatAttachments();
    persistChatDraft(); // keep global draft too
  }catch(_){
    newChatThread();
  }
}

function switchProject(newPid){
  if (!newPid) newPid = DEFAULT_PROJECT_ID;
  saveCurrentProjectDraft();
  setCurrentProjectId(newPid);
  ensureProjectExists(newPid);

  // restore settings snapshot if exists
  const snap = loadProjectSettings(newPid);
  if (snap){
    try{
      if ($('baseUrl')) $('baseUrl').value = snap.baseUrl || $('baseUrl').value;
      if ($('model')) $('model').value = snap.model || $('model').value;
      if ($('chatProvider')) $('chatProvider').value = snap.chatProvider || $('chatProvider').value;
      if ($('apiMode')) $('apiMode').value = snap.apiMode || $('apiMode').value;
      saveSettings();
    }catch(_){}
  }

  restoreProjectDraft(newPid);
  try{ updateChatModelBtn(); }catch(_){}
  try{ updateUsageBar(); }catch(_){}
  renderProjectSelect();
}

// -------------------- Export --------------------
  function exportPdfViaPrint(title, text){
    const rtl = detectRTL(text);
    const dir = rtl ? 'rtl' : 'ltr';
    const w = window.open('', '_blank');
    if (!w){
      alert('المتصفح منع نافذة التصدير. فعّل Pop-ups ثم أعد المحاولة.');
      return;
    }
    w.document.open();
    w.document.write(`<!doctype html>
<html lang="ar" dir="${dir}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;padding:24px;}
  h1{margin:0 0 12px;font-size:18px;}
  pre{white-space:pre-wrap;line-height:1.75;font-size:14px;}
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<pre>${escapeHtml(text)}</pre>
<script>setTimeout(()=>window.print(), 450);</script>
</body>
</html>`);
    w.document.close();
  }

  function humanSize(bytes){
    const b = Number(bytes||0);
    if (b < 1024) return b + ' B';
    if (b < 1024*1024) return (b/1024).toFixed(1) + ' KB';
    if (b < 1024*1024*1024) return (b/1024/1024).toFixed(1) + ' MB';
    return (b/1024/1024/1024).toFixed(2) + ' GB';
  }

  function makeId(prefix='dl'){
    return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  const _downloadUrlMap = new Map(); // id -> objectURL

  async function addDownloadRecord(filename, blob){
    try{
      const rec = {
        id: makeId(),
        name: filename || 'file',
        mime: blob?.type || 'application/octet-stream',
        size: blob?.size || 0,
        createdAt: Date.now(),
        blob
      };
      await dbPut(DOWNLOADS, rec);
      await renderDownloads();
      setStatus('downloadsStatus', `✅ تم إنشاء ملف: ${rec.name} (${humanSize(rec.size)})\nافتح تبويب "التحميلات" للتنزيل.`, true);
      return rec.id;
    }catch(e){
      // إذا فشل التخزين (حجم كبير)، على الأقل لا نكسر التنزيل
      console.warn('addDownloadRecord failed', e);
      return null;
    }
  }

  async function listDownloads(){
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DOWNLOADS, 'readonly');
      const os = tx.objectStore(DOWNLOADS);
      const idx = os.index('by_createdAt');
      const req = idx.getAll();
      req.onsuccess = () => {
        const items = (req.result || []).sort((a,b)=> (b.createdAt||0)-(a.createdAt||0));
        resolve(items);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async function deleteDownload(id){
    try{
      const url = _downloadUrlMap.get(id);
      if (url) { URL.revokeObjectURL(url); _downloadUrlMap.delete(id); }
    }catch(_){}
    await dbDelete(DOWNLOADS, id);
    await renderDownloads();
  }

  async function clearDownloads(){
    const items = await listDownloads();
    for (const it of items){
      try{
        const url = _downloadUrlMap.get(it.id);
        if (url) { URL.revokeObjectURL(url); _downloadUrlMap.delete(it.id); }
      }catch(_){}
      await dbDelete(DOWNLOADS, it.id);
    }
    await renderDownloads();
    setStatus('downloadsStatus', 'تم مسح التحميلات.', true);
  }

  function getObjectUrl(id, blob){
    if (!blob) return '';
    if (_downloadUrlMap.has(id)) return _downloadUrlMap.get(id);
    const url = URL.createObjectURL(blob);
    _downloadUrlMap.set(id, url);
    return url;
  }

  async function renderDownloads(){
    const listEl = $('downloadsList');
    if (!listEl) return;
    const items = await listDownloads();
    if (!items.length){
      listEl.innerHTML = `<div class="hint">لا توجد ملفات بعد. عندما تقوم بتصدير Word أو إنشاء ملفات، ستظهر هنا.</div>`;
      return;
    }
    listEl.innerHTML = '';
    for (const it of items){
      const row = document.createElement('div');
      row.className = 'dlrow';
      const left = document.createElement('div');
      left.innerHTML = `<div class="name">${escapeHtml(it.name || 'file')}</div>
                        <div class="meta">${humanSize(it.size)} • ${new Date(it.createdAt||Date.now()).toLocaleString('ar-EG')}</div>`;
      const actions = document.createElement('div');
      actions.className = 'actions';
      const a = document.createElement('a');
      a.className = 'btn ghost';
      a.textContent = 'تنزيل';
      a.download = it.name || 'file';
      a.href = getObjectUrl(it.id, it.blob);
      a.rel = 'noopener';
      const del = document.createElement('button');
      del.className = 'btn danger';
      del.textContent = 'حذف';
      del.onclick = ()=> deleteDownload(it.id);
      actions.appendChild(a);
      actions.appendChild(del);
      row.appendChild(left);
      row.appendChild(actions);
      listEl.appendChild(row);
    }
  }

  
function triggerDownload(filename, blob){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'file';
  a.target = '_blank';
  a.rel = 'noopener';
  document.body.appendChild(a);
  setTimeout(() => { try{ a.click(); }catch(_){ } }, 50);
  setTimeout(() => {
    try{ a.remove(); }catch(_){}
    try{ URL.revokeObjectURL(url); }catch(_){}
  }, 8000);
}

function downloadBlob(filename, blob){
  // 1) أضف الملف لقائمة التحميلات كرابط (إن أمكن)
  try{ addDownloadRecord(filename, blob); }catch(_){}

  // 2) تنزيل عبر رابط (أفضل توافق على Android/PWA)
  triggerDownload(filename, blob);
}

  function getHtmlToDocxFn(){
    return window.HTMLToDOCX || window.HTMLtoDOCX || window.htmlToDocx || null;
  }

  async function exportDocx(filename, title, text){
    const fn = getHtmlToDocxFn();
    if (!fn) throw new Error('مكتبة DOCX لم تُحمّل.');
    const rtl = detectRTL(text);
    const dir = rtl ? 'rtl' : 'ltr';
    const lang = rtl ? 'ar-SA' : 'en-US';
    const html = `
      <div dir="${dir}" lang="${lang}" style="font-family: Arial; line-height:1.8;">
        <h2>${escapeHtml(title)}</h2>
        <div style="white-space:pre-wrap; font-size:14px;">${escapeHtml(text)}</div>
      </div>
    `;
    const result = await fn(html, null, { title, creator:'Book Summarizer Pro', direction:dir, lang, font:'Arial' }, null);
    const blob = (result instanceof Blob)
      ? result
      : new Blob([result], { type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    downloadBlob(filename, blob);
  }

  
  // -------------------- CloudConvert: PDF → DOCX (Template) --------------------
  async function cloudConvertPdfToDocx(pdfFile, statusBoxId){
    const { ccWorkerUrl, ccCloudOcr } = getCloudConvertSettings();
    if (!ccWorkerUrl) throw new Error('يرجى إدخال CloudConvert Worker URL من الإعدادات أولاً.');
    if (!pdfFile) throw new Error('لا يوجد ملف PDF.');

    setStatus(statusBoxId, 'إنشاء مهمة تحويل سحابية...', true);

    const startUrl = ccWorkerUrl + '/start';
    const res = await fetch(startUrl, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: (pdfFile.name || 'file.pdf'),
        ocr: (ccCloudOcr !== 'off'),
        languages: ['ara','eng'],
        output: 'docx'
      })
    });
    if (!res.ok){
      const txt = await res.text().catch(()=> '');
      throw new Error('فشل بدء التحويل: ' + res.status + ' ' + txt);
    }
    const data = await res.json();
      const gm = data?.candidates?.[0]?.groundingMetadata;
      if (gm){ sourcesMd = sourcesMd || geminiSourcesMarkdown(gm); }
    const jobId = data.jobId;
    const form = data.upload?.form || data.upload || data.form;
    if (!jobId || !form?.url || !form?.parameters) throw new Error('استجابة غير متوقعة من خدمة التحويل.');

    // Upload file directly to CloudConvert (file MUST be the last parameter)
    setStatus(statusBoxId, 'رفع الـ PDF إلى CloudConvert...', true);
    const fd = new FormData();
    const params = form.parameters || {};
    Object.keys(params).forEach(k => fd.append(k, String(params[k])));
    fd.append('file', pdfFile, pdfFile.name || 'file.pdf');

    const up = await fetch(form.url, { method:'POST', body: fd, redirect:'follow' });
    if (!up.ok){
      const t = await up.text().catch(()=> '');
      throw new Error('فشل رفع الملف: ' + up.status + ' ' + t);
    }

    // Poll until finished
    const statusUrl = ccWorkerUrl + '/status?jobId=' + encodeURIComponent(jobId);
    const t0 = Date.now();
    const timeoutMs = 12 * 60 * 1000; // 12 min
    while (true){
      const sres = await fetch(statusUrl, { method:'GET', credentials:'include' });
      if (!sres.ok){
        const t = await sres.text().catch(()=> '');
        throw new Error('فشل متابعة التحويل: ' + sres.status + ' ' + t);
      }
      const st = await sres.json();
      if (st.status === 'finished'){
        const files = st.files || [];
        const url = st.url || (files[0]?.url) || (files[0]?.download_url);
        if (!url) throw new Error('اكتمل التحويل لكن لم يتم العثور على رابط تنزيل.');
        setStatus(statusBoxId, 'اكتمل التحويل ✅ جارٍ فتح رابط التنزيل...', false);

        // trigger download in a new tab to avoid memory load
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        a.remove();

        return { jobId, url, files };
      }
      if (st.status === 'error' || st.status === 'failed'){
        throw new Error(st.message || 'فشل التحويل.');
      }
      const elapsed = Date.now() - t0;
      if (elapsed > timeoutMs) throw new Error('انتهت المهلة أثناء التحويل. حاول مرة أخرى.');
      setStatus(statusBoxId, `جاري التحويل... (${Math.round(elapsed/1000)}s)`, true);
      await sleep(1800);
    }
  }

async function exportPdfTemplateDocxFromFile(pdfFile, correctedText='', statusBoxId='statusBox'){
    const fn = getHtmlToDocxFn();
    if (!fn) throw new Error('مكتبة DOCX لم تُحمّل.');
    const pdfjsLib = initPdfJs();

    setStatus(statusBoxId, 'جاري تجهيز القالب من PDF (صفحات كصور)…', true);

    const ab = await pdfFile.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
    const total = pdf.numPages || 1;

    // Mobile safety: limit pages to avoid memory crashes
    const MAX_PAGES = 25;
    const pagesToRender = Math.min(total, MAX_PAGES);

    const imgs = [];
    for (let p=1; p<=pagesToRender; p++){
      setStatus(statusBoxId, `تحويل الصفحة ${p}/${pagesToRender}…`, true);
      const page = await pdf.getPage(p);
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext('2d', { alpha:false });
      await page.render({ canvasContext: ctx, viewport }).promise;
      imgs.push(canvas.toDataURL('image/png'));
      // free some memory
      canvas.width = 1; canvas.height = 1;
    }

    const warning = total > MAX_PAGES
      ? `تنبيه: تم تصدير أول ${MAX_PAGES} صفحة فقط من أصل ${total} (لتجنب ضغط الذاكرة على الهاتف).`
      : '';

    const rtl = detectRTL(correctedText);
    const dir = rtl ? 'rtl' : 'ltr';
    const lang = rtl ? 'ar-SA' : 'en-US';

    const imgBlocks = imgs.map((src,i)=>`
      <div style="page-break-after:always;">
        <div style="font-size:12px; color:#666; margin:0 0 6px 0;">صفحة ${i+1}</div>
        <img src="${src}" style="width:100%; max-width:720px; display:block; border:1px solid #ddd; border-radius:8px;" />
      </div>
    `).join('\n');

    const correctedSection = correctedText?.trim()
      ? `
        <div style="page-break-before:always;"></div>
        <h3 style="margin:0 0 10px 0;">النص المُصحّح (قابل للنسخ)</h3>
        <div dir="${dir}" lang="${lang}" style="white-space:pre-wrap; font-size:13.5px; line-height:1.9;">
          ${escapeHtml(correctedText)}
        </div>
      `
      : '';

    const html = `
      <div dir="ltr" lang="en-US" style="font-family: Arial; line-height:1.4;">
        <h2 style="margin:0 0 6px 0;">قالب Word مطابق لـ PDF</h2>
        <div style="font-size:12.5px; color:#555; margin:0 0 12px 0;">
          تم إدراج صفحات الـPDF كصور داخل Word للحفاظ على التنسيق قدر الإمكان. ${warning}
        </div>
        ${imgBlocks}
        ${correctedSection}
      </div>
    `;

    const out = await fn(html, null, { title: 'PDF Template', creator:'Book Summarizer Pro', direction:'ltr', lang:'en-US', font:'Arial' }, null);
    const blob = (out instanceof Blob) ? out : new Blob([out], { type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    downloadBlob((pdfFile.name || 'template').replace(/\.[^.]+$/, '') + '_template.docx', blob);

    setStatus(statusBoxId, '', false);
  }



  function xmlEscape(s){
    return String(s || '')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&apos;');
  }

  function buildDocxParagraphsFromText(text){
    const t = String(text || '').replace(/\r/g,'');
    const lines = t.split(/\n/);
    const rtl = detectRTL(t);
    const pPr = rtl ? '<w:pPr><w:bidi/></w:pPr>' : '';
    const rPr = rtl ? '<w:rPr><w:rtl/></w:rPr>' : '';
    return lines.map(line => {
      const safe = xmlEscape(line);
      return `<w:p>${pPr}<w:r>${rPr}<w:t xml:space="preserve">${safe}</w:t></w:r></w:p>`;
    }).join('');
  }

  async function exportDocxUsingTemplate(filename, templateFile, newText){
    if (!window.JSZip) throw new Error('مكتبة JSZip لم تُحمّل.');
    if (!templateFile) throw new Error('لم يتم تحميل ملف قالب (DOCX).');

    const buf = await templateFile.arrayBuffer();
    const zip = await JSZip.loadAsync(buf);

    const docPath = 'word/document.xml';
    const docFile = zip.file(docPath);
    if (!docFile) throw new Error('القالب لا يحتوي على word/document.xml');

    const xml = await docFile.async('string');

    const bodyMatch = xml.match(/<w:body>[\s\S]*?<\/w:body>/);
    if (!bodyMatch) throw new Error('تعذر قراءة جسم المستند.');

    // Extract sectPr to preserve page setup/margins from template
    const sectMatch = bodyMatch[0].match(/<w:sectPr[\s\S]*?<\/w:sectPr>/);
    const sectPr = sectMatch ? sectMatch[0] : '';

    const paragraphs = buildDocxParagraphsFromText(newText);
    const newBody = `<w:body>${paragraphs}${sectPr}</w:body>`;
    const newXml = xml.replace(/<w:body>[\s\S]*?<\/w:body>/, newBody);

    zip.file(docPath, newXml);

    const out = await zip.generateAsync({ type:'blob' });
    const blob = new Blob([out], { type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    downloadBlob(filename, blob);
  }


  // -------------------- History --------------------
  async function saveRecord(type, title, content, meta={}){
    const rec = { id: makeId(type), type, title: title || type, content: content || '', meta,
      createdAt: nowTs(), updatedAt: nowTs() };
    await dbPut(STORE, rec);
    return rec;
  }

  function typeLabel(t){
    if (t === 'extraction') return 'تفريغ';
    if (t === 'summary') return 'ملخص';
    if (t === 'chat') return 'دردشة';
    if (t === 'export') return 'تصدير';
    if (t === 'aifix') return 'تصحيح';
    return t;
  }

  async function renderHistory(){
    const list = $('historyList');
    if (!list) return;
    const items = await dbGetAll(STORE);
    items.sort((a,b)=> (b.updatedAt||0)-(a.updatedAt||0));
    list.innerHTML = '';

    if (!items.length){
      const empty = document.createElement('div');
      empty.className = 'card';
      empty.textContent = 'لا توجد عناصر محفوظة بعد.';
      list.appendChild(empty);
      return;
    }

    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'card';

      const row = document.createElement('div');
      row.className = 'row';

      const left = document.createElement('div');
      const title = document.createElement('div');
      title.className = 'title';
      title.textContent = item.title || 'بدون عنوان';

      const sub = document.createElement('div');
      sub.className = 'sub';
      sub.textContent = `${typeLabel(item.type)} • ${fmtTime(item.updatedAt)}`;

      left.appendChild(title);
      left.appendChild(sub);

      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = typeLabel(item.type);

      row.appendChild(left);
      row.appendChild(tag);

      const preview = document.createElement('div');
      preview.className = 'sub';
      preview.style.marginTop = '10px';
      const p = (item.content || '').slice(0, 220).replace(/\s+/g,' ').trim();
      preview.textContent = p ? p + (item.content.length>220 ? '…' : '') : (item.type==='chat' ? '(سجل دردشة)' : '(محتوى فارغ)');

      const actions = document.createElement('div');
      actions.className = 'actions';

      const btnOpen = document.createElement('button');
      btnOpen.className = 'btn ghost';
      btnOpen.textContent = 'فتح';
      btnOpen.onclick = () => {
        if (item.type === 'extraction' || item.type === 'aifix'){
          $('textInput').value = item.content || '';
          showTab('text');
          persistDraft();
        } else if (item.type === 'summary'){
          $('summaryOutput').value = item.content || '';
          showTab('summary');
          persistDraft();
        } else if (item.type === 'chat'){
          currentChatId = item.id;
          chatMessages = item.meta?.messages || [];
          renderChat();
          persistChatDraft();
          showTab('chat');
        }
      };

      const btnExportDocx = document.createElement('button');
      btnExportDocx.className = 'btn ghost';
      btnExportDocx.textContent = 'Word';
      btnExportDocx.onclick = async () => {
        try{
          const t = item.title || typeLabel(item.type);
          if (item.type === 'chat'){
            const txt = (item.meta?.messages || []).map(m => `${m.role==='user'?'أنت':'المساعد'}: ${m.content}`).join('\n\n');
            await exportDocx(`${t}.docx`, t, txt);
          } else {
            await exportDocx(`${t}.docx`, t, item.content || '');
          }
        }catch(e){ alert(e.message || String(e)); }
      };

      const btnDelete = document.createElement('button');
      btnDelete.className = 'btn danger';
      btnDelete.textContent = 'حذف';
      btnDelete.onclick = async () => {
        if (!confirm('هل تريد حذف هذا العنصر؟')) return;
        await dbDelete(STORE, item.id);
        await renderHistory();
    await renderDownloads();
      };

      actions.appendChild(btnOpen);
      actions.appendChild(btnExportDocx);
      actions.appendChild(btnDelete);

      card.appendChild(row);
      card.appendChild(preview);
      card.appendChild(actions);
      list.appendChild(card);
    });
  }

  // -------------------- KB UI --------------------
  async function refreshKBUI(){
    const docs = await kbListDocs();
    $('kbStats') && ($('kbStats').textContent = `قاعدة المعرفة: ${docs.length} ملف`);

    const list = $('kbList');
    if (!list) return;
    list.innerHTML = '';
    if (!docs.length){
      list.innerHTML = `<div class="hint">لا توجد ملفات بعد. استخدم زر “إضافة ملفات”.</div>`;
      return;
    }

    for (const d of docs){
      const card = document.createElement('div');
      card.className = 'card';

      const row = document.createElement('div');
      row.className = 'row';

      const left = document.createElement('div');
      const t = document.createElement('div');
      t.className='title';
      t.textContent = d.name;

      const sub = document.createElement('div');
      sub.className='sub';
      sub.textContent = `${d.type} • ${d.indexed?'مفهرس':'غير مفهرس'} • ${Math.round((d.text||'').length/1024)} KB نص`;

      left.appendChild(t); left.appendChild(sub);

      const tag = document.createElement('span');
      tag.className='tag';
      tag.textContent = d.indexed ? 'Indexed' : 'Needs Index';

      row.appendChild(left); row.appendChild(tag);

      const actions = document.createElement('div');
      actions.className='actions';

      const openBtn = document.createElement('button');
      openBtn.className='btn ghost';
      openBtn.textContent='عرض النص';
      openBtn.onclick = () => {
        $('textInput').value = d.text || '';
        showTab('text');
        persistDraft();
        openKBDrawer(false);
      };

      const delBtn = document.createElement('button');
      delBtn.className='btn danger';
      delBtn.textContent='حذف';
      delBtn.onclick = async () => {
        if (!confirm(`حذف الملف من قاعدة المعرفة؟\n${d.name}`)) return;
        await kbDeleteDoc(d.id);
        await refreshKBUI();
      };

      actions.appendChild(openBtn);
      actions.appendChild(delBtn);

      card.appendChild(row);
      card.appendChild(actions);

      list.appendChild(card);
    }
  }

  // -------------------- Multi-format parsing --------------------
  function stripHtmlToText(html){
    try{
      const doc = new DOMParser().parseFromString(html, 'text/html');
      return (doc.body?.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
    }catch{
      return (html||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
    }
  }

  function rtfToText(rtf){
    let t = rtf || '';
    t = t.replace(/\r\n/g, '\n');
    t = t.replace(/\\par[d]?/g, '\n');
    t = t.replace(/\\'([0-9a-fA-F]{2})/g, (_,h)=> String.fromCharCode(parseInt(h,16)));
    t = t.replace(/\\[a-zA-Z]+\d* ?/g, '');
    t = t.replace(/[{}]/g, '');
    t = t.replace(/\n{3,}/g, '\n\n');
    return t.trim();
  }

  async function xlsxToText(file, statusBoxId){
    if (!window.XLSX) throw new Error('مكتبة XLSX لم تُحمّل');
    setStatus(statusBoxId, `قراءة Excel: ${file.name}`, true);
    const ab = await file.arrayBuffer();
    const wb = XLSX.read(ab, { type:'array' });
    let out = `# Excel: ${file.name}\n`;
    for (const sheetName of wb.SheetNames){
      const ws = wb.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(ws, { FS: '\t' });
      out += `\n\n## Sheet: ${sheetName}\n` + (csv || '').trim() + '\n';
    }
    setStatus(statusBoxId, '', false);
    return out.trim();
  }

  function decodeXmlText(s){
    return (s||'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&apos;/g,"'");
  }

  async function pptxToText(file, statusBoxId){
    if (!window.JSZip) throw new Error('مكتبة JSZip لم تُحمّل');
    setStatus(statusBoxId, `قراءة PowerPoint: ${file.name}`, true);
    const ab = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(ab);
    const slidePaths = Object.keys(zip.files).filter(p => /^ppt\/slides\/slide\d+\.xml$/i.test(p));
    slidePaths.sort((a,b)=>{
      const na = parseInt(a.match(/slide(\d+)\.xml/i)[1],10);
      const nb = parseInt(b.match(/slide(\d+)\.xml/i)[1],10);
      return na-nb;
    });
    let out = `# PPTX: ${file.name}\n`;
    for (const p of slidePaths){
      const xml = await zip.files[p].async('string');
      const texts = [];
      const re = /<a:t[^>]*>([\s\S]*?)<\/a:t>/g;
      let m;
      while ((m = re.exec(xml)) !== null){
        const v = decodeXmlText(m[1]).replace(/\s+/g,' ').trim();
        if (v) texts.push(v);
      }
      const slideNo = p.match(/slide(\d+)\.xml/i)?.[1] || '?';
      out += `\n\n## Slide ${slideNo}\n` + texts.join('\n') + '\n';
    }
    setStatus(statusBoxId, '', false);
    return out.trim();
  }

  async function epubToText(file, statusBoxId){
    if (!window.JSZip) throw new Error('مكتبة JSZip لم تُحمّل');
    setStatus(statusBoxId, `قراءة EPUB: ${file.name}`, true);
    const ab = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(ab);
    const htmlPaths = Object.keys(zip.files).filter(p => /\.(xhtml|html|htm)$/i.test(p));
    htmlPaths.sort();
    let out = `# EPUB: ${file.name}\n`;
    let count=0;
    for (const p of htmlPaths){
      if (count >= 120) break;
      const html = await zip.files[p].async('string');
      const txt = stripHtmlToText(html);
      if (txt && txt.length > 30){
        out += `\n\n## ${p}\n` + txt + '\n';
        count++;
      }
    }
    setStatus(statusBoxId, '', false);
    return out.trim();
  }

  function extOf(name){
    return (name || '').toLowerCase().split('.').pop();
  }

  async function zipToText(file, statusBoxId){
    if (!window.JSZip) throw new Error('مكتبة JSZip لم تُحمّل');
    setStatus(statusBoxId, `قراءة ZIP: ${file.name}`, true);
    const ab = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(ab);
    const paths = Object.keys(zip.files).filter(p => !zip.files[p].dir);
    paths.sort();
    let out = `# ZIP: ${file.name}\n`;
    let processed = 0;
    for (const p of paths){
      if (processed >= 80) break;
      const ext = extOf(p);
      if (['txt','md','csv','json','xml','html','htm','rtf'].includes(ext)){
        setStatus(statusBoxId, `ZIP → ${p}`, true);
        const s = await zip.files[p].async('string');
        const t = (ext==='html'||ext==='htm') ? stripHtmlToText(s) : (ext==='rtf' ? rtfToText(s) : s);
        const trimmed = (t||'').trim();
        if (trimmed) out += `\n\n## ${p}\n${trimmed}\n`;
        processed++;
      } else if (['docx','pptx','xlsx','xls','pdf','epub'].includes(ext)){
        setStatus(statusBoxId, `ZIP → ${p}`, true);
        const blob = await zip.files[p].async('blob');
        const innerFile = new File([blob], p, { type: '' });
        const t = await parseFileToText(innerFile, statusBoxId, 1);
        if (t && t.trim()){
          out += `\n\n## ${p}\n${t.trim()}\n`;
          processed++;
        }
      }
    }
    setStatus(statusBoxId, '', false);
    return out.trim();
  }

  async function parseFileToText(file, statusBoxId, zipDepth=0){
    const name = file.name || 'file';
    const ext = extOf(name);
    const type = file.type || '';

    if (type.startsWith('text/') || ['txt','md','csv','json','xml','log'].includes(ext)){
      setStatus(statusBoxId, `قراءة نص: ${name}`, true);
      const t = await file.text();
      setStatus(statusBoxId, '', false);
      return (t||'').trim();
    }

    if (['html','htm'].includes(ext)){
      setStatus(statusBoxId, `قراءة HTML: ${name}`, true);
      const html = await file.text();
      setStatus(statusBoxId, '', false);
      return stripHtmlToText(html);
    }

    if (ext === 'rtf'){
      setStatus(statusBoxId, `قراءة RTF: ${name}`, true);
      const rtf = await file.text();
      setStatus(statusBoxId, '', false);
      return rtfToText(rtf);
    }

    if (ext === 'docx' || type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'){
      if (!window.mammoth) throw new Error('مكتبة mammoth لم تُحمّل');
      setStatus(statusBoxId, `قراءة DOCX: ${name}`, true);
      const arrayBuffer = await file.arrayBuffer();
      const res = await window.mammoth.extractRawText({ arrayBuffer });
      setStatus(statusBoxId, '', false);
      return (res?.value || '').trim();
    }

    if (type.startsWith('image/') || ['png','jpg','jpeg','webp'].includes(ext)){
      return await ocrImageFile(file, statusBoxId);
    }

    if (type === 'application/pdf' || ext === 'pdf'){
      setStatus(statusBoxId, `قراءة PDF: ${name}`, true);
      const txt = await extractTextFromPDF(file, false, false, statusBoxId);
      if ((txt||'').replace(/\s+/g,'').length < 30){
        return await extractTextFromPDF(file, true, true, statusBoxId);
      }
      setStatus(statusBoxId, '', false);
      return txt;
    }

    if (['xlsx','xls'].includes(ext)){
      return await xlsxToText(file, statusBoxId);
    }

    if (['pptx','ppt'].includes(ext)){
      return await pptxToText(file, statusBoxId);
    }

    if (ext === 'epub'){
      return await epubToText(file, statusBoxId);
    }

    if (ext === 'zip'){
      if (zipDepth >= 1) throw new Error('ZIP داخل ZIP غير مدعوم (للسلامة).');
      return await zipToText(file, statusBoxId);
    }

    try{
      setStatus(statusBoxId, `محاولة قراءة: ${name}`, true);
      const t = await file.text();
      setStatus(statusBoxId, '', false);
      const cleaned = (t||'').trim();
      if (cleaned.length > 10) return cleaned;
    }catch{}

    throw new Error(`نوع ملف غير مدعوم حاليًا: ${name}`);
  }



// -------------------- Chat Model Custom Dropdown (Scoped) --------------------
function updateChatModelBtn(){
  const el = $('chatModelBtnText');
  if (!el) return;
  const baseUrl = ($('baseUrl')?.value || '').trim();
  const isOR = isOpenRouterUrl(baseUrl);
  const model = ($('model')?.value || '').trim();
  el.textContent = (isOR ? 'OR: ' : 'AI: ') + (model || '—');
}

function openChatModelMenu(){
  const menu = $('chatModelMenu');
  if (!menu) return;
  menu.style.display = 'block';
  renderChatModelMenu();
  $('chatModelMenuSearch')?.focus();
}

function closeChatModelMenu(){
  const menu = $('chatModelMenu');
  if (!menu) return;
  menu.style.display = 'none';
}

function renderChatModelMenu(){
  const list = $('chatModelMenuList');
  if (!list) return;

  const q = String($('chatModelMenuSearch')?.value || '').trim().toLowerCase();
  const current = ($('model')?.value || '').trim();

  const fav = Array.from(getFavSet());
  const recent = getRecentModels();

  let all = [];
  try{
    const cache = readOpenRouterModelsCache();
    all = Array.isArray(cache?.items) ? cache.items : [];
  }catch(_){ all = []; }

  const merged = [];
  const seen = new Set();
  const push = (id, tag) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    merged.push({ id, tag });
  };

  push(current, 'الحالي');
  fav.forEach(id => push(id, 'مفضلة'));
  recent.forEach(id => push(id, 'أخيرة'));
  all.slice(0, 100).forEach(m => push(m.id || m.name, 'قائمة'));
  if (!all.length && Array.isArray(STATIC_OR_MODELS)) STATIC_OR_MODELS.forEach(id => push(id, 'قائمة'));

  let filtered = merged;
  if (q) filtered = merged.filter(x => String(x.id).toLowerCase().includes(q));

  list.innerHTML = '';

  filtered.slice(0, 140).forEach(item => {
    const row = document.createElement('div');
    row.className = 'chatModelItem';

    const left = document.createElement('div');
    left.className = 'left';
    left.innerHTML = `<div class="id">${escapeHtml(item.id)}</div><div class="meta">${escapeHtml(item.tag || '')}</div>`;

    const right = document.createElement('div');
    right.style.display = 'flex';
    right.style.gap = '8px';
    right.style.alignItems = 'center';

    const favSet = getFavSet();
    const isFav = favSet.has(item.id);

    const star = document.createElement('span');
    star.className = 'tag';
    star.textContent = isFav ? '★' : '☆';
    star.title = isFav ? 'إزالة من المفضلة' : 'إضافة للمفضلة';
    star.onclick = (e) => {
      e.stopPropagation();
      toggleFavorite(item.id);
      renderChatModelMenu();
    };

    const pick = document.createElement('button');
    pick.type = 'button';
    pick.className = 'btn primary sm';
    pick.textContent = (item.id === current) ? 'مُختار' : 'اختيار';
    pick.disabled = (item.id === current);
    pick.onclick = () => {
      const mi = $('model');
      if (mi){
        mi.value = item.id;
        saveSettings();
        addRecentModel(item.id);
        updateChatModelBtn();
        closeChatModelMenu();
      }
    };

    right.appendChild(star);
    right.appendChild(pick);

    row.appendChild(left);
    row.appendChild(right);
    row.onclick = () => pick.click();

    list.appendChild(row);
  });

  const footer = document.createElement('div');
  footer.style.display = 'flex';
  footer.style.gap = '10px';
  footer.style.flexWrap = 'wrap';
  footer.style.marginTop = '10px';
  footer.innerHTML = `
    <button id="chatModelMenuBrowse" class="btn ghost sm" type="button">🔎 استعراض كل الموديلات</button>
    <button id="chatModelMenuRefresh" class="btn ghost sm" type="button">⟳ تحديث القائمة</button>
  `;
  list.appendChild(footer);

  $('chatModelMenuBrowse')?.addEventListener('click', () => { closeChatModelMenu(); openModelBrowser(); });
  $('chatModelMenuRefresh')?.addEventListener('click', async () => {
    await ensureOpenRouterModelsLoaded({force:true});
    renderChatModelMenu();
  });
}

  // -------------------- Events --------------------
  
const PROMPT_TEMPLATES = {
  report_ar: {
    title: 'تقرير احترافي',
    template: `اكتب تقريرًا احترافيًا عن: {{topic}}\n\nالمخرجات المطلوبة:\n- ملخص تنفيذي\n- الخلفية\n- التحليل\n- التوصيات\n- خطة تنفيذ (جدول زمني)\n\nالجمهور: {{audience}}\nاللغة: عربية فصيحة منظمة.`
  },
  email_ar: {
    title: 'بريد رسمي',
    template: `اكتب بريدًا رسميًا بعنوان: {{subject}}\n\nإلى: {{recipient}}\nالغرض: {{purpose}}\n\nالنبرة: رسمية ومختصرة\nوقّع باسم: {{sender}}`
  },
  policy_ar: {
    title: 'سياسة/إجراء',
    template: `اكتب سياسة/إجراء بعنوان: {{title}}\n\nيشمل:\n- الهدف\n- النطاق\n- التعاريف\n- السياسة\n- الإجراءات والخطوات\n- المسؤوليات\n- الاستثناءات\n- السجلات\n- الملاحق (إن وجدت)\n\nالسياق: {{context}}`
  },
  analysis_ar: {
    title: 'تحليل + توصيات',
    template: `حلّل الحالة التالية ثم قدّم توصيات عملية: {{case}}\n\nالنتيجة المطلوبة:\n- تشخيص المشكلة\n- أسباب جذرية\n- خيارات الحل\n- توصية نهائية\n- مخاطر وتخفيف\n- خطوات تنفيذ خلال 30/60/90 يوم.`
  },
  json_schema: {
    title: 'JSON منظم',
    template: `حوّل المحتوى التالي إلى JSON منظم وفق مفاتيح واضحة (بدون شرح):\n{{text}}`
  }
};

function extractVars(tpl){
  const re = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  const set = new Set();
  let m;
  while ((m = re.exec(tpl))) set.add(m[1]);
  return Array.from(set);
}

async function insertTemplateFromLibrary(key){
  const def = PROMPT_TEMPLATES[key];
  if (!def) return;
  let tpl = def.template;
  const vars = extractVars(tpl);
  const values = {};
  for (const v of vars){
    const val = prompt(`قيمة المتغير: ${v}`, '');
    values[v] = val ?? '';
  }
  vars.forEach(v => {
    tpl = tpl.replace(new RegExp(`\\{\\{\\s*${v}\\s*\\}\\}`, 'g'), String(values[v]||''));
  });

  const input = $('chatInput');
  if (input){
    const cur = String(input.value||'');
    input.value = (cur ? (cur + '\n\n') : '') + tpl;
    input.focus();
  }
}


function openDashboard(){
  const m = $('dashModal'); if (!m) return;
  m.style.display='block'; m.setAttribute('aria-hidden','false');
  renderDashboard();
}
function closeDashboard(){
  const m = $('dashModal'); if (!m) return;
  m.style.display='none'; m.setAttribute('aria-hidden','true');
}

function fmtDateShort(ts){
  try{
    const d = new Date(ts);
    return d.toLocaleDateString('ar', { year:'numeric', month:'2-digit', day:'2-digit' });
  }catch(_){}
  return '';
}

function renderDashboard(){
  const body = $('dashBody'); if (!body) return;
  const projects = loadProjects();
  const cur = getCurrentProjectId();
  body.innerHTML = '';

  const header = document.createElement('div');
  header.className='hint';
  header.innerHTML = `المشروع الحالي: <b>${escapeHtml(getProjectMeta(cur)?.name || cur)}</b>`;
  body.appendChild(header);

  projects.forEach(p => {
    const u = loadProjectUsage(p.id);
    const budget = Number(p.budgetUsd||0);
    const pct = budget>0 ? Math.min(100, Math.round((u.cost/budget)*100)) : 0;

    const card = document.createElement('div');
    card.className='mbRow';
    card.innerHTML = `
      <div class="mbLeft">
        <div class="mbName">${escapeHtml(p.name)}</div>
        <div class="mbMeta">آخر تحديث: <b>${escapeHtml(fmtDateShort(p.updatedAt))}</b> • Tokens: ~${Math.round(u.tin)} / ~${Math.round(u.tout)} • Cost: <b>${escapeHtml(formatUsd(u.cost))}</b></div>
        <div class="mbTags">
          ${budget>0 ? `<span class="mbTag">Budget: ${escapeHtml(formatUsd(budget))}</span><span class="mbTag">${pct}%</span>` : `<span class="mbTag">بدون ميزانية</span>`}
        </div>
      </div>
      <div class="mbActions">
        <button class="btn primary sm" type="button">فتح</button>
      </div>
    `;
    card.querySelector('button')?.addEventListener('click', () => {
      closeDashboard();
      switchProject(p.id);
    });
    body.appendChild(card);
  });
}

function openCompare(){
  const m = $('compareModal'); if (!m) return;
  m.style.display='block'; m.setAttribute('aria-hidden','false');
  $('compareBody').innerHTML = '';
  $('compareStatus').style.display='none';
  const baseUrl = ($('baseUrl')?.value||'').trim();
  const curModel = ($('model')?.value||'').trim();
  $('cmpModelA').value = curModel;
  $('cmpModelB').value = '';
  $('cmpModelC').value = '';
}
function closeCompare(){
  const m = $('compareModal'); if (!m) return;
  m.style.display='none'; m.setAttribute('aria-hidden','true');
}

async function runCompare(){
  const status = $('compareStatus'); const body = $('compareBody');
  if (!body) return;
  const a = ($('cmpModelA')?.value||'').trim();
  const b = ($('cmpModelB')?.value||'').trim();
  const c = ($('cmpModelC')?.value||'').trim();
  const models = [a,b,c].filter(Boolean);
  if (models.length < 2) return alert('أدخل على الأقل موديلين.');
  const useCtx = !!$('cmpUseContext')?.checked;

  const lastUser = [...chatMessages].reverse().find(m=>m.role==='user')?.content || '';
  if (!lastUser) return alert('لا توجد رسالة مستخدم للمقارنة.');

  status.style.display='block';
  status.textContent='جاري المقارنة...';
  body.innerHTML='';

  const settings = getChatSettingsOrThrow();
  const baseUrl = settings.baseUrl || 'https://api.openai.com/v1';
  const isOR = (typeof isOpenRouterUrl === 'function') ? isOpenRouterUrl(baseUrl) : false;

  // build context messages
  let ctxMsgs = [];
  if (useCtx){
    ctxMsgs = await buildChatMessagesForAPI(lastUser);
  } else {
    ctxMsgs = [{ role:'system', content: settings.chatSystemPrompt || 'أجب بدقة وباختصار.' }];
  }

  for (const mId of models){
    try{
      status.textContent = `جاري ${mId}...`;
      let ans = '';
      if (isOR || settings.apiMode !== 'responses'){
        ans = await callChatCompletions({
          apiKey: settings.apiKey,
          baseUrl,
          model: mId,
          messages: [...ctxMsgs, { role:'user', content: String(lastUser) }],
          max_tokens: Math.min(1600, Number(settings.chatMaxOutTokens||1200)),
          temperature: settings.temperature || 0.25,
          plugins: null
        });
      } else {
        const input = [{ role:'user', content:[{ type:'input_text', text: String(lastUser) }]}];
        ans = await callResponses({
          apiKey: settings.apiKey,
          baseUrl,
          model: mId,
          instructions: settings.chatSystemPrompt || '',
          input,
          temperature: settings.temperature || 0.25,
          max_output_tokens: Math.min(1600, Number(settings.chatMaxOutTokens||1200))
        });
      }

      const card = document.createElement('div');
      card.className='mbRow';
      card.innerHTML = `
        <div class="mbLeft">
          <div class="mbName">${escapeHtml(mId)}</div>
          <div class="mbMeta">${escapeHtml(ans || '')}</div>
        </div>
        <div class="mbActions">
          <button class="btn ghost sm" type="button">استخدام</button>
        </div>
      `;
      card.querySelector('button')?.addEventListener('click', () => {
        // set model and close
        $('model').value = mId;
        saveSettings();
        try{ updateChatModelBtn(); }catch(_){}
        closeCompare();
      });
      body.appendChild(card);
    }catch(e){
      const err = document.createElement('div');
      err.className='hint';
      err.textContent = `فشل ${mId}: ${e?.message || e}`;
      body.appendChild(err);
    }
  }
  status.textContent='تمت المقارنة.';
}


function applyChatFocusFromStorage(){
  const on = (localStorage.getItem('chat_focus_mode') || 'false') === 'true';
  document.body.classList.toggle('focusChat', on);
}

function toggleChatFocus(){
  const on = !document.body.classList.contains('focusChat');
  document.body.classList.toggle('focusChat', on);
  localStorage.setItem('chat_focus_mode', on ? 'true' : 'false');
}



function openResearch(open){
  const m = $('researchModal');
  if (!m) return;
  m.style.display = open ? 'block' : 'none';
  m.setAttribute('aria-hidden', open ? 'false' : 'true');
  if (open){
    $('researchTopic') && ($('researchTopic').value = ($('chatInput')?.value || '').trim());
  }
}

function buildResearchPrompt(){
  const topic = ($('researchTopic')?.value || '').trim();
  const depth = $('researchDepth')?.value || 'medium';
  const needSources = !!$('researchNeedSources')?.checked;
  const makeFile = !!$('researchMakeFile')?.checked;

  const len = depth === 'long' ? 'تقرير طويل (800-1200 كلمة)' : (depth === 'short' ? 'تقرير قصير (250-400 كلمة)' : 'تقرير متوسط (500-700 كلمة)');
  const filePart = makeFile ? ('\n\nأنشئ أيضًا ملفًا للتنزيل بصيغة Markdown:\n```file name="research.md" mime="text/markdown"\n...\n```') : '';
  const srcPart = needSources ? 'مع قسم مصادر وروابط.' : 'بدون إلزام مصادر.';

  return `ابحث بحثًا تفصيليًا عن الموضوع التالي: ${topic}\n\nالمطلوب:\n- ملخص تنفيذي\n- خلفية\n- تحليل\n- نقاط رئيسية\n- توصيات\n- أسئلة مفتوحة\n\nالطول: ${len}. ${srcPart}${filePart}`;
}



// -------- Canvas Docs --------
const CANVAS_DOCS_KEY = 'canvas_docs_v1';
const CANVAS_CUR_KEY = 'canvas_cur_v1';

function loadCanvasDocs(){
  try{
    const raw = localStorage.getItem(CANVAS_DOCS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  }catch(_){}
  return [];
}
function saveCanvasDocs(arr){
  try{ localStorage.setItem(CANVAS_DOCS_KEY, JSON.stringify(arr||[])); }catch(_){}
}
function getCurCanvasId(){ return localStorage.getItem(CANVAS_CUR_KEY) || ''; }
function setCurCanvasId(id){ localStorage.setItem(CANVAS_CUR_KEY, id||''); }

function renderCanvasSelect(){
  const sel=$('canvasDocSelect'); if (!sel) return;
  const docs=loadCanvasDocs();
  const cur=getCurCanvasId();
  sel.innerHTML='';
  const o0=document.createElement('option'); o0.value=''; o0.textContent='اختر مستند...'; sel.appendChild(o0);
  docs.forEach(d=>{
    const o=document.createElement('option'); o.value=d.id; o.textContent=d.title||d.id; sel.appendChild(o);
  });
  sel.value=cur;
}

function openCanvasDoc(id){
  const docs=loadCanvasDocs();
  const doc=docs.find(d=>d.id===id) || null;
  if (!doc){
    $('canvasTitle') && ($('canvasTitle').value='');
    $('canvasEditor') && ($('canvasEditor').value='');
    setCurCanvasId('');
    renderCanvasSelect();
    return;
  }
  $('canvasTitle') && ($('canvasTitle').value=doc.title||'');
  $('canvasEditor') && ($('canvasEditor').value=doc.content||'');
  setCurCanvasId(doc.id);
  renderCanvasSelect();
  setStatus('canvasStatus', 'تم فتح المستند', false);
}

function saveCanvasDoc(){
  const title=($('canvasTitle')?.value||'').trim() || 'مستند';
  const content=$('canvasEditor')?.value || '';
  let docs=loadCanvasDocs();
  let id=getCurCanvasId();
  if (!id) id=makeId('doc');
  const now=nowTs();
  const snap={ ts: now, title, content };
  const i=docs.findIndex(d=>d.id===id);
  if (i>=0){
    const vers=Array.isArray(docs[i].versions)?docs[i].versions:[];
    vers.unshift(snap);
    docs[i]=Object.assign({}, docs[i], { title, content, updatedAt: now, versions: vers.slice(0,20) });
  } else {
    docs.unshift({ id, title, content, createdAt: now, updatedAt: now, versions:[snap] });
  }
  saveCanvasDocs(docs);
  setCurCanvasId(id);
  renderCanvasSelect();
  setStatus('canvasStatus','تم الحفظ ✅', false);
}

function openCanvasAi(open){
  const m=$('canvasAiModal'); if(!m) return;
  m.style.display=open?'block':'none';
  m.setAttribute('aria-hidden', open?'false':'true');
  if (open){ $('canvasAiStatus') && ($('canvasAiStatus').style.display='none'); }
}

function openCanvasExport(open){
  const m=$('canvasExportModal'); if(!m) return;
  m.style.display=open?'block':'none';
  m.setAttribute('aria-hidden', open?'false':'true');
}

async function runCanvasAi(){
  const editor=$('canvasEditor'); if(!editor) return;
  const action=$('canvasAiAction')?.value || 'rewrite';
  const selOnly=!!$('canvasAiSelectionOnly')?.checked;
  const notes=($('canvasAiNotes')?.value||'').trim();

  let text=editor.value||'';
  let start=0, end=0;
  if (selOnly){
    start=editor.selectionStart||0; end=editor.selectionEnd||0;
    const sel=text.slice(start,end);
    if(!sel) return alert('حدد جزءًا من النص أولاً.');
    text=sel;
  }

  const map={
    rewrite:'أعد صياغة النص ليصبح احترافيًا ومنظمًا.',
    summarize:'لخص النص في نقاط واضحة.',
    improve:'حسّن النص وأضف ما ينقصه (عناوين/نقاط) دون اختلاق حقائق.',
    translate_en:'ترجم النص إلى الإنجليزية باحتراف.',
    translate_ar:'ترجم النص إلى العربية الفصحى.'
  };
  const instr=map[action]||map.rewrite;
  const prompt = instr + (notes?('\n\nملاحظات إضافية:\n'+notes):'') + '\n\nالنص:\n' + text;

  const st=$('canvasAiStatus'); st.style.display='block'; st.textContent='جاري التنفيذ...';

  const settings=getChatSettingsOrThrow();
  const baseUrl=settings.baseUrl;
  const isOR=isOpenRouterUrl(baseUrl);
  let ans='';
  try{
    if (settings.apiMode==='responses' && !isOR){
      const input=[{ role:'user', content:[{ type:'input_text', text: prompt }] }];
      ans=await callResponses({ apiKey: settings.apiKey, baseUrl, model: settings.model, instructions:'مساعد كتابة', input, temperature:0.2, max_output_tokens: Math.min(2200, settings.chatMaxOutTokens) });
    } else {
      ans=await callChatCompletions({ apiKey: settings.apiKey, baseUrl, model: settings.model, messages:[{role:'system',content:'مساعد كتابة'},{role:'user',content:prompt}], max_tokens: Math.min(2200, settings.chatMaxOutTokens), temperature:0.2 });
    }
  }catch(e){ ans='فشل: '+(e?.message||e); }

  if (selOnly){
    const full=editor.value||'';
    editor.value=full.slice(0,start)+ans+full.slice(end);
  } else {
    editor.value=ans;
  }
  saveCanvasDoc();
  st.textContent='تم ✅';
}

function exportCanvas(kind){
  const title=($('canvasTitle')?.value||'canvas').trim() || 'canvas';
  const content=$('canvasEditor')?.value || '';
  if (kind==='txt'){
    downloadBlob(title+'.txt', new Blob([content], {type:'text/plain;charset=utf-8'}));
    return;
  }
  if (kind==='html'){
    const html='<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>'+escapeHtml(title)+'</title></head><body><pre style="white-space:pre-wrap">'+escapeHtml(content)+'</pre></body></html>';
    downloadBlob(title+'.html', new Blob([html], {type:'text/html;charset=utf-8'}));
    return;
  }
  if (kind==='docx'){
    const html='<h1>'+escapeHtml(title)+'</h1><pre style="white-space:pre-wrap">'+escapeHtml(content)+'</pre>';
    const toDocx=getHtmlToDocxFn();
    if (!toDocx){ alert('ميزة DOCX غير متاحة.'); return; }
    toDocx(html).then(blob=>downloadBlob(title+'.docx', blob)).catch(e=>alert('فشل DOCX: '+(e?.message||e)));
  }
}

function toggleCanvasFocus(){
  document.body.classList.toggle('focusChat'); // reuse focus layout to maximize space
  document.body.classList.toggle('focusCanvas');
}

function bindEvents(){

// Mode buttons
$('chatDeepBtn')?.addEventListener('click', ()=>{ setDeepMode(!isDeepMode()); updateChatModeButtons(); });
$('chatAgentBtn')?.addEventListener('click', ()=>{ setAgentMode(!isAgentMode()); updateChatModeButtons(); });
$('chatResearchBtn')?.addEventListener('click', ()=> openResearch(true));

// Research modal
$('researchCloseBtn')?.addEventListener('click', ()=> openResearch(false));
$('researchBackdrop')?.addEventListener('click', ()=> openResearch(false));
$('researchMakePromptBtn')?.addEventListener('click', ()=>{
  const p = buildResearchPrompt();
  const input = $('chatInput');
  if (input){ input.value = p; input.focus(); }
  openResearch(false);
});
$('researchSendBtn')?.addEventListener('click', ()=>{
  const p = buildResearchPrompt();
  const input = $('chatInput');
  if (input){ input.value = p; }
  openResearch(false);
  $('chatSendBtn')?.click();
});

// Canvas wiring
renderCanvasSelect();
$('canvasDocSelect')?.addEventListener('change', (e)=> openCanvasDoc(e.target.value));
$('canvasNewBtn')?.addEventListener('click', ()=>{ openCanvasDoc(''); $('canvasTitle').value=''; $('canvasEditor').value=''; });
$('canvasSaveBtn')?.addEventListener('click', saveCanvasDoc);
$('canvasAiBtn')?.addEventListener('click', ()=> openCanvasAi(true));
$('canvasAiCloseBtn')?.addEventListener('click', ()=> openCanvasAi(false));
$('canvasAiBackdrop')?.addEventListener('click', ()=> openCanvasAi(false));
$('canvasAiRunBtn')?.addEventListener('click', runCanvasAi);

$('canvasExportBtn')?.addEventListener('click', ()=> openCanvasExport(true));
$('canvasExportCloseBtn')?.addEventListener('click', ()=> openCanvasExport(false));
$('canvasExportBackdrop')?.addEventListener('click', ()=> openCanvasExport(false));
$('canvasExportTxtBtn')?.addEventListener('click', ()=> exportCanvas('txt'));
$('canvasExportHtmlBtn')?.addEventListener('click', ()=> exportCanvas('html'));
$('canvasExportDocxBtn')?.addEventListener('click', ()=> exportCanvas('docx'));

$('canvasFocusBtn')?.addEventListener('click', toggleCanvasFocus);

updateChatModeButtons();

// Projects wiring
renderProjectSelect();
try{ applyChatFocusFromStorage(); }catch(_){ }

$('projectSelect')?.addEventListener('change', (e) => {
  const pid = e.target.value;
  switchProject(pid);
});

$('projectNewBtn')?.addEventListener('click', () => {
  const name = prompt('اسم المشروع:', 'مشروع جديد');
  if (!name) return;
  const id = makeId('proj');
  const projects = loadProjects();
  projects.push({ id, name, createdAt: nowTs(), updatedAt: nowTs(), budgetUsd: 0, alertPct: 80, memorySummary: '' });
  saveProjects(projects);
  switchProject(id);
  renderProjectSelect();
});

$('projectRenameBtn')?.addEventListener('click', () => {
  const pid = getCurrentProjectId();
  if (pid === DEFAULT_PROJECT_ID) return alert('لا يمكن إعادة تسمية المشروع الافتراضي.');
  const meta = getProjectMeta(pid);
  const name = prompt('الاسم الجديد:', meta.name);
  if (!name) return;
  updateProjectMeta(pid, { name });
  renderProjectSelect();
});

$('projectDeleteBtn')?.addEventListener('click', () => {
  const pid = getCurrentProjectId();
  if (pid === DEFAULT_PROJECT_ID) return alert('لا يمكن حذف المشروع الافتراضي.');
  if (!confirm('حذف المشروع؟ سيتم حذف المسودة/الذاكرة/الاستهلاك المرتبط به.')) return;
  const projects = loadProjects().filter(p=>p.id!==pid);
  saveProjects(projects);
  try{ localStorage.removeItem(projectDraftKey(pid)); }catch(_){}
  try{ localStorage.removeItem(projectUsageKey(pid)); }catch(_){}
  try{ localStorage.removeItem(projectMemoryKey(pid)); }catch(_){}
  try{ localStorage.removeItem(projectSettingsKey(pid)); }catch(_){}
  switchProject(DEFAULT_PROJECT_ID);
  renderProjectSelect();
});

$('projectBudgetUsd')?.addEventListener('change', (e)=>{
  const pid = getCurrentProjectId();
  const v = Number(e.target.value || 0);
  updateProjectMeta(pid, { budgetUsd: v });
  updateUsageBar();
});
$('projectAlertPct')?.addEventListener('change', (e)=>{
  const pid = getCurrentProjectId();
  const v = Number(e.target.value || 80);
  updateProjectMeta(pid, { alertPct: v });
});

$('projectDashboardBtn')?.addEventListener('click', openDashboard);
$('dashCloseBtn')?.addEventListener('click', closeDashboard);
$('dashBackdrop')?.addEventListener('click', closeDashboard);

$('compareModelsBtn')?.addEventListener('click', openCompare);
$('compareCloseBtn')?.addEventListener('click', closeCompare);
$('compareBackdrop')?.addEventListener('click', closeCompare);
$('compareRunBtn')?.addEventListener('click', runCompare);

$('projectSummarizeBtn')?.addEventListener('click', async () => {
  const pid = getCurrentProjectId();
  await ensureSmartMemoryForProject('تلخيص');
  const mem = loadProjectMemory(pid);
  alert(mem ? 'تم تحديث ملخص الذاكرة.' : 'لم يتم إنشاء ملخص.');
});

$('chatFocusBtn')?.addEventListener('click', () => {
  toggleChatFocus();
});

$('promptLibrary')?.addEventListener('change', async (e) => {
  const key = e.target.value;
  if (!key) return;
  e.target.value = '';
  await insertTemplateFromLibrary(key);
});

// Chat model custom dropdown
updateChatModelBtn();
$('chatModelBtn')?.addEventListener('click', (e) => {
  e.preventDefault();
  const menu = $('chatModelMenu');
  if (!menu) return;
  if (menu.style.display === 'block') closeChatModelMenu(); else openChatModelMenu();
});
$('chatModelMenuClose')?.addEventListener('click', closeChatModelMenu);
$('chatModelMenuSearch')?.addEventListener('input', renderChatModelMenu);
document.addEventListener('click', (e) => {
  const menu = $('chatModelMenu');
  const btn = $('chatModelBtn');
  if (!menu || menu.style.display !== 'block') return;
  if (menu.contains(e.target) || (btn && btn.contains(e.target))) return;
  closeChatModelMenu();
}, true);

// Model browser (OpenRouter)
$('openModelBrowserBtn')?.addEventListener('click', openModelBrowser);
$('chatModelBrowseBtn')?.addEventListener('click', () => { closeChatModelMenu(); openModelBrowser(); });
$('mbCloseBtn')?.addEventListener('click', closeModelBrowser);
$('mbBackdrop')?.addEventListener('click', closeModelBrowser);
$('mbRefreshBtn')?.addEventListener('click', async () => {
  await ensureOpenRouterModelsLoaded({force:true});
  await renderModelBrowser();
});
['mbSearch','mbProvider','mbSort','mbVision','mbTools'].forEach(id => {
  $(id)?.addEventListener('input', renderModelBrowser);
  $(id)?.addEventListener('change', renderModelBrowser);
});

try{ updateChatModelChip(); 
try{ updateChatModelBtn(); }catch(_){ }
  try{ renderChatModelMenu(); }catch(_){ }
}catch(_){}
$('model')?.addEventListener('change', () => { try{ updateChatModelChip(); }catch(_){ } });

$('orModelsClearBtn')?.addEventListener('click', () => {
  clearOpenRouterModelsCache();
  const dl = $('orModelsDatalist'); if (dl) dl.innerHTML = '';
  const st = $('orModelsStatus');
  if (st){ st.style.display='block'; st.textContent='تم مسح كاش قائمة الموديلات.'; }
  const hi = $('orModelsHint'); if (hi) hi.style.display='none';
});

$('orModelSearch')?.addEventListener('input', (e) => {
  const cache = readOpenRouterModelsCache();
  const items = cache?.items || [];
  const filtered = filterOpenRouterItems(items, e.target.value);
  populateOpenRouterDatalist(filtered);
  const st = $('orModelsStatus');
  if (st){ st.style.display='block'; st.textContent = `نتائج: ${filtered.length}`; }
});

    updateSettingsVisibility();

    document.querySelectorAll('.tab').forEach(btn => btn.addEventListener('click', () => showTab(btn.dataset.tab)));

    $('btnSettings')?.addEventListener('click', () => openSettings(true));
    $('btnCloseSettings')?.addEventListener('click', () => openSettings(false));


// Chat side menu toggle
const sidebar = $('chatSidebar');
const backdrop = $('chatBackdrop');
const openSidebar = () => {
  if (!sidebar) return;
  sidebar.classList.remove('hidden');
  backdrop && backdrop.classList.add('show');
  try{ localStorage.setItem('chatSidebarOpen', 'true'); }catch(_){}
};
const closeSidebar = () => {
  if (!sidebar) return;
  // On desktop, hidden means hide; on mobile it's slide-out
  sidebar.classList.add('hidden');
  backdrop && backdrop.classList.remove('show');
  try{ localStorage.setItem('chatSidebarOpen', 'false'); }catch(_){}
};
$('chatMenuBtn')?.addEventListener('click', () => {
  if (!sidebar) return;
  const isHidden = sidebar.classList.contains('hidden');
  if (isHidden) openSidebar(); else closeSidebar();
});
$('chatMenuCloseBtn')?.addEventListener('click', closeSidebar);
backdrop?.addEventListener('click', closeSidebar);

// Restore sidebar state (mobile)
try{
  const st = localStorage.getItem('chatSidebarOpen');
  if (st === 'true' && window.matchMedia('(min-width: 1100px)').matches === false){
    openSidebar();
  }
}catch(_){}


    $('btnExport')?.addEventListener('click', () => openExport(true));
    $('btnCloseExport')?.addEventListener('click', () => openExport(false));

    $('kbManageBtn')?.addEventListener('click', async () => { await refreshKBUI(); openKBDrawer(true); });
    $('kbCloseBtn')?.addEventListener('click', () => openKBDrawer(false));

    $('overlay')?.addEventListener('click', () => { openSettings(false); openExport(false); openKBDrawer(false); });

    $('saveSettingsBtn')?.addEventListener('click', saveSettings);
    $('chatProvider')?.addEventListener('change', () => { toggleChatProviderUI(); });

    $('btnPickPdf')?.addEventListener('click', () => $('pdfFile')?.click());
    $('pdfFile')?.addEventListener('change', () => {
      const f = $('pdfFile')?.files?.[0];
      $('pdfName').textContent = f ? f.name : 'لم يتم اختيار ملف';
    });

    $('textInput')?.addEventListener('input', persistDraft);
    $('summaryOutput')?.addEventListener('input', persistDraft);

    $('extractPdfBtn')?.addEventListener('click', async () => {
      const file = $('pdfFile')?.files?.[0];
      if (!file) return alert('اختر ملف أولاً.');

      const ext = fileExt(file.name);
      const isPdf  = (file.type || '').includes('pdf') || ext === 'pdf';
      const isDocx = ext === 'docx' || (file.type || '').includes('wordprocessingml');

      lastSourceFile = { kind: isDocx ? 'docx' : (isPdf ? 'pdf' : ((file.type || '').startsWith('image/') ? 'img' : 'other')), name: file.name, file };

      const useOcr  = $('useOcrToggle')?.checked ?? true;
      const enhance = $('enhanceToggle')?.checked ?? true;

      let t = '';
      if (isPdf){
        t = await extractTextFromPDF(file, useOcr, enhance, 'statusBox');
      } else {
        // Multi-format extraction (DOCX/TXT/صور/…)
        t = await parseFileToText(file, 'statusBox');
      }

      $('textInput').value = t;
      updateCounts();
      persistDraft();

      await saveRecord('extraction', 'تفريغ', t, { filename:file.name, kind:lastSourceFile.kind, ocr:isPdf?useOcr:false, enhance:isPdf?enhance:false, ts: nowTs() });
      await renderHistory();

      openTab('summary');
    });

    $('aiFixBtn')?.addEventListener('click', async () => {
      try{
        const text = ($('textInput')?.value || '').trim();
        if (!text) return alert('لا يوجد نص لتصحيحه. استخرج/ألصق النص أولاً.');
        await saveRecord('extraction', 'قبل التصحيح', text, { kind: 'before_aifix' });

        const btn = $('aiFixBtn');
        btn.disabled = true;
        btn.textContent = 'جارٍ التصحيح...';

        const fixed = await aiFixOcrText(text, 'statusBox');
        $('textInput').value = fixed;
        persistDraft();

        await saveRecord('aifix', 'بعد التصحيح', fixed, { kind: 'after_aifix' });
        alert('تم تصحيح النص. يمكنك الآن التلخيص أو التصدير Word/PDF.');
      } catch(e){
        alert(e.message || String(e));
      } finally {
        setStatus('statusBox','',false);
        const btn = $('aiFixBtn');
        if (btn){ btn.disabled=false; btn.textContent='تصحيح بالذكاء'; }
      }
    });

    $('saveExtractionBtn')?.addEventListener('click', async () => {
      const text = ($('textInput')?.value || '').trim();
      if (!text) return alert('لا يوجد تفريغ لحفظه.');
      const title = prompt('عنوان التفريغ (اختياري):', 'تفريغ');
      await saveRecord('extraction', title || 'تفريغ', text, { source: $('pdfName')?.textContent || '' });
      alert('تم حفظ التفريغ في الأرشيف.');
      await renderHistory();
    });

    $('clearTextBtn')?.addEventListener('click', () => { $('textInput').value=''; persistDraft(); });

    $('summarizeBtn')?.addEventListener('click', async () => {
      try{
        const text = ($('textInput')?.value || '').trim();
        if (!text) return alert('لا يوجد نص للتلخيص. استخرج/ألصق النص أولاً.');

        const btn = $('summarizeBtn');
        btn.disabled = true;
        btn.textContent = 'جارٍ التلخيص...';

        const sum = await summarizeText(text, 'statusBox2');
        $('summaryOutput').value = sum;
        persistDraft();
        showTab('summary');
        alert('تم التلخيص بنجاح.');
      } catch(e){
        alert(e.message || String(e));
      } finally {
        setStatus('statusBox2','',false);
        const btn = $('summarizeBtn');
        if (btn){ btn.disabled=false; btn.textContent='تلخيص قوي'; }
      }
    });

    $('saveSummaryBtn')?.addEventListener('click', async () => {
      const sum = ($('summaryOutput')?.value || '').trim();
      if (!sum) return alert('لا يوجد ملخص لحفظه.');
      const title = prompt('عنوان الملخص (اختياري):', 'ملخص');
      await saveRecord('summary', title || 'ملخص', sum, { relatedTo: $('pdfName')?.textContent || '' });
      alert('تم حفظ الملخص في الأرشيف.');
      await renderHistory();
    });

    $('clearSummaryBtn')?.addEventListener('click', () => { $('summaryOutput').value=''; persistDraft(); });

    $('newChatBtn')?.addEventListener('click', () => {
      if (chatMessages.length && !confirm('بدء محادثة جديدة؟')) return;
      newChatThread();
    });

    $('clearChatBtn')?.addEventListener('click', () => {
      if (!confirm('مسح سجل الدردشة الحالي؟')) return;
      chatMessages = [];
      try{ resetSessionUsage(); }catch(_){ }
      renderChat();
      persistChatDraft();
    });


    // Chat attachments (📎)
    $('chatAttachBtn')?.addEventListener('click', () => $('chatFiles')?.click());
    $('chatFiles')?.addEventListener('change', async () => {
      try{
        const files = $('chatFiles')?.files;
        if (files && files.length) await addChatAttachments(files, 'statusBox3');
      } finally {
        try{ $('chatFiles').value = ''; }catch{}
      }
    });


    $('chatStopBtn')?.addEventListener('click', () => {
      try{ if (currentChatAbort) currentChatAbort.abort(); }catch(_){ }
    });

    $('chatRegenBtn')?.addEventListener('click', async () => {
      try{
        if (!chatMessages.length) return alert('لا توجد رسائل لإعادة التوليد.');
        const lastUser = [...chatMessages].reverse().find(x => x.role==='user' && (x.content||'').trim());
        if (!lastUser) return alert('لا توجد رسالة مستخدم لإعادة التوليد.');
        if (!currentChatId) newChatThread();
        renderChat();
        persistChatDraft();
        const btn = $('chatSendBtn');
        const stopBtn = $('chatStopBtn');
        if (btn){ btn.disabled = true; btn.textContent = '...'; }
        if (stopBtn){ stopBtn.style.display='inline-flex'; }
        const q = (isAgentMode() ? (`[وضع الوكيل]\nالمطلوب: ${lastUser.content}\n\nأعد خطة قصيرة ثم نفّذ.`) : lastUser.content);
        const ans = await sendChat(qSend, 'statusBox3');
        const aMsg2 = { role:'assistant', content: ans, ts: nowTs() };
        await createDownloadsFromAIBlocks(aMsg2);
        chatMessages.push(aMsg2);
        renderChat();
        persistChatDraft();
      } catch(e){
        alert(e.message || String(e));
      } finally {
        setStatus('statusBox3','',false);
        const btn = $('chatSendBtn');
        if (btn){ btn.disabled=false; btn.textContent='إرسال'; }
        const stopBtn = $('chatStopBtn');
        if (stopBtn){ stopBtn.style.display='none'; }
      }
    });

    
// ----- Chat toolbar: search / templates / export -----
function chatFilter(query){
  const q = String(query||'').trim().toLowerCase();
  const log = $('chatLog');
  if (!log) return;
  const bubbles = log.querySelectorAll('.bubble');
  bubbles.forEach(b => {
    const txt = (b.innerText || '').toLowerCase();
    if (!q){
      b.classList.remove('chatHidden');
      return;
    }
    if (txt.includes(q)) b.classList.remove('chatHidden');
    else b.classList.add('chatHidden');
  });
}

$('chatSearchInput')?.addEventListener('input', (e) => {
  chatFilter(e.target.value);
});
$('chatSearchClearBtn')?.addEventListener('click', () => {
  const i = $('chatSearchInput');
  if (i) i.value = '';
  chatFilter('');
});

$('promptLibrary')?.addEventListener('change', (e) => {
  const v = e.target.value;
  if (!v) return;
  const box = $('chatInput');
  if (!box) return;
  const templates = {
    report_ar: "اكتب تقريرًا احترافيًا منظمًا بالعربية مع عناوين واضحة ونقاط تنفيذية وخاتمة وتوصيات.\n\nالموضوع: ",
    email_ar: "اكتب بريدًا رسميًا بالعربية (موضوع + تحية + نص + طلب واضح + ختام).\n\nالهدف/المحتوى: ",
    policy_ar: "اكتب سياسة/إجراء داخلي بصياغة رسمية: الهدف، النطاق، التعاريف، المسؤوليات، الخطوات، الاستثناءات، المرفقات.\n\nالموضوع: ",
    cv_ar: "اكتب سيرة ذاتية ATS بالعربية + الإنجليزية: ملخص مهني، مهارات، خبرات، إنجازات رقمية، تعليم، شهادات.\n\nبياناتي: ",
    analysis_ar: "حلّل التالي بعمق وقدّم توصيات عملية وخطة تنفيذ ومخاطر وافتراضات.\n\nالنص/البيانات: ",
    json_schema: "أخرج نتيجة بصيغة JSON صالحة فقط (بدون شرح) حسب هذا المخطط:\n{\n  \"title\": \"\",\n  \"items\": []\n}\n\nالمحتوى: "
  };
  box.value = (templates[v] || '') + (box.value || '');
  e.target.value = '';
  box.focus();
});

$('chatExportTxtBtn')?.addEventListener('click', () => {
  if (!chatMessages.length) return alert('لا يوجد دردشة للتصدير.');
  const txt = chatMessages.map(m => `${m.role==='user'?'أنت':'المساعد'}: ${m.content}`).join('\n\n');
  downloadBlob(`chat_${Date.now()}.txt`, new Blob([txt], {type:'text/plain;charset=utf-8'}));
});

$('chatExportDocxBtn')?.addEventListener('click', async () => {
  if (!chatMessages.length) return alert('لا يوجد دردشة للتصدير.');
  const txt = chatMessages.map(m => `${m.role==='user'?'أنت':'المساعد'}:\n${m.content}`).join('\n\n');
  await exportDocx(`chat_${Date.now()}.docx`, 'Chat Export', txt);
});

$('chatExportPdfBtn')?.addEventListener('click', () => {
  if (!chatMessages.length) return alert('لا يوجد دردشة للتصدير.');
  const txt = chatMessages.map(m => `${m.role==='user'?'أنت':'المساعد'}: ${m.content}`).join('\n\n');
  exportPdfViaPrint('Chat Export', txt);
});

$('chatSendBtn')?.addEventListener('click', async () => {
      try{
        const q = ($('chatInput')?.value || '').trim();
        if (!q) return alert('اكتب سؤالك أولاً.');
        if (!currentChatId) newChatThread();

        chatMessages.push({ role:'user', content: q, ts: nowTs() });
        $('chatInput').value = '';
 
        const qSend = (isAgentMode() ? (`[وضع الوكيل]\nالمطلوب: ${q}\n\nاكتب خطة قصيرة ثم نفّذ.`) : q);
        renderChat();
        persistChatDraft();

        const btn = $('chatSendBtn');
        const stopBtn = $('chatStopBtn');
        btn.disabled = true;
        btn.textContent = '...';
        if (stopBtn){ stopBtn.style.display='inline-flex'; }

        const settings = getChatSettingsOrThrow();

// placeholder assistant message (for streaming)
const aMsg = { role:'assistant', content: settings.chatStreaming ? '...' : '', ts: nowTs() };
chatMessages.push(aMsg);
renderChat();
persistChatDraft();

let lastRender = 0;
const onDelta = (_d, combined) => {
  aMsg.content = combined || aMsg.content;
  const t = Date.now();
  if (t - lastRender > 220){
    renderChat();
    lastRender = t;
  }
};

let ans = '';
if (settings.chatStreaming){
  ans = await sendChatStream(qSend, 'statusBox3', onDelta);
} else {
  ans = await sendChat(qSend, 'statusBox3');
}

aMsg.content = ans || aMsg.content || '';
await createDownloadsFromAIBlocks(aMsg);
try{ recordUsageForTurn(q, aMsg.content); }catch(_){ }
renderChat();
persistChatDraft();
      } catch(e){
        alert(e.message || String(e));
      } finally {
        setStatus('statusBox3','',false);
        const btn = $('chatSendBtn');
        if (btn){ btn.disabled=false; btn.textContent='إرسال'; }
        const stopBtn = $('chatStopBtn');
        if (stopBtn){ stopBtn.style.display='none'; }
      }
    });

    $('saveChatBtn')?.addEventListener('click', async () => {
      if (!chatMessages.length) return alert('لا يوجد سجل دردشة لحفظه.');
      const title = prompt('عنوان المحادثة (اختياري):', 'محادثة');
      await saveRecord('chat', title || 'محادثة', '', { messages: chatMessages });
      alert('تم حفظ المحادثة في الأرشيف.');
      await renderHistory();
    });

    // Export sheet buttons
    $('exportTextPdfBtn')?.addEventListener('click', () => {
      openExport(false);
      const text = ($('textInput')?.value || '').trim();
      if (!text) return alert('لا يوجد تفريغ للتصدير.');
      exportPdfViaPrint('تفريغ', text);
    });
    $('exportSummaryPdfBtn')?.addEventListener('click', () => {
      openExport(false);
      const sum = ($('summaryOutput')?.value || '').trim();
      if (!sum) return alert('لا يوجد ملخص للتصدير.');
      exportPdfViaPrint('ملخص', sum);
    });
    $('exportChatPdfBtn')?.addEventListener('click', () => {
      openExport(false);
      if (!chatMessages.length) return alert('لا يوجد دردشة للتصدير.');
      const txt = chatMessages.map(m => `${m.role==='user'?'أنت':'المساعد'}: ${m.content}`).join('\n\n');
      exportPdfViaPrint('دردشة', txt);
    });
    $('exportTextDocxBtn')?.addEventListener('click', async () => {
      try{
        openExport(false);
        const text = ($('textInput')?.value || '').trim();
        if (!text) return alert('لا يوجد تفريغ للتصدير.');
        await exportDocx('extracted_text.docx', 'تفريغ', text);
        await saveRecord('export', 'تصدير Word (تفريغ)', '', { format:'docx', kind:'extraction', ts: nowTs() });
        await renderHistory();
      } catch(e){ alert(e.message || String(e)); }
    });
    $('exportSummaryDocxBtn')?.addEventListener('click', async () => {
      try{
        openExport(false);
        const sum = ($('summaryOutput')?.value || '').trim();
        if (!sum) return alert('لا يوجد ملخص للتصدير.');
        await exportDocx('summary.docx', 'ملخص', sum);
        await saveRecord('export', 'تصدير Word (ملخص)', '', { format:'docx', kind:'summary', ts: nowTs() });
        await renderHistory();
      } catch(e){ alert(e.message || String(e)); }
    });
    $('exportChatDocxBtn')?.addEventListener('click', async () => {
      try{
        openExport(false);
        if (!chatMessages.length) return alert('لا يوجد دردشة للتصدير.');
        const txt = chatMessages.map(m => `${m.role==='user'?'أنت':'المساعد'}: ${m.content}`).join('\n\n');
        await exportDocx('chat.docx', 'دردشة', txt);
        await saveRecord('export', 'تصدير Word (دردشة)', '', { format:'docx', kind:'chat', ts: nowTs() });
        await renderHistory();
      } catch(e){ alert(e.message || String(e)); }
    });


    
    $('exportTemplateDocxBtn')?.addEventListener('click', async () => {
      try{
        openExport(false);
        const src = lastSourceFile?.file || $('pdfFile')?.files?.[0] || (chatAttachments.find(a => (a.kind==='pdf' || (a.file && ((a.file.type||'').includes('pdf') || fileExt(a.file.name)==='pdf'))) )?.file);
        if (!src) return alert('اختر ملف PDF أولاً ثم نفّذ التفريغ.');
        const ext = fileExt(src.name);
        const isPdf = (src.type || '').includes('pdf') || ext === 'pdf';
        if (!isPdf) return alert('هذا الخيار متاح لملفات PDF فقط.');
        const corrected = ($('textInput')?.value || '').trim();
        await exportPdfTemplateDocxFromFile(src, corrected, 'statusBox');
        await saveRecord('export', 'تصدير Word (أوفلاين — صور)', '', { format:'docx', kind:'pdf_template_offline', filename: src.name, ts: nowTs() });
        await renderHistory();
      } catch(e){ alert(e.message || String(e)); }
    });

    $('exportCloudDocxBtn')?.addEventListener('click', async () => {
      try{
        openExport(false);
        const src = lastSourceFile?.file || $('pdfFile')?.files?.[0] || (chatAttachments.find(a => (a.kind==='pdf' || (a.file && ((a.file.type||'').includes('pdf') || fileExt(a.file.name)==='pdf'))) )?.file);
        if (!src) return alert('اختر ملف PDF أولاً.');
        const ext = fileExt(src.name);
        const isPdf = (src.type || '').includes('pdf') || ext === 'pdf';
        if (!isPdf) return alert('هذا الخيار متاح لملفات PDF فقط.');
        const r = await cloudConvertPdfToDocx(src, 'statusBox');
        await saveRecord('export', 'تصدير Word (سحابي)', '', { format:'docx', kind:'pdf_cloud', filename: src.name, url: r.url, ts: nowTs() });
        await renderHistory();
      } catch(e){ alert(e.message || String(e)); }
    });


    // History controls
    $('refreshHistoryBtn')?.addEventListener('click', renderHistory);
    $('deleteAllBtn')?.addEventListener('click', async () => {
      if (!confirm('تحذير: سيتم حذف كل البيانات المحفوظة داخل التطبيق نهائيًا. متابعة؟')) return;
      await dbClearAll(STORE);
      alert('تم حذف كل البيانات.');
      await renderHistory();
    });

    // KB ingest
    $('kbAddBtn')?.addEventListener('click', ()=> $('kbFiles')?.click());
    $('kbFiles')?.addEventListener('change', async () => {
      const files = Array.from($('kbFiles')?.files || []);
      if (!files.length) return;
      try{
        openKBDrawer(true);
        setStatus('kbStatus', `تحميل ${files.length} ملف...`, true);
        for (let i=0;i<files.length;i++){
          const f = files[i];
          setStatus('kbStatus', `معالجة: ${f.name} (${i+1}/${files.length})`, true);
          const t = await parseFileToText(f, 'kbStatus');
          await kbAddDocument({ name: f.name, type: (f.type || extOf(f.name) || 'file'), text: t });
        }
        setStatus('kbStatus', `تمت إضافة الملفات. اضغط “إعادة فهرسة” لتفعيل البحث الذكي.`, true);
        await refreshKBUI();
      } catch(e){
        alert(e.message || String(e));
        setStatus('kbStatus', 'حدث خطأ أثناء إضافة الملفات.', true);
      } finally {
        $('kbFiles').value = '';
      }
    });

    $('kbReindexBtn')?.addEventListener('click', async () => {
      try{ await kbIndexAll('kbStatus'); }
      catch(e){ alert(e.message || String(e)); setStatus('kbStatus','فشل الفهرسة.',true); }
    });

    $('kbClearBtn')?.addEventListener('click', async () => {
      if (!confirm('حذف كل ملفات قاعدة المعرفة وفهارسها؟')) return;
      await kbClearAll();
      setStatus('kbStatus', 'تم الحذف.', true);
      await refreshKBUI();
    });
  }

  // -------------------- Init --------------------
  async function init(){
    console.log(`Book Summarizer Pro v${APP_VER} loaded`);

    window.addEventListener('error', (e) => {
      console.error(e.error || e.message);
      setStatus('statusBox', `خطأ: ${e.message || 'غير معروف'}`, true);
    });
    window.addEventListener('unhandledrejection', (e) => {
      console.error(e.reason);
      setStatus('statusBox', `خطأ: ${e.reason?.message || e.reason || 'Promise error'}`, true);
    });

    loadSettings();
    restoreDraft();
    restoreChatDraft();
    try{ switchProject(getCurrentProjectId()); }catch(_){ }

    if (!currentChatId) currentChatId = makeId('chat');
    if (!Array.isArray(chatMessages)) chatMessages = [];
      try{ resetSessionUsage(); }catch(_){ }

    bindEvents();
    try{ const t = localStorage.getItem('activeTab'); if (t) showTab(t); }catch(_){ }

    try{ updateUsageBar(); }catch(_){ }
    renderChat();
    renderChatAttachments();
    await renderHistory();
    await refreshKBUI();
  }

  document.addEventListener('DOMContentLoaded', init);
})();


function geminiSourcesMarkdown(groundingMetadata){
  try{
    const esc = (s)=> String(s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
    const chunks = (groundingMetadata && (groundingMetadata.groundingChunks || groundingMetadata.grounding_chunks)) || [];
    const links = [];
    for (const ch of chunks){
      const web = (ch && ch.web) || {};
      const uri = web.uri || web.url;
      const title = web.title || uri;
      if (uri) links.push({uri, title});
    }
    const seen = new Set();
    const uniq = [];
    for (const l of links){
      if (seen.has(l.uri)) continue;
      seen.add(l.uri);
      uniq.push(l);
    }
    if (!uniq.length) return '';
    const lines = uniq.slice(0, 12).map((l,i)=> '- [' + esc(l.title || ('Source ' + (i+1))) + '](' + l.uri + ')');
    return '\n\n### المصادر\n' + lines.join('\n');
  }catch(_){}
  return '';
}


function escapeRegExp(str){ return String(str||'').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function applyChatSearch(q){
  const query = String(q||'').trim();
  const log = $('chatLog');
  if (!log) return;
  renderChat();
  if (!query) return;
  const rx = new RegExp(escapeRegExp(query), 'ig');
  const bubbles = log.querySelectorAll('.bubble');
  bubbles.forEach(b => {
    const body = b.querySelector('.md') || b.querySelector('div:nth-child(2)');
    if (!body) return;
    const text = body.innerText || '';
    if (!rx.test(text)){
      b.classList.add('chatHidden');
      rx.lastIndex = 0;
      return;
    }
    b.classList.remove('chatHidden');
    rx.lastIndex = 0;
    if (body.classList.contains('md')){
      body.innerHTML = body.innerHTML.replace(rx, (m)=>`<span class="hit">${m}</span>`);
    } else {
      body.innerHTML = escapeHtml(text).replace(rx, (m)=>`<span class="hit">${m}</span>`);
    }
  });
}


function openModelBrowser(){
  const modal = $('modelBrowserModal');
  if (!modal) return;
  modal.style.display = 'block';
  modal.setAttribute('aria-hidden','false');
  renderModelBrowser();
}
function closeModelBrowser(){
  const modal = $('modelBrowserModal');
  if (!modal) return;
  modal.style.display = 'none';
  modal.setAttribute('aria-hidden','true');
}
function formatPrice(v){
  if (v === null || v === undefined || v === '') return '—';
  const n = Number(v);
  if (Number.isFinite(n)){
    return n.toFixed(Math.abs(n) < 0.01 ? 6 : 4).replace(/0+$/,'').replace(/\.$/,'');
  }
  return String(v);
}
function pickProviders(items){
  const set = new Set();
  items.forEach(x => { if (x.provider) set.add(String(x.provider)); });
  return Array.from(set).sort((a,b)=> a.localeCompare(b));
}
function applyModelBrowserFilters(items){
  const q = String($('mbSearch')?.value || '').trim().toLowerCase();
  const provider = String($('mbProvider')?.value || '').trim();
  const wantVision = !!$('mbVision')?.checked;
  const wantTools = !!$('mbTools')?.checked;
  const sort = String($('mbSort')?.value || 'name');

  let out = items.slice();
  if (q) out = out.filter(m => String(m.id).toLowerCase().includes(q) || String(m.name||'').toLowerCase().includes(q));
  if (provider) out = out.filter(m => String(m.provider||'') === provider);
  if (wantVision) out = out.filter(m => !!m.vision);
  if (wantTools) out = out.filter(m => !!m.tools);

  const byNum = (a,b,key,dir=1) => {
    const av = Number(a[key]); const bv = Number(b[key]);
    if (!Number.isFinite(av) && !Number.isFinite(bv)) return 0;
    if (!Number.isFinite(av)) return 1;
    if (!Number.isFinite(bv)) return -1;
    return (av-bv)*dir;
  };

  if (sort==='context_desc') out.sort((a,b)=> byNum(a,b,'context_length',-1));
  else if (sort==='price_prompt_asc') out.sort((a,b)=> byNum(a,b,'pricing_prompt',1));
  else if (sort==='price_completion_asc') out.sort((a,b)=> byNum(a,b,'pricing_completion',1));
  else out.sort((a,b)=> String(a.id).localeCompare(String(b.id)));
  return out;
}

async function renderModelBrowser(){
  const status = $('mbStatus');
  const table = $('mbTable') || null;
  const list = $('mbList') || null;

  if (!table && !list) return;

  if (table) table.innerHTML = '';
  if (list && !table) list.innerHTML = '';

  if (status){ status.style.display='block'; status.textContent='جاري تحميل قائمة الموديلات...'; }

  let cache = readOpenRouterModelsCache();
  const isFresh = cache && Array.isArray(cache.items) && (Date.now() - (cache.ts||0) < 1000*60*60*24);

  try{
    if (!isFresh){
      const items = await fetchOpenRouterModels();
      writeOpenRouterModelsCache({ ts: Date.now(), items });
      cache = { ts: Date.now(), items };
      populateOpenRouterDatalist(items);
    }

    const items = cache?.items || [];
    const filtered = applyModelBrowserFilters(items);
    const fav = getFavSet();
    const cur = ($('model')?.value || '').trim();

    const provSel = $('mbProvider');
    if (provSel && provSel.options.length <= 1){
      const set = new Set();
      items.forEach(x => { if (x.provider) set.add(String(x.provider)); });
      Array.from(set).sort((a,b)=>a.localeCompare(b)).forEach(p => {
        const o = document.createElement('option'); o.value = p; o.textContent = p; provSel.appendChild(o);
      });
    }

    if (status){
      status.textContent = `الموديلات: ${items.length} • النتائج: ${filtered.length} • المفضلة: ${fav.size}`;
    }

    if (table){
      const thead = document.createElement('thead');
      thead.innerHTML = `
        <tr>
          <th style="width:48px">⭐</th>
          <th>الموديل</th>
          <th style="width:120px">Provider</th>
          <th style="width:90px">Context</th>
          <th style="width:110px">Prompt</th>
          <th style="width:120px">Completion</th>
          <th style="width:160px">ميزات</th>
          <th style="width:170px">إجراء</th>
        </tr>
      `;
      table.appendChild(thead);

      const tbody = document.createElement('tbody');
      filtered.slice(0, 260).forEach(m => {
        const tr = document.createElement('tr');

        const starTd = document.createElement('td');
        const star = document.createElement('span');
        star.className = 'mbStar' + (fav.has(m.id) ? ' on' : '');
        star.textContent = fav.has(m.id) ? '★' : '☆';
        star.title = fav.has(m.id) ? 'إزالة من المفضلة' : 'إضافة للمفضلة';
        star.onclick = (e) => {
          e.stopPropagation();
          const set = toggleFavorite(m.id);
          star.className = 'mbStar' + (set.has(m.id) ? ' on' : '');
          star.textContent = set.has(m.id) ? '★' : '☆';
          updateChatModelDropdown();
        };
        starTd.appendChild(star);

        const nameTd = document.createElement('td');
        nameTd.innerHTML = `<div class="mbId">${escapeHtml(m.id)}</div><div class="mbSmall">${escapeHtml(m.name || '')}</div>`;

        const provTd = document.createElement('td');
        provTd.textContent = m.provider || '—';

        const ctxTd = document.createElement('td');
        ctxTd.textContent = (m.context_length ?? '—');

        const ppTd = document.createElement('td');
        ppTd.textContent = formatPrice(m.pricing_prompt);

        const pcTd = document.createElement('td');
        pcTd.textContent = formatPrice(m.pricing_completion);

        const featsTd = document.createElement('td');
        let fhtml = '';
        if (m.vision) fhtml += '<span class="mbKbd">Vision</span>';
        if (m.tools) fhtml += '<span class="mbKbd">Tools</span>';
        if (m.modality) fhtml += `<span class="mbKbd">${escapeHtml(String(m.modality))}</span>`;
        featsTd.innerHTML = fhtml || '—';

        const actTd = document.createElement('td');
        const pick = document.createElement('button');
        pick.type = 'button';
        pick.className = 'btn primary sm';
        pick.textContent = (cur === m.id) ? 'مُختار' : 'اختيار';
        pick.disabled = (cur === m.id);
        pick.onclick = () => {
          const mi = $('model');
          if (mi){
            mi.value = m.id;
            saveSettings();
            updateChatModelChip();
            updateChatModelDropdown();
            addRecentModel(m.id);
            closeModelBrowser();
          }
        };

        const view = document.createElement('a');
        view.href = `https://openrouter.ai/models/${encodeURIComponent(m.id)}`;
        view.target = '_blank';
        view.rel = 'noopener';
        view.className = 'btn ghost sm';
        view.textContent = 'عرض';

        actTd.appendChild(pick);
        actTd.appendChild(view);

        tr.appendChild(starTd);
        tr.appendChild(nameTd);
        tr.appendChild(provTd);
        tr.appendChild(ctxTd);
        tr.appendChild(ppTd);
        tr.appendChild(pcTd);
        tr.appendChild(featsTd);
        tr.appendChild(actTd);

        tbody.appendChild(tr);
      });

      table.appendChild(tbody);

      if (filtered.length > 260){
        const more = document.createElement('div');
        more.className = 'hint';
        more.textContent = 'تم عرض أول 260 نتيجة فقط. استخدم البحث/الفلاتر لتقليل النتائج.';
        table.parentElement?.appendChild(more);
      }
      return;
    }

    // fallback list
    if (list){
      filtered.slice(0, 220).forEach(m => {
        const row = document.createElement('div');
        row.className = 'mbRow';
        row.innerHTML = `<div class="mbName">${escapeHtml(m.id)}</div>`;
        list.appendChild(row);
      });
    }

  }catch(e){
    if (status){ status.textContent = '❌ ' + (e?.message || e); }
  }
}

function updateChatModelChip(){
  const baseUrl = ($('baseUrl')?.value || '').trim();
  const model = ($('model')?.value || '').trim();
  const pfx = isOpenRouterUrl(baseUrl) ? 'OR' : 'AI';

  const el = $('chatModelText');
  if (el){
    el.textContent = `${pfx}: ${model || '—'}`;
  }

  try{ updateChatModelBtn(); }catch(_){ }
  try{ renderChatModelMenu(); }catch(_){ }
}




function updateChatModelDropdown(){
  const sel = $('chatModelSelect');
  if (!sel) return;

  const makeOpt = (value, label, disabled=false) => {
    const o = document.createElement('option');
    o.value = value;
    o.textContent = label;
    o.disabled = !!disabled;
    return o;
  };

  try{
    const baseUrl = ($('baseUrl')?.value || '').trim();
    const isOR = isOpenRouterUrl(baseUrl);
    const current = ($('model')?.value || '').trim();

    sel.innerHTML = '';

    // Always show current + browse
    const curLabel = isOR ? `OR: ${current || '—'}` : (current ? `AI: ${current}` : 'AI: —');
    sel.appendChild(makeOpt(current || '', curLabel));

    if (isOR){
      // favorites + recents + short list (best-effort)
      let fav = [];
      try{ fav = Array.from(getFavSet()); }catch(_){ fav = []; }
      if (fav.length){
        sel.appendChild(makeOpt('__sep1__','— المفضلة —', true));
        fav.forEach(id => { if (id) sel.appendChild(makeOpt(id, `⭐ ${id}`)); });
      }

      let recent = [];
      try{ recent = getRecentModels(); }catch(_){ recent = []; }
      if (recent.length){
        sel.appendChild(makeOpt('__sep2__','— الأخيرة —', true));
        recent.forEach(id => { if (id) sel.appendChild(makeOpt(id, `🕘 ${id}`)); });
      }

      let all = [];
      try{
        const cache = readOpenRouterModelsCache();
        all = Array.isArray(cache?.items) ? cache.items : [];
      }catch(_){ all = []; }

      if (all.length){
        sel.appendChild(makeOpt('__sep3__','— قائمة مختصرة —', true));
        all.slice(0, 40).forEach(m => {
          const id = m.id || m.name;
          if (id) sel.appendChild(makeOpt(id, id));
        });
      }
    }

    sel.appendChild(makeOpt('__browse__', '🔎 استعراض كل الموديلات…'));

    // Keep selection on current (if present)
    sel.value = current || '';

  }catch(e){
    // Fallback: still keep it usable
    const baseUrl = ($('baseUrl')?.value || '').trim();
    const isOR = isOpenRouterUrl(baseUrl);
    const current = ($('model')?.value || '').trim();
    sel.innerHTML = '';
    sel.appendChild(makeOpt(current || '', isOR ? `OR: ${current || '—'}` : (current ? `AI: ${current}` : 'AI: —')));
    sel.appendChild(makeOpt('__browse__', '🔎 استعراض كل الموديلات…'));
    sel.value = current || '';
    console.warn('updateChatModelDropdown fallback', e);
  }
}



