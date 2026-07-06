import { describe, expect, test } from "bun:test";

describe("client history API paths", () => {
  test("history loader source keeps history files optional", async () => {
    const source = await Bun.file(new URL("../src/client-history-api.ts", import.meta.url)).text();

    expect(source).toContain("data/history/manifest.json");
    expect(source).toContain("data/history/global-");
    expect(source).toContain("data/history/station-prices-");
    expect(source).toContain("response.status === 404");
  });
});
