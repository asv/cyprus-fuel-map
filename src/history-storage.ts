import type { z } from "zod";
import { atomicWrite } from "./backend/write-atomically";
import { type FuelType, fuelTypes, type HistoryManifest, type JsonValue, type StationHistoryIndex } from "./shared";

export const historyDir = new URL("../public/data/history/", import.meta.url);

export function emptyHistoryManifest(generatedAt: string): HistoryManifest {
  // SAFETY: fuelTypes is declared as const keyed by every FuelType, so its keys are exactly the FuelType union.
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

export async function readHistoryJson<T>(path: string, schema: z.ZodType<T>, fallback: T): Promise<T> {
  const file = Bun.file(new URL(path, historyDir));
  if (!(await file.exists())) return fallback;
  try {
    return schema.parse(await file.json());
  } catch (error) {
    // A corrupt or schema-drifting history file should not abort generation;
    // rebuilding it fresh is safer than trusting unvalidated on-disk data.
    console.warn(`Invalid history file ${path}; starting fresh:`, error);
    return fallback;
  }
}

export async function writeHistoryJsonIfChanged(path: string, value: JsonValue): Promise<boolean> {
  const next = `${JSON.stringify(sortJsonValue(value), null, 2)}\n`;
  const file = Bun.file(new URL(path, historyDir));
  if ((await file.exists()) && (await file.text()) === next) return false;

  await atomicWrite(new URL(path, historyDir), next);
  return true;
}

export function sortJsonValue(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map((child) => sortJsonValue(child));
  if (isJsonRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, child]) => [key, sortJsonValue(child)]),
    );
  }
  return value;
}

/** True for JSON objects (non-null, non-array), the branch sortJsonValue recurses into. */
function isJsonRecord(value: JsonValue): value is { [key: string]: JsonValue } {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
