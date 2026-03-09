(function(global){
  async function localFallback(file,options){
    const text=await global.ExtractionService.parseFileToText(file, options.statusBoxId || 'statusBox');
    const structure=global.LayoutUtils.detectDocumentStructure(text,{filename:file.name});
    const html=global.LayoutUtils.buildEditableHtmlFromStructure(structure,{keepTables:options.keepTables});
    if(options.outputFormat==='html'){
      const blob=new Blob([html],{type:'text/html;charset=utf-8'});
      return { success:true, mode:'local', blob, filename:file.name.replace(/\.[^.]+$/,'')+'.html', warnings:['local reconstruction'] };
    }
    const docxBlob=await global.LayoutUtils.htmlToDocxWithDirection(html,{});
    return { success:true, mode:'local', blob:docxBlob, filename:file.name.replace(/\.[^.]+$/,'')+'.docx', warnings:['local reconstruction'] };
  }
  async function convertToEditableDocument(file,options){
    const mode=options.mode || 'auto';
    if(mode==='cloud') return global.CloudWorkerClient.convertViaExistingWorker(file,{baseUrl:options.baseUrl,onProgress:(s)=>global.ExtractionService.setStatus(options.statusBoxId,`تحويل سحابي... ${s.message||s.status}`,true)});
    if(mode==='local') return localFallback(file,options);
    if(mode==='auto'){
      if((options.outputFormat==='docx') && global.FileUtils.isPdf(file)){
        try{return await global.CloudWorkerClient.convertViaExistingWorker(file,{baseUrl:options.baseUrl,onProgress:(s)=>global.ExtractionService.setStatus(options.statusBoxId,`تحويل سحابي... ${s.message||s.status}`,true)});}catch(e){
          const local=await localFallback(file,options); local.warnings=[`cloud failed: ${e.message}`,...(local.warnings||[])]; return local;
        }
      }
      return localFallback(file,options);
    }
    throw new Error('invalid conversion mode');
  }
  global.CloudConversionService={ convertToEditableDocument };
})(window);
