(function(global){
  const detectRTL = (t)=>global.TextUtils?.detectRTL ? global.TextUtils.detectRTL(t) : /[\u0600-\u06FF]/.test(t||'');
  function detectTablesFromText(text=''){
    return text.split('\n').filter(l => l.includes('\t') || /\s{2,}/.test(l)).slice(0,40);
  }
  function detectDocumentStructure(text, metadata={}){
    const lines = (text||'').split('\n');
    const blocks = lines.map(line => ({ type: /^\s*#{1,6}\s/.test(line)?'heading':'paragraph', text: line })).filter(b=>b.text.trim());
    return { blocks, tables: detectTablesFromText(text), rtl: detectRTL(text), meta: metadata };
  }
  function buildEditableHtmlFromStructure(structure, opts={}){
    const dir = structure.rtl ? 'rtl' : 'ltr';
    const tableHtml = (opts.keepTables && structure.tables.length)
      ? `<h3>Tables (detected)</h3><table border="1" style="border-collapse:collapse;width:100%">${structure.tables.map(t=>`<tr><td style="padding:6px">${t.replace(/</g,'&lt;')}</td></tr>`).join('')}</table>` : '';
    const body = structure.blocks.map(b => b.type==='heading' ? `<h2>${b.text.replace(/^\s*#+\s*/,'')}</h2>` : `<p>${b.text}</p>`).join('');
    return `<!doctype html><html lang="${dir==='rtl'?'ar':'en'}" dir="${dir}"><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;line-height:1.8;padding:24px}p{margin:0 0 10px}</style></head><body contenteditable="true">${body}${tableHtml}</body></html>`;
  }
  async function htmlToDocxWithDirection(html, opts={}){
    if (!window.HTMLToDOCX) throw new Error('HTMLToDOCX not loaded');
    return window.HTMLToDOCX(html, null, { table: { row: { cantSplit: true } }, footer: false, pageNumber: false, ...opts });
  }
  global.LayoutUtils = { detectDocumentStructure, detectTablesFromText, buildEditableHtmlFromStructure, htmlToDocxWithDirection };
})(window);
