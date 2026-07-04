# Project Memory

## Purpose

`cyprus-fuel-map` is a local Bun + TypeScript web app that displays Cyprus fuel station prices on an OpenStreetMap/Leaflet map.

The app was built to query the official Cyprus Retail Fuel Price Observatory, normalize the HTML response into JSON, and render stations with prices, filters, and geolocation support.

## Source data

Primary upstream source:

- `https://eforms.eservices.cyprus.gov.cy/MCIT/MCIT/PetroleumPrices`

Official open-data context:

- Dataset/API page: `https://www.data.gov.cy/el/dataset/paratiritirio-lianikon-timon-kaysimon-api`
- Resource page: `https://www.data.gov.cy/el/resource/paratiritirio-lianikon-timon-kaysimon`

The upstream is not a clean JSON API. It is an ASP.NET-ish HTML form:

1. Backend does `GET` on the PetroleumPrices page.
2. Extracts dynamic `__RequestVerificationToken`.
3. Extracts cookies from `set-cookie`, especially:
   - `ASP.NET_SessionId_Efef`
   - `__RequestVerificationToken`
4. Sends `POST` with form fields:
   - `__RequestVerificationToken=<dynamic token>`
   - `Entity.PetroleumType=<fuel code>`
   - `Entity.StationCityEnum=All`
   - `Entity.StationDistrict=`
5. Parses returned HTML table `#petroleumPriceDetailsFootable`.

Fuel codes:

- `1` — Unleaded 95
- `2` — Unleaded 98
- `3` — Diesel
- `4` — Heating oil
- `5` — Kerosene

The source sometimes contains coordinates as decimal values like `35.1845,33.3895`, and sometimes as DMS coordinates. Both are handled in `src/backend/parser.ts`.

## Current architecture

- Runtime: Bun
- Language: TypeScript
- Backend entrypoint: `src/server.ts`
- Station service: `src/backend/stations.ts`
- Upstream HTTP form flow: `src/backend/upstream.ts`
- HTML parser/normalizer: `src/backend/parser.ts`
- JSON cache: `src/backend/cache.ts`
- Compatibility re-export: `src/scraper.ts`
- Shared API types: `src/shared.ts`
- Frontend app: `src/client.ts`, bundled by Bun server/build scripts to `/app.js`
- Theme runtime/tokens: `src/theme.ts`
- Static assets: `public/`
- Leaflet assets are local:
  - `public/leaflet.js`
  - `public/leaflet.css`
  - `public/images/*`

Backend API:

- `GET /api/health`
- `GET /api/fuel-types`
- `GET /api/stations?fuel=1&city=All`

Frontend features:

- OpenStreetMap via Leaflet.
- Station markers colored by relative price:
  - green = cheaper
  - orange = middle
  - red = expensive
- Popup with brand, station name, address, district, price, offline warning.
- Price labels as Leaflet tooltips, shown only when zoomed in enough.
- Checkbox to toggle price labels.
- Single max-price range slider filtering visible stations.
- Geolocation button. After location is known, station list sorts by distance.
- Station sidebar list limited to top 30 entries.

## Cache behavior

Backend caches upstream responses in:

- `.cache/fuel-cache.json`

TTL:

- 6 hours

Important behavior:

- Fresh cache returns immediately without calling upstream.
- Expired cache triggers refresh.
- If refresh fails but stale cache exists, backend returns stale data with `stale: true`.
- In-flight request dedupe prevents concurrent identical upstream requests.
- API responses include cache metadata: `cache.hit`, `cache.stale`, `cache.expiresAt`.

`.cache/` is ignored by git.

## Development setup

Package manager/runtime:

```bash
bun install
bun run dev
```

Default local URL:

- `http://localhost:3000`

Use a different port:

```bash
PORT=3010 bun run dev
```

Useful scripts:

```bash
bun run dev           # watch mode
bun run start         # run server without watch
bun run typecheck     # tsc --noEmit
bun run lint          # biome lint
bun run format        # biome format --write
bun run test          # bun test
bun run check         # typecheck + biome check + tests
bun run cache:clear   # remove .cache
```

Tooling:

- TypeScript strict mode.
- Biome for formatting/linting.
- Bun tests cover parser behavior using `test/fixtures/petroleum-sample.html`.
- Bun tests cover Telegram/theme token generation in `test/theme.test.ts`.
- `.editorconfig` present.
- VS Code settings recommend/use Biome.

## Known constraints and decisions

- This is a localhost-first project, not production infrastructure.
- Do not hammer the government endpoint. Keep 6h cache unless there is a strong reason to change it.
- The parser is regex-based because the app has no runtime DOM parser dependency. This is acceptable for now but fragile if upstream HTML changes.
- Parser robustness is covered by fixture tests; add more fixtures when upstream HTML changes.
- The app intentionally does not call the Cyprus source directly from the browser. Backend acts as proxy/parser to avoid CORS and token/cookie issues.
- Some stations have no parseable coordinates. They are included in total count but not drawn on the map.
- Leaflet CSS must be loaded. If the map appears as broken/tiled images, check `public/leaflet.css` and stylesheet loading first.
- Theme debugging supports `?theme=light` and `?theme=dark`; Telegram theme params override debug tokens in the Mini App runtime.
- Add new UI colors through CSS tokens and `src/theme.ts`; avoid raw white/black component backgrounds.

## Recent implementation notes

- Initial API test for Unleaded 95 returned about 319 stations, with roughly 289 mapped after coordinate parsing. Counts may vary over time.
- Price values are in EUR/liter and are formatted with 3 decimals.
- The frontend previously recreated markers on every slider move; this was optimized. Current filtering should show/hide existing markers instead of rebuilding them.
- `AbortController` is used to avoid stale UI updates when switching fuel type quickly.
- Static serving has basic path traversal protection and content-type handling.
- Browser `app.js` is bundled with `Bun.build` so client-side modules such as `src/theme.ts` can be imported safely.

## Suggested next improvements

High-value next steps:

1. Split `src/client.ts` into smaller modules:
   - `api.ts`
   - `map.ts`
   - `filters.ts`
   - `dom.ts`
   - `geo.ts`
2. Add more parser fixtures from real upstream HTML when parser issues are found.
3. Add a reset-filter button.
4. Add map legend for marker colors.
5. Consider marker clustering if marker count grows.
6. Add better typed Leaflet integration instead of `declare const L: any`.
7. Consider background refresh: return stale cache immediately while refreshing in the background.
8. Keep theme additions token-based; verify `?theme=light`, `?theme=dark`, and Telegram-provided theme params.
