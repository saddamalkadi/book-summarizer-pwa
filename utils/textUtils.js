(function(global){
  function detectRTL(text){ return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(text || ''); }
  function stripHtmlToText(html){
    try{
      const doc = new DOMParser().parseFromString(html || '', 'text/html');
      return (doc.body?.textContent || '').replace(/\n{3,}/g,'\n\n').trim();
    }catch{
      return (html||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
    }
  }
  function rtfToText(rtf){
    let t = rtf || '';
    t = t.replace(/\r\n/g, '\n').replace(/\\par[d]?/g, '\n');
    t = t.replace(/\\'([0-9a-fA-F]{2})/g, (_,h)=>String.fromCharCode(parseInt(h,16)));
    t = t.replace(/\\[a-zA-Z]+\d* ?/g, '').replace(/[{}]/g, '').replace(/\n{3,}/g, '\n\n');
    return t.trim();
  }
  function chunkText(text, max=6500){
    const chunks=[]; let i=0;
    while(i<text.length){ chunks.push(text.slice(i,i+max)); i+=max; }
    return chunks;
  }
  global.TextUtils = { detectRTL, stripHtmlToText, rtfToText, chunkText };
})(window);
