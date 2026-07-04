import type { FuelResponse, FuelStation } from "./shared";

declare const L: any;

type StationMarker = {
  station: FuelStation;
  marker: any;
  visible: boolean;
};

const map = L.map("map").setView([35.05, 33.22], 9);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

const markers = L.layerGroup().addTo(map);
const stationMarkers: StationMarker[] = [];
const minZoomForPriceLabels = 11;
let userMarker: any = null;
let lastUserLocation: { lat: number; lng: number } | null = null;
let currentStations: FuelStation[] = [];
let visibleStations: FuelStation[] = [];
let lastFuelData: FuelResponse | null = null;
let loadController: AbortController | null = null;
let hasFittedInitialBounds = false;

const fuelSelect = byId<HTMLSelectElement>("fuel");
const refreshButton = byId<HTMLButtonElement>("refresh");
const locateButton = byId<HTMLButtonElement>("locate");
const priceLimitInput = byId<HTMLInputElement>("price-limit");
const priceLimitLabel = byId<HTMLElement>("price-limit-label");
const showPricesCheckbox = byId<HTMLInputElement>("show-prices");
const statusEl = byId<HTMLElement>("status");
const summaryEl = byId<HTMLElement>("summary");
const stationListEl = byId<HTMLElement>("station-list");

fuelSelect.addEventListener("change", loadStations);
refreshButton.addEventListener("click", loadStations);
locateButton.addEventListener("click", locateUser);
priceLimitInput.addEventListener("input", applyPriceFilter);
showPricesCheckbox.addEventListener("change", updatePriceLabels);
map.on("zoomend", updatePriceLabels);

void loadStations();

async function loadStations(): Promise<void> {
  loadController?.abort();
  loadController = new AbortController();

  setStatus("Loading Cyprus fuel prices…");
  refreshButton.disabled = true;
  clearStationMarkers();
  stationListEl.innerHTML = "";
  hasFittedInitialBounds = false;

  try {
    const data = await fetchStations(fuelSelect.value, loadController.signal);
    lastFuelData = data;
    currentStations = data.stations.filter((station) => station.lat !== null && station.lng !== null);
    resetPriceFilter();
    createStationMarkers();
    applyPriceFilter();
    setStatus(
      `Loaded ${currentStations.length} mapped stations. Updated ${new Date(data.fetchedAt).toLocaleString()}${data.stale ? " (stale cache)" : ""}.`,
    );
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;
    console.error(error);
    setStatus(error instanceof Error ? error.message : "Failed to load stations");
  } finally {
    refreshButton.disabled = false;
  }
}

async function fetchStations(fuel: string, signal: AbortSignal): Promise<FuelResponse> {
  const staticResponse = await fetch(`data/stations-${encodeURIComponent(fuel)}.json`, {
    signal,
    cache: "no-cache",
  });
  if (staticResponse.ok) return (await staticResponse.json()) as FuelResponse;

  if (!canUseBackendFallback()) {
    throw new Error(`Static fuel data not found for fuel type ${fuel}`);
  }

  const apiResponse = await fetch(`api/stations?fuel=${encodeURIComponent(fuel)}`, { signal });
  if (!apiResponse.ok) throw new Error(await apiResponse.text());
  return (await apiResponse.json()) as FuelResponse;
}

function canUseBackendFallback(): boolean {
  return ["localhost", "127.0.0.1", ""].includes(window.location.hostname);
}

function applyPriceFilter(): void {
  const maxPrice = Number(priceLimitInput.value);
  priceLimitLabel.textContent = `€${maxPrice.toFixed(3)} / l`;
  visibleStations = currentStations.filter((station) => station.price <= maxPrice);

  const visibleSet = new Set(visibleStations);
  for (const entry of stationMarkers) {
    const shouldBeVisible = visibleSet.has(entry.station);
    if (shouldBeVisible && !entry.visible) {
      entry.marker.addTo(markers);
      entry.visible = true;
    } else if (!shouldBeVisible && entry.visible) {
      entry.marker.remove();
      entry.visible = false;
    }
  }

  updateSummary();
  updatePriceLabels();
  renderStationList();
}

function resetPriceFilter(): void {
  const prices = currentStations.map((station) => station.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);

  priceLimitInput.disabled = prices.length === 0;
  priceLimitInput.min = Number.isFinite(min) ? min.toFixed(3) : "0";
  priceLimitInput.max = Number.isFinite(max) ? max.toFixed(3) : "1";
  priceLimitInput.value = Number.isFinite(max) ? max.toFixed(3) : "1";
  priceLimitLabel.textContent = prices.length === 0 ? "all" : `€${Number(priceLimitInput.value).toFixed(3)} / l`;
}

