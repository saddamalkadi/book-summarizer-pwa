# Mobile scroll stability fix

## Root cause

Multiple nested scrollers (`body`, `.page`, `#page-chat`, `#chatLog`) and a **fixed** composer made scroll chaining and `scrollTop` updates unpredictable on Android. Floating scroll FABs used `getChatScrollContainer()`, which sometimes returned `#page-chat` instead of `#chatLog`.

## Fixes

### Single transcript scroller (≤980px, chat active)

- `#page-chat.page.active { overflow: hidden !important; display: flex; flex-direction: column; }`
- `#page-chat.page.active > .chatlog { flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior-y: contain; touch-action: pan-y; }`

### Flex chain

- Under `max-width: 980px`, `.main` and `.content` gain `flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column` so `#page-chat` can fill remaining height below the topbar.

### JavaScript

- `getChatScrollContainer()`: if `window.innerWidth <= 980` and `#page-chat` has class `active`, return **`#chatLog`**.
- `scrollChatToBottom()`: skip the extra `window.scrollTo` hack when the mobile chat shell is active (≤980px + active chat), and always advance `chatLog.scrollTop`.

### Composer

- Moving the composer out of `position: fixed` removes a major source of **layout jump** when the keyboard opens (works together with existing `keyboardEditing` body class).

## Expected behavior

- Scrolling inside the chat **only** moves the transcript.
- Toolbar and composer do not “fight” the scroll container for sticky positioning on mobile.
