import { mkdir } from "node:fs/promises";
import type { z } from "zod";
import {
  fuelResponseSchema,
  globalFuelHistorySchema,
  staticDataManifestSchema,
  stationFuelPriceHistorySchema,
  stationHistoryIndexSchema,
} from "./backend/json-schemas";
import { fetchFuelStations } from "./backend/stations";
import { atomicWrite } from "./backend/write-atomically";
import {
  appendGlobalFuelPoint,
  appendStationPriceChanges,
  emptyGlobalFuelHistory,
  emptyStationFuelPriceHistory,
  mergeStationsIntoIndex,
} from "./history-generate";
import {
  emptyHistoryManifest,
  emptyStationHistoryIndex,
  readHistoryJson,
  writeHistoryJsonIfChanged,
} from "./history-storage";
import {
  type City,
  cities,
  type FuelResponse,
  type FuelStation,
  type FuelType,
  fuelTypes,
  type JsonValue,
  type StaticDataManifest,
} from "./shared";

const dataDir = new URL("../public/data/", import.meta.url);
const defaultCity: City = "All";
const requestDelayMs = 2_000;

async function main(): Promise<void> {
  const fuels = selectedFuels();
  const city = selectedCity();
  const existingManifest = await readJson("manifest.json", staticDataManifestSchema);
  const manifest: StaticDataManifest = {
    version: 1,
    generatedAt: existingManifest?.generatedAt ?? new Date().toISOString(),
    city,
    fuels: [],
  };
  let hasDataChanges = false;

  await mkdir(dataDir, { recursive: true });
  hasDataChanges = (await writeJsonIfChanged("fuel-types.json", { fuelTypes, cities })) || hasDataChanges;

  for (const [index, fuel] of fuels.entries()) {
    console.log(`Generating static fuel data for ${fuelTypes[fuel]} (${fuel}) in ${city}`);
    const response = toStaticFuelResponse(await fetchFuelStations(fuel, city));
    await updateGlobalHistory(fuel, response);
    await updateStationIndex(response);
    await updateStationPriceHistory(fuel, response);
    const path = `stations-${fuel}.json`;
    const existingResponse = await readJson(path, fuelResponseSchema);
    const meaningfulDataChanged = !existingResponse || !sameFuelData(existingResponse, response);
    const snapshot = meaningfulDataChanged
      ? response
      : { ...existingResponse, stations: stableStations(existingResponse.stations) };
    const canonicalSnapshotChanged = !existingResponse || JSON.stringify(existingResponse) !== JSON.stringify(snapshot);

    if (meaningfulDataChanged || canonicalSnapshotChanged) {
      await writeJson(path, snapshot);
      hasDataChanges = meaningfulDataChanged || hasDataChanges;
    } else {
      console.log(`No meaningful data changes for ${fuelTypes[fuel]} (${fuel}); keeping existing snapshot`);
    }

    manifest.fuels.push({
      fuel,
      fuelName: snapshot.fuelName,
      path: `data/${path}`,
      fetchedAt: snapshot.fetchedAt,
      stationCount: snapshot.stations.length,
      mappedStationCount: snapshot.stations.filter((station) => station.lat !== null && station.lng !== null).length,
      avgPrice: snapshot.avgPrice,
      minPrice: snapshot.minPrice,
      maxPrice: snapshot.maxPrice,
      stale: snapshot.stale ?? false,
    });

    if (index < fuels.length - 1) await Bun.sleep(requestDelayMs);
  }

  if (hasDataChanges || !existingManifest || !sameManifestData(existingManifest, manifest)) {
    manifest.generatedAt =
      hasDataChanges || !existingManifest ? new Date().toISOString() : existingManifest.generatedAt;
    await writeJson("manifest.json", manifest);
  } else {
    console.log("No meaningful fuel data changes; keeping existing manifest");
  }

  await writeHistoryJsonIfChanged("manifest.json", emptyHistoryManifest(manifest.generatedAt));

  console.log(`Static data generated in ${new URL(".", dataDir).pathname}`);
}

async function updateGlobalHistory(fuel: FuelType, response: FuelResponse): Promise<void> {
  const path = `global-${fuel}.json`;
  const history = await readHistoryJson(path, globalFuelHistorySchema, emptyGlobalFuelHistory(fuel));
  await writeHistoryJsonIfChanged(path, appendGlobalFuelPoint(history, response));
}

