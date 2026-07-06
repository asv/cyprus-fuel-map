import type { GlobalFuelHistory, StationFuelPriceHistory, StationPriceChange } from "./shared";

export type StationSeriesPoint = {
  at: string;
  price: number;
  isOffline: boolean;
};

export function buildStationStepSeries(history: StationFuelPriceHistory, stationKey: string): StationSeriesPoint[] {
  return history.changes
    .filter((change) => change.stationKey === stationKey)
    .sort((a, b) => compareText(a.at, b.at))
    .map(toSeriesPoint);
}

export function latestStationPriceChange(
  history: StationFuelPriceHistory,
  stationKey: string,
): StationPriceChange | null {
  return (
    history.changes
      .filter((change) => change.stationKey === stationKey)
      .sort((a, b) => compareText(a.at, b.at))
      .at(-1) ?? null
  );
}

export function priceDeltaOverDays(series: StationSeriesPoint[], now: Date, days: number): number | null {
  const latest = series.at(-1);
  if (!latest) return null;

  const threshold = now.getTime() - days * 24 * 60 * 60 * 1000;
  const baseline = [...series].reverse().find((point) => new Date(point.at).getTime() <= threshold) ?? series[0];
  if (!baseline) return null;

  return roundPrice(latest.price - baseline.price);
}

export function priceVsLatestMarketMedian(price: number, history: GlobalFuelHistory): number | null {
  const latestMedian = [...history.points].reverse().find((point) => point.medianPrice !== null)?.medianPrice ?? null;
  return latestMedian === null ? null : roundPrice(price - latestMedian);
}

function toSeriesPoint(change: StationPriceChange): StationSeriesPoint {
  return { at: change.at, price: change.price, isOffline: change.isOffline };
}

function compareText(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function roundPrice(value: number): number {
  return Math.round(value * 1000) / 1000;
}
