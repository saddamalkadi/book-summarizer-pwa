# Progressive Disclosure Plan

## Objective
Reduce UI clutter without reducing product power.

## Disclosure Levels

### Level 1: Immediate / Essential
Shown to all users by default.

Includes:
- home landing
- latest chat
- composer
- file attach
- voice action
- recent projects
- files
- knowledge
- transcription / PDF to Word
- downloads
- account state

### Level 2: Contextual
Shown when the user is already inside the relevant workspace.

Examples:
- chat history in chat
- project brief in projects
- OCR details in transcription
- file actions in files
- knowledge source controls in knowledge

### Level 3: Advanced Controls
Only shown when the user explicitly asks for more control.

Examples:
- provider selector
- gateway URL
- base URL
- raw model field
- streaming toggle
- tools toggle
- RAG toggle
- web / deep controls
- prompt templates
- agent templates
- runtime policy
- diagnostics

### Level 4: Admin / Developer
Visible only when:
- admin role
- or explicit advanced settings access

Examples:
- upgrade code generation
- admin password management
- gateway diagnostics
- worker readiness
- conversion service diagnostics

## Progressive Disclosure by Area

### Chat
Default:
- conversation
- composer
- attach
- voice
- current model chip

Expandable:
- chat quick actions strip
- advanced chat drawer
- model hub

Deep:
- runtime/provider controls

### Home
Default:
- 5 to 6 primary journeys only

Expandable:
- recent activity
- health summary
- continue where you left off

Deep:
- no raw technical settings on home

### Settings
Default:
- account
- plan
- voice
- sync

Expandable:
- runtime
- diagnostics

Conditional:
- admin

## Disclosure Rules

### Rule 1
If a control changes model/runtime behavior globally, it should not live in the first visible chat surface.

### Rule 2
If a tool is infrequently used but powerful, keep it one tap away, not always open.

### Rule 3
If a feature belongs to a workspace, it should open from that workspace, not leak into unrelated surfaces.

### Rule 4
The main UI should expose journeys, not implementation details.

## Mobile-Specific Disclosure
- collapse advanced chat controls behind one explicit button
- keep composer always reachable
- keep floating navigation minimal and contextual
- avoid multiple horizontal control rows visible at once

## Desktop-Specific Disclosure
- allow richer home dashboard
- keep side navigation compact
- allow pinned advanced panels when screen width supports them
- maintain reading width for long responses

