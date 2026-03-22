# Information Architecture Plan

## Goal
Preserve all current capabilities while turning the product into a cleaner three-layer platform:

1. Core user layer
2. Advanced tools layer
3. Admin / developer layer

## IA Principles
- Keep all features
- Reduce first-screen overload
- Favor task journeys over technical controls
- Move technical settings deeper, not away
- Keep identical structure for web and APK
- Make chat the primary workspace, not the only workspace

## Target Product Structure

### 1. Home / Workspace Landing
This becomes the real post-login landing page.

It should show:
- Continue latest chat
- Recent projects
- Files
- Knowledge
- PDF / Word / OCR actions
- Downloads
- Quick status:
  - plan
  - sync
  - model runtime
  - voice readiness

It should not show:
- raw gateway inputs
- advanced model controls
- prompt engineering controls
- admin operational tools

### 2. Chat Workspace
This remains the primary creation surface.

Visible by default:
- thread
- composer
- attach file
- voice button
- model chip
- mode chip
- history

Hidden behind advanced controls:
- provider
- base URL
- raw model ID
- streaming
- tools
- RAG
- web / deep
- prompt template
- agent template

### 3. Files Workspace
Purpose:
- upload
- browse
- manage reusable assets
- send selected file into chat or canvas

Rule:
- files uploaded here should not appear as chat attachments unless explicitly injected into the current conversation.

### 4. Projects Workspace
Purpose:
- project overview
- project brief
- linked chats
- linked files
- linked knowledge

### 5. Knowledge Workspace
Purpose:
- long-lived knowledge base
- ingestion status
- retrieval readiness
- source management

### 6. Transcription / Conversion Workspace
Purpose:
- OCR
- text extraction
- PDF to DOCX conversion
- route diagnostics
- cost/quality mode

This workspace should remain specialized and separate from everyday chat.

### 7. Tools Hub
Contains:
- Canvas
- Workflows
- any future research lab or automation tools

These remain first-class features, but not first-screen clutter.

### 8. Settings
Split internally into:
- Account
- Plan & cost
- Voice
- Sync
- Runtime
- Diagnostics
- Admin (conditional)

## Sidebar Structure

Only major sections:
- Home
- Chat
- Projects
- Files
- Knowledge
- Transcription
- Tools
- Downloads
- Settings

Everything else should live inside these sections, not as standalone top-level clutter.

## Post-Login Routing

### Current problem
The app often lands on `chat` directly, even when the user actually needs a landing/workspace home.

### Target rule
- After any successful login:
  - default landing = `home`
- If login was initiated from a specific deep action:
  - return to intended target after auth

This keeps the product feeling organized instead of dropping users into a half-configured chat layout.

## Web / APK Consistency Rule

The following must come from one navigation source of truth:
- available pages
- sidebar sections
- home cards
- deep settings sections
- admin conditional sections

No separate feature map for APK.

