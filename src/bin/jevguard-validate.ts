#!/usr/bin/env node
import { projectRoot } from "../rules/config.js";
import { loadRules } from "../rules/store.js";

try {
  const root = projectRoot();
  const rules = loadRules(root);
  console.log(`OK: ${Object.keys(rules).length} rule(s) valid.`);
} catch (err) {
  console.error(`Invalid .jevguard/rules.json: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
