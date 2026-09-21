import { z } from "zod";

/** A Jev question's `instructions`/`criteria` value: string, or structured data + a question field. */
const JevValue: z.ZodType<unknown> = z.union([z.string(), z.record(z.unknown()), z.array(z.unknown())]);

export const Scope = z.enum(["edit", "bash", "response", "all"]);
export type Scope = z.infer<typeof Scope>;

export const Action = z.enum(["block", "warn", "off"]);
export type Action = z.infer<typeof Action>;

const RuleBase = z.object({
  instructions: JevValue,
  scope: z.array(Scope).default(["all"]),
  action: Action.optional(),
});

export const NoulRule = RuleBase.extend({
  type: z.literal("noul"),
  criteria: z.object({ true: JevValue.optional(), false: JevValue.optional() }).optional(),
  pass_if: z.enum(["yes", "no"]).default("yes"),
});

export const ChoiceRule = RuleBase.extend({
  type: z.literal("choice"),
  criteria: z.record(JevValue.nullable()),
  pass_options: z.array(z.string()).min(1),
});

export const ScoreRule = RuleBase.extend({
  type: z.literal("score"),
  criteria: z.array(JevValue).min(2).max(10),
  min_score: z.number(),
});

export const Rule = z.discriminatedUnion("type", [NoulRule, ChoiceRule, ScoreRule]);
export type Rule = z.infer<typeof Rule>;
export type NoulRule = z.infer<typeof NoulRule>;
export type ChoiceRule = z.infer<typeof ChoiceRule>;
export type ScoreRule = z.infer<typeof ScoreRule>;

export const RulesFile = z.record(z.string(), Rule);
export type RulesFile = z.infer<typeof RulesFile>;

/** Rule input as the LLM or a hand-edited file provides it: `type` defaults to "noul" when omitted. */
export function parseRule(id: string, input: unknown): Rule {
  const raw = input as Record<string, unknown>;
  const withType = { type: "noul", ...raw };
  const result = Rule.safeParse(withType);
  if (!result.success) {
    throw new Error(`rule "${id}" invalid: ${result.error.message}`);
  }
  return result.data;
}

export function parseRulesFile(input: unknown): RulesFile {
  const raw = (input ?? {}) as Record<string, unknown>;
  const rules: RulesFile = {};
  for (const [id, def] of Object.entries(raw)) {
    rules[id] = parseRule(id, def);
  }
  return rules;
}
