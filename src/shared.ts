export const fuelTypes = {
  "1": "Unleaded 95",
  "2": "Unleaded 98",
  "3": "Diesel",
  "4": "Heating oil",
  "5": "Kerosene",
} as const;

export const cities = ["All", "Famagusta", "Larnaca", "Limassol", "Nicosia", "Paphos"] as const;

export type FuelType = keyof typeof fuelTypes;
export type City = (typeof cities)[number];

export type FuelStation = {
  id: string;
  brand: string;
  name: string;
  address: string;
  district: string;
  price: number;
  isOffline: boolean;
  lat: number | null;
  lng: number | null;
};

export type CacheMeta = {
  hit: boolean;
  stale: boolean;
  expiresAt: string | null;
};

export type FuelResponse = {
  fuel: FuelType;
  fuelName: string;
  city: City;
  sourceUrl: string;
  fetchedAt: string;
  avgPrice: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  stale?: boolean;
  cache?: CacheMeta;
  stations: FuelStation[];
};

export type StaticDataManifest = {
  version: 1;
  generatedAt: string;
  city: City;
  fuels: Array<{
    fuel: FuelType;
    fuelName: string;
    path: string;
    fetchedAt: string;
    stationCount: number;
    mappedStationCount: number;
    avgPrice: number | null;
    minPrice: number | null;
    maxPrice: number | null;
    stale: boolean;
  }>;
};

export type HistoryManifest = {
  version: 1;
  generatedAt: string;
  fuels: Array<{
    fuel: FuelType;
    fuelName: string;
    globalPath: string;
    stationPricesPath: string;
  }>;
  stationIndexPath: string;
};

export type GlobalFuelPoint = {
  at: string;
  stationCount: number;
  mappedStationCount: number;
  avgPrice: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  medianPrice: number | null;
  p25Price: number | null;
  p75Price: number | null;
  offlineCount: number;
};

export type GlobalFuelHistory = {
  version: 1;
  fuel: FuelType;
  points: GlobalFuelPoint[];
};

export type StationHistoryEntry = {
  stationKey: string;
  currentSourceHash: string;
  aliases: string[];
  brand: string;
  name: string;
  address: string;
  district: string;
  lat: number | null;
  lng: number | null;
  firstSeenAt: string;
  lastSeenAt: string;
};

export type StationHistoryIndex = {
  version: 1;
  stations: Record<string, StationHistoryEntry>;
};

export type StationPriceChange = {
  stationKey: string;
  at: string;
  price: number;
  isOffline: boolean;
};

export type StationFuelPriceHistory = {
  version: 1;
  fuel: FuelType;
  changes: StationPriceChange[];
};

export type ApiError = {
  error: {
    code: string;
    message: string;
    retryable: boolean;
  };
};
