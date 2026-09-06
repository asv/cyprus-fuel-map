import { z } from "zod";

import type {
  CacheMeta,
  City,
  FuelResponse,
  FuelStation,
  FuelType,
  GlobalFuelHistory,
  GlobalFuelPoint,
  HistoryManifest,
  StaticDataManifest,
  StationFuelPriceHistory,
  StationHistoryEntry,
  StationHistoryIndex,
  StationPriceChange,
} from "../shared";
import { cities, fuelTypes } from "../shared";

/**
 * Runtime schemas for every JSON shape that crosses a process boundary in the
 * server/CLI world (upstream parse, disk cache, generated static data).
 *
 * This module must stay out of the browser bundle: it is imported only from
 * `src/backend/*` and the data-prep CLI (`generate-data.ts`), neither of which
 * is reachable from the `src/client.ts` bundle entry. Keep `src/shared.ts`
 * free of runtime imports so the Mini App never pulls Zod in.
 *
 * Every schema is bound to its shared type with a `z.ZodType<T>` annotation,
 * so a schema drifting out of sync with the type is a compile error.
 */

// SAFETY: fuelTypes in shared.ts is const-declared, keyed by exactly the FuelType union.
const fuelTypeSchema = z.enum(Object.keys(fuelTypes) as [...FuelType[]]);
// SAFETY: cities in shared.ts is a const tuple of every City value.
const citySchema = z.enum([...cities] as [...City[]]);

export const fuelStationSchema: z.ZodType<FuelStation> = z.object({
  id: z.string(),
  brand: z.string(),
  name: z.string(),
  address: z.string(),
  district: z.string(),
  price: z.number(),
  isOffline: z.boolean(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
});

export const cacheMetaSchema: z.ZodType<CacheMeta> = z.object({
  hit: z.boolean(),
  stale: z.boolean(),
  expiresAt: z.string().nullable(),
});

export const fuelResponseSchema: z.ZodType<FuelResponse> = z.object({
  fuel: fuelTypeSchema,
  fuelName: z.string(),
  city: citySchema,
  sourceUrl: z.string(),
  fetchedAt: z.string(),
  avgPrice: z.number().nullable(),
  minPrice: z.number().nullable(),
  maxPrice: z.number().nullable(),
  stale: z.boolean().optional(),
  cache: cacheMetaSchema.optional(),
  stations: z.array(fuelStationSchema),
});

/** Internal `.cache/fuel-cache.json` shape, owned by src/backend/cache.ts. */
export const cacheEntrySchema = z.object({
  expiresAt: z.number(),
  data: fuelResponseSchema,
});
export const cacheFileSchema = z.object({
  version: z.literal(2),
  entries: z.record(z.string(), cacheEntrySchema),
});

export const globalFuelPointSchema: z.ZodType<GlobalFuelPoint> = z.object({
  at: z.string(),
  stationCount: z.number(),
  mappedStationCount: z.number(),
  avgPrice: z.number().nullable(),
  minPrice: z.number().nullable(),
  maxPrice: z.number().nullable(),
  medianPrice: z.number().nullable(),
  p25Price: z.number().nullable(),
  p75Price: z.number().nullable(),
  offlineCount: z.number(),
});

export const globalFuelHistorySchema: z.ZodType<GlobalFuelHistory> = z.object({
  version: z.literal(1),
  fuel: fuelTypeSchema,
  points: z.array(globalFuelPointSchema),
});

export const stationHistoryEntrySchema: z.ZodType<StationHistoryEntry> = z.object({
  stationKey: z.string(),
  currentSourceHash: z.string(),
  aliases: z.array(z.string()),
  brand: z.string(),
  name: z.string(),
  address: z.string(),
  district: z.string(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  firstSeenAt: z.string(),
  lastSeenAt: z.string(),
});

export const stationHistoryIndexSchema: z.ZodType<StationHistoryIndex> = z.object({
  version: z.literal(1),
  stations: z.record(z.string(), stationHistoryEntrySchema),
});

export const stationPriceChangeSchema: z.ZodType<StationPriceChange> = z.object({
  stationKey: z.string(),
  at: z.string(),
  price: z.number(),
  isOffline: z.boolean(),
});

export const stationFuelPriceHistorySchema: z.ZodType<StationFuelPriceHistory> = z.object({
  version: z.literal(1),
  fuel: fuelTypeSchema,
  changes: z.array(stationPriceChangeSchema),
});

export const historyManifestSchema: z.ZodType<HistoryManifest> = z.object({
  version: z.literal(1),
  generatedAt: z.string(),
  fuels: z.array(
    z.object({
      fuel: fuelTypeSchema,
      fuelName: z.string(),
      globalPath: z.string(),
      stationPricesPath: z.string(),
    }),
  ),
  stationIndexPath: z.string(),
});

export const staticDataManifestSchema: z.ZodType<StaticDataManifest> = z.object({
  version: z.literal(1),
  generatedAt: z.string(),
  city: citySchema,
  fuels: z.array(
    z.object({
      fuel: fuelTypeSchema,
      fuelName: z.string(),
      path: z.string(),
      fetchedAt: z.string(),
      stationCount: z.number(),
      mappedStationCount: z.number(),
      avgPrice: z.number().nullable(),
      minPrice: z.number().nullable(),
      maxPrice: z.number().nullable(),
      stale: z.boolean(),
    }),
  ),
});
