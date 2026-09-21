import { existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";
import type { Action } from "./schema.js";

export interface Config {
  jev: { baseUrl: string; model: string };
  rulesPath: string;
  enforcement: Partial<Record<string, Action>>;
}

const DEFAULT_MODEL = "jev-latest";
const DEFAULT_BASE_URL = "https://api.typesafe.ai";

/**
 * JEVGUARD_BASE_URL/JEVGUARD_API_KEY are the portable path (Codex, manual runs, any
 * shell). CLAUDE_PLUGIN_OPTION_JEV_BASE_URL/CLAUDE_PLUGIN_OPTION_JEV_API_KEY are what Claude Code
 * exports when the plugin's `userConfig` (claude-plugin/.claude-plugin/plugin.json) is filled in
 * through its own settings UI -- values Claude Code stores in the OS keychain, never in a file a
 * user could accidentally commit. Neither is read from .jevguard/config.json, which is meant to
 * be checked in.
 */
function envBaseUrl(): string | undefined {
  return process.env.JEVGUARD_BASE_URL || process.env.CLAUDE_PLUGIN_OPTION_JEV_BASE_URL;
}

export function jevApiKey(): string | undefined {
  return process.env.JEVGUARD_API_KEY || process.env.CLAUDE_PLUGIN_OPTION_JEV_API_KEY;
}

/** Claude Code exports CLAUDE_PROJECT_DIR to hook processes; Codex doesn't export an
 * equivalent, so fall back to the git top-level, then the current directory. */
export function projectRoot(): string {
  if (process.env.CLAUDE_PROJECT_DIR) return process.env.CLAUDE_PROJECT_DIR;
  try {
    return execSync("git rev-parse --show-toplevel", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return process.cwd();
  }
}

export function loadConfig(root = projectRoot()): Config {
  const path = join(root, ".jevguard", "config.json");
  const defaults: Config = {
    jev: { baseUrl: envBaseUrl() ?? DEFAULT_BASE_URL, model: DEFAULT_MODEL },
    rulesPath: ".jevguard/rules.json",
    enforcement: { PreToolUse: "block", Stop: "warn" },
  };
  if (!existsSync(path)) return defaults;
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  return {
    jev: { ...defaults.jev, ...parsed.jev },
    rulesPath: parsed.rulesPath ?? defaults.rulesPath,
    enforcement: { ...defaults.enforcement, ...parsed.enforcement },
  };
}
