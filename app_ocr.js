// تحميل الإعدادات المحفوظة من localStorage عند تحميل الصفحة
(function loadSettings() {
  const savedApiKey = localStorage.getItem('apiKey');
  const savedBaseUrl = localStorage.getItem('baseUrl');
  const savedModel = localStorage.getItem('model');
  const savedLanguage = localStorage.getItem('language');
  if (savedApiKey) document.getElementById('apiKey').value = savedApiKey;
  if (savedBaseUrl) document.getElementById('baseUrl').value = savedBaseUrl;
  if (savedModel) document.getElementById('model').value = savedModel;
  if (savedLanguage) document.getElementById('language').value = savedLanguage;
})();

// تهيئة pdf.js و jsPDF
const pdfjsLib = window.pdfjsLib;
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
const { jsPDF } = window.jspdf;

// دالة استخراج النص من PDF مع خيار OCR
async function extractTextFromPDF(file, useOcr = false) {
  const typedarray = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
  let fullText = '';
  // تحديد لغة OCR: ara للغة العربية، eng للإنجليزية
  const langSelect = document.getElementById('language');
  const ocrLang = langSelect && langSelect.value === 'ar' ? 'ara' : 'eng';
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    if (useOcr) {
      // رسم الصفحة على Canvas
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const context = canvas.getContext('2d');
      await page.render({ canvasContext: context, viewport: viewport }).promise;
      // التعرف على النص باستخدام Tesseract.js
      try {
        const result = await Tesseract.recognize(canvas, ocrLang);
        fullText += (result.data && result.data.text ? result.data.text : '') + '\n\n';
      } catch (err) {
        console.error('OCR error:', err);
        alert('حدث خطأ أثناء عملية OCR: ' + err.message);
      }
    } else {
      // استخراج النص مباشرة باستخدام pdf.js
      const content = await page.getTextContent();
      const strings = content.items.map(item => item.str);
      fullText += strings.join(' ') + '\n\n';
    }
  }
  return fullText;
}

// تقسيم النص إلى أجزاء لتجنّب تجاوز الحد الأقصى للطول
function chunkText(text, maxLength = 8000) {
  const chunks = [];
  for (let i = 0; i < text.length; i += maxLength) {
    chunks.push(text.slice(i, i + maxLength));
  }
  return chunks;
}

// دالة تلخيص النص باستخدام OpenAI API
async function summarizeText(text, apiKey, baseUrl, model, language) {
  const chunks = chunkText(text, 8000);
  let summary = '';
  for (const chunk of chunks) {
    const messages = [
      {
        role: 'system',
        content:
          'أنت مساعد ذكي تلخص النصوص بشكل دقيق. قم بإنشاء ملخص قوي ومنظم للكتاب مع: ملخص تنفيذي، نقاط رئيسية، مخطط للفصول، توصيات عملية، مصطلحات رئيسية، ودليل بأمثلة أو اقتباسات داعمة. يجب أن تكون النتائج باللغة المحددة.'
      },
      {
        role: 'user',
        content:
          `نص الكتاب:\n\n${chunk}\n\nاللغة المطلوبة للملخص: ${language === 'ar' ? 'العربية' : 'English'}\n\nالرجاء إنشاء الملخص.`
      }
    ];
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        max_tokens: 4096,
        temperature: 0.3
      })
    });
    if (!response.ok) {
      throw new Error('خطأ في استدعاء API: ' + response.statusText);
    }
    const data = await response.json();
    const choice = data.choices && data.choices[0];
    if (choice && choice.message) {
      summary += choice.message.content.trim() + '\n\n';
    }
  }
  return summary;
}

// دالة للدردشة مع النص: ترسل سؤال المستخدم والنص الكامل إلى الموديل
async function chatWithPdf(question, text, apiKey, baseUrl, model, language) {
  const messages = [
    {
      role: 'system',
      content:
        'أنت مساعد ذكي يجيب على الأسئلة بناءً على النص المقدم. اعطِ إجابة واضحة وداعمة، واستخدم اللغة المطلوبة.'
    },
    {
      role: 'user',
      content:
        `السؤال: ${question}\n\nالنص:\n${text}\n\nاللغة: ${language === 'ar' ? 'العربية' : 'English'}. أجب عن السؤال استنادًا إلى النص.`
    }
  ];
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      max_tokens: 2048,
      temperature: 0.3
    })
  });
  if (!response.ok) {
    throw new Error('خطأ في استدعاء API: ' + response.statusText);
  }
  const data = await response.json();
  const choice = data.choices && data.choices[0];
  return choice && choice.message ? choice.message.content.trim() : '';
}

// واجهات المستخدم: أزرار وأحداث
const extractBtn = document.getElementById('extractPdfBtn');
const summarizeBtn = document.getElementById('summarizeBtn');
const exportPdfBtn = document.getElementById('exportPdfBtn');
const exportTextBtn = document.getElementById('exportTextBtn');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const chatSendBtn = document.getElementById('chatSendBtn');
const chatLog = document.getElementById('chatLog');

