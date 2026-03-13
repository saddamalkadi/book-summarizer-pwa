export default {
  async fetch(request, env) {
    try {
      if (request.method === 'OPTIONS') return handleOptions(request);

      const url = new URL(request.url);

      // Health/readiness check
      if (url.pathname === '/health') {
        const health = getWorkerHealth(env);
        return withCors(jsonResponse(health.body, health.status), request);
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
      return withCors(jsonResponse({
        error: String(err?.message || err || 'Worker error'),
        code: 'WORKER_UNHANDLED_ERROR'
      }, 500), request);
    }
  }
};

function handleOptions(request) {
  return withCors(new Response(null, { status: 204 }), request);
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

function getServerKey(env) {
  return (
    env.OPENROUTER_API_KEY ||
    env.OPEN_ROUTER_API_KEY ||
    env.OPENROUTER_KEY ||
    ''
  ).trim();
}

function getWorkerHealth(env) {
  const configured = !!getServerKey(env);
  const clientTokenRequired = !!String(env.GATEWAY_CLIENT_TOKEN || '').trim();
  return {
    status: configured ? 200 : 503,
    body: {
      ok: configured,
      ready: configured,
      configured,
      worker: 'keys',
      upstream: 'openrouter',
      client_token_required: clientTokenRequired
    }
  };
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
      return withCors(jsonResponse({
        error: 'Unauthorized client token. Check Gateway Client Token in the app settings.',
        code: 'GATEWAY_INVALID_CLIENT_TOKEN'
      }, 401), request);
    }
  }

  // Use server-side OpenRouter key from Worker secret first.
  // Fallback to incoming Authorization for temporary migration.
  // Support common aliases in case the variable was created with a slightly different name.
  const serverKey = getServerKey(env);
  const incomingAuth = (request.headers.get('Authorization') || '').trim();
  const authHeader = serverKey ? `Bearer ${serverKey}` : incomingAuth;

  if (!authHeader) {
    return withCors(jsonResponse({
      error: 'Missing API key. Set OPENROUTER_API_KEY in Cloudflare Worker Secrets, or send Authorization header for temporary browser-side auth.',
      code: 'GATEWAY_MISSING_UPSTREAM_KEY',
      configured: false
    }, 401), request);
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

  let upstreamResp;
  try {
    upstreamResp = await fetch(upstreamUrl.toString(), init);
  } catch (err) {
    return withCors(jsonResponse({
      error: 'OpenRouter upstream request failed before a response was received.',
      code: 'GATEWAY_UPSTREAM_FETCH_FAILED',
      detail: String(err?.message || err || 'Fetch failed')
    }, 502), request);
  }

  if (!upstreamResp.ok) {
    const raw = await upstreamResp.text().catch(() => '');
    let parsed;
    try { parsed = raw ? JSON.parse(raw) : null; } catch (_) { parsed = null; }
    const upstreamMessage = (
      parsed?.error?.message ||
      parsed?.message ||
      raw ||
      `OpenRouter upstream error (HTTP ${upstreamResp.status})`
    );
    return withCors(jsonResponse({
      error: upstreamMessage,
      code: `GATEWAY_UPSTREAM_${upstreamResp.status}`,
      upstream_status: upstreamResp.status
    }, upstreamResp.status), request);
  }

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
