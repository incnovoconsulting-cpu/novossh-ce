#!/usr/bin/env bash
# Renders Icon-1024.png from icon.svg. Requires rsvg-convert (librsvg) or Inkscape.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ICONSET="$HERE/../NovoSSH/Resources/Assets.xcassets/AppIcon.appiconset"
SVG="$ICONSET/icon.svg"
OUT="$ICONSET/Icon-1024.png"

if command -v rsvg-convert >/dev/null 2>&1; then
  rsvg-convert -w 1024 -h 1024 "$SVG" -o "$OUT"
elif command -v inkscape >/dev/null 2>&1; then
  inkscape "$SVG" --export-type=png --export-filename="$OUT" -w 1024 -h 1024
else
  echo "Install librsvg (brew install librsvg) or Inkscape to render the icon." >&2
  exit 1
fi
echo "Wrote $OUT"
