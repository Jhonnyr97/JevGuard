import { describe, expect, it } from "vitest";
import { buildVerifyRequest, formatHookOutput } from "./hook.js";

describe("buildVerifyRequest", () => {
  it("maps Bash tool calls to bash scope with the command as state", () => {
    const req = buildVerifyRequest({
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: { command: "rm -rf /" },
    });
    expect(req).toEqual({ hookEventName: "PreToolUse", scope: "bash", state: "rm -rf /" });
  });

  it("maps Edit/Write tool calls to edit scope with the raw tool_input as state", () => {
    const req = buildVerifyRequest({
      hook_event_name: "PreToolUse",
      tool_name: "Write",
      tool_input: { file_path: "/a.rb", content: "def x; end" },
    });
    expect(req).toEqual({
      hookEventName: "PreToolUse",
      scope: "edit",
      state: { file_path: "/a.rb", content: "def x; end" },
    });
  });

  it("maps Stop to response scope with last_assistant_message as state", () => {
    const req = buildVerifyRequest({ hook_event_name: "Stop", last_assistant_message: "ecco fatto" });
    expect(req).toEqual({ hookEventName: "Stop", scope: "response", state: "ecco fatto" });
  });

  it("returns null for events JevGuard doesn't verify", () => {
    expect(buildVerifyRequest({ hook_event_name: "SessionStart" })).toBeNull();
  });

  it("falls back to other scope for unlisted tools", () => {
    const req = buildVerifyRequest({ hook_event_name: "PreToolUse", tool_name: "WebFetch", tool_input: {} });
    expect(req?.scope).toBe("other");
  });
});

describe("formatHookOutput", () => {
  it("denies PreToolUse on a blocking failure", () => {
    const out = formatHookOutput("PreToolUse", {
      ok: false,
      failures: [{ id: "no_comment", reason: "yes expected no", action: "block" }],
      warnings: [],
    }) as any;
    expect(out.hookSpecificOutput.permissionDecision).toBe("deny");
    expect(out.hookSpecificOutput.hookEventName).toBe("PreToolUse");
  });

  it("blocks Stop with decision:block on a blocking failure", () => {
    const out = formatHookOutput("Stop", {
      ok: false,
      failures: [{ id: "no_comment", reason: "yes expected no", action: "block" }],
      warnings: [],
    }) as any;
    expect(out.decision).toBe("block");
    expect(typeof out.reason).toBe("string");
  });

  it("adds additionalContext without blocking on warnings only", () => {
    const out = formatHookOutput("PreToolUse", {
      ok: true,
      failures: [],
      warnings: [{ id: "style", reason: "meh", action: "warn" }],
    }) as any;
    expect(out.hookSpecificOutput.additionalContext).toBeDefined();
    expect(out.hookSpecificOutput.permissionDecision).toBeUndefined();
  });

  it("returns an empty object when everything passes", () => {
    expect(formatHookOutput("PreToolUse", { ok: true, failures: [], warnings: [] })).toEqual({});
  });
});
