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
        linked_skill_name = resolve_linked_skill_name(current_skill_name, target)
        if not linked_skill_name or linked_skill_name not in skill_paths:
            return match.group(0)

        new_label = skill_name_mapping.get(label, label)
        new_target = to_markdown_relative_path(
            source_file=skill_paths[current_skill_name],
            target_file=skill_paths[linked_skill_name],
        )
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


def rewrite_copied_skills(copied_skill_dirs: list[Path]):
    skill_name_mapping, skill_paths = build_skill_index(copied_skill_dirs)

    print("\nRewriting copied SKILL.md files...")
    for skill_md in iter_skill_markdown_files(copied_skill_dirs):
        if rewrite_skill_markdown(skill_md, skill_name_mapping, skill_paths):
            print(f"  Rewrote {skill_md.relative_to(PROJECT_ROOT)}")


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
