#!/bin/bash
set -euo pipefail

CWD="$(pwd)"
tmpdir="$CWD/tmp/tmp.$((RANDOM % 1000000))"
version=$(date +"%Y.%m.%d")
plgfile="$CWD/folderview.plus.plg"
archive_prefix="folderview.plus"

# Parse flags
# Usage: pkg_build.sh [--beta [N]]
#   --beta     → YYYY.MM.DD-beta (beta branch)
#   --beta 2   → YYYY.MM.DD-beta2 (beta branch)
#   (no flag)  → YYYY.MM.DD (main branch, stable)
BETA=false
BETA_NUM=""
if [ "${1:-}" = "--beta" ]; then
    BETA=true
    if [ -n "${2:-}" ] && [ "${2:-}" -eq "${2:-}" ] 2>/dev/null; then
        BETA_NUM="${2:-}"
    fi
fi

# Set branch based on build type
if [ "$BETA" = true ]; then
    branch="beta"
    version="${version}-beta${BETA_NUM}"
else
    branch="main"
fi

filename="$CWD/archive/$archive_prefix-$version.txz"
dayversion=$(ls "$CWD/archive/$archive_prefix-$version"*.txz 2>/dev/null | wc -l)

if [ $dayversion -gt 0 ]
then
    version="$version.$dayversion"
    filename="$CWD/archive/$archive_prefix-$version.txz"
fi

mkdir -p "$tmpdir"

cd "$CWD/src/folderview.plus"
while IFS= read -r -d '' file; do
    cp --parents -f "$file" "$tmpdir/"
done < <(find . -type f ! \( -iname "pkg_build.sh" -o -iname "sftp-config.json" \) -print0)

# Set permissions for Unraid (only in temp dir, not the repo)
chmod -R 0755 "$tmpdir"

cd "$tmpdir"
tar -cJf "$filename" *

cd "$CWD"
md5=$(md5sum "$filename" | awk '{print $1}')

# Update version and md5 in plg file
sed -i "s/<!ENTITY version.*>/<!ENTITY version \"$version\">/" "$plgfile"
sed -i "s/<!ENTITY md5.*>/<!ENTITY md5 \"$md5\">/" "$plgfile"

# Update branch references in plg file (URLs use XML entities like &github;)
sed -i 's|/main/folderview.plus.plg|/'"$branch"'/folderview.plus.plg|' "$plgfile"
sed -i 's|/main/archive/|/'"$branch"'/archive/|' "$plgfile"

rm -R "$CWD/tmp"

echo "Package created: $filename"
echo "Version: $version"
echo "MD5: $md5"
echo "Branch: $branch"
echo "PLG file updated"

