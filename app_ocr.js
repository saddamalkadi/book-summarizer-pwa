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

})();
