const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const FALLBACK_MODEL_LIST = [
  { id: 'openrouter/free', object: 'model', created: 0, owned_by: 'openrouter', modalities: ['text'], context_length: 131072 },
  { id: 'openai/gpt-4o-mini', object: 'model', created: 0, owned_by: 'openrouter', modalities: ['text', 'image'], context_length: 131072 },
  { id: 'google/gemini-2.5-flash', object: 'model', created: 0, owned_by: 'openrouter', modalities: ['text', 'image'], context_length: 1048576 },
  { id: 'qwen/qwen2.5-vl-72b-instruct:free', object: 'model', created: 0, owned_by: 'openrouter', modalities: ['text', 'image'], context_length: 32768 }
];

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
        const health = await getWorkerHealth(env, request);
        return withCors(jsonResponse(health.body, health.status), request);
      }

      if (url.pathname === '/auth/config' && request.method === 'GET') {
        return withCors(jsonResponse(await getPublicAuthConfig(env), 200), request);
      }

      if (url.pathname === '/auth/google' && request.method === 'POST') {
        return withCors(await handleGoogleAuth(request, env), request);
      }

      if (url.pathname === '/auth/login' && request.method === 'POST') {
        return withCors(await handlePasswordLogin(request, env), request);
      }

      if (url.pathname === '/auth/diagnose' && request.method === 'POST') {
        return withCors(await handleAdminPasswordDiagnose(request, env), request);
      }

      if (url.pathname === '/auth/register' && request.method === 'POST') {
        return withCors(await handleEmailRegistration(request, env), request);
      }

      if (url.pathname === '/auth/session' && request.method === 'GET') {
        return withCors(await handleSessionLookup(request, env), request);
      }

      if (url.pathname === '/me/quota' && request.method === 'GET') {
        return withCors(await handleMeQuota(request, env), request);
      }

      if (url.pathname === '/admin/usage' && request.method === 'GET') {
        return withCors(await handleAdminUsage(request, env), request);
      }

      if (url.pathname === '/admin/users/quota' && (request.method === 'GET' || request.method === 'POST')) {
        return withCors(await handleAdminUsersQuota(request, env), request);
      }

      if (url.pathname === '/voice/live/persona' && request.method === 'GET') {
        return withCors(await handleVoiceLivePersona(request, env), request);
      }

      if (url.pathname === '/convert/health' && request.method === 'GET') {
        return withCors(await proxyConvertService(request, env, '/health'), request);
      }

      if (url.pathname === '/storage/state' && request.method === 'GET') {
        return withCors(await handleStorageStateGet(request, env), request);
      }

      if (url.pathname === '/storage/state' && request.method === 'POST') {
        return withCors(await handleStorageStatePut(request, env), request);
      }

      if (url.pathname === '/voice/transcribe' && request.method === 'POST') {
        return withCors(await handleVoiceTranscription(request, env), request);
      }

      if (url.pathname === '/proxy/tts' && (request.method === 'POST' || request.method === 'GET')) {
        return withCors(await handleGoogleTtsProxy(request), request);
      }

      if (url.pathname === '/voice/speak' && request.method === 'POST') {
        return withCors(await handleVoiceSynthesis(request, env), request);
      }

      if (url.pathname === '/ocr' && request.method === 'POST') {
        return withCors(await proxyConvertService(request, env, '/ocr'), request);
      }

      if (url.pathname === '/convert/pdf-to-docx' && request.method === 'POST') {
        return withCors(await proxyConvertService(request, env, '/convert/pdf-to-docx'), request);
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
  const raw = env.OPENROUTER_API_KEY || env.OPEN_ROUTER_API_KEY || env.OPENROUTER_KEY || '';
  return normalizeSecret(typeof raw === 'string' ? raw : String(raw));
}

function getVoiceApiConfig(env) {
  const hasWorkersAi = !!env.AI && typeof env.AI.run === 'function';
  const apiKey = String(
    env.VOICE_API_KEY ||
    env.OPENAI_API_KEY ||
    env.OPENAI_VOICE_API_KEY ||
    ''
  ).trim();
  const baseUrl = String(
    env.VOICE_API_BASE_URL ||
    env.OPENAI_API_BASE_URL ||
    'https://api.openai.com/v1'
  ).trim().replace(/\/+$/, '');
  const provider = String(env.VOICE_PROVIDER || (apiKey ? 'openai_compatible' : (hasWorkersAi ? 'workers_ai' : ''))).trim();
  const recognitionModel = String(env.VOICE_STT_MODEL || (hasWorkersAi ? '@cf/openai/whisper-large-v3-turbo' : 'gpt-4o-mini-transcribe')).trim();
  const synthesisModel = String(env.VOICE_TTS_MODEL || (hasWorkersAi ? '@cf/myshell-ai/melotts' : 'gpt-4o-mini-tts')).trim();
  const synthesisVoice = String(env.VOICE_TTS_VOICE || (hasWorkersAi ? 'ar' : 'alloy')).trim();
  const preferredLanguage = String(env.VOICE_LANG || 'ar-SA').trim();
  const sttReady = (!!apiKey || hasWorkersAi) && String(env.VOICE_DISABLE_STT || '').trim().toLowerCase() !== 'true';
  const ttsReady = (!!apiKey || hasWorkersAi) && String(env.VOICE_DISABLE_TTS || '').trim().toLowerCase() !== 'true';
  return {
    apiKey,
    baseUrl,
    provider,
    hasWorkersAi,
    recognitionModel,
    synthesisModel,
    synthesisVoice,
    preferredLanguage,
    sttReady,
    ttsReady,
    ready: sttReady || ttsReady
  };
}

function normalizeVoiceLanguageTag(value, { preserveRegion = true } = {}) {
  const raw = String(value || '').trim().replace(/_/g, '-');
  if (!raw) return preserveRegion ? 'ar-SA' : 'ar';
  if (/^ar(?:-|$)/i.test(raw)) {
    if (!preserveRegion) return 'ar';
    return raw.includes('-') ? raw : 'ar-SA';
  }
  return preserveRegion ? raw : (raw.split('-')[0] || raw);
}

function encodeArrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer || new ArrayBuffer(0));
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function decodeBase64ToBytes(value) {
  const normalized = String(value || '').trim().replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function getSessionSecret(env) {
  const explicit = String(
    env.APP_SESSION_SECRET ||
    env.AUTH_SESSION_SECRET ||
    ''
  ).trim();
  if (explicit) return explicit;
  const derived = getServerKey(env);
  if (derived) return derived;
  throw new Error('APP_SESSION_SECRET or AUTH_SESSION_SECRET must be configured on the worker.');
}

function getUpgradeSecret(env) {
  const explicit = String(
    env.UPGRADE_CODE_SECRET ||
    env.APP_UPGRADE_SECRET ||
    ''
  ).trim();
  if (explicit) return explicit;
  const derived = getServerKey(env);
  if (derived) return derived;
  throw new Error('UPGRADE_CODE_SECRET or APP_UPGRADE_SECRET must be configured on the worker.');
}

function getUpgradeAdminToken(env) {
  return (
    env.UPGRADE_ADMIN_TOKEN ||
    ''
  ).trim();
}

function getAdminEmail(env) {
  return String(env.APP_ADMIN_EMAIL || env.ADMIN_EMAIL || '').trim().toLowerCase();
}

/**
 * Normalize secret-ish strings so Dashboard/KV/Wrangler-provided values behave
 * identically to what the user actually types. Strip leading/trailing whitespace
 * INCLUDING invisible Unicode that tools commonly append (BOM, NBSP, zero-width,
 * CR/LF). Does not touch the middle of the value.
 */
function normalizeSecret(raw) {
  if (raw === null || raw === undefined) return '';
  let s = String(raw);
  // Strip BOM if present at start
  if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1);
  // Trim ASCII whitespace + common invisible Unicode on both sides
  // (NBSP \u00A0, ZWSP \u200B, ZWNJ \u200C, ZWJ \u200D, LRM \u200E, RLM \u200F, BOM \uFEFF).
  return s.replace(/^[\s\u00A0\u200B\u200C\u200D\u200E\u200F\uFEFF]+|[\s\u00A0\u200B\u200C\u200D\u200E\u200F\uFEFF]+$/g, '');
}

function getAdminPassword(env) {
  return normalizeSecret(env.APP_ADMIN_PASSWORD || env.ADMIN_PASSWORD || '');
}

/**
 * Admin-password lookup that also honors a KV-stored rotation at `_config:admin_password`.
 * This keeps `/auth/config` + `/health` self-consistent with the actual login handler
 * even when the password was rotated via KV (instead of re-deploying vars).
 */
