#!/usr/bin/env bash
set -euo pipefail

# After successfully running npm run build:fnOS:
# bash scripts/pack-fnos.sh /path/to/movicloud-pansou-release /path/to/movicloud-pansou
#
# Updates ONLY the local FPK project (not the installed fnOS application).
if [[ $# -lt 2 || $# -gt 3 ]]; then
  echo "Usage: bash scripts/pack-fnos.sh <built-source-dir> <fpk-project-dir> [new-version]" >&2
  exit 2
fi
src="$(realpath "$1")"
fpk="$(realpath "$2")"
[[ -f "$src/dist/fnOS/server/index.mjs" ]] || { echo "Missing Nuxt fnOS output" >&2; exit 1; }
[[ -f "$src/dist/fnOS/server/chunks/routes/api/pansou/search.post.mjs" ]] || { echo "PanSou route is missing from build output" >&2; exit 1; }
[[ -f "$fpk/manifest" && -f "$fpk/cmd/main" && -f "$fpk/app/ui/config" ]] || { echo "Not an fnpack app project" >&2; exit 1; }
[[ -x "$fpk/app/bin/node" ]] || { echo "Missing executable $fpk/app/bin/node" >&2; exit 1; }
command -v fnpack >/dev/null || { echo "fnpack not found" >&2; exit 1; }

# For an in-place fnOS upgrade, keep the same appname and use a HIGHER
# numeric manifest version. Never change or delete installed data.
current_version="$(sed -nE 's/^[[:space:]]*version[[:space:]]*=[[:space:]]*([0-9]+\.[0-9]+\.[0-9]+)[[:space:]]*$/\1/p' "$fpk/manifest" | head -1)"
[[ -n "$current_version" ]] || { echo "Invalid or missing manifest version" >&2; exit 1; }
if [[ $# -eq 3 ]]; then
  new_version="$3"
  [[ "$new_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "Version must be numeric X.Y.Z" >&2; exit 1; }
  [[ "$new_version" != "$current_version" && "$(printf '%s\n%s\n' "$current_version" "$new_version" | sort -V | tail -1)" == "$new_version" ]] || { echo "New version must be greater than current manifest version $current_version" >&2; exit 1; }
  sed -i -E "s/^([[:space:]]*version[[:space:]]*=[[:space:]]*)[0-9]+\.[0-9]+\.[0-9]+([[:space:]]*)$/\1$new_version\2/" "$fpk/manifest"
  echo "FPK manifest version: $current_version -> $new_version"
else
  echo "FPK manifest version: $current_version (unchanged). For an upgrade, pass a higher third argument."
fi

bash -n "$fpk/cmd/main"
grep -q '^appname[[:space:]]*=[[:space:]]*movicloud-pansou' "$fpk/manifest" || { echo "Unexpected appname in manifest" >&2; exit 1; }
grep -q 'MOV_DATA_DIR' "$fpk/cmd/main" || { echo "Missing isolated MOV_DATA_DIR" >&2; exit 1; }
grep -q 'PANSOU_API_URL' "$fpk/cmd/main" || { echo "Missing PanSou API setting" >&2; exit 1; }
grep -q '127.0.0.1:8088' "$fpk/cmd/main" || { echo "Check reachable PanSou URL in cmd/main" >&2; exit 1; }

port_script="$(sed -nE 's/^[[:space:]]*PORT=([0-9]+).*$/\1/p' "$fpk/cmd/main" | head -1)"
port_manifest="$(sed -nE 's/^[[:space:]]*service_port[[:space:]]*=[[:space:]]*([0-9]+).*$/\1/p' "$fpk/manifest" | head -1)"
[[ -n "$port_script" && "$port_script" == "$port_manifest" ]] || { echo "Port mismatch between cmd/main and manifest" >&2; exit 1; }
grep -q "$port_script" "$fpk/app/ui/config" || { echo "Port mismatch in app/ui/config" >&2; exit 1; }

timestamp="$(date +%Y%m%d-%H%M%S)"
if [[ -d "$fpk/app/runtime/fnOS" ]]; then
  backup_dir="$(dirname "$fpk")/.fnos-build-backups"
  mkdir -p "$backup_dir"
  mv "$fpk/app/runtime/fnOS" "$backup_dir/fnOS-$timestamp"
fi
mkdir -p "$fpk/app/runtime"
cp -a "$src/dist/fnOS" "$fpk/app/runtime/fnOS"

(
  cd "$fpk"
  fnpack build
  test -s movicloud-pansou.fpk
  echo "--- FPK SHA256 ---"
  sha256sum movicloud-pansou.fpk
  echo "--- FPK size ---"
  ls -lh movicloud-pansou.fpk
)
echo "Pack complete; existing installed fnOS app was NOT modified."
