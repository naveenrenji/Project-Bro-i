"""
Refresh local snapshot data for Streamlit Cloud deployments.
Pulls Slate API CSV, latest Census CSV, and latest Applications Excel file
based on .streamlit/secrets.toml (or env vars).
"""

from __future__ import annotations

import glob
import os
import shutil
import sys
from pathlib import Path

import requests

try:
    import tomllib  # Python 3.11+
except Exception:  # pragma: no cover - fallback for older runtimes
    tomllib = None


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def _load_secrets() -> dict:
    if tomllib is None:
        return {}
    secrets_path = _repo_root() / ".streamlit" / "secrets.toml"
    if not secrets_path.exists():
        return {}
    try:
        with secrets_path.open("rb") as f:
            return tomllib.load(f)
    except Exception:
        return {}


def _get_secret(secrets: dict, key: str, default: str = "") -> str:
    env_val = os.getenv(key.upper())
    if env_val:
        return env_val
    return str(secrets.get(key, default) or "")


def _latest_file(folder: str, pattern: str) -> str | None:
    if not folder or not os.path.exists(folder):
        return None
    files = glob.glob(os.path.join(folder, pattern))
    if not files:
        return None
    files.sort(key=os.path.getmtime, reverse=True)
    return files[0]


def refresh() -> int:
    secrets = _load_secrets()
    repo_root = _repo_root()

    slate_url = _get_secret(secrets, "slate_url")
    census_folder = _get_secret(secrets, "census_folder")
    data_folder = _get_secret(secrets, "data_folder")
    snapshot_folder = _get_secret(secrets, "snapshot_folder")

    snapshot_dir = Path(snapshot_folder) if snapshot_folder else repo_root / "data" / "snapshots"
    snapshot_dir.mkdir(parents=True, exist_ok=True)

    # 1) Slate snapshot
    if slate_url:
        try:
            resp = requests.get(slate_url, timeout=60)
            resp.raise_for_status()
            slate_path = snapshot_dir / "slate_latest.csv"
            slate_path.write_bytes(resp.content)
            print(f"[OK] Slate data saved: {slate_path}")
        except Exception as e:
            print(f"[WARN] Slate fetch failed: {e}")
    else:
        print("[SKIP] slate_url not set.")

    # 2) Applications snapshot (Excel preferred)
    apps_file = _latest_file(data_folder, "Online Applications CPE (Spring) YoY*.xlsx")
    if apps_file:
        dest = snapshot_dir / "apps_latest.xlsx"
        shutil.copy2(apps_file, dest)
        print(f"[OK] Applications snapshot saved: {dest}")
    else:
        print("[SKIP] No applications file found.")

    # 3) Census snapshot
    census_file = _latest_file(census_folder, "daily_census_file_*.csv")
    if census_file:
        dest = snapshot_dir / "census_latest.csv"
        shutil.copy2(census_file, dest)
        print(f"[OK] Census snapshot saved: {dest}")
    else:
        print("[SKIP] No census file found.")

    return 0


if __name__ == "__main__":
    sys.exit(refresh())
