import os
from pathlib import Path
import posixpath
import re
import shutil

PROJECT_ROOT = Path(__file__).resolve().parents[1]
NODE_MODULES = PROJECT_ROOT / "web" / "node_modules" / "@tanstack"
SKILLS_DIR = PROJECT_ROOT / ".agents" / "skills"

SKIP_FOLDERS = {"lifecycle", "virtual-file-routes", "router-plugin"}

NAME_LINE_PATTERN = re.compile(r"^(name:\s*)(\S+)(\s*)$")
REQUIRES_INLINE_PATTERN = re.compile(r"^(requires:\s*)(\S+)(\s*)$")
REQUIRES_ITEM_PATTERN = re.compile(r"^(\s*-\s*)(\S+)(\s*)$")
MARKDOWN_LINK_PATTERN = re.compile(r"\[([^\]]+)\]\(([^)]+SKILL\.md)\)")


def find_tanstack_packages_with_skills():
    packages = []
    if not NODE_MODULES.exists():
        print(f"Node modules path does not exist: {NODE_MODULES}")
        return packages

    for package_dir in sorted(NODE_MODULES.iterdir()):
        if not package_dir.is_dir():
            continue

        skills_path = package_dir / "skills"
        if skills_path.exists():
            packages.append((package_dir.name, skills_path))

    return packages


def get_dest_skill_name(skill_dir_name: str) -> str:
    if skill_dir_name.startswith("tanstack-"):
        return skill_dir_name
    return f"tanstack-{skill_dir_name}"


def prefix_skill_name(skill_name: str) -> str:
    root, sep, remainder = skill_name.partition("/")
    if root.startswith("tanstack-"):
        return skill_name
    return f"tanstack-{root}{sep}{remainder}"


def iter_skill_markdown_files(skill_dirs: list[Path]):
    for skill_dir in skill_dirs:
        yield from sorted(skill_dir.rglob("SKILL.md"))


def read_skill_name(skill_md: Path) -> str | None:
    content = skill_md.read_text(encoding="utf-8")
    match = re.search(r"^name:\s*(\S+)\s*$", content, re.MULTILINE)
    if match:
        return match.group(1)
    return None


def build_skill_index(copied_skill_dirs: list[Path]):
    skill_name_mapping = {}
    skill_paths = {}

    for skill_md in iter_skill_markdown_files(copied_skill_dirs):
        source_name = read_skill_name(skill_md)
        if not source_name:
            continue

        skill_name_mapping[source_name] = prefix_skill_name(source_name)
        skill_paths[source_name] = skill_md

    return skill_name_mapping, skill_paths


def resolve_linked_skill_name(current_skill_name: str, link_target: str) -> str | None:
    normalized_target = link_target.replace("\\", "/").split("#", 1)[0].split("?", 1)[0]
    if not normalized_target.endswith("SKILL.md"):
        return None

    if "/skills/" in normalized_target:
        after_skills = normalized_target.split("/skills/", 1)[1]
        return after_skills[: -len("/SKILL.md")]

    target_without_file = normalized_target[: -len("/SKILL.md")]
    return posixpath.normpath(posixpath.join(current_skill_name, target_without_file))


def to_markdown_relative_path(source_file: Path, target_file: Path) -> str:
    return os.path.relpath(target_file, source_file.parent).replace("\\", "/")


def replace_markdown_links(
    line: str,
    current_skill_name: str,
    skill_name_mapping: dict[str, str],
    skill_paths: dict[str, Path],
) -> str:
    def replacer(match: re.Match[str]) -> str:
        label = match.group(1)
        target = match.group(2)
        # Strip /SKILL.md from label if present
        old_label = label
        if old_label.endswith("/SKILL.md"):
            old_label = old_label[: -len("/SKILL.md")]
        new_label_base = skill_name_mapping.get(old_label, old_label)
        if label.endswith("/SKILL.md"):
            new_label = new_label_base + "/SKILL.md"
        else:
            new_label = new_label_base
        new_target = f"../{new_label_base}/SKILL.md"
        return f"[{new_label}]({new_target})"

    return MARKDOWN_LINK_PATTERN.sub(replacer, line)


def replace_safe_markdown_mentions(line: str, skill_name_mapping: dict[str, str]) -> str:
    items = sorted(skill_name_mapping.items(), key=lambda item: len(item[0]), reverse=True)

    for old_name, new_name in items:
        line = re.sub(
            rf"^(#+\s+){re.escape(old_name)}(\s*)$",
            rf"\1{new_name}\2",
            line,
        )
        line = re.sub(
            rf"`{re.escape(old_name)}`",
            f"`{new_name}`",
            line,
        )
        line = re.sub(
            rf"^(\s*→\s+){re.escape(old_name)}(\s*)$",
            rf"\1{new_name}\2",
            line,
        )
        line = re.sub(
            rf"^(\s*[-*]\s+){re.escape(old_name)}(?=(\s+[—-]{{1,2}}\s|\s*$))",
            rf"\1{new_name}",
            line,
        )

    return line


