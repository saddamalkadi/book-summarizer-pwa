# Agent mode: feasibility and foundation (honest) — v8.61

## What “ChatGPT Agent–style” usually implies

- Long-running **autonomous loops**
- **Real** browser or OS automation (clicking, filling forms, navigating) under user control
- **Verified** side effects (e.g. “file saved on disk”, “email sent”) with sandboxed safety

This app is primarily a **static PWA + Capacitor shell** talking to your **gateway/worker** and models. There is **no** built-in privileged automation runtime (no Playwright in the client, no headless browser under user control, no arbitrary server-side job worker owned by the end-user) in this repository.

## Honest capability today

**Can do (real, not simulated):**

- **Rich reasoning and planning** in chat (multi-step breakdowns, checklists).
- **Tool use** that already exists in your stack: RAG/attachments, structured prompts, research/deep modes where the backend supports them, generating **downloadable artifacts** (exports, canvas, downloads page).
- **User-driven** steps: the model can tell the user exactly what to click/type elsewhere; the app does not secretly claim it performed those steps.

**Cannot honestly claim without new systems:**

- “I opened your banking site and transferred funds”
- “I scheduled a meeting in your calendar” without a real calendar integration
- Unattended multi-hour tasks with verified external state

## What we implemented (foundation, not a fake agent)

1. **Prompt template `task_exec_honest`** in `buildQuickPromptTemplate`: forces an explicit split between **in-chat execution** vs **external steps**, and asks for an immediately actionable in-chat first step.
2. **UI strip `#assistantFoundationBar`** at the top of the chat main toolbar: one-tap insertion of structured prompts (`task_exec_honest`, `action_board`, `kb_orchestrator`, `analysis_ar`) via existing `applyQuickPrompt`.

This is **structured task mode**, not autonomous agency.

## Realistic roadmap (if you want closer to “agent” later)

| Layer | Direction |
|-------|-----------|
| Backend | Durable jobs, webhooks, allowed tool endpoints, audit logs |
| Client | Optional “step runner” UI with explicit confirm per sensitive action |
| Browser | Only via **user-visible** flows (e.g. opening `Browser` plugin) — still not silent automation |

## Marketing boundary

Do **not** label the current strip “Autonomous Agent”. Prefer **“تنفيذ داخل المحادثة”** / structured task assistance, matching the honest template text.
