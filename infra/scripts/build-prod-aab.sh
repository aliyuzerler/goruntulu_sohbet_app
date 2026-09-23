#!/usr/bin/env bash
# Build production AAB for RandChat user_app — Google Play Console upload.
#
# Usage:
#   bash infra/scripts/build-prod-aab.sh [version_name] [version_code]
#
# Prerequisites:
#   - Flutter SDK 3.24+
#   - Android SDK (compileSdk 34)
#   - Release keystore (see android/key.properties)
#
# Output:
#   apps/user_app/build/app/outputs/bundle/release/app-prod-release.aab
set -euo pipefail

cd "$(dirname "$0")/.."

VERSION_NAME="${1:-1.0.0}"
VERSION_CODE="${2:-1}"

echo "→ Building RandChat user_app AAB v${VERSION_NAME} (code ${VERSION_CODE})"

cd apps/user_app
flutter pub get

# Build AAB (Android App Bundle) for Play Console upload.
# Uses prod flavor + prod entry point + R8 minification.
flutter build appbundle \
  --release \
  --flavor prod \
  -t lib/main/main_prod.dart \
  --build-name="${VERSION_NAME}" \
  --build-number="${VERSION_CODE}" \
  --no-tree-shake-icons

AAB_PATH="build/app/outputs/bundle/release/app-prod-release.aab"

if [ -f "$AAB_PATH" ]; then
  SIZE=$(du -h "$AAB_PATH" | cut -f1)
  echo ""
  echo "✓ AAB built successfully"
  echo "  Path: $AAB_PATH"
  echo "  Size: $SIZE"
  echo "  Version: ${VERSION_NAME} (${VERSION_CODE})"
  echo ""
  echo "Upload to Play Console:"
  echo "  1. Play Console → Production → Create new release"
  echo "  2. Upload app-prod-release.aab"
  echo "  3. Set rollout: internal → closed → staged (10% → 50% → 100%)"
  echo ""
  echo "For internal testing track:"
  echo "  Play Console → Internal testing → Upload same AAB"
  echo "  Add testers by email → they get opt-in URL"
else
  echo "✗ Build failed — AAB not found at $AAB_PATH"
  exit 1
fi
