#!/usr/bin/env bash
set -euo pipefail

if [[ -f .env ]]; then
  set -a
  source .env
  set +a
fi

: "${PUBLIC_BASE_URL:?PUBLIC_BASE_URL is required}"
: "${RUNPOD_AUTO_STOP_TOKEN:?RUNPOD_AUTO_STOP_TOKEN is required}"

curl --fail --silent --show-error \
  -X POST \
  -H "X-Auto-Stop-Token: ${RUNPOD_AUTO_STOP_TOKEN}" \
  -H "Content-Type: application/json" \
  "${PUBLIC_BASE_URL%/}/api/runpod/auto-stop" \
  --data '{}'
