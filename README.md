# Secure Gateway (Cloudflare Worker)

هذا الـWorker يخفي مفتاح OpenRouter عن المتصفح.

## 1) نشر Worker
- Cloudflare Dashboard → Workers & Pages → Create Worker
- انسخ محتوى `gateway_worker.js` والصقه ثم Deploy

## 2) إضافة Secrets (مهم)
Workers → Settings → Variables → **Secrets**
- `OPENROUTER_API_KEY` = مفتاح OpenRouter الحقيقي

اختياري (حماية إضافية):
- `CLIENT_TOKENS` = token1,token2  (قائمة مفصولة بفواصل)
- `ALLOW_ORIGINS` = https://YOURNAME.github.io  (أو * للسماح للجميع)

## 3) إعداد التطبيق
في AI Workspace Studio:
Settings → Auth Mode = **Gateway**
- Gateway URL = https://YOUR_WORKER.workers.dev
- Gateway Client Token = (إن استخدمت CLIENT_TOKENS)

> في وضع Gateway لا تضع API Key داخل المتصفح.
