// ========= أدوات واجهة =========
function setStatus(msg, show = true) {
  const box = document.getElementById('statusBox');
  if (!box) return;
  box.style.display = show ? 'block' : 'none';
  box.textContent = msg || '';
}

function sanitizeApiKey(k) {
  // إزالة مسافات/أسطر + محارف غير مرئية شائعة
  return (k || '')
    .replace(/\s+/g, '')
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, '');
}

function isAsciiOnly(str) {
  return /^[\x00-\x7F]+$/.test(str);
}

// ========= تحميل/حفظ الإعدادات =========
(function loadSettings() {
  const savedApiKey = localStorage.getItem('apiKey');
  const savedBaseUrl = localStorage.getItem('baseUrl');
  const savedModel = localStorage.getItem('model');
  const savedLanguage = localStorage.getItem('language');
  const savedOcrLang = localStorage.getItem('ocrLang');

  if (savedApiKey && document.getElementById('apiKey')) document.getElementById('apiKey').value = savedApiKey;
  if (savedBaseUrl && document.getElementById('baseUrl')) document.getElementById('baseUrl').value = savedBaseUrl;
  if (savedModel && document.getElementById('model')) document.getElementById('model').value = savedModel;
  if (savedLanguage && document.getElementById('language')) document.getElementById('language').value = savedLanguage;
  if (savedOcrLang && document.getElementById('ocrLang')) document.getElementById('ocrLang').value = savedOcrLang;
})();

// ========= تهيئة pdf.js و jsPDF =========
const pdfjsLib = window.pdfjsLib;
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
const { jsPDF } = window.jspdf;

// ========= OCR Language Selection =========
function getOcrLangSelection() {
  const sel = document.getElementById('ocrLang');
  const v = (sel && sel.value ? sel.value : 'auto').trim();

  // AUTO = ara+eng (عملياً يقرأ الاثنين ويعطي أفضل “اكتشاف”)
  if (v === 'auto') return 'ara+eng';
  return v; // ara أو eng أو ara+eng أو eng+ara
}

// ========= استخراج النص =========
async function extractTextFromPDF(file, useOcr = false) {
  const typedarray = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;

  let fullText = '';
  const ocrLangs = getOcrLangSelection();

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);

    if (useOcr) {
      setStatus(`OCR جاري تنفيذ التعرف... صفحة ${pageNum}/${pdf.numPages}`, true);

      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');

      await page.render({ canvasContext: ctx, viewport }).promise;

      try {
        const result = await Tesseract.recognize(canvas, ocrLangs, {
          logger: (m) => {
            // تحديث خفيف للحالة
            if (m && m.status) {
              const pct = m.progress ? Math.round(m.progress * 100) : null;
              setStatus(`OCR: ${m.status}${pct !== null ? ` (${pct}%)` : ''} — صفحة ${pageNum}/${pdf.numPages}`, true);
            }
          }
        });

        const text = (result && result.data && result.data.text) ? result.data.text : '';
        fullText += text + '\n\n';
      } catch (err) {
        console.error('OCR error:', err);
        throw new Error('فشل OCR: ' + err.message);
      }
    } else {
      setStatus(`استخراج نص عادي... صفحة ${pageNum}/${pdf.numPages}`, true);

      const content = await page.getTextContent();
      const strings = content.items.map(it => it.str);
      const pageText = strings.join(' ').trim();

      fullText += pageText + '\n\n';
    }
  }

  setStatus('', false);
  return fullText.trim();
}

// ========= تقسيم النص =========
function chunkText(text, maxLength = 8000) {
  const chunks = [];
  for (let i = 0; i < text.length; i += maxLength) {
    chunks.push(text.slice(i, i + maxLength));
  }
  return chunks;
}

// ========= استدعاء OpenAI (تلخيص/دردشة) =========
async function callChatCompletions({ apiKey, baseUrl, model, messages, max_tokens = 2048, temperature = 0.3 }) {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({ model, messages, max_tokens, temperature })
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`API Error: ${res.status} ${res.statusText}${txt ? `\n${txt}` : ''}`);
  }

  const data = await res.json();
  const choice = data.choices && data.choices[0];
  return (choice && choice.message && choice.message.content) ? choice.message.content.trim() : '';
}

