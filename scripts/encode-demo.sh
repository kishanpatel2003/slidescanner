#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat >&2 <<'EOF'
Usage: pnpm demo:encode [start_seconds] [end_timestamp]

Encodes the newest .webm in recordings/ to slidescanner-demo.mp4.
Defaults: start_seconds=1.0, end_timestamp=15.4
Set SPEED to override the speed-up factor (default 1.28), e.g. SPEED=1.15.
EOF
}

if [[ "${1:-}" == "--" ]]; then
  shift
fi

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if (($# > 2)); then
  usage
  exit 2
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ERROR: ffmpeg is required but was not found on PATH." >&2
  echo "Install ffmpeg, then rerun: pnpm demo:encode" >&2
  exit 127
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RECORDINGS_DIR="$ROOT_DIR/recordings"
OUTPUT="$ROOT_DIR/slidescanner-demo.mp4"
START_SECONDS="${1:-1.0}"
END_TIMESTAMP="${2:-15.4}"
SPEED="${SPEED:-1.28}"

if [[ ! -d "$RECORDINGS_DIR" ]]; then
  echo "ERROR: recordings directory does not exist: $RECORDINGS_DIR" >&2
  echo "Run pnpm demo:record first." >&2
  exit 1
fi

latest=""
latest_mtime=0
while IFS= read -r -d '' candidate; do
  candidate_mtime="$(stat -f '%m' "$candidate" 2>/dev/null || stat -c '%Y' "$candidate")"
  if [[ -z "$latest" || "$candidate_mtime" -gt "$latest_mtime" ]]; then
    latest="$candidate"
    latest_mtime="$candidate_mtime"
  fi
done < <(find "$RECORDINGS_DIR" -maxdepth 1 -type f -name '*.webm' -print0)

if [[ -z "$latest" ]]; then
  echo "ERROR: no .webm recordings found in $RECORDINGS_DIR" >&2
  echo "Run pnpm demo:record first." >&2
  exit 1
fi

echo "Encoding $latest"
echo "Trim: -ss $START_SECONDS -to $END_TIMESTAMP"
echo "Output: $OUTPUT"

ffmpeg -y -hide_banner \
  -ss "$START_SECONDS" \
  -to "$END_TIMESTAMP" \
  -i "$latest" \
  -vf "setpts=PTS/${SPEED},fps=60" \
  -an \
  -c:v libx264 \
  -crf 18 \
  -pix_fmt yuv420p \
  -movflags +faststart \
  "$OUTPUT"
