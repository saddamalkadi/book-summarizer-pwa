/* Book Summarizer Pro v7 — OCR + DOCX + Chat Threads + Persistence (IndexedDB) */
(() => {
  const APP_VER = 7;
  const DB_NAME = 'book_summarizer_pro';
  const DB_VER  = 1;
  const STORE   = 'records';

  const $ = (id) => document.getElementById(id);

  function setStatus(id, msg, show=true){
    const el = $(id);
    if (!el) return;
    el.style.display = show ? 'block' : 'none';
    el.textContent = msg || '';
  }

  function escapeHtml(s){
    return (s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  function detectRTL(text){
    return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(text || '');
  }

  function sanitizeApiKey(k){
    return (k||'')
      .replace(/\s+/g,'')
      .replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g,'');
  }

  function isAsciiOnly(str){ return /^[\x00-\x7F]+$/.test(str); }

  function nowTs(){ return Date.now(); }

  function fmtTime(ts){
    try{
      const d = new Date(ts);
      return d.toLocaleString();
    }catch{ return String(ts); }
  }

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
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function dbPut(record){
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(record);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function dbGet(id){
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async function dbDelete(id){
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function dbClearAll(){
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function dbListAll(){
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const arr = req.result || [];
        arr.sort((a,b) => (b.updatedAt||0) - (a.updatedAt||0));
        resolve(arr);
      };
      req.onerror = () => reject(req.error);
    });
  }

  // -------------------- Settings --------------------
  function loadSettings(){
    const saved = {
      apiKey: localStorage.getItem('apiKey') || '',
      baseUrl: localStorage.getItem('baseUrl') || 'https://api.openai.com/v1',
      model: localStorage.getItem('model') || 'gpt-3.5-turbo',
      language: localStorage.getItem('language') || 'ar',
      ocrLang: localStorage.getItem('ocrLang') || 'auto',
      chatUseDoc: localStorage.getItem('chatUseDoc') || 'on',
      chatSystemPrompt: localStorage.getItem('chatSystemPrompt') || '',
    };

    if ($('apiKey')) $('apiKey').value = saved.apiKey;
    if ($('baseUrl')) $('baseUrl').value = saved.baseUrl;
    if ($('model')) $('model').value = saved.model;
    if ($('language')) $('language').value = saved.language;
    if ($('ocrLang')) $('ocrLang').value = saved.ocrLang;
    if ($('chatUseDoc')) $('chatUseDoc').value = saved.chatUseDoc;
    if ($('chatSystemPrompt')) $('chatSystemPrompt').value = saved.chatSystemPrompt;
  }

  function saveSettings(){
    localStorage.setItem('apiKey', sanitizeApiKey($('apiKey')?.value || ''));
    localStorage.setItem('baseUrl', ($('baseUrl')?.value || '').trim());
    localStorage.setItem('model', ($('model')?.value || '').trim());
    localStorage.setItem('language', $('language')?.value || 'ar');
    localStorage.setItem('ocrLang', $('ocrLang')?.value || 'auto');
    localStorage.setItem('chatUseDoc', $('chatUseDoc')?.value || 'on');
    localStorage.setItem('chatSystemPrompt', $('chatSystemPrompt')?.value || '');
    alert('تم حفظ الإعدادات.');
  }

  function getSettingsOrThrow(){
    const apiKey = sanitizeApiKey($('apiKey')?.value || '');
    const baseUrl = ($('baseUrl')?.value || '').trim();
    const model = ($('model')?.value || '').trim();
    const language = $('language')?.value || 'ar';

    if (!apiKey) throw new Error('يرجى إدخال API key');
    if (!isAsciiOnly(apiKey)) throw new Error('API key يجب أن يكون إنجليزي فقط (بدون أحرف عربية/رموز مخفية).');
    if (!baseUrl) throw new Error('Base URL فارغ');
    if (!model) throw new Error('Model فارغ');

    return { apiKey, baseUrl, model, language };
  }

  function getOcrLangSelection(){
    const v = ($('ocrLang')?.value || 'auto').trim();
    return v === 'auto' ? 'ara+eng' : v;
  }

  // -------------------- UI (Tabs/Drawer/Sheet) --------------------
  function showTab(name){
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    ['text','summary','chat','history'].forEach(n => {
      const el = $(`page-${n}`);
      if (el) el.classList.toggle('active', n === name);
    });
  }

  function openSettings(open){
    $('overlay')?.classList.toggle('show', !!open);
    $('settingsDrawer')?.classList.toggle('show', !!open);
  }

  function openExport(open){
    $('overlay')?.classList.toggle('show', !!open);
    $('exportSheet')?.classList.toggle('show', !!open);
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

        fullText += (result?.data?.text || '') + '\n\n';
      } else {
        setStatus(statusBoxId, `استخراج نص... صفحة ${pageNum}/${pdf.numPages}`, true);
        const content = await page.getTextContent();
        const strings = content.items.map(it => it.str);
        fullText += strings.join(' ').trim() + '\n\n';
      }
    }

    setStatus(statusBoxId, '', false);
    return fullText.trim();
  }
  // -------------------- AI (Chat / Summary) --------------------
  function chunkText(text, maxLen=8000){
    const chunks=[];
    for (let i=0;i<text.length;i+=maxLen) chunks.push(text.slice(i,i+maxLen));
    return chunks;
  }

  async function callChatCompletions({ apiKey, baseUrl, model, messages, max_tokens=1400, temperature=0.25 }){
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages, max_tokens, temperature })
    });

    if (!res.ok){
      const txt = await res.text().catch(()=> '');
      throw new Error(`API Error: ${res.status} ${res.statusText}${txt?`\n${txt}`:''}`);
    }

    const data = await res.json();
    return data?.choices?.[0]?.message?.content?.trim() || '';
  }

  async function summarizeText(text, statusBoxId){
    const { apiKey, baseUrl, model, language } = getSettingsOrThrow();
    const chunks = chunkText(text, 8000);
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

  // Chat Thread in-memory (persisted)
  let currentChatId = null;
  let chatMessages = []; // [{role, content, ts}]

  function newChatThread(){
    currentChatId = makeId('chat');
    chatMessages = [];
    renderChat();
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
      body.textContent = m.content;

      div.appendChild(meta);
      div.appendChild(body);
      log.appendChild(div);
    });
    log.scrollTop = log.scrollHeight;
  }

  function buildChatMessagesForAPI(userQuestion){
    const { language } = getSettingsOrThrow();
    const useDoc = ($('chatUseDoc')?.value || 'on') === 'on';
    const sysCustom = ($('chatSystemPrompt')?.value || '').trim();

    const system = sysCustom
      ? sysCustom
      : (language === 'ar'
          ? 'أنت مساعد احترافي. أجب بوضوح وبنقاط عند الحاجة. إن استندت إلى التفريغ فاذكر ذلك. إن لم تجد معلومة قل: غير مذكور في النص.'
          : 'You are a professional assistant. Answer clearly with bullets when helpful. If relying on the document text, say so. If not found, say it is not in the text.'
        );

    // آخر 14 رسالة لتقليل الحجم
    const tail = chatMessages.slice(-14).map(m => ({ role: m.role, content: m.content }));

    const messages = [{ role:'system', content: system }];

    if (useDoc){
      const docText = ($('textInput')?.value || '').trim();
      if (docText){
        const maxContext = 12000;
        let ctx = docText;
        if (ctx.length > maxContext){
          ctx = ctx.slice(0, 6000) + '\n\n...\n\n' + ctx.slice(-6000);
        }
        messages.push({ role:'system', content: `نص مرجعي (Document):\n${ctx}` });
      }
    }

    messages.push(...tail);
    messages.push({ role:'user', content: userQuestion });
    return messages;
  }

  async function sendChat(userQuestion, statusBoxId){
    const { apiKey, baseUrl, model } = getSettingsOrThrow();
    setStatus(statusBoxId, 'جاري إرسال السؤال...', true);

    const messages = buildChatMessagesForAPI(userQuestion);
    const answer = await callChatCompletions({ apiKey, baseUrl, model, messages, max_tokens: 1400, temperature: 0.25 });

    setStatus(statusBoxId, '', false);
    return answer;
  }

   // -------------------- Draft persistence (localStorage) --------------------
  function persistDraft(){
    const payload = {
      text: $('textInput')?.value || '',
      summary: $('summaryOutput')?.value || '',
    };
    localStorage.setItem('draft_v7', JSON.stringify(payload));
  }

  function restoreDraft(){
    try{
      const raw = localStorage.getItem('draft_v7');
      if (!raw) return;
      const d = JSON.parse(raw);
      if ($('textInput') && typeof d.text === 'string') $('textInput').value = d.text;
      if ($('summaryOutput') && typeof d.summary === 'string') $('summaryOutput').value = d.summary;
    }catch{}
  }

  function persistChatDraft(){
    const payload = { currentChatId, chatMessages };
    localStorage.setItem('chat_draft_v7', JSON.stringify(payload));
  }

  function restoreChatDraft(){
    try{
      const raw = localStorage.getItem('chat_draft_v7');
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d?.currentChatId) currentChatId = d.currentChatId;
      if (Array.isArray(d?.chatMessages)) chatMessages = d.chatMessages;
    }catch{}
  }

  // -------------------- Export (PDF Print + DOCX) --------------------
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

  function getHtmlToDocxFn(){
    return window.htmlToDocx || window.HtmlToDocx || window.htmlToDocx?.default || null;
  }

  function downloadBlob(filename, blob){
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href), 1500);
  }

  async function exportDocx(filename, title, text){
    const fn = getHtmlToDocxFn();
    if (!fn) throw new Error('مكتبة DOCX لم تُحمّل.');

    const rtl = detectRTL(text);
    const dir = rtl ? 'rtl' : 'ltr';
    const html = `
      <div dir="${dir}" style="font-family: Arial; line-height:1.8;">
        <h2>${escapeHtml(title)}</h2>
        <div style="white-space:pre-wrap; font-size:14px;">${escapeHtml(text)}</div>
      </div>
    `;

    const blob = await fn(html, { direction: dir });
    downloadBlob(filename, blob);
  }

  // -------------------- History (Archive) --------------------
  async function saveRecord(type, title, content, meta={}){
    const rec = {
      id: makeId(type),
      type,
      title: title || type,
      content: content || '',
      meta,
      createdAt: nowTs(),
      updatedAt: nowTs(),
    };
    await dbPut(rec);
    return rec;
  }

  function typeLabel(t){
    if (t === 'extraction') return 'تفريغ';
    if (t === 'summary') return 'ملخص';
    if (t === 'chat') return 'دردشة';
    if (t === 'export') return 'تصدير';
    return t;
  }

  async function renderHistory(){
    const list = $('historyList');
    if (!list) return;

    const items = await dbListAll();
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
      preview.textContent = p ? p + (item.content.length>220 ? '…' : '') : '(محتوى فارغ)';

      const actions = document.createElement('div');
      actions.className = 'actions';

      const btnOpen = document.createElement('button');
      btnOpen.className = 'btn ghost';
      btnOpen.textContent = 'فتح';
      btnOpen.onclick = () => {
        if (item.type === 'extraction'){
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
        await dbDelete(item.id);
        await renderHistory();
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

   // -------------------- Events --------------------
  function bindEvents(){
    // Tabs
    document.querySelectorAll('.tab').forEach(btn => {
      btn.addEventListener('click', () => showTab(btn.dataset.tab));
    });

    // Drawer/Sheet
    $('btnSettings')?.addEventListener('click', () => openSettings(true));
    $('btnCloseSettings')?.addEventListener('click', () => openSettings(false));

    $('btnExport')?.addEventListener('click', () => openExport(true));
    $('btnCloseExport')?.addEventListener('click', () => openExport(false));

    $('overlay')?.addEventListener('click', () => {
      openSettings(false);
      openExport(false);
    });

    $('saveSettingsBtn')?.addEventListener('click', saveSettings);

    // Pick PDF
    $('btnPickPdf')?.addEventListener('click', () => $('pdfFile')?.click());
    $('pdfFile')?.addEventListener('change', () => {
      const f = $('pdfFile')?.files?.[0];
      $('pdfName').textContent = f ? f.name : 'لم يتم اختيار ملف';
    });

    // Draft autosave
    $('textInput')?.addEventListener('input', persistDraft);
    $('summaryOutput')?.addEventListener('input', persistDraft);

    // Extract
    $('extractPdfBtn')?.addEventListener('click', async () => {
      try{
        const file = $('pdfFile')?.files?.[0];
        if (!file) return alert('اختر ملف PDF أولاً.');

        const useOcr = !!$('ocrToggle')?.checked;
        const enhance = !!$('enhanceToggle')?.checked;

        const btn = $('extractPdfBtn');
        btn.disabled = true;
        btn.textContent = 'جارٍ الاستخراج...';

        const text = await extractTextFromPDF(file, useOcr, enhance, 'statusBox');
        $('textInput').value = text;
        persistDraft();

        if (!useOcr && text.length < 40){
          alert('تم الاستخراج لكن الناتج ضعيف/فارغ. جرّب تفعيل OCR ثم أعد الاستخراج.');
        } else {
          alert(useOcr ? 'اكتمل OCR.' : 'تم استخراج النص.');
        }
      } catch(e){
        alert(e.message || String(e));
      } finally {
        setStatus('statusBox','',false);
        const btn = $('extractPdfBtn');
        if (btn){ btn.disabled=false; btn.textContent='استخراج'; }
      }
    });

    // Save extraction
    $('saveExtractionBtn')?.addEventListener('click', async () => {
      const text = ($('textInput')?.value || '').trim();
      if (!text) return alert('لا يوجد تفريغ لحفظه.');
      const title = prompt('عنوان التفريغ (اختياري):', 'تفريغ OCR');
      await saveRecord('extraction', title || 'تفريغ OCR', text, { source: $('pdfName')?.textContent || '' });
      alert('تم حفظ التفريغ في الأرشيف.');
      await renderHistory();
    });

    $('clearTextBtn')?.addEventListener('click', () => {
      $('textInput').value = '';
      persistDraft();
    });

    // Summarize
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

    // Save summary
    $('saveSummaryBtn')?.addEventListener('click', async () => {
      const sum = ($('summaryOutput')?.value || '').trim();
      if (!sum) return alert('لا يوجد ملخص لحفظه.');
      const title = prompt('عنوان الملخص (اختياري):', 'ملخص');
      await saveRecord('summary', title || 'ملخص', sum, { relatedTo: $('pdfName')?.textContent || '' });
      alert('تم حفظ الملخص في الأرشيف.');
      await renderHistory();
    });

    $('clearSummaryBtn')?.addEventListener('click', () => {
      $('summaryOutput').value = '';
      persistDraft();
    });

    // Chat
    $('newChatBtn')?.addEventListener('click', () => {
      if (chatMessages.length && !confirm('بدء محادثة جديدة؟ سيتم حفظ الحالية كمسودة فقط.')) return;
      newChatThread();
    });

    $('clearChatBtn')?.addEventListener('click', () => {
      if (!confirm('مسح سجل الدردشة الحالي؟')) return;
      chatMessages = [];
      renderChat();
      persistChatDraft();
    });

    $('chatSendBtn')?.addEventListener('click', async () => {
      try{
        const q = ($('chatInput')?.value || '').trim();
        if (!q) return alert('اكتب سؤالك أولاً.');

        if (!currentChatId) newChatThread();

        chatMessages.push({ role:'user', content: q, ts: nowTs() });
        $('chatInput').value = '';
        renderChat();
        persistChatDraft();

        const btn = $('chatSendBtn');
        btn.disabled = true;
        btn.textContent = '...';

        const ans = await sendChat(q, 'statusBox3');
        chatMessages.push({ role:'assistant', content: ans, ts: nowTs() });
        renderChat();
        persistChatDraft();

      } catch(e){
        alert(e.message || String(e));
      } finally {
        setStatus('statusBox3','',false);
        const btn = $('chatSendBtn');
        if (btn){ btn.disabled=false; btn.textContent='إرسال'; }
      }
    });

    // Save chat
    $('saveChatBtn')?.addEventListener('click', async () => {
      if (!chatMessages.length) return alert('لا يوجد سجل دردشة لحفظه.');
      const title = prompt('عنوان المحادثة (اختياري):', 'محادثة');
      const rec = await saveRecord('chat', title || 'محادثة', '', { messages: chatMessages });
      currentChatId = rec.id;
      alert('تم حفظ المحادثة في الأرشيف.');
      await renderHistory();
    });

    // Export actions
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

    // History
    $('refreshHistoryBtn')?.addEventListener('click', renderHistory);

    $('deleteAllBtn')?.addEventListener('click', async () => {
      if (!confirm('تحذير: سيتم حذف كل البيانات المحفوظة داخل التطبيق نهائيًا. متابعة؟')) return;
      await dbClearAll();
      alert('تم حذف كل البيانات.');
      await renderHistory();
    });
  }

  // -------------------- Init --------------------
  function init(){
    console.log('Book Summarizer Pro v7 loaded');

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

    if (!currentChatId) currentChatId = makeId('chat');
    if (!Array.isArray(chatMessages)) chatMessages = [];

    bindEvents();

    renderChat();
    renderHistory();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
