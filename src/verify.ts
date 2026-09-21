import type { Config } from "./rules/config.js";
import type { Action, Rule, RulesFile } from "./rules/schema.js";
import { askJev, type JevAnswer, type JevQuestion } from "./jev/client.js";

export type EventScope = "edit" | "bash" | "response" | "other";

export interface VerifyRequest {
  /** Hook event name, used to resolve the default enforcement action (e.g. "PreToolUse", "Stop"). */
  hookEventName: string;
  scope: EventScope;
  state: unknown;
}

export interface RuleFailure {
  id: string;
  reason: string;
  action: Action;
}

export interface VerifyResult {
  ok: boolean;
  failures: RuleFailure[];
  warnings: RuleFailure[];
}

function applicableRules(rules: RulesFile, scope: EventScope): [string, Rule][] {
  return Object.entries(rules).filter(([, rule]) => {
    if (rule.action === "off") return false;
    return rule.scope.includes("all") || (scope !== "other" && rule.scope.includes(scope));
  });
}

function toQuestion(rule: Rule): JevQuestion {
  const criteria = "criteria" in rule ? rule.criteria : undefined;
  return { type: rule.type, instructions: rule.instructions, ...(criteria !== undefined ? { criteria } : {}) };
}

function describe(instructions: unknown): string {
  return typeof instructions === "string" ? instructions : JSON.stringify(instructions);
}

function evaluateRule(rule: Rule, answer: JevAnswer): { passed: boolean; reason: string } {
  const label = describe(rule.instructions);
  if (rule.type === "noul" && answer.type === "noul") {
    const actual = answer.noul >= 0.5 ? "yes" : "no";
    return {
      passed: actual === rule.pass_if,
      reason: `"${label}" -> ${actual} (${answer.noul.toFixed(2)}), expected "${rule.pass_if}"`,
    };
  }
  if (rule.type === "choice" && answer.type === "choice") {
    return {
      passed: rule.pass_options.includes(answer.choice),
      reason: `"${label}" -> "${answer.choice}", expected one of [${rule.pass_options.join(", ")}]`,
    };
  }
  if (rule.type === "score" && answer.type === "score") {
    return {
      passed: answer.score >= rule.min_score,
      reason: `"${label}" -> score ${answer.score.toFixed(2)}, required >= ${rule.min_score}`,
    };
  }
  // Answer type doesn't match the rule (backend bug): fail open rather than block on a mismatch.
  return { passed: true, reason: "backend answer type doesn't match the rule type, skipped" };
}

/**
 * Batches every applicable rule into a single Jev request (the "speculative fan-out" pattern:
 * one call is far cheaper than one per rule) and evaluates each answer against its rule.
 */
export async function verify(req: VerifyRequest, rules: RulesFile, config: Config): Promise<VerifyResult> {
  const applicable = applicableRules(rules, req.scope);
  if (applicable.length === 0) return { ok: true, failures: [], warnings: [] };

  const questions: Record<string, JevQuestion> = {};
  for (const [id, rule] of applicable) questions[id] = toQuestion(rule);

  const response = await askJev(config.jev.baseUrl, config.jev.model, req.state, questions);

  const failures: RuleFailure[] = [];
  const warnings: RuleFailure[] = [];
  for (const [id, rule] of applicable) {
    const answer = response.answers[id];
    if (!answer) continue;
    const { passed, reason } = evaluateRule(rule, answer);
    if (passed) continue;
    const action = rule.action ?? config.enforcement[req.hookEventName] ?? "warn";
    if (action === "off") continue;
    const failure: RuleFailure = { id, reason, action };
    (action === "block" ? failures : warnings).push(failure);
  }
  return { ok: failures.length === 0, failures, warnings };
}
