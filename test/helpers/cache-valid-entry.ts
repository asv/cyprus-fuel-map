import type { CacheEntry } from "../src/backend/cache";

/** A structurally valid cache entry, mirroring what setCacheEntry writes. */
export const validEntry: CacheEntry = {
  expiresAt: Date.now() + 60_000,
  data: {
    fuel: "1",
    fuelName: "Unleaded 95",
    city: "All",
    sourceUrl: "https://eforms.eservices.cyprus.gov.cy/MCIT/MCIT/PetroleumPrices",
    fetchedAt: new Date().toISOString(),
    avgPrice: 1.483,
    minPrice: 1.389,
    maxPrice: 1.639,
    stale: false,
    cache: {
      hit: true,
      stale: false,
      expiresAt: null,
    },
    stations: [
      {
        id: "a".repeat(16),
        brand: "FILL N GO",
        name: "FILL N GO STATIONS LTD",
        address: "Λεωφ. Λάρνακος 1",
        district: "Πυργά",
        price: 1.389,
        isOffline: false,
        lat: 35.1845138888889,
        lng: 33.3895,
      },
    ],
  },
};
