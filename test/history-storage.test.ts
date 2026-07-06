import { describe, expect, test } from "bun:test";
import { emptyHistoryManifest, emptyStationHistoryIndex, sortJsonValue } from "../src/history-storage";

describe("history storage helpers", () => {
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
