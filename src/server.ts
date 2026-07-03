import { fetchFuelStations } from "./backend/stations";
import { type City, cities, type FuelType, fuelTypes } from "./shared";

const port = Number(process.env.PORT ?? 3000);
const publicDir = new URL("../public/", import.meta.url);
const transpiler = new Bun.Transpiler({ loader: "ts", target: "browser" });
let cachedClientJs: string | null = null;

Bun.serve({
  port,
  idleTimeout: 60,
  async fetch(request) {
    const url = new URL(request.url);

    try {
      if (url.pathname === "/api/health") {
        return json({ ok: true, uptime: process.uptime() });
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
        return json(await fetchFuelStations(fuel, city));
      }

      if (url.pathname === "/app.js") {
        cachedClientJs ??= transpiler.transformSync(await Bun.file(new URL("./client.ts", import.meta.url)).text());
        return new Response(cachedClientJs, {
          headers: { "content-type": "application/javascript; charset=utf-8" },
        });
      }

      const staticResponse = await serveStatic(url.pathname);
      if (staticResponse) return staticResponse;

      return apiError("NOT_FOUND", "Not found", 404, false);
    } catch (error) {
      console.error(error);
      return apiError("INTERNAL_ERROR", error instanceof Error ? error.message : "Unknown error", 500, true);
    }
  },
});

console.log(`Cyprus fuel map: http://localhost:${port}`);

function isFuelType(value: string): value is FuelType {
  return Object.hasOwn(fuelTypes, value);
}

function isCity(value: string): value is City {
  return (cities as readonly string[]).includes(value);
}

async function serveStatic(pathname: string): Promise<Response | null> {
  const relativePath = pathname === "/" ? "index.html" : decodeURIComponent(pathname.slice(1));
  if (relativePath.includes("..") || relativePath.startsWith("/")) return null;

  const file = Bun.file(new URL(relativePath, publicDir));
  if (!(await file.exists())) return null;

  return new Response(file, {
    headers: { "content-type": contentType(relativePath) },
  });
}

function contentType(path: string): string {
  if (path.endsWith(".html")) return "text/html; charset=utf-8";
  if (path.endsWith(".css")) return "text/css; charset=utf-8";
  if (path.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".json")) return "application/json; charset=utf-8";
  if (path.endsWith(".svg")) return "image/svg+xml";
  if (path.endsWith(".ico")) return "image/x-icon";
  if (path.endsWith(".map")) return "application/json; charset=utf-8";
  return "application/octet-stream";
}

function apiError(code: string, message: string, status: number, retryable: boolean): Response {
  return json({ error: { code, message, retryable } }, status);
}

function json(value: unknown, status = 200): Response {
  return Response.json(value, {
    status,
    headers: {
      "cache-control": "no-store",
    },
  });
}
