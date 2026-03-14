const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const encoder = new TextEncoder();
const crcTable = buildCrc32Table();

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return withCors(new Response(null, { status: 204 }), env);
    }

    try {
      if (url.pathname === "/health" && request.method === "GET") {
        return withCors(jsonResponse(buildHealth(env)), env);
      }

      enforceClientToken(request, env);

      if (url.pathname === "/ocr" && request.method === "POST") {
        return withCors(await handleOcr(request, env), env);
      }

      if (url.pathname === "/convert/pdf-to-docx" && request.method === "POST") {
        return withCors(await handlePdfToDocx(request, env), env);
      }

      return withCors(errorResponse(404, "NOT_FOUND", "المسار المطلوب غير موجود."), env);
    } catch (err) {
      if (err instanceof Response) return withCors(err, env);
      return withCors(
        errorResponse(500, "UNHANDLED_ERROR", String(err?.message || err || "Unexpected worker failure")),
        env
      );
    }
  }
};

function buildHealth(env) {
  const limits = resolveBudgetLimits(env, "balanced");
  const ocrReady = Boolean(String(env.OCR_UPSTREAM_URL || "").trim() || String(env.OPENROUTER_API_KEY || "").trim());
  const docxUpstreamReady = Boolean(String(env.DOCX_UPSTREAM_URL || "").trim());
  return {
    ok: true,
    service: "sadam-convert",
    configured: true,
    ready: true,
    docxReady: true,
    docxMode: docxUpstreamReady ? "upstream" : "structured",
    fidelityReady: docxUpstreamReady,
    ocrReady,
    message: docxUpstreamReady
      ? (ocrReady
        ? "DOCX fidelity route and OCR are ready."
        : "DOCX fidelity route is ready. OCR cloud path still needs OPENROUTER_API_KEY or OCR_UPSTREAM_URL.")
      : (ocrReady
        ? "DOCX structured route and OCR are ready."
        : "DOCX structured route is ready. OCR cloud path still needs OPENROUTER_API_KEY or OCR_UPSTREAM_URL."),
    limits: {
      maxPdfPages: limits.maxPdfPages,
      maxFileMB: limits.maxFileMB,
      maxOcrImageMB: numberEnv(env, "MAX_OCR_IMAGE_MB", 8)
    },
    budgetModes: ["strict", "balanced", "open"]
  };
}

function enforceClientToken(request, env) {
  const expected = String(env.GATEWAY_CLIENT_TOKEN || "").trim();
  if (!expected) return;
  const provided = String(request.headers.get("X-Client-Token") || "").trim();
  if (!provided || provided !== expected) {
    throw errorResponse(401, "UNAUTHORIZED", "X-Client-Token مفقود أو غير صحيح.");
  }
}

async function handlePdfToDocx(request, env) {
  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== "object") {
    return errorResponse(400, "INVALID_JSON", "تعذر قراءة بيانات التحويل.");
  }

  if (payload.freeMode) {
    return errorResponse(403, "FREE_MODE_BLOCKS_CLOUD", "الوضع المجاني يمنع استخدام التحويل السحابي.");
  }

  const docxUpstream = String(env.DOCX_UPSTREAM_URL || "").trim();
  if (docxUpstream) {
    return proxyDocxUpstream(docxUpstream, payload, env);
  }

  const structured = payload.structured;
  const pages = Array.isArray(structured?.pages) ? structured.pages : [];
  if (!pages.length) {
    return errorResponse(400, "STRUCTURED_PAGES_REQUIRED", "يجب إرسال structured.pages ليتم بناء ملف Word بدقة أعلى.");
  }

  const budgetMode = sanitizeBudgetMode(payload.budgetMode);
  const limits = resolveBudgetLimits(env, budgetMode);
  const pageCount = Math.max(0, Number(payload.pageCount || structured?.totalPages || pages.length || 0));
  const fileSizeMB = Math.max(0, Number(payload.fileSizeMB || 0));

  if (pageCount > limits.maxPdfPages) {
    return errorResponse(
      413,
      "PAGE_LIMIT_EXCEEDED",
      `عدد الصفحات ${pageCount} يتجاوز الحد المسموح (${limits.maxPdfPages}) لهذا الوضع.`,
      { limits }
    );
  }

  if (fileSizeMB && fileSizeMB > limits.maxFileMB) {
    return errorResponse(
      413,
      "FILE_LIMIT_EXCEEDED",
      `حجم الملف ${fileSizeMB.toFixed(1)}MB يتجاوز الحد المسموح (${limits.maxFileMB}MB).`,
      { limits }
    );
  }

  const requestedName = String(payload.fileName || "converted.pdf");
  const title = stripExtension(requestedName);
  const fileName = sanitizeOutputName(requestedName);
  const docxBytes = buildDocxFromStructured(structured, { title });

  return jsonResponse({
    ok: true,
    mode: "structured",
    fileName,
    docxBase64: bytesToBase64(docxBytes),
    text: String(structured?.text || ""),
    pageCount: pageCount || pages.length,
    quality: String(structured?.quality || ""),
    message: "تم بناء ملف DOCX من الهيكل المنظم للصفحات.",
    limits
  });
}

