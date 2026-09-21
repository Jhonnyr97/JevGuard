import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { projectRoot } from "./config.js";

/**
 * A flag file, not an env var: hooks are a fresh process per call, so writing or removing
 * this file takes effect on the very next tool call, mid-session, with no restart needed.
 */
export function pausePath(root = projectRoot()): string {
  return join(root, ".jevguard", "paused");
}

export function isPaused(root = projectRoot()): boolean {
  return existsSync(pausePath(root));
}

/** ISO timestamp of when verification was paused, or null if it isn't paused. */
export function pausedSince(root = projectRoot()): string | null {
  const path = pausePath(root);
  return existsSync(path) ? readFileSync(path, "utf8").trim() : null;
}

export function pause(root = projectRoot()): void {
  const path = pausePath(root);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, new Date().toISOString(), "utf8");
}

export function resume(root = projectRoot()): void {
  rmSync(pausePath(root), { force: true });
}
