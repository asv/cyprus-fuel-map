import type { City, FuelResponse, FuelType } from "../shared";
import { getCacheEntry, isFresh, setCacheEntry, withCacheMeta } from "./cache";
import { parseFuelResponse } from "./parser";
import { fetchFuelHtml } from "./upstream";

const inflight = new Map<string, Promise<FuelResponse>>();

export async function fetchFuelStations(fuel: FuelType, city: City = "All"): Promise<FuelResponse> {
  const cacheKey = `${fuel}:${city}`;
  const cached = await getCacheEntry(cacheKey);
  if (isFresh(cached)) return withCacheMeta(cached.data, cached, { hit: true, stale: false });

  const existing = inflight.get(cacheKey);
  if (existing) return existing;

  const request = fetchFuelStationsFromSource(fuel, city, cacheKey, cached).finally(() => inflight.delete(cacheKey));
  inflight.set(cacheKey, request);
  return request;
}

async function fetchFuelStationsFromSource(
  fuel: FuelType,
  city: City,
  cacheKey: string,
  staleCache: Awaited<ReturnType<typeof getCacheEntry>>,
): Promise<FuelResponse> {
  try {
    const html = await fetchFuelHtml(fuel, city);
    const data = parseFuelResponse(html, fuel, city);
    const entry = await setCacheEntry(cacheKey, data);
    return withCacheMeta(data, entry, { hit: false, stale: false });
  } catch (error) {
    if (staleCache) {
      console.warn(`Using stale fuel cache for ${cacheKey}:`, error);
      return withCacheMeta(staleCache.data, staleCache, { hit: true, stale: true });
    }
    throw error;
  }
}
