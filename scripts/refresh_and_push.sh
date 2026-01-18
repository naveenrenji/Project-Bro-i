#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PY="$REPO_DIR/.venv/bin/python"

if [[ ! -x "$PY" ]]; then
  echo "Missing virtualenv at $PY. Create it first."
  exit 1
fi

"$PY" "$REPO_DIR/scripts/refresh_data.py"

cd "$REPO_DIR"
git add data/snapshots

if git diff --cached --quiet; then
  echo "No snapshot changes to commit."
  exit 0
fi

ts="$(date -u +"%Y-%m-%d %H:%M UTC")"
git commit -m "data refresh: $ts"
git push
