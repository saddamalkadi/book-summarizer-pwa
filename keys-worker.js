const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

let googleKeysCache = {
  keys: null,
  expiresAt: 0
};

export default {
  async fetch(request, env) {
    try {
      if (request.method === 'OPTIONS') return handleOptions(request);

      const url = new URL(request.url);

      if (url.pathname === '/health') {
        const health = getWorkerHealth(env);
        return withCors(jsonResponse(health.body, health.status), request);
      }

      if (url.pathname === '/auth/config' && request.method === 'GET') {
        return withCors(jsonResponse(getPublicAuthConfig(env), 200), request);
      }

      if (url.pathname === '/auth/google' && request.method === 'POST') {
        return withCors(await handleGoogleAuth(request, env), request);
      }

      if (url.pathname === '/auth/login' && request.method === 'POST') {
        return withCors(await handlePasswordLogin(request, env), request);
      }

      if (url.pathname === '/auth/register' && request.method === 'POST') {
        return withCors(await handleEmailRegistration(request, env), request);
      }

      if (url.pathname === '/auth/session' && request.method === 'GET') {
        return withCors(await handleSessionLookup(request, env), request);
      }

      if (url.pathname === '/auth/upgrade/request' && request.method === 'POST') {
        return withCors(await handleUpgradeRequest(request, env), request);
      }

      if (url.pathname === '/auth/upgrade/activate' && request.method === 'POST') {
        return withCors(await handleUpgradeActivation(request, env), request);
      }

      if (url.pathname === '/auth/admin/generate-upgrade-code' && request.method === 'POST') {
        return withCors(await handleAdminUpgradeCode(request, env), request);
      }

      if (url.pathname.startsWith('/v1/')) {
        return handleGateway(request, env, url);
      }

      if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
        const assetResp = await env.ASSETS.fetch(request);
        if (assetResp.status !== 404 || !isSpaRequest(request, url)) {
          return withCors(assetResp, request);
        }

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

function getSessionSecret(env) {
  return (
    env.APP_SESSION_SECRET ||
    env.AUTH_SESSION_SECRET ||
    getServerKey(env) ||
    env.GATEWAY_CLIENT_TOKEN ||
    'aistudio-session-fallback'
  ).trim();
}

function getUpgradeSecret(env) {
  return (
    env.UPGRADE_CODE_SECRET ||
    env.APP_SESSION_SECRET ||
    env.AUTH_SESSION_SECRET ||
    getServerKey(env) ||
    'aistudio-upgrade-fallback'
  ).trim();
}

function getUpgradeAdminToken(env) {
  return (
    env.UPGRADE_ADMIN_TOKEN ||
    env.GATEWAY_CLIENT_TOKEN ||
    ''
  ).trim();
}

function getAdminEmail(env) {
  return String(env.APP_ADMIN_EMAIL || env.ADMIN_EMAIL || 'tntntt830@gmail.com').trim().toLowerCase();
}

function getAdminPassword(env) {
  return String(env.APP_ADMIN_PASSWORD || env.ADMIN_PASSWORD || '').trim();
}

function getPublicAuthConfig(env) {
  const googleClientId = String(env.GOOGLE_CLIENT_ID_WEB || env.GOOGLE_CLIENT_ID || '').trim();
  const authRequired = String(env.AUTH_REQUIRE_LOGIN || 'true').trim().toLowerCase() !== 'false';
  const adminEmail = getAdminEmail(env);
  const adminEnabled = !!getAdminPassword(env);
  return {
    ok: true,
    authRequired,
    premiumEnabled: true,
    brandName: String(env.APP_BRAND_NAME || 'AI Workspace Studio').trim(),
    developerName: String(env.APP_DEVELOPER_NAME || 'صدام القاضي').trim(),
    upgradeEmail: String(env.APP_UPGRADE_EMAIL || 'tntntt830@gmail.com').trim(),
    adminEmail,
    adminEnabled,
    googleClientId,
    clientIdConfigured: !!googleClientId
  };
}

function getWorkerHealth(env) {
  const configured = !!getServerKey(env);
  const clientTokenRequired = !!String(env.GATEWAY_CLIENT_TOKEN || '').trim();
  const authConfig = getPublicAuthConfig(env);
  const hasSessionSecret = !!getSessionSecret(env);
  const hasUpgradeSecret = !!getUpgradeSecret(env);
  const adminLoginReady = !!getAdminPassword(env);
  return {
    status: configured ? 200 : 503,
    body: {
      ok: configured,
      ready: configured,
      configured,
      worker: 'keys',
      upstream: 'openrouter',
      client_token_required: clientTokenRequired,
      auth_required: authConfig.authRequired,
      google_client_configured: authConfig.clientIdConfigured,
      admin_login_ready: adminLoginReady,
      session_ready: hasSessionSecret,
      upgrade_flow_ready: hasUpgradeSecret
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
    'X-App-Session',
    'X-Admin-Token',
    'HTTP-Referer',
    'X-Title'
  ].join(','));
  h.set('Access-Control-Expose-Headers', 'Content-Type,Content-Length');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: h });
}

async function handleGoogleAuth(request, env) {
  try {
    const body = await parseJson(request);
    const credential = String(body?.credential || '').trim();
    const clientId = String(body?.clientId || '').trim();
    const upgradeCode = String(body?.upgradeCode || '').trim();

    if (!credential) {
      return jsonResponse({ error: 'Missing Google credential.', code: 'AUTH_MISSING_GOOGLE_CREDENTIAL' }, 400);
    }

    const googleProfile = await verifyGoogleCredential(credential, env, clientId);
    let plan = 'free';
    if (upgradeCode) {
      await verifyUpgradeCodeForEmail(upgradeCode, googleProfile.email, env);
      plan = 'premium';
    }

    const session = await issueSessionToken({
      email: googleProfile.email,
      name: googleProfile.name,
      picture: googleProfile.picture,
      plan
    }, env);

    return jsonResponse(session, 200);
  } catch (error) {
    return jsonResponse({
      error: String(error?.message || error || 'Google authentication failed.'),
      code: 'AUTH_GOOGLE_FAILED'
    }, 401);
  }
}

async function handlePasswordLogin(request, env) {
  try {
    const body = await parseJson(request);
    const email = String(body?.email || '').trim().toLowerCase();
    const password = String(body?.password || '').trim();
    const adminEmail = getAdminEmail(env);
    const adminPassword = getAdminPassword(env);

    if (!email || !password) {
      return jsonResponse({
        error: 'Email and password are required.',
        code: 'AUTH_LOGIN_REQUIRED_FIELDS'
      }, 400);
    }

    if (!adminPassword) {
      return jsonResponse({
        error: 'Admin password login is not configured on the worker.',
        code: 'AUTH_ADMIN_PASSWORD_NOT_CONFIGURED'
      }, 503);
    }

    if (email !== adminEmail || !timingSafeEqual(password, adminPassword)) {
      return jsonResponse({
        error: 'Invalid admin credentials.',
        code: 'AUTH_INVALID_ADMIN_CREDENTIALS'
      }, 401);
    }

    const session = await issueSessionToken({
      email,
      name: 'صدام القاضي',
      picture: '',
      plan: 'premium',
      role: 'admin'
    }, env);

    return jsonResponse(session, 200);
  } catch (error) {
    return jsonResponse({
      error: String(error?.message || error || 'Admin login failed.'),
      code: 'AUTH_LOGIN_FAILED'
    }, 401);
  }
}

async function handleEmailRegistration(request, env) {
  try {
    const body = await parseJson(request);
    const email = String(body?.email || '').trim().toLowerCase();
    const name = String(body?.name || '').trim();
    const upgradeCode = String(body?.upgradeCode || '').trim();
    const adminEmail = getAdminEmail(env);

    if (!isValidEmail(email)) {
      return jsonResponse({
        error: 'A valid personal email is required.',
        code: 'AUTH_REGISTER_EMAIL_REQUIRED'
      }, 400);
    }

    if (email === adminEmail) {
      return jsonResponse({
        error: 'This email is configured as the admin account. Use the same form with the admin password.',
        code: 'AUTH_ADMIN_PASSWORD_REQUIRED'
      }, 400);
    }

    let plan = 'free';
    if (upgradeCode) {
      await verifyUpgradeCodeForEmail(upgradeCode, email, env);
      plan = 'premium';
    }

    const session = await issueSessionToken({
      email,
      name: name || deriveDisplayName(email),
      picture: '',
      plan,
      role: 'user'
    }, env);

    return jsonResponse(session, 200);
  } catch (error) {
    return jsonResponse({
      error: String(error?.message || error || 'Email registration failed.'),
      code: 'AUTH_REGISTER_FAILED'
    }, 401);
  }
}

async function handleSessionLookup(request, env) {
  try {
    const session = await requireSession(request, env);
    return jsonResponse({
      ok: true,
      email: session.email,
      name: session.name,
      picture: session.picture,
      plan: session.plan,
      role: session.role || 'user',
      sessionExp: session.exp * 1000
    }, 200);
  } catch (error) {
    return jsonResponse({
      error: String(error?.message || error || 'Authentication required.'),
      code: 'AUTH_SESSION_REQUIRED'
    }, 401);
  }
}

async function handleUpgradeRequest(request, env) {
  try {
    const session = await requireSession(request, env);
    const config = getPublicAuthConfig(env);
    const mailto = buildUpgradeMailto(session, config.upgradeEmail);
    return jsonResponse({
      ok: true,
      email: session.email,
      upgradeEmail: config.upgradeEmail,
      mailto
    }, 200);
  } catch (error) {
    return jsonResponse({
      error: String(error?.message || error || 'Authentication required.'),
      code: 'AUTH_SESSION_REQUIRED'
    }, 401);
  }
}

async function handleUpgradeActivation(request, env) {
  try {
    const session = await requireSession(request, env);
    const body = await parseJson(request);
    const code = String(body?.code || '').trim();
    if (!code) {
      return jsonResponse({ error: 'Missing upgrade code.', code: 'UPGRADE_CODE_REQUIRED' }, 400);
    }
    await verifyUpgradeCodeForEmail(code, session.email, env);
    const upgraded = await issueSessionToken({
      email: session.email,
      name: session.name,
      picture: session.picture,
      plan: 'premium',
      role: session.role === 'admin' ? 'admin' : 'user'
    }, env);
    return jsonResponse({ ...upgraded, upgradeAccepted: true }, 200);
  } catch (error) {
    return jsonResponse({
      error: String(error?.message || error || 'Upgrade activation failed.'),
      code: 'UPGRADE_ACTIVATION_FAILED'
    }, 401);
  }
}

async function handleAdminUpgradeCode(request, env) {
  const expected = getUpgradeAdminToken(env);
  const provided = String(request.headers.get('X-Admin-Token') || '').trim();
  let adminAuthorized = false;
  if (expected && provided && provided === expected) {
    adminAuthorized = true;
  } else {
    try {
      const session = await requireSession(request, env);
      adminAuthorized = session?.role === 'admin';
    } catch (_) {
      adminAuthorized = false;
    }
  }
  if (!adminAuthorized) {
    return jsonResponse({
      error: 'Admin access is required to generate an upgrade code.',
      code: 'UPGRADE_ADMIN_UNAUTHORIZED'
    }, 401);
  }

  const body = await parseJson(request);
  const email = String(body?.email || '').trim().toLowerCase();
  const plan = String(body?.plan || 'premium').trim() === 'premium' ? 'premium' : 'premium';
  const days = clampNumber(body?.days, 1, 3650, 365);
  if (!email || !email.includes('@')) {
    return jsonResponse({
      error: 'A valid email is required to generate an upgrade code.',
      code: 'UPGRADE_EMAIL_REQUIRED'
    }, 400);
  }
  const code = await createUpgradeCode({ email, plan, days }, env);
  return jsonResponse({
    ok: true,
    email,
    plan,
    code,
    expiresAt: Date.now() + (days * 24 * 60 * 60 * 1000)
  }, 200);
}

async function handleGateway(request, env, url) {
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

  const upstreamPath = url.pathname.startsWith('/v1/')
    ? `/api${url.pathname}`
    : url.pathname;
  const upstreamUrl = new URL(`https://openrouter.ai${upstreamPath}${url.search}`);

  const headers = new Headers(request.headers);
  headers.set('Authorization', authHeader);
  headers.set('Host', 'openrouter.ai');
  headers.set('HTTP-Referer', env.OPENROUTER_REFERER || url.origin);
  headers.set('X-Title', env.OPENROUTER_TITLE || 'AI Workspace Studio');
  headers.delete('X-Client-Token');
  headers.delete('X-App-Session');
  headers.delete('X-Admin-Token');

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

  return withCors(new Response(upstreamResp.body, {
    status: upstreamResp.status,
    statusText: upstreamResp.statusText,
    headers: upstreamResp.headers
  }), request);
}

async function requireSession(request, env) {
  const token = getSessionTokenFromRequest(request);
  if (!token) {
    throw new Error('Missing signed session. Please log in with Google first.');
  }
  const payload = await verifySignedToken(token, getSessionSecret(env), 'session');
  if (!payload?.email) {
    throw new Error('Invalid or expired session.');
  }
  return payload;
}

function getSessionTokenFromRequest(request) {
  const explicit = String(request.headers.get('X-App-Session') || '').trim();
  if (explicit) return explicit;
  const auth = String(request.headers.get('Authorization') || '').trim();
  if (!auth.toLowerCase().startsWith('bearer ')) return '';
  return auth.slice(7).trim();
}

async function issueSessionToken(profile, env) {
  const now = Date.now();
  const payload = {
    iss: 'aistudio',
    typ: 'session',
    email: String(profile.email || '').trim().toLowerCase(),
    name: String(profile.name || '').trim(),
    picture: String(profile.picture || '').trim(),
    plan: profile.plan === 'premium' ? 'premium' : 'free',
    role: profile.role === 'admin' ? 'admin' : 'user',
    iat: Math.floor(now / 1000),
    exp: Math.floor((now + SESSION_TTL_MS) / 1000)
  };
  const sessionToken = await signCompactToken(payload, getSessionSecret(env), 'session');
  return {
    ok: true,
    email: payload.email,
    name: payload.name,
    picture: payload.picture,
    plan: payload.plan,
    role: payload.role,
    sessionToken,
    sessionExp: payload.exp * 1000
  };
}

async function createUpgradeCode({ email, plan = 'premium', days = 365 }, env) {
  const now = Date.now();
  const payload = {
    iss: 'aistudio',
    typ: 'upgrade',
    email: String(email || '').trim().toLowerCase(),
    plan: plan === 'premium' ? 'premium' : 'premium',
    iat: Math.floor(now / 1000),
    exp: Math.floor((now + (days * 24 * 60 * 60 * 1000)) / 1000)
  };
  const signed = await signCompactToken(payload, getUpgradeSecret(env), 'upgrade');
  return `AIPRO-${signed}`;
}

async function verifyUpgradeCodeForEmail(code, email, env) {
  const raw = String(code || '').trim().replace(/^AIPRO-/, '');
  const payload = await verifySignedToken(raw, getUpgradeSecret(env), 'upgrade');
  if (!payload?.email) {
    throw new Error('Invalid or expired upgrade code.');
  }
  if (payload.email !== String(email || '').trim().toLowerCase()) {
    throw new Error('This upgrade code is bound to a different Gmail account.');
  }
  return payload;
}

async function signCompactToken(payload, secret, typ) {
  const header = { alg: 'HS256', typ };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const message = `${encodedHeader}.${encodedPayload}`;
  const signature = await hmacSha256Base64Url(message, secret);
  return `${message}.${signature}`;
}

async function verifySignedToken(token, secret, expectedType) {
  const parts = String(token || '').trim().split('.');
  if (parts.length !== 3) throw new Error('Malformed signed token.');
  const [encodedHeader, encodedPayload, signature] = parts;
  const expectedSignature = await hmacSha256Base64Url(`${encodedHeader}.${encodedPayload}`, secret);
  if (!timingSafeEqual(signature, expectedSignature)) {
    throw new Error('Signed token verification failed.');
  }
  const header = JSON.parse(base64UrlDecodeToString(encodedHeader));
  const payload = JSON.parse(base64UrlDecodeToString(encodedPayload));
  if (expectedType && header?.typ !== expectedType) {
    throw new Error('Signed token type mismatch.');
  }
  const now = Math.floor(Date.now() / 1000);
  if (Number(payload?.exp || 0) <= now) {
    throw new Error('Signed token expired.');
  }
  return payload;
}

async function verifyGoogleCredential(credential, env, clientIdHint = '') {
  const parts = String(credential || '').trim().split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed Google credential.');
  }

  const header = JSON.parse(base64UrlDecodeToString(parts[0]));
  const payload = JSON.parse(base64UrlDecodeToString(parts[1]));
  const keys = await getGoogleVerificationKeys();
  const jwk = (keys || []).find((entry) => entry.kid === header.kid);
  if (!jwk) {
    throw new Error('Unable to resolve Google signing key.');
  }

  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const verified = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    base64UrlDecodeToBytes(parts[2]),
    textBytes(`${parts[0]}.${parts[1]}`)
  );

  if (!verified) {
    throw new Error('Google credential signature verification failed.');
  }

  const now = Math.floor(Date.now() / 1000);
  const iss = String(payload?.iss || '');
  const allowedClientIds = [
    String(env.GOOGLE_CLIENT_ID_WEB || '').trim(),
    String(env.GOOGLE_CLIENT_ID || '').trim(),
    String(clientIdHint || '').trim()
  ].filter(Boolean);

  if (!['accounts.google.com', 'https://accounts.google.com'].includes(iss)) {
    throw new Error('Unsupported Google issuer.');
  }
  if (Number(payload?.exp || 0) <= now) {
    throw new Error('Google credential expired.');
  }
  if (!payload?.email_verified) {
    throw new Error('Google account email is not verified.');
  }
  if (!String(payload?.email || '').toLowerCase().match(/@(gmail|googlemail)\.com$/)) {
    throw new Error('Only Gmail accounts are allowed for sign in.');
  }
  if (allowedClientIds.length && !allowedClientIds.includes(String(payload?.aud || '').trim())) {
    throw new Error('Google credential audience mismatch.');
  }
  if (!allowedClientIds.length) {
    throw new Error('Google Client ID is not configured.');
  }

  return {
    email: String(payload.email || '').trim().toLowerCase(),
    name: String(payload.name || payload.email || '').trim(),
    picture: String(payload.picture || '').trim()
  };
}

