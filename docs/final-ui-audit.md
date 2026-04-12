# Final UI audit — noise, space, hierarchy

## Visually noisy (addressed or reduced)

| Area | Issue | Direction |
|------|--------|-----------|
| Workspace deck on chat | Large hero, 4 use-case cards, 6 nav shortcut cards, long status strip | Hide use-cases + nav shortcuts when deck collapsed on chat; tighten title/padding |
| Chat onboarding | Three-step strip always visible on empty thread | Hidden when thread has messages (`chat-has-messages`) |
| Subtopbar label | «إجراءات الدردشة» consumed horizontal space | Visually hidden; `aria-label` on toolbar |
| Composer hint | Long line always visible | Shown only when composer row is `:focus-within` on chat |
| `composerContextMeta` | Long bullet list (files, messages, attachments, chars…) | Shorter pattern on active chat page |
| Top runtime badge | Strong visual weight | Slightly smaller on chat |
| Bubble action hints | Long download helper text | Ellipsis + smaller font on chat |
| Thread drawer subtitle | Long sentence | Short phrase |

## Wasted vertical space

- Workspace **not** collapsed on web chat while thread empty → same band as Android; **collapse whenever chat page is active** (all platforms).
- Strategic strip hidden when chat active or has messages (unchanged logic, now aligned with deck).
- Onboarding kept for brand-new threads only.

## Primary (must stay obvious)

- `#chatLog` transcript, bubbles, composer, send/stop, attach, voice.
- Model/provider controls (main toolbar or mini toolbar when collapsed).
- New thread, scroll, clear (quick bar / mini toolbar).

## Secondary (collapsed, grouped, or de-emphasized)

- Workspace marketing (use cases, wqa subtitles, nav shortcut grid) on chat.
- Keyboard help line until user focuses composer.
- Runtime badge (still present, smaller).

## Hidden / collapsed / removed

- **Hidden (CSS)**: subtopbar label (screen-reader safe), onboarding when messages exist, workspace use-case cards + wnav grid on chat collapsed deck, second line of wqa button subtitles.
- **Removed text**: long default `composerContextMeta` string; long thread drawer sub; long composer template hint (replaced with short default).
- **Collapsed**: workspace deck whenever `#page-chat` is active (JS), not only Android.

## Preserved

- All tools, pages, STT/TTS, attachments, thread drawer, settings, home content unchanged in capability.