async function getAdminPasswordWithKv(env) {
  const direct = getAdminPassword(env);
  if (direct) return direct;
  try {
    if (env && env.USER_DATA && typeof env.USER_DATA.get === 'function') {
      const kv = await env.USER_DATA.get('_config:admin_password');
      const normalized = normalizeSecret(kv || '');
      if (normalized) return normalized;
    }
  } catch (_) {}
  return '';
}

async function getPublicAuthConfig(env) {
  const googleClientId = String(env.GOOGLE_CLIENT_ID_WEB || env.GOOGLE_CLIENT_ID || '').trim();
  const authRequired = String(env.AUTH_REQUIRE_LOGIN || 'true').trim().toLowerCase() !== 'false';
  const adminEmail = getAdminEmail(env);
  // Honor KV-rotated admin password so the public flag stays truthful after rotations.
  const adminPasswordEnabled = !!(await getAdminPasswordWithKv(env));
  const adminGoogleEnabled = !!adminEmail && !!googleClientId;
  const adminEnabled = adminPasswordEnabled || adminGoogleEnabled;
  const allowAabDownloads = String(env.ALLOW_PUBLIC_AAB_DOWNLOADS || '').trim().toLowerCase() === 'true';
  const voice = getVoiceApiConfig(env);
  return {
    ok: true,
    authRequired,
    premiumEnabled: true,
    brandName: String(env.APP_BRAND_NAME || 'AI Workspace Studio').trim(),
    adminEnabled,
    adminEmail,
    adminPasswordEnabled,
    adminLoginMethod: adminPasswordEnabled
      ? (adminGoogleEnabled ? 'password_or_google' : 'password_only')
      : (adminGoogleEnabled ? 'google_only' : 'disabled'),
    allowAabDownloads,
    googleClientId,
    clientIdConfigured: !!googleClientId,
    voiceCloudReady: voice.ready,
    voiceSttReady: voice.sttReady,
    voiceTtsReady: voice.ttsReady,
    voiceProvider: voice.provider,
    voiceRecognitionModel: voice.recognitionModel,
    voiceSynthesisModel: voice.synthesisModel,
    voiceSynthesisVoice: voice.synthesisVoice,
    voicePreferredLanguage: voice.preferredLanguage,
    voicePremiumOnly: false
  };
}

/**
 * Ping OpenRouter's /credits endpoint with the server key to verify it is still
 * accepted. Cached in-module per worker isolate for 60s to avoid hitting the
 * upstream on every health request. Never blocks health beyond ~2s.
 */
