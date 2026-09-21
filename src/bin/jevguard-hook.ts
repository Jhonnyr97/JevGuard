#!/usr/bin/env node
import { loadConfig, projectRoot } from "../rules/config.js";
import { loadRules } from "../rules/store.js";
import { isPaused } from "../rules/pause.js";
import { verify } from "../verify.js";
import { buildVerifyRequest, formatHookOutput, type HookInput } from "../hook.js";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function main(): Promise<void> {
  const raw = await readStdin();
  const input = JSON.parse(raw || "{}") as HookInput;

  const req = buildVerifyRequest(input);
  if (!req) {
    process.stdout.write("{}");
    return;
  }

  const root = projectRoot();
  if (isPaused(root)) {
    process.stdout.write("{}");
    return;
  }

  const config = loadConfig(root);
  const rules = loadRules(root);

  const result = await verify(req, rules, config);
  process.stdout.write(JSON.stringify(formatHookOutput(input.hook_event_name, result)));
}

main().catch((err) => {
  process.stderr.write(`jevguard-hook: ${err instanceof Error ? err.message : String(err)}\n`);
  process.stdout.write("{}");
});
