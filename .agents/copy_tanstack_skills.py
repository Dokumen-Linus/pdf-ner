import re
import os
import shutil
from pathlib import Path

PROJECT_ROOT = Path(r"C:\Users\zchar\Desktop\pdf-ner")
NODE_MODULES = PROJECT_ROOT / "web" / "node_modules" / "@tanstack"
SKILLS_DIR = PROJECT_ROOT / ".claude" / "skills"

SKIP_FOLDERS = ["lifecycle", "virtual-file-routes"]


def find_tanstack_packages_with_skills():
    packages = []
    if not NODE_MODULES.exists():
        print(f"Node modules path does not exist: {NODE_MODULES}")
        return packages

    for package_dir in NODE_MODULES.iterdir():
        if package_dir.is_dir():
            skills_path = package_dir / "skills"
            if skills_path.exists():
                packages.append((package_dir.name, skills_path))
    return packages


def get_dest_skill_name(skill_dir_name: str) -> str:
    if skill_dir_name.startswith("tanstack-"):
        return skill_dir_name
    return f"tanstack-{skill_dir_name}"


def update_skill_name(dest_skill: Path):
    skill_md = dest_skill / "SKILL.md"
    if not skill_md.exists():
        return

    content = skill_md.read_text(encoding="utf-8")
    lines = content.split("\n")

    if len(lines) < 2:
        return

    line2 = lines[1]
    match = re.match(r"^name:\s*(\S+)$", line2)
    if not match:
        return

    old_name = match.group(1)
    if old_name.startswith("tanstack-"):
        return

    new_name = f"tanstack-{old_name}"
    lines[1] = f"name: {new_name}"

    skill_md.write_text("\n".join(lines), encoding="utf-8")
    print(f"  Updated SKILL.md name: {old_name} -> {new_name}")


def copy_skills_folder(package_name: str, source_skills: Path):
    for skill_dir in source_skills.iterdir():
        if not skill_dir.is_dir():
            continue

        if skill_dir.name in SKIP_FOLDERS:
            print(f"Skipping {skill_dir.name} (in SKIP_FOLDERS)")
            continue

        dest_name = get_dest_skill_name(skill_dir.name)
        dest_skill = SKILLS_DIR / dest_name

        if dest_skill.exists():
            print(f"Removing existing: {dest_skill}")
            shutil.rmtree(dest_skill)

        print(f"Copying {package_name}/skills/{skill_dir.name} -> .claude/skills/{dest_name}")
        shutil.copytree(skill_dir, dest_skill)

        update_skill_name(dest_skill)


def main():
    print("Finding TanStack packages with skills folders...")
    packages = find_tanstack_packages_with_skills()

    print(f"Found {len(packages)} packages with skills:\n")
    for name, path in packages:
        print(f"  - {name}: {path}")
    print()

    for package_name, skills_path in packages:
        copy_skills_folder(package_name, skills_path)

    print("\nDone!")


if __name__ == "__main__":
    main()