let UPSTREAM_KEY_PROBE = { checkedAt: 0, ok: null, status: 0, bodyExcerpt: '' };
async function probeUpstreamKey(env) {
  const key = getServerKey(env);
  if (!key) {
    UPSTREAM_KEY_PROBE = { checkedAt: Date.now(), ok: false, status: 0, bodyExcerpt: 'no-key' };
    return UPSTREAM_KEY_PROBE;
  }
  const now = Date.now();
  if (now - UPSTREAM_KEY_PROBE.checkedAt < 60_000 && UPSTREAM_KEY_PROBE.ok !== null) {
    return UPSTREAM_KEY_PROBE;
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    // Probe OpenRouter WITHOUT any Referer. The key's OpenRouter allowlist (if any) is
    // evaluated on the outbound request; our /credits probe is purely a health ping and
    // must not be rejected by a configured HTTP referrer allowlist.
    const resp = await fetch('https://openrouter.ai/api/v1/credits', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${key}`
      },
      signal: controller.signal
    }).catch(() => null);
    clearTimeout(timer);
    const status = resp ? resp.status : 0;
    let bodyExcerpt = '';
    if (resp) {
      try {
        const text = await resp.text();
        bodyExcerpt = (text || '').slice(0, 220);
      } catch (_) {}
    }
    UPSTREAM_KEY_PROBE = { checkedAt: now, ok: status >= 200 && status < 300, status, bodyExcerpt };
  } catch (e) {
    UPSTREAM_KEY_PROBE = { checkedAt: now, ok: false, status: 0, bodyExcerpt: 'exception:' + (e && e.message ? e.message : 'unknown') };
  }
  return UPSTREAM_KEY_PROBE;
}

async function getWorkerHealth(env, request = null) {
  const upstreamConfigured = !!getServerKey(env);
  const clientTokenRequired = !!String(env.GATEWAY_CLIENT_TOKEN || '').trim();
  const authConfig = await getPublicAuthConfig(env);
  const hasSessionSecret = getSessionSecret(env).length >= 16;
  const hasUpgradeSecret = getUpgradeSecret(env).length >= 16;
  const adminPasswordReady = !!(await getAdminPasswordWithKv(env));
  const adminGoogleReady = !!getAdminEmail(env) && authConfig.clientIdConfigured;
  const adminLoginReady = adminPasswordReady || adminGoogleReady;
  const cloudStorageReady = !!getUserDataStore(env);
  const voice = getVoiceApiConfig(env);
  const convertReady = !!env.CONVERT && typeof env.CONVERT.fetch === 'function';
  const keyProbe = upstreamConfigured ? await probeUpstreamKey(env) : { ok: false, status: 0 };
  const upstreamKeyValid = !!keyProbe.ok;
  const configured = upstreamConfigured || authConfig.clientIdConfigured || adminLoginReady || cloudStorageReady || voice.ready || convertReady;

  // Only admins (verified session, role=admin) or rotate workflow (no Origin, same-origin ops)
  // see upstream probe details + raw OR key length. Normal users see a sanitized health payload.
  let viewerIsAdmin = false;
  if (request) {
    try {
      const s = await requireSession(request, env);
      viewerIsAdmin = s?.role === 'admin';
    } catch (_) {
      viewerIsAdmin = false;
    }
  }
  // Permit the rotate workflow's probes (no browser Origin header) to continue seeing the
  // full diagnostic payload so CI can reason about upstream health. Browser traffic gets the
  // sanitized view.
  const looksLikeBrowser = !!(request && request.headers && request.headers.get('Origin'));
  const showDiag = viewerIsAdmin || !looksLikeBrowser;

  const body = {
    ok: configured,
    ready: configured,
    configured,
    worker: 'keys',
    worker_public_name: String(env.WORKER_PUBLIC_NAME || '').trim() || undefined,
    build_sentinel: 'rotate-v2-sentinel-2026-04-17C',
    upstream_configured: upstreamConfigured,
    upstream_key_valid: upstreamKeyValid,
    client_token_required: clientTokenRequired,
    auth_required: authConfig.authRequired,
    google_client_configured: authConfig.clientIdConfigured,
    admin_password_ready: adminPasswordReady,
    admin_google_ready: adminGoogleReady,
    admin_login_ready: adminLoginReady,
    session_ready: hasSessionSecret,
    upgrade_flow_ready: hasUpgradeSecret,
    cloud_storage_ready: cloudStorageReady,
    convert_proxy_ready: convertReady,
    voice_cloud_ready: voice.ready,
    voice_stt_ready: voice.sttReady,
    voice_tts_ready: voice.ttsReady,
    voice_provider: voice.provider,
    voice_premium_only: false,
    quota_system: 'per_user_v1'
  };

  if (showDiag) {
    body.env_has_openrouter_key = !!(env.OPENROUTER_API_KEY && String(env.OPENROUTER_API_KEY).length > 0);
    body.env_has_admin_password = !!(env.APP_ADMIN_PASSWORD && String(env.APP_ADMIN_PASSWORD).length > 0);
    body.env_admin_password_length = String(env.APP_ADMIN_PASSWORD || '').length;
    body.env_openrouter_key_length = String(env.OPENROUTER_API_KEY || '').length;
    body.upstream = 'openrouter';
    body.upstream_status = keyProbe.status || 0;
    body.upstream_probe_body = keyProbe.bodyExcerpt || '';
  }

  return { status: configured ? 200 : 503, body };
}

const ALLOWED_CORS_ORIGINS = new Set([
  'https://app.saddamalkadi.com',
  'https://api.saddamalkadi.com',
  'https://saddamalkadi.github.io',
  'https://book-summarizer-pwa.pages.dev',
  'capacitor://localhost',
  'ionic://localhost',
  'http://localhost:8080',
  'http://127.0.0.1:8080'
]);

function withCors(response, request) {
  const origin = String(request.headers.get('Origin') || '').trim();
  const h = new Headers(response.headers || {});
  const allowedOrigin = resolveAllowedOrigin(origin);
  if (allowedOrigin) {
    h.set('Access-Control-Allow-Origin', allowedOrigin);
    if (allowedOrigin !== '*') h.set('Vary', 'Origin');
  } else if (!origin) {
    h.set('Access-Control-Allow-Origin', '*');
  } else {
    h.set('Access-Control-Allow-Origin', 'null');
    h.set('Vary', 'Origin');
  }
  h.set('Access-Control-Allow-Methods', 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS');
  h.set('Access-Control-Allow-Headers', [
    'Authorization',
    'Content-Type',
    'Cache-Control',
    'Pragma',
    'X-Client-Token',
    'X-App-Session',
    'X-Admin-Token',
    'HTTP-Referer',
    'X-Title'
  ].join(','));
  h.set('Access-Control-Expose-Headers', 'Content-Type,Content-Length');
  h.delete('alt-svc');
  h.set('Alt-Svc', 'clear');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: h });
}

function resolveAllowedOrigin(origin = '') {
  const value = String(origin || '').trim();
  if (!value) return '*';
  try {
    const parsed = new URL(value);
    const host = String(parsed.hostname || '').toLowerCase();
    if (
      host === 'app.saddamalkadi.com'
      || host === 'api.saddamalkadi.com'
      || host === 'saddamalkadi.com'
      || host.endsWith('.saddamalkadi.com')
      || host === 'saddamalkadi.github.io'
      || host.endsWith('.github.io')
      || host.endsWith('.pages.dev')
      || host === 'localhost'
      || host === '127.0.0.1'
    ) {
      return parsed.origin;
    }
    return '';
  } catch (_) {
    return '';
  }
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
    const adminEmail = getAdminEmail(env);
    const isAdmin = googleProfile.email === adminEmail;
    let plan = isAdmin ? 'premium' : 'free';
    if (upgradeCode) {
      await verifyUpgradeCodeForEmail(upgradeCode, googleProfile.email, env);
      plan = 'premium';
    }

    const session = await issueSessionToken({
      email: googleProfile.email,
      name: googleProfile.name,
      picture: googleProfile.picture,
      plan,
      role: isAdmin ? 'admin' : 'user'
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
    const passwordRaw = String(body?.password || '');
    const passwordNormalized = normalizeSecret(passwordRaw);
    const adminEmail = getAdminEmail(env);
    const adminPassword = await getAdminPasswordWithKv(env);

    if (!email || !passwordNormalized) {
      return jsonResponse({
        error: 'Email and password are required.',
        code: 'AUTH_LOGIN_REQUIRED_FIELDS'
      }, 400);
    }

    if (!adminPassword) {
      return jsonResponse({
        error: 'Admin password sign-in is not available. Please use Google sign-in with the approved admin account.',
        code: 'AUTH_ADMIN_PASSWORD_NOT_CONFIGURED'
      }, 503);
    }

    // Compare both the user-normalized value and the raw typed value against the stored password.
    // This absorbs invisible characters on either side without ever accepting an actual mismatch.
    const matches = email === adminEmail && (
      timingSafeEqual(passwordNormalized, adminPassword)
      || timingSafeEqual(passwordRaw, adminPassword)
      || timingSafeEqual(passwordRaw.trim(), adminPassword)
    );
    if (!matches) {
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

/**
 * Privacy-safe admin password diagnostic: returns only structural facts about the
 * stored password vs the typed password. Never echoes either value. Gated on the
 * admin email so arbitrary users can't profile the secret.
 */
async function handleAdminPasswordDiagnose(request, env) {
  try {
    const body = await parseJson(request);
    const email = String(body?.email || '').trim().toLowerCase();
    const passwordRaw = String(body?.password || '');
    const adminEmail = getAdminEmail(env);
    if (!adminEmail || email !== adminEmail) {
      return jsonResponse({ error: 'Not authorized.', code: 'AUTH_DIAG_NOT_ADMIN' }, 401);
    }
    const stored = await getAdminPasswordWithKv(env);
    const directEnv = normalizeSecret(env.APP_ADMIN_PASSWORD || env.ADMIN_PASSWORD || '');
    const source = directEnv
      ? 'worker_var'
      : (stored ? 'kv_config' : 'none');
    const typedNorm = normalizeSecret(passwordRaw);
    const info = {
      ok: true,
      source,
      storedLength: stored ? stored.length : 0,
      typedRawLength: passwordRaw.length,
      typedNormalizedLength: typedNorm.length,
      typedHadInvisibleEdges: passwordRaw !== typedNorm,
      exactMatchRaw: stored && timingSafeEqual(passwordRaw, stored),
      exactMatchTrim: stored && timingSafeEqual(typedNorm, stored),
      exactMatchStrTrim: stored && timingSafeEqual(passwordRaw.trim(), stored)
    };
    return jsonResponse(info, 200);
  } catch (error) {
    return jsonResponse({
      error: String(error?.message || error || 'Diagnose failed.'),
      code: 'AUTH_DIAG_FAILED'
    }, 400);
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
      const authConfig = await getPublicAuthConfig(env);
      const adminGoogleOnly = authConfig.adminEnabled && !authConfig.adminPasswordEnabled && !!authConfig.googleClientId;
      return jsonResponse({
        error: adminGoogleOnly
          ? 'This email is configured as the admin account. Continue with Google sign-in using the admin Gmail account.'
          : 'This email is configured as the admin account. Use the same form with the admin password.',
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

function getUserDataStore(env) {
  return env.USER_DATA || env.AISTUDIO_DATA || null;
}

function getUserStorageKey(email) {
  return `state:${String(email || '').trim().toLowerCase()}`;
}

async function handleStorageStateGet(request, env) {
  try {
    const session = await requireSession(request, env);
    const store = getUserDataStore(env);
    if (!store || typeof store.get !== 'function') {
      return jsonResponse({
        error: 'Cloud storage is not configured on this worker.',
        code: 'STORAGE_NOT_CONFIGURED'
      }, 503);
    }
    const payload = await store.get(getUserStorageKey(session.email), { type: 'json' });
    return jsonResponse({
      ok: true,
      updatedAt: Number(payload?.updatedAt || 0),
      state: payload?.state || null
    }, 200);
  } catch (error) {
    return jsonResponse({
      error: String(error?.message || error || 'Authentication required.'),
      code: 'STORAGE_GET_FAILED'
    }, 401);
  }
}

async function handleStorageStatePut(request, env) {
  try {
    const session = await requireSession(request, env);
    const store = getUserDataStore(env);
    if (!store || typeof store.put !== 'function') {
      return jsonResponse({
        error: 'Cloud storage is not configured on this worker.',
        code: 'STORAGE_NOT_CONFIGURED'
      }, 503);
    }
    const body = await parseJson(request);
    if (!body?.state || typeof body.state !== 'object') {
      return jsonResponse({
        error: 'A valid state object is required.',
        code: 'STORAGE_STATE_REQUIRED'
      }, 400);
    }
    const doc = {
      email: session.email,
      updatedAt: Date.now(),
      appVersion: String(body?.appVersion || '').trim(),
      reason: String(body?.reason || '').trim(),
      state: body.state
    };
    await store.put(getUserStorageKey(session.email), JSON.stringify(doc));
    return jsonResponse({
      ok: true,
      updatedAt: doc.updatedAt
    }, 200);
  } catch (error) {
    const message = String(error?.message || error || 'Failed to store cloud state.');
    return jsonResponse({
      error: message,
      code: 'STORAGE_PUT_FAILED'
    }, /Authentication required|Missing signed session|Invalid or expired session/i.test(message) ? 401 : 500);
  }
}

function canUsePremiumVoice(session) {
  return !!session;
}

async function handleVoiceTranscription(request, env) {
  try {
    const session = await requireSession(request, env);
    const voice = getVoiceApiConfig(env);
    if (!voice.sttReady) {
      return jsonResponse({
        error: 'Cloud speech-to-text is not configured on this worker.',
        code: 'VOICE_STT_NOT_CONFIGURED'
      }, 503);
    }

    const incoming = await request.formData();
    const file = incoming.get('file');
    if (!(file instanceof File) && !(file instanceof Blob)) {
      return jsonResponse({
        error: 'An audio file is required.',
        code: 'VOICE_STT_FILE_REQUIRED'
      }, 400);
    }

    const form = new FormData();
    form.append('file', file, file.name || `voice-${Date.now()}.webm`);
    form.append('model', String(incoming.get('model') || voice.recognitionModel).trim() || voice.recognitionModel);
    form.append('language', String(incoming.get('language') || voice.preferredLanguage).trim() || voice.preferredLanguage);
    form.append('response_format', 'json');

    if (!voice.apiKey && voice.hasWorkersAi && env.AI?.run) {
      const aiResult = await env.AI.run(voice.recognitionModel, {
        audio: encodeArrayBufferToBase64(await file.arrayBuffer()),
        task: 'transcribe',
        language: normalizeVoiceLanguageTag(incoming.get('language') || voice.preferredLanguage)
      });
      const transcript = String(
        aiResult?.text ||
        aiResult?.transcript ||
        aiResult?.result?.text ||
        ''
      ).trim();
      if (!transcript) {
        return jsonResponse({
          error: 'Workers AI returned an empty transcription.',
          code: 'VOICE_STT_EMPTY'
        }, 502);
      }
      return jsonResponse({
        ok: true,
        text: transcript,
        model: voice.recognitionModel
      }, 200);
    }

    const upstream = await fetch(`${voice.baseUrl}/audio/transcriptions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${voice.apiKey}`
      },
      body: form
    });
    const raw = await upstream.text();
    let payload = null;
    try { payload = raw ? JSON.parse(raw) : null; } catch (_) { payload = null; }
    if (!upstream.ok) {
      return jsonResponse({
        error: payload?.error?.message || payload?.message || raw || 'Cloud transcription failed.',
        code: `VOICE_STT_UPSTREAM_${upstream.status}`
      }, upstream.status);
    }
    return jsonResponse({
      ok: true,
      text: String(payload?.text || payload?.transcript || '').trim(),
      model: String(payload?.model || incoming.get('model') || voice.recognitionModel).trim()
    }, 200);
  } catch (error) {
    const message = String(error?.message || error || 'Cloud transcription failed.');
    return jsonResponse({
      error: message,
      code: /Missing signed session|Invalid or expired session/i.test(message) ? 'AUTH_SESSION_REQUIRED' : 'VOICE_STT_FAILED'
    }, /Missing signed session|Invalid or expired session/i.test(message) ? 401 : 500);
  }
}

async function handleGoogleTtsProxy(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const text = String(body?.text || '').trim();
    const lang = String(body?.lang || 'ar').split('-')[0] || 'ar';
    if (!text) return new Response(JSON.stringify({ error: 'text required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    const chunks = [];
    const words = text.split(/\s+/);
    let cur = '';
    for (const w of words) {
      if ((cur + ' ' + w).trim().length > 180) { if (cur.trim()) chunks.push(cur.trim()); cur = w; }
      else cur = (cur + ' ' + w).trim();
    }
    if (cur.trim()) chunks.push(cur.trim());
    const bufs = [];
    for (const c of chunks) {
      const url = 'https://translate.googleapis.com/translate_tts?ie=UTF-8&q=' + encodeURIComponent(c) + '&tl=' + encodeURIComponent(lang) + '&client=gtx&ttsspeed=0.9';
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://translate.google.com/', 'Accept': 'audio/mpeg,audio/*;q=0.8' } });
      if (!r.ok) throw new Error('Google TTS ' + r.status);
      bufs.push(await r.arrayBuffer());
    }
    const total = bufs.reduce((s, b) => s + b.byteLength, 0);
    const out = new Uint8Array(total); let off = 0;
    for (const b of bufs) { out.set(new Uint8Array(b), off); off += b.byteLength; }
    return new Response(out, { status: 200, headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store', 'Content-Length': String(total) } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e.message) }), { status: 502, headers: { 'Content-Type': 'application/json' } });
  }
}

async function handleVoiceSynthesis(request, env) {
  try {
    const session = await requireSession(request, env);
    const voice = getVoiceApiConfig(env);
    if (!voice.ttsReady) {
      return jsonResponse({
        error: 'Cloud text-to-speech is not configured on this worker.',
        code: 'VOICE_TTS_NOT_CONFIGURED'
      }, 503);
    }

    const body = await parseJson(request);
    const text = String(body?.text || '').trim();
    if (!text) {
      return jsonResponse({
        error: 'Text is required for speech synthesis.',
        code: 'VOICE_TTS_TEXT_REQUIRED'
      }, 400);
    }
    const requestedLanguage = normalizeVoiceLanguageTag(body?.language || voice.preferredLanguage);
    const prefersArabicTts = /^ar(?:-|$)/i.test(requestedLanguage) || /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(text);

    if (prefersArabicTts) {
      const proxyReq = new Request('https://tts.invalid/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          lang: normalizeVoiceLanguageTag(requestedLanguage, { preserveRegion: false })
        })
      });
      return await handleGoogleTtsProxy(proxyReq);
    }

    if (!voice.apiKey && voice.hasWorkersAi && env.AI?.run) {
      const aiResult = await env.AI.run(voice.synthesisModel, {
        prompt: text,
        lang: requestedLanguage,
        speaker: String(body?.voice || voice.synthesisVoice || 'ar').trim() || 'ar'
      });
      const audioBase64 = String(
        aiResult?.audio ||
        aiResult?.result?.audio ||
        aiResult?.audio_base64 ||
        ''
      ).trim();
      if (!audioBase64) {
        const isArabic = /^ar(?:-|$)/i.test(String(body?.language || voice.preferredLanguage || '').trim());
        if (isArabic) {
          const proxyReq = new Request('https://tts.invalid/proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text,
              lang: normalizeVoiceLanguageTag(body?.language || voice.preferredLanguage || 'ar-SA', { preserveRegion: false })
            })
          });
          return await handleGoogleTtsProxy(proxyReq);
        }
        return jsonResponse({
          error: 'Workers AI returned no audio payload.',
          code: 'VOICE_TTS_EMPTY'
        }, 502);
      }
      return new Response(decodeBase64ToBytes(audioBase64), {
        status: 200,
        headers: {
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'no-store'
        }
      });
    }

    const upstream = await fetch(`${voice.baseUrl}/audio/speech`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${voice.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: String(body?.model || voice.synthesisModel).trim() || voice.synthesisModel,
        voice: String(body?.voice || voice.synthesisVoice).trim() || voice.synthesisVoice,
        input: text,
        format: String(body?.format || 'mp3').trim() || 'mp3'
      })
    });

    if (!upstream.ok) {
      const raw = await upstream.text().catch(() => '');
      let payload = null;
      try { payload = raw ? JSON.parse(raw) : null; } catch (_) { payload = null; }
      return jsonResponse({
        error: payload?.error?.message || payload?.message || raw || 'Cloud speech synthesis failed.',
        code: `VOICE_TTS_UPSTREAM_${upstream.status}`
      }, upstream.status);
    }

    const headers = new Headers();
    headers.set('Content-Type', upstream.headers.get('Content-Type') || 'audio/mpeg');
    headers.set('Cache-Control', 'no-store');
    return new Response(upstream.body, {
      status: upstream.status,
      headers
    });
  } catch (error) {
    const message = String(error?.message || error || 'Cloud speech synthesis failed.');
    return jsonResponse({
      error: message,
      code: /Missing signed session|Invalid or expired session/i.test(message) ? 'AUTH_SESSION_REQUIRED' : 'VOICE_TTS_FAILED'
    }, /Missing signed session|Invalid or expired session/i.test(message) ? 401 : 500);
  }
}

async function handleUpgradeRequest(request, env) {
  try {
    const session = await requireSession(request, env);
    const mailto = buildUpgradeMailto(session, String(env.APP_UPGRADE_EMAIL || ''));
    return jsonResponse({
      ok: true,
      email: session.email,
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
    const payload = await verifyUpgradeCodeForEmail(code, session.email, env);
    const upgraded = await issueSessionToken({
      email: session.email,
      name: session.name,
      picture: session.picture,
      plan: 'premium',
      role: session.role === 'admin' ? 'admin' : 'user'
    }, env);
    // Apply optional quota bundle from the upgrade code: limitUsd + periodDays.
    // This lets admins issue codes like "Premium + $5 / 30 days" that deterministically
    // set the user's quota on activation instead of relying on the plan default.
    let quotaAfterUpgrade = null;
    try {
      const appliedSession = { email: session.email, name: session.name, role: session.role === 'admin' ? 'admin' : 'user', plan: 'premium' };
      quotaAfterUpgrade = await applyUpgradeCodeToQuota(appliedSession, payload, env);
    } catch (_) { /* quota side-effects shouldn't block the session swap */ }
    return jsonResponse({
      ...upgraded,
      upgradeAccepted: true,
      upgrade: {
        plan: payload.plan || 'premium',
        limitUsd: Number.isFinite(Number(payload.limitUsd)) ? Number(payload.limitUsd) : null,
        periodDays: Number.isFinite(Number(payload.periodDays)) ? Number(payload.periodDays) : null,
        note: String(payload.note || '')
      },
      quota: quotaAfterUpgrade ? quotaPublicView(quotaAfterUpgrade) : null
    }, 200);
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
  // Explicit quota bundle carried by the code. limitUsd is the amount of upstream credit
  // the user gets for this activation (e.g. 1, 5, 10 USD). periodDays defaults to 30 days
  // but admins can override (e.g. single-shot 7-day trial codes).
  const rawLimit = Number(body?.limitUsd);
  const limitUsd = Number.isFinite(rawLimit) && rawLimit >= 0 ? Math.round(rawLimit * 1_000_000) / 1_000_000 : null;
  const periodDays = clampNumber(body?.periodDays, 1, 3650, 30);
  const note = String(body?.note || '').slice(0, 180);
  if (!email || !email.includes('@')) {
    return jsonResponse({
      error: 'A valid email is required to generate an upgrade code.',
      code: 'UPGRADE_EMAIL_REQUIRED'
    }, 400);
  }
  const code = await createUpgradeCode({ email, plan, days, limitUsd, periodDays, note }, env);
  return jsonResponse({
    ok: true,
    email,
    plan,
    code,
    limitUsd,
    periodDays,
    note,
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

  if (!authHeader && url.pathname === '/v1/models') {
    return withCors(jsonResponse({
      object: 'list',
      data: FALLBACK_MODEL_LIST
    }, 200), request);
  }

  if (!authHeader) {
    return withCors(jsonResponse({
      error: 'Missing API key. Set OPENROUTER_API_KEY in Cloudflare Worker Secrets, or send Authorization header for temporary browser-side auth.',
      code: 'GATEWAY_MISSING_UPSTREAM_KEY',
      configured: false
    }, 401), request);
  }

  // Resolve the session once so every gated branch below can share the result.
  let gatewaySession = null;
  try { gatewaySession = await requireSession(request, env); } catch (_) { gatewaySession = null; }

  // /v1/credits: per-user quota replaces raw OpenRouter credits for non-admins so users
  // never see the shared OpenRouter balance. Admins get OpenRouter's real /credits payload.
  if (url.pathname === '/v1/credits' && request.method === 'GET') {
    if (!gatewaySession) {
      return withCors(jsonResponse({
        error: 'Authentication required for credits.',
        code: 'AUTH_SESSION_REQUIRED'
      }, 401), request);
    }
    if (gatewaySession.role === 'admin') {
      // Fall through below to proxy OpenRouter /credits as-is for admin diagnostics.
    } else {
      const quota = await getOrInitUserQuota(gatewaySession, env);
      return withCors(jsonResponse({
        data: quotaAsCreditsPayload(quota)
      }, 200), request);
    }
  }

  // Metered endpoints — require session + enforce quota before forwarding.
  const isMeteredChat =
    url.pathname === '/v1/chat/completions' ||
    url.pathname === '/v1/completions';
  if (isMeteredChat) {
    if (!gatewaySession) {
      return withCors(jsonResponse({
        error: 'Authentication required for chat.',
        code: 'AUTH_SESSION_REQUIRED'
      }, 401), request);
    }
    const quota = await getOrInitUserQuota(gatewaySession, env);
    if (quota.remaining <= 0) {
      return withCors(jsonResponse({
        error: 'تم استنفاد حصتك الشهرية. يمكنك التواصل مع الإدارة لتجديد الحصة.',
        code: 'QUOTA_EXHAUSTED',
        quota: quotaPublicView(quota)
      }, 429), request);
    }
  }

  const upstreamPath = url.pathname.startsWith('/v1/')
    ? `/api${url.pathname}`
    : url.pathname;
  const upstreamUrl = new URL(`https://openrouter.ai${upstreamPath}${url.search}`);

  const headers = new Headers(request.headers);
  headers.set('Authorization', authHeader);
  headers.set('Host', 'openrouter.ai');
  const referer = String(env.OPENROUTER_REFERER || url.origin || 'https://app.saddamalkadi.com/').trim() || 'https://app.saddamalkadi.com/';
  headers.set('Referer', referer);
  headers.set('HTTP-Referer', referer);
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
    // Special-case OpenRouter's "User not found" / 401 responses so the UI can show a
    // clear, non-generic message and the admin knows to rotate the server key.
    const isInvalidKey = upstreamResp.status === 401 && (
      /user not found/i.test(upstreamMessage) || /invalid.*(api|key)/i.test(upstreamMessage)
    );
    const friendly = isInvalidKey
      ? 'بوابة OpenRouter رفضت المفتاح الحالي (غير صالح أو تم إبطاله). يرجى تدوير OPENROUTER_API_KEY في إعدادات الخادم ثم إعادة المحاولة.'
      : upstreamMessage;
    return withCors(jsonResponse({
      error: friendly,
      code: isInvalidKey ? 'GATEWAY_UPSTREAM_INVALID_KEY' : `GATEWAY_UPSTREAM_${upstreamResp.status}`,
      upstream_status: upstreamResp.status,
      requires_key_rotation: isInvalidKey || undefined
    }, upstreamResp.status), request);
  }

  // Meter usage for chat/completions requests of authenticated users so the deduction
  // happens whether the response is streaming or buffered.
  if (isMeteredChat && gatewaySession) {
    const contentType = String(upstreamResp.headers.get('Content-Type') || '').toLowerCase();
    const isSse = contentType.includes('text/event-stream') || contentType.includes('stream');
    if (isSse && upstreamResp.body) {
      const { readable, meterPromise } = meterSseStream(upstreamResp.body);
      // Fire-and-forget: deduct after the stream fully drains, using Worker's ctx.waitUntil
      // isn't available here, but awaiting the promise before returning would block streaming.
      // Instead we schedule it via the readable tee; meterSseStream resolves when terminal
      // chunk arrives and we apply the deduction asynchronously.
      meterPromise.then((usage) => {
        return applyQuotaDeductionFromUsage(gatewaySession, usage, env);
      }).catch(() => {});
      return withCors(new Response(readable, {
        status: upstreamResp.status,
        statusText: upstreamResp.statusText,
        headers: upstreamResp.headers
      }), request);
    }
    // Non-streaming JSON: buffer, meter, forward.
    const raw = await upstreamResp.text().catch(() => '');
    let parsed = null;
    try { parsed = raw ? JSON.parse(raw) : null; } catch (_) { parsed = null; }
    const usage = extractUsageMetaFromOpenAiPayload(parsed);
    try { await applyQuotaDeductionFromUsage(gatewaySession, usage, env); } catch (_) {}
    return withCors(new Response(raw, {
      status: upstreamResp.status,
      statusText: upstreamResp.statusText,
      headers: upstreamResp.headers
    }), request);
  }

  return withCors(new Response(upstreamResp.body, {
    status: upstreamResp.status,
    statusText: upstreamResp.statusText,
    headers: upstreamResp.headers
  }), request);
}

async function proxyConvertService(request, env, targetPath) {
  if (!env.CONVERT || typeof env.CONVERT.fetch !== 'function') {
    return jsonResponse({
      error: 'Cloud convert service is not bound on this worker.',
      code: 'CONVERT_SERVICE_NOT_BOUND'
    }, 503);
  }
  const sourceUrl = new URL(request.url);
  const proxyUrl = new URL(sourceUrl.toString());
  proxyUrl.pathname = targetPath;
  const headers = new Headers(request.headers);
  const init = {
    method: request.method,
    headers,
    body: canHaveBody(request.method) ? request.body : undefined,
    redirect: 'follow'
  };
  return env.CONVERT.fetch(new Request(proxyUrl.toString(), init));
}

async function requireSession(request, env) {
  const token = getSessionTokenFromRequest(request);
  if (!token) {
    throw new Error('Missing signed session. Please log in with Google first.');
  }
  const secret = getSessionSecret(env);
  if (!secret) {
    throw new Error('Authentication is temporarily unavailable.');
  }
  const payload = await verifySignedToken(token, secret, 'session');
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
  const secret = getSessionSecret(env);
  if (!secret) {
    throw new Error('Authentication is temporarily unavailable.');
  }
  const sessionToken = await signCompactToken(payload, secret, 'session');
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

async function createUpgradeCode({ email, plan = 'premium', days = 365, limitUsd = null, periodDays = 30, note = '' }, env) {
  const now = Date.now();
  const payload = {
    iss: 'aistudio',
    typ: 'upgrade',
    email: String(email || '').trim().toLowerCase(),
    plan: plan === 'premium' ? 'premium' : 'premium',
    iat: Math.floor(now / 1000),
    exp: Math.floor((now + (days * 24 * 60 * 60 * 1000)) / 1000)
  };
  if (Number.isFinite(Number(limitUsd)) && Number(limitUsd) >= 0) {
    payload.limitUsd = Number(limitUsd);
  }
  const pd = Number(periodDays);
  if (Number.isFinite(pd) && pd > 0) payload.periodDays = Math.floor(pd);
  if (note) payload.note = String(note).slice(0, 180);
  const signed = await signCompactToken(payload, getUpgradeSecret(env), 'upgrade');
  return `AIPRO-${signed}`;
}

// Apply the upgrade code's quota bundle directly to the user's KV quota doc so
// `/me/quota` reflects the new limit immediately after activation. Keeps accumulated
// usage visible as `lifetimeUsed` for auditing.
async function applyUpgradeCodeToQuota(session, codePayload, env) {
  const email = String(session?.email || '').trim().toLowerCase();
  if (!email) return null;
  const rawLimit = Number(codePayload?.limitUsd);
  const rawDays = Number(codePayload?.periodDays);
  const hasExplicitLimit = Number.isFinite(rawLimit) && rawLimit >= 0;
  const periodDays = Number.isFinite(rawDays) && rawDays > 0 ? Math.floor(rawDays) : QUOTA_PERIOD_DAYS;
  if (!hasExplicitLimit) {
    // No explicit limit -> just ensure the plan is lifted and a fresh period begins.
    const base = await getOrInitUserQuota({ ...session, plan: 'premium', role: session.role === 'admin' ? 'admin' : 'user' }, env);
    return base;
  }
  const now = nowMs();
  const period = { periodStart: now, periodEnd: now + periodDays * 24 * 60 * 60 * 1000 };
  const existing = await readQuotaFromKv(email, env);
  const base = existing && existing.email === email ? existing : {
    email,
    plan: 'premium',
    role: session.role === 'admin' ? 'admin' : 'user',
    limit: 0,
    used: 0,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    lastPromptTokens: 0, lastCompletionTokens: 0, lastTotalTokens: 0,
    lastCost: 0, lastModel: '', lastUpdatedAt: 0, lifetimeUsed: 0
  };
  const next = {
    ...base,
    plan: 'premium',
    limit: roundUsd(rawLimit),
    limitSource: 'upgrade_code',
    upgradeCodeLimitUsd: roundUsd(rawLimit),
    upgradeCodePeriodDays: periodDays,
    used: 0,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    lifetimeUsed: Number(base.lifetimeUsed || 0) + Number(base.used || 0),
    lastUpgradeAt: now,
    updatedAt: now
  };
  await writeQuotaToKv(next, env);
  return next;
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
  const normalizedSecret = String(secret || '').trim();
  if (!normalizedSecret) {
    throw new Error('Token signing secret is not configured.');
  }
  const header = { alg: 'HS256', typ };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const message = `${encodedHeader}.${encodedPayload}`;
  const signature = await hmacSha256Base64Url(message, normalizedSecret);
  return `${message}.${signature}`;
}

async function verifySignedToken(token, secret, expectedType) {
  const normalizedSecret = String(secret || '').trim();
  if (!normalizedSecret) {
    throw new Error('Token verification secret is not configured.');
  }
  const parts = String(token || '').trim().split('.');
  if (parts.length !== 3) throw new Error('Malformed signed token.');
  const [encodedHeader, encodedPayload, signature] = parts;
  const expectedSignature = await hmacSha256Base64Url(`${encodedHeader}.${encodedPayload}`, normalizedSecret);
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
    String(env.GOOGLE_CLIENT_ID_ANDROID || '').trim(),
    String(env.GOOGLE_CLIENT_ID_ANDROID_DEBUG || '').trim(),
    String(clientIdHint || '').trim()
  ].filter(Boolean);
  const audienceValues = Array.isArray(payload?.aud)
    ? payload.aud.map((value) => String(value || '').trim()).filter(Boolean)
    : [String(payload?.aud || '').trim()].filter(Boolean);
  const authorizedParty = String(payload?.azp || '').trim();
  const audienceMatches = audienceValues.some((value) => allowedClientIds.includes(value));
  const azpMatches = authorizedParty ? allowedClientIds.includes(authorizedParty) : false;

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
  if (allowedClientIds.length && !audienceMatches && !azpMatches) {
    throw new Error(`Google credential audience mismatch. aud=${audienceValues.join(',') || 'n/a'} azp=${authorizedParty || 'n/a'}`);
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
  const receiver = String(upgradeEmail || '').trim();
  if (!receiver) return '';
  const to = encodeURIComponent(receiver);
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

/* =============================================================================
 * Per-user quota system (v1)
 *
 * Each authenticated user owns a quota document in KV under `quota:<email>`:
 *   {
 *     email, plan, limit, used, periodStart, periodEnd,
 *     lastPromptTokens, lastCompletionTokens, lastTotalTokens,
 *     lastCost, lastModel, lastUpdatedAt, updatedAt
 *   }
 *
 * Limits are expressed in USD cents (to avoid float drift) and converted to USD
 * on the wire. Each `/v1/chat/completions` deducts based on upstream-reported
 * cost (USD) when present, otherwise a per-token fallback.
 *
 * Non-admin users only ever see their own quota. Admins can list + patch limits.
 * =============================================================================
 */

const QUOTA_KV_PREFIX = 'quota:';
const QUOTA_INDEX_KEY = '_quota:index';
const QUOTA_DEFAULT_PLAN_LIMITS_USD = {
  free: 0.50,
  premium: 10.00,
  admin: 1000.00
};
const QUOTA_PERIOD_DAYS = 30;
// Fallback cost-per-token when upstream usage.cost is missing. Conservative blended estimate
// across gpt-4o-mini-ish models. 1M tokens ≈ $0.60 in / $2.40 out → use weighted avg $1.00/M.
const QUOTA_FALLBACK_USD_PER_TOKEN = 1.0 / 1_000_000;

function roundUsd(value) {
  const n = Number(value) || 0;
  return Math.round(n * 1_000_000) / 1_000_000;
}

function nowMs() { return Date.now(); }

function computePeriod(startMs) {
  const start = Number(startMs) || nowMs();
  const end = start + QUOTA_PERIOD_DAYS * 24 * 60 * 60 * 1000;
  return { periodStart: start, periodEnd: end };
}

function planLimitUsd(plan, role, envOverrides = {}) {
  if (role === 'admin') {
    const override = Number(envOverrides.ADMIN_QUOTA_USD);
    return Number.isFinite(override) && override > 0 ? override : QUOTA_DEFAULT_PLAN_LIMITS_USD.admin;
  }
  if (plan === 'premium') {
    const override = Number(envOverrides.PREMIUM_QUOTA_USD);
    return Number.isFinite(override) && override > 0 ? override : QUOTA_DEFAULT_PLAN_LIMITS_USD.premium;
  }
  const override = Number(envOverrides.FREE_QUOTA_USD);
  return Number.isFinite(override) && override > 0 ? override : QUOTA_DEFAULT_PLAN_LIMITS_USD.free;
}

function quotaPublicView(q) {
  const limit = Number(q.limit) || 0;
  const used = Number(q.used) || 0;
  const remaining = Math.max(0, roundUsd(limit - used));
  return {
    email: q.email,
    plan: q.plan || 'free',
    limit: roundUsd(limit),
    used: roundUsd(used),
    remaining,
    limitSource: q.limitSource || 'plan_default',
    upgradeCodeLimitUsd: Number.isFinite(Number(q.upgradeCodeLimitUsd)) ? Number(q.upgradeCodeLimitUsd) : null,
    upgradeCodePeriodDays: Number.isFinite(Number(q.upgradeCodePeriodDays)) ? Number(q.upgradeCodePeriodDays) : null,
    periodStart: q.periodStart,
    periodEnd: q.periodEnd,
    lastPromptTokens: q.lastPromptTokens || 0,
    lastCompletionTokens: q.lastCompletionTokens || 0,
    lastTotalTokens: q.lastTotalTokens || 0,
    lastCost: roundUsd(q.lastCost || 0),
    lastModel: q.lastModel || '',
    lastUpdatedAt: q.lastUpdatedAt || 0,
    updatedAt: q.updatedAt || 0
  };
}

function quotaAsCreditsPayload(q) {
  const view = quotaPublicView(q);
  return {
    total_credits: view.limit,
    total_usage: view.used,
    remaining_credits: view.remaining,
    plan: view.plan,
    period_end: view.periodEnd,
    source: 'per_user_quota'
  };
}

// Cloudflare KV has eventual consistency (up to ~60s) across edges. For the quota
// doc, that's fatal: a user activates a $5 upgrade code on edge A, then the next
// `/me/quota` read hits edge B, gets the stale null/old doc, and `getOrInitUserQuota`
// over-writes with a fresh plan-default ($10). To paper over this window we mirror
// every write to the per-edge Cache API (`caches.default`) and consult it before
// the KV read. This is strong read-after-write consistency within the same edge
// and greatly reduces the likelihood of a stale KV-only read.
function quotaCacheRequest(email) {
  const key = `quota:${String(email || '').trim().toLowerCase()}`;
  return new Request(`https://aistudio.internal.cache/${encodeURIComponent(key)}`);
}

async function readQuotaFromCache(email) {
  try {
    const resp = await caches.default.match(quotaCacheRequest(email));
    if (!resp) return null;
    const data = await resp.json();
    if (data && typeof data === 'object' && data.email) return data;
  } catch (_) {}
  return null;
}

async function writeQuotaToCache(q) {
  try {
    const body = JSON.stringify(q);
    // 300s TTL — long enough to dominate KV's ~60s eventual-consistency window but
    // short enough that admin quota patches applied in the Cloudflare dashboard or
    // via /admin/users/quota become visible quickly.
    const resp = new Response(body, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'max-age=300'
      }
    });
    await caches.default.put(quotaCacheRequest(q.email), resp);
  } catch (_) { /* cache writes are best-effort */ }
}

async function readQuotaFromKv(email, env) {
  // Cache-first: avoids the KV eventual-consistency window right after a write.
  const cached = await readQuotaFromCache(email);
  if (cached) return cached;
  const store = getUserDataStore(env);
  if (!store || typeof store.get !== 'function') return null;
  try {
    const raw = await store.get(QUOTA_KV_PREFIX + email, { type: 'json' });
    if (raw && typeof raw === 'object') {
      // Warm the cache so subsequent reads on this edge are immediate.
      await writeQuotaToCache(raw);
      return raw;
    }
  } catch (_) {}
  return null;
}

async function writeQuotaToKv(q, env) {
  const store = getUserDataStore(env);
  // Always write to the per-edge cache first — even if KV is unavailable this keeps
  // the quota visible within the same edge until the next full write succeeds.
  await writeQuotaToCache(q);
  if (!store || typeof store.put !== 'function') return false;
  try {
    await store.put(QUOTA_KV_PREFIX + q.email, JSON.stringify(q));
    // Best-effort user index so /admin/usage doesn't need a list() walk on every call.
    try {
      const idxRaw = await store.get(QUOTA_INDEX_KEY, { type: 'json' });
      const idx = Array.isArray(idxRaw?.users) ? idxRaw.users : [];
      if (!idx.includes(q.email)) {
        idx.push(q.email);
        await store.put(QUOTA_INDEX_KEY, JSON.stringify({ users: idx, updatedAt: nowMs() }));
      }
    } catch (_) {}
    return true;
  } catch (_) { return false; }
}

async function getOrInitUserQuota(session, env) {
  const email = String(session.email || '').trim().toLowerCase();
  const existing = await readQuotaFromKv(email, env);
  const role = session.role === 'admin' ? 'admin' : 'user';
  const plan = role === 'admin' ? 'admin' : (session.plan === 'premium' ? 'premium' : 'free');
  const defaultLimit = planLimitUsd(plan, role, env);
  const now = nowMs();

  if (existing && existing.email === email && Number(existing.periodEnd) > now) {
    // Promote the cached plan if the user's session plan/role upgraded since last check,
    // but preserve accumulated usage within the active billing window.
    // IMPORTANT: do NOT auto-raise `limit` here. When an admin-issued upgrade code sets
    // an explicit limit (e.g. $5), raising it to the plan-default ($10) silently would
    // overwrite the admin's intent. Mid-period limit changes must go through the admin
    // patch endpoint, never through a background init/read.
    const patched = { ...existing };
    let changed = false;
    if (patched.plan !== plan) { patched.plan = plan; changed = true; }
    if (patched.role !== role) { patched.role = role; changed = true; }
    if (!patched.limitSource) { patched.limitSource = 'plan_default'; changed = true; }
    if (changed) {
      patched.updatedAt = now;
      await writeQuotaToKv(patched, env);
    }
    return patched;
  }

  // Either no quota yet, or the billing period rolled over → initialize a fresh period
  // while preserving legacy totals under `lifetimeUsed` for observability.
  const period = computePeriod(now);
  const fresh = {
    email,
    plan,
    role,
    limit: defaultLimit,
    limitSource: 'plan_default',
    used: 0,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    lastPromptTokens: 0,
    lastCompletionTokens: 0,
    lastTotalTokens: 0,
    lastCost: 0,
    lastModel: '',
    lastUpdatedAt: 0,
    lifetimeUsed: Number(existing?.lifetimeUsed || 0) + Number(existing?.used || 0),
    updatedAt: now
  };
  await writeQuotaToKv(fresh, env);
  return fresh;
}

async function applyQuotaDeductionFromUsage(session, usage, env) {
  if (!session || !usage) return null;
  const email = String(session.email || '').trim().toLowerCase();
  if (!email) return null;

  const upstreamCost = Number(usage.cost);
  const totalTokens = Number(usage.totalTokens) || 0;
  const deltaCost = Number.isFinite(upstreamCost) && upstreamCost > 0
    ? upstreamCost
    : totalTokens * QUOTA_FALLBACK_USD_PER_TOKEN;

  const current = await readQuotaFromKv(email, env);
  const base = current && current.email === email ? current : await getOrInitUserQuota(session, env);
  const nextUsed = roundUsd(Number(base.used || 0) + deltaCost);
  const patch = {
    ...base,
    used: nextUsed,
    lastPromptTokens: Number(usage.promptTokens) || 0,
    lastCompletionTokens: Number(usage.completionTokens) || 0,
    lastTotalTokens: totalTokens,
    lastCost: roundUsd(deltaCost),
    lastModel: String(usage.model || '').trim(),
    lastUpdatedAt: nowMs(),
    updatedAt: nowMs()
  };
  await writeQuotaToKv(patch, env);
  return patch;
}

function extractUsageMetaFromOpenAiPayload(payload) {
  const usage = (payload?.usage && typeof payload.usage === 'object') ? payload.usage : {};
  const promptTokens = Number(usage.prompt_tokens || usage.input_tokens || 0) || 0;
  const completionTokens = Number(usage.completion_tokens || usage.output_tokens || 0) || 0;
  const totalTokens = Number(usage.total_tokens || (promptTokens + completionTokens)) || 0;
  const cost = Number(usage.cost || usage.total_cost || payload?.cost || 0) || 0;
  const model = String(payload?.model || '').trim();
  return { promptTokens, completionTokens, totalTokens, cost, model };
}

/**
 * Wrap an SSE response body in a TransformStream so we can (a) passthrough all bytes to the
 * client unchanged for real streaming UX, while (b) parsing chunks in parallel to extract
 * the final usage object OpenRouter (and OpenAI-compatible providers) emit on the terminal
 * chunk. Returns the passthrough stream + a promise that resolves with extracted usage
 * metadata when the upstream terminates.
 */
function meterSseStream(upstreamBody) {
  const { readable, writable } = new TransformStream();
  let usageOut = { promptTokens: 0, completionTokens: 0, totalTokens: 0, cost: 0, model: '' };
  let usageResolve;
  const meterPromise = new Promise((resolve) => { usageResolve = resolve; });

  (async () => {
    const writer = writable.getWriter();
    const reader = upstreamBody.getReader();
    const decoder = new TextDecoder();
    let pending = '';
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        try { await writer.write(value); } catch (_) {}
        pending += decoder.decode(value, { stream: true });
        // Parse SSE "data: {json}" blocks.
        let idx;
        while ((idx = pending.indexOf('\n\n')) !== -1) {
          const block = pending.slice(0, idx);
          pending = pending.slice(idx + 2);
          for (const line of block.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const json = trimmed.slice(5).trim();
            if (!json || json === '[DONE]') continue;
            try {
              const obj = JSON.parse(json);
              const meta = extractUsageMetaFromOpenAiPayload(obj);
              if (meta.totalTokens) usageOut.totalTokens = meta.totalTokens;
              if (meta.promptTokens) usageOut.promptTokens = meta.promptTokens;
              if (meta.completionTokens) usageOut.completionTokens = meta.completionTokens;
              if (meta.cost) usageOut.cost = meta.cost;
              if (meta.model) usageOut.model = meta.model;
            } catch (_) {}
          }
        }
      }
    } catch (_) {
      // Pass — we still want to resolve with whatever we captured.
    } finally {
      try { await writer.close(); } catch (_) {}
      usageResolve(usageOut);
    }
  })();

  return { readable, meterPromise };
}

