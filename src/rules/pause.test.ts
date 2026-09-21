import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isPaused, pause, pausedSince, resume } from "./pause.js";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "jevguard-pause-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("pause/resume", () => {
  it("is not paused by default", () => {
    expect(isPaused(root)).toBe(false);
    expect(pausedSince(root)).toBeNull();
  });

  it("pause() creates the flag file, even when .jevguard/ doesn't exist yet", () => {
    pause(root);
    expect(isPaused(root)).toBe(true);
    expect(pausedSince(root)).not.toBeNull();
  });

  it("resume() removes the flag file", () => {
    pause(root);
    resume(root);
    expect(isPaused(root)).toBe(false);
  });

  it("resume() is a no-op when not paused", () => {
    expect(() => resume(root)).not.toThrow();
    expect(isPaused(root)).toBe(false);
  });
});
