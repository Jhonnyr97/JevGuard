import type { EventScope, RuleFailure, VerifyRequest, VerifyResult } from "./verify.js";

/** Input fields JevGuard reads; both Claude Code and Codex hooks send these same names. */
export interface HookInput {
  hook_event_name: string;
  tool_name?: string;
  tool_input?: unknown;
  last_assistant_message?: string;
  [key: string]: unknown;
}

const EDIT_TOOLS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit", "apply_patch"]);
const BASH_TOOLS = new Set(["Bash", "PowerShell"]);

function toolScope(toolName: string | undefined): EventScope {
  if (toolName && BASH_TOOLS.has(toolName)) return "bash";
  if (toolName && EDIT_TOOLS.has(toolName)) return "edit";
  return "other";
}

function toolState(toolName: string | undefined, toolInput: unknown): unknown {
  if (toolName && BASH_TOOLS.has(toolName)) {
    return (toolInput as { command?: string } | undefined)?.command ?? toolInput;
  }
  return toolInput;
}

/** Normalizes a Claude Code / Codex hook event into a verify request, or null for events JevGuard doesn't check. */
export function buildVerifyRequest(input: HookInput): VerifyRequest | null {
  const event = input.hook_event_name;
  if (event === "PreToolUse" || event === "PostToolUse") {
    return {
      hookEventName: event,
      scope: toolScope(input.tool_name),
      state: toolState(input.tool_name, input.tool_input),
    };
  }
  if (event === "Stop") {
    return { hookEventName: event, scope: "response", state: input.last_assistant_message ?? "" };
  }
  return null;
}

function joinReasons(items: RuleFailure[]): string {
  return items.map((f) => `- ${f.id}: ${f.reason}`).join("\n");
}

/**
 * Formats a verify result as the hook's stdout JSON. Claude Code and Codex accept the same
 * shapes: `hookSpecificOutput.permissionDecision: "deny"` to block a tool call, and
 * `decision: "block"` to block the final response (Stop).
 */
export function formatHookOutput(event: string, result: VerifyResult): unknown {
  if (result.failures.length > 0) {
    const reason = `JevGuard rules violated:\n${joinReasons(result.failures)}`;
    if (event === "Stop") return { decision: "block", reason };
    return {
      hookSpecificOutput: { hookEventName: event, permissionDecision: "deny", permissionDecisionReason: reason },
    };
  }
  if (result.warnings.length > 0) {
    const reason = `JevGuard rule warnings:\n${joinReasons(result.warnings)}`;
    return { hookSpecificOutput: { hookEventName: event, additionalContext: reason } };
  }
  return {};
}
