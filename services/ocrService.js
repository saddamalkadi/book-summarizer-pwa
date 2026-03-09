(function(global){
  const setStatus = (id,msg,loading=true)=>global.ExtractionService?.setStatus?.(id,msg,loading);
  function getOcrLangSelection(){
    const v=(document.getElementById('ocrLang')?.value || 'auto').trim();
    return v==='auto' ? 'ara+eng' : v;
  }
  function enhanceCanvas(canvas){
    const ctx=canvas.getContext('2d');
    const img=ctx.getImageData(0,0,canvas.width,canvas.height); const d=img.data;
    for(let i=0;i<d.length;i+=4){
      let r=d[i], g=d[i+1], b=d[i+2];
      r=Math.min(255, r*1.08+8); g=Math.min(255, g*1.08+8); b=Math.min(255, b*1.08+8);
      const lum=0.299*r+0.587*g+0.114*b; const v=lum>170?255:lum<70?0:lum;
      d[i]=d[i+1]=d[i+2]=v;
    }
    ctx.putImageData(img,0,0);
  }
  async function ocrImageFile(file, statusBoxId){
    const lang=getOcrLangSelection();
    const result=await Tesseract.recognize(file,lang,{ logger:m=>{ if(m.status) setStatus(statusBoxId,`OCR جاري... ${Math.round((m.progress||0)*100)}%`,true);} });
    return (result.data?.text || '').trim();
  }
  async function extractTextFromPDF(file,useOcr,enhance,statusBoxId){
    const pdfjsLib=window.pdfjsLib; pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
    const pdf=await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;
    const all=[];
    for(let i=1;i<=pdf.numPages;i++){
      const page=await pdf.getPage(i);
      if(useOcr){
        setStatus(statusBoxId,`OCR جاري... صفحة ${i}/${pdf.numPages}`,true);
        const vp=page.getViewport({scale:2}); const canvas=document.createElement('canvas'); canvas.width=vp.width; canvas.height=vp.height;
        await page.render({canvasContext:canvas.getContext('2d'),viewport:vp}).promise;
        if(enhance) enhanceCanvas(canvas);
        const ocr=await Tesseract.recognize(canvas, getOcrLangSelection(),{ logger:m=>{ if(m.status) setStatus(statusBoxId,`OCR جاري... صفحة ${i}/${pdf.numPages} (${Math.round((m.progress||0)*100)}%)`,true);} });
        all.push(ocr.data?.text || '');
      } else {
        setStatus(statusBoxId,`استخراج نص... صفحة ${i}/${pdf.numPages}`,true);
        const tc=await page.getTextContent();
        all.push((tc.items||[]).map(it=>it.str).join(' '));
      }
      await new Promise(r=>setTimeout(r,0));
    }
    setStatus(statusBoxId,'',false);
    return all.join('\n\n----- صفحة -----\n\n').trim();
  }
  global.OcrService={ getOcrLangSelection, enhanceCanvas, ocrImageFile, extractTextFromPDF };
})(window);
