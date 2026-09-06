import { describe, expect, test } from "bun:test";
import { contentType, createStaticFileServer } from "../src/backend/serve-static";

const publicDir = new URL("../public/", import.meta.url);
const serve = createStaticFileServer(publicDir);

describe("static file server", () => {
  test("maps content types by extension", () => {
    expect(contentType("/index.html")).toBe("text/html; charset=utf-8");
    expect(contentType("/style.css")).toBe("text/css; charset=utf-8");
    expect(contentType("/app.js")).toBe("application/javascript; charset=utf-8");
    expect(contentType("/data/stations-1.json")).toBe("application/json; charset=utf-8");
    expect(contentType("/images/icon.png")).toBe("image/png");
    expect(contentType("/leaflet.svg")).toBe("image/svg+xml");
    expect(contentType("/favicon.ico")).toBe("image/x-icon");
    expect(contentType("/unknown.bin")).toBe("application/octet-stream");
  });

  test("serves the root as index.html", async () => {
    const res = await serve("/");
    expect(res?.status).toBe(200);
    expect(res?.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(await res?.text()).toContain("<!doctype html>");
  });

  test("serves a real static file", async () => {
    const res = await serve("/style.css");
    expect(res?.status).toBe(200);
    expect(res?.headers.get("content-type")).toBe("text/css; charset=utf-8");
  });

  test("rejects path traversal and root-absolute paths", async () => {
    expect(await serve("/../secret")).toBeNull();
    expect(await serve("/..%2fsecret")).toBeNull();
    expect(await serve("/%2e%2e/secret")).toBeNull();
    // absolute-in-url forms that would otherwise escape the root
    expect(await serve("/..%2F..%2Fetc%2Fpasswd")).toBeNull();
  });

  test("returns null for missing files", async () => {
    expect(await serve("/does-not-exist.txt")).toBeNull();
  });
});
