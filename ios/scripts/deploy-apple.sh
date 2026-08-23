#!/bin/bash
set -euo pipefail

# ══════════════════════════════════════════════════════════════
# NovoSSH Apple Deployment Script
# Uses xtool CLI for iOS/macOS builds + App Store Connect upload
#
# Usage:
#   ./scripts/deploy-apple.sh                     # Build all, upload to TestFlight
#   ./scripts/deploy-apple.sh ios                 # Build iOS only
#   ./scripts/deploy-apple.sh macos               # Build macOS only
#   ./scripts/deploy-apple.sh all build-only       # Build all, skip upload
#   ./scripts/deploy-apple.sh ios testflight       # Build iOS + upload to TestFlight
#
# Required env vars:
#   ASC_KEY_ID       - App Store Connect API Key ID
#   ASC_ISSUER_ID    - App Store Connect Issuer ID
#   ASC_KEY          - App Store Connect .p8 private key (PEM content)
#
# Optional env vars:
#   ASC_KEY_PATH     - Path to .p8 file (default: ~/Downloads/AuthKey_<ASC_KEY_ID>.p8)
#   BUNDLE_ID        - App bundle ID (default: app.novossh.ios)
# ══════════════════════════════════════════════════════════════

PLATFORM="${1:-all}"
DESTINATION="${2:-testflight}"
BUNDLE_ID="${BUNDLE_ID:-app.novossh.ios}"
IOS_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${GREEN}[deploy]${NC} $1"; }
info() { echo -e "${BLUE}[info]${NC} $1"; }
warn() { echo -e "${YELLOW}[warn]${NC} $1"; }
err()  { echo -e "${RED}[error]${NC} $1"; exit 1; }

