import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { loadConfig, projectRoot } from "./config.js";
import { parseRule, parseRulesFile, type RulesFile } from "./schema.js";

export function rulesFilePath(root = projectRoot()): string {
  const { rulesPath } = loadConfig(root);
  return isAbsolute(rulesPath) ? rulesPath : join(root, rulesPath);
}

export function loadRules(root = projectRoot()): RulesFile {
  const path = rulesFilePath(root);
  if (!existsSync(path)) return {};
  return parseRulesFile(JSON.parse(readFileSync(path, "utf8")));
}

export function saveRules(rules: RulesFile, root = projectRoot()): void {
  const path = rulesFilePath(root);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(rules, null, 2) + "\n", "utf8");
}

/** Create-or-update: each id in `patch` overwrites (or adds) that rule; other rules are untouched. */
export function upsertRules(patch: Record<string, unknown>, root = projectRoot()): RulesFile {
  const current = loadRules(root);
  for (const [id, def] of Object.entries(patch)) {
    current[id] = parseRule(id, def);
  }
  saveRules(current, root);
  return current;
}

export function deleteRule(id: string, root = projectRoot()): RulesFile {
  const current = loadRules(root);
  delete current[id];
  saveRules(current, root);
  return current;
}
