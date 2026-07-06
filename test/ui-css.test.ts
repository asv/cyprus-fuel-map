import { describe, expect, test } from "bun:test";

describe("UI CSS guardrails", () => {
  test("hidden market trends stay hidden despite component display styles", async () => {
    const css = await Bun.file(new URL("../public/style.css", import.meta.url)).text();

    expect(css).toContain(".market-trends[hidden]");
    expect(css).toContain("display: none");
  });
});
