# Chat Sticky And Scroll Controls Final

Date: 2026-03-22

## Root cause

- mobile scroll ownership was split between `#page-chat` and `#chatLog`
- sticky composer styles were competing with container overflow rules
- scroll FAB logic only trusted one scroller

## Local fix direction

Frontend files:

- `index.html`
- `app.js`

Implemented locally:

- allow `#page-chat` to scroll on mobile
- make `.chatbar` sticky at the bottom of the active chat page
- add safe bottom spacing to `.chatlog`
- choose active scroll container at runtime via `getChatScrollContainer()`
- make `syncChatScrollDock()` and `scrollChat()` target the resolved scroller plus safe fallbacks
- trigger shell layout refresh after composer resize changes

## Remaining proof needed

- mobile browser
- laptop browser
- Android app

Need confirmation that:

- input bar stays visible while scrolling
- bottom FAB reaches latest message
- top FAB reaches earliest message in long threads
