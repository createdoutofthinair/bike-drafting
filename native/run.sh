#!/usr/bin/env bash
set -euo pipefail
project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fluidx_dir="${BIKE_FLUIDX_DIR:-$project_root/external/FluidX3D}"
fluidx_pin=dbf0bb5b19233668672f73a0865a41424651a09c
if [[ ! -d "$fluidx_dir" ]]; then
  git clone https://github.com/ProjectPhysX/FluidX3D.git "$fluidx_dir"
  git -C "$fluidx_dir" checkout --detach "$fluidx_pin"
fi
python3 "$project_root/native/configure.py" "$fluidx_dir" "$@"
cd "$fluidx_dir"
if [[ "${1:-}" == --interactive ]]; then
  make Linux-X11 -j2
else
  make Linux -j2
fi
exec bin/FluidX3D