# ── Pre-flight checks ──────────────────────────────────
check_env() {
    local missing=()
    [[ -z "${ASC_KEY_ID:-}" ]]     && missing+=("ASC_KEY_ID")
    [[ -z "${ASC_ISSUER_ID:-}" ]]  && missing+=("ASC_ISSUER_ID")
    [[ -z "${ASC_KEY:-}" ]]        && missing+=("ASC_KEY")
    if [[ ${#missing[@]} -gt 0 ]]; then
        err "Missing required env vars: ${missing[*]}\n  export ASC_KEY_ID=...\n  export ASC_ISSUER_ID=...\n  export ASC_KEY=...\$(cat ~/Downloads/AuthKey_XXX.p8)"
    fi
    log "Environment vars OK"
}

check_tools() {
    local missing=()
    command -v xtool &>/dev/null  || missing+=("xtool")
    command -v swift &>/dev/null  || missing+=("swift")
    if [[ "$DESTINATION" != "build-only" && "$PLATFORM" != "devices" && "$PLATFORM" != "certs" && "$PLATFORM" != "profiles" ]]; then
        command -v fastlane &>/dev/null || missing+=("fastlane")
        command -v bundle &>/dev/null   || missing+=("bundle")
    fi
    if [[ ${#missing[@]} -gt 0 ]]; then
        err "Missing tools: ${missing[*]}"
    fi
    log "Tools OK"
}

# ── xtool auth (ASC API Key) ──────────────────────────
configure_xtool_auth() {
    log "Configuring xtool auth (ASC API Key)..."
    mkdir -p ~/.config/xtool/data

    python3 - <<PYEOF
import json, os
token = {
    "appStoreConnect": {
        "_0": {
            "id": os.environ["ASC_KEY_ID"],
            "issuerID": os.environ["ASC_ISSUER_ID"],
            "pem": os.environ["ASC_KEY"]
        }
    }
}
path = os.path.expanduser("~/.config/xtool/data/XTLAuthToken")
with open(path, "w") as f:
    json.dump(token, f)
print(f"Auth token written to {path}")
PYEOF

    xtool auth status
}

# ── xtool SDK ──────────────────────────────────────────
ensure_sdk() {
    local status
    status=$(xtool sdk status 2>&1 || true)
    if echo "$status" | grep -q "Not installed"; then
        warn "Darwin SDK not installed. Attempting install..."
        local xcode_paths=(
            "/Applications/Xcode_16.2.app"
            "/Applications/Xcode_16.1.app"
            "/Applications/Xcode.app"
        )
        local found=false
        for p in "${xcode_paths[@]}"; do
            if [[ -d "$p" ]]; then
                log "Installing SDK from $p..."
                xtool sdk install "$p"
                found=true
                break
            fi
        done
        if ! $found; then
            err "No Xcode installation found. Install Xcode and re-run."
        fi
    else
        log "SDK: $status"
    fi
}

# ── iOS build ──────────────────────────────────────────
build_ios() {
    log "═══ Building iOS ═══"
    cd "$IOS_DIR"

    xtool dev build \
        --configuration release \
        --ipa \
        --triple arm64-apple-ios

    local ipa_path
    ipa_path=$(find xtool -name "*.ipa" -type f 2>/dev/null | head -1)
    if [[ -z "$ipa_path" ]]; then
        err "No IPA found after build"
    fi

    local size
    size=$(du -h "$ipa_path" | cut -f1)
    log "iOS IPA built: $ipa_path ($size)"
    echo "$ipa_path"
}

# ── macOS build ────────────────────────────────────────
build_macos() {
    log "═══ Building macOS ═══"
    cd "$IOS_DIR"

    xtool dev build \
        --configuration release \
        --triple arm64-apple-macosx

    local app_path
    app_path=$(find .build -name "*.app" -type d 2>/dev/null | grep -v iPhoneOS | head -1)
    if [[ -z "$app_path" ]]; then
        err "No macOS .app found after build"
    fi

    log "macOS app built: $app_path"
    echo "$app_path"
}

# ── Upload to TestFlight via fastlane ────────────────────
upload_testflight() {
    local ipa_path="$1"
    log "═══ Uploading to TestFlight ═══"
    log "App: $BUNDLE_ID"
    log "IPA: $ipa_path"

    cd "$IOS_DIR"

    # Ensure Gemfile dependencies are installed
    if [[ -f Gemfile ]]; then
        bundle install --quiet 2>/dev/null || true
    fi

    # Set up fastlane ASC API key for pilot
    export APP_STORE_CONNECT_API_KEY_KEY_ID="$ASC_KEY_ID"
    export APP_STORE_CONNECT_API_KEY_ISSUER_ID="$ASC_ISSUER_ID"
    export APP_STORE_CONNECT_API_KEY_KEY="$ASC_KEY"

    bundle exec fastlane pilot upload \
        --ipa "$ipa_path" \
        --skip_waiting_for_build_processing true \
        --app_identifier "$BUNDLE_ID"

    log "Upload complete! Check TestFlight for processing status."
}

# ── xtool DS: list devices ──────────────────────────────
list_devices() {
    log "═══ Registered Devices ═══"
    xtool ds devices list 2>/dev/null || warn "Could not list devices"
}

# ── xtool DS: list certificates ─────────────────────────
list_certificates() {
    log "═══ Certificates ═══"
    xtool ds certificates list 2>/dev/null || warn "Could not list certificates"
}

# ── xtool DS: list profiles ──────────────────────────────
list_profiles() {
    log "═══ Provisioning Profiles ═══"
    xtool ds profiles list 2>/dev/null || warn "Could not list profiles"
}

# ── Main ───────────────────────────────────────────────
main() {
    echo ""
    echo -e "${BLUE}╔══════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║   NovoSSH Apple Deployment                   ║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════╝${NC}"
    echo ""
    log "Platform: $PLATFORM | Destination: $DESTINATION"
    echo ""

    check_env
    check_tools
    configure_xtool_auth
    ensure_sdk

    case "$PLATFORM" in
        ios)
            IPA_PATH=$(build_ios)
            if [[ "$DESTINATION" == "testflight" ]]; then
                upload_testflight "$IPA_PATH"
            fi
            ;;
        macos)
            APP_PATH=$(build_macos)
            log "macOS build complete at: $APP_PATH"
            ;;
        all)
            IPA_PATH=$(build_ios)
            APP_PATH=$(build_macos)
            if [[ "$DESTINATION" == "testflight" ]]; then
                upload_testflight "$IPA_PATH"
            fi
            ;;
        devices)
            list_devices
            ;;
        certs)
            list_certificates
            ;;
        profiles)
            list_profiles
            ;;
        *)
            err "Unknown platform: $PLATFORM\n  Valid: ios, macos, all, devices, certs, profiles"
            ;;
    esac

    echo ""
    log "Done!"
}

main "$@"
