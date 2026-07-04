import { mkdir } from "node:fs/promises";
import { fetchFuelStations } from "./backend/stations";
import { type City, cities, type FuelResponse, type FuelType, fuelTypes, type StaticDataManifest } from "./shared";

const dataDir = new URL("../public/data/", import.meta.url);
const defaultCity: City = "All";
const requestDelayMs = 2_000;

async function main(): Promise<void> {
  const fuels = selectedFuels();
  const city = selectedCity();
  const generatedAt = new Date().toISOString();
  const manifest: StaticDataManifest = {
    version: 1,
    generatedAt,
    city,
    fuels: [],
  };

  await mkdir(dataDir, { recursive: true });
  await writeJson("fuel-types.json", { fuelTypes, cities });

  for (const [index, fuel] of fuels.entries()) {
    console.log(`Generating static fuel data for ${fuelTypes[fuel]} (${fuel}) in ${city}`);
    const response = await fetchFuelStations(fuel, city);
    const path = `stations-${fuel}.json`;

    await writeJson(path, toStaticFuelResponse(response));
    manifest.fuels.push({
      fuel,
      fuelName: response.fuelName,
      path: `data/${path}`,
      fetchedAt: response.fetchedAt,
      stationCount: response.stations.length,
      mappedStationCount: response.stations.filter((station) => station.lat !== null && station.lng !== null).length,
      avgPrice: response.avgPrice,
      minPrice: response.minPrice,
      maxPrice: response.maxPrice,
      stale: response.stale ?? false,
    });

    if (index < fuels.length - 1) await Bun.sleep(requestDelayMs);
  }

  await writeJson("manifest.json", manifest);
  console.log(`Static data generated in ${new URL(".", dataDir).pathname}`);
}

function selectedFuels(): FuelType[] {
  const value = argValue("--fuel");
  if (!value) return Object.keys(fuelTypes) as FuelType[];

  const fuels = value.split(",").map((fuel) => fuel.trim());
  for (const fuel of fuels) {
    if (!isFuelType(fuel)) throw new Error(`Unsupported fuel type: ${fuel}`);
  }
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
  return (cities as readonly string[]).includes(value);
}

function toStaticFuelResponse(response: FuelResponse): FuelResponse {
  const { cache: _cache, ...staticResponse } = response;
  return staticResponse;
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await Bun.write(new URL(path, dataDir), `${JSON.stringify(value, null, 2)}\n`);
}

await main();
