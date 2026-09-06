import { describe, expect, test } from "bun:test";
import {
  cacheEntrySchema,
  cacheFileSchema,
  fuelResponseSchema,
  globalFuelHistorySchema,
  historyManifestSchema,
  staticDataManifestSchema,
  stationFuelPriceHistorySchema,
  stationHistoryIndexSchema,
} from "../src/backend/json-schemas";
import { validEntry } from "./helpers/cache-valid-entry";

/** Type-stable wrapper over zod4's soft result (success + error detail). */
type JsonLike = null | boolean | number | string | readonly JsonLike[] | { [key: string]: JsonLike };

type SoftResult = {
  success: boolean;
  error: { name: string; message: string };
};

function accepts(
  schema: { safeParse: (value: JsonLike) => SoftResult } | { parse: (value: JsonLike) => JsonLike },
  value: JsonLike,
): void {
  if (schema.safeParse) {
    expect(schema.safeParse(value).success).toBe(true);
    return;
  }
  schema.parse(value);
}

function rejects(schema: { safeParse: (value: JsonLike) => SoftResult }, value: JsonLike): void {
  expect(schema.safeParse(value).success).toBe(false);
}

function fuelWith(fuel: string) {
  return { ...validEntry.data, fuel };
}

function stationsWithFirst(station: JsonLike) {
  return { ...validEntry.data, stations: [station] };
}

describe("json-schemas", () => {
  test("fuelResponseSchema accepts a valid FuelResponse", () => {
    accepts(fuelResponseSchema, validEntry.data);
  });

  test("fuelResponseSchema rejects a wrong fuel type and wrong station types", () => {
    rejects(fuelResponseSchema, fuelWith("99"));
    rejects(fuelResponseSchema, stationsWithFirst({ ...validEntry.data.stations[0]!, lat: "12" }));
  });

  test("cacheEntrySchema rejects entries with bad data", () => {
    rejects(cacheEntrySchema, fuelWith("99"));
    rejects(cacheEntrySchema, { ...validEntry, expiresAt: "not-a-number" });
  });

  test("cacheFileSchema validates the full file shape", () => {
    const file = { version: 2, entries: { "1:All": validEntry } };
    accepts(cacheFileSchema, file);
    rejects(cacheFileSchema, { ...file, version: 1 });
    rejects(cacheFileSchema, { ...file, entries: { "1:All": { ...validEntry, data: 42 } } });
  });

  test("generated static data shapes validate", () => {
    accepts(globalFuelHistorySchema, {
      version: 1,
      fuel: "1",
      points: [
        {
          at: "2026-07-06T00:00:00.000Z",
          stationCount: 10,
          mappedStationCount: 8,
          avgPrice: 1.5,
          minPrice: 1.2,
          maxPrice: 1.8,
          medianPrice: 1.5,
          p25Price: 1.4,
          p75Price: 1.6,
          offlineCount: 1,
        },
      ],
    });

    accepts(stationHistoryIndexSchema, {
      version: 1,
      stations: {
        key: {
          stationKey: "key",
          currentSourceHash: "h",
          aliases: [],
          brand: "B",
          name: "N",
          address: "A",
          district: "D",
          lat: null,
          lng: null,
          firstSeenAt: "t",
          lastSeenAt: "t",
        },
      },
    });

    accepts(stationFuelPriceHistorySchema, {
      version: 1,
      fuel: "3",
      changes: [{ stationKey: "key", at: "t", price: 1.5, isOffline: false }],
    });

    accepts(staticDataManifestSchema, {
      version: 1,
      generatedAt: "t",
      city: "Nicosia",
      fuels: [
        {
          fuel: "2",
          fuelName: "Unleaded 98",
          path: "data/stations-2.json",
          fetchedAt: "t",
          stationCount: 1,
          mappedStationCount: 1,
          avgPrice: 1.5,
          minPrice: 1.5,
          maxPrice: 1.5,
          stale: false,
        },
      ],
    });

    accepts(historyManifestSchema, {
      version: 1,
      generatedAt: "t",
      fuels: [{ fuel: "1", fuelName: "Unleaded 95", globalPath: "p", stationPricesPath: "q" }],
      stationIndexPath: "r",
    });
  });

  test("enums reject out-of-band values", () => {
    rejects(staticDataManifestSchema, { version: 1, generatedAt: "t", city: "Atlantis", fuels: [] });
    rejects(globalFuelHistorySchema, { version: 1, fuel: "9", points: [] });
  });
});
