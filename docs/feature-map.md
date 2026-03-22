# Feature Map

## Purpose
This map preserves all existing platform capabilities and reorganizes them into a clearer product model without deleting power-user functionality.

The current codebase exposes these top-level pages:
- `chat`
- `files`
- `projects`
- `canvas`
- `transcription`
- `workflows`
- `knowledge`
- `downloads`
- `settings`
- `guide`

The current sidebar already groups some of them through:
- `tools`: `canvas`, `transcription`, `workflows`
- `more`: `knowledge`, `downloads`, `settings`, `guide`

The issue is not missing features. The issue is that too many features surface too early in the chat workspace, while the main user journeys are mixed with operational controls.

## Feature Layers

### 1. Core User Layer
These are the features most users should see first.

| Capability | Current Entry Point | Keep | Proposed Primary Surface |
|---|---|---:|---|
| Text chat | `chat` | Yes | Home + Chat |
| Arabic chat | `chat` + model selection | Yes | Chat |
| File upload to chat | chat composer | Yes | Chat |
| Project-based work | `projects` | Yes | Home + Projects |
| Files library | `files` | Yes | Home + Files |
| Downloads | `downloads` | Yes | Home + Downloads |
| Knowledge usage | `knowledge` + chat toggles | Yes | Home card + Knowledge |
| PDF to Word | `transcription` | Yes | Home quick action + Transcription |
| OCR / transcription | `transcription` | Yes | Transcription |
| Voice chat | chat composer + voice controls | Yes | Chat |
| Account session | login/account UI | Yes | Header account menu |

### 2. Advanced Tools Layer
These remain available, but should move behind clearer sections and progressive disclosure.

| Capability | Current Entry Point | Keep | Proposed Surface |
|---|---|---:|---|
| Canvas / editable output workspace | `canvas` | Yes | Tools hub + Chat "Send to canvas" |
| Workflows | `workflows` | Yes | Tools hub |
| Prompt templates | chat toolbar | Yes | Chat advanced drawer |
| Agent task templates | chat toolbar | Yes | Chat advanced drawer |
| Streaming toggle | chat toolbar | Yes | Chat advanced drawer |
| RAG toggle | chat toolbar | Yes | Chat advanced drawer |
| Tools toggle | chat toolbar | Yes | Chat advanced drawer |
| Web/search/deep modes | chat toolbar / mode buttons | Yes | Chat advanced drawer |
| Model hub / model categories | chat settings/modal | Yes | Model picker |
| Cost controls / free mode | settings | Yes | Settings > Runtime policy |
| Voice mode policy | settings / chat | Yes | Settings > Voice + Chat voice bar |
| Cloud storage state | hidden runtime feature | Yes | Settings > Sync |
| Chat history drawer | chat shell | Yes | Chat |

### 3. Admin / Developer Layer
These should not dominate the main user UI, but must remain accessible.

| Capability | Current Entry Point | Keep | Proposed Surface |
|---|---|---:|---|
| Admin login | unified auth gate | Yes | Auth gate (conditional) |
| Upgrade code generation | settings/account | Yes | Settings > Admin |
| Account/plan overrides | settings/account | Yes | Settings > Admin |
| Gateway URL | settings / runtime | Yes | Settings > Advanced runtime |
| Provider selection | chat toolbar + settings | Yes | Chat advanced drawer + runtime settings |
| Base URL / model raw controls | chat toolbar | Yes | Advanced runtime drawer |
| Worker health / diagnostics | runtime status | Yes | Settings > Diagnostics |
| Conversion service diagnostics | transcription + health | Yes | Transcription diagnostics |
| Secret-dependent cloud features | worker/runtime | Yes | Diagnostics with readiness badges |

## Feature Inventory by User Journey

### A. Ask / Create / Continue a task
- Chat composer
- File attachments
- Voice input
- Voice output
- Model selection
- Mode selection
- Prompt / agent templates
- History drawer

### B. Work on documents and outputs
- Files
- Canvas
- Downloads
- PDF to Word
- OCR / extraction

### C. Organize long-running work
- Projects
- Knowledge
- Workflows
- Cloud state / session persistence

### D. Operate the platform
- Login / session
- Plan / upgrade
- Cost policy
- Provider / gateway
- Admin tools
- Diagnostics

## Source of Truth Recommendation

The platform should keep one shared feature map for web and APK:

```text
layer.core
layer.tools
layer.admin
```

Every page, card, sidebar item, quick action, and deep settings panel should resolve from that same map.

This avoids:
- web vs APK navigation drift
- hidden feature loss
- duplicated menu logic
- chat toolbar overload

## What Must Stay Visible on the Main Home Screen
Only the highest-value journeys should be visible immediately:
- Continue chat
- Open project
- Files
- Knowledge
- PDF / Word / OCR
- Downloads

Everything else remains available, but moves into the correct layer.