async function summarizeText(text, apiKey, baseUrl, model, language) {
  const chunks = chunkText(text, 8000);
  let out = '';

  for (let i = 0; i < chunks.length; i++) {
    setStatus(`تلخيص... جزء ${i + 1}/${chunks.length}`, true);

    const chunk = chunks[i];
    const messages = [
      {
        role: 'system',
        content:
          'أنت مساعد ذكي تلخص النصوص بدقة. أنشئ ملخصًا قويًا ومنظمًا: ملخص تنفيذي، نقاط رئيسية، مخطط/هيكل، أفكار وتطبيقات عملية، ومصطلحات مهمة. لا تكثر الحشو.'
      },
      {
        role: 'user',
        content:
          `النص:\n${chunk}\n\nاكتب الملخص باللغة: ${language === 'ar' ? 'العربية' : 'English'}.`
      }
    ];

    const part = await callChatCompletions({
      apiKey,
      baseUrl,
      model,
      messages,
      max_tokens: 4096,
      temperature: 0.25
    });

    out += part + '\n\n';
  }

  setStatus('', false);
  return out.trim();
}

async function chatWithPdf(question, text, apiKey, baseUrl, model, language) {
  setStatus('جاري إرسال السؤال...', true);

  // إذا كان النص طويل جدًا، نرسل آخر جزء + أول جزء (حل بسيط)
  const maxContext = 12000;
  let ctx = text;
  if (ctx.length > maxContext) {
    const head = ctx.slice(0, 6000);
    const tail = ctx.slice(-6000);
    ctx = head + '\n\n...\n\n' + tail;
  }

  const messages = [
    {
      role: 'system',
      content: 'أجب عن أسئلة المستخدم اعتمادًا على النص فقط. إذا لم تجد الإجابة في النص قل ذلك بوضوح.'
    },
    {
      role: 'user',
      content:
        `السؤال: ${question}\n\nالنص المرجعي:\n${ctx}\n\nاللغة المطلوبة: ${language === 'ar' ? 'العربية' : 'English'}.`
    }
  ];

  const ans = await callChatCompletions({
    apiKey,
    baseUrl,
    model,
    messages,
    max_tokens: 1200,
    temperature: 0.25
  });

  setStatus('', false);
  return ans;
}

// ========= PDF Export =========
function exportToPdf(filename, text) {
  const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
  const lines = doc.splitTextToSize(text, 520);
  let y = 48;
  doc.setFontSize(12);

  lines.forEach((line) => {
    if (y > 790) {
      doc.addPage();
      y = 48;
    }
    doc.text(line, 40, y);
    y += 16;
  });

  doc.save(filename);
}

// ========= ربط الأزرار =========
const extractBtn = document.getElementById('extractPdfBtn');
const summarizeBtn = document.getElementById('summarizeBtn');
const exportPdfBtn = document.getElementById('exportPdfBtn');
const exportTextBtn = document.getElementById('exportTextBtn');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const chatSendBtn = document.getElementById('chatSendBtn');
const chatLog = document.getElementById('chatLog');

function getSettingsOrThrow() {
  const apiKeyRaw = document.getElementById('apiKey')?.value || '';
  const apiKey = sanitizeApiKey(apiKeyRaw);
  const baseUrl = (document.getElementById('baseUrl')?.value || '').trim();
  const model = (document.getElementById('model')?.value || '').trim();
  const language = document.getElementById('language')?.value || 'ar';

  if (!apiKey) throw new Error('يرجى إدخال API key');
  if (!isAsciiOnly(apiKey)) throw new Error('API key يجب أن يكون إنجليزي فقط (بدون أحرف عربية/رموز).');
  if (!baseUrl) throw new Error('Base URL فارغ');
  if (!model) throw new Error('Model فارغ');

  return { apiKey, baseUrl, model, language };
}

