import { buildGlobalFuelPoint } from "./history-stats";
import type {
  FuelResponse,
  FuelStation,
  FuelType,
  GlobalFuelHistory,
  GlobalFuelPoint,
  StationFuelPriceHistory,
  StationHistoryIndex,
  StationPriceChange,
} from "./shared";

export function emptyGlobalFuelHistory(fuel: FuelType): GlobalFuelHistory {
  return { version: 1, fuel, points: [] };
}

export function appendGlobalFuelPoint(history: GlobalFuelHistory, response: FuelResponse): GlobalFuelHistory {
  const point = buildGlobalFuelPoint(response);
  const last = history.points.at(-1);
  if (last && sameGlobalPointValues(last, point)) return history;

  return { ...history, points: [...history.points, point].sort((a, b) => compareText(a.at, b.at)) };
}

export function sameGlobalPointValues(a: GlobalFuelPoint, b: GlobalFuelPoint): boolean {
  const { at: _aAt, ...aValues } = a;
  const { at: _bAt, ...bValues } = b;
  return JSON.stringify(aValues) === JSON.stringify(bValues);
}

export function stationKey(sourceHash: string): string {
  return `station_${sourceHash}`;
}

export function mergeStationsIntoIndex(
  index: StationHistoryIndex,
  stations: FuelStation[],
  seenAt: string,
): StationHistoryIndex {
  const next: StationHistoryIndex = { version: 1, stations: { ...index.stations } };

  for (const station of stations) {
    const key = stationKey(station.id);
    const existing = next.stations[key];
    next.stations[key] = {
      stationKey: key,
      currentSourceHash: station.id,
      aliases: existing?.aliases.includes(station.id)
        ? existing.aliases
        : [...(existing?.aliases ?? []), station.id].sort(),
      brand: station.brand,
      name: station.name,
      address: station.address,
      district: station.district,
      lat: station.lat,
      lng: station.lng,
      firstSeenAt: existing?.firstSeenAt ?? seenAt,
      lastSeenAt: seenAt,
    };
  }

  return {
    version: 1,
    stations: Object.fromEntries(Object.entries(next.stations).sort(([a], [b]) => compareText(a, b))),
  };
}

export function emptyStationFuelPriceHistory(fuel: FuelType): StationFuelPriceHistory {
  return { version: 1, fuel, changes: [] };
}

export function appendStationPriceChanges(
  history: StationFuelPriceHistory,
  stations: FuelStation[],
  seenAt: string,
): StationFuelPriceHistory {
  const latest = new Map<string, StationPriceChange>();
  for (const change of history.changes) latest.set(change.stationKey, change);

  const changes = [...history.changes];
  for (const station of stations) {
    const key = stationKey(station.id);
    const last = latest.get(key);
    if (last && last.price === station.price && last.isOffline === station.isOffline) continue;

    const change = { stationKey: key, at: seenAt, price: station.price, isOffline: station.isOffline };
    latest.set(key, change);
    changes.push(change);
  }

  return {
    ...history,
    changes: changes.sort((a, b) => compareText(a.at, b.at) || compareText(a.stationKey, b.stationKey)),
  };
}

function compareText(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}
