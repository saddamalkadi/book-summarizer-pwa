# Inline media rendering fix

## Assistant messages

- Download cards already used `renderAssistantDownloadPreview()` for **image / video / audio / pdf / text** previews.
- **Markdown images and videos** in assistant HTML now get responsive rules (max width, radius, bounded video height) via `.bubble.assistant .body img` / `video` (excluding elements that already use `.assistant-preview-media`).

## User messages

### Persistence

- On send, `pendingChatAttachments` is copied to `attachmentsForRequest` **before** clearing.
- If non-empty, `uMsg.attachmentPreviews = snapshotAttachmentsForMessage(...)` is stored on the thread message.
- Snapshots strip oversized `dataUrl` payloads (approximate base64 decode size &gt; 4 MiB) to protect `localStorage`.

### Capture

- **Images:** unchanged — already had `dataUrl` + OCR path.
- **Video / audio:** if `file.size <= 4 * 1024 * 1024`, a `dataUrl` is generated for inline preview in the bubble (in addition to any text extraction path for other kinds).

### Rendering

- `renderUserAttachmentPreviewsHtml()` builds:
  - `<img>` / `<video playsinline controls>` / `<audio controls>` when `dataUrl` exists.
  - A compact **file card** (name + kind + size) when inline binary is not stored.

### Styling

- Shared look with assistant previews via new classes: `.chat-user-attachments`, `.chat-inline-media`, `.chat-inline-media-el`, `.chat-inline-file-card`, and `pre.chat-user-text` for the message text.

## Backward compatibility

- Older saved messages without `attachmentPreviews` still render text-only as before.
