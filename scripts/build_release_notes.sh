#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib.sh
source "${ROOT_DIR}/scripts/lib.sh"
cd "${ROOT_DIR}"

fvplus::require_commands awk sed bash git

VERSION=""
OUTPUT=""
INSTALL_BRANCH="${FVPLUS_RELEASE_INSTALL_BRANCH:-main}"
OVERRIDE_FILE=""

usage() {
  cat <<'EOF'
Usage: build_release_notes.sh --version <version> --output <file>
EOF
}

while [[ $# -gt 0 ]]; do
  case "${1}" in
    --version)
      VERSION="${2:-}"
      shift
      ;;
    --output)
      OUTPUT="${2:-}"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fvplus::fail "Unknown argument: ${1}"
      ;;
  esac
  shift
done

if [[ -z "${VERSION}" ]]; then
  fvplus::fail "--version is required"
fi

if [[ -z "${OUTPUT}" ]]; then
  fvplus::fail "--output is required"
fi

OVERRIDE_FILE="docs/releases/${VERSION}.md"

append_provenance() {
  local source_commit previous_ref compare_url archive_checksum
  source_commit="$(git rev-parse HEAD)"
  previous_ref="${FVPLUS_RELEASE_PREVIOUS_REF:-$(git describe --tags --abbrev=0 --match 'v*' HEAD 2>/dev/null || true)}"
  archive_checksum=""
  if [[ -f "archive/folderview.plus-${VERSION}.txz.sha256" ]]; then
    archive_checksum="$(awk 'NR == 1 { print $1 }' "archive/folderview.plus-${VERSION}.txz.sha256")"
  fi
  {
    printf '\n### Release provenance\n\n'
    # shellcheck disable=SC2016
    printf -- '- Source commit: `%s`\n' "${source_commit}"
    # shellcheck disable=SC2016
    printf -- '- Package SHA-256: `%s`\n' "${archive_checksum:-not-built}"
    if [[ -n "${previous_ref}" ]] && git rev-parse --verify "${previous_ref}^{commit}" >/dev/null 2>&1; then
      compare_url="https://github.com/alexphillips-dev/FolderView-Plus/compare/${previous_ref}...${source_commit}"
      # shellcheck disable=SC2016
      printf -- '- Previous stable reference: `%s`\n' "${previous_ref}"
      printf -- '- Full source comparison: %s\n' "${compare_url}"
    else
      printf -- '- Previous stable reference: unavailable\n'
    fi
  } >> "${OUTPUT}"
}

if [[ -f "${OVERRIDE_FILE}" ]]; then
  cat > "${OUTPUT}" <<EOF
## FolderView Plus ${VERSION}

Install URL: \`https://raw.githubusercontent.com/alexphillips-dev/FolderView-Plus/${INSTALL_BRANCH}/folderview.plus.plg\`

### Changes

$(cat "${OVERRIDE_FILE}")
EOF
  append_provenance
  exit 0
fi

NOTES_BLOCK="$(awk -v version="${VERSION}" '
  BEGIN { capture = 0 }
  /^###[0-9]{4}\.[0-9]{2}\.[0-9]{2}\.[0-9]{2}[[:space:]]*$/ {
    if (capture) {
      exit
    }
    if ($0 ~ "^###" version "[[:space:]]*$") {
      capture = 1
      next
    }
  }
  {
    if (capture) {
      print
    }
  }
' folderview.plus.plg | sed '/^[[:space:]]*$/d')"

if [[ -z "${NOTES_BLOCK}" ]]; then
  fvplus::fail "Missing CHANGES block for version ${VERSION}"
fi

cat > "${OUTPUT}" <<EOF
## FolderView Plus ${VERSION}

Install URL: \`https://raw.githubusercontent.com/alexphillips-dev/FolderView-Plus/${INSTALL_BRANCH}/folderview.plus.plg\`

### Changes
${NOTES_BLOCK}
EOF
append_provenance
