---
name: rule
description: Turns a plain-language rule description into one or more entries in .jevguard/rules.json. Invoke it explicitly with /jevguard:rule <description> when the user dictates a specific rule to add, rather than asking for a full /jevguard:init scan.
disable-model-invocation: true
argument-hint: <plain-language description of the rule to add>
---

The user described a rule in plain language: $ARGUMENTS

Turn it into one or more entries in `.jevguard/rules.json`, following the
same conventions as `/jevguard:init`:

- Always write `instructions` and `criteria` in English, regardless of the
  conversation's language.
- Pick `type` (`noul` for yes/no, `score` for a scale, `choice` for a fixed
  set of categories) based on what the description actually asks for.
- For `noul`, phrase `instructions` as a direct, positive statement about
  what IS present/true, never a negation ("avoid X"); pick `pass_if`
  accordingly instead of flipping the wording.
- For `score`, the schema only supports `min_score` as a floor (score must be
  `>=` it): there's no ceiling. If the rule is about NOT wanting too much
  of something, order `criteria` with the clean/desired state as the LAST
  (highest) level, and set `min_score` near that top value. Every level's
  description must itself be a direct positive statement of what that
  level looks like, same rule as `noul`.

**Before writing the rule, check whether Jev can actually judge it.** Jev
only ever sees the content being written right now (`state`), never a
diff, never the previous version, never what happened in earlier turns.
That means:

- Good fit: anything visible in a single snapshot of the content, such as
  style, presence of a pattern, language, tone, whether something is mentioned.
- Bad fit: anything that requires comparing to a previous version, such as
  "keep this backward compatible", "don't change the behavior", "don't
  regress performance". These need an old-vs-new diff Jev doesn't reliably
  get from a single noul/score question on the new content alone. Don't
  create a rule like this; tell the user why and suggest scoping it down to
  something checkable in the current content (e.g. "the function signature
  named in `instructions` still appears unchanged" is closer to checkable
  than "behavior is preserved").
- Pick `scope` (`edit`/`bash`/`response`/`all`) from what the description
  implies the rule should check. If it's ambiguous, default to the
  narrowest scope that matches the literal description rather than `all`.
- Leave `action` unset unless the description says this rule should behave
  differently from the project default (e.g. "always block this, no
  exceptions" -> `action: "block"`).

If the description is genuinely ambiguous about what should trigger the
rule (not just missing a field you can default), ask one short clarifying
question before writing anything. Don't stall on things you can reasonably
default.

**Calibrate `min_score` with real numbers, don't guess it.** Temporarily set
`min_score` to an unreachable value like `99`, then trigger the rule with
three test writes: a clear violation, clearly clean content, and a short or
minimal edge case (Jev tends to answer less confidently on very short
input, so test that separately from a realistic full-length one). Every
write will report a `score X, required >= 99` failure with the real
number. Read the three scores and set the real `min_score` between the
clean case and the violating ones, with margin. Then remove the `99`.
Gotcha: while `min_score` is still at the unreachable calibration value,
editing `.jevguard/rules.json` to fix it also gets blocked, because the
rule fails by construction on any content, including the fix itself. Ask
the user to run `/jevguard:pause` first; never invoke it yourself.

**If a `noul` rule turns out unstable** (the same or similar content passes
one time and fails another, or only weakly crosses 0.5), don't keep
tweaking the wording: switch it to `score`. `noul` is reliable for clear
semantic things (an emoji is present, the text is in English, a function
has a comment) but weaker for subtle, low-signal patterns, such as a
specific punctuation mark (a double hyphen used as a dash, for example).
A `score` with 2-3 explicitly described
levels gives the model concrete anchors instead of one loose yes/no
boundary, which tends to produce a cleaner separation between passing and
failing content.

Read the existing `.jevguard/rules.json` first (if it exists) and add to
it: don't overwrite other rules. Pick an id that doesn't collide with an
existing one; if the description is clearly meant to replace an existing
rule, say so and confirm before overwriting it.

Write the file, then run
`node "${CLAUDE_PLUGIN_ROOT}/dist/bin/jevguard-validate.js"` and fix
whatever it reports.

Close with the id(s) you added or changed and a one-line description of
what each now checks.
