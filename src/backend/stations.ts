import type { City, FuelResponse, FuelType } from "../shared";
import { getCacheEntry, isFresh, setCacheEntry, withCacheMeta } from "./cache";
import { fuelResponseSchema } from "./json-schemas";
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
    // Validate at the I/O boundary: never cache or serve a structurally broken upstream result.
    fuelResponseSchema.parse(data);
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
