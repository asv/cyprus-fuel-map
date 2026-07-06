import { fetchStations } from "./client-api";
import { fetchGlobalHistory, fetchStationPriceHistory } from "./client-history-api";
import { createFuelMap } from "./client-map";
import { createBottomSheetController } from "./client-sheet";
import { renderMarketTrend } from "./client-trends";
import { byId, distanceKm, escapeHtml, formatPrice, formatTime, type LatLng, query, routeUrls } from "./client-utils";
import { buildStationStepSeries, priceDeltaOverDays, priceVsLatestMarketMedian } from "./history-series";
import type { FuelResponse, FuelStation, FuelType, GlobalFuelHistory, StationFuelPriceHistory } from "./shared";
import { initTheme } from "./theme";

type StationSortMode = "price" | "best" | "distance";

const GEOLOCATION_ENABLED_KEY = "cyprusFuelMap.geolocationEnabled";

let lastUserLocation: LatLng | null = null;
let currentStations: FuelStation[] = [];
let visibleStations: FuelStation[] = [];
let lastFuelData: FuelResponse | null = null;
let loadController: AbortController | null = null;
let hasFittedInitialBounds = false;
let hasTriedAutoLocate = false;
let stationSortMode: StationSortMode = "price";
let stationInsights = new Map<string, string>();

const fuelSelect = byId<HTMLSelectElement>("fuel");
const refreshButton = byId<HTMLButtonElement>("refresh");
const trendButton = byId<HTMLButtonElement>("trends");
const locateButton = byId<HTMLButtonElement>("locate");
const priceLimitInput = byId<HTMLInputElement>("price-limit");
const priceLimitLabel = byId<HTMLElement>("price-limit-label");
const statusEl = byId<HTMLElement>("status");
const summaryEl = byId<HTMLElement>("summary");
const stationListEl = byId<HTMLElement>("station-list");
const marketTrendsEl = byId<HTMLElement>("market-trends");
const marketTrendEl = byId<HTMLElement>("market-trend");
const sortCheapestButton = byId<HTMLButtonElement>("sort-cheapest");
const sortBestButton = byId<HTMLButtonElement>("sort-best");
const sortNearbyButton = byId<HTMLButtonElement>("sort-nearby");
const topbarEl = query<HTMLElement>(".topbar");
const sheetDragRegionEl = query<HTMLElement>(".sheet-drag-region");
const sheetHandleButton = byId<HTMLButtonElement>("sheet-handle");

const fuelMap = createFuelMap({ popupHtml });
const bottomSheet = createBottomSheetController({
  bottomSheetEl: query<HTMLElement>(".bottom-sheet"),
  sheetDragRegionEl,
  sheetHandleButton,
  invalidateMap: () => fuelMap.invalidateSize(),
  updateMarkerPriceLabels: () => fuelMap.updatePriceLabels(),
  panMapBy: (point) => fuelMap.panBy(point),
});
const themeRuntime = initTheme({ onViewportChange: () => fuelMap.invalidateSize() });

fuelSelect.addEventListener("change", loadStations);
refreshButton.addEventListener("click", loadStations);
trendButton.addEventListener("click", toggleMarketTrends);
locateButton.addEventListener("click", () => locateUser({ rememberPreference: true }));
priceLimitInput.addEventListener("input", applyPriceFilter);
sortCheapestButton.addEventListener("click", () => setStationSortMode("price"));
sortBestButton.addEventListener("click", () => setStationSortMode("best"));
sortNearbyButton.addEventListener("click", () => setStationSortMode("distance"));
window.addEventListener("resize", handleViewportChange);
fuelMap.onViewportChanged(() => fuelMap.updatePriceLabels());

void loadStations();

function handleViewportChange(): void {
  themeRuntime.refreshViewport();
  fuelMap.invalidateSize();
}

function toggleMarketTrends(): void {
  setMarketTrendsVisible(marketTrendsEl.hidden === true);
}

function setMarketTrendsVisible(visible: boolean): void {
  marketTrendsEl.hidden = !visible;
  trendButton.classList.toggle("is-active", visible);
  trendButton.setAttribute("aria-pressed", String(visible));
  trendButton.textContent = visible ? "Hide" : "Trends";
  trendButton.setAttribute("aria-label", visible ? "Hide market trends" : "Show market trends");
  trendButton.title = visible ? "Hide market trends" : "Show market trends";
  if (visible) bottomSheet.setState("expanded");
}

async function loadStations(): Promise<void> {
  loadController?.abort();
  loadController = new AbortController();

  setStatus("Loading prices...");
  refreshButton.disabled = true;
  fuelMap.setStations([]);
  stationListEl.innerHTML = "";
  hasFittedInitialBounds = false;

  try {
    const data = await fetchStations(fuelSelect.value, loadController.signal);
    lastFuelData = data;
    currentStations = data.stations.filter((station) => station.lat !== null && station.lng !== null);
    resetPriceFilter();
    fuelMap.setStations(currentStations);
    stationInsights = new Map();
    applyPriceFilter();
    loadHistoryInsights(data.fuel);
    setStatus(`${data.stale ? "Stale cache" : "Updated"} ${formatTime(data.fetchedAt)}`);
    maybeAutoLocateUser();
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;
    console.error(error);
    setStatus(error instanceof Error ? error.message : "Failed to load stations");
  } finally {
    refreshButton.disabled = false;
  }
}