async function handleMeQuota(request, env) {
  try {
    const session = await requireSession(request, env);
    const quota = await getOrInitUserQuota(session, env);
    return jsonResponse({
      ok: true,
      role: session.role === 'admin' ? 'admin' : 'user',
      quota: quotaPublicView(quota)
    }, 200);
  } catch (error) {
    return jsonResponse({
      error: String(error?.message || error || 'Authentication required.'),
      code: 'AUTH_SESSION_REQUIRED'
    }, 401);
  }
}

async function listAllQuotaEmails(env) {
  const store = getUserDataStore(env);
  if (!store) return [];
  const emails = new Set();
  // Prefer the lightweight index; fall back to list() for robustness.
  try {
    const idxRaw = await store.get(QUOTA_INDEX_KEY, { type: 'json' });
    if (Array.isArray(idxRaw?.users)) {
      for (const e of idxRaw.users) emails.add(String(e).trim().toLowerCase());
    }
  } catch (_) {}
  try {
    if (typeof store.list === 'function') {
      let cursor = undefined;
      for (let i = 0; i < 20; i += 1) {
        const page = await store.list({ prefix: QUOTA_KV_PREFIX, cursor });
        for (const entry of (page.keys || [])) {
          const name = String(entry.name || '');
          if (name.startsWith(QUOTA_KV_PREFIX)) {
            emails.add(name.slice(QUOTA_KV_PREFIX.length).toLowerCase());
          }
        }
        if (page.list_complete || !page.cursor) break;
        cursor = page.cursor;
      }
    }
  } catch (_) {}
  return Array.from(emails);
}

