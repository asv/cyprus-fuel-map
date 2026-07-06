# Historical fuel data

The app keeps the current fuel-price snapshots in `public/data/stations-*.json`. Historical data is stored separately under `public/data/history/` so the map can keep loading the small current snapshot while trend UI reads time-series data on demand.

## Layers

- Current snapshots: latest station data used by the map and backend fallback.
- Raw history: append-friendly facts generated from snapshots.
- Derived views: chart series and trend calculations built from raw history in code, not stored with the raw facts.

## Files

```text
public/data/history/
  manifest.json
  global-1.json
  global-2.json
  global-3.json
  global-4.json
  global-5.json
  station-index.json
  station-prices-1.json
  station-prices-2.json
  station-prices-3.json
  station-prices-4.json
  station-prices-5.json
```

`global-*.json` stores market-level points for one fuel type. A new point is added only when aggregate values change.

`station-index.json` stores stable station metadata. The first implementation maps `stationKey` to the current source id, but the format keeps `aliases` so future parser/source changes can merge renamed stations without rewriting price history.

`station-prices-*.json` stores station-level price changes for one fuel type. A new change is added only when price or offline status changes for a station.

## Invariants

- Existing current snapshot files and API shapes stay backward-compatible.
- History files are optional for the frontend; missing files produce empty states.
- Generation is idempotent for the same input snapshot.
- Arrays and object keys are written in stable order to keep Git diffs reviewable.
- Raw history does not store trend lines, moving averages, or chart-specific values.
