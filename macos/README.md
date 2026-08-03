# Cyprus Fuel macOS widget

A local macOS 14+ SwiftUI app with a medium WidgetKit widget. It reads public fuel snapshots from:

```text
https://asv.github.io/cyprus-fuel-map/data/
```

The widget supports all five fuel types and either automatic location or one of Famagusta, Larnaca, Limassol, Nicosia, and Paphos. It shows the Cyprus-wide minimum and average, the average among online stations within a 15 km straight-line radius, and the nearest online station. When price history is available, the Cyprus minimum also shows its change over the preceding 24 hours.

## Install

Requirements:

- Apple Silicon Mac running macOS 14 or newer
- Xcode 16.4 or newer

From the repository root:

```bash
./macos/install.sh
```

The script creates a local ad-hoc signed release build, installs it as `/Applications/CyprusFuel.app`, registers its widget, and opens the setup app. No Apple Developer Program membership is required.

Then:

1. Select **Allow Location** in Cyprus Fuel and accept the system prompt.
2. Right-click the desktop and select **Edit Widgets**.
3. Search for **Cyprus Fuel Prices** and add its medium widget.
4. Right-click the widget and select **Edit Cyprus Fuel Prices** to change fuel or use a fixed city.

Xcode and Cyprus Fuel do not need to remain open after installation.

## Build without installing

```bash
xcodebuild \
  -project macos/CyprusFuel.xcodeproj \
  -scheme CyprusFuel \
  -configuration Debug \
  -destination 'platform=macOS,arch=arm64' \
  -derivedDataPath macos/DerivedData \
  build
```

## Behavior

- Unleaded 95 is the default fuel.
- Automatic mode requests a coarse current location from Core Location.
- Fixed-city mode uses the selected city center and does not require location access.
- Snapshot and global history JSON are cached in the widget extension's caches directory and used if GitHub Pages is temporarily unavailable.
- History is optional. A missing or unavailable history file hides the 24-hour trend without preventing current prices from loading.
- The widget uses an adaptive emerald background with separate Light and Dark appearance colors.
- WidgetKit controls the exact refresh time; the widget requests a new timeline after one hour.
- Selecting the widget opens the public web map.
