# Agent Guide for the macOS app and widget

This directory contains the local native macOS companion app and WidgetKit extension. Follow the repository-level `AGENTS.md` as well as these platform-specific notes.

## Targets and shared code

- `CyprusFuel/` is the SwiftUI companion app used for location permission and diagnostics.
- `CyprusFuelWidget/` is the medium WidgetKit extension.
- `Shared/` contains models and network/data-selection code compiled into both targets.
- `CyprusFuel.xcodeproj/project.pbxproj` is maintained directly; when adding a Swift file, ensure it has the intended target membership.

## Data and behavior constraints

- Read current snapshots and optional global history from `https://asv.github.io/cyprus-fuel-map/data/`. Do not call the Cyprus government HTML endpoint from the app or widget.
- Preserve disk-cache fallback for current snapshots. History failures must remain non-fatal and should only hide trend UI.
- Automatic location must remain user-authorized. Fixed-city choices must work without location permission.
- Distance is straight-line Core Location distance with a 15 km radius.
- Keep WidgetKit work lightweight: request hourly timelines, avoid frequent network refreshes, and do not depend on the companion app remaining open.
- Keep the widget medium-only unless another family is explicitly requested.

## Widget design

- Preserve WidgetKit system content margins; do not use `contentMarginsDisabled()` merely to tighten layout.
- Verify readable foreground colors against both Light and Dark adaptive backgrounds.
- Keep the hierarchy glanceable: fuel/location status, three market metrics, then the nearest station.
- Treat history as observed-price history. A minimum-price arrow indicates the change in the observed Cyprus minimum over 24 hours, not a general market forecast.

## Validation

From the repository root, build without signing:

```bash
rm -rf macos/DerivedData
xcodebuild \
  -project macos/CyprusFuel.xcodeproj \
  -scheme CyprusFuel \
  -configuration Debug \
  -destination 'platform=macOS,arch=arm64' \
  -derivedDataPath macos/DerivedData \
  build CODE_SIGNING_ALLOWED=NO
rm -rf macos/DerivedData
```

Before finishing macOS changes, also run:

```bash
bun run check
git diff --check
```

Use `./macos/install.sh` only when an updated local installation is requested or needed for visual verification.
