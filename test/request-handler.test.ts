import { describe, expect, test } from "bun:test";
import { createRequestHandler, type ServerDeps } from "../src/backend/request-handler";
import type { City, FuelType } from "../src/shared";

function makeDeps(overrides: Partial<ServerDeps> = {}): ServerDeps {
  return {
    fetchStations: async () => ({ ok: true }),
    buildClientJs: async () => "const client = 1;",
    serveStatic: async () => null,
    uptime: () => 42,
    ...overrides,
  };
}

async function call(
  handler: ReturnType<typeof createRequestHandler>,
  url: string,
  init?: RequestInit,
): Promise<Response> {
  return handler(new Request(url, init));
}

describe("request handler", () => {
  test("rejects non-GET methods with 405", async () => {
    const handler = createRequestHandler(makeDeps());
    for (const method of ["POST", "PUT", "DELETE", "PATCH"]) {
      const res = await call(handler, "http://x/api/health", { method });
      expect(res.status).toBe(405);
      expect(await res.json()).toEqual({
        error: { code: "METHOD_NOT_ALLOWED", message: `${method} is not allowed`, retryable: false },
      });
    }
  });

  test("allows HEAD", async () => {
    const handler = createRequestHandler(makeDeps());
    const res = await call(handler, "http://x/api/health", { method: "HEAD" });
    expect(res.status).toBe(200);
  });

  test("serves health with fake uptime", async () => {
    const handler = createRequestHandler(makeDeps({ uptime: () => 7 }));
    const res = await call(handler, "http://x/api/health");
    expect(await res.json()).toEqual({ ok: true, uptime: 7 });
  });

  test("serves fuel types", async () => {
    const handler = createRequestHandler(makeDeps());
    const res = await call(handler, "http://x/api/fuel-types");
    const body = await res.json();
    expect(body.fuelTypes["1"]).toBe("Unleaded 95");
    expect(body.cities).toContain("Nicosia");
  });

  test("validates fuel and city on /api/stations", async () => {
    const handler = createRequestHandler(makeDeps());
    const badFuel = await call(handler, "http://x/api/stations?fuel=abc");
    expect(badFuel.status).toBe(400);
    expect((await badFuel.json()).error.code).toBe("UNSUPPORTED_FUEL_TYPE");

    const badCity = await call(handler, "http://x/api/stations?fuel=1&city=Atlantis");
    expect(badCity.status).toBe(400);
    expect((await badCity.json()).error.code).toBe("UNSUPPORTED_CITY");
  });

  test("forwards valid /api/stations to the fetch dependency", async () => {
    let received: { fuel: FuelType; city: City } | undefined;
    const handler = createRequestHandler(
      makeDeps({
        fetchStations: async (fuel, city) => {
          received = { fuel, city };
          return { stations: [] };
        },
      }),
    );
    const res = await call(handler, "http://x/api/stations?fuel=3&city=Limassol");
    expect(res.status).toBe(200);
    expect(received).toEqual({ fuel: "3", city: "Limassol" });
  });

  test("serves built client via dependency", async () => {
    const handler = createRequestHandler(makeDeps({ buildClientJs: async () => "const client = 42;" }));
    const res = await call(handler, "http://x/app.js");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("const client = 42;");
    expect(res.headers.get("content-type")).toContain("javascript");
  });

  test("returns 404 for unknown paths", async () => {
    const handler = createRequestHandler(makeDeps());
    const res = await call(handler, "http://x/no-such-page");
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("NOT_FOUND");
  });

  test("does not leak internal error details in 500", async () => {
    const handler = createRequestHandler(
      makeDeps({
        fetchStations: async () => {
          throw new Error("secret-stack-trace-fragment");
        },
      }),
    );
    const res = await call(handler, "http://x/api/stations?fuel=1");
    expect(res.status).toBe(500);
    expect((await res.json()).error.message).toBe("Internal server error");
  });
});
