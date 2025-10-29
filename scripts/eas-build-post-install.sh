#!/usr/bin/env bash

set -euo pipefail

echo "Copying google-services.json to android/app after prebuild..."

if [ -n "${GOOGLE_SERVICES_JSON:-}" ] && [ -d "android/app" ]; then
  cp "$GOOGLE_SERVICES_JSON" android/app/google-services.json
  echo "✓ google-services.json copied to android/app"
else
  echo "⚠ android/app directory not found or GOOGLE_SERVICES_JSON not set"
fi
