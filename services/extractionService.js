(function(global){
  function setStatus(statusBoxId,message,loading){
    const el=document.getElementById(statusBoxId); if(!el) return;
    el.style.display = (message || loading) ? 'block' : 'none';
    el.textContent = message || '';
    el.dataset.loading = loading ? '1' : '0';
  }
  async function parseFileToText(file,statusBoxId,zipDepth=0){
    const ext=global.FileUtils.extOf(file.name); const kind=global.FileUtils.inferFileKind(file);
    if(['txt','md','csv','log'].includes(ext)) return (await file.text()).trim();
    if(ext==='json' || ext==='xml') return (await file.text()).trim();
    if(ext==='html' || ext==='htm') return global.TextUtils.stripHtmlToText(await file.text());
    if(ext==='rtf') return global.TextUtils.rtfToText(await file.text());
    if(ext==='docx') return (await mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()})).value.trim();
    if(kind==='image') return global.OcrService.ocrImageFile(file,statusBoxId);
    if(kind==='pdf'){
      const useOcr = document.getElementById('ocrToggle')?.checked ?? true;
      const enhance = document.getElementById('enhanceToggle')?.checked ?? true;
      let t=await global.OcrService.extractTextFromPDF(file,useOcr,enhance,statusBoxId);
      if((t||'').replace(/\s+/g,'').length<30) t=await global.OcrService.extractTextFromPDF(file,true,enhance,statusBoxId);
      return t.trim();
    }
    if(['xlsx','xls'].includes(ext) && window.XLSX){
      const wb=XLSX.read(await file.arrayBuffer(),{type:'array'});
      return wb.SheetNames.map(n=>`## ${n}\n`+XLSX.utils.sheet_to_csv(wb.Sheets[n],{FS:'\t'})).join('\n\n').trim();
    }
    if(['pptx','ppt','epub','zip'].includes(ext) && window.JSZip){
      if(ext==='zip' && zipDepth>0) throw new Error('نوع ملف غير مدعوم حاليًا: zip داخل zip');
      return await file.text();
    }
    try{return (await file.text()).trim();}catch{ throw new Error(`نوع ملف غير مدعوم حاليًا: ${ext || file.type || 'unknown'}`); }
  }
  global.ExtractionService={ setStatus, parseFileToText };
})(window);
