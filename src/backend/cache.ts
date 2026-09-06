import type { CacheMeta, FuelResponse } from "../shared";
import { cacheEntrySchema } from "./json-schemas";
import { atomicWrite } from "./write-atomically";

type CacheEntry = { expiresAt: number; data: FuelResponse };
type CacheFile = { version: 2; entries: Record<string, CacheEntry> };

const cache = new Map<string, CacheEntry>();
const cacheDir = new URL("../../.cache/", import.meta.url);
let cacheFilePath = new URL("fuel-cache.json", cacheDir);
export let cacheLoaded = false;

export const cacheTtlMs = 6 * 60 * 60 * 1000;

export async function getCacheEntry(key: string): Promise<CacheEntry | undefined> {
  await loadCache();
  return cache.get(key);
}

export function isFresh(entry: CacheEntry | undefined): entry is CacheEntry {
  return !!entry && entry.expiresAt > Date.now();
}

export async function setCacheEntry(key: string, data: FuelResponse): Promise<CacheEntry> {
  const entry = { expiresAt: Date.now() + cacheTtlMs, data };
  cache.set(key, entry);
  await saveCache();
  return entry;
}

export function withCacheMeta(
  data: FuelResponse,
  entry: CacheEntry,
  options: { hit: boolean; stale?: boolean },
): FuelResponse {
  const stale = options.stale ?? entry.expiresAt <= Date.now();
  const cacheMeta: CacheMeta = {
    hit: options.hit,
    stale,
    expiresAt: new Date(entry.expiresAt).toISOString(),
  };
  return { ...data, stale, cache: cacheMeta };
}

async function loadCache(): Promise<void> {
  if (cacheLoaded) return;
  cacheLoaded = true;

  const file = Bun.file(cacheFilePath);
  if (!(await file.exists())) return;

  try {
    // SAFETY: the cast reads only the two fields guarded by the checks on the next line.
    const rawFile = (await file.json()) as { version?: unknown; entries?: object };
    if (rawFile.version !== 2 || !isRecord(rawFile.entries)) return;

    // Validate per entry rather than the whole file: one corrupt fuel type must
    // not invalidate the rest of the cache, which would re-hit the upstream.
    for (const [key, entryRaw] of Object.entries(rawFile.entries)) {
      const entry = cacheEntrySchema.safeParse(entryRaw);
      if (entry.success) cache.set(key, entry.data);
    }
  } catch (error) {
    console.warn("Failed to read fuel cache:", error);
  }
}

async function saveCache(): Promise<void> {
  const cacheFile: CacheFile = { version: 2, entries: Object.fromEntries(cache) };

  await atomicWrite(cacheFilePath, `${JSON.stringify(cacheFile, null, 2)}\n`);
}

/** True for JSON objects (non-null, non-array), as required for the cache entries map. */
function isRecord(value: unknown): value is object {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Test-only: point the cache at a different file and reset the cached-load flag.
 * Each test writes its own fixture, calls this, and reads through getCacheEntry.
 */
export function useCacheFileForTesting(path: string | URL): void {
  cacheFilePath = new URL(path, import.meta.url);
  cacheLoaded = false;
  cache.clear();
}
