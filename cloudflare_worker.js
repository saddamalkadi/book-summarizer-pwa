/**
 * Cloudflare Worker — CloudConvert PDF→DOCX (with optional OCR)
 * 
 * 1) Set secret: CLOUDCONVERT_API_KEY
 * 2) Deploy Worker, copy its URL
 * 3) In the PWA Settings: paste Worker URL in "CloudConvert Worker URL"
 *
 * Endpoints:
 *  - POST /start  { filename, ocr(true/false), languages:["ara","eng"], output:"docx" }
 *    -> { jobId, upload: { url, parameters } }
 *  - GET  /status?jobId=...
 *    -> { status, message, files:[{url,filename,...}] , url }
 */
function corsHeaders(origin){
  // You can tighten this to your GitHub Pages domain if you want.
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

function jsonResponse(obj, origin, status=200){
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(origin) }
  });
}

export default {
  async fetch(request, env){
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "*";

    if (request.method === "OPTIONS"){
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (!env.CLOUDCONVERT_API_KEY){
      return jsonResponse({ error: "Missing CLOUDCONVERT_API_KEY secret in Worker settings." }, origin, 500);
    }

    // ---------- POST /start ----------
    if (url.pathname.endsWith("/start") && request.method === "POST"){
      let body;
      try{ body = await request.json(); }catch{
        return jsonResponse({ error: "Invalid JSON" }, origin, 400);
      }
      const filename = (body?.filename || "file.pdf").toString();
      const wantOcr = body?.ocr !== false;
      const languages = Array.isArray(body?.languages) && body.languages.length ? body.languages : ["ara","eng"];
      const output = (body?.output || "docx").toString();

      // CloudConvert job with: import/upload -> (optional) pdf/ocr -> convert -> export/url
      // Docs: Jobs API + Import Upload + PDF OCR. (See CloudConvert API docs)
      const tasks = {
        "import-1": { "operation": "import/upload" },
        ...(wantOcr ? {
          "ocr-1": {
            "operation": "pdf/ocr",
            "input": "import-1",
            "auto_orient": true,
            "language": languages,
            "filename": "ocr.pdf"
          }
        } : {}),
        "convert-1": {
          "operation": "convert",
          "input": wantOcr ? "ocr-1" : "import-1",
          "input_format": "pdf",
          "output_format": output
        },
        "export-1": {
          "operation": "export/url",
          "input": "convert-1"
        }
      };

      const jobRes = await fetch("https://api.cloudconvert.com/v2/jobs", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.CLOUDCONVERT_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ tasks, tag: "bspro-pdf2docx" })
      });

      const jobText = await jobRes.text();
      let jobJson = null;
      try{ jobJson = JSON.parse(jobText); }catch{}

      if (!jobRes.ok){
        return jsonResponse({ error: "CloudConvert job creation failed", status: jobRes.status, detail: jobJson || jobText }, origin, 500);
      }

      const job = jobJson?.data;
      const jobId = job?.id;
      const importTask = (job?.tasks || []).find(t => t?.name === "import-1");
      const form = importTask?.result?.form;

      if (!jobId || !form?.url || !form?.parameters){
        return jsonResponse({ error: "Unexpected CloudConvert response", job }, origin, 500);
      }

      return jsonResponse({ jobId, upload: form }, origin, 200);
    }

    // ---------- GET /status ----------
    if (url.pathname.endsWith("/status") && request.method === "GET"){
      const jobId = url.searchParams.get("jobId");
      if (!jobId) return jsonResponse({ error: "Missing jobId" }, origin, 400);

      const stRes = await fetch(`https://api.cloudconvert.com/v2/jobs/${encodeURIComponent(jobId)}`, {
        method: "GET",
        headers: { "Authorization": `Bearer ${env.CLOUDCONVERT_API_KEY}` }
      });
      const stText = await stRes.text();
      let stJson = null;
      try{ stJson = JSON.parse(stText); }catch{}

      if (!stRes.ok){
        return jsonResponse({ error: "CloudConvert status failed", status: stRes.status, detail: stJson || stText }, origin, 500);
      }

      const job = stJson?.data;
      const status = job?.status || "unknown";
      const tasks = job?.tasks || [];
      const exportTask = tasks.find(t => t?.name === "export-1");
      const files = exportTask?.result?.files || [];
      const url1 = files?.[0]?.url || null;

      const message = (tasks.find(t => t?.status === "error")?.message) || null;

      return jsonResponse({ status, message, files, url: url1 }, origin, 200);
    }

    return new Response("Not found", { status: 404, headers: corsHeaders(origin) });
  }
};
