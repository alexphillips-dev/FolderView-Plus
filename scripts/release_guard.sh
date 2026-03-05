#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLG_FILE="${ROOT_DIR}/folderview.plus.plg"

if [[ ! -f "${PLG_FILE}" ]]; then
  echo "ERROR: Missing plugin manifest: ${PLG_FILE}" >&2
  exit 1
fi

VERSION="$(sed -n 's/^<!ENTITY version "\([^"]*\)".*/\1/p' "${PLG_FILE}" | head -n 1 || true)"
MD5_ENTITY="$(sed -n 's/^<!ENTITY md5 "\([^"]*\)".*/\1/p' "${PLG_FILE}" | head -n 1 || true)"

if [[ -z "${VERSION}" ]]; then
  echo "ERROR: Could not parse version entity from folderview.plus.plg" >&2
  exit 1
fi

if [[ -z "${MD5_ENTITY}" ]]; then
  echo "ERROR: Could not parse md5 entity from folderview.plus.plg" >&2
  exit 1
fi

if ! [[ "${VERSION}" =~ ^[0-9]{4}\.[0-9]{2}\.[0-9]{2}([.-][0-9]+|-beta[0-9]*)?$ ]]; then
  echo "ERROR: Version has unexpected format: ${VERSION}" >&2
  exit 1
fi

if command -v xmllint >/dev/null 2>&1; then
  xmllint --noout "${PLG_FILE}"
else
  php -r '
      libxml_use_internal_errors(true);
      $xml = @file_get_contents($argv[1]);
      if ($xml === false) { fwrite(STDERR, "ERROR: Failed to read PLG file\n"); exit(1); }
      $dom = new DOMDocument();
      if (!$dom->loadXML($xml, LIBXML_NONET | LIBXML_NOERROR | LIBXML_NOWARNING)) {
          fwrite(STDERR, "ERROR: Invalid PLG XML\n");
          exit(1);
      }
  ' "${PLG_FILE}"
fi

ARCHIVE_FILE="${ROOT_DIR}/archive/folderview.plus-${VERSION}.txz"
if [[ ! -f "${ARCHIVE_FILE}" ]]; then
  echo "ERROR: Missing archive package for current version: ${ARCHIVE_FILE}" >&2
  exit 1
fi

if ! grep -q "###${VERSION}" "${PLG_FILE}"; then
  echo "ERROR: CHANGES section does not contain an entry for ${VERSION}" >&2
  exit 1
fi

MD5_CALC="$(md5sum "${ARCHIVE_FILE}" | awk '{print $1}')"
if [[ "${MD5_ENTITY}" != "${MD5_CALC}" ]]; then
  echo "ERROR: md5 entity mismatch. plg=${MD5_ENTITY}, archive=${MD5_CALC}" >&2
  exit 1
fi

echo "Release guard checks passed:"
echo "  version: ${VERSION}"
echo "  archive: ${ARCHIVE_FILE##*/}"
echo "  md5: ${MD5_CALC}"
