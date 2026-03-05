#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLG_FILE="${ROOT_DIR}/folderview.plus.plg"

if [[ ! -f "${PLG_FILE}" ]]; then
  echo "ERROR: Missing plugin manifest: ${PLG_FILE}" >&2
  exit 1
fi

VERSION="$(sed -n 's/^<!ENTITY version "\([^"]*\)".*/\1/p' "${PLG_FILE}" | head -n 1 || true)"
if [[ -z "${VERSION}" ]]; then
  echo "ERROR: Could not parse version from folderview.plus.plg" >&2
  exit 1
fi

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
      print "- Automated release metadata update."
      print ""
      inserted = 1
    }
  }
' "${PLG_FILE}" > "${TMP_FILE}"

mv "${TMP_FILE}" "${PLG_FILE}"
echo "Inserted CHANGES entry for ${VERSION}"