def rewrite_skill_markdown(
    skill_md: Path,
    skill_name_mapping: dict[str, str],
    skill_paths: dict[str, Path],
) -> bool:
    source_skill_name = read_skill_name(skill_md)
    if not source_skill_name:
        return False

    content = skill_md.read_text(encoding="utf-8")
    has_trailing_newline = content.endswith("\n")
    lines = content.splitlines()

    updated_lines = []
    in_frontmatter = False
    seen_frontmatter_start = False
    in_requires_block = False
    in_code_fence = False

    for line in lines:
        stripped = line.strip()

        if stripped.startswith("```"):
            in_code_fence = not in_code_fence
            updated_lines.append(line)
            continue

        if stripped == "---":
            if not seen_frontmatter_start:
                seen_frontmatter_start = True
                in_frontmatter = True
            elif in_frontmatter:
                in_frontmatter = False
                in_requires_block = False
            updated_lines.append(line)
            continue

        if in_frontmatter:
            name_match = NAME_LINE_PATTERN.match(line)
            if name_match:
                prefix, value, suffix = name_match.groups()
                updated_lines.append(f"{prefix}{skill_name_mapping.get(value, value)}{suffix}")
                continue

            requires_inline_match = REQUIRES_INLINE_PATTERN.match(line)
            if requires_inline_match:
                prefix, value, suffix = requires_inline_match.groups()
                updated_lines.append(f"{prefix}{skill_name_mapping.get(value, value)}{suffix}")
                continue

            if stripped == "requires:":
                in_requires_block = True
                updated_lines.append(line)
                continue

            if in_requires_block:
                requires_item_match = REQUIRES_ITEM_PATTERN.match(line)
                if requires_item_match:
                    prefix, value, suffix = requires_item_match.groups()
                    updated_lines.append(f"{prefix}{skill_name_mapping.get(value, value)}{suffix}")
                    continue

                in_requires_block = False

            updated_lines.append(line)
            continue

        if in_code_fence:
            updated_lines.append(line)
            continue

        updated_line = replace_markdown_links(
            line=line,
            current_skill_name=source_skill_name,
            skill_name_mapping=skill_name_mapping,
            skill_paths=skill_paths,
        )
        updated_line = replace_safe_markdown_mentions(updated_line, skill_name_mapping)
        updated_lines.append(updated_line)

    updated_content = "\n".join(updated_lines)
    if has_trailing_newline:
        updated_content += "\n"

    if updated_content == content:
        return False

    skill_md.write_text(updated_content, encoding="utf-8")
    return True


def flatten_and_modify_skills(copied_skill_dirs: list[Path], old_to_new_mapping: dict):
    skill_paths = {}  # old_name -> new_md_path
    skill_name_mapping = {}  # old_name -> new_name

    print("\nFlattening and modifying SKILL.md files...")
    for skill_md in iter_skill_markdown_files(copied_skill_dirs):
        # Skip skills originally in router-core/auth-and-guards and router-core/ssr
        if 'auth-and-guards' in str(skill_md) or 'ssr' in str(skill_md):
            print(f"  Skipping {skill_md.relative_to(PROJECT_ROOT)}")
            continue
        content = skill_md.read_text(encoding="utf-8")
        match = re.search(r"^name:\s*(\S+)\s*$", content, re.MULTILINE)
        if not match:
            continue
        old_name = match.group(1)
        new_name = "tanstack-" + re.sub(r"[_/\\]", "-", old_name)
        old_to_new_mapping[old_name] = new_name  # initial, will update later

        # Find frontmatter
        frontmatter_match = re.search(r"^---\n(.*?)\n---", content, re.DOTALL)
        if not frontmatter_match:
            continue
        frontmatter = frontmatter_match.group(1)

        lines = frontmatter.splitlines()
        new_front_lines = []
        has_name = False
        has_desc = False
        i = 0
        while i < len(lines):
            line = lines[i]
            stripped = line.strip()
            if stripped.startswith("name:"):
                new_front_lines.append(f"name: {new_name}")
                has_name = True
                i += 1
            elif stripped.startswith("description:"):
                # collect description lines
                desc_lines = [line]
                i += 1
                while i < len(lines) and lines[i].strip() and not re.match(r"^\w+:", lines[i]):
                    desc_lines.append(lines[i])
                    i += 1
                new_front_lines.extend(desc_lines)
                has_desc = True
            else:
                i += 1  # skip other lines
        if not has_name or not has_desc:
            continue
        new_frontmatter = "\n".join(new_front_lines)
        new_content = re.sub(
            r"^---\n.*?\n---", f"---\n{new_frontmatter}\n---", content, flags=re.DOTALL
        )

        # Create new dir and write
        new_dir = SKILLS_DIR / new_name
        new_dir.mkdir(exist_ok=True)
        new_md = new_dir / "SKILL.md"
        new_md.write_text(new_content, encoding="utf-8")

        skill_paths[old_name] = new_md
        skill_name_mapping[old_name] = new_name
        print(
            f"  Moved and modified {skill_md.relative_to(PROJECT_ROOT)} -> {new_md.relative_to(PROJECT_ROOT)}"
        )

    # Update skill_paths to use new names as keys
    skill_paths = {skill_name_mapping[old]: path for old, path in skill_paths.items()}

    # Remove old copied dirs, but keep main dirs with SKILL.md
    for d in copied_skill_dirs:
        if d.exists():
            skill_md = d / "SKILL.md"
            if skill_md.exists():
                # main dir, remove all subdirs
                for sub in d.iterdir():
                    if sub.is_dir():
                        shutil.rmtree(sub)
            else:
                shutil.rmtree(d)

    # Rewrite links in the new files
    print("\nRewriting links in flattened SKILL.md files...")
    for new_name, md_path in skill_paths.items():
        if rewrite_skill_markdown(md_path, skill_name_mapping, skill_paths):
            print(f"  Rewrote {md_path.relative_to(PROJECT_ROOT)}")