function createStationMarkers(): void {
  clearStationMarkers();

  const prices = currentStations.map((station) => station.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);

  for (const station of currentStations) {
    const color = priceColor(station.price, min, max);
    const marker = L.circleMarker([station.lat, station.lng], {
      radius: 7,
      color,
      fillColor: color,
      fillOpacity: 0.8,
      weight: 1,
    });
    marker.bindPopup(popupHtml(station));
    marker.bindTooltip(`€${station.price.toFixed(3)}`, {
      className: "price-label",
      direction: "top",
      offset: [0, -8],
      opacity: 1,
    });
    stationMarkers.push({ station, marker, visible: false });
  }

  updateSummary();

  if (!hasFittedInitialBounds && currentStations.length > 0) {
    const bounds = L.latLngBounds(currentStations.map((station) => [station.lat, station.lng]));
    map.fitBounds(bounds.pad(0.08));
    hasFittedInitialBounds = true;
  }
}

function clearStationMarkers(): void {
  markers.clearLayers();
  stationMarkers.length = 0;
}

function updateSummary(): void {
  if (!lastFuelData) return;
  const unmapped = lastFuelData.stations.length - currentStations.length;
  summaryEl.innerHTML = `
    <div><strong>${escapeHtml(lastFuelData.fuelName)}</strong>${lastFuelData.stale ? " · stale cache" : ""}</div>
    <div>Average: <strong>${formatPrice(lastFuelData.avgPrice)}</strong></div>
    <div>Cheapest: <strong>${formatPrice(lastFuelData.minPrice)}</strong></div>
    <div>Most expensive: <strong>${formatPrice(lastFuelData.maxPrice)}</strong></div>
    <div>Total stations: <strong>${lastFuelData.stations.length}</strong></div>
    <div>Mapped stations: <strong>${currentStations.length}</strong>${unmapped > 0 ? ` (${unmapped} without coordinates)` : ""}</div>
    <div>Shown by price filter: <strong>${visibleStations.length}</strong></div>
  `;
}

function updatePriceLabels(): void {
  const shouldShow = showPricesCheckbox.checked && map.getZoom() >= minZoomForPriceLabels;
  for (const { marker, visible } of stationMarkers) {
    if (!visible) continue;
    if (shouldShow) marker.openTooltip();
    else marker.closeTooltip();
  }
}

function renderStationList(): void {
  const sorted = [...visibleStations].sort((a, b) => {
    if (lastUserLocation) return distanceKm(a, lastUserLocation) - distanceKm(b, lastUserLocation);
    return a.price - b.price;
  });

  stationListEl.innerHTML = sorted
    .slice(0, 30)
    .map((station) => {
      const distance = lastUserLocation ? ` · ${distanceKm(station, lastUserLocation).toFixed(1)} km` : "";
      return `
      <button class="station" data-lat="${station.lat}" data-lng="${station.lng}">
        <span class="station-title">${escapeHtml(station.brand)} · ${escapeHtml(station.name)}</span>
        <span>${escapeHtml(station.district)} · <strong>€${station.price.toFixed(3)}</strong>${distance}</span>
      </button>
    `;
    })
    .join("");

  stationListEl.querySelectorAll<HTMLButtonElement>(".station").forEach((button) => {
    button.addEventListener("click", () => {
      map.setView([Number(button.dataset.lat), Number(button.dataset.lng)], 15);
    });
  });
}

function locateUser(): void {
  if (!navigator.geolocation) {
    setStatus("Geolocation is not supported by this browser.");
    return;
  }

  setStatus("Requesting location…");
  navigator.geolocation.getCurrentPosition(
    (position) => {
      lastUserLocation = { lat: position.coords.latitude, lng: position.coords.longitude };
      if (userMarker) userMarker.remove();
      userMarker = L.marker([lastUserLocation.lat, lastUserLocation.lng]).addTo(map).bindPopup("You are here");
      map.setView([lastUserLocation.lat, lastUserLocation.lng], 13);
      renderStationList();
      setStatus("Location found. List is sorted by distance.");
    },
    (error) => setStatus(`Location error: ${error.message}`),
    { enableHighAccuracy: true, timeout: 10000 },
  );
}

function popupHtml(station: FuelStation): string {
  return `
    <strong>${escapeHtml(station.brand)}</strong><br>
    ${escapeHtml(station.name)}<br>
    ${escapeHtml(station.address)}<br>
    ${escapeHtml(station.district)}<br>
    <strong>€${station.price.toFixed(3)}</strong> / l
    ${station.isOffline ? '<br><span class="offline">offline price may differ</span>' : ""}
  `;
}

function priceColor(price: number, min: number, max: number): string {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return "#2b8a3e";
  const ratio = (price - min) / (max - min);
  if (ratio < 0.33) return "#2b8a3e";
  if (ratio < 0.66) return "#f08c00";
  return "#c92a2a";
}

function distanceKm(station: FuelStation, point: { lat: number; lng: number }): number {
  const lat = station.lat ?? 0;
  const lng = station.lng ?? 0;
  const r = 6371;
  const dLat = toRad(point.lat - lat);
  const dLng = toRad(point.lng - lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat)) * Math.cos(toRad(point.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(value: number): number {
  return (value * Math.PI) / 180;
}

function formatPrice(value: number | null): string {
  return value === null ? "n/a" : `€${value.toFixed(3)} / l`;
}

function setStatus(message: string): void {
  statusEl.textContent = message;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]!);
}

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Element #${id} not found`);
  return element as T;
}
