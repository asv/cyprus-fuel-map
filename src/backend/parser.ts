import { createHash } from "node:crypto";
import type { FuelResponse, FuelStation, FuelType } from "../shared";
import { type City, fuelTypes } from "../shared";

export const sourceUrl = "https://eforms.eservices.cyprus.gov.cy/MCIT/MCIT/PetroleumPrices";

export function parseFuelResponse(html: string, fuel: FuelType, city: City, fetchedAt = new Date()): FuelResponse {
  return {
    fuel,
    fuelName: fuelTypes[fuel],
    city,
    sourceUrl,
    fetchedAt: fetchedAt.toISOString(),
    ...parsePrices(html),
    stations: parseStations(html),
  };
}

export function parsePrices(html: string): Pick<FuelResponse, "avgPrice" | "minPrice" | "maxPrice"> {
  const values = [...html.matchAll(/displayLabelValue">\s*([0-9.]+)\s*<\/label>/g)].map((m) => Number(m[1]));
  return {
    avgPrice: Number.isFinite(values[0]) ? values[0]! : null,
    minPrice: Number.isFinite(values[1]) ? values[1]! : null,
    maxPrice: Number.isFinite(values[2]) ? values[2]! : null,
  };
}

export function parseStations(html: string): FuelStation[] {
  const tableMatch = html.match(/<table[^>]+id="petroleumPriceDetailsFootable"[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/i);
  if (!tableMatch?.[1]) return [];

  return [...tableMatch[1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)]
    .map((rowMatch) => parseStationRow(rowMatch[1] ?? ""))
    .filter((station): station is FuelStation => station !== null);
}

function parseStationRow(rowHtml: string): FuelStation | null {
  const cells = [...rowHtml.matchAll(/<td([^>]*)>([\s\S]*?)<\/td>/g)];
  if (cells.length < 5) return null;

  const addressHtml = cells[2]?.[2] ?? "";
  const coordinates = extractCoordinates(addressHtml);
  const brand = cellText(cells[0]?.[2] ?? "");
  const name = cellText(cells[1]?.[2] ?? "");
  const address = cellText(addressHtml);
  const district = cellText(cells[3]?.[2] ?? "");
  const price = Number(cellText(cells[4]?.[2] ?? ""));

  if (!brand || !name || !Number.isFinite(price)) return null;

  return {
    id: stationId(brand, name, address, district),
    brand,
    name,
    address,
    district,
    price,
    isOffline: cells.some((cell) => (cell[1] ?? "").includes("isOffLine")),
    lat: coordinates?.lat ?? null,
    lng: coordinates?.lng ?? null,
  };
}

function stationId(...parts: string[]): string {
  return createHash("sha1").update(parts.join("\u001f")).digest("hex").slice(0, 16);
}

function cellText(html: string): string {
  return htmlDecode(stripTags(html)).replace(/\s+/g, " ").trim();
}

function stripTags(html: string): string {
  return html.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " ");
}

export function extractCoordinates(html: string): { lat: number; lng: number } | null {
  const hrefMatch = html.match(/DisplayMap\?coordinates=([^"]+)/i);
  if (!hrefMatch?.[1]) return null;

  const decoded = decodeURIComponent(htmlDecode(hrefMatch[1])).trim();
  const decimalMatch = decoded.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (decimalMatch?.[1] && decimalMatch[2]) {
    return validCyprusCoordinates(Number(decimalMatch[1]), Number(decimalMatch[2]));
  }

  const dmsMatch = decoded.match(/(\d+)°(\d+)'([\d.]+)"([NS])\s+(\d+)°(\d+)'([\d.]+)"([EW])/i);
  if (dmsMatch) {
    return validCyprusCoordinates(
      dmsToDecimal(Number(dmsMatch[1]), Number(dmsMatch[2]), Number(dmsMatch[3]), dmsMatch[4]!),
      dmsToDecimal(Number(dmsMatch[5]), Number(dmsMatch[6]), Number(dmsMatch[7]), dmsMatch[8]!),
    );
  }

  return null;
}

function validCyprusCoordinates(lat: number, lng: number): { lat: number; lng: number } | null {
  if (lat < 34.4 || lat > 35.8 || lng < 32 || lng > 34.7) return null;
  return { lat, lng };
}

function dmsToDecimal(degrees: number, minutes: number, seconds: number, hemisphere: string): number {
  const sign = /[SW]/i.test(hemisphere) ? -1 : 1;
  return sign * (degrees + minutes / 60 + seconds / 3600);
}

function htmlDecode(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}
