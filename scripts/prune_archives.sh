#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib.sh
source "${ROOT_DIR}/scripts/lib.sh"

ARCHIVE_DIR="${FVPLUS_ARCHIVE_DIR:-${ROOT_DIR}/archive}"
KEEP_COUNT="${FVPLUS_ARCHIVE_PRUNE_KEEP:-24}"
CURRENT_VERSION="${FVPLUS_ARCHIVE_PRUNE_CURRENT_VERSION:-}"
DRY_RUN=0

print_usage() {
  cat <<'EOF'
Usage: prune_archives.sh [options]
  --archive-dir DIR       Archive directory (default: ./archive)
  --keep N                Keep latest N versions (default: 24)
  --current-version VER   Always keep VER, even if outside the latest N
  --dry-run               Print what would be removed
  -h, --help              Show this help
EOF
}

is_nonnegative_integer() {
  [[ "${1:-}" =~ ^[0-9]+$ ]]
}

contains_exact() {
  local needle="${1:-}"
  shift || true
  local entry=""
  for entry in "$@"; do
    if [[ "${entry}" == "${needle}" ]]; then
      return 0
    fi
  done
  return 1
}

while [[ $# -gt 0 ]]; do
  case "${1:-}" in
    --archive-dir)
      [[ -n "${2:-}" ]] || fvplus::fail "--archive-dir requires a value."
      ARCHIVE_DIR="${2:-}"
      shift
      ;;
    --keep)
      [[ -n "${2:-}" ]] || fvplus::fail "--keep requires a numeric value."
      KEEP_COUNT="${2:-}"
      shift
      ;;
    --current-version)
      [[ -n "${2:-}" ]] || fvplus::fail "--current-version requires a value."
      CURRENT_VERSION="${2:-}"
      shift
      ;;
    --dry-run)
      DRY_RUN=1
      ;;
    -h|--help)
      print_usage
      exit 0
      ;;
    *)
      fvplus::fail "Unknown argument: ${1}"
      ;;
  esac
  shift
done

if [[ "${ARCHIVE_DIR}" != /* && ! "${ARCHIVE_DIR}" =~ ^[A-Za-z]:[\\/].* ]]; then
  ARCHIVE_DIR="${ROOT_DIR}/${ARCHIVE_DIR}"
fi

is_nonnegative_integer "${KEEP_COUNT}" || fvplus::fail "--keep must be a non-negative integer."
KEEP_COUNT=$((10#${KEEP_COUNT}))

if [[ -z "${CURRENT_VERSION}" && -f "${ROOT_DIR}/folderview.plus.plg" ]]; then
  CURRENT_VERSION="$(fvplus::read_plg_version "${ROOT_DIR}/folderview.plus.plg")"
fi

if [[ ! -d "${ARCHIVE_DIR}" ]]; then
  echo "Archive directory does not exist: ${ARCHIVE_DIR}"
  exit 0
fi

shopt -s nullglob
versions=()
for archive in "${ARCHIVE_DIR}"/folderview.plus-*.txz; do
  base_name="$(basename "${archive}")"
  version="${base_name#folderview.plus-}"
  version="${version%.txz}"
  [[ -n "${version}" ]] && versions+=("${version}")
done
shopt -u nullglob

if [[ ${#versions[@]} -eq 0 ]]; then
  echo "No archive files found in ${ARCHIVE_DIR}"
  exit 0
fi

mapfile -t sorted_versions < <(printf '%s\n' "${versions[@]}" | sed '/^$/d' | sort -Vu)
total_versions=${#sorted_versions[@]}

keep_versions=()
if (( KEEP_COUNT > 0 )); then
  if (( total_versions <= KEEP_COUNT )); then
    keep_versions=("${sorted_versions[@]}")
  else
    start_index=$((total_versions - KEEP_COUNT))
    keep_versions=("${sorted_versions[@]:start_index}")
  fi
fi

if [[ -n "${CURRENT_VERSION}" ]] && ! contains_exact "${CURRENT_VERSION}" "${keep_versions[@]}"; then
  keep_versions+=("${CURRENT_VERSION}")
fi

removed_count=0
removed_files=()

for version in "${sorted_versions[@]}"; do
  if contains_exact "${version}" "${keep_versions[@]}"; then
    continue
  fi
  archive_file="${ARCHIVE_DIR}/folderview.plus-${version}.txz"
  checksum_file="${archive_file}.sha256"
  if [[ -f "${archive_file}" ]]; then
    removed_files+=("${archive_file}")
  fi
  if [[ -f "${checksum_file}" ]]; then
    removed_files+=("${checksum_file}")
  fi
done

shopt -s nullglob
for checksum_file in "${ARCHIVE_DIR}"/folderview.plus-*.txz.sha256; do
  archive_file="${checksum_file%.sha256}"
  if [[ ! -f "${archive_file}" ]]; then
    removed_files+=("${checksum_file}")
  fi
done
shopt -u nullglob

if [[ ${#removed_files[@]} -eq 0 ]]; then
  echo "Archive prune complete: nothing to remove (keep=${KEEP_COUNT}, current=${CURRENT_VERSION:-n/a})."
  exit 0
fi

for file_path in "${removed_files[@]}"; do
  if [[ ${DRY_RUN} -eq 1 ]]; then
    echo "Would remove: ${file_path}"
  else
    rm -f "${file_path}"
    echo "Removed: ${file_path}"
  fi
  removed_count=$((removed_count + 1))
done

if [[ ${DRY_RUN} -eq 1 ]]; then
  echo "Archive prune dry-run complete: ${removed_count} file(s) would be removed."
else
  echo "Archive prune complete: removed ${removed_count} file(s), keep=${KEEP_COUNT}, current=${CURRENT_VERSION:-n/a}."
fi
