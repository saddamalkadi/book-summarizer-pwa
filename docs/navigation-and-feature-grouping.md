# Navigation and Feature Grouping

## Navigation Goal
Keep the product powerful, but make the top-level navigation feel calm and scalable.

## Proposed Top-Level Navigation

### Sidebar
Only major sections should remain top-level:
- Home
- Chat
- Projects
- Files
- Knowledge
- Transcription
- Tools
- Downloads
- Settings

## Grouping Model

### Home
Contains:
- continue last chat
- recent projects
- recent files
- knowledge entry
- transcription / PDF to Word quick action
- downloads

### Chat
Contains:
- conversation
- composer
- chat history
- model chip
- mode chip
- voice controls
- attachment flow

Subsections inside Chat:
- `Chat Essentials`
- `Chat Advanced`
- `Chat Runtime`

### Projects
Contains:
- project list
- active project summary
- project brief
- linked chat/file/knowledge pointers

### Files
Contains:
- uploaded files
- selection
- preview
- send to chat
- send to canvas

### Knowledge
Contains:
- KB sources
- ingestion
- retrieval state
- persistent knowledge management

### Transcription
Contains:
- OCR
- extraction
- PDF to DOCX
- route/quality/cost controls
- conversion diagnostics

### Tools
Contains:
- Canvas
- Workflows
- any future advanced builders or labs

This is where powerful but non-primary tools stay visible without polluting Home or Chat.

### Downloads
Contains:
- generated files
- exported outputs
- app downloads

### Settings
Contains:
- Account
- Plan & Cost
- Voice
- Sync
- Runtime
- Diagnostics
- Admin

## Chat Toolbar Grouping

### Default visible
- current model
- current mode
- attach
- voice
- send

### Expandable advanced drawer
- provider
- gateway / base URL
- raw model
- streaming
- tools
- RAG
- web
- deep
- prompt templates
- agent templates

This keeps power but removes the "control wall" effect from first view.

## Admin / Developer Grouping

Admin functions must stay available, but only in:
- Settings > Admin
- Diagnostics
- Runtime

They should not dominate:
- Home
- login hero
- default chat view

## Web / APK Alignment

The same navigation schema should drive both web and APK:

```text
sections = [
  home,
  chat,
  projects,
  files,
  knowledge,
  transcription,
  tools,
  downloads,
  settings
]
```

The same schema should decide:
- sidebar items
- home cards
- tab/page ids
- advanced panel membership
- admin-only conditional areas

## Implementation Recommendation

A single config object in `app.js` should eventually become the source of truth for:
- page registry
- section label
- layer
- sidebar visibility
- home visibility
- role visibility
- mobile priority

This is the cleanest path to:
- preserving all features
- reducing clutter
- eliminating web/APK drift
- making future expansion manageable
