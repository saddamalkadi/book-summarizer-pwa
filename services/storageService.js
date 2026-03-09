(function(global){
  const DRAFT_KEY='book_summarizer_pwa_draft_v2';
  async function saveRecord(type,title,content,meta={}){
    if (global.saveRecord) return global.saveRecord(type,title,content,meta);
    const rec={ id: `rec_${Date.now()}_${Math.random().toString(16).slice(2)}`, type, title, content, meta, updatedAt: Date.now() };
    const rows = JSON.parse(localStorage.getItem('fallback_records')||'[]'); rows.unshift(rec); localStorage.setItem('fallback_records', JSON.stringify(rows));
    return rec;
  }
  function persistDraft(){
    const payload={ textInput: document.getElementById('textInput')?.value || '', summaryOutput: document.getElementById('summaryOutput')?.value || '', ts: Date.now() };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
  }
  function loadDraft(){ try{return JSON.parse(localStorage.getItem(DRAFT_KEY)||'{}');}catch{return {};}}
  global.StorageService={ saveRecord, persistDraft, loadDraft };
})(window);