async function updateStationIndex(response: FuelResponse): Promise<void> {
  const index = await readHistoryJson("station-index.json", stationHistoryIndexSchema, emptyStationHistoryIndex());
  await writeHistoryJsonIfChanged(
    "station-index.json",
    mergeStationsIntoIndex(index, response.stations, response.fetchedAt),
  );
}

async function updateStationPriceHistory(fuel: FuelType, response: FuelResponse): Promise<void> {
  const path = `station-prices-${fuel}.json`;
  const history = await readHistoryJson(path, stationFuelPriceHistorySchema, emptyStationFuelPriceHistory(fuel));
  await writeHistoryJsonIfChanged(path, appendStationPriceChanges(history, response.stations, response.fetchedAt));
}

function selectedFuels(): FuelType[] {
  const value = argValue("--fuel");
  if (!value) {
    // SAFETY: fuelTypes is keyed by the FuelType union, so its keys are exactly the FuelType values.
    return Object.keys(fuelTypes) as FuelType[];
  }

  const fuels = value.split(",").map((fuel) => fuel.trim());
  for (const fuel of fuels) {
    if (!isFuelType(fuel)) throw new Error(`Unsupported fuel type: ${fuel}`);
  }
  // SAFETY: every element passed isFuelType above, so the array holds only FuelType values.
  return fuels as FuelType[];
}

function selectedCity(): City {
  const value = argValue("--city") ?? defaultCity;
  if (!isCity(value)) throw new Error(`Unsupported city: ${value}`);
  return value;
}

function argValue(name: string): string | undefined {
  const prefix = `${name}=`;
  return Bun.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function isFuelType(value: string): value is FuelType {
  return Object.hasOwn(fuelTypes, value);
}

function isCity(value: string): value is City {
  return cities.some((city) => city === value);
}

function toStaticFuelResponse(response: FuelResponse): FuelResponse {
  const { cache: _cache, ...staticResponse } = response;
  return { ...staticResponse, stations: stableStations(staticResponse.stations) };
}

function sameFuelData(a: FuelResponse, b: FuelResponse): boolean {
  return JSON.stringify(stableFuelData(a)) === JSON.stringify(stableFuelData(b));
}

function stableFuelData(response: FuelResponse): Omit<FuelResponse, "fetchedAt" | "stale" | "cache"> {
  const { cache: _cache, fetchedAt: _fetchedAt, stale: _stale, ...stable } = response;
  return { ...stable, stations: stableStations(stable.stations) };
}

function stableStations(stations: FuelStation[]): FuelStation[] {
  return [...stations].sort(compareStationsForSnapshot);
}

function compareStationsForSnapshot(a: FuelStation, b: FuelStation): number {
  for (const field of ["brand", "name", "district", "address", "id"] as const) {
    const diff = compareSnapshotText(a[field], b[field]);
    if (diff !== 0) return diff;
  }
  return 0;
}

function compareSnapshotText(a: string, b: string): number {
  const left = a.trim().toLowerCase();
  const right = b.trim().toLowerCase();
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function sameManifestData(a: StaticDataManifest, b: StaticDataManifest): boolean {
  return JSON.stringify({ ...a, generatedAt: "" }) === JSON.stringify({ ...b, generatedAt: "" });
}

async function readJson<T>(path: string, schema: z.ZodType<T>): Promise<T | null> {
  const file = Bun.file(new URL(path, dataDir));
  if (!(await file.exists())) return null;
  try {
    return schema.parse(await file.json());
  } catch (error) {
    // Snapshot/manifest reads self-heal: invalid generated data is rebuilt on the next run.
    console.warn(`Invalid static data file ${path}; regenerating:`, error);
    return null;
  }
}

async function writeJsonIfChanged(path: string, value: JsonValue): Promise<boolean> {
  const next = `${JSON.stringify(value, null, 2)}\n`;
  const file = Bun.file(new URL(path, dataDir));
  if ((await file.exists()) && (await file.text()) === next) return false;

  await atomicWrite(new URL(path, dataDir), next);
  return true;
}

async function writeJson(path: string, value: JsonValue): Promise<void> {
  await atomicWrite(new URL(path, dataDir), `${JSON.stringify(value, null, 2)}\n`);
}

await main();