async function handleAdminUsage(request, env) {
  try {
    const session = await requireSession(request, env);
    if (session.role !== 'admin') {
      return jsonResponse({ error: 'Admin access required.', code: 'ADMIN_REQUIRED' }, 403);
    }
    const emails = await listAllQuotaEmails(env);
    const users = [];
    let totalUsed = 0;
    let totalLimit = 0;
    for (const email of emails) {
      const q = await readQuotaFromKv(email, env);
      if (q) {
        const view = quotaPublicView(q);
        users.push(view);
        totalUsed += Number(view.used) || 0;
        totalLimit += Number(view.limit) || 0;
      }
    }
    // Only admins see the shared OpenRouter raw balance — this is explicitly a privileged view.
    let openrouterCredits = null;
    try {
      const probe = await probeUpstreamKey(env);
      if (probe.ok && probe.bodyExcerpt) {
        try { openrouterCredits = JSON.parse(probe.bodyExcerpt); } catch (_) { openrouterCredits = null; }
      }
    } catch (_) {}
    return jsonResponse({
      ok: true,
      generatedAt: nowMs(),
      userCount: users.length,
      totals: { usedUsd: roundUsd(totalUsed), limitUsd: roundUsd(totalLimit) },
      users,
      openrouter: openrouterCredits
    }, 200);
  } catch (error) {
    return jsonResponse({
      error: String(error?.message || error || 'Authentication required.'),
      code: 'AUTH_SESSION_REQUIRED'
    }, 401);
  }
}

