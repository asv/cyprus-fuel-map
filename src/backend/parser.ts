import { createHash } from "node:crypto";
import { type HTMLElement, parse } from "node-html-parser";
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
  // The upstream page renders avg/min/max summary prices as the first three
  // labels carrying the displayLabelValue class, before the station table.
  const values = parse(html)
    .querySelectorAll(".displayLabelValue")
    .map((label) => Number(label.text));
  return {
    avgPrice: Number.isFinite(values[0]) ? values[0]! : null,
    minPrice: Number.isFinite(values[1]) ? values[1]! : null,
    maxPrice: Number.isFinite(values[2]) ? values[2]! : null,
  };
}

export function parseStations(html: string): FuelStation[] {
  return parse(html)
    .querySelectorAll("#petroleumPriceDetailsFootable tbody tr")
    .map(parseStationRow)
    .filter((station): station is FuelStation => station !== null);
}

function parseStationRow(row: HTMLElement): FuelStation | null {
  const cells = row.querySelectorAll("td");
  if (cells.length < 5) return null;

  const addressCell = cells[2]!;
  const coordinates = extractCoordinates(addressCell.innerHTML);
  const brand = cellText(cells[0]!);
  const name = cellText(cells[1]!);
  const address = cellText(addressCell);
  const district = cellText(cells[3]!);
  const price = Number(cellText(cells[4]!));

  if (!brand || !name || !Number.isFinite(price)) return null;

  return {
    id: stationId(brand, name, address, district),
    brand,
    name,
    address,
    district,
    price,
    isOffline: row.querySelectorAll("td.isOffLine").length > 0,
    lat: coordinates?.lat ?? null,
    lng: coordinates?.lng ?? null,
  };
}

function stationId(...parts: string[]): string {
  return createHash("sha1").update(parts.join("\u001f")).digest("hex").slice(0, 16);
}

function cellText(cell: HTMLElement): string {
  return cell.text.replace(/\s+/g, " ").trim();
}

export function extractCoordinates(html: string): { lat: number; lng: number } | null {
  const link = parse(html).querySelector("a[href*='coordinates=']");
  const coordinatesParam = link?.getAttribute("href")?.match(/coordinates=([^&]+)/i)?.[1];
  if (!coordinatesParam) return null;

  const decoded = decodeURIComponent(coordinatesParam).trim();
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
