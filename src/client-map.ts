import { formatPrice, priceColor } from "./client-utils";
import type { FuelStation } from "./shared";

declare const L: any;

type StationMarker = {
  station: FuelStation;
  marker: any;
  visible: boolean;
};

type FuelMap = {
  map: any;
  setStations(stations: FuelStation[]): void;
  applyVisibleStations(stations: FuelStation[]): void;
  updatePriceLabels(): void;
  fitStationBounds(stations: FuelStation[], layout: { topbarEl: HTMLElement; bottomSheetEl: HTMLElement }): void;
  setView(latLng: [number, number], zoom: number): void;
  addUserMarker(latLng: [number, number]): void;
  panBy(point: [number, number]): void;
  invalidateSize(): void;
  onViewportChanged(handler: () => void): void;
};

const PRICE_LABEL_MIN_ZOOM = 13;
const COMPACT_MARKER_MAX_ZOOM = 10;

export function createFuelMap(options: { popupHtml: (station: FuelStation) => string }): FuelMap {
  const map = L.map("map", { zoomControl: false }).setView([35.05, 33.22], 9);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  const markers = L.layerGroup().addTo(map);
  const stationMarkers: StationMarker[] = [];
  let userMarker: any = null;

  function setStations(stations: FuelStation[]): void {
    markers.clearLayers();
    stationMarkers.length = 0;

    const prices = stations.map((station) => station.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);

    for (const station of stations) {
      const color = priceColor(station.price, min, max);
      const marker = L.circleMarker([station.lat, station.lng], {
        radius: markerRadius(map.getZoom()),
        color,
        fillColor: color,
        fillOpacity: 0.82,
        weight: 1.4,
      });
      marker.bindPopup(() => options.popupHtml(station));
      marker.bindTooltip(formatPrice(station.price), {
        className: "price-tooltip",
        direction: "top",
        offset: [0, -8],
        opacity: 1,
        permanent: true,
      });
      stationMarkers.push({ station, marker, visible: false });
    }
  }

  function applyVisibleStations(stations: FuelStation[]): void {
    const visibleSet = new Set(stations);
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
  }

  function updatePriceLabels(): void {
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

  function updateMarkerScale(): void {
    const radius = markerRadius(map.getZoom());
    for (const entry of stationMarkers) entry.marker.setRadius(radius);
  }

  function fitStationBounds(
    stations: FuelStation[],
    layout: { topbarEl: HTMLElement; bottomSheetEl: HTMLElement },
  ): void {
    const bounds = L.latLngBounds(stations.map((station) => [station.lat, station.lng]));
    const topbar = layout.topbarEl.getBoundingClientRect();
    const bottomSheet = layout.bottomSheetEl.getBoundingClientRect();
    const isSidebarLayout =
      bottomSheet.height >= window.innerHeight * 0.9 && bottomSheet.width < window.innerWidth * 0.5;

    if (isSidebarLayout) {
      map.fitBounds(bounds.pad(0.06), {
        animate: false,
        paddingTopLeft: [32, 32],
        paddingBottomRight: [32, 32],
      });
      return;
    }

    map.fitBounds(bounds.pad(0.08), {
      animate: false,
      paddingTopLeft: [20, Math.ceil(topbar.bottom + 20)],
      paddingBottomRight: [20, Math.ceil(window.innerHeight - bottomSheet.top + 20)],
    });
  }

  function addUserMarker(latLng: [number, number]): void {
    if (userMarker) userMarker.remove();
    userMarker = L.marker(latLng).addTo(map).bindPopup("You are here");
  }

  return {
    map,
    setStations,
    applyVisibleStations,
    updatePriceLabels,
    fitStationBounds,
    setView: (latLng, zoom) => map.setView(latLng, zoom),
    addUserMarker,
    panBy: (point) => map.panBy(point, { animate: false }),
    invalidateSize: () => map.invalidateSize(),
    onViewportChanged: (handler) =>
      map.on("zoomend moveend", () => {
        updateMarkerScale();
        handler();
      }),
  };
}

function markerRadius(zoom: number): number {
  if (zoom <= COMPACT_MARKER_MAX_ZOOM) return 4.5;
  if (zoom < PRICE_LABEL_MIN_ZOOM) return 6.5;
  return 9;
}
