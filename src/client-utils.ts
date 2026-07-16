import type { FuelStation } from "./shared";

export type LatLng = { lat: number; lng: number };

export function routeUrls(station: FuelStation): { waze: string } {
  const lat = station.lat ?? 0;
  const lng = station.lng ?? 0;
  return {
    waze: `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`,
  };
}

export function priceColor(price: number, min: number, max: number): string {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return "#2b8a3e";
  const ratio = (price - min) / (max - min);
  if (ratio < 0.33) return "#2b8a3e";
  if (ratio < 0.66) return "#f08c00";
  return "#c92a2a";
}

export function distanceKm(station: FuelStation, point: LatLng): number {
  const lat = station.lat ?? 0;
  const lng = station.lng ?? 0;
  const r = 6371;
  const dLat = toRad(point.lat - lat);
  const dLng = toRad(point.lng - lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat)) * Math.cos(toRad(point.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatPrice(value: number | null): string {
  return value === null ? "n/a" : `€${value.toFixed(3)}`;
}

export function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]!);
}

export function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Element #${id} not found`);
  return element as T;
}

export function query<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector(selector);
  if (!element) throw new Error(`Element ${selector} not found`);
  return element as T;
}

function toRad(value: number): number {
  return (value * Math.PI) / 180;
}