function loadHistoryInsights(fuel: FuelType): void {
  marketTrendEl.innerHTML = '<p class="trend-empty">Loading trend...</p>';
  Promise.all([
    fetchGlobalHistory(fuel, loadController?.signal),
    fetchStationPriceHistory(fuel, loadController?.signal),
  ])
    .then(([globalHistory, stationHistory]) => {
      renderMarketTrend(marketTrendEl, globalHistory);
      updateStationInsights(globalHistory, stationHistory);
    })
    .catch((error) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.warn("Failed to load history insights:", error);
      marketTrendEl.innerHTML = '<p class="trend-empty">Trend unavailable.</p>';
    });
}

function updateStationInsights(
  globalHistory: GlobalFuelHistory | null,
  stationHistory: StationFuelPriceHistory | null,
): void {
  if (!globalHistory || !stationHistory) return;

  const next = new Map<string, string>();
  for (const station of currentStations) {
    const series = buildStationStepSeries(stationHistory, `station_${station.id}`);
    const delta7d = priceDeltaOverDays(series, new Date(lastFuelData?.fetchedAt ?? Date.now()), 7);
    const vsMarket = priceVsLatestMarketMedian(station.price, globalHistory);
    const insight = formatStationInsight(delta7d, vsMarket);
    if (insight) next.set(station.id, insight);
  }

  stationInsights = next;
  renderStationList();
}

function formatStationInsight(delta7d: number | null, vsMarket: number | null): string {
  const parts: string[] = [];
  if (delta7d !== null && Math.abs(delta7d) >= 0.0005) parts.push(`7d ${formatSignedPrice(delta7d)}`);
  if (vsMarket !== null) parts.push(`${formatSignedPrice(vsMarket)} vs market`);
  return parts.join(" · ");
}

function formatSignedPrice(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "±";
  return `${sign}€${Math.abs(value).toFixed(3)}`;
}

