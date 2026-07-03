import { describe, expect, test } from "bun:test";
import { extractCoordinates, parseFuelResponse, parsePrices, parseStations } from "../src/backend/parser";

const fixture = await Bun.file(new URL("./fixtures/petroleum-sample.html", import.meta.url)).text();

describe("fuel parser", () => {
  test("parses summary prices", () => {
    expect(parsePrices(fixture)).toEqual({ avgPrice: 1.483, minPrice: 1.389, maxPrice: 1.639 });
  });

  test("parses stations and coordinates", () => {
    const stations = parseStations(fixture);

    expect(stations).toHaveLength(3);
    expect(stations[0]).toMatchObject({
      brand: "FILL N GO",
      name: "FILL N GO STATIONS LTD",
      district: "Πυργά",
      price: 1.389,
      isOffline: false,
      lat: 35.1845138888889,
      lng: 33.3895,
    });
    expect(stations[0]?.id).toHaveLength(16);
    expect(stations[1]?.isOffline).toBe(true);
    expect(stations[1]?.lat).toBeCloseTo(34.654153, 5);
    expect(stations[1]?.lng).toBeCloseTo(32.976061, 5);
    expect(stations[2]?.lat).toBeNull();
    expect(stations[2]?.lng).toBeNull();
  });

  test("parses full fuel response", () => {
    const response = parseFuelResponse(fixture, "1", "All", new Date("2026-07-03T00:00:00.000Z"));

    expect(response.fuelName).toBe("Unleaded 95");
    expect(response.city).toBe("All");
    expect(response.fetchedAt).toBe("2026-07-03T00:00:00.000Z");
    expect(response.stations).toHaveLength(3);
  });

  test("rejects coordinates outside Cyprus bounding box", () => {
    expect(extractCoordinates('<a href="/DisplayMap?coordinates=1%2C2">bad</a>')).toBeNull();
  });
});
