#!/usr/bin/env bash
# Build a release APK for the RandChat admin app.
# NOT for Google Play — this is APK-only distribution for internal staff.
#
# Usage:
#   bash infra/scripts/build-admin-release.sh [version_name] [version_code]
#
# Prerequisites:
#   - Flutter SDK 3.24+
#   - Android SDK (compileSdk 34)
#   - A keystore for signing (see docs/admin-distribution.md for setup)
#
# Output:
#   apps/admin_app/build/app/outputs/flutter-apk/app-release.apk
set -euo pipepipefail

cd "$(dirname "$0")/.."

VERSION_NAME="${1:-0.1.0}"
VERSION_CODE="${2:-1}"

echo "→ Building RandChat admin app v${VERSION_NAME} (code ${VERSION_CODE})"

# Set version
cd apps/admin_app
flutter pub get

# Build release APK — no flavor (single config, APK-only).
flutter build apk \
  --release \
  --build-name="${VERSION_NAME}" \
  --build-number="${VERSION_CODE}" \
  --no-tree-shake-icons

APK_PATH="build/app/outputs/flutter-apk/app-release.apk"

if [ -f "$APK_PATH" ]; then
  SIZE=$(du -h "$APK_PATH" | cut -f1)
  echo ""
  echo "✓ Admin APK built successfully"
  echo "  Path: $APK_PATH"
  echo "  Size: $SIZE"
  echo "  Version: ${VERSION_NAME} (${VERSION_CODE})"
  echo ""
  echo "Distribute via:"
  echo "  - Direct download link (S3 + signed URL)"
  echo "  - Internal MDM (Mobile Device Management)"
  echo "  - Email attachment to authorized staff"
  echo ""
  echo "See docs/admin-distribution.md for signing setup + security checklist."
else
  echo "✗ Build failed — APK not found at $APK_PATH"
  exit 1
fi
