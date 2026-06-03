from pathlib import Path
import re
import shutil

PROJECT_ROOT = Path(__file__).resolve().parents[1]
NODE_MODULES = PROJECT_ROOT / "web" / "node_modules" / "@tanstack"
SKILLS_DIR = PROJECT_ROOT / ".agents" / "skills"

SKIP_FOLDERS = {
    "lifecycle",
    "virtual-file-routes",
    "router-plugin",
}


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


def iter_skill_markdown_files(skill_dirs: list[Path]):
    for skill_dir in skill_dirs:
        yield from sorted(skill_dir.rglob("SKILL.md"))


def read_skill_name(skill_md: Path, content: str | None = None) -> str | None:
    if content is None:
        content = skill_md.read_text(encoding="utf-8")
    match = re.search(r"^name:\s*(\S+)\s*$", content, re.MULTILINE)
    return match.group(1) if match else None


def replace_markdown_links(
    line: str,
    skill_name_mapping: dict[str, str],
) -> str:
    pattern = re.compile(r"\[([^\]]+)\]\(([^)]+SKILL\.md)\)")

    def replacer(match: re.Match[str]) -> str:
        label = match.group(1)
        target = match.group(2)
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

    return pattern.sub(replacer, line)


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
) -> bool:
    content = skill_md.read_text(encoding="utf-8")
    source_skill_name = read_skill_name(skill_md, content)
    if not source_skill_name:
        return False

    has_trailing_newline = content.endswith("\n")
    lines = content.splitlines()

    name_line_pat = re.compile(r"^(name:\s*)(\S+)(\s*)$")
    requires_inline_pat = re.compile(r"^(requires:\s*)(\S+)(\s*)$")
    requires_item_pat = re.compile(r"^(\s*-\s*)(\S+)(\s*)$")

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
            name_match = name_line_pat.match(line)
            if name_match:
                prefix, value, suffix = name_match.groups()
                updated_lines.append(f"{prefix}{skill_name_mapping.get(value, value)}{suffix}")
                continue

            requires_inline_match = requires_inline_pat.match(line)
            if requires_inline_match:
                prefix, value, suffix = requires_inline_match.groups()
                updated_lines.append(f"{prefix}{skill_name_mapping.get(value, value)}{suffix}")
                continue

            if stripped == "requires:":
                in_requires_block = True
                updated_lines.append(line)
                continue

            if in_requires_block:
                requires_item_match = requires_item_pat.match(line)
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
            skill_name_mapping=skill_name_mapping,
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
    skill_paths = {}
    skill_name_mapping = {}

    print("\nFlattening and modifying SKILL.md files...")
    for skill_md in iter_skill_markdown_files(copied_skill_dirs):
        if "auth-and-guards" in str(skill_md) or "ssr" in str(skill_md):
            print(f"  Skipping {skill_md.relative_to(PROJECT_ROOT)}")
            continue

        content = skill_md.read_text(encoding="utf-8")
        old_name = read_skill_name(skill_md, content)
        if not old_name:
            continue

        base = re.sub(r"[_/\\]", "-", old_name)
        new_name = f"tanstack-{base}"
        while new_name.startswith("tanstack-tanstack-"):
            new_name = new_name.removeprefix("tanstack-")
        old_to_new_mapping[old_name] = new_name

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
                desc_lines = [line]
                i += 1
                while i < len(lines) and lines[i].strip() and not re.match(r"^\w+:", lines[i]):
                    desc_lines.append(lines[i])
                    i += 1
                new_front_lines.extend(desc_lines)
                has_desc = True
            else:
                i += 1
        if not has_name or not has_desc:
            continue

        new_frontmatter = "\n".join(new_front_lines)
        new_content = re.sub(
            r"^---\n.*?\n---", f"---\n{new_frontmatter}\n---", content, flags=re.DOTALL
        )

        new_dir = SKILLS_DIR / new_name
        new_dir.mkdir(exist_ok=True)
        new_md = new_dir / "SKILL.md"
        new_md.write_text(new_content, encoding="utf-8")

        skill_paths[old_name] = new_md
        skill_name_mapping[old_name] = new_name
        print(
            f"  Moved and modified {skill_md.relative_to(PROJECT_ROOT)} -> {new_md.relative_to(PROJECT_ROOT)}"
        )

    skill_paths = {skill_name_mapping[old]: path for old, path in skill_paths.items()}

    for d in copied_skill_dirs:
        if d.exists():
            skill_md = d / "SKILL.md"
            if skill_md.exists():
                for sub in d.iterdir():
                    if sub.is_dir():
                        shutil.rmtree(sub)
            else:
                shutil.rmtree(d)

    print("\nRewriting links in flattened SKILL.md files...")
    for new_name, md_path in skill_paths.items():
        if rewrite_skill_markdown(md_path, skill_name_mapping):
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

    for old_hier, initial_new in old_to_new_mapping.items():
        if initial_new in renamed:
            old_to_new_mapping[old_hier] = renamed[initial_new]

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
        for old, new in sorted(old_to_new_mapping.items(), key=lambda x: -len(x[0])):
            updated = re.sub(
                rf"(?<!tanstack-){re.escape(old)}",
                lambda _: new,
                updated,
            )
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


def clear_existing_tanstack_skills():
    for d in SKILLS_DIR.iterdir():
        if d.is_dir() and d.name.startswith("tanstack-"):
            print(f"Removing existing: {d}")
            shutil.rmtree(d)


def main():
    clear_existing_tanstack_skills()

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
