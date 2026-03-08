/**
 * AI Workspace Studio - Secure Gateway (Cloudflare Worker)
 *
 * هدفه: إخفاء API Key عن المتصفح. التطبيق يرسل الطلبات إلى:
 *   https://YOUR_WORKER.workers.dev/v1/chat/completions
 *   https://YOUR_WORKER.workers.dev/v1/embeddings
 *   https://YOUR_WORKER.workers.dev/v1/models
 *
 * Worker يقوم بالـproxy إلى OpenRouter:
 *   https://openrouter.ai/api/v1/...
 *
 * Secrets (Cloudflare):
 *   OPENROUTER_API_KEY = sk-or-...
 * Optional:
 *   CLIENT_TOKENS      = token1,token2 (إن أردت منع أي شخص آخر من استخدام الـGateway)
 *   ALLOW_ORIGINS      = https://yourdomain.github.io (أو * للسماح للجميع)
 */

function corsHeaders(origin, allowOrigins) {
  const h = new Headers();
  const allow = (allowOrigins || '*').trim();
  const ok = allow === '*' || allow.split(',').map(s=>s.trim()).includes(origin);
  h.set('Access-Control-Allow-Origin', ok ? origin : (allow === '*' ? '*' : allow.split(',')[0].trim()));
  h.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  h.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Client-Token, HTTP-Referer, X-Title');
  h.set('Access-Control-Max-Age', '86400');
  return h;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '*';
    const cors = corsHeaders(origin, env.ALLOW_ORIGINS);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    // Optional client token protection
    const clientTokens = (env.CLIENT_TOKENS || '').trim();
    if (clientTokens) {
      const token = request.headers.get('X-Client-Token') || (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i,'');
      const allowed = clientTokens.split(',').map(s=>s.trim()).filter(Boolean);
      if (!token || !allowed.includes(token)) {
        const h = new Headers(cors);
        return new Response('Unauthorized (client token)', { status: 401, headers: h });
      }
    }

    if (!url.pathname.startsWith('/v1/')) {
      const h = new Headers(cors);
      return new Response('Not found', { status: 404, headers: h });
    }

    const upstreamUrl = 'https://openrouter.ai/api' + url.pathname + url.search;

    const headers = new Headers(request.headers);
    headers.set('Authorization', `Bearer ${env.OPENROUTER_API_KEY || ''}`);
    // ensure we don't forward our client token header upstream
    headers.delete('X-Client-Token');

    const init = {
      method: request.method,
      headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
      redirect: 'follow'
    };

    const resp = await fetch(upstreamUrl, init);
    const outHeaders = new Headers(resp.headers);
    cors.forEach((v, k) => outHeaders.set(k, v));
    return new Response(resp.body, { status: resp.status, headers: outHeaders });
  }
};
