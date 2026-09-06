import type { City, FuelType } from "../shared";
import { cities, fuelTypes, type JsonValue } from "../shared";

export type ServerDeps = {
  fetchStations: (fuel: FuelType, city: City) => Promise<JsonValue>;
  buildClientJs: () => Promise<string>;
  serveStatic: (pathname: string) => Promise<Response | null>;
  uptime: () => number;
};

/**
 * Pure request handler for the HTTP surface. Kept free of any I/O glue so it
 * can be exercised directly in tests with fake dependencies.
 */
export function createRequestHandler(deps: ServerDeps): (request: Request) => Promise<Response> {
  return async (request) => {
    const url = new URL(request.url);
    if (request.method !== "GET" && request.method !== "HEAD") {
      return apiError("METHOD_NOT_ALLOWED", `${request.method} is not allowed`, 405, false);
    }

    try {
      if (url.pathname === "/api/health") {
        return json({ ok: true, uptime: deps.uptime() });
      }

      if (url.pathname === "/api/fuel-types") {
        return json({ fuelTypes, cities });
      }

      if (url.pathname === "/api/stations") {
        const fuel = url.searchParams.get("fuel") ?? "1";
        const city = url.searchParams.get("city") ?? "All";
        if (!isFuelType(fuel)) {
          return apiError("UNSUPPORTED_FUEL_TYPE", "Unsupported fuel type", 400, false);
        }
        if (!isCity(city)) {
          return apiError("UNSUPPORTED_CITY", "Unsupported city", 400, false);
        }
        return json(await deps.fetchStations(fuel, city));
      }

      if (url.pathname === "/app.js") {
        return new Response(await deps.buildClientJs(), {
          headers: { "content-type": "application/javascript; charset=utf-8" },
        });
      }

      const staticResponse = await deps.serveStatic(url.pathname);
      if (staticResponse) return staticResponse;

      return apiError("NOT_FOUND", "Not found", 404, false);
    } catch (error) {
      console.error(error);
      // Do not leak internal error details to clients; log them server-side only.
      return apiError("INTERNAL_ERROR", "Internal server error", 500, true);
    }
  };
}

function isFuelType(value: string): value is FuelType {
  return Object.hasOwn(fuelTypes, value);
}

function isCity(value: string): value is City {
  return cities.some((city) => city === value);
}

function apiError(code: string, message: string, status: number, retryable: boolean): Response {
  return json({ error: { code, message, retryable } }, status);
}

function json(value: JsonValue, status = 200): Response {
  return Response.json(value, {
    status,
    headers: {
      "cache-control": "no-store",
    },
  });
}