def rename_and_update(old_to_new_mapping):
    print("\nRenaming directories and updating names/links by removing '-core'...")
    renamed = {}
    for d in SKILLS_DIR.iterdir():
        if d.is_dir() and "-core" in d.name:
            new_name = d.name.replace("-core", "")
            new_d = SKILLS_DIR / new_name
            if new_d.exists():
                shutil.rmtree(new_d)
            d.rename(new_d)
            renamed[d.name] = new_name
            print(f"  Renamed {d.name} -> {new_name}")

    # Update name in SKILL.md
    for md in SKILLS_DIR.glob("**/SKILL.md"):
        content = md.read_text(encoding="utf-8")
        updated = re.sub(
            r"^(name:\s*)(.+)$",
            lambda m: m.group(1) + m.group(2).replace("-core", ""),
            content,
            flags=re.MULTILINE,
        )
        if updated != content:
            md.write_text(updated, encoding="utf-8")
            print(f"  Updated name in {md.relative_to(PROJECT_ROOT)}")

    # Update the old_to_new_mapping for renamed dirs
    for old_hier, initial_new in old_to_new_mapping.items():
        if initial_new in renamed:
            old_to_new_mapping[old_hier] = renamed[initial_new]

    # Update links
    for md in SKILLS_DIR.glob("**/SKILL.md"):
        content = md.read_text(encoding="utf-8")
        updated = content
        for old, new in renamed.items():
            updated = updated.replace(f"../{old}/", f"../{new}/")
            updated = updated.replace(f"[{old}/SKILL.md]", f"[{new}/SKILL.md]")
        if updated != content:
            md.write_text(updated, encoding="utf-8")
            print(f"  Updated links in {md.relative_to(PROJECT_ROOT)}")


def replace_old_names_in_content(old_to_new_mapping):
    print("\nReplacing old hierarchical names in SKILL.md content...")
    for md in SKILLS_DIR.glob("**/SKILL.md"):
        content = md.read_text(encoding="utf-8")
        updated = content
        for old, new in old_to_new_mapping.items():
            updated = updated.replace(old, new)
        if updated != content:
            md.write_text(updated, encoding="utf-8")
            print(f"  Replaced in {md.relative_to(PROJECT_ROOT)}")


def rewrite_copied_skills(copied_skill_dirs: list[Path]):
    old_to_new_mapping = {}
    flatten_and_modify_skills(copied_skill_dirs, old_to_new_mapping)
    rename_and_update(old_to_new_mapping)
    replace_old_names_in_content(old_to_new_mapping)


def copy_skills_folder(package_name: str, source_skills: Path) -> list[Path]:
    copied_skill_dirs = []

    for skill_dir in sorted(source_skills.iterdir()):
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

        rel_skills = str(SKILLS_DIR).replace(str(PROJECT_ROOT), ".")
        print(f"Copying {package_name}/skills/{skill_dir.name} -> {rel_skills}/{dest_name}")
        shutil.copytree(skill_dir, dest_skill)
        copied_skill_dirs.append(dest_skill)

    return copied_skill_dirs


def main():
    print("Finding TanStack packages with skills folders...")
    packages = find_tanstack_packages_with_skills()

    print(f"Found {len(packages)} packages with skills:\n")
    for name, path in packages:
        print(f"  - {name}: {path}")
    print()

    copied_skill_dirs = []
    for package_name, skills_path in packages:
        copied_skill_dirs.extend(copy_skills_folder(package_name, skills_path))

    rewrite_copied_skills(copied_skill_dirs)

    print("\nDone!")


if __name__ == "__main__":
    main()