async function getGoogleVerificationKeys() {
  if (googleKeysCache.keys && googleKeysCache.expiresAt > Date.now()) {
    return googleKeysCache.keys;
  }
  const response = await fetch(GOOGLE_JWKS_URL, { cf: { cacheTtl: 3600, cacheEverything: true } });
  if (!response.ok) {
    throw new Error('Failed to fetch Google verification keys.');
  }
  const payload = await response.json();
  const maxAge = Number((response.headers.get('cache-control') || '').match(/max-age=(\d+)/)?.[1] || 3600);
  googleKeysCache = {
    keys: Array.isArray(payload?.keys) ? payload.keys : [],
    expiresAt: Date.now() + (maxAge * 1000)
  };
  return googleKeysCache.keys;
}

function buildUpgradeMailto(session, upgradeEmail) {
  const to = encodeURIComponent(String(upgradeEmail || 'tntntt830@gmail.com').trim());
  const subject = encodeURIComponent(`طلب ترقية حساب - ${session.email}`);
  const body = encodeURIComponent([
    'مرحبًا،',
    '',
    'أرغب في ترقية حسابي إلى الخطة المدفوعة.',
    `الاسم: ${session.name || ''}`,
    `البريد: ${session.email || ''}`,
    `الخطة الحالية: ${session.plan === 'premium' ? 'مدفوعة' : 'مجانية'}`,
    `التاريخ: ${new Date().toLocaleString('ar-SA')}`,
    '',
    'يرجى إرسال كود الترقية لهذا الحساب.'
  ].join('\n'));
  return `mailto:${to}?subject=${subject}&body=${body}`;
}

