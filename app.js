/* AI Workspace Studio v1 - no build step */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);

  // ---------------- Storage ----------------
  const KEYS = {
    settings: 'aistudio_settings_v1',
    projects: 'aistudio_projects_v1',
    curProject: 'aistudio_cur_project_v1',
    threads: (pid) => `aistudio_threads_${pid}_v1`,
    curThread: (pid) => `aistudio_cur_thread_${pid}_v1`,
    files: (pid) => `aistudio_files_${pid}_v1`,
    canvas: (pid) => `aistudio_canvas_${pid}_v1`,
    downloads: 'aistudio_downloads_v1',
    modeDeep: 'aistudio_mode_deep_v1',
    modeAgent: 'aistudio_mode_agent_v1',
    webToggle: 'aistudio_webtoggle_v1'
  };

  const nowTs = () => Date.now();
  const makeId = (p='id') => `${p}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;

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
    webMode: 'off',
    fileClip: 12000
  };

  function getSettings(){
    return { ...DEFAULT_SETTINGS, ...(loadJSON(KEYS.settings, {}) || {}) };
  }
  function setSettings(patch){
    const s = { ...getSettings(), ...(patch||{}) };
    saveJSON(KEYS.settings, s);
    return s;
  }

  // ---------------- UI helpers ----------------
  function showStatus(msg, isBusy=false){
    const el = $('statusBox');
    if (!el) return;
    if (!msg){
      el.style.display = 'none';
      el.textContent = '';
      return;
    }
    el.style.display = 'block';
    el.textContent = msg;
    el.dataset.busy = isBusy ? '1' : '0';
  }

  function toast(msg){
    showStatus(msg, false);
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { showStatus('', false); }, 1600);
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
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      ta.style.left = '-1000px';
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
    try{
      if (window.marked) return window.marked.parse(String(s||''));
    }catch(_){}
    return `<pre style="white-space:pre-wrap">${escapeHtml(s||'')}</pre>`;
  }

  // ---------------- Modes ----------------
  const isDeep = () => (localStorage.getItem(KEYS.modeDeep) || 'false') === 'true';
  const isAgent = () => (localStorage.getItem(KEYS.modeAgent) || 'false') === 'true';
  const setDeep = (v) => localStorage.setItem(KEYS.modeDeep, v ? 'true' : 'false');
  const setAgent = (v) => localStorage.setItem(KEYS.modeAgent, v ? 'true' : 'false');
  const getWebToggle = () => (localStorage.getItem(KEYS.webToggle) || 'false') === 'true';
  const setWebToggle = (v) => localStorage.setItem(KEYS.webToggle, v ? 'true' : 'false');

  function refreshModeButtons(){
    $('modeDeepBtn')?.classList.toggle('dark', isDeep());
    $('modeAgentBtn')?.classList.toggle('dark', isAgent());
    $('webToggleBtn')?.classList.toggle('dark', getWebToggle());
  }

  function disableModes(){
    setDeep(false);
    setAgent(false);
    setWebToggle(false);
    refreshModeButtons();
    toast('⛔ تم إيقاف الأوضاع');
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

  function getCurProjectId(){
    return localStorage.getItem(KEYS.curProject) || 'default';
  }
  function setCurProjectId(pid){ localStorage.setItem(KEYS.curProject, pid); }

  function getCurProject(){
    const pid = getCurProjectId();
    return loadProjects().find(p => p.id === pid) || loadProjects()[0];
  }

  function loadThreads(pid){
    const arr = loadJSON(KEYS.threads(pid), null);
    if (Array.isArray(arr) && arr.length) return arr;
    const t = [{ id: makeId('thr'), title:'محادثة', createdAt: nowTs(), updatedAt: nowTs(), messages: [] }];
    saveJSON(KEYS.threads(pid), t);
    localStorage.setItem(KEYS.curThread(pid), t[0].id);
    return t;
  }
  function saveThreads(pid, arr){ saveJSON(KEYS.threads(pid), arr); }

  function getCurThreadId(pid){
    return localStorage.getItem(KEYS.curThread(pid)) || (loadThreads(pid)[0]?.id);
  }
  function setCurThreadId(pid, tid){
    localStorage.setItem(KEYS.curThread(pid), tid);
  }

  function getCurThread(){
    const pid = getCurProjectId();
    const tid = getCurThreadId(pid);
    const th = loadThreads(pid).find(t => t.id === tid) || loadThreads(pid)[0];
    return th;
  }

  function newThread(){
    const pid = getCurProjectId();
    const arr = loadThreads(pid);
    const t = { id: makeId('thr'), title:'محادثة جديدة', createdAt: nowTs(), updatedAt: nowTs(), messages: [] };
    arr.unshift(t);
    saveThreads(pid, arr);
    setCurThreadId(pid, t.id);
    renderChat();
    refreshNavMeta();
    toast('✅ تم إنشاء محادثة جديدة');
  }

  // ---------------- Files ----------------
  function loadFiles(pid){
    return loadJSON(KEYS.files(pid), []) || [];
  }
  function saveFiles(pid, arr){ saveJSON(KEYS.files(pid), arr); }

  async function fileToDataUrl(file){
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ''));
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  async function fileToText(file){
    // Minimal: text-like files only. PDF/DOCX parsing can be added later as a module.
    const name = (file?.name || '').toLowerCase();
    if (name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.csv') || name.endsWith('.json') || name.endsWith('.xml') || name.endsWith('.html') || name.endsWith('.htm')){
      return await file.text();
    }
    // Images: no OCR here (handled via vision models in chat if supported)
    return '';
  }

  // ---------------- Downloads from ```file blocks ----------------
  function loadDownloads(){ return loadJSON(KEYS.downloads, []) || []; }
  function saveDownloads(arr){ saveJSON(KEYS.downloads, arr); }

  function downloadBlob(filename, blob){
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
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
      dl.unshift({ id: makeId('dl'), name: b.name, mime: b.mime, encoding: b.encoding, content: b.content, createdAt: nowTs() });
    }
    saveDownloads(dl.slice(0, 80));
    return blocks.length;
  }

  // ---------------- Providers ----------------
  async function callOpenAIChat({ apiKey, baseUrl, model, messages, max_tokens, signal }){
    const url = baseUrl.replace(/\/+$/,'') + '/chat/completions';
    const body = {
      model,
      messages,
      max_tokens,
      temperature: 0.25
    };
    const r = await fetch(url, {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body),
      signal
    });
    const t = await r.text();
    let j;
    try{ j = JSON.parse(t); }catch(_){ j = null; }
    if (!r.ok){
      throw new Error((j?.error?.message) || t || `HTTP ${r.status}`);
    }
    return j?.choices?.[0]?.message?.content || '';
  }

  async function callGemini({ apiKey, model, prompt, signal }){
    // Minimal: text only
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const body = {
      contents: [{ role:'user', parts:[{ text: prompt }] }],
      generationConfig: { temperature: 0.25, maxOutputTokens: 2048 }
    };
    const r = await fetch(url, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify(body),
      signal
    });
    const t = await r.text();
    let j;
    try{ j = JSON.parse(t); }catch(_){ j = null; }
    if (!r.ok){
      throw new Error(j?.error?.message || t || `HTTP ${r.status}`);
    }
    const parts = j?.candidates?.[0]?.content?.parts || [];
    return parts.map(p => p?.text || '').join('');
  }

  function buildSystemPrompt(settings){
    let sys = settings.systemPrompt || 'أنت مساعد احترافي. أجب بدقة وبأسلوب منظم.';
    if (isDeep()){
      sys += '\n\n[وضع التفكير العميق] التزم بالبنية: (1) ملخص سريع (2) شرح مفصل (3) خطوات/أمثلة (4) مخاطر/تحقق (5) خلاصة.';
    }
    if (isAgent()){
      sys += '\n\n[وضع الوكيل] ابدأ بـ "الخطة:" (3-6 خطوات مرقمة) ثم "التنفيذ:" ثم "النتيجة النهائية:". إذا استخدمت الويب اذكر "المصادر:" بروابط.';
    }
    return sys;
  }

  function maybeOnlineModel(model, settings){
    if (settings.webMode === 'openrouter_online' && getWebToggle()){
      if (!String(model).includes(':online')) return String(model) + ':online';
    }
    return model;
  }

  function buildMessagesForChat(userText, settings, filesText){
    const sys = buildSystemPrompt(settings);
    const msgs = [{ role:'system', content: sys }];
    const thread = getCurThread();
    // keep last N messages
    const tail = (thread.messages || []).slice(-14);
    for (const m of tail){
      if (!m?.role || !m?.content) continue;
      msgs.push({ role: m.role, content: m.content });
    }
    if (filesText && filesText.trim()){
      const clip = filesText.length > Number(settings.fileClip || 12000) ? (filesText.slice(0,6000) + '\n\n...\n\n' + filesText.slice(-6000)) : filesText;
      msgs.push({ role:'system', content: `سياق من ملفات المستخدم:\n${clip}` });
    }
    msgs.push({ role:'user', content: String(userText||'') });
    return msgs;
  }

  // ---------------- Chat rendering ----------------
  let abortCtl = null;

  function renderChat(){
    const log = $('chatLog');
    if (!log) return;
    const thread = getCurThread();
    const msgs = thread.messages || [];
    log.innerHTML = '';

    msgs.forEach((m) => {
      const b = document.createElement('div');
      b.className = 'bubble ' + (m.role === 'user' ? 'user' : 'assistant');
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.textContent = (m.role === 'user' ? 'USER' : 'ASSISTANT') + ' • ' + new Date(m.ts || nowTs()).toLocaleString('ar');
      const body = document.createElement('div');
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
        const dlCount = ingestDownloadsFromText(m.content || '');
        if (dlCount){
          const info = document.createElement('span');
          info.className = 'hint';
          info.textContent = `📄 تم اكتشاف ${dlCount} ملف(ات) — راجع التحميلات`;
          actions.appendChild(info);
          refreshNavMeta();
        }
      }

      b.appendChild(meta);
      b.appendChild(body);
      b.appendChild(actions);
      log.appendChild(b);
    });

    // scroll to bottom
    log.scrollTop = log.scrollHeight + 1000;
    refreshNavMeta();
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
  }

  async function sendMessage(){
    const input = $('chatInput');
    if (!input) return;
    const text = (input.value || '').trim();
    if (!text) return;

    const settings = getSettings();
    if (settings.provider !== 'gemini' && !settings.apiKey){
      toast('⚠️ ضع API Key في الإعدادات.');
      return;
    }
    if (settings.provider === 'gemini' && !settings.geminiKey){
      toast('⚠️ ضع Gemini API Key في الإعدادات.');
      return;
    }

    // store user message
    const pid = getCurProjectId();
    const tid = getCurThreadId(pid);
    const threads = loadThreads(pid);
    const idx = threads.findIndex(t => t.id === tid);
    const thread = threads[idx] || threads[0];
    thread.messages = thread.messages || [];
    thread.messages.push({ role:'user', content: text, ts: nowTs() });
    thread.updatedAt = nowTs();
    threads[idx] = thread;
    saveThreads(pid, threads);
    input.value = '';
    renderChat();

    // prepare context
    const filesText = String($('filesText')?.value || '');
    const messages = buildMessagesForChat(text, settings, filesText);

    // call provider
    showStatus('جاري التوليد…', true);
    $('stopBtn').style.display = 'inline-flex';
    abortCtl?.abort?.();
    abortCtl = new AbortController();

    let model = settings.model;
    if (settings.provider === 'openrouter'){
      model = maybeOnlineModel(model, settings);
    }

    try{
      let ans = '';
      if (settings.provider === 'gemini'){
        const prompt = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
        ans = await callGemini({ apiKey: settings.geminiKey, model: settings.model, prompt, signal: abortCtl.signal });
      } else {
        const baseUrl = settings.baseUrl || (settings.provider === 'openrouter' ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1');
        ans = await callOpenAIChat({ apiKey: settings.apiKey, baseUrl, model, messages, max_tokens: Number(settings.maxOut || 2000), signal: abortCtl.signal });
      }

      // Agent mode: enforce simple structure if model ignored
      if (isAgent() && ans && !/الخطة:|plan:/i.test(ans)){
        ans = `الخطة:\n1) تحليل\n2) تنفيذ\n3) نتيجة\n\nالتنفيذ:\n${ans}\n\nالنتيجة النهائية:\n—`;
      }

      // store assistant
      const threads2 = loadThreads(pid);
      const idx2 = threads2.findIndex(t => t.id === tid);
      const thread2 = threads2[idx2] || threads2[0];
      thread2.messages = thread2.messages || [];
      thread2.messages.push({ role:'assistant', content: ans, ts: nowTs() });
      thread2.updatedAt = nowTs();
      threads2[idx2] = thread2;
      saveThreads(pid, threads2);

      showStatus('', false);
      $('stopBtn').style.display = 'none';
      renderChat();
      toast('✅ تم');
    }catch(e){
      showStatus(`❌ خطأ:\n${e?.message || e}`, false);
      $('stopBtn').style.display = 'none';
    }
  }

  function stopGeneration(){
    abortCtl?.abort?.();
    $('stopBtn').style.display = 'none';
    showStatus('⛔ تم إيقاف التوليد', false);
  }

  function regenLast(){
    const th = getCurThread();
    const lastUser = [...(th.messages||[])].reverse().find(m => m.role === 'user');
    if (!lastUser) return;
    $('chatInput').value = lastUser.content || '';
    sendMessage();
  }

  // ---------------- Canvas ----------------
  function loadCanvas(pid){
    const arr = loadJSON(KEYS.canvas(pid), []) || [];
    return Array.isArray(arr) ? arr : [];
  }
  function saveCanvas(pid, arr){ saveJSON(KEYS.canvas(pid), arr); }

  function curCanvasId(pid){
    return localStorage.getItem(`aistudio_canvas_cur_${pid}`) || '';
  }
  function setCurCanvasId(pid, id){
    localStorage.setItem(`aistudio_canvas_cur_${pid}`, id || '');
  }

  function renderCanvasList(){
    const pid = getCurProjectId();
    const sel = $('canvasDoc');
    if (!sel) return;
    const docs = loadCanvas(pid);
    const cur = curCanvasId(pid);
    sel.innerHTML = '';
    const o0 = document.createElement('option');
    o0.value = '';
    o0.textContent = 'اختر مستند...';
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
      $('canvasTitle').value = '';
      $('canvasEditor').value = '';
      setCurCanvasId(pid, '');
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
    const title = ($('canvasTitle').value || '').trim() || 'مستند';
    const content = $('canvasEditor').value || '';
    let docs = loadCanvas(pid);
    let id = curCanvasId(pid);
    if (!id) id = makeId('doc');
    const now = nowTs();
    const idx = docs.findIndex(d => d.id === id);
    if (idx >= 0){
      docs[idx] = { ...docs[idx], title, content, updatedAt: now };
    } else {
      docs.unshift({ id, title, content, createdAt: now, updatedAt: now });
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
    if (settings.provider !== 'gemini' && !settings.apiKey){
      toast('⚠️ ضع API Key في الإعدادات.');
      return;
    }
    const raw = $('canvasEditor').value || '';
    if (!raw.trim()) return;

    let instr = '';
    if (action === 'rewrite') instr = 'أعد صياغة النص ليصبح احترافيًا ومنظمًا.';
    if (action === 'summarize') instr = 'لخص النص في نقاط واضحة.';
    if (action === 'improve') instr = 'حسّن النص وأضف ما ينقصه دون اختلاق حقائق.';
    if (action === 'build_app_html') instr = 'أنشئ تطبيق ويب HTML كامل في ملف واحد (CSS+JS داخل نفس الملف). أعد الناتج HTML فقط دون شرح.';

    const sys = buildSystemPrompt(settings);
    const prompt = `${sys}\n\n${instr}\n\nالنص:\n${raw}`;

    showStatus('جاري تنفيذ كانفس…', true);
    abortCtl?.abort?.();
    abortCtl = new AbortController();

    try{
      let out = '';
      if (settings.provider === 'gemini'){
        out = await callGemini({ apiKey: settings.geminiKey, model: settings.model, prompt, signal: abortCtl.signal });
      } else {
        const baseUrl = settings.baseUrl || (settings.provider === 'openrouter' ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1');
        const messages = [{ role:'system', content: sys }, { role:'user', content: `${instr}\n\n${raw}` }];
        out = await callOpenAIChat({ apiKey: settings.apiKey, baseUrl, model: maybeOnlineModel(settings.model, settings), messages, max_tokens: Math.min(2200, Number(settings.maxOut||2000)), signal: abortCtl.signal });
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
      div.style.border = '1px solid rgba(10,20,60,0.10)';
      div.style.borderRadius = '14px';
      div.style.padding = '10px';
      div.style.marginBottom = '10px';
      div.style.background = '#fff';
      div.innerHTML = `<div style="font-weight:1000">${escapeHtml(f.name)}</div>
                       <div class="hint">${escapeHtml(f.kind)} • ${Math.round((f.size||0)/1024)}KB</div>`;
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.gap = '8px';
      row.style.flexWrap = 'wrap';
      row.style.marginTop = '10px';

      const btnUse = document.createElement('button');
      btnUse.className = 'btn ghost sm';
      btnUse.textContent = 'إضافة للنص';
      btnUse.addEventListener('click', () => {
        const cur = $('filesText').value || '';
        $('filesText').value = (cur ? (cur + '\n\n') : '') + (f.text || '');
        toast('✅ أُضيف النص');
      });

      const btnCopy = document.createElement('button');
      btnCopy.className = 'btn ghost sm';
      btnCopy.textContent = 'نسخ';
      btnCopy.addEventListener('click', async () => {
        const ok = await copyToClipboard(f.text || f.name);
        toast(ok ? '✅ تم النسخ' : '⚠️ تعذر النسخ');
      });

      const btnDel = document.createElement('button');
      btnDel.className = 'btn danger sm';
      btnDel.textContent = 'حذف';
      btnDel.addEventListener('click', () => {
        const arr = loadFiles(pid).filter(x => x.id !== f.id);
        saveFiles(pid, arr);
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
    saveFiles(pid, arr.slice(0, 50));
    renderFiles();
    refreshNavMeta();
    toast('✅ تم إضافة الملفات');
  }

  // ---------------- Downloads page ----------------
  function renderDownloads(){
    const box = $('downloadsList');
    const dl = loadDownloads();
    $('navDlMeta').textContent = String(dl.length);
    box.innerHTML = '';
    dl.forEach(d => {
      const row = document.createElement('div');
      row.className = 'bubble';
      row.innerHTML = `<div style="font-weight:1000">${escapeHtml(d.name)}</div>
                       <div class="hint">${escapeHtml(d.mime)} • ${new Date(d.createdAt||nowTs()).toLocaleString('ar')}</div>`;
      const actions = document.createElement('div');
      actions.className = 'actions';

      const b1 = document.createElement('button');
      b1.className = 'btn sm';
      b1.textContent = 'تنزيل';
      b1.addEventListener('click', () => {
        if (d.encoding === 'base64'){
          // binary
          const bin = atob(d.content || '');
          const bytes = new Uint8Array(bin.length);
          for (let i=0;i<bin.length;i++) bytes[i] = bin.charCodeAt(i);
          downloadBlob(d.name, new Blob([bytes], { type: d.mime }));
        } else {
          downloadBlob(d.name, new Blob([String(d.content||'')], { type: d.mime + ';charset=utf-8' }));
        }
      });

      const b2 = document.createElement('button');
      b2.className = 'btn ghost sm';
      b2.textContent = 'نسخ المحتوى';
      b2.addEventListener('click', async () => {
        const ok = await copyToClipboard(d.content || '');
        toast(ok ? '✅ تم النسخ' : '⚠️ تعذر النسخ');
      });

      const b3 = document.createElement('button');
      b3.className = 'btn danger sm';
      b3.textContent = 'حذف';
      b3.addEventListener('click', () => {
        const arr = loadDownloads().filter(x => x.id !== d.id);
        saveDownloads(arr);
        renderDownloads();
        refreshNavMeta();
      });

      actions.appendChild(b1);
      actions.appendChild(b2);
      actions.appendChild(b3);
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
      actions.className = 'actions';
      const btn = document.createElement('button');
      btn.className = 'btn ghost sm';
      btn.textContent = 'فتح';
      btn.addEventListener('click', () => {
        setCurProjectId(p.id);
        $('curProjectName').textContent = p.name;
        // ensure threads/files/canvas exist
        loadThreads(p.id);
        renderCanvasList();
        renderFiles();
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
    renderProjects();
    renderFiles();
    renderCanvasList();
    renderChat();
    refreshNavMeta();
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
    const arr = loadProjects().filter(x => x.id !== cur.id);
    saveProjects(arr);
    // cleanup
    try{ localStorage.removeItem(KEYS.threads(cur.id)); }catch(_){}
    try{ localStorage.removeItem(KEYS.files(cur.id)); }catch(_){}
    try{ localStorage.removeItem(KEYS.canvas(cur.id)); }catch(_){}
    try{ localStorage.removeItem(KEYS.curThread(cur.id)); }catch(_){}
    try{ localStorage.removeItem(`aistudio_canvas_cur_${cur.id}`); }catch(_){}
    setCurProjectId('default');
    $('curProjectName').textContent = 'افتراضي';
    loadThreads('default');
    renderProjects();
    renderFiles();
    renderCanvasList();
    renderChat();
    refreshNavMeta();
    toast('✅ تم حذف المشروع');
  }

  // ---------------- Settings UI ----------------
  function renderSettings(){
    const s = getSettings();
    $('provider').value = s.provider;
    $('baseUrl').value = s.baseUrl;
    $('model').value = s.model;
    $('apiKey').value = s.apiKey || '';
    $('geminiKey').value = s.geminiKey || '';
    $('systemPrompt').value = s.systemPrompt || '';
    $('maxOut').value = String(s.maxOut || 2000);
    $('fileClip').value = String(s.fileClip || 12000);
    $('webMode').value = s.webMode || 'off';
    refreshModeButtons();
  }

  function saveSettingsFromUI(){
    const s = setSettings({
      provider: $('provider').value,
      baseUrl: $('baseUrl').value.trim(),
      model: $('model').value.trim(),
      apiKey: $('apiKey').value.trim(),
      geminiKey: $('geminiKey').value.trim(),
      systemPrompt: $('systemPrompt').value,
      maxOut: Number($('maxOut').value || 2000),
      webMode: $('webMode').value,
      fileClip: Number($('fileClip').value || 12000)
    });
    toast('✅ تم حفظ الإعدادات');
    return s;
  }

  // ---------------- Navigation ----------------
  function setActiveNav(page){
    document.querySelectorAll('.navbtn').forEach(b => b.classList.toggle('active', b.dataset.page === page));
    document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === `page-${page}`));
    const titles = {
      chat:'الدردشة',
      canvas:'كانفس',
      files:'الملفات',
      downloads:'التحميلات',
      projects:'المشاريع',
      settings:'الإعدادات'
    };
    $('topTitle').textContent = titles[page] || 'AI Studio';
    document.body.dataset.page = page;
  }

  function refreshNavMeta(){
    const pid = getCurProjectId();
    const threads = loadThreads(pid);
    const th = getCurThread();
    $('navChatMeta').textContent = String((th.messages||[]).length);
    $('navCanvasMeta').textContent = String(loadCanvas(pid).length);
    $('navFilesMeta').textContent = String(loadFiles(pid).length);
    $('navDlMeta').textContent = String(loadDownloads().length);
    $('navProjMeta').textContent = String(loadProjects().length);
    $('navSetMeta').textContent = 'OK';
  }

  // ---------------- Model list modal (shortlist) ----------------
  const MODEL_SHORTLIST = [
    'openai/gpt-4o-mini',
    'openai/gpt-4.1-mini',
    'openai/gpt-4.1',
    'anthropic/claude-3.7-sonnet',
    'google/gemini-2.5-flash',
    'google/gemini-2.5-pro',
    'deepseek/deepseek-r1',
    'qwen/qwen-2.5-72b-instruct',
    'meta-llama/llama-3.1-70b-instruct'
  ];

  function openModelModal(open){
    $('modelModal').style.display = open ? 'block' : 'none';
    if (open) renderModelList('');
  }

  function renderModelList(q){
    const box = $('modelList');
    const s = String(q||'').trim().toLowerCase();
    box.innerHTML = '';
    MODEL_SHORTLIST.filter(m => !s || m.toLowerCase().includes(s)).forEach(m => {
      const row = document.createElement('div');
      row.className = 'bubble';
      row.innerHTML = `<div style="font-weight:1000">${escapeHtml(m)}</div>
                       <div class="actions"><button class="btn ghost sm" type="button">اختيار</button></div>`;
      row.querySelector('button').addEventListener('click', () => {
        $('model').value = m;
        saveSettingsFromUI();
        openModelModal(false);
      });
      box.appendChild(row);
    });
  }

  // ---------------- Events ----------------
  function bind(){
    // sidebar mobile
    const side = $('side');
    const back = $('backdrop');
    const openSide = () => { side.classList.add('show'); back.classList.add('show'); };
    const closeSide = () => { side.classList.remove('show'); back.classList.remove('show'); };
    $('openSideBtn').addEventListener('click', openSide);
    $('closeSideBtn').addEventListener('click', closeSide);
    back.addEventListener('click', closeSide);

    // nav
    $('nav').addEventListener('click', (e) => {
      const btn = e.target.closest('.navbtn');
      if (!btn) return;
      setActiveNav(btn.dataset.page);
      closeSide();
      // page-specific refresh
      if (btn.dataset.page === 'downloads') renderDownloads();
      if (btn.dataset.page === 'projects') renderProjects();
      if (btn.dataset.page === 'settings') renderSettings();
      if (btn.dataset.page === 'files') renderFiles();
      if (btn.dataset.page === 'canvas') { renderCanvasList(); refreshCanvasPreview(); }
      if (btn.dataset.page === 'chat') { renderChat(); updateChips(); }
    });

    // modes
    $('modeDeepBtn').addEventListener('click', () => { setDeep(!isDeep()); refreshModeButtons(); toast(isDeep() ? '🧠 مفعّل' : '🧠 متوقف'); });
    $('modeAgentBtn').addEventListener('click', () => { setAgent(!isAgent()); refreshModeButtons(); toast(isAgent() ? '🤖 مفعّل' : '🤖 متوقف'); });
    $('modeOffBtn').addEventListener('click', disableModes);
    $('webToggleBtn').addEventListener('click', () => { setWebToggle(!getWebToggle()); refreshModeButtons(); toast(getWebToggle() ? '🔎 Web ON' : '🔎 Web OFF'); });

    $('newThreadBtn').addEventListener('click', () => { newThread(); setActiveNav('chat'); });

    // chat
    $('sendBtn').addEventListener('click', sendMessage);
    $('stopBtn').addEventListener('click', stopGeneration);
    $('regenBtn').addEventListener('click', regenLast);
    $('chatInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey){
        e.preventDefault();
        sendMessage();
      }
    });

    // model modal
    $('pickModelBtn').addEventListener('click', () => openModelModal(true));
    $('modelModalClose').addEventListener('click', () => openModelModal(false));
    $('modelModalBackdrop').addEventListener('click', () => openModelModal(false));
    $('modelSearch').addEventListener('input', (e) => renderModelList(e.target.value));

    // canvas
    $('canvasDoc').addEventListener('change', (e) => openCanvasDoc(e.target.value));
    $('canvasNewBtn').addEventListener('click', () => openCanvasDoc(''));
    $('canvasSaveBtn').addEventListener('click', saveCanvasDoc);
    $('canvasPreviewToggle').addEventListener('change', refreshCanvasPreview);
    $('canvasRefreshPreviewBtn').addEventListener('click', refreshCanvasPreview);
    $('canvasAiBtn').addEventListener('click', () => {
      const action = prompt('اختر: rewrite / summarize / improve / build_app_html', 'rewrite');
      if (!action) return;
      canvasAi(action.trim());
    });
    $('canvasExportBtn').addEventListener('click', () => {
      const title = ($('canvasTitle').value || 'canvas').trim() || 'canvas';
      const content = $('canvasEditor').value || '';
      downloadBlob(`${title}.txt`, new Blob([content], { type:'text/plain;charset=utf-8' }));
      toast('⬇️ تم تصدير TXT');
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

    // downloads
    $('refreshDlBtn').addEventListener('click', renderDownloads);
    $('clearDlBtn').addEventListener('click', () => { saveDownloads([]); renderDownloads(); toast('✅ تم'); });

    // projects
    $('newProjectBtn').addEventListener('click', newProject);
    $('renameProjectBtn').addEventListener('click', renameProject);
    $('deleteProjectBtn').addEventListener('click', deleteProject);

    // settings
    $('saveSettingsBtn').addEventListener('click', saveSettingsFromUI);
    $('resetSettingsBtn').addEventListener('click', () => { saveJSON(KEYS.settings, DEFAULT_SETTINGS); renderSettings(); toast('✅ تم'); });

    // sync provider/model inputs immediately
    $('provider').addEventListener('change', saveSettingsFromUI);
    $('baseUrl').addEventListener('change', saveSettingsFromUI);
    $('model').addEventListener('change', saveSettingsFromUI);
  }

  // ---------------- Init ----------------
  function init(){
    // Ensure defaults exist
    loadProjects();
    const pid = getCurProjectId();
    loadThreads(pid);
    $('curProjectName').textContent = getCurProject().name;

    // settings
    renderSettings();

    // render pages
    renderChat();
    renderFiles();
    renderCanvasList();
    renderDownloads();
    renderProjects();
    refreshNavMeta();
    refreshCanvasPreview();
    refreshModeButtons();

    bind();
  }

  init();
})();
