#!/bin/bash
# ios/scripts/setup-fastlane.sh
# One-time Fastlane setup for NovoSSH iOS
#
# Prerequisites:
#   - macOS with Xcode 15+
#   - Ruby 3.0+
#   - Homebrew
#
# Usage:
#   cd ios
#   ./scripts/setup-fastlane.sh

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=== NovoSSH iOS Fastlane Setup ===${NC}"
echo ""

# Check prerequisites
if ! command -v ruby &> /dev/null; then
    echo -e "${YELLOW}Ruby not found. Installing via Homebrew...${NC}"
    brew install ruby
fi

if ! command -v brew &> /dev/null; then
    echo "ERROR: Homebrew not found. Install from https://brew.sh"
    exit 1
fi

# Install dependencies
echo -e "${GREEN}Installing Ruby dependencies...${NC}"
bundle install

# Install XcodeGen
echo -e "${GREEN}Installing XcodeGen...${NC}"
brew install xcodegen || true

# Install librsvg for icon rendering
echo -e "${GREEN}Installing librsvg for icon rendering...${NC}"
brew install librsvg || true

# Generate icon
echo -e "${GREEN}Generating app icon...${NC}"
if [ -f scripts/render-icon.sh ]; then
    ./scripts/render-icon.sh
fi

# Generate Xcode project
echo -e "${GREEN}Generating Xcode project...${NC}"
xcodegen generate

echo ""
echo -e "${GREEN}=== Setup Complete ===${NC}"
echo ""
echo "Next steps:"
echo "  1. Open NovoSSH.xcodeproj in Xcode"
echo "  2. Select NovoSSH target → Signing & Capabilities → choose your team"
echo "  3. Edit fastlane/Appfile with your Apple ID and Team ID"
echo "  4. Set up code signing: bundle exec fastlane ios certs"
echo "  5. Build for TestFlight: bundle exec fastlane ios beta"
echo ""
echo "For CI/CD, set these GitHub secrets:"
echo "  - APPLE_ID: Your Apple ID email"
echo "  - TEAM_ID: 10-character team ID"
echo "  - MATCH_PASSWORD: Password for encrypted certs repo"
echo "  - MATCH_GIT_BASIC_AUTH: Base64-encoded git credentials"
echo "  - ASC_KEY_ID: App Store Connect API Key ID"
echo "  - ASC_ISSUER_ID: App Store Connect Issuer ID"
echo "  - ASC_KEY: App Store Connect API Key (.p8 content)"
