#!/usr/bin/env bash
# Rename .sql files with 5-digit prefix (00005_, 00010_, ...) to 3-digit prefix (000_, 001_, ...)
# preserving existing alphanumerical order.
# Assumes fewer than 100 files.
set -euo pipefail

mig_dir="./"
script_dir="$(dirname "$0")"
pattern='^[0-9]{5}_.*\.sql$'

# Collect files matching 5-digit prefix, sorted alphanumerically
mapfile -t files < <(
  find "$script_dir/$mig_dir" -maxdepth 1 -type f -name '*.sql' -printf '%f\0' |
    sort -z |
    while IFS= read -r -d '' f; do
      [[ "$f" =~ $pattern ]] && echo "$f"
    done |
    sort
)

count=${#files[@]}
echo "Found $count files to rename."

if [ "$count" -eq 0 ]; then
  echo "No files matching pattern. Exiting."
  exit 0
fi

# Dry-run first
echo "=== Dry run ==="
for i in "${!files[@]}"; do
  new_prefix=$(printf "%03d" "$i")
  new_name="${new_prefix}_${files[$i]#*_}"
  echo "  ${files[$i]} -> $new_name"
done

echo ""
read -rp "Proceed with rename? (y/N) " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 1
fi

# Execute rename
for i in "${!files[@]}"; do
  old="$script_dir/$mig_dir/${files[$i]}"
  new_prefix=$(printf "%03d" "$i")
  new_name="${new_prefix}_${files[$i]#*_}"
  new="$script_dir/$mig_dir/$new_name"
  echo "Renaming: ${files[$i]} -> $new_name"
  mv "$old" "$new"
done

echo "Done."
