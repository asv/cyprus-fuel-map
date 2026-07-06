import { describe, expect, test } from "bun:test";

describe("static build", () => {
  test("adds cache-busting versions to browser assets", async () => {
    const source = await Bun.file(new URL("../src/build.ts", import.meta.url)).text();

    expect(source).toContain("GITHUB_SHA");
    expect(source).toContain("style.css");
    expect(source).toContain("app.js");
    expect(source).toContain("suffix");
  });
});
