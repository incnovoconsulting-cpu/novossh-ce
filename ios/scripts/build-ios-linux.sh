#!/bin/bash
set -euo pipefail

# ══════════════════════════════════════════════════════════════
# NovoSSH Linux Build Script (xtool + Swift cross-compilation)
#
# STATUS: PARTIAL — Swift source compilation works but C/C++
# compilation fails because Linux clang cannot handle Apple's
# ARM NEON headers and framework module maps.
#
# ROOT CAUSE: The xtool Darwin SDK bundles Apple headers and
# libraries but NOT Apple's clang. Linux's LLVM clang cannot
# compile Apple-specific C/C++ code (NEON intrinsics, ObjC
# modules like MetalKit, ModelIO, simd).
#
# SOLUTION: Use the CI/CD pipeline on macOS runners.
# This script is for Swift SOURCE VERIFICATION only — it confirms
# that Swift cross-compilation targets resolve correctly.
#
# For actual builds, use:
#   macOS:  xtool dev build --configuration release --ipa --triple arm64-apple-ios
#   CI/CD:  .github/workflows/release-apple.yml (macos-14 runners)
# ══════════════════════════════════════════════════════════════

IOS_DIR="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="/opt/swift-6.1.1-RELEASE-ubuntu24.04/usr/bin:$PATH"

log() { echo -e "\033[0;32m[build]\033[0m $1"; }
warn() { echo -e "\033[1;33m[warn]\033[0m $1"; }
err() { echo -e "\033[0;31m[error]\033[0m $1"; exit 1; }

cd "$IOS_DIR"

# ── Resolve packages ──
log "Resolving packages..."
swift package resolve 2>&1 | tail -3

# ── Patch SwiftTerm for Linux cross-compilation ──
SWIFTPM_TERM=".build/checkouts/SwiftTerm/Package.swift"
if [[ -f "$SWIFTPM_TERM" ]] && grep -q 'os(Linux)' "$SWIFTPM_TERM" 2>/dev/null; then
    log "Patching SwiftTerm Package.swift..."
    chmod u+w "$SWIFTPM_TERM"
    python3 -c "
with open('$SWIFTPM_TERM') as f: c = f.read()
c = c.replace('#if os(Linux) || os(Windows)\nlet platformExcludes = [\"Apple\", \"Mac\", \"iOS\"]', '#if os(Windows)\nlet platformExcludes = [\"Mac\"]')
with open('$SWIFTPM_TERM', 'w') as f: f.write(c)
print('Patched')
"
fi

# ── Build (will fail on NEON/framework modules — expected on Linux) ──
log "Building (expected to fail on C compilation — Linux clang limitation)..."
swift build --swift-sdk darwin --triple arm64-apple-ios -c release 2>&1 | \
    grep -E "error:|Build complete|Linking|Wrote|TTImage" | tail -10

warn "Build completed with expected errors on Linux."
warn "For actual builds, use the CI/CD pipeline: .github/workflows/release-apple.yml"
warn "Or build on macOS: xtool dev build --configuration release --ipa --triple arm64-apple-ios"
