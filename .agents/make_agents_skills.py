from pathlib import Path
import shutil


def copy_claude_skills_to_agents():
    # Define source and destination paths
    source_dir = Path("..\\.claude\\skills")
    dest_dir = Path(".\\skills")

    # Convert to absolute paths for better debugging
    source_abs = source_dir.resolve()
    dest_abs = dest_dir.resolve()

    print(f"Source: {source_abs}")
    print(f"Destination: {dest_abs}")

    # Check if source exists
    if not source_abs.exists():
        print(f"❌ Error: Source directory not found: {source_abs}")
        print("Make sure you're running this script from the .agents folder")
        return False

    # Create destination directory if it doesn't exist
    dest_abs.mkdir(parents=True, exist_ok=True)
    print(f"✅ Destination directory ready: {dest_abs}")

    # Copy everything recursively
    try:
        # Remove destination if it already exists to do a clean copy
        if dest_abs.exists() and any(dest_abs.iterdir()):
            print("🧹 Cleaning existing skills directory...")
            shutil.rmtree(dest_abs)
            dest_abs.mkdir(parents=True, exist_ok=True)

        print("📋 Copying files and subdirectories recursively...")
        shutil.copytree(source_abs, dest_abs, dirs_exist_ok=True)

        print("🎉 Successfully copied all Claude skills to .agents/skills!")

        # Optional: Show summary
        file_count = sum(1 for _ in dest_abs.rglob("*") if _.is_file())
        dir_count = sum(1 for _ in dest_abs.rglob("*") if _.is_dir())
        print(f"Summary: {file_count} files copied across {dir_count} directories")

        return True

    except Exception as e:
        print(f"❌ Error during copy: {e}")
        return False


if __name__ == "__main__":
    print("🚀 Starting Claude skills → Agents skills copy...\n")
    success = copy_claude_skills_to_agents()

    if success:
        print("\n✅ Operation completed successfully!")
    else:
        print("\n⚠️  Operation completed with errors.")
