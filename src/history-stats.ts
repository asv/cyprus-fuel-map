import type { FuelResponse, FuelStation, GlobalFuelPoint } from "./shared";

export function buildGlobalFuelPoint(response: FuelResponse): GlobalFuelPoint {
  const prices = response.stations
    .map((station) => station.price)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);

  return {
    at: response.fetchedAt,
    stationCount: response.stations.length,
    mappedStationCount: response.stations.filter((station) => station.lat !== null && station.lng !== null).length,
    avgPrice: response.avgPrice,
    minPrice: response.minPrice,
    maxPrice: response.maxPrice,
    medianPrice: percentile(prices, 0.5),
    p25Price: percentile(prices, 0.25),
    p75Price: percentile(prices, 0.75),
    offlineCount: countOfflineStations(response.stations),
  };
}

export function countOfflineStations(stations: FuelStation[]): number {
  return stations.filter((station) => station.isOffline).length;
}

export function percentile(sortedValues: number[], percentileValue: number): number | null {
  if (sortedValues.length === 0) return null;
  if (sortedValues.length === 1) return roundPrice(sortedValues[0]!);

  const clamped = Math.min(Math.max(percentileValue, 0), 1);
  const index = clamped * (sortedValues.length - 1);
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);
  const lower = sortedValues[lowerIndex]!;
  const upper = sortedValues[upperIndex]!;
  const interpolated = lower + (upper - lower) * (index - lowerIndex);
  return roundPrice(interpolated);
}

function roundPrice(value: number): number {
  return Math.round(value * 1000) / 1000;
}
