// تهيئة PDF.js
const pdfjsLib = window.pdfjsLib;
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
// استخراج jsPDF
const { jsPDF } = window.jspdf;

// دالة استخراج النص من PDF
async function extractTextFromPDF(file, useOcr = false) {
  const typedarray = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
  let fullText = '';
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const strings = content.items.map(item => item.str);
    fullText += strings.join(' ') + '\n\n';
  }
  if (useOcr) {
    alert('OCR غير مدعوم حالياً. سيتم استخدام النص المستخرج فقط.');
  }
  return fullText;
}

// تقسيم النص إلى أجزاء للحفاظ على الحد الأقصى للطول
function chunkText(text, maxLength = 8000) {
  const chunks = [];
  for (let i = 0; i < text.length; i += maxLength) {
    chunks.push(text.slice(i, i + maxLength));
  }
  return chunks;
}

// دالة تلخيص النص باستخدام API
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

// حدث استخراج النص من PDF
document.getElementById('extractPdfBtn').addEventListener('click', async () => {
  const fileInput = document.getElementById('pdfFile');
  const file = fileInput.files[0];
  if (!file) {
    alert('يرجى اختيار ملف PDF أولاً');
    return;
  }
  const useOcr = document.getElementById('ocrToggle').checked;
  document.getElementById('extractPdfBtn').disabled = true;
  document.getElementById('extractPdfBtn').innerText = 'جارٍ استخراج النص...';
  try {
    const text = await extractTextFromPDF(file, useOcr);
    document.getElementById('textInput').value = text;
    alert('تم استخراج النص من ملف PDF. يمكنك الآن تلخيصه.');
  } catch (err) {
    alert('فشل استخراج النص: ' + err.message);
  } finally {
    document.getElementById('extractPdfBtn').disabled = false;
    document.getElementById('extractPdfBtn').innerText = 'إستخراج نص PDF';
  }
});

// حدث التلخيص
document.getElementById('summarizeBtn').addEventListener('click', async () => {
  const apiKey = document.getElementById('apiKey').value.trim();
  const baseUrl = document.getElementById('baseUrl').value.trim();
  const model = document.getElementById('model').value.trim();
  const language = document.getElementById('language').value;
  const text = document.getElementById('textInput').value.trim();
  if (!apiKey) {
    alert('يرجى إدخال API key');
    return;
  }
  if (!text) {
    alert('يرجى لصق نص أو رفع ملف');
    return;
  }
  document.getElementById('summarizeBtn').disabled = true;
  document.getElementById('summarizeBtn').innerText = 'جارٍ التلخيص...';
  try {
    const summary = await summarizeText(text, apiKey, baseUrl, model, language);
    document.getElementById('result').innerText = summary;
    alert('تم التلخيص بنجاح');
  } catch (err) {
    alert('حدث خطأ أثناء التلخيص: ' + err.message);
  } finally {
    document.getElementById('summarizeBtn').disabled = false;
    document.getElementById('summarizeBtn').innerText = 'تلخيص قوي';
  }
});

// حدث تصدير الملخص PDF
document.getElementById('exportPdfBtn').addEventListener('click', () => {
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
