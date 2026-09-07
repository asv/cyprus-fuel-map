import { afterEach, describe, expect, test } from "bun:test";
import { atomicWrite } from "../src/backend/write-atomically";

const dir = new URL("../.cache/", import.meta.url);
const target = new URL("atomic-test.json", dir);
const tmpPrefix = "atomic-test.json.";

describe("atomicWrite", () => {
  afterEach(async () => {
    const { readdir, rm } = await import("node:fs/promises");
    // Remove only this test's own files (target + any unique-named tmp from a
    // failed rename). Never touch the directory or other files: the real
    // .cache/fuel-cache.json lives here and deleting it re-hits the upstream.
    try {
      const entries = await readdir(dir.pathname);
      for (const name of entries) {
        if (name === "atomic-test.json" || name.startsWith(tmpPrefix)) {
          await rm(new URL(name, dir), { force: true });
        }
      }
    } catch {
      // Directory already gone; nothing to clean.
    }
  });

  test("publishes full contents (no torn reads)", async () => {
    const body = JSON.stringify({ stations: Array.from({ length: 1000 }, (_, i) => ({ id: i })) });
    await atomicWrite(target, body);

    expect(await Bun.file(target).text()).toBe(body);
  });

  test("concurrent writers to the same target do not collide on the tmp path", async () => {
    // Two saveCache-like writers race; with per-call tmp names both renames
    // succeed and the final file is one complete payload, never a mix.
    const a = JSON.stringify({ writer: "a", data: "x".repeat(50_000) });
    const b = JSON.stringify({ writer: "b", data: "y".repeat(50_000) });

    await Promise.all([atomicWrite(target, a), atomicWrite(target, b)]);

    const finalText = await Bun.file(target).text();
    expect([a, b]).toContain(finalText);
  });

  test("leaves no stray tmp files behind on success", async () => {
    await atomicWrite(target, "{}");

    const { readdir } = await import("node:fs/promises");
    const entries = (await readdir(dir.pathname)).filter((name) => name.startsWith(tmpPrefix));
    expect(entries).toHaveLength(0);
  });
});
