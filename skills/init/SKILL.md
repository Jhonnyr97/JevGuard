---
name: init
description: Generates JevGuard's project rules by reading CLAUDE.md/AGENTS.md, the README, code conventions, and (on Claude Code) the user's auto-memory. Invoke it explicitly with /jevguard:init when the user asks to initialize or regenerate JevGuard's rules.
disable-model-invocation: true
---

Your job is to infer the project's rules and write them to
`.jevguard/rules.json`. If that file already exists, read it first and add
to it rather than overwriting existing rules.

**Always write `instructions` and `criteria` in English**, even if you're
working in a session in another language. You can summarize the rules to the
user in the conversation's language, but the text that ends up in the JSON
must be English.

## 1. Gather context

Read, if they exist, in this order:

1. `CLAUDE.md` and/or `AGENTS.md` at the project root (and in subdirectories
   for a large project).
2. `README.md`.
3. If you're running on Claude Code (check whether `~/.claude/projects/`
   exists), the user's auto-memory relevant to *this* project: read
   `~/.claude/projects/*/memory/MEMORY.md` and open the linked
   `feedback_*.md`/`project_*.md` files that look applicable to this repo
   (language, style, git workflow, tests). If the directory doesn't exist
   (Codex, or Claude Code with no active memory), skip this step without
   error: that's normal, not a problem.
4. Quickly scan the conventions already present in the code with the tools
   you have (Read/Grep/Glob): linter/formatter config, comment style, test
   framework, naming conventions. No need for an exhaustive scan: 5-10
   representative files are enough.

## 2. Turn each convention you find into a rule

Each rule is one entry in the `.jevguard/rules.json` object, keyed by a
short id (e.g. `no-function-comments`). Every rule has `instructions`
(string), `scope` (array of `edit`/`bash`/`response`/`all`), and an optional
`action` (`block`/`warn`/`off`: leave it out unless you already know this
rule should differ from the project default). Then, depending on `type`:

- **`noul`** (yes/no) for binary rules: "no comments in functions", "no
  leftover `console.log` calls", "commit messages are in English". Fields:
  `type: "noul"`, `pass_if: "yes"|"no"`, optional `criteria: {true, false}`
  clarifying what each means.
- **`score`** for things on a scale: commit message quality, how minimal a
  refactor is. Fields: `type: "score"`, `criteria` (an ordered array of 2-10
  level descriptions), `min_score` (the lowest passing position there's
  no ceiling, only a floor, so if the rule is about NOT wanting too much of
  something, put the clean/desired state as the last, highest level).
- **`choice`** for categorical things with a few known options: "which test
  framework is used", "which error-handling style". Fields: `type:
  "choice"`, `criteria` (a map of option -> description or null),
  `pass_options` (array of the acceptable option names).

Example:

```json
{
  "no-function-comments": {
    "type": "noul",
    "instructions": "The code contains a comment inside or directly above a function",
    "scope": ["edit"],
    "pass_if": "no"
  }
}
```

Don't invent vague rules like "write clean code": every `instructions` must
be a question or statement a human reviewer could check by looking at the
content, in a few seconds.

**For `noul`, always phrase `instructions` as a direct, positive statement
about what IS present/true, never as a negation or "avoid X".** Pick
`pass_if` accordingly, not the wording:

- Wrong: `instructions: "The code avoids comments inside functions"`, `pass_if: "yes"`
- Right: `instructions: "The code contains a comment inside or directly above a function"`, `pass_if: "no"`

Same logic for `score`/`choice`: levels/options must describe what IS the
case, not what isn't.

**Check whether Jev can actually judge each convention before turning it
into a rule.** Jev only ever sees the content being written right now
(`state`), never a diff, never the previous version, never what happened
in earlier turns. Good fit: anything visible in a single snapshot, such as
style, presence of a pattern, language, tone, whether something is
mentioned. Bad fit: anything that requires comparing to a previous
version, such as "keep this backward compatible", "don't change the
behavior", "don't regress performance". Skip conventions like that rather
than writing a rule for them; mention them in the closing summary as
something JevGuard can't verify.

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

## 3. Save and validate

Write the merged rules object to `.jevguard/rules.json` (create the
`.jevguard/` directory first if needed). Then run
`node "${CLAUDE_PLUGIN_ROOT}/dist/bin/jevguard-validate.js"` and fix
whatever it reports before moving on: it parses the file with the same
schema the hook uses, so this catches typos and shape mistakes immediately
instead of them silently doing nothing later.

## 4. Close with a summary

List the rules you created (id + a one-line description). If you skipped a
convention because Jev can't judge it from a single snapshot (see above),
name it too, so the user knows it's not covered rather than assuming it is.
Remind the user they live in `.jevguard/rules.json` (or wherever `.jevguard/config.json`
points), are editable by hand at any time, and that default enforcement
(block/warn per event) is configured in `.jevguard/config.json`.
