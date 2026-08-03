#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
derived_data="${TMPDIR:-/tmp}/CyprusFuelDerivedData"
app_source="$derived_data/Build/Products/Release/CyprusFuel.app"
app_destination="/Applications/CyprusFuel.app"

rm -rf "$derived_data"
xcodebuild \
  -project "$script_dir/CyprusFuel.xcodeproj" \
  -scheme CyprusFuel \
  -configuration Release \
  -destination "platform=macOS,arch=arm64" \
  -derivedDataPath "$derived_data" \
  build

pkill -x CyprusFuel 2>/dev/null || true
rm -rf "$app_destination"
ditto "$app_source" "$app_destination"
rm -rf "$derived_data"

lsregister="/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"
"$lsregister" -f "$app_destination"
open "$app_destination"

printf '\nInstalled %s\n' "$app_destination"
printf 'Allow location in the app, then add “Cyprus Fuel Prices” from the macOS widget gallery.\n'