async function handleAdminUsersQuota(request, env) {
  try {
    const session = await requireSession(request, env);
    if (session.role !== 'admin') {
      return jsonResponse({ error: 'Admin access required.', code: 'ADMIN_REQUIRED' }, 403);
    }
    if (request.method === 'GET') {
      const u = new URL(request.url);
      const email = String(u.searchParams.get('email') || '').trim().toLowerCase();
      if (!email) return jsonResponse({ error: 'email query param is required', code: 'EMAIL_REQUIRED' }, 400);
      const q = await readQuotaFromKv(email, env);
      return jsonResponse({ ok: true, quota: q ? quotaPublicView(q) : null }, 200);
    }
    // POST: patch one user's quota (limit, used, plan).
    const body = await parseJson(request);
    const email = String(body?.email || '').trim().toLowerCase();
    if (!email) return jsonResponse({ error: 'email is required', code: 'EMAIL_REQUIRED' }, 400);
    const existing = await readQuotaFromKv(email, env);
    const period = computePeriod(existing?.periodStart || nowMs());
    const base = existing && existing.email === email ? existing : {
      email,
      plan: 'free',
      role: 'user',
      limit: QUOTA_DEFAULT_PLAN_LIMITS_USD.free,
      used: 0,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      lastPromptTokens: 0, lastCompletionTokens: 0, lastTotalTokens: 0, lastCost: 0,
      lastModel: '', lastUpdatedAt: 0, updatedAt: nowMs()
    };
    const patch = { ...base };
    if (body?.limit != null) {
      const v = Number(body.limit);
      if (Number.isFinite(v) && v >= 0) patch.limit = roundUsd(v);
    }
    if (body?.used != null) {
      const v = Number(body.used);
      if (Number.isFinite(v) && v >= 0) patch.used = roundUsd(v);
    }
    if (body?.plan) {
      const v = String(body.plan).trim().toLowerCase();
      if (['free', 'premium', 'admin'].includes(v)) patch.plan = v;
    }
    if (body?.resetPeriod === true) {
      const p = computePeriod(nowMs());
      patch.periodStart = p.periodStart;
      patch.periodEnd = p.periodEnd;
      patch.used = 0;
    }
    patch.updatedAt = nowMs();
    await writeQuotaToKv(patch, env);
    return jsonResponse({ ok: true, quota: quotaPublicView(patch) }, 200);
  } catch (error) {
    return jsonResponse({
      error: String(error?.message || error || 'Admin action failed.'),
      code: 'ADMIN_QUOTA_FAILED'
    }, 400);
  }
}