// معالجة الضغط على زر استخراج النص
extractBtn.addEventListener('click', async () => {
  const fileInput = document.getElementById('pdfFile');
  const file = fileInput.files[0];
  if (!file) {
    alert('يرجى اختيار ملف PDF أولاً');
    return;
  }
  const useOcr = document.getElementById('ocrToggle').checked;
  extractBtn.disabled = true;
  extractBtn.innerText = 'جارٍ استخراج النص...';
  try {
    const text = await extractTextFromPDF(file, useOcr);
    document.getElementById('textInput').value = text;
    alert(useOcr ? 'اكتمل التعرف على النص بواسطة OCR.' : 'تم استخراج النص من ملف PDF.');
  } catch (err) {
    alert('فشل استخراج النص: ' + err.message);
  } finally {
    extractBtn.disabled = false;
    extractBtn.innerText = 'إستخراج نص PDF';
  }
});

// تصدير النص الأصلى إلى PDF
exportTextBtn.addEventListener('click', () => {
  const text = document.getElementById('textInput').value.trim();
  if (!text) {
    alert('لا يوجد نص لتصديره');
    return;
  }
  const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
  const lines = doc.splitTextToSize(text, 520);
  let y = 40;
  doc.setFontSize(12);
  lines.forEach((line) => {
    if (y > 780) {
      doc.addPage();
      y = 40;
    }
    doc.text(line, 40, y, { lang: 'ar' });
    y += 16;
  });
  doc.save('extracted_text.pdf');
});

// تصدير الملخص إلى PDF
exportPdfBtn.addEventListener('click', () => {
  const result = document.getElementById('result').innerText.trim();
  if (!result) {
    alert('لا يوجد ملخص للتصدير');
    return;
  }
  const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
  const lines = doc.splitTextToSize(result, 520);
  let y = 40;
  doc.setFontSize(12);
  lines.forEach((line) => {
    if (y > 780) {
      doc.addPage();
      y = 40;
    }
    doc.text(line, 40, y, { lang: 'ar' });
    y += 16;
  });
  doc.save('summary.pdf');
});

// معالجة الضغط على زر التلخيص
summarizeBtn.addEventListener('click', async () => {
  const apiKey = document.getElementById('apiKey').value.trim();
  const baseUrl = document.getElementById('baseUrl').value.trim();
  const model = document.getElementById('model').value.trim();
  const language = document.getElementById('language').value;
  const text = document.getElementById('textInput').value.trim();
  if (!apiKey) {
    alert('يرجى إدخال API key');
    return;
  }
  // التأكد من أن مفتاح API يضم أحرفًا وأرقامًا إنجليزية فقط
  if (!/^[\x00-\x7F]+$/.test(apiKey)) {
    alert('الـ API key يجب أن يكون مكوّنًا من أحرف وأرقام إنجليزية فقط بدون مسافات أو أحرف عربية.');
    return;
  }
  if (!text) {
    alert('يرجى لصق نص أو رفع ملف');
    return;
  }
  summarizeBtn.disabled = true;
  summarizeBtn.innerText = 'جارٍ التلخيص...';
  try {
    const summary = await summarizeText(text, apiKey, baseUrl, model, language);
    document.getElementById('result').innerText = summary;
    alert('تم التلخيص بنجاح');
  } catch (err) {
    alert('حدث خطأ أثناء التلخيص: ' + err.message);
  } finally {
    summarizeBtn.disabled = false;
    summarizeBtn.innerText = 'تلخيص قوي';
  }
});

// حفظ الإعدادات
saveSettingsBtn.addEventListener('click', () => {
  localStorage.setItem('apiKey', document.getElementById('apiKey').value.trim());
  localStorage.setItem('baseUrl', document.getElementById('baseUrl').value.trim());
  localStorage.setItem('model', document.getElementById('model').value.trim());
  localStorage.setItem('language', document.getElementById('language').value);
  alert('تم حفظ الإعدادات.');
});

// الدردشة مع النص
chatSendBtn.addEventListener('click', async () => {
  const question = document.getElementById('chatInput').value.trim();
  const text = document.getElementById('textInput').value.trim();
  const apiKey = document.getElementById('apiKey').value.trim();
  const baseUrl = document.getElementById('baseUrl').value.trim();
  const model = document.getElementById('model').value.trim();
  const language = document.getElementById('language').value;
  if (!question) {
    alert('اكتب سؤالك أولاً');
    return;
  }
  if (!apiKey) {
    alert('يرجى إدخال API key');
    return;
  }
  // التأكد من أن المفتاح صحيح الشكل
  if (!/^[\x00-\x7F]+$/.test(apiKey)) {
    alert('الـ API key يجب أن يكون مكوّنًا من أحرف وأرقام إنجليزية فقط.');
    return;
  }
  if (!text) {
    alert('لا يوجد نص للرجوع إليه. يرجى استخراج النص أولاً أو لصقه.');
    return;
  }
  // عرض السؤال في سجل الدردشة
  chatLog.innerText += `أنت: ${question}\n`;
  document.getElementById('chatInput').value = '';
  chatSendBtn.disabled = true;
  chatSendBtn.innerText = 'جارٍ الإرسال...';
  try {
    const answer = await chatWithPdf(question, text, apiKey, baseUrl, model, language);
    chatLog.innerText += `النظام: ${answer}\n`;
    chatLog.scrollTop = chatLog.scrollHeight;
  } catch (err) {
    alert('حدث خطأ أثناء الدردشة: ' + err.message);
  } finally {
    chatSendBtn.disabled = false;
    chatSendBtn.innerText = 'إرسال السؤال';
  }
});
