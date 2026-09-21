# JevGuard

Plugin for Claude Code and Codex CLI that keeps the agent aligned with the
project's rules, checking them with a typed judgment model instead of
trusting the agent to remember them on its own.

## Install

**Claude Code**

```
/plugin marketplace add Jhonnyr97/JevGuard
/plugin install jevguard@jevguard
```

(You may need to send the two commands as separate prompts for the install
to pick up the freshly added marketplace.)

Then run `/plugin configure jevguard@jevguard` to set the Jev API key and
backend URL; see [Configuring the Jev backend](#configuring-the-jev-backend).

**Codex CLI**

```
codex plugin marketplace add Jhonnyr97/JevGuard
codex plugin add jevguard@jevguard
```

Run `codex`, open `/hooks`, review and trust JevGuard's two lifecycle
hooks, then start a new thread. Use `/skills` to find JevGuard's skills,
or ask Codex in plain language to pause, resume, initialize, or add a rule.
Codex does not register these skills as `/jevguard:...` slash commands.

## The problem

CLAUDE.md/AGENTS.md are prose loaded into context: the agent reads them, but
nothing stops it from forgetting them halfway through a session,
rationalizing around them ("this specific case can be an exception"), or
dropping them under pressure from another goal ("the user asked to be
fast"). There's no real enforcement point: only instructions the agent
itself decides whether to follow. JevGuard adds that enforcement point: a
hook that can actually block a tool call or a response, not just another
line of prompt to remember.

## What it does

- `/jevguard:init` reads CLAUDE.md/AGENTS.md, the README, code conventions,
  and (on Claude Code) the user's auto-memory, and generates the rules.
- `/jevguard:rule <description>` adds one rule on the fly, in plain language
  ("no console.log left in committed code") instead of a full project scan.
- Rules live in `.jevguard/rules.json`, readable and editable by hand.
- Every tool call and every final response goes through a hook (`PreToolUse`,
  `Stop`) that calls the verifier and blocks or warns based on
  `.jevguard/config.json`.
- The LLM can create/update rules itself with the Write/Edit tools it
  already has, then confirm the result with `jevguard-validate`.
- `/jevguard:pause` and `/jevguard:resume` turn verification off/on for the
  current project, mid-session: a flag file, not an env var, since hooks
  are a fresh process per call and pick it up on the very next tool call.
  User-triggered only: the skill won't run on the agent's own initiative,
  so it can't be used to dodge a block it just hit.

## What Jev is

[Jev](https://docs.typesafe.ai) (TypeSafe AI) is a "System One" model:
unlike a regular LLM it doesn't generate text, it answers typed questions
about a given state: boolean (`noul`, the probability the answer is yes),
multiple choice (`choice`, one option out of a defined set), or a score
(`score`, a position on an ordered scale you describe). The answer is always
constrained to the options provided: no prose to interpret, no invented
category the code then has to figure out how to handle.

JevGuard uses this same contract (`POST {state, model, questions} ->
{answers}`) as the interface to the verifier: every JevGuard rule is, at
its core, a Jev question. The project doesn't mandate a specific backend:
it just needs to answer that contract. By default it talks to the real
`https://api.typesafe.ai`; point it elsewhere (a local backend, a different
deployment) by setting the URL, and configure the API key, as described in
[Configuring the Jev backend](#configuring-the-jev-backend) below.

## Why it's a good idea

- **The judge isn't the one who wrote the code.** Asking the same agent that
  just wrote something whether it follows the rules is asking whoever just
  made a decision to re-evaluate it with a cold eye, in the same context
  that led to that decision in the first place: in-loop self-verification
  is structurally less reliable than an external check, independent of the
  turn that produced the content.
- **A typed answer, not text to trust.** A prose judgment ("yes, it follows
  the style") needs interpreting: how confident is that? Downstream code
  has to parse a sentence to extract a boolean decision from it. An answer
  constrained to a known set of options already is the decision, not text to
  infer one from.
- **Cheap by construction.** Multiple questions about the same content go
  into a single batched request (Jev's "speculative fan-out" pattern): the
  cost of checking ten rules together is close to checking just one, so
  there's no pressure to keep the rule set minimal for cost/latency reasons.
- **The blocking point is real.** The hook runs outside the agent's turn:
  even if the agent "decides" to ignore a rule, the tool call doesn't go
  through until the verifier approves it.

The design plan is in `~/.claude/plans/ancient-greeting-riddle.md`
(architecture, formats, rationale for the implementation choices).

## Configuring the Jev backend

The API key and base URL are never read from `.jevguard/config.json`.
That file is meant to be committed and shared across a team, and a secret
in a committed file eventually leaks: someone forks the repo, greps
history, or the file gets pasted somewhere it shouldn't. `.jevguard/rules.json`
is a fine thing to share; a bearer token isn't. So both come from outside
the project entirely, through one of two paths:

- **On Claude Code**, the plugin declares `userConfig` in its manifest:
  run `/config` (or fill it in when the plugin prompts you at enable time)
  and set "Jev API key" / "Jev backend URL". Claude Code stores the key in
  the OS keychain (masked, never in `settings.json` in plaintext) and
  exports both to the hook process as `CLAUDE_PLUGIN_OPTION_JEV_API_KEY` /
  `CLAUDE_PLUGIN_OPTION_JEV_BASE_URL`.
- **Everywhere else** (Codex, manual runs, scripts), set the environment
  variables `JEVGUARD_API_KEY` and `JEVGUARD_BASE_URL` yourself,
  e.g. in your shell profile. JevGuard checks these first, then the
  `CLAUDE_PLUGIN_OPTION_*` ones, so both paths work interchangeably.

If neither is set, the base URL defaults to `https://api.typesafe.ai` and
the request goes out with no `Authorization` header: fine for a local
backend that doesn't require one, a 401 from the real API otherwise (which
JevGuard treats as a failed verifier and fails open, per
[Why it's a good idea](#why-its-a-good-idea): a broken verifier never
blocks the agent, it just stops checking).

A rule's `scope`/`action` and the enforcement defaults in
`.jevguard/config.json` are not secrets and are meant to be committed.

## Structure

- `src/`: shared engine (TypeScript): rule schema/store, Jev client,
  verification logic, hook normalization, the two binaries
  (`jevguard-hook`, `jevguard-validate`).
- `.claude-plugin/`, `.codex-plugin/`, `hooks/`, `skills/`, and `dist/`:
  one self-contained plugin package at the repository root. Both clients
  load `hooks/hooks.json` from that root.
- `build-docs/`: full copy of the official documentation (Claude Code,
  Codex, and Jev tools/hooks) used to design this plugin.

## Development

```bash
npm install
npm run build   # typechecks, then bundles src/ -> dist/ (self-contained, zod inlined)
npm test        # vitest
```

`dist/` is committed on purpose: the plugin needs to work right after a
`git clone`, with no build step, so `npm run build` is for development, not
a prerequisite for installing (see [Install](#install)).

To try local changes before installing them for real:

```bash
claude --plugin-dir .
```
