"""
make_full_package_json.py

Reads every module in web/node_modules, extracts name and version from
each package.json, then writes full_package.json by copying web/package.json
(minus dependencies and devDependencies) with a single locked dependencies
dict containing every discovered module.
"""

import json
import re
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
WEB_DIR = SCRIPT_DIR.parent
NODE_MODULES_DIR = WEB_DIR / "node_modules"
SOURCE_PACKAGE_JSON = WEB_DIR / "package.json"
OUTPUT_FILE = SCRIPT_DIR / "full_package.json"


def strip_caret_tilde(version: str) -> str:
    """Remove leading ^ or ~ from a version string."""
    return re.sub(r"^[\^~]", "", version)


def collect_packages(node_modules: Path) -> dict[str, str]:
    """
    Walk node_modules and return {name: version} for every package found.

    Handles both top-level packages and scoped packages (@scope/name).
    Skips directories that are not real packages (e.g. .bin, .cache, .vite).
    """
    packages: dict[str, str] = {}

    for entry in node_modules.iterdir():
        if not entry.is_dir():
            continue

        name = entry.name

        if name.startswith("."):
            # Skip internal directories like .bin, .cache, .package-lock.json
            continue

        if name.startswith("@"):
            # Scoped package — iterate the scope directory
            for scoped_entry in entry.iterdir():
                if not scoped_entry.is_dir():
                    continue
                pkg_json_path = scoped_entry / "package.json"
                if pkg_json_path.exists():
                    try:
                        with open(pkg_json_path, encoding="utf-8") as f:
                            data = json.load(f)
                        pkg_name = data.get("name")
                        pkg_version = data.get("version")
                        if pkg_name and pkg_version:
                            packages[pkg_name] = strip_caret_tilde(pkg_version)
                    except (json.JSONDecodeError, OSError):
                        pass
        else:
            # Regular (unscoped) package
            pkg_json_path = entry / "package.json"
            if pkg_json_path.exists():
                try:
                    with open(pkg_json_path, encoding="utf-8") as f:
                        data = json.load(f)
                    pkg_name = data.get("name")
                    pkg_version = data.get("version")
                    if pkg_name and pkg_version:
                        packages[pkg_name] = strip_caret_tilde(pkg_version)
                except (json.JSONDecodeError, OSError):
                    pass

    return packages


def main() -> None:
    if not NODE_MODULES_DIR.exists():
        raise FileNotFoundError(f"node_modules not found at {NODE_MODULES_DIR}")

    if not SOURCE_PACKAGE_JSON.exists():
        raise FileNotFoundError(f"package.json not found at {SOURCE_PACKAGE_JSON}")

    # Load existing package.json as the base
    with open(SOURCE_PACKAGE_JSON, encoding="utf-8") as f:
        base = json.load(f)

    # Remove both dependency sections
    base.pop("dependencies", None)
    base.pop("devDependencies", None)

    # Collect all modules from node_modules
    print(f"Scanning {NODE_MODULES_DIR} ...")
    packages = collect_packages(NODE_MODULES_DIR)
    print(f"Found {len(packages)} packages.")

    # Sort alphabetically for a clean, deterministic output
    base["dependencies"] = dict(sorted(packages.items()))

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(base, f, indent=2)
        f.write("\n")

    print(f"Written to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