async function proxyDocxUpstream(upstream, payload, env) {
  const fileBase64 = String(payload.fileBase64 || "").replace(/^data:[^,]+,/, "").trim();
  if (!fileBase64) {
    return errorResponse(400, "FILE_BASE64_REQUIRED", "المسار السحابي عالي المطابقة يحتاج ملف PDF خامًا داخل fileBase64.");
  }

  const fileName = String(payload.fileName || "converted.pdf").trim() || "converted.pdf";
  const mimeType = String(payload.mimeType || "application/pdf").trim() || "application/pdf";
  const bytes = decodeBase64Bytes(fileBase64);
  const format = String(env.DOCX_UPSTREAM_FORMAT || "json").trim().toLowerCase();
  const headers = {};
  const token = String(env.DOCX_UPSTREAM_TOKEN || "").trim();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let body = null;
  if (format === "multipart") {
    const form = new FormData();
    form.append("file", new Blob([bytes], { type: mimeType }), fileName);
    form.append("payload", JSON.stringify({
      fileName,
      mimeType,
      pageCount: payload.pageCount || 0,
      fileSizeMB: payload.fileSizeMB || 0,
      preserveLayout: true,
      editable: true,
      rtl: true,
      structured: payload.structured || null
    }));
    body = form;
  } else {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify({
      fileName,
      mimeType,
      fileBase64,
      pageCount: payload.pageCount || 0,
      fileSizeMB: payload.fileSizeMB || 0,
      preserveLayout: true,
      editable: true,
      rtl: true,
      structured: payload.structured || null
    });
  }

  const resp = await fetch(upstream, {
    method: "POST",
    headers,
    body
  });

  if (!resp.ok) {
    const raw = await resp.text().catch(() => "");
    return errorResponse(502, "DOCX_UPSTREAM_FAILED", raw || `DOCX upstream failed with ${resp.status}`);
  }

  const contentType = String(resp.headers.get("content-type") || "").toLowerCase();
  if (contentType.includes("application/json")) {
    const raw = await resp.text();
    let json;
    try {
      json = JSON.parse(raw);
    } catch (_) {
      return errorResponse(502, "DOCX_UPSTREAM_BAD_JSON", "تعذر قراءة استجابة JSON من خدمة التحويل السحابي.");
    }

    const binaryUrl = String(json?.url || json?.fileUrl || json?.data?.url || "").trim();
    if (binaryUrl) {
      return fetchDocxFromUrl(binaryUrl, fileName);
    }

    const directBase64 = String(json?.docxBase64 || json?.fileBase64 || json?.data?.docxBase64 || json?.data?.fileBase64 || "").trim();
    if (!directBase64) {
      return errorResponse(502, "DOCX_UPSTREAM_EMPTY", String(json?.message || json?.error || "خدمة التحويل السحابي لم ترجع ملف Word صالحًا."));
    }

    return jsonResponse({
      ...json,
      ok: json?.ok !== false,
      mode: "upstream",
      fileName: String(json?.fileName || sanitizeOutputName(fileName))
    });
  }

  const buffer = await resp.arrayBuffer();
  const outHeaders = new Headers({
    "Content-Type": DOCX_MIME,
    "Content-Disposition": `attachment; filename="${sanitizeOutputName(fileName)}"`
  });
  return new Response(buffer, { status: 200, headers: outHeaders });
}

