/* Book Summarizer Pro v11 — Strategic multi-format ingestion + OCR -> AI Fix -> Export + Knowledge Base (Embeddings RAG)
   Supported ingestion: PDF, DOCX, TXT/MD/CSV/JSON/XML, HTML, RTF, Images (OCR), XLSX/XLS, PPTX/PPT (basic), EPUB (basic), ZIP (extract supported). */
(() => {
  const APP_VER = 11;

  const DB_NAME = 'book_summarizer_pro';
  const DB_VER  = 3;
  const STORE   = 'records';
  const KB_DOCS = 'kb_docs';
  const KB_CHUNKS = 'kb_chunks';
  const FILE_CACHE = 'file_cache';

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
    try{ return new Date(ts).toLocaleString(); } catch { return String(ts); }
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
      baseUrl: localStorage.getItem('baseUrl') || 'https://api.openai.com/v1',
      model: localStorage.getItem('model') || 'gpt-3.5-turbo',
      embedModel: localStorage.getItem('embedModel') || 'text-embedding-3-small',
      language: localStorage.getItem('language') || 'ar',
      ocrLang: localStorage.getItem('ocrLang') || 'auto',
      aiFixMode: localStorage.getItem('aiFixMode') || 'safe',
      chatUseDoc: localStorage.getItem('chatUseDoc') || 'on',
      chatUseKB: localStorage.getItem('chatUseKB') || 'on',
      chatSystemPrompt: localStorage.getItem('chatSystemPrompt') || '',
      apiMode: localStorage.getItem('apiMode') || 'chat',
      reasoningEffort: localStorage.getItem('reasoningEffort') || 'medium',
      reasoningSummary: localStorage.getItem('reasoningSummary') || 'off',
      chatDirectFiles: localStorage.getItem('chatDirectFiles') || 'auto',
      visionMode: localStorage.getItem('visionMode') || 'auto',
    };

    $('apiKey') && ($('apiKey').value = saved.apiKey);
    $('baseUrl') && ($('baseUrl').value = saved.baseUrl);
    $('model') && ($('model').value = saved.model);
    $('embedModel') && ($('embedModel').value = saved.embedModel);
    $('language') && ($('language').value = saved.language);
    $('ocrLang') && ($('ocrLang').value = saved.ocrLang);
    $('aiFixMode') && ($('aiFixMode').value = saved.aiFixMode);
    $('chatUseDoc') && ($('chatUseDoc').value = saved.chatUseDoc);
    $('chatUseKB') && ($('chatUseKB').value = saved.chatUseKB);
    $('chatSystemPrompt') && ($('chatSystemPrompt').value = saved.chatSystemPrompt);
    $('apiMode') && ($('apiMode').value = saved.apiMode);
    $('reasoningEffort') && ($('reasoningEffort').value = saved.reasoningEffort);
    $('reasoningSummary') && ($('reasoningSummary').value = saved.reasoningSummary);
    $('chatDirectFiles') && ($('chatDirectFiles').value = saved.chatDirectFiles);
    $('visionMode') && ($('visionMode').value = saved.visionMode);
  }

  function saveSettings(){
    localStorage.setItem('apiKey', sanitizeApiKey($('apiKey')?.value || ''));
    localStorage.setItem('baseUrl', ($('baseUrl')?.value || '').trim());
    localStorage.setItem('model', ($('model')?.value || '').trim());
    localStorage.setItem('embedModel', ($('embedModel')?.value || '').trim());
    localStorage.setItem('language', $('language')?.value || 'ar');
    localStorage.setItem('ocrLang', $('ocrLang')?.value || 'auto');
    localStorage.setItem('aiFixMode', $('aiFixMode')?.value || 'safe');
    localStorage.setItem('chatUseDoc', $('chatUseDoc')?.value || 'on');
    localStorage.setItem('chatUseKB', $('chatUseKB')?.value || 'on');
    localStorage.setItem('chatSystemPrompt', ($('chatSystemPrompt')?.value || '').trim());
    localStorage.setItem('apiMode', $('apiMode')?.value || 'chat');
    localStorage.setItem('reasoningEffort', $('reasoningEffort')?.value || 'medium');
    localStorage.setItem('reasoningSummary', $('reasoningSummary')?.value || 'off');
    localStorage.setItem('chatDirectFiles', $('chatDirectFiles')?.value || 'auto');
    localStorage.setItem('visionMode', $('visionMode')?.value || 'auto');
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

  function getOcrLangSelection(){
    const v = ($('ocrLang')?.value || 'auto').trim();
    return v === 'auto' ? 'ara+eng' : v;
  }

  // -------------------- UI --------------------
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
      throw new Error(`File upload failed: ${res.status} ${res.statusText}${txt?`\n${txt}`:''}`);
    }
    const data = await res.json();
    const fileId = data?.id;
    if (fileId){
      try{
        await dbPut(FILE_CACHE, { hash, fileId, baseUrl, name: file.name, mime: file.type, size: file.size, updatedAt: nowTs() });
      }catch{}
    }
    setStatus(statusBoxId, '', false);
    return fileId;
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

  async function callResponses({ apiKey, baseUrl, model, input, max_output_tokens=1600, temperature=0.25, reasoningEffort='medium', reasoningSummary='off' }){
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
      throw new Error(`API Error: ${res.status} ${res.statusText}${txt?`\n${txt}`:''}`);
    }
    const data = await res.json();
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
      throw new Error(`Embeddings API Error: ${res.status} ${res.statusText}${txt?`\n${txt}`:''}`);
    }
    const data = await res.json();
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
  let chatMessages = [];
  let chatAttachments = [];
  let lastSourceFile = null; // { kind:'docx'|'pdf'|'img'|'other', name, file }

  function newChatThread(){
    currentChatId = makeId('chat');
    chatMessages = [];
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
      body.textContent = m.content;
      div.appendChild(meta);
      div.appendChild(body);
      log.appendChild(div);
    });
    log.scrollTop = log.scrollHeight;
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



  async function buildChatMessagesForAPI(userQuestion){
    const { language } = getSettingsOrThrow();
    const useDoc = ($('chatUseDoc')?.value || 'on') === 'on';
    const useKB = ($('chatUseKB')?.value || 'on') === 'on';
    const sysCustom = ($('chatSystemPrompt')?.value || '').trim();

    const system = sysCustom
      ? sysCustom
      : (language === 'ar'
          ? 'أنت مساعد احترافي. أجب بدقة وبأسلوب منظم. عند الاستناد إلى ملفات قاعدة المعرفة، اذكر اسم الملف. إن لم تجد معلومة قل: غير مذكور في المصادر.'
          : 'You are a professional assistant. Answer accurately and clearly. If using the knowledge base, cite the document name. If not found, say it is not in the sources.'
        );

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

    const tail = chatMessages.slice(-14).map(m => ({ role: m.role, content: m.content }));
    messages.push(...tail);

    // رسالة المستخدم النهائية تُبنى في sendChat (لتضمين المرفقات/الملفات)
    return messages;
  }

  async function sendChat(userQuestion, statusBoxId){
    const settings = getSettingsOrThrow();
    setStatus(statusBoxId, 'جاري إرسال السؤال...', true);

    const baseMessages = await buildChatMessagesForAPI(userQuestion);

    const useAttachments = settings.chatDirectFiles !== 'off' && chatAttachments.length > 0;
    const visionEnabled = settings.visionMode !== 'ocr';
    const apiKey = settings.apiKey;
    const baseUrl = settings.baseUrl;
    const model = settings.model;

    // Build the final user message parts (text + files/images)
    async function buildUserPartsForChat(){
      const parts = [];
      if (useAttachments){
        for (const att of chatAttachments){
          // Images: send as image_url (data URL) when vision enabled and file present
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

          // Other files: prefer direct file_id if possible
          let fileId = att.fileId;
          if (!fileId && att.file){
            try{
              fileId = await uploadFileToAPI(att.file, statusBoxId);
              att.fileId = fileId;
            }catch(e){
              // fallback: include extracted text if available
              console.warn('file upload failed, fallback to text', e);
            }
          }
          if (fileId){
            parts.push({ type:'file', file:{ file_id: fileId } });
          } else if (att.text && att.text.trim()){
            const clip = att.text.length > 6000 ? (att.text.slice(0,3000) + '\n\n...\n\n' + att.text.slice(-3000)) : att.text;
            parts.push({ type:'text', text: `[ملف: ${att.name}]\n${clip}` });
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

          let fileId = att.fileId;
          if (!fileId && att.file){
            try{
              fileId = await uploadFileToAPI(att.file, statusBoxId);
              att.fileId = fileId;
            }catch(e){
              console.warn('file upload failed (responses), fallback to text', e);
            }
          }
          if (fileId){
            parts.push({ type:'input_file', file_id: fileId });
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
      if (settings.apiMode === 'responses'){
        const input = baseMessages.map(m => ({ role: m.role, content: [{ type:'input_text', text: String(m.content||'') }] }));
        const userParts = await buildUserPartsForResponses();
        input.push({ role:'user', content: userParts });

        const answer = await callResponses({
          apiKey, baseUrl, model,
          input,
          max_output_tokens: 1600,
          temperature: 0.25,
          reasoningEffort: settings.reasoningEffort,
          reasoningSummary: settings.reasoningSummary
        });
        setStatus(statusBoxId, '', false);
        return answer || '';
      } else {
        const userParts = await buildUserPartsForChat();
        const finalMessages = baseMessages.concat([{ role:'user', content: userParts }]);

        const answer = await callChatCompletions({ apiKey, baseUrl, model, messages: finalMessages, max_tokens: 1400, temperature: 0.25 });
        setStatus(statusBoxId, '', false);
        return answer || '';
      }
    } finally {
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

  function downloadBlob(filename, blob){
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href), 1500);
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

  // -------------------- Events --------------------
  function bindEvents(){
    document.querySelectorAll('.tab').forEach(btn => btn.addEventListener('click', () => showTab(btn.dataset.tab)));

    $('btnSettings')?.addEventListener('click', () => openSettings(true));
    $('btnCloseSettings')?.addEventListener('click', () => openSettings(false));
    $('btnExport')?.addEventListener('click', () => openExport(true));
    $('btnCloseExport')?.addEventListener('click', () => openExport(false));

    $('kbManageBtn')?.addEventListener('click', async () => { await refreshKBUI(); openKBDrawer(true); });
    $('kbCloseBtn')?.addEventListener('click', () => openKBDrawer(false));

    $('overlay')?.addEventListener('click', () => { openSettings(false); openExport(false); openKBDrawer(false); });

    $('saveSettingsBtn')?.addEventListener('click', saveSettings);

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

    if (!currentChatId) currentChatId = makeId('chat');
    if (!Array.isArray(chatMessages)) chatMessages = [];

    bindEvents();
    renderChat();
    renderChatAttachments();
    await renderHistory();
    await refreshKBUI();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
