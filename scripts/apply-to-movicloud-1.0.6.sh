#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   bash scripts/apply-to-movicloud-1.0.6.sh /path/to/movicloud-app-1.0.6
# Run from any directory. The script discovers its own repository root.
# Only intended for a CLEAN copy of official v1.0.6 sources.

if [[ $# -ne 1 ]]; then
  echo "Usage: bash scripts/apply-to-movicloud-1.0.6.sh /path/to/movicloud-app-1.0.6" >&2
  exit 2
fi

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
target="$(realpath "$1")"
if [[ ! -f "$target/package.json" || ! -f "$target/composables/useMoviCloudAPI.ts" || ! -f "$target/pages/[type]/[id].vue" ]]; then
  echo "Not a valid MoviCloud source directory: $target" >&2
  exit 1
fi
if ! grep -Eq '"version"[[:space:]]*:[[:space:]]*"1\.0\.6"' "$target/package.json"; then
  echo "Expected MoviCloud package.json version 1.0.6. Refusing to overwrite files." >&2
  exit 1
fi
for file in "composables/useMoviCloudAPI.ts" "pages/[type]/[id].vue" "server/api/pansou/search.post.ts"; do
  [[ -f "$root/$file" ]] || { echo "Missing integration file: $file" >&2; exit 1; }
done

backup="$target/.pansou-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$backup/composables" "$backup/pages/[type]"
cp -p "$target/composables/useMoviCloudAPI.ts" "$backup/composables/"
cp -p "$target/pages/[type]/[id].vue" "$backup/pages/[type]/"
mkdir -p "$target/server/api/pansou"
if [[ -f "$target/server/api/pansou/search.post.ts" ]]; then
  mkdir -p "$backup/server/api/pansou"
  cp -p "$target/server/api/pansou/search.post.ts" "$backup/server/api/pansou/"
fi

cp "$root/composables/useMoviCloudAPI.ts" "$target/composables/useMoviCloudAPI.ts"
cp "$root/pages/[type]/[id].vue" "$target/pages/[type]/[id].vue"
cp "$root/server/api/pansou/search.post.ts" "$target/server/api/pansou/search.post.ts"

echo "PanSou integration copied to: $target"
echo "Original files backed up under: $backup"
echo "IMPORTANT: Review the code diff, build and test. This does not install or modify running fnOS apps."
