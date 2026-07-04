import type { FuelResponse, FuelStation } from "./shared";

declare const L: any;

type TelegramThemeParams = {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
  section_bg_color?: string;
};

type TelegramWebApp = {
  colorScheme?: "light" | "dark";
  themeParams?: TelegramThemeParams;
  viewportHeight?: number;
  stableViewportHeight?: number;
  ready?: () => void;
  expand?: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  disableVerticalSwipes?: () => void;
  onEvent?: (eventType: "themeChanged" | "viewportChanged", eventHandler: () => void) => void;
};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

type StationMarker = {
  station: FuelStation;
  marker: any;
  visible: boolean;
};

const PRICE_LABEL_MIN_ZOOM = 14;

const map = L.map("map", { zoomControl: false }).setView([35.05, 33.22], 9);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

const markers = L.layerGroup().addTo(map);
const stationMarkers: StationMarker[] = [];
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
const statusEl = byId<HTMLElement>("status");
const summaryEl = byId<HTMLElement>("summary");
const stationListEl = byId<HTMLElement>("station-list");
const topbarEl = query<HTMLElement>(".topbar");
const bottomSheetEl = query<HTMLElement>(".bottom-sheet");
const telegramWebApp = initTelegramWebApp();

fuelSelect.addEventListener("change", loadStations);
refreshButton.addEventListener("click", loadStations);
locateButton.addEventListener("click", locateUser);
priceLimitInput.addEventListener("input", applyPriceFilter);
window.addEventListener("resize", handleViewportChange);
map.on("zoomend moveend", updateMarkerPriceLabels);

void loadStations();

function initTelegramWebApp(): TelegramWebApp | null {
  const webApp = window.Telegram?.WebApp;
  if (!webApp) return null;

  safeTelegramCall("apply theme", () => applyTelegramTheme(webApp));
  safeTelegramCall("apply viewport", () => applyTelegramViewport(webApp));
  safeTelegramCall("expand", () => webApp.expand?.());
  safeTelegramCall("disable vertical swipes", () => webApp.disableVerticalSwipes?.());
  safeTelegramCall("ready", () => webApp.ready?.());
  safeTelegramCall("subscribe theme changes", () => {
    webApp.onEvent?.("themeChanged", () => {
      safeTelegramCall("handle theme change", () => applyTelegramTheme(webApp));
    });
  });
  safeTelegramCall("subscribe viewport changes", () => {
    webApp.onEvent?.("viewportChanged", () => {
      safeTelegramCall("handle viewport change", () => handleViewportChange());
    });
  });
  document.documentElement.dataset.telegram = "true";

  return webApp;
}

function safeTelegramCall(label: string, action: () => void): void {
  try {
    action();
  } catch (error) {
    console.warn(`Telegram WebApp ${label} failed:`, error);
  }
}

function applyTelegramTheme(webApp: TelegramWebApp): void {
  const theme = webApp.themeParams;
  if (!theme) return;

  setCssVar("--app-bg", theme.bg_color);
  setCssVar("--panel", theme.section_bg_color ?? theme.secondary_bg_color ?? theme.bg_color);
  setCssVar("--panel-strong", theme.secondary_bg_color);
  setCssVar("--text", theme.text_color);
  setCssVar("--muted", theme.hint_color);
  setCssVar("--accent", theme.button_color);
  setCssVar("--accent-text", theme.button_text_color);
  if (webApp.colorScheme) document.documentElement.style.colorScheme = webApp.colorScheme;

  safeTelegramCall("set background color", () => {
    if (theme.bg_color) webApp.setBackgroundColor?.(theme.bg_color);
  });
  safeTelegramCall("set header color", () => {
    const headerColor = theme.section_bg_color ? "secondary_bg_color" : "bg_color";
    webApp.setHeaderColor?.(headerColor);
  });
}

function applyTelegramViewport(webApp: TelegramWebApp): void {
  const height = webApp.stableViewportHeight ?? webApp.viewportHeight;
  if (height && Number.isFinite(height)) {
    document.documentElement.style.setProperty("--app-height", `${height}px`);
  }
}

function handleViewportChange(): void {
  if (telegramWebApp) applyTelegramViewport(telegramWebApp);
  map.invalidateSize();
}

function setCssVar(name: string, value: string | undefined): void {
  if (value) document.documentElement.style.setProperty(name, value);
}

async function loadStations(): Promise<void> {
  loadController?.abort();
  loadController = new AbortController();

  setStatus("Loading prices...");
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
    setStatus(`${data.stale ? "Stale cache" : "Updated"} ${formatTime(data.fetchedAt)}`);
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
      entry.marker.closeTooltip();
      entry.marker.remove();
      entry.visible = false;
    }
  }

  updateMarkerPriceLabels();
  updateSummary();
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
    marker.bindTooltip(formatPrice(station.price), {
      className: "price-tooltip",
      direction: "top",
      offset: [0, -8],
      opacity: 1,
      permanent: true,
    });
    stationMarkers.push({ station, marker, visible: false });
  }

  updateSummary();

  if (!hasFittedInitialBounds && currentStations.length > 0) {
    fitStationBounds(currentStations);
    hasFittedInitialBounds = true;
  }
}

