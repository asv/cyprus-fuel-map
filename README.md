# Cyprus Fuel Map

Local Bun + TypeScript app that fetches Cyprus Retail Fuel Price Observatory data and shows stations on an OpenStreetMap/Leaflet map.

## Requirements

- Bun 1.3+

## Run locally

```bash
bun install
bun run dev
```

Open http://localhost:3000

Use another port:

```bash
PORT=3010 bun run dev
```

## Scripts

```bash
bun run dev           # run local server with watch mode
bun run start         # run local server without watch mode
bun run data:generate # fetch upstream data into public/data
bun run build         # build static GitHub Pages app into dist
bun run typecheck     # TypeScript checks
bun run lint          # Biome lint
bun run format        # Biome format
bun run test          # Bun tests
bun run check         # typecheck + Biome check + tests
bun run cache:clear   # remove local fuel cache
```

## API

```bash
curl 'http://localhost:3000/api/health'
curl 'http://localhost:3000/api/fuel-types'
curl 'http://localhost:3000/api/stations?fuel=1&city=All'
```

Fuel codes:

- `1` — Unleaded 95
- `2` — Unleaded 98
- `3` — Diesel
- `4` — Heating oil
- `5` — Kerosene

Supported cities:

- `All`
- `Famagusta`
- `Larnaca`
- `Limassol`
- `Nicosia`
- `Paphos`

The backend caches each fuel response in `.cache/fuel-cache.json` for 6 hours and parses the government HTML form response.
If the upstream source is unavailable after the cache expires, the backend returns stale cached data when available.

## Static deploy

The production path is static and suitable for GitHub Pages:

```bash
bun run data:generate
bun run build
```

`data:generate` writes fuel snapshots to `public/data/`. `build` copies `public/` to `dist/` and transpiles the browser TypeScript to `dist/app.js`.

The GitHub Pages workflow runs on pushes to `main`, manual dispatch, and a 6-hour cron. It regenerates fuel data, checks the project, builds `dist/`, and deploys it to Pages.

## Development notes

- TypeScript is strict.
- Biome handles formatting and linting.
- Bun tests cover the HTML parser with fixtures.
- Leaflet assets are served locally from `public/`.
- Runtime cache and local environment files are ignored by git.