function applyPriceFilter(): void {
  const maxPrice = Number(priceLimitInput.value);
  priceLimitLabel.textContent = `€${maxPrice.toFixed(3)} / l`;
  visibleStations = currentStations.filter((station) => station.price <= maxPrice);

  fuelMap.applyVisibleStations(visibleStations);
  fuelMap.updatePriceLabels();
  updateSummary();
  renderStationList();

  if (!hasFittedInitialBounds && currentStations.length > 0) {
    fuelMap.fitStationBounds(currentStations, { topbarEl, bottomSheetEl: bottomSheet.element });
    bottomSheet.panAboveSheet();
    hasFittedInitialBounds = true;
  }
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

function renderStationList(): void {
  const sorted = [...visibleStations].sort(compareStations);

  stationListEl.innerHTML = sorted
    .slice(0, 30)
    .map((station) => {
      const distance = lastUserLocation ? `${distanceKm(station, lastUserLocation).toFixed(1)} km` : "";
      const routes = routeUrls(station);
      const insight = stationInsights.get(station.id);
      return `
      <article class="station">
        <button class="station-main" type="button" data-lat="${station.lat}" data-lng="${station.lng}">
          <span class="station-copy">
            <span class="station-title">${escapeHtml(station.brand)} · ${escapeHtml(station.name)}</span>
            <span class="station-meta">${escapeHtml(station.district)}${distance ? ` · ${distance}` : ""}</span>
          </span>
          <span class="station-price-stack">
            <strong class="station-price">€${station.price.toFixed(3)}</strong>
            ${insight ? `<span class="station-insight">${escapeHtml(insight)}</span>` : ""}
          </span>
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
      fuelMap.setView([Number(button.dataset.lat), Number(button.dataset.lng)], 15);
      bottomSheet.panAboveSheet();
    });
  });
}

function compareStations(a: FuelStation, b: FuelStation): number {
  if (stationSortMode === "distance" && lastUserLocation) {
    const distanceDiff = distanceKm(a, lastUserLocation) - distanceKm(b, lastUserLocation);
    if (distanceDiff !== 0) return distanceDiff;
    return a.price - b.price;
  }

  if (stationSortMode === "best" && lastUserLocation) {
    const scoreDiff = bestNearbyScore(a) - bestNearbyScore(b);
    if (scoreDiff !== 0) return scoreDiff;
    return a.price - b.price;
  }

  const priceDiff = a.price - b.price;
  if (priceDiff !== 0) return priceDiff;
  if (lastUserLocation) return distanceKm(a, lastUserLocation) - distanceKm(b, lastUserLocation);
  return a.name.localeCompare(b.name);
}

function bestNearbyScore(station: FuelStation): number {
  if (!lastFuelData || !lastUserLocation) return station.price;

  const minPrice = lastFuelData.minPrice ?? station.price;
  const maxPrice = lastFuelData.maxPrice ?? station.price;
  const priceRange = Math.max(maxPrice - minPrice, 0.001);
  const priceScore = (station.price - minPrice) / priceRange;
  const distanceScore = Math.min(distanceKm(station, lastUserLocation), 10) / 10;
  return priceScore * 0.68 + distanceScore * 0.32;
}

function setStationSortMode(mode: StationSortMode): void {
  if ((mode === "distance" || mode === "best") && !lastUserLocation) {
    stationSortMode = mode;
    updateSortControls();
    locateUser({ rememberPreference: true, sortModeOnError: "price" });
    return;
  }

  stationSortMode = mode;
  updateSortControls();
  renderStationList();
}

function updateSortControls(): void {
  const isPriceSort = stationSortMode === "price";
  const isBestSort = stationSortMode === "best";
  const isDistanceSort = stationSortMode === "distance";
  sortCheapestButton.classList.toggle("is-active", isPriceSort);
  sortBestButton.classList.toggle("is-active", isBestSort);
  sortNearbyButton.classList.toggle("is-active", isDistanceSort);
  sortCheapestButton.setAttribute("aria-pressed", String(isPriceSort));
  sortBestButton.setAttribute("aria-pressed", String(isBestSort));
  sortNearbyButton.setAttribute("aria-pressed", String(isDistanceSort));
}

function locationFoundStatus(): string {
  if (stationSortMode === "distance") return "Location found. Nearby first.";
  if (stationSortMode === "best") return "Location found. Best nearby first.";
  return "Location found. Cheapest first.";
}

function maybeAutoLocateUser(): void {
  if (hasTriedAutoLocate || !isGeolocationRemembered()) return;
  hasTriedAutoLocate = true;
  locateUser({ automatic: true, rememberPreference: true });
}

function locateUser(
  options: { automatic?: boolean; rememberPreference?: boolean; sortModeOnError?: StationSortMode } = {},
): void {
  hasTriedAutoLocate = true;

  if (!navigator.geolocation) {
    if (options.rememberPreference) setGeolocationRemembered(false);
    setStatus("Geolocation is not supported by this browser.");
    return;
  }

  setStatus(options.automatic ? "Finding your location..." : "Requesting location...");
  navigator.geolocation.getCurrentPosition(
    (position) => {
      if (options.rememberPreference) setGeolocationRemembered(true);
      lastUserLocation = { lat: position.coords.latitude, lng: position.coords.longitude };
      fuelMap.addUserMarker([lastUserLocation.lat, lastUserLocation.lng]);
      fuelMap.setView([lastUserLocation.lat, lastUserLocation.lng], 13);
      renderStationList();
      setStatus(locationFoundStatus());
    },
    (error) => {
      if (options.rememberPreference && error.code === error.PERMISSION_DENIED) {
        setGeolocationRemembered(false);
      }
      if (options.sortModeOnError) {
        stationSortMode = options.sortModeOnError;
        updateSortControls();
        renderStationList();
      }
      setStatus(options.automatic ? "Location unavailable. Tap locate to retry." : `Location error: ${error.message}`);
    },
    { enableHighAccuracy: true, timeout: 10000 },
  );
}

function isGeolocationRemembered(): boolean {
  try {
    return localStorage.getItem(GEOLOCATION_ENABLED_KEY) === "true";
  } catch {
    return false;
  }
}

function setGeolocationRemembered(enabled: boolean): void {
  try {
    if (enabled) {
      localStorage.setItem(GEOLOCATION_ENABLED_KEY, "true");
    } else {
      localStorage.removeItem(GEOLOCATION_ENABLED_KEY);
    }
  } catch {
    // Storage can be unavailable in restricted webviews; geolocation still works for the current session.
  }
}

function popupHtml(station: FuelStation): string {
  const routes = routeUrls(station);
  const insight = stationInsights.get(station.id);
  return `
    <strong>${escapeHtml(station.brand)}</strong><br>
    ${escapeHtml(station.name)}<br>
    ${escapeHtml(station.address)}<br>
    ${escapeHtml(station.district)}<br>
    <strong>€${station.price.toFixed(3)}</strong> / l
    ${insight ? `<br><span class="popup-insight">${escapeHtml(insight)}</span>` : ""}
    <br><a href="${routes.google}" target="_blank" rel="noopener noreferrer">Google Maps</a>
    · <a href="${routes.waze}" target="_blank" rel="noopener noreferrer">Waze</a>
    ${station.isOffline ? '<br><span class="offline">offline price may differ</span>' : ""}
  `;
}

function setStatus(message: string): void {
  statusEl.textContent = message;
  refreshButton.title = `Refresh prices. ${message}`;
  refreshButton.setAttribute("aria-label", `Refresh prices. ${message}`);
}