function fitStationBounds(stations: FuelStation[]): void {
  const bounds = L.latLngBounds(stations.map((station) => [station.lat, station.lng]));
  const topbar = topbarEl.getBoundingClientRect();
  const bottomSheet = bottomSheetEl.getBoundingClientRect();

  map.fitBounds(bounds.pad(0.08), {
    animate: false,
    paddingTopLeft: [20, Math.ceil(topbar.bottom + 20)],
    paddingBottomRight: [20, Math.ceil(window.innerHeight - bottomSheet.top + 20)],
  });
  panAboveBottomSheet();
}

function clearStationMarkers(): void {
  markers.clearLayers();
  stationMarkers.length = 0;
}

function updateSummary(): void {
  if (!lastFuelData) return;
  summaryEl.innerHTML = `
    <div class="metric">
      <strong class="metric-value">${formatPrice(lastFuelData.avgPrice)}</strong>
      <span class="metric-label">avg</span>
    </div>
    <div class="metric">
      <strong class="metric-value">${formatPrice(lastFuelData.minPrice)}</strong>
      <span class="metric-label">low</span>
    </div>
  `;
}

function updateMarkerPriceLabels(): void {
  const showLabels = map.getZoom() >= PRICE_LABEL_MIN_ZOOM;
  const bounds = map.getBounds();

  for (const entry of stationMarkers) {
    if (!entry.visible || !showLabels || !bounds.contains(entry.marker.getLatLng())) {
      entry.marker.closeTooltip();
      continue;
    }
    entry.marker.openTooltip();
  }
}

function renderStationList(): void {
  const sorted = [...visibleStations].sort((a, b) => {
    const priceDiff = a.price - b.price;
    if (priceDiff !== 0) return priceDiff;
    if (lastUserLocation) return distanceKm(a, lastUserLocation) - distanceKm(b, lastUserLocation);
    return a.name.localeCompare(b.name);
  });

  stationListEl.innerHTML = sorted
    .slice(0, 30)
    .map((station) => {
      const distance = lastUserLocation ? `${distanceKm(station, lastUserLocation).toFixed(1)} km` : "";
      const routes = routeUrls(station);
      return `
      <article class="station">
        <button class="station-main" type="button" data-lat="${station.lat}" data-lng="${station.lng}">
          <span class="station-copy">
            <span class="station-title">${escapeHtml(station.brand)} · ${escapeHtml(station.name)}</span>
            <span class="station-meta">${escapeHtml(station.district)}${distance ? ` · ${distance}` : ""}</span>
          </span>
          <strong class="station-price">€${station.price.toFixed(3)}</strong>
        </button>
        <nav class="station-routes" aria-label="Route to ${escapeHtml(station.brand)} ${escapeHtml(station.name)}">
          <a class="route-link" href="${routes.google}" target="_blank" rel="noopener noreferrer" aria-label="Open Google Maps route">Google</a>
          <a class="route-link" href="${routes.waze}" target="_blank" rel="noopener noreferrer" aria-label="Open Waze route">Waze</a>
        </nav>
      </article>
    `;
    })
    .join("");

  stationListEl.querySelectorAll<HTMLButtonElement>(".station-main").forEach((button) => {
    button.addEventListener("click", () => {
      map.setView([Number(button.dataset.lat), Number(button.dataset.lng)], 15);
      panAboveBottomSheet();
    });
  });
}

function panAboveBottomSheet(): void {
  map.panBy([0, Math.round(bottomSheetEl.getBoundingClientRect().height / 5)], {
    animate: false,
  });
}

function locateUser(): void {
  if (!navigator.geolocation) {
    setStatus("Geolocation is not supported by this browser.");
    return;
  }

  setStatus("Requesting location...");
  navigator.geolocation.getCurrentPosition(
    (position) => {
      lastUserLocation = { lat: position.coords.latitude, lng: position.coords.longitude };
      if (userMarker) userMarker.remove();
      userMarker = L.marker([lastUserLocation.lat, lastUserLocation.lng]).addTo(map).bindPopup("You are here");
      map.setView([lastUserLocation.lat, lastUserLocation.lng], 13);
      renderStationList();
      setStatus("Location found. Cheapest first, distance shown.");
    },
    (error) => setStatus(`Location error: ${error.message}`),
    { enableHighAccuracy: true, timeout: 10000 },
  );
}

function popupHtml(station: FuelStation): string {
  const routes = routeUrls(station);
  return `
    <strong>${escapeHtml(station.brand)}</strong><br>
    ${escapeHtml(station.name)}<br>
    ${escapeHtml(station.address)}<br>
    ${escapeHtml(station.district)}<br>
    <strong>€${station.price.toFixed(3)}</strong> / l
    <br><a href="${routes.google}" target="_blank" rel="noopener noreferrer">Google Maps</a>
    · <a href="${routes.waze}" target="_blank" rel="noopener noreferrer">Waze</a>
    ${station.isOffline ? '<br><span class="offline">offline price may differ</span>' : ""}
  `;
}

function routeUrls(station: FuelStation): { google: string; waze: string } {
  const lat = station.lat ?? 0;
  const lng = station.lng ?? 0;
  return {
    google: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`,
    waze: `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`,
  };
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
  return value === null ? "n/a" : `€${value.toFixed(3)}`;
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function setStatus(message: string): void {
  statusEl.textContent = message;
  refreshButton.title = `Refresh prices. ${message}`;
  refreshButton.setAttribute("aria-label", `Refresh prices. ${message}`);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]!);
}

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Element #${id} not found`);
  return element as T;
}

function query<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector(selector);
  if (!element) throw new Error(`Element ${selector} not found`);
  return element as T;
}
