/**
 * bspro-api Cloudflare Worker (PDF -> DOCX via CloudConvert)
 * Endpoints:
 *  - GET  /ping
 *  - POST /start   { fileName?: string }
 *  - GET  /status?jobId=...
 *
 * Secrets (Cloudflare Worker -> Settings -> Variables and Secrets):
 *  - CLOUDCONVERT_API_KEY   (required)  CloudConvert API key (NOT Cloudflare token)
 * Optional:
 *  - CLOUDCONVERT_BASE_URL  (default https://api.cloudconvert.com)  Use https://api.sandbox.cloudconvert.com for sandbox keys
 */
function cors(req) {
  const origin = req.headers.get("Origin") || "*";
  const reqHeaders = req.headers.get("Access-Control-Request-Headers");
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    // Echo requested headers if present; otherwise allow common ones.
    "Access-Control-Allow-Headers": reqHeaders || "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(body, req, status = 200) {
  const headers = cors(req);
  headers["Content-Type"] = "application/json; charset=utf-8";
  return new Response(JSON.stringify(body), { status, headers });
}

function text(body, req, status = 200) {
  const headers = cors(req);
  headers["Content-Type"] = "text/plain; charset=utf-8";
  return new Response(body, { status, headers });
}

async function safeJson(req) {
  try { return await req.json(); } catch { return null; }
}

export default {
  async fetch(req, env) {
    // Preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors(req) });
    }

    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    // Health check
    if (req.method === "GET" && path === "/ping") {
      return json({
        ok: true,
        service: "bspro-api",
        now: new Date().toISOString(),
        hasKey: Boolean(env.CLOUDCONVERT_API_KEY),
        base: env.CLOUDCONVERT_BASE_URL || "https://api.cloudconvert.com",
      }, req, 200);
    }

    // Guard
    if (!env.CLOUDCONVERT_API_KEY) {
      return json({
        error: "Missing CLOUDCONVERT_API_KEY secret on the Worker.",
        hint: "Cloudflare Worker -> Settings -> Variables and Secrets -> Add secret CLOUDCONVERT_API_KEY (CloudConvert API key)."
      }, req, 500);
    }

    const base = (env.CLOUDCONVERT_BASE_URL || "https://api.cloudconvert.com").replace(/\/+$/, "");

    // Start conversion
    if (req.method === "POST" && path === "/start") {
      const body = await safeJson(req);
      const fileName = (body && body.fileName) ? String(body.fileName) : "input.pdf";

      const jobReq = {
        tasks: {
          "import-1": { operation: "import/upload" },
          "convert-1": {
            operation: "convert",
            input: ["import-1"],
            input_format: "pdf",
            output_format: "docx",
          },
          "export-1": { operation: "export/url", input: ["convert-1"] }
        },
        tag: "bspro"
      };

      const createRes = await fetch(`${base}/v2/jobs`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.CLOUDCONVERT_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(jobReq)
      });

      const createText = await createRes.text();
      let createJson = null;
      try { createJson = JSON.parse(createText); } catch {}

      if (!createRes.ok) {
        return json({
          error: "CloudConvert job creation failed",
          status: createRes.status,
          detail: createJson || createText,
          hint: "Common causes: wrong key, sandbox key with live base URL, plan/limits."
        }, req, 500);
      }

      const job = createJson?.data;
      const importTask = job?.tasks?.find?.(t => t?.name === "import-1");
      const form = importTask?.result?.form;
      if (!form?.url || !form?.parameters) {
        return json({
          error: "import/upload did not return an upload form.",
          jobId: job?.id || null,
          detail: createJson
        }, req, 500);
      }

      return json({
        jobId: job.id,
        upload: {
          url: form.url,
          parameters: form.parameters,
          fileName
        }
      }, req, 200);
    }

    // Poll status
    if (req.method === "GET" && path === "/status") {
      const jobId = url.searchParams.get("jobId");
      if (!jobId) return json({ error: "Missing jobId" }, req, 400);

      const stRes = await fetch(`${base}/v2/jobs/${encodeURIComponent(jobId)}`, {
        method: "GET",
        headers: { "Authorization": `Bearer ${env.CLOUDCONVERT_API_KEY}` }
      });

      const stText = await stRes.text();
      let stJson = null;
      try { stJson = JSON.parse(stText); } catch {}

      if (!stRes.ok) {
        return json({ error: "CloudConvert status failed", status: stRes.status, detail: stJson || stText }, req, 500);
      }

      const job = stJson?.data;
      const status = job?.status || "unknown";
      const tasks = job?.tasks || [];
      const exportTask = tasks.find(t => t?.name === "export-1");
      const files = exportTask?.result?.files || [];
      const url1 = files?.[0]?.url || null;
      const message = (tasks.find(t => t?.status === "error")?.message) || null;

      return json({ status, message, files, url: url1 }, req, 200);
    }

    return text("Not found", req, 404);
  }
};
