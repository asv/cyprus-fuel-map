import { mkdir } from "node:fs/promises";
import type { CacheMeta, FuelResponse } from "../shared";

type CacheEntry = { expiresAt: number; data: FuelResponse };
type CacheFile = { version: 2; entries: Record<string, CacheEntry> };

const cache = new Map<string, CacheEntry>();
const cacheDir = new URL("../../.cache/", import.meta.url);
const cacheFilePath = new URL("fuel-cache.json", cacheDir);
let cacheLoaded = false;

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
    const parsed = (await file.json()) as CacheFile;
    if (parsed.version !== 2) return;

    for (const [key, entry] of Object.entries(parsed.entries)) {
      if (isCacheEntry(entry)) cache.set(key, entry);
    }
  } catch (error) {
    console.warn("Failed to read fuel cache:", error);
  }
}

async function saveCache(): Promise<void> {
  const cacheFile: CacheFile = { version: 2, entries: Object.fromEntries(cache) };

  await mkdir(cacheDir, { recursive: true });
  await Bun.write(cacheFilePath, JSON.stringify(cacheFile, null, 2));
}

function isCacheEntry(value: unknown): value is CacheEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<CacheEntry>;
  return typeof entry.expiresAt === "number" && isFuelResponse(entry.data);
}

function isFuelResponse(value: unknown): value is FuelResponse {
  if (!value || typeof value !== "object") return false;
  const response = value as Partial<FuelResponse>;
  return typeof response.fuel === "string" && Array.isArray(response.stations);
}
