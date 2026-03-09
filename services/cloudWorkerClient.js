(function(global){
  async function pingWorker(baseUrl){ const r=await fetch(`${baseUrl}/ping`); if(!r.ok) throw new Error('worker unavailable'); return r.json(); }
  async function startCloudConversion(baseUrl,fileName){
    const r=await fetch(`${baseUrl}/start`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fileName})});
    if(!r.ok) throw new Error('start conversion failed'); return r.json();
  }
  async function uploadFileToCloudConvertForm(uploadInfo,file){
    const fd=new FormData();
    Object.entries(uploadInfo.parameters||{}).forEach(([k,v])=>fd.append(k,v));
    fd.append('file',file,uploadInfo.fileName || file.name);
    const r=await fetch(uploadInfo.url,{method:'POST',body:fd});
    if(!r.ok) throw new Error('upload failed');
    return true;
  }
  async function pollCloudConversionStatus(baseUrl,jobId,onProgress){
    for(let i=0;i<60;i++){
      const r=await fetch(`${baseUrl}/status?jobId=${encodeURIComponent(jobId)}`); if(!r.ok) throw new Error('status failed');
      const j=await r.json(); onProgress?.(j,i);
      if(j.url || j.status==='finished') return j;
      if(['error','failed','canceled'].includes(j.status)) throw new Error(j.message || 'cloud conversion failed');
      await new Promise(r=>setTimeout(r,2500));
    }
    throw new Error('cloud conversion timeout');
  }
  async function convertViaExistingWorker(file,options={}){
    const baseUrl=(options.baseUrl||'').replace(/\/+$/,''); if(!baseUrl) throw new Error('cloudWorkerBaseUrl missing');
    await pingWorker(baseUrl);
    const started=await startCloudConversion(baseUrl,file.name);
    await uploadFileToCloudConvertForm(started.upload,file);
    const status=await pollCloudConversionStatus(baseUrl,started.jobId,options.onProgress);
    return { success:!!status.url, jobId:started.jobId, status:status.status, url:status.url, warnings:status.warnings||[], mode:'cloud' };
  }
  global.CloudWorkerClient={ pingWorker, startCloudConversion, uploadFileToCloudConvertForm, pollCloudConversionStatus, convertViaExistingWorker };
})(window);
