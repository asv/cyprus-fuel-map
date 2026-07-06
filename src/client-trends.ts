import type { GlobalFuelHistory } from "./shared";

export function renderMarketTrend(container: HTMLElement, history: GlobalFuelHistory | null): void {
  if (!history || history.points.length === 0) {
    container.innerHTML = `<p class="trend-empty">No trend history yet.</p>`;
    return;
  }

  if (history.points.length === 1) {
    const point = history.points[0]!;
    container.innerHTML = `<p class="trend-empty">Trend starts at ${formatShortDate(point.at)} · avg ${formatPrice(point.avgPrice)}</p>`;
    return;
  }

  const points = history.points.filter((point) => point.avgPrice !== null);
  if (points.length < 2) {
    container.innerHTML = `<p class="trend-empty">Not enough price points yet.</p>`;
    return;
  }

  const prices = points.flatMap((point) => [point.minPrice, point.avgPrice, point.maxPrice]).filter(isNumber);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = Math.max(max - min, 0.001);
  const width = 280;
  const height = 96;
  const padding = 10;
  const x = (index: number) => padding + (index / (points.length - 1)) * (width - padding * 2);
  const y = (value: number) => height - padding - ((value - min) / range) * (height - padding * 2);
  const line = (field: "avgPrice" | "medianPrice") =>
    points
      .map((point, index) => {
        const value = point[field] ?? point.avgPrice;
        return value === null ? null : `${x(index).toFixed(1)},${y(value).toFixed(1)}`;
      })
      .filter((value): value is string => value !== null)
      .join(" ");
  const band = points
    .map((point, index) => `${x(index).toFixed(1)},${y(point.maxPrice ?? point.avgPrice ?? max).toFixed(1)}`)
    .concat(
      [...points]
        .reverse()
        .map(
          (point, reverseIndex) =>
            `${x(points.length - 1 - reverseIndex).toFixed(1)},${y(point.minPrice ?? point.avgPrice ?? min).toFixed(1)}`,
        ),
    )
    .join(" ");
  const latest = points.at(-1)!;
  const first = points[0]!;
  const delta = latest.avgPrice !== null && first.avgPrice !== null ? latest.avgPrice - first.avgPrice : null;

  container.innerHTML = `
    <div class="trend-header">
      <span>${formatShortDate(first.at)} → ${formatShortDate(latest.at)}</span>
      <strong>${formatDelta(delta)}</strong>
    </div>
    <svg class="trend-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Average fuel price trend">
      <polygon class="trend-band" points="${band}"></polygon>
      <polyline class="trend-line trend-line-avg" points="${line("avgPrice")}"></polyline>
      <polyline class="trend-line trend-line-median" points="${line("medianPrice")}"></polyline>
    </svg>
  `;
}

function isNumber(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function formatPrice(value: number | null): string {
  return value === null ? "n/a" : `€${value.toFixed(3)}`;
}

function formatDelta(value: number | null): string {
  if (value === null) return "n/a";
  if (Math.abs(value) < 0.0005) return "±€0.000";
  return `${value > 0 ? "+" : "-"}€${Math.abs(value).toFixed(3)}`;
}

function formatShortDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
}
