import { describe, expect, test } from "bun:test";

describe("client trends module", () => {
  test("renders SVG market trend markup", async () => {
    const source = await Bun.file(new URL("../src/client-trends.ts", import.meta.url)).text();

    expect(source).toContain("renderMarketTrend");
    expect(source).toContain("trend-chart");
    expect(source).toContain("trend-line-avg");
    expect(source).toContain("No trend history yet");
    expect(source).toContain("stationSparkline");
    expect(source).toContain("station-chart");
  });
});
