import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import { globalFuelHistorySchema } from "../src/backend/json-schemas";
import { emptyHistoryManifest, emptyStationHistoryIndex, readHistoryJson, sortJsonValue } from "../src/history-storage";

const historyFile = new URL("../public/data/history/readhistory-test.json", import.meta.url);
const fallback = { version: 1, fuel: "1", points: [] };
const validJson = JSON.stringify(
  {
    version: 1,
    fuel: "1",
    points: [
      {
        at: "t",
        stationCount: 1,
        mappedStationCount: 1,
        avgPrice: 1.5,
        minPrice: 1.5,
        maxPrice: 1.5,
        medianPrice: 1.5,
        p25Price: 1.5,
        p75Price: 1.5,
        offlineCount: 0,
      },
    ],
  },
  null,
  2,
);

describe("history storage helpers", () => {
  beforeEach(async () => {
    await rm(historyFile, { force: true });
  });

  afterEach(async () => {
    await rm(historyFile, { force: true });
  });

  test("readHistoryJson returns the fallback when the file is missing", async () => {
    expect(await readHistoryJson("readhistory-test.json", globalFuelHistorySchema, fallback)).toBe(fallback);
  });

  test("readHistoryJson parses a valid history file", async () => {
    await Bun.write(historyFile, validJson);
    const parsed = await readHistoryJson("readhistory-test.json", globalFuelHistorySchema, fallback);
    expect(parsed.points).toHaveLength(1);
    expect(parsed.fuel).toBe("1");
  });

  test("readHistoryJson self-heals a corrupt history file into the fallback", async () => {
    await Bun.write(
      historyFile,
      JSON.stringify({ version: 1, fuel: "1", points: [{ at: "t", stationCount: "nope" }] }),
    );
    expect(await readHistoryJson("readhistory-test.json", globalFuelHistorySchema, fallback)).toBe(fallback);
  });

  test("readHistoryJson self-heals a non-JSON file into the fallback", async () => {
    await Bun.write(historyFile, "broken {{ not json");
    expect(await readHistoryJson("readhistory-test.json", globalFuelHistorySchema, fallback)).toBe(fallback);
  });

  test("builds a manifest for all fuel types", () => {
    expect(emptyHistoryManifest("2026-07-06T00:00:00.000Z")).toMatchObject({
      version: 1,
      generatedAt: "2026-07-06T00:00:00.000Z",
      stationIndexPath: "data/history/station-index.json",
      fuels: [
        {
          fuel: "1",
          globalPath: "data/history/global-1.json",
          stationPricesPath: "data/history/station-prices-1.json",
        },
        {
          fuel: "2",
          globalPath: "data/history/global-2.json",
          stationPricesPath: "data/history/station-prices-2.json",
        },
        {
          fuel: "3",
          globalPath: "data/history/global-3.json",
          stationPricesPath: "data/history/station-prices-3.json",
        },
        {
          fuel: "4",
          globalPath: "data/history/global-4.json",
          stationPricesPath: "data/history/station-prices-4.json",
        },
        {
          fuel: "5",
          globalPath: "data/history/global-5.json",
          stationPricesPath: "data/history/station-prices-5.json",
        },
      ],
    });
  });

  test("creates an empty station index", () => {
    expect(emptyStationHistoryIndex()).toEqual({ version: 1, stations: {} });
  });

  test("sorts object keys recursively without reordering arrays", () => {
    expect(sortJsonValue({ b: 1, a: { d: 2, c: 3 }, z: [{ b: 1, a: 2 }] })).toEqual({
      a: { c: 3, d: 2 },
      b: 1,
      z: [{ a: 2, b: 1 }],
    });
  });
});