async function fetchDocxFromUrl(url, fileName) {
  const resp = await fetch(url);
  if (!resp.ok) {
    return errorResponse(502, "DOCX_URL_FETCH_FAILED", `تعذر تنزيل ملف Word من الرابط المرجع (${resp.status}).`);
  }
  const buffer = await resp.arrayBuffer();
  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": DOCX_MIME,
      "Content-Disposition": `attachment; filename="${sanitizeOutputName(fileName)}"`
    }
  });
}

async function handleOcr(request, env) {
  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== "object") {
    return errorResponse(400, "INVALID_JSON", "تعذر قراءة طلب OCR.");
  }

  const imageBase64 = String(payload.imageBase64 || "").replace(/^data:[^,]+,/, "").trim();
  if (!imageBase64) {
    return errorResponse(400, "IMAGE_REQUIRED", "يجب إرسال imageBase64.");
  }

  const approxImageMB = Math.round(((imageBase64.length * 3) / 4 / 1048576) * 10) / 10;
  const maxImageMB = numberEnv(env, "MAX_OCR_IMAGE_MB", 8);
  if (approxImageMB > maxImageMB) {
    return errorResponse(413, "OCR_IMAGE_TOO_LARGE", `الصورة تتجاوز الحد المسموح OCR (${maxImageMB}MB).`);
  }

  const upstream = String(env.OCR_UPSTREAM_URL || "").trim();
  if (upstream) {
    return proxyOcrUpstream(upstream, payload, env);
  }

  const openRouterKey = String(env.OPENROUTER_API_KEY || "").trim();
  if (!openRouterKey) {
    return errorResponse(503, "OCR_NOT_CONFIGURED", "OCR السحابي غير مهيأ. أضف OCR_UPSTREAM_URL أو OPENROUTER_API_KEY.");
  }

  const mimeType = String(payload.mimeType || "image/png").trim() || "image/png";
  const dataUrl = `data:${mimeType};base64,${imageBase64}`;
  const model = String(env.OCR_MODEL || "openai/gpt-4o-mini").trim();
  const prompt = [
    "Extract all visible text from this image as accurately as possible.",
    "Return plain text only.",
    "Preserve line breaks when they are visually meaningful.",
    `Language hint: ${String(payload.lang || "ara+eng")}`
  ].join("\n");

  const upstreamResp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${openRouterKey}`,
      "HTTP-Referer": String(env.OPENROUTER_REFERER || "https://saddamalkadi.github.io/book-summarizer-pwa/"),
      "X-Title": String(env.OPENROUTER_TITLE || "AI Workspace Studio Convert")
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        {
          role: "system",
          content: "You are a precise OCR engine. Return text only with no commentary."
        },
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: dataUrl } }
          ]
        }
      ]
    })
  });

  const raw = await upstreamResp.text();
  if (!upstreamResp.ok) {
    return errorResponse(502, "OCR_UPSTREAM_FAILED", raw || `OpenRouter OCR failed with ${upstreamResp.status}`);
  }

  let json;
  try {
    json = JSON.parse(raw);
  } catch (_) {
    return errorResponse(502, "OCR_BAD_RESPONSE", "تعذر قراءة استجابة OCR من OpenRouter.");
  }

  const text = extractAssistantText(json).trim();
  return jsonResponse({
    ok: true,
    text,
    model,
    source: "openrouter-vision"
  });
}

async function proxyOcrUpstream(upstream, payload, env) {
  const headers = { "Content-Type": "application/json" };
  const token = String(env.OCR_UPSTREAM_TOKEN || "").trim();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const resp = await fetch(upstream, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });
  const contentType = String(resp.headers.get("content-type") || "").toLowerCase();
  const raw = await resp.text();
  if (!resp.ok) {
    return errorResponse(502, "OCR_UPSTREAM_FAILED", raw || `OCR upstream failed with ${resp.status}`);
  }
  if (contentType.includes("application/json")) {
    return new Response(raw, {
      status: 200,
      headers: { ...JSON_HEADERS }
    });
  }
  return jsonResponse({ ok: true, text: raw, source: "ocr-upstream" });
}

function resolveBudgetLimits(env, mode) {
  const globalMaxPages = numberEnv(env, "MAX_PDF_PAGES", 40);
  const globalMaxFileMB = numberEnv(env, "MAX_FILE_MB", 15);
  if (mode === "strict") {
    return {
      maxPdfPages: Math.min(globalMaxPages, numberEnv(env, "STRICT_PDF_PAGES", 18)),
      maxFileMB: Math.min(globalMaxFileMB, numberEnv(env, "STRICT_FILE_MB", 8))
    };
  }
  if (mode === "open") {
    return {
      maxPdfPages: numberEnv(env, "OPEN_PDF_PAGES", Math.max(globalMaxPages, 60)),
      maxFileMB: numberEnv(env, "OPEN_FILE_MB", Math.max(globalMaxFileMB, 25))
    };
  }
  return {
    maxPdfPages: globalMaxPages,
    maxFileMB: globalMaxFileMB
  };
}

function sanitizeBudgetMode(value) {
  const mode = String(value || "balanced").trim().toLowerCase();
  if (mode === "strict" || mode === "open") return mode;
  return "balanced";
}

function sanitizeOutputName(name) {
  const safe = String(name || "converted")
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\.pdf$/i, "")
    .trim() || "converted";
  return `${safe}.docx`;
}

function stripExtension(name) {
  return String(name || "document").replace(/\.[^.]+$/g, "");
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...JSON_HEADERS }
  });
}

function errorResponse(status, error, message, extra = {}) {
  return jsonResponse({ ok: false, error, message, ...extra }, status);
}

function withCors(response, env) {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", String(env.CORS_ALLOW_ORIGIN || "*"));
  headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Client-Token");
  headers.set("Vary", "Origin");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function numberEnv(env, key, fallback) {
  const value = Number(env[key]);
  return Number.isFinite(value) ? value : fallback;
}

function extractAssistantText(payload) {
  const choice = payload?.choices?.[0];
  if (typeof choice?.message?.content === "string") return choice.message.content;
  if (Array.isArray(choice?.message?.content)) {
    return choice.message.content
      .map((part) => typeof part?.text === "string" ? part.text : (typeof part === "string" ? part : ""))
      .join("\n");
  }
  if (typeof choice?.delta?.content === "string") return choice.delta.content;
  if (Array.isArray(payload?.output)) {
    return payload.output
      .flatMap((item) => Array.isArray(item?.content) ? item.content : [])
      .map((part) => String(part?.text || ""))
      .join("\n");
  }
  return "";
}

function buildDocxFromStructured(structured, options = {}) {
  const pages = Array.isArray(structured?.pages) ? structured.pages : [];
  if (!pages.length) {
    throw new Error("structured.pages is required");
  }

  const firstPage = pages[0] || {};
  const pageWidth = clampTwips(pdfUnitsToTwips(firstPage.width || 595), 9000, 22000);
  const pageHeight = clampTwips(pdfUnitsToTwips(firstPage.height || 842), 9000, 32000);
  const isLandscape = pageWidth > pageHeight;
  const bodyXml = pages.map((page, idx) => buildPageXml(page, idx < pages.length - 1)).join("");
  const created = new Date().toISOString();
  const title = xmlEscape(String(options.title || "Converted Document"));

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w10="urn:schemas-microsoft-com:office:word" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml" mc:Ignorable="w14 w15 wp14">
  <w:body>
    ${bodyXml}
    <w:sectPr>
      <w:pgSz w:w="${pageWidth}" w:h="${pageHeight}"${isLandscape ? ' w:orient="landscape"' : ""}/>
      <w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720" w:header="450" w:footer="450" w:gutter="0"/>
      <w:cols w:space="720"/>
      <w:docGrid w:linePitch="360"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>
        <w:sz w:val="22"/>
        <w:szCs w:val="22"/>
        <w:lang w:val="en-US" w:bidi="ar-SA"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:line="320" w:lineRule="auto"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:spacing w:line="320" w:lineRule="auto"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>
      <w:lang w:val="en-US" w:bidi="ar-SA"/>
    </w:rPr>
  </w:style>
</w:styles>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;

  const documentRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`;

  const settingsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:zoom w:percent="100"/>
  <w:defaultTabStop w:val="720"/>
  <w:characterSpacingControl w:val="doNotCompress"/>
  <w:compat/>
