#!/bin/bash
set -euo pipefail

CWD="$(pwd)"
version_override="${FVPLUS_VERSION_OVERRIDE:-}"
historical_rebuild="${FVPLUS_HISTORICAL_REBUILD:-0}"
today_version="$(date +"%Y.%m.%d")"
version="${today_version}.01"
plgfile="$CWD/folderview.plus.plg"
xmlfile="$CWD/folderview.plus.xml"
release_guard_script="$CWD/scripts/release_guard.sh"
install_smoke_script="$CWD/scripts/install_smoke.sh"
icon_asset_pack_guard_script="$CWD/scripts/icon_asset_pack_guard.sh"
ensure_changes_entry_script="$CWD/scripts/ensure_plg_changes_entry.sh"
changes_entry_timeout_raw="${FVPLUS_CHANGES_ENTRY_TIMEOUT_SEC:-10}"
archive_prefix="folderview.plus"
archive_dir="$CWD/archive"
prune_archives_script="$CWD/scripts/prune_archives.sh"
archive_prune_keep_raw="${FVPLUS_ARCHIVE_PRUNE_KEEP:-24}"
archive_prune_keep=24
icon_ext_regex='^(png|jpg|jpeg|gif|webp|svg|bmp|ico|avif)$'
validate_after_build=true
dry_run=false
run_install_smoke=false
tmpdir=""
lockfile="tmp/pkg_build.lock"
lockdir=""
branch_override="${FVPLUS_BUILD_BRANCH:-}"

detect_git_branch() {
    local detected=""
    if command -v git >/dev/null 2>&1 && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
        detected="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
        if [ -z "$detected" ] || [ "$detected" = "HEAD" ]; then
            detected="${GITHUB_REF_NAME:-}"
            detected="${detected#refs/heads/}"
        fi
    fi
    printf '%s' "$detected"
}

