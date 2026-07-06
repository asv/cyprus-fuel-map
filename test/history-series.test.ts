import { describe, expect, test } from "bun:test";
import {
  buildStationStepSeries,
  latestStationPriceChange,
  priceDeltaOverDays,
  priceVsLatestMarketMedian,
} from "../src/history-series";
import type { GlobalFuelHistory, StationFuelPriceHistory } from "../src/shared";

const stationHistory: StationFuelPriceHistory = {
  version: 1,
  fuel: "1",
  changes: [
    { stationKey: "station_b", at: "2026-07-01T00:00:00.000Z", price: 1.7, isOffline: false },
    { stationKey: "station_a", at: "2026-07-06T00:00:00.000Z", price: 1.4, isOffline: false },
    { stationKey: "station_a", at: "2026-07-01T00:00:00.000Z", price: 1.5, isOffline: true },
  ],
};

describe("history series helpers", () => {
  test("builds sorted station step series", () => {
    expect(buildStationStepSeries(stationHistory, "station_a")).toEqual([
      { at: "2026-07-01T00:00:00.000Z", price: 1.5, isOffline: true },
      { at: "2026-07-06T00:00:00.000Z", price: 1.4, isOffline: false },
    ]);
  });

  test("finds latest station change and price delta", () => {
    expect(latestStationPriceChange(stationHistory, "station_a")?.price).toBe(1.4);
    expect(
      priceDeltaOverDays(buildStationStepSeries(stationHistory, "station_a"), new Date("2026-07-08T00:00:00.000Z"), 7),
    ).toBe(-0.1);
  });

  test("compares station price with latest market median", () => {
    const globalHistory: GlobalFuelHistory = {
      version: 1,
      fuel: "1",
      points: [
        {
          at: "2026-07-01T00:00:00.000Z",
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
    };

    expect(priceVsLatestMarketMedian(1.47, globalHistory)).toBe(-0.03);
  });
});
