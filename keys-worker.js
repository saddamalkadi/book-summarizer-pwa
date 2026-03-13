export default {
  async fetch(request, env) {
    try {
      if (request.method === 'OPTIONS') return handleOptions(request);

      const url = new URL(request.url);

      // Basic health check
      if (url.pathname === '/health') {
        return withCors(new Response(JSON.stringify({ ok: true, worker: 'keys' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json; charset=utf-8' }
        }), request);
      }

      // Gateway endpoint (OpenAI-compatible): /v1/* -> OpenRouter /v1/*
      if (url.pathname.startsWith('/v1/')) {
        return handleGateway(request, env, url);
      }

      // Static assets fallback (PWA files)
      if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
        const assetResp = await env.ASSETS.fetch(request);
        if (assetResp.status !== 404 || !isSpaRequest(request, url)) {
          return withCors(assetResp, request);
        }

        // If a client-side route is requested directly (e.g. /e/*),
        // serve the app shell so the router can handle it.
        const shellRequest = new Request(new URL('/index.html', url).toString(), request);
        const shellResp = await env.ASSETS.fetch(shellRequest);
        return withCors(shellResp, request);
      }

      return withCors(new Response('Not Found', { status: 404 }), request);
    } catch (err) {
      return withCors(new Response(JSON.stringify({
        error: String(err?.message || err || 'Worker error')
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      }), request);
    }
  }
};

function handleOptions(request) {
  return withCors(new Response(null, { status: 204 }), request);
}

function withCors(response, request) {
  const origin = request.headers.get('Origin') || '*';
  const h = new Headers(response.headers || {});
  h.set('Access-Control-Allow-Origin', origin);
  h.set('Vary', 'Origin');
  h.set('Access-Control-Allow-Methods', 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS');
  h.set('Access-Control-Allow-Headers', [
    'Authorization',
    'Content-Type',
    'X-Client-Token',
    'HTTP-Referer',
    'X-Title'
  ].join(','));
  h.set('Access-Control-Expose-Headers', 'Content-Type,Content-Length');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: h });
}

async function handleGateway(request, env, url) {
  // Optional extra client token protection
  const expectedClientToken = (env.GATEWAY_CLIENT_TOKEN || '').trim();
  if (expectedClientToken) {
    const got = (request.headers.get('X-Client-Token') || '').trim();
    if (!got || got !== expectedClientToken) {
      return withCors(new Response(JSON.stringify({ error: 'Unauthorized client token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      }), request);
    }
  }

  // Use server-side OpenRouter key from Worker secret first.
  // Fallback to incoming Authorization for temporary migration.
  // Support common aliases in case the variable was created with a slightly different name.
  const serverKey = (
    env.OPENROUTER_API_KEY ||
    env.OPEN_ROUTER_API_KEY ||
    env.OPENROUTER_KEY ||
    ''
  ).trim();
  const incomingAuth = (request.headers.get('Authorization') || '').trim();
  const authHeader = serverKey ? `Bearer ${serverKey}` : incomingAuth;

  if (!authHeader) {
    return withCors(new Response(JSON.stringify({
      error: 'Missing API key. Set OPENROUTER_API_KEY in Cloudflare Worker Secrets (or wrangler secret put OPENROUTER_API_KEY), or send Authorization header.'
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    }), request);
  }

  const upstreamUrl = new URL(`https://openrouter.ai${url.pathname}${url.search}`);

  const headers = new Headers(request.headers);
  headers.set('Authorization', authHeader);
  headers.set('Host', 'openrouter.ai');
  headers.set('HTTP-Referer', env.OPENROUTER_REFERER || url.origin);
  headers.set('X-Title', env.OPENROUTER_TITLE || 'AI Workspace Studio');

  // Remove client-only header before forwarding upstream.
  headers.delete('X-Client-Token');

  const init = {
    method: request.method,
    headers,
    body: canHaveBody(request.method) ? request.body : undefined,
    redirect: 'follow'
  };

  const upstreamResp = await fetch(upstreamUrl.toString(), init);

  // Pass-through status/body while keeping permissive CORS for app clients.
  return withCors(new Response(upstreamResp.body, {
    status: upstreamResp.status,
    statusText: upstreamResp.statusText,
    headers: upstreamResp.headers
  }), request);
}

function canHaveBody(method) {
  const m = String(method || '').toUpperCase();
  return !(m === 'GET' || m === 'HEAD');
}

function isSpaRequest(request, url) {
  const method = String(request.method || '').toUpperCase();
  if (!(method === 'GET' || method === 'HEAD')) return false;

  // Real files usually contain an extension; SPA routes do not.
  const path = url.pathname || '/';
  if (path === '/' || path === '') return true;
  const lastPart = path.split('/').pop() || '';
  return !lastPart.includes('.');
}
