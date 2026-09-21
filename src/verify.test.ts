import { describe, expect, it, vi } from "vitest";
import type { Config } from "./rules/config.js";
import type { RulesFile } from "./rules/schema.js";

const askJev = vi.fn();
vi.mock("./jev/client.js", () => ({ askJev: (...args: unknown[]) => askJev(...args) }));

const { verify } = await import("./verify.js");

const config: Config = {
  jev: { baseUrl: "http://localhost:8787", model: "jev-latest" },
  rulesPath: ".jevguard/rules.json",
  enforcement: { PreToolUse: "block", Stop: "warn" },
};

describe("verify", () => {
  it("skips the Jev call entirely when no rule matches the scope", async () => {
    askJev.mockClear();
    const rules: RulesFile = {
      only_bash: { type: "noul", instructions: "x", scope: ["bash"], pass_if: "yes" },
    };
    const result = await verify({ hookEventName: "PreToolUse", scope: "edit", state: "diff" }, rules, config);
    expect(askJev).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, failures: [], warnings: [] });
  });

  it("batches every applicable rule into a single Jev call", async () => {
    askJev.mockClear();
    askJev.mockResolvedValue({
      model: "test-model",
      answers: {
        no_comment: { type: "noul", noul: 0.9 },
        team: { type: "choice", choice: "billing", probabilities: {}, confidence: 0.8 },
      },
    });
    const rules: RulesFile = {
      no_comment: { type: "noul", instructions: "no comments", scope: ["all"], pass_if: "no" },
      team: {
        type: "choice",
        instructions: "which team",
        scope: ["all"],
        criteria: { billing: null, technical: null },
        pass_options: ["billing", "technical"],
      },
    };
    const result = await verify({ hookEventName: "PreToolUse", scope: "edit", state: "diff" }, rules, config);
    expect(askJev).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(false); // no_comment fails: pass_if "no" but noul=0.9 -> "yes"
    expect(result.failures.map((f) => f.id)).toEqual(["no_comment"]);
  });

  it("uses config.enforcement as the default action when the rule doesn't set one", async () => {
    askJev.mockClear();
    askJev.mockResolvedValue({ model: "test-model", answers: { r: { type: "noul", noul: 0.1 } } });
    const rules: RulesFile = { r: { type: "noul", instructions: "x", scope: ["all"], pass_if: "yes" } };

    const blocked = await verify({ hookEventName: "PreToolUse", scope: "edit", state: "x" }, rules, config);
    expect(blocked.failures).toHaveLength(1); // PreToolUse default is "block"

    const warned = await verify({ hookEventName: "Stop", scope: "response", state: "x" }, rules, config);
    expect(warned.failures).toHaveLength(0);
    expect(warned.warnings).toHaveLength(1); // Stop default is "warn"
  });

  it("a score rule passes when the answer meets min_score", async () => {
    askJev.mockClear();
    askJev.mockResolvedValue({
      model: "test-model",
      answers: { quality: { type: "score", score: 1.5, legend: {}, probabilities: {}, confidence: 0.7 } },
    });
    const rules: RulesFile = {
      quality: { type: "score", instructions: "x", scope: ["all"], criteria: ["low", "mid", "high"], min_score: 1 },
    };
    const result = await verify({ hookEventName: "PreToolUse", scope: "edit", state: "x" }, rules, config);
    expect(result.ok).toBe(true);
  });
});
