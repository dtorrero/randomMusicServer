#!/usr/bin/env bash
set -euo pipefail

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

export MUSIC_DIR=${MUSIC_DIR:-./music}
export DATA_DIR=${DATA_DIR:-./data}
export SCAN_ON_START=${SCAN_ON_START:-true}

python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
