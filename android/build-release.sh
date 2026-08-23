#!/bin/bash
# NovoSSH Android Release Build Script
# Builds signed APK/AAB for Google Play Store submission

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}NovoSSH Android Release Build${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

if [ ! -f "keystores.properties" ]; then
    echo -e "${RED}ERROR: keystores.properties not found!${NC}"
    echo ""
    echo "Steps to fix:"
    echo "1. Copy keystores.properties.example to keystores.properties:"
    echo "   cp keystores.properties.example keystores.properties"
    echo ""
    echo "2. Edit keystores.properties with your signing keystore details:"
    echo "   - storeFile: path to novossh.keystore"
    echo "   - storePassword: keystore password"
    echo "   - keyAlias: novossh-key"
    echo "   - keyPassword: key password"
    echo ""
    echo "3. If you don't have a keystore yet, generate one:"
    echo "   keytool -genkey -v -keystore novossh.keystore -alias novossh-key \\"
    echo "     -keyalg RSA -keysize 2048 -validity 10000"
    echo ""
    exit 1
fi

if ! command -v ./gradlew &> /dev/null; then
    echo -e "${RED}ERROR: gradlew not found!${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Prerequisites OK${NC}"
echo ""

# Parse arguments
BUILD_TYPE=${1:-aab}  # Default to AAB (App Bundle)

case "$BUILD_TYPE" in
    aab|bundle)
        echo -e "${YELLOW}Building Android App Bundle (AAB)...${NC}"
        BUILD_CMD="bundleRelease"
        OUTPUT_PATH="app/build/outputs/bundle/release/app-release.aab"
        ;;
    apk)
        echo -e "${YELLOW}Building APK...${NC}"
        BUILD_CMD="assembleRelease"
        OUTPUT_PATH="app/build/outputs/apk/release/app-release.apk"
        ;;
    *)
        echo -e "${RED}Unknown build type: $BUILD_TYPE${NC}"
        echo "Usage: ./build-release.sh [aab|apk]"
        exit 1
        ;;
esac

echo ""

# Clean build
echo -e "${YELLOW}Cleaning previous builds...${NC}"
./gradlew clean
echo -e "${GREEN}✓ Clean complete${NC}"
echo ""

# Build release
echo -e "${YELLOW}Building release...${NC}"
./gradlew $BUILD_CMD

if [ ! -f "$OUTPUT_PATH" ]; then
    echo -e "${RED}ERROR: Build output not found!${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Build complete${NC}"
echo ""

# Show build info
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}Build Summary${NC}"
echo -e "${GREEN}======================================${NC}"
echo "Build Type: $BUILD_TYPE"
echo "Output: $OUTPUT_PATH"
echo "Size: $(du -h "$OUTPUT_PATH" | cut -f1)"
echo ""

# Verify signature (for APK)
if [ "$BUILD_TYPE" = "apk" ]; then
    echo -e "${YELLOW}Verifying APK signature...${NC}"
    if jarsigner -verify -verbose "$OUTPUT_PATH" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ APK signature valid${NC}"
    else
        echo -e "${YELLOW}⚠ Could not verify signature${NC}"
    fi
    echo ""
fi

# Next steps
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}Next Steps${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo "1. Test on Android device:"
if [ "$BUILD_TYPE" = "apk" ]; then
    echo "   adb install -r $OUTPUT_PATH"
else
    echo "   # Use Play Console internal testing track"
fi
echo ""
echo "2. Upload to Google Play Console:"
echo "   - Go to https://play.google.com/console"
echo "   - Select your app"
if [ "$BUILD_TYPE" = "aab" ]; then
    echo "   - Create a new release (Production or Internal Testing)"
    echo "   - Upload: $OUTPUT_PATH"
else
    echo "   - Upload APK to internal testing track first"
fi
echo ""
echo "3. Fill in Play Store listing:"
echo "   - App description and graphics"
echo "   - Privacy policy and permissions"
echo "   - Content rating questionnaire"
echo ""
echo "4. Submit for review"
echo "   - Typical review time: 24-48 hours for new apps"
echo "   - Monitor Play Console for approval/rejection"
echo ""

# Open release notes editor (optional)
echo -e "${YELLOW}Do you want to edit release notes? (y/n)${NC}"
read -r -t 5 EDIT_NOTES || EDIT_NOTES="n"
if [ "$EDIT_NOTES" = "y" ] || [ "$EDIT_NOTES" = "Y" ]; then
    NOTES_FILE="release-notes-$(date +%s).txt"
    cat > "$NOTES_FILE" << 'EOF'
# Release Notes for v1.0.0
# Paste your release notes above this line

[Paste release notes above and save]
EOF
    ${EDITOR:-nano} "$NOTES_FILE"
    echo "Release notes saved to: $NOTES_FILE"
fi

echo ""
echo -e "${GREEN}Build completed successfully!${NC}"
