import { createRequestHandler } from "./backend/request-handler";
import { createStaticFileServer } from "./backend/serve-static";
import { fetchFuelStations } from "./backend/stations";
import type { City, FuelType } from "./shared";

const port = Number(process.env.PORT ?? 3000);
const hostname = process.env.HOST ?? "127.0.0.1";
const publicDir = new URL("../public/", import.meta.url);
let cachedClientJs: string | null = null;

const handler = createRequestHandler({
  fetchStations: (fuel: FuelType, city: City) => fetchFuelStations(fuel, city),
  buildClientJs: async () => (cachedClientJs ??= await buildClientJs()),
  serveStatic: createStaticFileServer(publicDir),
  uptime: () => process.uptime(),
});

Bun.serve({
  port,
  hostname,
  idleTimeout: 60,
  fetch: handler,
});

console.log(`Cyprus fuel map: http://${hostname}:${port}`);

async function buildClientJs(): Promise<string> {
  const result = await Bun.build({
    entrypoints: [new URL("./client.ts", import.meta.url).pathname],
    target: "browser",
    format: "esm",
    minify: false,
  });
  if (!result.success) throw new Error("Failed to build browser client");

  const output = result.outputs[0];
  if (!output) throw new Error("Browser client build produced no output");
  return output.text();
}
