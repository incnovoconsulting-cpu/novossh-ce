#!/bin/bash
# Upload NovoSSH AAB to Google Play Console - Internal & Open Testing
set -e

PACKAGE="app.novossh.android"
AAB_PATH="app/build/outputs/bundle/release/app-release.aab"
SERVICE_ACCOUNT="/home/akm/NovoSSH/android/service-account.json"

echo "=== NovoSSH Play Store Upload ==="
echo "Package: $PACKAGE"
echo "AAB: $AAB_PATH"
echo ""

# Verify AAB exists
if [ ! -f "$AAB_PATH" ]; then
    echo "ERROR: AAB not found. Run ./gradlew bundleRelease first."
    exit 1
fi

echo "Size: $(du -h "$AAB_PATH" | cut -f1)"
echo ""

# Run Python upload script
python3 /home/akm/NovoSSH/android/upload-to-play.py