/* =============================================================================
 * Live Voice persona: returns the Arabic-first system prompt + voice hints the
 * client should use for Live Voice Conversation Mode. Kept server-side so the
 * admin can rotate tone without shipping a new app build.
 * =============================================================================
 */
async function handleVoiceLivePersona(request, env) {
  try {
    const session = await requireSession(request, env);
    const config = getVoiceApiConfig(env);
    const persona = {
      ok: true,
      language: 'ar',
      region: config.preferredLanguage || 'ar-SA',
      voice: config.synthesisVoice || 'ar',
      ttsModel: config.synthesisModel,
      sttModel: config.recognitionModel,
      provider: config.provider,
      style: {
        warmth: 'high',
        formality: 'balanced',
        pace: 'natural',
        brevity: 'conversational'
      },
      dialectHint: 'عربية فصحى خفيفة مفهومة لكل اللهجات',
      systemPrompt: [
        'أنت مساعد ذكاء اصطناعي يتحدث العربية بلكنة فصحى واضحة.',
        'نبرتك دافئة وهادئة ومتعاطفة دون مبالغة أو تصنّع.',
        'ترد بجُمل قصيرة طبيعية مناسبة للحوار الصوتي، وليس بفقرات مطولة.',
        'تستمع جيدًا ثم ترد بما يفيد السائل مباشرة، وتسأل للتوضيح عند الحاجة.',
        'تتجنب القوالب الرسمية، وتتكلم كصديق خبير يحترم وقت المستخدم.',
        'إذا طلب المستخدم شرحًا مطولًا، جزّئه إلى نقاط قصيرة يسهل سماعها.'
      ].join(' '),
      barge: {
        enabled: true,
        micRmsThreshold: 0.04,
        silenceHoldMs: 800
      },
      vad: {
        enabled: true,
        rmsThreshold: 0.011,
        minLoudMs: 320,
        silenceHoldMs: 1500,
        maxUtteranceMs: 16800
      },
      streamingTts: {
        enabled: true,
        sentenceBufferMs: 180,
        preferShortSentences: true
      },
      session: {
        email: session.email,
        plan: session.plan,
        role: session.role
      }
    };
    return jsonResponse(persona, 200);
  } catch (error) {
    return jsonResponse({
      error: String(error?.message || error || 'Authentication required.'),
      code: 'AUTH_SESSION_REQUIRED'
    }, 401);
  }
}
