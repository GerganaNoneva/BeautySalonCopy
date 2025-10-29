#!/usr/bin/env bash

set -euo pipefail

echo "Creating google-services.json from environment variable..."

if [ -n "${GOOGLE_SERVICES_JSON:-}" ]; then
  # Copy to root for prebuild
  cp "$GOOGLE_SERVICES_JSON" google-services.json
  echo "✓ google-services.json created in root"

  # Also copy to android/app if it exists (post-prebuild)
  if [ -d "android/app" ]; then
    cp "$GOOGLE_SERVICES_JSON" android/app/google-services.json
    echo "✓ google-services.json copied to android/app"
  fi
else
  echo "⚠ GOOGLE_SERVICES_JSON environment variable not found"
  exit 1
fi
