import { describe, expect, test } from "bun:test";
import {
  appendGlobalFuelPoint,
  appendStationPriceChanges,
  dedupeGlobalPoints,
  emptyGlobalFuelHistory,
  emptyStationFuelPriceHistory,
  mergeStationsIntoIndex,
  stationKey,
} from "../src/history-generate";
import type { FuelResponse, FuelStation, StationHistoryIndex } from "../src/shared";

const station: FuelStation = {
  id: "abc",
  brand: "EKO",
  name: "Station",
  address: "Address",
  district: "District",
  price: 1.5,
  isOffline: false,
  lat: 35,
  lng: 33,
};

function response(fetchedAt: string, price = 1.5): FuelResponse {
  return {
    fuel: "1",
    fuelName: "Unleaded 95",
    city: "All",
    sourceUrl: "https://example.test",
    fetchedAt,
    avgPrice: price,
    minPrice: price,
    maxPrice: price,
    stations: [{ ...station, price }],
  };
}

describe("history generation", () => {
  test("appends global points only when aggregate values change", () => {
    const first = appendGlobalFuelPoint(emptyGlobalFuelHistory("1"), response("2026-07-06T00:00:00.000Z"));
    const same = appendGlobalFuelPoint(first, response("2026-07-06T06:00:00.000Z"));
    const changed = appendGlobalFuelPoint(same, response("2026-07-06T12:00:00.000Z", 1.6));

    expect(first.points).toHaveLength(1);
    expect(same.points).toHaveLength(1);
    expect(changed.points).toHaveLength(2);
  });

  test("deduplicates repeated global point values", () => {
    const first = appendGlobalFuelPoint(emptyGlobalFuelHistory("1"), response("2026-07-06T00:00:00.000Z"));
    const duplicate = { ...first.points[0]!, at: "2026-07-06T06:00:00.000Z" };

    expect(dedupeGlobalPoints([...first.points, duplicate])).toHaveLength(1);
  });

  test("merges stations into a stable station index", () => {
    const index: StationHistoryIndex = { version: 1, stations: {} };
    const merged = mergeStationsIntoIndex(index, [station], "2026-07-06T00:00:00.000Z");
    const updated = mergeStationsIntoIndex(merged, [{ ...station, name: "Updated" }], "2026-07-07T00:00:00.000Z");

    expect(Object.keys(updated.stations)).toEqual(["station_abc"]);
    expect(updated.stations.station_abc).toMatchObject({
      stationKey: "station_abc",
      currentSourceHash: "abc",
      aliases: ["abc"],
      name: "Updated",
      firstSeenAt: "2026-07-06T00:00:00.000Z",
      lastSeenAt: "2026-07-07T00:00:00.000Z",
    });
  });

  test("appends station price changes only for changed values", () => {
    const first = appendStationPriceChanges(emptyStationFuelPriceHistory("1"), [station], "2026-07-06T00:00:00.000Z");
    const same = appendStationPriceChanges(first, [station], "2026-07-06T06:00:00.000Z");
    const changed = appendStationPriceChanges(same, [{ ...station, price: 1.49 }], "2026-07-06T12:00:00.000Z");

    expect(stationKey("abc")).toBe("station_abc");
    expect(first.changes).toHaveLength(1);
    expect(same.changes).toHaveLength(1);
    expect(changed.changes).toHaveLength(2);
  });
});
