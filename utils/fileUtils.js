(function(global){
  function extOf(name=''){ const p=name.toLowerCase().split('.'); return p.length>1?p.pop():''; }
  function inferFileKind(file){
    const ext = extOf(file?.name || '');
    const mime = (file?.type || '').toLowerCase();
    if (mime.includes('pdf') || ext==='pdf') return 'pdf';
    if (mime.startsWith('image/') || ['png','jpg','jpeg','webp','bmp','tif','tiff'].includes(ext)) return 'image';
    if (ext==='docx' || mime.includes('wordprocessingml')) return 'docx';
    return ext || 'other';
  }
  function isPdf(file){ return inferFileKind(file)==='pdf'; }
  function isImage(file){ return inferFileKind(file)==='image'; }
  function safeDownload(url, filename){
    const a=document.createElement('a'); a.href=url; a.download=filename || 'output'; a.rel='noopener';
    document.body.appendChild(a); a.click(); a.remove();
  }
  global.FileUtils = { extOf, inferFileKind, isPdf, isImage, safeDownload };
})(window);
