#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLG_FILE="${ROOT_DIR}/folderview.plus.plg"
# shellcheck source=scripts/lib.sh
source "${ROOT_DIR}/scripts/lib.sh"

if [[ ! -f "${PLG_FILE}" ]]; then
  fvplus::fail "Missing plugin manifest: ${PLG_FILE}"
fi

VERSION="$(fvplus::read_plg_version "${PLG_FILE}")"

if grep -q "^###${VERSION}$" "${PLG_FILE}"; then
  echo "CHANGES entry already present for ${VERSION}"
  exit 0
fi

TMP_FILE="$(mktemp)"
trap 'rm -f "${TMP_FILE}"' EXIT

awk -v version="${VERSION}" '
  BEGIN { inserted = 0 }
  {
    print
    if (!inserted && $0 ~ /<CHANGES>/) {
      print ""
      print "###" version
      print "- Maintenance: automated release metadata update."
      print ""
      inserted = 1
    }
  }
' "${PLG_FILE}" > "${TMP_FILE}"

mv "${TMP_FILE}" "${PLG_FILE}"
echo "Inserted CHANGES entry for ${VERSION}"
