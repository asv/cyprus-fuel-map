import { describe, expect, test } from "bun:test";
import { buildGlobalFuelPoint, percentile } from "../src/history-stats";
import type { FuelResponse, FuelStation } from "../src/shared";

const baseStation: FuelStation = {
  id: "station-a",
  brand: "Brand",
  name: "Name",
  address: "Address",
  district: "District",
  price: 1,
  isOffline: false,
  lat: 35,
  lng: 33,
};

describe("history stats", () => {
  test("calculates interpolated percentiles", () => {
    expect(percentile([], 0.5)).toBeNull();
    expect(percentile([1.2345], 0.5)).toBe(1.235);
    expect(percentile([1, 2, 3, 4], 0.25)).toBe(1.75);
    expect(percentile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(percentile([1, 2, 3, 4], 0.75)).toBe(3.25);
  });

  test("builds global market point from a fuel response", () => {
    const response: FuelResponse = {
      fuel: "1",
      fuelName: "Unleaded 95",
      city: "All",
      sourceUrl: "https://example.test",
      fetchedAt: "2026-07-06T18:20:12.843Z",
      avgPrice: 1.2,
      minPrice: 1.1,
      maxPrice: 1.3,
      stations: [
        { ...baseStation, id: "a", price: 1.1, isOffline: true },
        { ...baseStation, id: "b", price: 1.2, lat: null, lng: null },
        { ...baseStation, id: "c", price: 1.3 },
      ],
    };

    expect(buildGlobalFuelPoint(response)).toEqual({
      at: "2026-07-06T18:20:12.843Z",
      stationCount: 3,
      mappedStationCount: 2,
      avgPrice: 1.2,
      minPrice: 1.1,
      maxPrice: 1.3,
      medianPrice: 1.2,
      p25Price: 1.15,
      p75Price: 1.25,
      offlineCount: 1,
    });
  });
});
