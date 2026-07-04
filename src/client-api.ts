import type { FuelResponse } from "./shared";

export async function fetchStations(fuel: string, signal: AbortSignal): Promise<FuelResponse> {
  const staticResponse = await fetch(`data/stations-${encodeURIComponent(fuel)}.json`, {
    signal,
    cache: "no-cache",
  });
  if (staticResponse.ok) return (await staticResponse.json()) as FuelResponse;

  if (!canUseBackendFallback()) {
    throw new Error(`Static fuel data not found for fuel type ${fuel}`);
  }

  const apiResponse = await fetch(`api/stations?fuel=${encodeURIComponent(fuel)}`, { signal });
  if (!apiResponse.ok) throw new Error(await apiResponse.text());
  return (await apiResponse.json()) as FuelResponse;
}

function canUseBackendFallback(): boolean {
  return ["localhost", "127.0.0.1", ""].includes(window.location.hostname);
}
