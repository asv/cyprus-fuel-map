# Agent Guide for cyprus-fuel-map

This is a small localhost-first Bun + TypeScript project for displaying Cyprus fuel prices on an OpenStreetMap/Leaflet map.

Before making non-trivial changes, read `MEMORY.md`. It contains the project context, upstream data details, current architecture, known constraints, and suggested next steps.

## Stack

- Runtime/package manager: Bun
- Language: TypeScript, strict mode
- Frontend map: Leaflet + OpenStreetMap tiles
- Formatting/linting: Biome
- Backend: Bun HTTP server in `src/server.ts`
- Cache: JSON file in `.cache/fuel-cache.json`

## Commands

```bash
bun install
bun run dev           # local server with watch mode
bun run start         # local server without watch mode
bun run typecheck     # TypeScript checks
bun run lint          # Biome lint
bun run format        # Biome format
bun run test          # Bun tests
bun run check         # typecheck + Biome check + tests
bun run cache:clear   # clear local fuel cache
```

Default app URL:

```text
http://localhost:3000
```

Use another port when needed:

```bash
PORT=3010 bun run dev
```

Always run before finishing code changes:

```bash
bun run check
```

Run `bun run format` when touching TS/JS/JSON/HTML/CSS files.

## Project structure

```text
src/server.ts            # Bun server, API routes, static serving, TS frontend transpilation
src/client.ts            # browser app orchestration and feature wiring
src/client-api.ts        # browser data loading: static snapshots with local backend fallback
src/client-map.ts        # Leaflet setup, markers, labels, bounds, user marker
src/client-sheet.ts      # bottom sheet state, drag/toggle behavior, map pan helper
src/client-utils.ts      # browser formatting, DOM helpers, route URLs, distance helpers
src/theme.ts             # theme tokens, Telegram WebApp theme/viewport runtime, debug theme handling
src/shared.ts            # shared API/domain types and fuel/city constants
src/backend/stations.ts  # station service: cache lookup, in-flight dedupe, stale fallback
src/backend/upstream.ts  # upstream HTTP GET/POST, token/cookie handling, timeout/retry
src/backend/parser.ts    # HTML parsing, station normalization, coordinate parsing
src/backend/cache.ts     # JSON file cache
src/scraper.ts           # compatibility re-export for fetchFuelStations
test/                    # Bun tests and parser fixtures
public/                  # static files and local Leaflet assets
.cache/                  # runtime JSON cache, gitignored
```

## Upstream source constraints

The Cyprus fuel source is an HTML form, not a JSON API:

- `https://eforms.eservices.cyprus.gov.cy/MCIT/MCIT/PetroleumPrices`

Do not call it directly from the browser. Use the backend scraper/proxy.

Do not remove or aggressively shorten the 6-hour backend cache. The app should avoid hitting the government server often.

The backend upstream/parser flow must:

1. GET the form page.
2. Extract `__RequestVerificationToken`.
3. Preserve relevant cookies.
4. POST selected fuel type.
5. Parse the returned HTML table.

If changing parser logic, preserve support for both coordinate formats:

- decimal: `35.1845,33.3895`
- DMS: `34°39'14.95"N 32°58'33.82"E`

## Frontend rules

- Keep map interactions smooth.
- Do not recreate all markers on every slider movement.
- Filtering should show/hide existing markers when practical.
- Do not call `fitBounds()` on every filter change; only fit on initial data load or deliberate user action.
- Keep geolocation permission user-driven via the existing button.
- Escape user/upstream text before injecting HTML.
- Remember that some stations have no coordinates. They should not be drawn, but counts should remain clear.
- Add new colors as CSS tokens in `public/style.css` and/or `src/theme.ts`; avoid raw white/black component backgrounds.
- Check both `?theme=light` and `?theme=dark` for visible text on controls, tooltips, and the bottom sheet.

## Backend rules

- Keep stale cache fallback behavior: if upstream fails after cache expiry, return stale cache with `stale: true` when available.
- Keep in-flight dedupe for identical station requests.
- Keep `.cache/` out of git.
- Do not introduce external services or persistent databases for this localhost app without explicit approval.
- Avoid adding heavy dependencies for simple parsing unless there is a clear reason.
- Keep city validation whitelisted via `cities` in `src/shared.ts`.
- Keep parser tests updated when parser behavior changes.

## Style

- Prefer small, obvious functions.
- Keep changes scoped.
- Use shared types from `src/shared.ts` instead of duplicating API shapes.
- Use Biome formatting; do not hand-format against it.
- Keep comments useful and sparse.

## Git

This directory is a git repo. Do not commit unless explicitly asked.

Ignored local/generated data includes:

- `node_modules/`
- `.cache/`
- `.env*` except `.env.example`
- build/coverage outputs
