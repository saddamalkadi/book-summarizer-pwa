# Dashboard (home) — selection-first improvements — v8.61

## Problem

The home screen mixed **long explanatory copy** with navigation; less experienced users still had to infer “what to do next” from paragraphs.

## Change

Added a dedicated **«انتقال سريع»** section (`index.html`) with a **grid of tiles** (`home-quick-grid` / `home-quick-tile`):

- Chat, Files, Canvas, Knowledge, Transcription, Settings  
- Each tile uses **`data-open-page`** so the existing delegated click handler in `app.js` opens the correct workspace page — **no new command language**.

## Design constraints

- **RTL-friendly**, compact tiles (auto-fit minmax ~132px).
- **Professional**: neutral surfaces, subtle hover lift; no noisy gradients on tiles.
- **Coexists** with the existing journey cards and dashboard panels (not a replacement for power users).

## Files

- `index.html`: markup + CSS for `.home-quick-grid` and `.home-quick-tile`.

## Future (optional)

- Badge counts on tiles (e.g. unread thread state) using the same meta pattern as `home*Meta` spans.
