import { describe, expect, test } from "bun:test";
import { alphaColor, buildTelegramTokens } from "../src/theme";

describe("theme tokens", () => {
  test("builds readable light Telegram tokens", () => {
    const tokens = buildTelegramTokens({
      bg_color: "#ffffff",
      secondary_bg_color: "#f7f9fc",
      text_color: "#101828",
      hint_color: "#7a7f89",
      button_color: "#2488f2",
      button_text_color: "#ffffff",
    });

    expect(tokens["--text"]).toBe("#101828");
    expect(tokens["--control-bg"]).toBe("rgb(247 249 252 / 0.96)");
    expect(tokens["--tooltip-bg"]).toBe("rgb(247 249 252 / 0.94)");
    expect(tokens["--tooltip-text"]).toBe("#101828");
  });

  test("builds readable dark Telegram tokens", () => {
    const tokens = buildTelegramTokens({
      bg_color: "#000000",
      secondary_bg_color: "#1c1c1e",
      text_color: "#ffffff",
      hint_color: "#a1a1aa",
      button_color: "#4a90ff",
    });

    expect(tokens["--text"]).toBe("#ffffff");
    expect(tokens["--control-bg"]).toBe("rgb(28 28 30 / 0.96)");
    expect(tokens["--card-bg"]).toBe("rgb(28 28 30 / 0.82)");
    expect(tokens["--tooltip-bg"]).toBe("rgb(28 28 30 / 0.94)");
    expect(tokens["--tooltip-text"]).toBe("#ffffff");
  });

  test("omits missing optional tokens", () => {
    const tokens = buildTelegramTokens({ bg_color: "#000", text_color: "#fff" });

    expect(tokens["--panel"]).toBe("#000");
    expect(tokens["--panel-strong"]).toBe("#000");
    expect(tokens["--accent"]).toBeUndefined();
    expect(Object.values(tokens)).not.toContain(undefined);
  });

  test("converts short and long hex colors to alpha colors", () => {
    expect(alphaColor("#fff", 0.5)).toBe("rgb(255 255 255 / 0.5)");
    expect(alphaColor("#123456", 0.25)).toBe("rgb(18 52 86 / 0.25)");
  });
});
