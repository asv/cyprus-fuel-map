import { describe, expect, test } from "bun:test";
import { escapeHtml, formatPrice, routeUrls } from "../src/client-utils";
import type { FuelStation } from "../src/shared";

describe("client-utils", () => {
  test("escapeHtml neutralizes HTML metacharacters", () => {
    expect(escapeHtml(`<script>alert("x")</script> & '&'`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;&amp;&#39;",
    );
    expect(escapeHtml("plain text")).toBe("plain text");
    expect(escapeHtml("")).toBe("");
  });

  test("formatPrice formats euros with three decimals", () => {
    expect(formatPrice(1.3894)).toBe("€1.389");
    expect(formatPrice(null)).toBe("n/a");
  });

  test("routeUrls builds a Waze link from coordinates", () => {
    const station: FuelStation = {
      id: "s1",
      brand: "B",
      name: "N",
      address: "A",
      district: "D",
      price: 1.5,
      isOffline: false,
      lat: 35.18,
      lng: 33.39,
    };
    expect(routeUrls(station).waze).toContain("https://waze.com/ul?ll=35.18,33.39&navigate=yes");
  });
});
