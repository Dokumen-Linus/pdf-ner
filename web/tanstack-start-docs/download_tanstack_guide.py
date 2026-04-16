from __future__ import annotations

import json
from pathlib import Path
import sys
import urllib.request

OWNER = "TanStack"
REPO = "router"
REF = "main"
SRC_PATH = "docs/start/framework/react/guide"

SCRIPT_DIR = Path(__file__).resolve().parent
DEST_DIR = SCRIPT_DIR / "guide"


def gh_get(url: str) -> bytes:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "pdf-ner-downloader",
            "Accept": "application/vnd.github+json",
        },
    )
    with urllib.request.urlopen(req) as resp:
        return resp.read()


def download_dir(api_path: str, out_dir: Path) -> int:
    api_url = f"https://api.github.com/repos/{OWNER}/{REPO}/contents/{api_path}?ref={REF}"
    entries = json.loads(gh_get(api_url).decode("utf-8"))
    if not isinstance(entries, list):
        raise RuntimeError(f"Unexpected response for {api_url}: {entries!r}")

    out_dir.mkdir(parents=True, exist_ok=True)
    count = 0
    for entry in entries:
        name = entry["name"]
        etype = entry["type"]
        if etype == "dir":
            count += download_dir(f"{api_path}/{name}", out_dir / name)
        elif etype == "file":
            raw_url = entry["download_url"]
            if not raw_url:
                print(f"  skip (no download_url): {name}", file=sys.stderr)
                continue
            dest = out_dir / name
            print(f"  -> {dest.relative_to(SCRIPT_DIR)}")
            dest.write_bytes(gh_get(raw_url))
            count += 1
        else:
            print(f"  skip ({etype}): {name}", file=sys.stderr)
    return count


def main() -> int:
    print(f"Downloading {OWNER}/{REPO}@{REF}:{SRC_PATH}")
    print(f"Into: {DEST_DIR}")
    total = download_dir(SRC_PATH, DEST_DIR)
    print(f"Done. {total} file(s) downloaded.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
