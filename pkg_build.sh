#!/bin/bash
set -euo pipefail

CWD="$(pwd)"
tmpdir="$CWD/tmp/tmp.$((RANDOM % 1000000))"
version_override="${FVPLUS_VERSION_OVERRIDE:-}"
today_version="$(date +"%Y.%m.%d")"
version="${today_version}.01"
plgfile="$CWD/folderview.plus.plg"
archive_prefix="folderview.plus"
icon_ext_regex='^(png|jpg|jpeg|gif|webp|svg|bmp|ico|avif)$'

is_stable_version() {
    [[ "${1:-}" =~ ^[0-9]{4}\.[0-9]{2}\.[0-9]{2}(\.[0-9]+)?$ ]]
}

normalize_stable_version_for_unraid() {
    local input="${1:-}"
    if [[ "$input" =~ ^([0-9]{4}\.[0-9]{2}\.[0-9]{2})$ ]]; then
        echo "${BASH_REMATCH[1]}.01"
        return
    fi
    if [[ "$input" =~ ^([0-9]{4}\.[0-9]{2}\.[0-9]{2})\.([0-9]+)$ ]]; then
        local base="${BASH_REMATCH[1]}"
        local patch_raw="${BASH_REMATCH[2]}"
        local patch_num=$((10#$patch_raw))
        printf '%s.%02d\n' "$base" "$patch_num"
        return
    fi
    echo "$input"
}

next_patch_version() {
    local input="${1:-}"
    if [[ "$input" =~ ^([0-9]{4}\.[0-9]{2}\.[0-9]{2})\.([0-9]+)$ ]]; then
        local base="${BASH_REMATCH[1]}"
        local patch_raw="${BASH_REMATCH[2]}"
        local next_patch=$((10#$patch_raw + 1))
        printf '%s.%02d\n' "$base" "$next_patch"
        return
    fi
    if [[ "$input" =~ ^[0-9]{4}\.[0-9]{2}\.[0-9]{2}$ ]]; then
        echo "${input}.01"
        return
    fi
    echo "$input"
}

highest_stable_archive_version() {
    local versions=()
    local archive
    shopt -s nullglob
    for archive in "$CWD/archive/$archive_prefix-"*.txz; do
        local name="${archive##*/}"
        local ver="${name#${archive_prefix}-}"
        ver="${ver%.txz}"
        if is_stable_version "$ver"; then
            versions+=("$ver")
        fi
    done
    shopt -u nullglob
    if [ "${#versions[@]}" -eq 0 ]; then
        return
    fi
    printf '%s\n' "${versions[@]}" | sort -V | tail -n1
}

choose_safe_stable_version() {
    local candidate="${1:-}"
    local highest="${2:-}"
    if [ -z "$highest" ]; then
        echo "$candidate"
        return
    fi
    local max_ver
    max_ver="$(printf '%s\n%s\n' "$candidate" "$highest" | sort -V | tail -n1)"
    if [ "$max_ver" = "$highest" ]; then
        echo "$(next_patch_version "$highest")"
        return
    fi
    echo "$candidate"
}

should_package_file() {
    local file_path="${1:-}"
    case "$file_path" in
        ./usr/local/emhttp/plugins/folderview.plus/images/third-party-icons/*|./usr/local/emhttp/plugins/folderview.plus/images/custom/*)
            local ext="${file_path##*.}"
            ext="${ext,,}"
            if [[ "$ext" =~ $icon_ext_regex ]]; then
                return 0
            fi
            return 1
            ;;
    esac
    return 0
}

# Parse flags
# Usage: pkg_build.sh [--beta [N]]
#   --beta     -> YYYY.MM.DD-beta (beta branch)
#   --beta 2   -> YYYY.MM.DD-beta2 (beta branch)
#   (no flag)  -> YYYY.MM.DD.UU (main branch, stable; zero-padded update suffix)
BETA=false
BETA_NUM=""
if [ "${1:-}" = "--beta" ]; then
    BETA=true
    if [ -n "${2:-}" ] && [ "${2:-}" -eq "${2:-}" ] 2>/dev/null; then
        BETA_NUM="${2:-}"
    fi
fi

# Set branch and base version by build type
if [ "$BETA" = true ]; then
    branch="beta"
    version="${today_version}-beta${BETA_NUM}"
else
    branch="main"
fi

if [ -n "$version_override" ]; then
    if [[ ! "$version_override" =~ ^[0-9]{4}\.[0-9]{2}\.[0-9]{2}([.-][0-9]+|-beta[0-9]*)?$ ]]; then
        echo "Invalid FVPLUS_VERSION_OVERRIDE: $version_override" >&2
        exit 1
    fi
    if [ "$BETA" = false ] && is_stable_version "$version_override"; then
        version_override="$(normalize_stable_version_for_unraid "$version_override")"
    fi
    if [ "$BETA" = false ] && is_stable_version "$version_override"; then
        highest_stable="$(highest_stable_archive_version || true)"
        if [ -n "$highest_stable" ]; then
            max_ver="$(printf '%s\n%s\n' "$version_override" "$highest_stable" | sort -V | tail -n1)"
            if [ "$max_ver" = "$highest_stable" ]; then
                echo "FVPLUS_VERSION_OVERRIDE must be greater than highest archived stable version ($highest_stable)." >&2
                exit 1
            fi
        fi
    fi
    version="$version_override"
elif [ "$BETA" = false ]; then
    highest_stable="$(highest_stable_archive_version || true)"
    version="$(choose_safe_stable_version "$version" "$highest_stable")"
fi

filename="$CWD/archive/$archive_prefix-$version.txz"
if [ -f "$filename" ]; then
    if [ -n "$version_override" ]; then
        echo "Archive already exists for overridden version: $filename" >&2
        exit 1
    fi
    version="$(next_patch_version "$version")"
    filename="$CWD/archive/$archive_prefix-$version.txz"
fi

mkdir -p "$tmpdir"

cd "$CWD/src/folderview.plus"
while IFS= read -r -d '' file; do
    if ! should_package_file "$file"; then
        continue
    fi
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