// استخراج النص
extractBtn?.addEventListener('click', async () => {
  try {
    const file = document.getElementById('pdfFile')?.files?.[0];
    if (!file) return alert('يرجى اختيار ملف PDF أولاً');

    const useOcr = !!document.getElementById('ocrToggle')?.checked;

    extractBtn.disabled = true;
    extractBtn.textContent = 'جارٍ الاستخراج...';

    const text = await extractTextFromPDF(file, useOcr);

    document.getElementById('textInput').value = text;

    alert(useOcr ? 'اكتمل OCR.' : 'تم استخراج النص.');
  } catch (e) {
    alert(e.message || String(e));
  } finally {
    setStatus('', false);
    extractBtn.disabled = false;
    extractBtn.textContent = 'إستخراج نص PDF';
  }
});

// تصدير النص المستخرج
exportTextBtn?.addEventListener('click', () => {
  const text = (document.getElementById('textInput')?.value || '').trim();
  if (!text) return alert('لا يوجد نص لتصديره');
  exportToPdf('extracted_text.pdf', text);
});

// تلخيص
summarizeBtn?.addEventListener('click', async () => {
  try {
    const { apiKey, baseUrl, model, language } = getSettingsOrThrow();
    const text = (document.getElementById('textInput')?.value || '').trim();
    if (!text) return alert('يرجى استخراج النص أو لصقه أولاً');

    summarizeBtn.disabled = true;
    summarizeBtn.textContent = 'جارٍ التلخيص...';

    const summary = await summarizeText(text, apiKey, baseUrl, model, language);
    document.getElementById('result').textContent = summary;

    alert('تم التلخيص بنجاح');
  } catch (e) {
    alert(e.message || String(e));
  } finally {
    setStatus('', false);
    summarizeBtn.disabled = false;
    summarizeBtn.textContent = 'تلخيص قوي';
  }
});

// تصدير الملخص
exportPdfBtn?.addEventListener('click', () => {
  const summary = (document.getElementById('result')?.textContent || '').trim();
  if (!summary) return alert('لا يوجد ملخص للتصدير');
  exportToPdf('summary.pdf', summary);
});

// حفظ الإعدادات
saveSettingsBtn?.addEventListener('click', () => {
  const apiKeyVal = sanitizeApiKey(document.getElementById('apiKey')?.value || '');
  const baseUrlVal = (document.getElementById('baseUrl')?.value || '').trim();
  const modelVal = (document.getElementById('model')?.value || '').trim();
  const langVal = document.getElementById('language')?.value || 'ar';
  const ocrLangVal = document.getElementById('ocrLang')?.value || 'auto';

  localStorage.setItem('apiKey', apiKeyVal);
  localStorage.setItem('baseUrl', baseUrlVal);
  localStorage.setItem('model', modelVal);
  localStorage.setItem('language', langVal);
  localStorage.setItem('ocrLang', ocrLangVal);

  alert('تم حفظ الإعدادات.');
});

// الدردشة
chatSendBtn?.addEventListener('click', async () => {
  try {
    const { apiKey, baseUrl, model, language } = getSettingsOrThrow();

    const question = (document.getElementById('chatInput')?.value || '').trim();
    if (!question) return alert('اكتب سؤالك أولاً');

    const text = (document.getElementById('textInput')?.value || '').trim();
    if (!text) return alert('لا يوجد نص للرجوع إليه. استخرج النص أو الصقه أولاً.');

    // عرض سؤال المستخدم
    chatLog.textContent += `أنت: ${question}\n`;
    document.getElementById('chatInput').value = '';

    chatSendBtn.disabled = true;
    chatSendBtn.textContent = 'جارٍ الإرسال...';

    const answer = await chatWithPdf(question, text, apiKey, baseUrl, model, language);

    chatLog.textContent += `النظام: ${answer}\n\n`;
    chatLog.scrollTop = chatLog.scrollHeight;
  } catch (e) {
    alert(e.message || String(e));
  } finally {
    setStatus('', false);
    chatSendBtn.disabled = false;
    chatSendBtn.textContent = 'إرسال السؤال';
  }
});
