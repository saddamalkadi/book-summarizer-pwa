(function(global){
  async function aiFixOcrText(text,statusBoxId){
    const mode = document.getElementById('aiFixMode')?.value || 'safe';
    const chunks = (global.TextUtils?.chunkText ? global.TextUtils.chunkText(text,6500) : [text]);
    const apiKey=(document.getElementById('apiKey')?.value||'').trim();
    const baseUrl=(document.getElementById('baseUrl')?.value||'https://api.openai.com/v1').trim().replace(/\/+$/,'');
    const model=(document.getElementById('model')?.value||'gpt-4o-mini').trim();
    if(!apiKey) throw new Error('يرجى إدخال API key في الإعدادات');
    const out=[];
    for(let i=0;i<chunks.length;i++){
      global.ExtractionService?.setStatus(statusBoxId,`AI Fix جاري... جزء ${i+1}/${chunks.length}`,true);
      const prompt = mode==='strong'
        ? 'صحّح أخطاء OCR العربية والإنجليزية بقوة مع الحفاظ على المعنى والبنية ومن دون ترجمة. أعد النص فقط.'
        : 'صحّح أخطاء OCR العربية والإنجليزية بشكل آمن دون إعادة صياغة كبيرة ومع الحفاظ على عدد الأسطر تقريبًا. أعد النص فقط.';
      const res=await fetch(`${baseUrl}/chat/completions`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${apiKey}`},body:JSON.stringify({model,messages:[{role:'system',content:prompt},{role:'user',content:chunks[i]}],temperature:0})});
      if(!res.ok) throw new Error(`AI Fix failed: ${res.status}`);
      const json=await res.json(); out.push(json.choices?.[0]?.message?.content?.trim() || '');
    }
    global.ExtractionService?.setStatus(statusBoxId,'',false);
    return out.join('\n');
  }
  global.AiFixService={ aiFixOcrText };
})(window);
