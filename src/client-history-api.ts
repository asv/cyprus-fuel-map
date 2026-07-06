import type {
  FuelType,
  GlobalFuelHistory,
  HistoryManifest,
  StationFuelPriceHistory,
  StationHistoryIndex,
} from "./shared";

export async function fetchHistoryManifest(signal?: AbortSignal): Promise<HistoryManifest | null> {
  return fetchOptionalJson<HistoryManifest>("data/history/manifest.json", signal);
}

export async function fetchGlobalHistory(fuel: FuelType, signal?: AbortSignal): Promise<GlobalFuelHistory | null> {
  return fetchOptionalJson<GlobalFuelHistory>(`data/history/global-${encodeURIComponent(fuel)}.json`, signal);
}

export async function fetchStationIndex(signal?: AbortSignal): Promise<StationHistoryIndex | null> {
  return fetchOptionalJson<StationHistoryIndex>("data/history/station-index.json", signal);
}

export async function fetchStationPriceHistory(
  fuel: FuelType,
  signal?: AbortSignal,
): Promise<StationFuelPriceHistory | null> {
  return fetchOptionalJson<StationFuelPriceHistory>(
    `data/history/station-prices-${encodeURIComponent(fuel)}.json`,
    signal,
  );
}

async function fetchOptionalJson<T>(url: string, signal?: AbortSignal): Promise<T | null> {
  const response = await fetch(url, { cache: "no-store", signal });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Failed to load ${url}: ${response.status}`);
  return (await response.json()) as T;
}