async function parseJson(request) {
  try {
    return await request.json();
  } catch (_) {
    return {};
  }
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function deriveDisplayName(email) {
  const local = String(email || '').split('@')[0] || 'مستخدم';
  const normalized = local.replace(/[._-]+/g, ' ').trim();
  return normalized || 'مستخدم';
}

function base64UrlEncode(value) {
  const bytes = typeof value === 'string' ? textBytes(value) : value;
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecodeToBytes(value) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function base64UrlDecodeToString(value) {
  return new TextDecoder().decode(base64UrlDecodeToBytes(value));
}

function textBytes(value) {
  return new TextEncoder().encode(String(value || ''));
}

async function hmacSha256Base64Url(message, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    textBytes(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, textBytes(message));
  return base64UrlEncode(new Uint8Array(signature));
}

function timingSafeEqual(a, b) {
  const left = textBytes(a);
  const right = textBytes(b);
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left[i] ^ right[i];
  return diff === 0;
}

function clampNumber(value, min, max, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function canHaveBody(method) {
  const m = String(method || '').toUpperCase();
  return !(m === 'GET' || m === 'HEAD');
}

function isSpaRequest(request, url) {
  const method = String(request.method || '').toUpperCase();
  if (!(method === 'GET' || method === 'HEAD')) return false;
  const path = url.pathname || '/';
  if (path === '/' || path === '') return true;
  const lastPart = path.split('/').pop() || '';
  return !lastPart.includes('.');
}
