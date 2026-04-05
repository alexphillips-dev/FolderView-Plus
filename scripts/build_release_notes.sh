#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib.sh
source "${ROOT_DIR}/scripts/lib.sh"
cd "${ROOT_DIR}"

fvplus::require_commands awk sed bash

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

if [[ -f "${OVERRIDE_FILE}" ]]; then
  cat > "${OUTPUT}" <<EOF
## FolderView Plus ${VERSION}

Install URL: \`https://raw.githubusercontent.com/alexphillips-dev/FolderView-Plus/${INSTALL_BRANCH}/folderview.plus.plg\`

### Changes

$(cat "${OVERRIDE_FILE}")
EOF
  exit 0
fi

NOTES_BLOCK="$(awk -v version="${VERSION}" '
  BEGIN { capture = 0 }
  /^###/ {
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