</w:settings>`;

  const coreXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${title}</dc:title>
  <dc:creator>AI Workspace Studio</dc:creator>
  <cp:lastModifiedBy>AI Workspace Studio</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${created}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${created}</dcterms:modified>
</cp:coreProperties>`;

  const appXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>AI Workspace Studio</Application>
  <DocSecurity>0</DocSecurity>
  <ScaleCrop>false</ScaleCrop>
  <HeadingPairs>
    <vt:vector size="2" baseType="variant">
      <vt:variant><vt:lpstr>Pages</vt:lpstr></vt:variant>
      <vt:variant><vt:i4>${pages.length}</vt:i4></vt:variant>
    </vt:vector>
  </HeadingPairs>
  <TitlesOfParts>
    <vt:vector size="${pages.length}" baseType="lpstr">
      ${pages.map((page, idx) => `<vt:lpstr>Page ${idx + 1}</vt:lpstr>`).join("")}
    </vt:vector>
  </TitlesOfParts>
  <Company>AI Workspace Studio</Company>
  <LinksUpToDate>false</LinksUpToDate>
  <SharedDoc>false</SharedDoc>
  <HyperlinksChanged>false</HyperlinksChanged>
  <AppVersion>7.2</AppVersion>
</Properties>`;

  return buildZip([
    { name: "[Content_Types].xml", data: contentTypesXml },
    { name: "_rels/.rels", data: relsXml },
    { name: "docProps/core.xml", data: coreXml },
    { name: "docProps/app.xml", data: appXml },
    { name: "word/document.xml", data: documentXml },
    { name: "word/styles.xml", data: stylesXml },
    { name: "word/settings.xml", data: settingsXml },
    { name: "word/_rels/document.xml.rels", data: documentRelsXml }
  ]);
}

function buildPageXml(page, addPageBreak) {
  const blocks = normalizeBlocks(page);
  const pageWidth = Number(page?.width || 595);
  const body = blocks.map((block) => buildBlockXml(block, pageWidth)).join("");
  return body + (addPageBreak ? pageBreakXml() : "");
}

function normalizeBlocks(page) {
  if (Array.isArray(page?.blocks) && page.blocks.length) return page.blocks;
  if (Array.isArray(page?.lines) && page.lines.length) {
    return [{
      align: "left",
      marginTop: 0,
      xMin: 0,
      xMax: Number(page?.width || 0),
      lines: page.lines.map((line) => ({
        text: String(line?.text || ""),
        lineHeight: Number(line?.lineHeight || 20),
        xMin: Number(line?.xMin || 0),
        xMax: Number(line?.xMax || page?.width || 0)
      }))
    }];
  }
  return [{
    align: "left",
    marginTop: 0,
    xMin: 0,
    xMax: Number(page?.width || 0),
    lines: [{ text: String(page?.text || ""), lineHeight: 20, xMin: 0, xMax: Number(page?.width || 0) }]
  }];
}

function buildBlockXml(block, pageWidth) {
  const leftGap = Math.max(0, Number(block?.xMin || block?.lines?.[0]?.xMin || 0));
  const rightGap = Math.max(0, pageWidth - Number(block?.xMax || block?.lines?.[0]?.xMax || pageWidth));
  const lines = Array.isArray(block?.lines) && block.lines.length ? block.lines : [{ text: "", lineHeight: 20 }];
  return lines.map((line, idx) => buildParagraphXml(String(line?.text || ""), {
    align: block?.align || "left",
    before: idx === 0 ? Number(block?.marginTop || 0) : 0,
    lineHeight: Number(line?.lineHeight || 20),
    leftIndent: leftGap,
    rightIndent: rightGap
  })).join("");
}

function buildParagraphXml(text, options = {}) {
  const rawText = String(text || "");
  const rtl = hasRtl(rawText);
  const safeText = xmlEscape(rawText || " ");
  const before = clampTwips(pdfUnitsToTwips(options.before || 0), 0, 2200);
  const line = clampTwips(pdfUnitsToTwips(options.lineHeight || 18), 240, 720);
  const left = clampTwips(pdfUnitsToTwips(options.leftIndent || 0), 0, 2600);
  const right = clampTwips(pdfUnitsToTwips(options.rightIndent || 0), 0, 2600);
  const align = options.align === "center"
    ? "center"
    : (options.align === "right" || rtl ? "right" : "left");
  const bidi = rtl ? "<w:bidi/>" : "";
  const ind = (left || right) ? `<w:ind w:left="${left}" w:right="${right}"/>` : "";
  const runProps = rtl
    ? `<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:rtl/><w:lang w:val="en-US" w:bidi="ar-SA"/></w:rPr>`
    : `<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:lang w:val="en-US"/></w:rPr>`;
  return `<w:p><w:pPr>${bidi}<w:jc w:val="${align}"/><w:spacing w:before="${before}" w:line="${line}" w:lineRule="auto"/>${ind}</w:pPr><w:r>${runProps}<w:t xml:space="preserve">${safeText}</w:t></w:r></w:p>`;
}

function pageBreakXml() {
  return `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`;
}

function pdfUnitsToTwips(value) {
  return Math.round(Number(value || 0) * 20);
}

function clampTwips(value, min, max) {
  return Math.max(min, Math.min(max, Math.round(Number(value || 0))));
}

function hasRtl(text) {
  return /[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/.test(String(text || ""));
}

function xmlEscape(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildZip(entries) {
  const files = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const dataBytes = typeof entry.data === "string" ? encoder.encode(entry.data) : new Uint8Array(entry.data);
    const crc = crc32(dataBytes);
    const localHeader = createLocalHeader(nameBytes, dataBytes.length, crc);
    files.push(localHeader, dataBytes);
    centralParts.push(createCentralHeader(nameBytes, dataBytes.length, crc, offset));
    offset += localHeader.length + dataBytes.length;
  }

  const centralDirectory = concatBytes(centralParts);
  const endRecord = createEndRecord(entries.length, centralDirectory.length, offset);
  return concatBytes([...files, centralDirectory, endRecord]);
}

function createLocalHeader(nameBytes, size, crc) {
  const out = new Uint8Array(30 + nameBytes.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 0x0800, true);
  view.setUint16(8, 0, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, 0, true);
  view.setUint32(14, crc, true);
  view.setUint32(18, size, true);
  view.setUint32(22, size, true);
  view.setUint16(26, nameBytes.length, true);
  view.setUint16(28, 0, true);
  out.set(nameBytes, 30);
  return out;
}

function createCentralHeader(nameBytes, size, crc, offset) {
  const out = new Uint8Array(46 + nameBytes.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 20, true);
  view.setUint16(8, 0x0800, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, 0, true);
  view.setUint16(14, 0, true);
  view.setUint32(16, crc, true);
  view.setUint32(20, size, true);
  view.setUint32(24, size, true);
  view.setUint16(28, nameBytes.length, true);
  view.setUint16(30, 0, true);
  view.setUint16(32, 0, true);
  view.setUint16(34, 0, true);
  view.setUint16(36, 0, true);
  view.setUint32(38, 0, true);
  view.setUint32(42, offset, true);
  out.set(nameBytes, 46);
  return out;
}

function createEndRecord(count, centralSize, centralOffset) {
  const out = new Uint8Array(22);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(4, 0, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, count, true);
  view.setUint16(10, count, true);
  view.setUint32(12, centralSize, true);
  view.setUint32(16, centralOffset, true);
  view.setUint16(20, 0, true);
  return out;
}

function concatBytes(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function crc32(bytes) {
  let crc = 0 ^ -1;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ bytes[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

function buildCrc32Table() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function decodeBase64Bytes(value) {
  const normalized = String(value || "").trim().replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}
