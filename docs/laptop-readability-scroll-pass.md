# Laptop Readability Scroll Pass

Date: 2026-03-22

## Root cause

- too many sticky and high-density regions compete above the conversation
- side panel and workspace controls consume attention before the user reaches the thread itself
- the conversation area needs cleaner visual hierarchy on wide screens

## Improvement direction

- reduce chrome density above the first visible messages
- keep reading width constrained
- separate control surfaces from reading surfaces more cleanly
- reduce stacked sticky sections where possible

## Safe next-step changes

- compress nonessential workspace strips after login
- keep the main toolbar pinned but lighter
- avoid duplicate informational blocks above chat
- preserve side navigation, but reduce competing emphasis versus the reading area
