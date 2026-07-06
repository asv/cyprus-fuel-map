import { mkdir } from "node:fs/promises";
import { type FuelType, fuelTypes, type HistoryManifest, type StationHistoryIndex } from "./shared";

export const historyDir = new URL("../public/data/history/", import.meta.url);

export function emptyHistoryManifest(generatedAt: string): HistoryManifest {
  return {
    version: 1,
    generatedAt,
    fuels: (Object.keys(fuelTypes) as FuelType[]).map((fuel) => ({
      fuel,
      fuelName: fuelTypes[fuel],
      globalPath: `data/history/global-${fuel}.json`,
      stationPricesPath: `data/history/station-prices-${fuel}.json`,
    })),
    stationIndexPath: "data/history/station-index.json",
  };
}

export function emptyStationHistoryIndex(): StationHistoryIndex {
  return { version: 1, stations: {} };
}

export async function readHistoryJson<T>(path: string, fallback: T): Promise<T> {
  const file = Bun.file(new URL(path, historyDir));
  if (!(await file.exists())) return fallback;
  return (await file.json()) as T;
}

export async function writeHistoryJsonIfChanged(path: string, value: unknown): Promise<boolean> {
  await mkdir(historyDir, { recursive: true });
  const next = `${JSON.stringify(sortJsonValue(value), null, 2)}\n`;
  const file = Bun.file(new URL(path, historyDir));
  if ((await file.exists()) && (await file.text()) === next) return false;

  await Bun.write(new URL(path, historyDir), next);
  return true;
}

export function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJsonValue);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, child]) => [key, sortJsonValue(child)]),
  );
}
