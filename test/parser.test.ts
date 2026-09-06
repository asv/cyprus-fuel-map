import { describe, expect, test } from "bun:test";
import { extractCoordinates, parseFuelResponse, parsePrices, parseStations } from "../src/backend/parser";

const fixture = await Bun.file(new URL("./fixtures/petroleum-sample.html", import.meta.url)).text();
const complexFixture = await Bun.file(new URL("./fixtures/petroleum-complex.html", import.meta.url)).text();

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

  describe("realistic upstream-shaped HTML", () => {
    test("filters the summary labels to the displayLabelValue cells only", () => {
      expect(parsePrices(complexFixture)).toEqual({ avgPrice: 1.499, minPrice: 1.401, maxPrice: 1.662 });
    });

    test("strips nested tags and decodes text within cells", () => {
      const stations = parseStations(complexFixture);
      const station = stations[0]!;
      expect(station.brand).toBe("EXXON");
      expect(station.name).toBe("EXXON STATION LTD");
      expect(station.address).toBe("Λεωφ. Αθαλάσσας 12");
      expect(station.district).toBe("Λατσιά");
      expect(station.price).toBe(1.411);
      expect(station.lat).toBeCloseTo(35.2, 5);
      expect(station.lng).toBeCloseTo(33.3, 5);
    });

    test("decodes address entities and DMS coordinates from an offline row", () => {
      const offline = parseStations(complexFixture)[1]!;
      expect(offline.brand).toBe("MOTOR OIL");
      expect(offline.isOffline).toBe(true);
      expect(offline.address).toBe("Γωνία Ελ. Βενιζέλου & Γλάδστωνος");
      expect(offline.lat).toBeCloseTo(34.5, 5);
      expect(offline.lng).toBeCloseTo(33.5, 5);
    });

    test("extracts coordinates from a parameter with extra query fields", () => {
      const withSuffix = parseStations(complexFixture)[2]!;
      expect(withSuffix.brand).toBe("SHELL");
      expect(withSuffix.lat).toBeCloseTo(35.25, 5);
      expect(withSuffix.lng).toBeCloseTo(33.35, 5);
    });

    test("keeps stations without coordinates and skips short rows", () => {
      const stations = parseStations(complexFixture);
      expect(stations).toHaveLength(4);
      const withoutCoords = stations[3]!;
      expect(withoutCoords.brand).toBe("NO COORDS");
      expect(withoutCoords.lat).toBeNull();
      expect(withoutCoords.lng).toBeNull();
    });
  });
});