detect_manifest_branch() {
    local plugin_url=""
    if [ ! -f "$plgfile" ]; then
        return 0
    fi
    plugin_url="$(sed -n 's/^<!ENTITY pluginURL "\([^"]*\)".*/\1/p' "$plgfile" | head -n 1 || true)"
    if [[ "$plugin_url" =~ /([A-Za-z0-9._-]+)/folderview\.plus\.plg$ ]]; then
        printf '%s' "${BASH_REMATCH[1]}"
        return 0
    fi
    return 0
}

rewrite_manifest_branch_metadata() {
    local target_file="${1:-}"
    local target_version="${2:-}"
    local target_branch="${3:-}"
    if [ -z "$target_file" ] || [ -z "$target_version" ] || [ -z "$target_branch" ]; then
        echo "ERROR: rewrite_manifest_branch_metadata requires file, version, and branch." >&2
        exit 1
    fi
    sed -E -i 's|^<!ENTITY pluginURL ".*">|<!ENTITY pluginURL "https://raw.githubusercontent.com/\&github;/'"$target_branch"'/folderview.plus.plg">|' "$target_file"
    sed -E -i 's|^<!ENTITY iconPackURL ".*">|<!ENTITY iconPackURL "https://raw.githubusercontent.com/\&github;/'"$target_branch"'/asset-packs/folderview.plus-icons-\&iconPackVersion;.txz">|' "$target_file"
    sed -E -i 's|<URL>https://raw.githubusercontent.com/.*?/archive/.*</URL>|<URL>https://raw.githubusercontent.com/\&github;/'"$target_branch"'/archive/\&name;-\&version;.txz</URL>|' "$target_file"
    perl -0pi -e 's{<PLUGIN\s+name="[^"]*"\s+author="[^"]*"\s+version="[^"]*"\s+launch="[^"]*"\s+pluginURL="[^"]*"\s+icon="folder-icon\.png"\s+support="https://forums\.unraid\.net/topic/197631-plugin-folderview-plus/"\s+min="7\.0\.0">}{<PLUGIN name="&name;" author="&author;" version="&version;" launch="&launch;" pluginURL="&pluginURL;" icon="folder-icon.png" support="https://forums.unraid.net/topic/197631-plugin-folderview-plus/" min="7.0.0">}s' "$target_file"
}

validate_manifest_branch_matrix() {
    local source_file="${1:-}"
    local target_version="${2:-}"
    local branch_name=""
    if [ -z "$source_file" ] || [ -z "$target_version" ]; then
        echo "ERROR: validate_manifest_branch_matrix requires source file and version." >&2
        exit 1
    fi
    for branch_name in dev main; do
        local probe_file=""
        local entity_url=""
        local archive_url=""
        local icon_pack_url=""
        local plugin_tag=""
        local expected_entity_url="https://raw.githubusercontent.com/&github;/${branch_name}/folderview.plus.plg"
        local expected_archive_url="https://raw.githubusercontent.com/&github;/${branch_name}/archive/&name;-&version;.txz"
        local expected_icon_pack_url="https://raw.githubusercontent.com/&github;/${branch_name}/asset-packs/folderview.plus-icons-&iconPackVersion;.txz"
        probe_file="$(mktemp)"
        cp "$source_file" "$probe_file"
        rewrite_manifest_branch_metadata "$probe_file" "$target_version" "$branch_name"
        entity_url="$(sed -n 's/^<!ENTITY pluginURL "\([^"]*\)".*/\1/p' "$probe_file" | head -n 1 || true)"
        archive_url="$(sed -n 's|.*<URL>\(https://raw.githubusercontent.com/&github;/[^<]*/archive/&name;-&version;.txz\)</URL>.*|\1|p' "$probe_file" | head -n 1 || true)"
        icon_pack_url="$(sed -n 's/^<!ENTITY iconPackURL "\([^"]*\)".*/\1/p' "$probe_file" | head -n 1 || true)"
        plugin_tag="$(perl -0777 -ne 'if (/<PLUGIN\b[^>]*>/s) { my $tag = $&; $tag =~ s/\s+/ /g; print $tag; }' "$probe_file")"
        rm -f "$probe_file"
        if [ "$entity_url" != "$expected_entity_url" ]; then
            echo "ERROR: Manifest branch matrix entity URL mismatch for ${branch_name}. expected=${expected_entity_url}, found=${entity_url}" >&2
            exit 1
        fi
        if [ "$archive_url" != "$expected_archive_url" ]; then
            echo "ERROR: Manifest branch matrix archive URL mismatch for ${branch_name}. expected=${expected_archive_url}, found=${archive_url}" >&2
            exit 1
        fi
        if [ "$icon_pack_url" != "$expected_icon_pack_url" ]; then
            echo "ERROR: Manifest branch matrix icon asset-pack URL mismatch for ${branch_name}. expected=${expected_icon_pack_url}, found=${icon_pack_url}" >&2
            exit 1
        fi
        if [[ "$plugin_tag" != *'name="&name;"'* ]] || [[ "$plugin_tag" != *'author="&author;"'* ]] || [[ "$plugin_tag" != *'version="&version;"'* ]] || [[ "$plugin_tag" != *'launch="&launch;"'* ]] || [[ "$plugin_tag" != *'pluginURL="&pluginURL;"'* ]]; then
            echo "ERROR: Manifest branch matrix plugin tag lost canonical entity form for ${branch_name}. tag=${plugin_tag}" >&2
            exit 1
        fi
    done
}

apply_branch_channel_messaging() {
    local package_root="${1:-}"
    local target_branch="${2:-}"
    local readme_file=""
    local langs_dir=""
    local channel_desc=""
    local channel_quickstart=""
    local lang_file=""
    if [ -z "$package_root" ] || [ -z "$target_branch" ]; then
        echo "ERROR: apply_branch_channel_messaging requires package root and branch." >&2
        exit 1
    fi
    if [[ "$target_branch" != "dev" ]]; then
        return
    fi
    readme_file="$package_root/usr/local/emhttp/plugins/folderview.plus/README.md"
    langs_dir="$package_root/usr/local/emhttp/plugins/folderview.plus/langs"
    channel_desc="FolderView Plus dev branch includes preview builds for testing. Expect bugs, regressions, and in-progress changes before they reach main."
    channel_quickstart="Dev branch: Test changes here before stable release. Update carefully and expect occasional breakage."
    if [ -f "$readme_file" ]; then
        perl -0pi -e 's{<span id="folderviewplus-desc">.*?</span>}{<span id="folderviewplus-desc">'"$channel_desc"'</span>}s' "$readme_file"
        perl -0pi -e 's{Quick start:.*}{'"$channel_quickstart"'}s' "$readme_file"
    fi
    if [ -d "$langs_dir" ]; then
        for lang_file in "$langs_dir"/*.json; do
            [ -f "$lang_file" ] || continue
            perl -0pi -e 's/"folderviewplus-desc"\s*:\s*"(?:[^"\\\\]|\\\\.)*"/"folderviewplus-desc": "'"$channel_desc"'"/g' "$lang_file"
        done
    fi
}

print_usage() {
    cat <<'EOF'
Usage: pkg_build.sh [options]
  --branch NAME   Force update URLs to use branch NAME (default: auto dev/main)
  --dry-run       Show computed version/output paths without writing files
  --keep-archives N
                  Keep latest N archive versions after build (default: 24, 0 disables prune)
  --no-prune-archives
                  Disable archive pruning for this build
  --output-dir D  Write .txz/.sha256 to directory D (default: ./archive)
  --install-smoke Run scripts/install_smoke.sh after successful build
  --validate      Run scripts/release_guard.sh after build (default: enabled)
  --no-validate   Skip post-build release guard validation
  -h, --help      Show this help
EOF
}

require_commands() {
    local missing=()
    local cmd
    for cmd in "$@"; do
        if ! command -v "$cmd" >/dev/null 2>&1; then
            missing+=("$cmd")
        fi
    done
    if [ "${#missing[@]}" -gt 0 ]; then
        echo "ERROR: Missing required commands: ${missing[*]}" >&2
        exit 1
    fi
}

cleanup_tmpdir() {
    if [ -n "${tmpdir:-}" ] && [ -d "${tmpdir}" ]; then
        rm -rf "${tmpdir}"
    fi
    if [ -n "${lockdir:-}" ] && [ -d "${lockdir}" ]; then
        rm -rf "${lockdir}"
    fi
}

parse_nonnegative_integer() {
    local raw="${1:-}"
    if [[ "$raw" =~ ^[0-9]+$ ]]; then
        echo $((10#$raw))
        return
    fi
    echo ""
}

ensure_repo_layout() {
    if [ ! -f "$plgfile" ]; then
        echo "ERROR: Run pkg_build.sh from repo root (missing $plgfile)." >&2
        exit 1
    fi
    if [ ! -f "$xmlfile" ]; then
        echo "ERROR: Missing CA template file: $xmlfile" >&2
        exit 1
    fi
    if [ ! -d "$CWD/src/folderview.plus" ]; then
        echo "ERROR: Missing plugin source directory: $CWD/src/folderview.plus" >&2
        exit 1
    fi
}

sync_ca_template_metadata() {
    local target_file="${1:-}"
    local target_date="${2:-}"
    local target_branch="${3:-}"
    if [ -z "$target_file" ] || [ -z "$target_date" ] || [ -z "$target_branch" ]; then
        echo "ERROR: sync_ca_template_metadata requires file, date, and branch." >&2
        exit 1
    fi
    if [ ! -f "$target_file" ]; then
        echo "ERROR: Missing CA template file: $target_file" >&2
        exit 1
    fi
    sed -i "s|<Date>.*</Date>|<Date>${target_date}</Date>|" "$target_file"
    sed -i "s|<PluginURL>.*</PluginURL>|<PluginURL>https://raw.githubusercontent.com/alexphillips-dev/FolderView-Plus/${target_branch}/folderview.plus.plg</PluginURL>|" "$target_file"
    sed -i "s|<Icon>.*</Icon>|<Icon>https://raw.githubusercontent.com/alexphillips-dev/FolderView-Plus/${target_branch}/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/images/folder-icon.png</Icon>|" "$target_file"
    sed -i "s|<Beta>.*</Beta>|<Beta>False</Beta>|" "$target_file"
    sed -i "s|<Name>.*</Name>|<Name>FolderView Plus</Name>|" "$target_file"
}

acquire_build_lock() {
    mkdir -p "$(dirname "$lockfile")"
    if command -v flock >/dev/null 2>&1 && [ "${FVPLUS_PKG_BUILD_DISABLE_FLOCK:-0}" != "1" ]; then
        exec 9>"$lockfile"
        if ! flock -n 9; then
            echo "ERROR: Another pkg_build.sh instance is already running (lock: $lockfile)." >&2
            exit 1
        fi
        return
    fi
    lockdir="${lockfile}.d"
    if ! mkdir "$lockdir" 2>/dev/null; then
        echo "ERROR: Another pkg_build.sh instance is already running (lock: $lockdir)." >&2
        exit 1
    fi
}

is_stable_version() {
    [[ "${1:-}" =~ ^[0-9]{4}\.[0-9]{2}\.[0-9]{2}(\.[0-9]+)?$ ]]
}

stable_date_part() {
    local input="${1:-}"
    if [[ "$input" =~ ^([0-9]{4}\.[0-9]{2}\.[0-9]{2})(\.[0-9]+)?$ ]]; then
        echo "${BASH_REMATCH[1]}"
        return
    fi
    echo ""
}

stable_update_part() {
    local input="${1:-}"
    if [[ "$input" =~ ^[0-9]{4}\.[0-9]{2}\.[0-9]{2}\.([0-9]+)$ ]]; then
        echo $((10#${BASH_REMATCH[1]}))
        return
    fi
    # Legacy stable tags without explicit update suffix are treated as update 1.
    if [[ "$input" =~ ^[0-9]{4}\.[0-9]{2}\.[0-9]{2}$ ]]; then
        echo 1
        return
    fi
    echo 0
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

highest_stable_archive_version_for_date() {
    local target_date="${1:-}"
    if [[ ! "$target_date" =~ ^[0-9]{4}\.[0-9]{2}\.[0-9]{2}$ ]]; then
        return
    fi
    local highest=""
    local versions=()
    local archive
    local ref
    local ref_version
    local tag
    shopt -s nullglob
    for archive in "$archive_dir/$archive_prefix-"*.txz; do
        local name="${archive##*/}"
        local ver="${name#"${archive_prefix}-"}"
        ver="${ver%.txz}"
        if is_stable_version "$ver"; then
            local ver_date
            ver_date="$(stable_date_part "$ver")"
            if [ "$ver_date" = "$target_date" ]; then
                versions+=("$(normalize_stable_version_for_unraid "$ver")")
            fi
        fi
    done
    shopt -u nullglob
    if command -v git >/dev/null 2>&1 && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
        for ref in HEAD dev main origin/dev origin/main; do
            if ! git rev-parse -q --verify "${ref}^{commit}" >/dev/null 2>&1; then
                continue
            fi
            ref_version="$(
                git show "${ref}:folderview.plus.plg" 2>/dev/null \
                    | sed -n 's/^<!ENTITY version "\([^"]*\)".*/\1/p' \
                    | head -n 1 \
                    || true
            )"
            if is_stable_version "$ref_version" && [ "$(stable_date_part "$ref_version")" = "$target_date" ]; then
                versions+=("$(normalize_stable_version_for_unraid "$ref_version")")
            fi
        done
        while IFS= read -r tag; do
            tag="${tag#v}"
            if is_stable_version "$tag" && [ "$(stable_date_part "$tag")" = "$target_date" ]; then
                versions+=("$(normalize_stable_version_for_unraid "$tag")")
            fi
        done < <(git tag --list "v${target_date}*" 2>/dev/null || true)
    fi
    if [ "${#versions[@]}" -eq 0 ]; then
        return
    fi
    highest="$(printf '%s\n' "${versions[@]}" | sort -V | tail -n1)"
    echo "$highest"
}

next_stable_version_for_date() {
    local target_date="${1:-}"
    if [[ ! "$target_date" =~ ^[0-9]{4}\.[0-9]{2}\.[0-9]{2}$ ]]; then
        echo ""
        return
    fi
    local highest_for_date=""
    highest_for_date="$(highest_stable_archive_version_for_date "$target_date" || true)"
    if [ -z "$highest_for_date" ]; then
        echo "${target_date}.01"
        return
    fi
    next_patch_version "$highest_for_date"
}

should_package_file() {
    local file_path="${1:-}"
    case "$file_path" in
        ./usr/local/emhttp/plugins/folderview.plus/images/third-party-icons/*)
            return 1
            ;;
        ./usr/local/emhttp/plugins/folderview.plus/images/custom/*)
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
# Usage: pkg_build.sh [--dry-run] [--validate|--no-validate]
#   --dry-run  -> Print build plan without writing files
#   (default)  -> YYYY.MM.DD.UU (main/dev branch, zero-padded update suffix)
while [[ $# -gt 0 ]]; do
    case "${1:-}" in
        --dry-run)
            dry_run=true
            ;;
        --keep-archives)
            if [ -z "${2:-}" ]; then
                echo "ERROR: --keep-archives requires a non-negative integer." >&2
                exit 1
            fi
            archive_prune_keep_raw="${2:-}"
            shift
            ;;
        --no-prune-archives)
            archive_prune_keep_raw="0"
            ;;
        --branch)
            if [ -z "${2:-}" ]; then
                echo "ERROR: --branch requires a branch name." >&2
                exit 1
            fi
            branch_override="${2:-}"
            shift
            ;;
        --output-dir)
            if [ -z "${2:-}" ]; then
                echo "ERROR: --output-dir requires a path." >&2
                exit 1
            fi
            archive_dir="${2:-}"
            shift
            ;;
        --install-smoke)
            run_install_smoke=true
            ;;
        --no-install-smoke)
            run_install_smoke=false
            ;;
        --validate)
            validate_after_build=true
            ;;
        --no-validate)
            validate_after_build=false
            ;;
        -h|--help)
            print_usage
            exit 0
            ;;
        *)
            echo "Unknown argument: ${1}" >&2
            print_usage >&2
            exit 1
            ;;
    esac
    shift
done

archive_prune_keep="$(parse_nonnegative_integer "$archive_prune_keep_raw")"
if [ -z "$archive_prune_keep" ]; then
    echo "ERROR: archive prune keep value must be a non-negative integer (received: $archive_prune_keep_raw)." >&2
    exit 1
fi
changes_entry_timeout="$(parse_nonnegative_integer "$changes_entry_timeout_raw")"
if [ -z "$changes_entry_timeout" ]; then
    echo "ERROR: CHANGES helper timeout must be a non-negative integer in seconds (received: $changes_entry_timeout_raw)." >&2
    exit 1
fi

if [[ "$archive_dir" != /* && ! "$archive_dir" =~ ^[A-Za-z]:[\\/].* ]]; then
    archive_dir="$CWD/$archive_dir"
fi

ensure_repo_layout
trap cleanup_tmpdir EXIT
acquire_build_lock

require_commands tar sha256sum md5sum sed find date awk grep cp chmod mkdir rm mktemp sort tail
if [ "$changes_entry_timeout" -gt 0 ]; then
    require_commands timeout
fi
if [ "$validate_after_build" = true ]; then
    require_commands bash
    if [ ! -f "$release_guard_script" ]; then
        echo "ERROR: Missing release guard script: $release_guard_script" >&2
        exit 1
    fi
fi
if [ ! -f "$ensure_changes_entry_script" ]; then
    echo "ERROR: Missing CHANGES helper script: $ensure_changes_entry_script" >&2
    exit 1
fi
if [ ! -f "$icon_asset_pack_guard_script" ]; then
    echo "ERROR: Missing icon asset-pack guard script: $icon_asset_pack_guard_script" >&2
    exit 1
fi
if [ "$run_install_smoke" = true ]; then
    require_commands bash
    if [ ! -f "$install_smoke_script" ]; then
        echo "ERROR: Missing install smoke script: $install_smoke_script" >&2
        exit 1
    fi
fi
bash "$icon_asset_pack_guard_script"

# Set branch and base version by build type
if [ -n "$branch_override" ]; then
    branch="$branch_override"
else
    detected_branch="$(detect_git_branch)"
    if [ "$detected_branch" = "dev" ] || [ "$detected_branch" = "main" ]; then
        branch="$detected_branch"
    else
        manifest_branch="$(detect_manifest_branch)"
        if [ "$manifest_branch" = "dev" ]; then
            branch="dev"
        else
            branch="main"
        fi
    fi
fi

if ! [[ "$branch" =~ ^[A-Za-z0-9._/-]+$ ]]; then
    echo "ERROR: Invalid branch name for URL generation: $branch" >&2
    exit 1
fi

if [ -n "$version_override" ]; then
    if [[ ! "$version_override" =~ ^[0-9]{4}\.[0-9]{2}\.[0-9]{2}(\.[0-9]+)?$ ]]; then
        echo "Invalid FVPLUS_VERSION_OVERRIDE: $version_override" >&2
        exit 1
    fi
    if is_stable_version "$version_override" && [ "$historical_rebuild" != "1" ]; then
        version_override="$(normalize_stable_version_for_unraid "$version_override")"
        override_date="$(stable_date_part "$version_override")"
        if [ "$override_date" != "$today_version" ]; then
            echo "FVPLUS_VERSION_OVERRIDE for stable releases must use today's date (${today_version})." >&2
            exit 1
        fi
    fi
    if is_stable_version "$version_override" && [ "$historical_rebuild" != "1" ]; then
        highest_for_today="$(highest_stable_archive_version_for_date "$today_version" || true)"
        if [ -n "$highest_for_today" ]; then
            max_ver="$(printf '%s\n%s\n' "$version_override" "$highest_for_today" | sort -V | tail -n1)"
            if [ "$max_ver" = "$highest_for_today" ]; then
                echo "FVPLUS_VERSION_OVERRIDE must be greater than highest archived stable version for ${today_version} (${highest_for_today})." >&2
                exit 1
            fi
        fi
    fi
    version="$version_override"
else
    version="$(next_stable_version_for_date "$today_version")"
fi

filename="$archive_dir/$archive_prefix-$version.txz"
if [ -n "$version_override" ] && [ -f "$filename" ]; then
    echo "Archive already exists for overridden version: $filename" >&2
    exit 1
fi
while [ -f "$filename" ]; do
    version="$(next_patch_version "$version")"
    filename="$archive_dir/$archive_prefix-$version.txz"
done

xml_date=""
if [[ "$version" =~ ^([0-9]{4})\.([0-9]{2})\.([0-9]{2})(\.[0-9]+)?$ ]]; then
    xml_date="${BASH_REMATCH[1]}-${BASH_REMATCH[2]}-${BASH_REMATCH[3]}"
fi

if [ "$dry_run" = true ]; then
    echo "Dry run: no files will be written."
    echo "Version: $version"
    echo "Branch: $branch"
    echo "Output directory: $archive_dir"
    echo "Archive target: $filename"
    echo "PLG file: $plgfile"
    if [ -n "$xml_date" ]; then
        echo "CA template date: $xml_date"
    fi
    echo "Archive retention keep count: $archive_prune_keep"
    echo "CHANGES helper timeout seconds: $changes_entry_timeout"
    echo "Post-build validation: $validate_after_build"
    echo "Install smoke: $run_install_smoke"
    exit 0
fi

# The shared resolver is only needed for real builds. Keeping this after the
# dry-run exit preserves pkg_build.sh's standalone metadata-probe contract.
# shellcheck source=scripts/lib.sh
source "$CWD/scripts/lib.sh"
fvplus::require_commands node
NODE_BIN="$(fvplus::resolve_platform_command node)"

mkdir -p "$CWD/tmp"
mkdir -p "$archive_dir"
tmpdir="$(mktemp -d "$CWD/tmp/build.XXXXXX")"

cd "$CWD/src/folderview.plus"
while IFS= read -r -d '' file; do
    if ! should_package_file "$file"; then
        continue
    fi
    cp --parents -f "$file" "$tmpdir/"
done < <(find . -type f ! \( -iname "pkg_build.sh" -o -iname "sftp-config.json" \) -print0)

apply_branch_channel_messaging "$tmpdir" "$branch"

build_metadata_path="$tmpdir/usr/local/emhttp/plugins/folderview.plus/build-metadata.json"
build_source_content_sha256="$(
    cd "$tmpdir"
    while IFS= read -r -d '' source_file; do
        sha256sum --text "$source_file"
    done < <(find . -type f -print0 | sort -z) | sha256sum | awk '{print $1}'
)"
# The archive must remain reproducible from the commit that stores it. A Git
# commit cannot be embedded in an archive committed by that same commit without
# creating a self-reference, so packaged identity is content-addressed instead.
build_git_head_commit_sha=""
build_git_snapshot_mode="content"
build_git_tree_sha=""
build_git_source_commit_sha=""
build_git_commit_exact=false
build_manifest_url="https://raw.githubusercontent.com/alexphillips-dev/FolderView-Plus/${branch}/folderview.plus.plg"
build_archive_url="https://raw.githubusercontent.com/alexphillips-dev/FolderView-Plus/${branch}/archive/${archive_prefix}-${version}.txz"
build_icon_pack_version="$(sed -n 's/^<!ENTITY iconPackVersion "\([^"]*\)".*/\1/p' "$plgfile" | head -n 1)"
build_icon_pack_sha256="$(sed -n 's/^<!ENTITY iconPackSha256 "\([^"]*\)".*/\1/p' "$plgfile" | head -n 1)"
build_icon_pack_url="https://raw.githubusercontent.com/alexphillips-dev/FolderView-Plus/${branch}/asset-packs/folderview.plus-icons-${build_icon_pack_version}.txz"
cat > "$build_metadata_path" <<EOF
{
  "sourceCommitSha": "${build_git_source_commit_sha}",
  "headCommitSha": "${build_git_head_commit_sha}",
  "sourceTreeSha": "${build_git_tree_sha}",
  "sourceContentSha256": "${build_source_content_sha256}",
  "sourceSnapshotMode": "${build_git_snapshot_mode}",
  "sourceCommitExact": ${build_git_commit_exact},
  "sourceBranch": "${branch}",
  "manifestUrl": "${build_manifest_url}",
  "archiveUrl": "${build_archive_url}",
  "packageVersion": "${version}",
  "iconAssetPackVersion": "${build_icon_pack_version}",
  "iconAssetPackSha256": "${build_icon_pack_sha256}",
  "iconAssetPackUrl": "${build_icon_pack_url}"
}
EOF

# Set permissions for Unraid (only in temp dir, not the repo)
if ! chmod -R 0755 "$tmpdir"; then
    echo "WARN: chmod -R 0755 failed for $tmpdir; continuing with existing filesystem permissions." >&2
fi

cd "$tmpdir"
tar_status=0
if ! tar --sort=name \
    --mtime='UTC 1970-01-01' \
    --owner=0 \
    --group=0 \
    --numeric-owner \
    --mode=0755 \
    -cJf "$filename" ./*; then
    tar_status=$?
fi

if [ "$tar_status" -ne 0 ]; then
    if [ -f "$filename" ] && tar -tf "$filename" >/dev/null 2>&1; then
        echo "WARN: tar exited with status $tar_status but produced a readable archive; continuing." >&2
    else
        echo "ERROR: tar failed to create a readable archive (status: $tar_status)." >&2
        exit "$tar_status"
    fi
fi

cd "$CWD"
md5=$(md5sum "$filename" | awk '{print $1}')
sha256=$(sha256sum "$filename" | awk '{print $1}')
sha256_file="${filename}.sha256"
printf '%s  %s\n' "$sha256" "$(basename "$filename")" > "$sha256_file"

# Update version and package digests in plg file
sed -i "s/<!ENTITY version.*>/<!ENTITY version \"$version\">/" "$plgfile"
sed -i "s/<!ENTITY md5.*>/<!ENTITY md5 \"$md5\">/" "$plgfile"
if grep -q '^<!ENTITY sha256 ' "$plgfile"; then
    sed -i "s/<!ENTITY sha256.*>/<!ENTITY sha256 \"$sha256\">/" "$plgfile"
else
    sed -i "/^<!ENTITY md5 /a <!ENTITY sha256 \"$sha256\">" "$plgfile"
fi

# Keep CA template date aligned with the release version date.
if [ -n "$xml_date" ]; then
    sync_ca_template_metadata "$xmlfile" "$xml_date" "$branch"
fi

# Update branch references in plg file (URLs use XML entities like &github;).
rewrite_manifest_branch_metadata "$plgfile" "$version" "$branch"
validate_manifest_branch_matrix "$plgfile" "$version"
"${NODE_BIN}" "$(fvplus::path_for_command "${NODE_BIN}" "$CWD/scripts/generate_sbom.mjs")"

# Ensure a CHANGES block exists for the computed version so release validation
# cannot fail after bumping version metadata.
chmod +x "$ensure_changes_entry_script"
changes_entry_status=0
if [ "$changes_entry_timeout" -gt 0 ]; then
    timeout "${changes_entry_timeout}s" bash "$ensure_changes_entry_script" || changes_entry_status=$?
else
    bash "$ensure_changes_entry_script" || changes_entry_status=$?
fi
if [ "$changes_entry_status" -ne 0 ]; then
    if [ "$changes_entry_status" -eq 124 ] || [ "$changes_entry_status" -eq 137 ]; then
        echo "ERROR: CHANGES helper timed out after ${changes_entry_timeout}s. Add a ###${version} block to folderview.plus.plg or docs/releases/${version}.md, then rerun pkg_build.sh." >&2
    else
        echo "ERROR: CHANGES helper failed with status ${changes_entry_status}." >&2
    fi
    exit "$changes_entry_status"
fi

if [ "$archive_prune_keep" -gt 0 ]; then
    if [ ! -f "$prune_archives_script" ]; then
        echo "ERROR: Missing archive prune script: $prune_archives_script" >&2
        exit 1
    fi
    bash "$prune_archives_script" --archive-dir "$archive_dir" --keep "$archive_prune_keep" --current-version "$version"
fi

if [ "$validate_after_build" = true ]; then
    FVPLUS_ICON_ASSET_PACK_GUARDED=1 FVPLUS_ARCHIVE_DIR="$archive_dir" bash "$release_guard_script"
fi
if [ "$run_install_smoke" = true ]; then
    bash "$install_smoke_script"
fi

echo "Package created: $filename"
echo "Version: $version"
echo "MD5: $md5"
echo "SHA256: $sha256"
echo "SHA256 file: $sha256_file"
echo "Branch: $branch"
echo "PLG file updated"
