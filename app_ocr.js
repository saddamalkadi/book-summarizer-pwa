/* Book Summarizer Pro - app_ocr.js (v6) */
(() => {
  const APP_VERSION = "6";

  function $(id){ return document.getElementById(id); }

  function setStatus(boxId, msg, show = true){
    const box = $(boxId);
    if (!box) return;
    box.style.display = show ? "block" : "none";
    box.textContent = msg || "";
  }

  function sanitizeApiKey(k) {
    return (k || "")
      .replace(/\s+/g, "")
      .replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, "");
  }

  function isAsciiOnly(str) { return /^[\x00-\x7F]+$/.test(str); }

  function escapeHtml(s){
    return (s||"").replace(/[&<>"']/g, m => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[m]));
  }

  function detectRTL(text){
    return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(text || "");
  }

  function getSettingsOrThrow(){
    const apiKey = sanitizeApiKey($("apiKey")?.value || "");
    const baseUrl = ($("baseUrl")?.value || "").trim();
    const model   = ($("model")?.value || "").trim();
    const language = $("language")?.value || "ar";

    if (!apiKey) throw new Error("يرجى إدخال API key");
    if (!isAsciiOnly(apiKey)) throw new Error("API key يجب أن يكون إنجليزي فقط (بدون أحرف عربية/رموز مخفية).");
    if (!baseUrl) throw new Error("Base URL فارغ");
    if (!model) throw new Error("Model فارغ");
    return { apiKey, baseUrl, model, language };
  }

  function getOcrLangSelection(){
    const v = ($("ocrLang")?.value || "auto").trim();
    return v === "auto" ? "ara+eng" : v;
  }

  // ---- Load/Save settings ----
  function loadSettings(){
    const savedApiKey = localStorage.getItem("apiKey");
    const savedBaseUrl = localStorage.getItem("baseUrl");
    const savedModel = localStorage.getItem("model");
    const savedLanguage = localStorage.getItem("language");
    const savedOcrLang = localStorage.getItem("ocrLang");

    if (savedApiKey && $("apiKey")) $("apiKey").value = savedApiKey;
    if (savedBaseUrl && $("baseUrl")) $("baseUrl").value = savedBaseUrl;
    if (savedModel && $("model")) $("model").value = savedModel;
    if (savedLanguage && $("language")) $("language").value = savedLanguage;
    if (savedOcrLang && $("ocrLang")) $("ocrLang").value = savedOcrLang;
  }

  function saveSettings(){
    localStorage.setItem("apiKey", sanitizeApiKey($("apiKey")?.value || ""));
    localStorage.setItem("baseUrl", ($("baseUrl")?.value || "").trim());
    localStorage.setItem("model", ($("model")?.value || "").trim());
    localStorage.setItem("language", $("language")?.value || "ar");
    localStorage.setItem("ocrLang", $("ocrLang")?.value || "auto");
    alert("تم حفظ الإعدادات.");
  }

  // ---- PDF.js init ----
  function initPdfJs(){
    const pdfjsLib = window.pdfjsLib;
    if (!pdfjsLib) throw new Error("pdf.js لم يتم تحميله.");
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";
    return pdfjsLib;
  }

  async function extractTextFromPDF(file, useOcr, statusBoxId){
    const pdfjsLib = initPdfJs();
    const typedarray = new Uint8Array(await file.arrayBuffer());
    const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;

    let fullText = "";
    const ocrLangs = getOcrLangSelection();

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++){
      const page = await pdf.getPage(pageNum);

      if (useOcr){
        setStatus(statusBoxId, `OCR جاري... صفحة ${pageNum}/${pdf.numPages}`, true);

        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        await page.render({ canvasContext: ctx, viewport }).promise;

        const result = await Tesseract.recognize(canvas, ocrLangs, {
          logger: (m) => {
            if (m?.status){
              const pct = m.progress ? Math.round(m.progress * 100) : null;
              setStatus(statusBoxId, `OCR: ${m.status}${pct!==null?` (${pct}%)`:""} — صفحة ${pageNum}/${pdf.numPages}`, true);
            }
          }
        });

        fullText += (result?.data?.text || "") + "\n\n";
      } else {
        setStatus(statusBoxId, `استخراج نص... صفحة ${pageNum}/${pdf.numPages}`, true);

        const content = await page.getTextContent();
        const strings = content.items.map(it => it.str);
        const pageText = strings.join(" ").trim();
        fullText += pageText + "\n\n";
      }
    }

    setStatus(statusBoxId, "", false);
    return fullText.trim();
  }

  // ---- LLM Calls ----
  function chunkText(text, maxLen = 8000){
    const chunks = [];
    for (let i=0; i<text.length; i+=maxLen) chunks.push(text.slice(i, i+maxLen));
    return chunks;
  }

  async function callChatCompletions({ apiKey, baseUrl, model, messages, max_tokens=1400, temperature=0.25 }){
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type":"application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({ model, messages, max_tokens, temperature })
    });

    if (!res.ok){
      const txt = await res.text().catch(()=> "");
      throw new Error(`API Error: ${res.status} ${res.statusText}${txt?`\n${txt}`:""}`);
    }

    const data = await res.json();
    return data?.choices?.[0]?.message?.content?.trim() || "";
  }

  async function summarize(text, statusBoxId){
    const { apiKey, baseUrl, model, language } = getSettingsOrThrow();
    const chunks = chunkText(text, 8000);
    let out = "";

    for (let i=0; i<chunks.length; i++){
      setStatus(statusBoxId, `تلخيص... جزء ${i+1}/${chunks.length}`, true);

      const messages = [
        { role:"system", content:"لخّص النص بدقة وبشكل منظم: ملخص تنفيذي، نقاط رئيسية، أفكار وتطبيقات عملية، مصطلحات مهمة. بدون حشو." },
        { role:"user", content:`النص:\n${chunks[i]}\n\nاكتب باللغة: ${language === "ar" ? "العربية" : "English"}.` }
      ];

      const part = await callChatCompletions({
        apiKey, baseUrl, model, messages,
        max_tokens: 2200, temperature: 0.25
      });

      out += part + "\n\n";
    }

    setStatus(statusBoxId, "", false);
    return out.trim();
  }

  async function chat(question, fullText, statusBoxId){
    const { apiKey, baseUrl, model, language } = getSettingsOrThrow();

    setStatus(statusBoxId, "جاري إرسال السؤال...", true);

    // قص السياق إذا كان ضخمًا
    let ctx = fullText || "";
    const maxContext = 12000;
    if (ctx.length > maxContext){
      ctx = ctx.slice(0, 6000) + "\n\n...\n\n" + ctx.slice(-6000);
    }

    const messages = [
      { role:"system", content:"أجب اعتمادًا على النص فقط. إذا لم تجد الإجابة في النص قل ذلك بوضوح." },
      { role:"user", content:`السؤال: ${question}\n\nالنص المرجعي:\n${ctx}\n\nاللغة: ${language === "ar" ? "العربية" : "English"}.` }
    ];

    const ans = await callChatCompletions({
      apiKey, baseUrl, model, messages,
      max_tokens: 1200, temperature: 0.25
    });

    setStatus(statusBoxId, "", false);
    return ans;
  }

  // ---- Export PDF via Print (fix Arabic symbols) ----
  function exportPdfViaPrint(title, text){
    const rtl = detectRTL(text);
    const dir = rtl ? "rtl" : "ltr";

    const w = window.open("", "_blank");
    if (!w){
      alert("المتصفح منع نافذة التصدير. فعّل السماح بالنوافذ المنبثقة (Pop-ups) ثم أعد المحاولة.");
      return;
    }

    w.document.open();
    w.document.write(`<!doctype html>
<html lang="ar" dir="${dir}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
  body{font-family: system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif; padding:24px;}
  h1{margin:0 0 12px; font-size:18px;}
  pre{white-space:pre-wrap; line-height:1.7; font-size:14px;}
</style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <pre>${escapeHtml(text)}</pre>
  <script>setTimeout(()=>window.print(), 450);</script>
</body></html>`);
    w.document.close();
  }

  // ---- Export DOCX ----
  function getHtmlToDocxFn(){
    // مكتبة html-to-docx-rtl UMD عادة تضعها كـ window.htmlToDocx
    const fn = window.htmlToDocx || window.HtmlToDocx || window.htmlToDocx?.default;
    return fn || null;
  }

  function downloadBlob(filename, blob){
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href), 1500);
  }

  async function exportDocx(filename, title, text){
    const fn = getHtmlToDocxFn();
    if (!fn) throw new Error("مكتبة DOCX لم تُحمّل. تأكد من وجود html-to-docx-rtl في index.html.");

    const rtl = detectRTL(text);
    const dir = rtl ? "rtl" : "ltr";
    const html = `
      <div dir="${dir}" style="font-family: Arial; line-height:1.8;">
        <h2>${escapeHtml(title)}</h2>
        <div style="white-space:pre-wrap; font-size:14px;">${escapeHtml(text)}</div>
      </div>
    `;
    const blob = await fn(html, { direction: dir });
    downloadBlob(filename, blob);
  }

  // ---- UI: Tabs, Drawer, Sheet ----
  function showTab(name){
    document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b.dataset.tab === name));
    ["text","summary","chat"].forEach(n => {
      const el = $(`page-${n}`);
      if (el) el.classList.toggle("active", n === name);
    });
  }

  function openSettings(open){
    $("overlay")?.classList.toggle("show", !!open);
    $("settingsDrawer")?.classList.toggle("show", !!open);
  }

  function openExport(open){
    $("overlay")?.classList.toggle("show", !!open);
    $("exportSheet")?.classList.toggle("show", !!open);
  }

  // ---- Init ----
  function init(){
    console.log("app_ocr.js loaded v" + APP_VERSION);

    loadSettings();

    // Global error to avoid "buttons dead" silently
    window.addEventListener("error", (e) => {
      console.error(e.error || e.message);
      setStatus("statusBox", `خطأ: ${e.message || "غير معروف"}`, true);
    });
    window.addEventListener("unhandledrejection", (e) => {
      console.error(e.reason);
      setStatus("statusBox", `خطأ: ${e.reason?.message || e.reason || "Promise error"}`, true);
    });

    // Tabs
    document.querySelectorAll(".tab").forEach(btn => {
      btn.addEventListener("click", () => showTab(btn.dataset.tab));
    });

    // Settings drawer
    $("btnSettings")?.addEventListener("click", ()=> openSettings(true));
    $("btnCloseSettings")?.addEventListener("click", ()=> openSettings(false));

    // Export sheet
    $("btnExport")?.addEventListener("click", ()=> openExport(true));
    $("btnCloseExport")?.addEventListener("click", ()=> openExport(false));

    // Overlay click closes both
    $("overlay")?.addEventListener("click", () => {
      openSettings(false);
      openExport(false);
    });

    // Save settings
    $("saveSettingsBtn")?.addEventListener("click", saveSettings);

    // Pick PDF
    $("btnPickPdf")?.addEventListener("click", ()=> $("pdfFile")?.click());
    $("pdfFile")?.addEventListener("change", () => {
      const f = $("pdfFile")?.files?.[0];
      $("pdfName").textContent = f ? f.name : "لم يتم اختيار ملف";
    });

    // Clear buttons
    $("clearTextBtn")?.addEventListener("click", ()=> { $("textInput").value=""; });
    $("clearSummaryBtn")?.addEventListener("click", ()=> { $("summaryOutput").value=""; });
    $("clearChatBtn")?.addEventListener("click", ()=> { $("chatLog").textContent=""; });

    // Extract
    $("extractPdfBtn")?.addEventListener("click", async () => {
      try{
        const file = $("pdfFile")?.files?.[0];
        if (!file) return alert("اختر ملف PDF أولاً.");

        const useOcr = !!$("ocrToggle")?.checked;
        const btn = $("extractPdfBtn");
        btn.disabled = true;
        btn.textContent = "جارٍ الاستخراج...";

        const text = await extractTextFromPDF(file, useOcr, "statusBox");
        $("textInput").value = text;

        if (!useOcr && (text.length < 30)){
          alert("تم الاستخراج لكن الناتج ضعيف/فارغ. جرّب تفعيل OCR ثم أعد الاستخراج.");
        } else {
          alert(useOcr ? "اكتمل OCR." : "تم استخراج النص.");
        }
      } catch(err){
        alert(err.message || String(err));
      } finally {
        setStatus("statusBox","",false);
        const btn = $("extractPdfBtn");
        btn.disabled = false;
        btn.textContent = "استخراج";
      }
    });

    // Summarize
    $("summarizeBtn")?.addEventListener("click", async () => {
      try{
        const text = ($("textInput")?.value || "").trim();
        if (!text) return alert("لا يوجد نص للتلخيص. استخرج/ألصق النص أولاً.");

        const btn = $("summarizeBtn");
        btn.disabled = true;
        btn.textContent = "جارٍ التلخيص...";

        const sum = await summarize(text, "statusBox2");
        $("summaryOutput").value = sum;
        showTab("summary");
        alert("تم التلخيص بنجاح.");
      } catch(err){
        alert(err.message || String(err));
      } finally {
        setStatus("statusBox2","",false);
        const btn = $("summarizeBtn");
        btn.disabled = false;
        btn.textContent = "تلخيص قوي";
      }
    });

    // Chat
    $("chatSendBtn")?.addEventListener("click", async () => {
      try{
        const question = ($("chatInput")?.value || "").trim();
        if (!question) return alert("اكتب سؤالك أولاً.");

        const text = ($("textInput")?.value || "").trim();
        if (!text) return alert("لا يوجد نص مرجعي. استخرج/ألصق النص أولاً.");

        $("chatLog").textContent += `أنت: ${question}\n`;
        $("chatInput").value = "";

        const btn = $("chatSendBtn");
        btn.disabled = true;
        btn.textContent = "جارٍ الإرسال...";

        const ans = await chat(question, text, "statusBox3");
        $("chatLog").textContent += `النظام: ${ans}\n\n`;
        $("chatLog").scrollTop = $("chatLog").scrollHeight;
      } catch(err){
        alert(err.message || String(err));
      } finally {
        setStatus("statusBox3","",false);
        const btn = $("chatSendBtn");
        btn.disabled = false;
        btn.textContent = "إرسال";
      }
    });

    // Export actions
    $("exportTextPdfBtn")?.addEventListener("click", () => {
      const text = ($("textInput")?.value || "").trim();
      if (!text) return alert("لا يوجد تفريغ لتصديره.");
      openExport(false);
      exportPdfViaPrint("Extracted Text", text);
    });

    $("exportSummaryPdfBtn")?.addEventListener("click", () => {
      const sum = ($("summaryOutput")?.value || "").trim();
      if (!sum) return alert("لا يوجد ملخص لتصديره.");
      openExport(false);
      exportPdfViaPrint("Summary", sum);
    });

    $("exportTextDocxBtn")?.addEventListener("click", async () => {
      try{
        const text = ($("textInput")?.value || "").trim();
        if (!text) return alert("لا يوجد تفريغ لتصديره.");
        openExport(false);
        await exportDocx("extracted_text.docx", "Extracted Text", text);
      } catch(err){
        alert(err.message || String(err));
      }
    });

    $("exportSummaryDocxBtn")?.addEventListener("click", async () => {
      try{
        const sum = ($("summaryOutput")?.value || "").trim();
        if (!sum) return alert("لا يوجد ملخص لتصديره.");
        openExport(false);
        await exportDocx("summary.docx", "Summary", sum);
      } catch(err){
        alert(err.message || String(err));
      }
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
