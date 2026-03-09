(function(global){
  function exportPdfViaPrint(title,text){
    const rtl = global.TextUtils.detectRTL(text);
    const w=window.open('','_blank');
    w.document.write(`<!doctype html><html dir="${rtl?'rtl':'ltr'}" lang="${rtl?'ar':'en'}"><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:Arial,sans-serif;white-space:pre-wrap;line-height:1.8;padding:20px}</style></head><body>${(text||'').replace(/</g,'&lt;')}</body></html>`);
    w.document.close(); w.focus(); w.print();
  }
  async function exportDocx(filename,title,text){
    const rtl=global.TextUtils.detectRTL(text);
    const html=`<html dir="${rtl?'rtl':'ltr'}" lang="${rtl?'ar':'en'}"><body style="font-family:Arial"><h1>${title}</h1><pre style="white-space:pre-wrap">${(text||'').replace(/</g,'&lt;')}</pre></body></html>`;
    const blob=await global.LayoutUtils.htmlToDocxWithDirection(html,{});
    const url=URL.createObjectURL(blob); global.FileUtils.safeDownload(url, filename); setTimeout(()=>URL.revokeObjectURL(url),1500);
  }
  global.ExportService={ exportPdfViaPrint, exportDocx };
})(window);
