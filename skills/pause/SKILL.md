---
name: pause
description: Temporarily turns off JevGuard's verification for this project, until /jevguard:resume is called. Invoke it explicitly with /jevguard:pause when the user asks to pause, disable, or turn off JevGuard.
disable-model-invocation: true
---

Only run this when the user explicitly asked to pause JevGuard in this
turn. Never run it on your own initiative, including to get around a rule
that just blocked a tool call: if you were just blocked and want to write
the content anyway, ask the user first.

Write the current UTC time (ISO 8601) to `.jevguard/paused`, creating
`.jevguard/` first if it doesn't exist. This takes effect immediately, on
the very next tool call: no restart needed.

Confirm to the user that verification is paused for this project and that
`/jevguard:resume` turns it back on.
