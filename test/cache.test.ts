import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import { getCacheEntry, useCacheFileForTesting, withCacheMeta } from "../src/backend/cache";

type JsonLike = null | boolean | number | string | readonly JsonLike[] | { [key: string]: JsonLike };

import { validEntry } from "./helpers/cache-valid-entry";

// Point the module-private cache at a throwaway file (never the real .cache/fuel-cache.json).
const testFile = new URL(`../.cache/test-fuel-cache-${process.pid}.json`, import.meta.url);
const writeCache = (value: JsonLike) => Bun.write(testFile, JSON.stringify(value, null, 2));

describe("fuel cache", () => {
  beforeEach(async () => {
    useCacheFileForTesting(testFile);
    await writeCache({ version: 2, entries: {} });
  });

  afterEach(async () => {
    await rm(testFile, { force: true });
  });

  test("loads valid entries from the cache file", async () => {
    await writeCache({ version: 2, entries: { "1:All": validEntry } });

    const entry = await getCacheEntry("1:All");
    expect(entry?.data.fuel).toBe("1");
    expect(entry?.data.stations).toHaveLength(1);
  });

  test("ignores a corrupt entry but keeps the valid ones (per-entry resilience)", async () => {
    await writeCache({
      version: 2,
      entries: {
        "1:All": validEntry,
        "2:All": { ...validEntry, data: { ...validEntry.data, fuel: "99" } },
        "3:All": "not-an-entry",
      },
    });

    expect((await getCacheEntry("1:All"))?.data.fuel).toBe("1");
    expect(await getCacheEntry("2:All")).toBeUndefined();
    expect(await getCacheEntry("3:All")).toBeUndefined();
  });

  test("treats a file with the wrong version as empty", async () => {
    await writeCache({ version: 1, entries: { "1:All": validEntry } });
    expect(await getCacheEntry("1:All")).toBeUndefined();
  });

  test("does not crash on a non-JSON cache file", async () => {
    await Bun.write(testFile, "not json at all");
    expect(await getCacheEntry("1:All")).toBeUndefined();
  });

  test("withCacheMeta marks stale when the entry has expired", () => {
    const meta = withCacheMeta(validEntry.data, validEntry, { hit: true });
    expect(meta.cache?.stale).toBe(false);
    expect(meta.cache?.hit).toBe(true);

    const staleMeta = withCacheMeta(validEntry.data, { ...validEntry, expiresAt: Date.now() - 1 }, { hit: false });
    expect(staleMeta.cache?.stale).toBe(true);
  });
});
