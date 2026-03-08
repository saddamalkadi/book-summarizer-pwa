# AI Workspace Studio v7 (Secure Agent)

هذه الحزمة تضيف "وكيل متصفح" يعمل من الهاتف عبر:
- Cloudflare Worker Gateway (يحمي مفاتيح OpenRouter + يدير الملفات على R2)
- Agent Runner على Fly.io (Playwright) لتنفيذ التصفح الحقيقي

المجلدات:
- app/ (الجذر: index.html, app.js, sw.js, manifest)
- worker/ (Cloudflare Worker + Wrangler config)
- agent-runner/ (Fly.io Playwright service + GitHub Action للنشر)

ابدأ من: worker/README.md ثم agent-runner/README.md
