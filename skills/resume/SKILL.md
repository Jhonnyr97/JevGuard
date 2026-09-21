---
name: resume
description: Turns JevGuard's verification back on after /jevguard:pause. Invoke it explicitly with /jevguard:resume when the user asks to resume, re-enable, or turn JevGuard back on.
disable-model-invocation: true
---

Delete `.jevguard/paused` if it exists. This takes effect immediately, on
the very next tool call: no restart needed.

Confirm to the user that verification is back on. If `.jevguard/paused`
didn't exist, say JevGuard wasn't paused to begin with.
