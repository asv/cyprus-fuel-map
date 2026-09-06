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
- Frontend orchestration: `src/client.ts`, bundled by Bun server/build scripts to `/app.js`
- Frontend data loading: `src/client-api.ts`
- Leaflet map module: `src/client-map.ts`
- Bottom sheet behavior: `src/client-sheet.ts`
- Browser helpers: `src/client-utils.ts`
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
- Runtime validation for the server/CLI world only: Zod schemas in `src/backend/json-schemas.ts`, DOM-based HTML parsing via `node-html-parser` in `src/backend/parser.ts` and `src/backend/upstream.ts`. Keep both imports out of anything reachable from `src/client.ts` (the Mini App bundle), and keep `src/shared.ts` free of runtime dependencies.
- Bun tests cover parser behavior using `test/fixtures/petroleum-sample.html`.
- Bun tests cover Telegram/theme token generation in `test/theme.test.ts`.
- `.editorconfig` present.
- VS Code settings recommend/use Biome.

## Known constraints and decisions

- This is a localhost-first project, not production infrastructure.
- The dev server binds `127.0.0.1` by default (`HOST` env to override), rejects non-GET/HEAD with 405, and never echoes internal error details to clients. This keeps the server out of reach of the LAN and avoids turning it into an open proxy against the upstream.
- All file writes (cache, generated static data, history) go through `atomicWrite` (src/backend/write-atomically.ts): write to a sibling `.tmp` then `rename`, so readers never see a partially written file and torn production static data cannot reach GitHub Pages.
- Upstream HTML responses are size-capped (10 MB) before parsing/use, so a hostile or broken upstream cannot exhaust server memory.
- Do not hammer the government endpoint. Keep 6h cache unless there is a strong reason to change it.
- Upstream HTML is parsed with `node-html-parser` (table, labels, form token/action); only coordinate formats (decimal and DMS) remain string-regex based by design. Parser robustness is covered by fixture tests; add more fixtures when upstream HTML changes.
- The app intentionally does not call the Cyprus source directly from the browser. Backend acts as proxy/parser to avoid CORS and token/cookie issues.
- Some stations have no parseable coordinates. They are included in total count but not drawn on the map.
- Leaflet CSS must be loaded. If the map appears as broken/tiled images, check `public/leaflet.css` and stylesheet loading first.
- Theme debugging supports `?theme=light` and `?theme=dark`; Telegram theme params override debug tokens in the Mini App runtime.
- Add new UI colors through CSS tokens and `src/theme.ts`; avoid raw white/black component backgrounds.

## Recent implementation notes

- The HTTP surface is factored into a pure (dependency-injected) request handler in `src/backend/request-handler.ts` and a `createStaticFileServer` root in `src/backend/serve-static.ts`; both are covered by direct unit tests (405/400/404/500 handling, path traversal, content types).
- Initial API test for Unleaded 95 returned about 319 stations, with roughly 289 mapped after coordinate parsing. Counts may vary over time.
- Price values are in EUR/liter and are formatted with 3 decimals.
- The frontend previously recreated markers on every slider move; this was optimized. Current filtering should show/hide existing markers instead of rebuilding them.
- `AbortController` is used to avoid stale UI updates when switching fuel type quickly.
- Static serving lives in `src/backend/serve-static.ts` with explicit path-traversal guard and content-type mapping; covered by tests.
- Browser `app.js` is bundled with `Bun.build` so client-side modules such as `src/theme.ts` can be imported safely.
- Historical price data is designed as optional static files under `public/data/history/`; see `docs/history-data.md`.

## Native macOS widget

- The local macOS 14+ SwiftUI companion app and medium WidgetKit extension live in `macos/`.
- The widget reads current snapshots and optional global history from GitHub Pages; it never calls the government HTML source directly.
- It supports all fuel types, automatic authorized location, and five fixed-city fallbacks.
- It shows the Cyprus minimum and average, the 15 km nearby average, and the nearest online station.
- The Cyprus minimum includes an optional 24-hour direction and absolute delta derived from `data/history/global-*.json`.
- Current and history responses use separate disk-cache fallbacks. History failure only hides the trend.
- The adaptive Rich Emerald background has separate Light and Dark palettes while preserving WidgetKit system content margins.
- `macos/install.sh` creates and installs an ad-hoc signed Apple Silicon build at `/Applications/CyprusFuel.app`; the companion app does not need to remain open.

## Suggested next improvements

High-value next steps:

1. Add more parser fixtures from real upstream HTML when parser issues are found.
2. Add a reset-filter button.
3. Add map legend for marker colors.
4. Consider marker clustering if marker count grows.
5. Add better typed Leaflet integration instead of `declare const L: any`.
6. Consider background refresh: return stale cache immediately while refreshing in the background.
7. Keep theme additions token-based; verify `?theme=light`, `?theme=dark`, and Telegram-provided theme params.
