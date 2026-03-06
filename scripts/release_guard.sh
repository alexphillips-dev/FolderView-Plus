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

SOURCE_FOLDER_JS="${ROOT_DIR}/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.js"
SOURCE_FOLDER_CSS="${ROOT_DIR}/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/folder.css"
SOURCE_SETTINGS_JS="${ROOT_DIR}/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.js"
SOURCE_SETTINGS_CSS="${ROOT_DIR}/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/folderviewplus.css"

if [[ ! -f "${SOURCE_FOLDER_JS}" ]]; then
  echo "ERROR: Missing source folder editor script: ${SOURCE_FOLDER_JS}" >&2
  exit 1
fi
if [[ ! -f "${SOURCE_FOLDER_CSS}" ]]; then
  echo "ERROR: Missing source folder editor stylesheet: ${SOURCE_FOLDER_CSS}" >&2
  exit 1
fi
if [[ ! -f "${SOURCE_SETTINGS_JS}" ]]; then
  echo "ERROR: Missing source settings script: ${SOURCE_SETTINGS_JS}" >&2
  exit 1
fi
if [[ ! -f "${SOURCE_SETTINGS_CSS}" ]]; then
  echo "ERROR: Missing source settings stylesheet: ${SOURCE_SETTINGS_CSS}" >&2
  exit 1
fi

ARCHIVE_LIST="$(tar -tf "${ARCHIVE_FILE}")"
ARCHIVE_LIST_NORMALIZED="$(printf '%s\n' "${ARCHIVE_LIST}" | sed 's#^\./##')"

if grep -q '^./local/' <<< "${ARCHIVE_LIST}"; then
  echo "ERROR: Archive contains invalid top-level './local/' paths. Must install under './usr/local/'." >&2
  exit 1
fi

REQUIRED_ARCHIVE_PATHS=(
  "./usr/local/emhttp/plugins/folderview.plus/scripts/folder.js"
  "./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.js"
  "./usr/local/emhttp/plugins/folderview.plus/styles/folder.css"
  "./usr/local/emhttp/plugins/folderview.plus/styles/folderviewplus.css"
)

for required_path in "${REQUIRED_ARCHIVE_PATHS[@]}"; do
  normalized_required_path="${required_path#./}"
  if ! grep -Fxq "${normalized_required_path}" <<< "${ARCHIVE_LIST_NORMALIZED}"; then
    echo "ERROR: Missing required archive entry: ${required_path}" >&2
    exit 1
  fi
done

if ! grep -q 'fv-force-left-v2 marker' "${SOURCE_FOLDER_JS}"; then
  echo "ERROR: Source folder.js is missing the alignment regression marker comment." >&2
  exit 1
fi
if ! grep -q 'click\.fvsectionheader' "${SOURCE_SETTINGS_JS}"; then
  echo "ERROR: Source folderviewplus.js is missing mobile section-toggle header binding." >&2
  exit 1
fi
if ! grep -Fq 'h2[data-fv-section][data-fv-advanced="1"]' "${SOURCE_SETTINGS_JS}"; then
  echo "ERROR: Source folderviewplus.js is missing advanced-section heading selector for mobile support." >&2
  exit 1
fi
if ! grep -q '@media (max-width: 760px)' "${SOURCE_SETTINGS_CSS}"; then
  echo "ERROR: Source folderviewplus.css is missing mobile settings breakpoint rules." >&2
  exit 1
fi
if ! grep -q '\.fv-section-toggle::before' "${SOURCE_SETTINGS_CSS}"; then
  echo "ERROR: Source folderviewplus.css is missing mobile-friendly section toggle affordance." >&2
  exit 1
fi

TMP_ARCHIVE_FOLDER_JS="$(mktemp)"
TMP_ARCHIVE_FOLDER_CSS="$(mktemp)"
TMP_ARCHIVE_SETTINGS_JS="$(mktemp)"
TMP_ARCHIVE_SETTINGS_CSS="$(mktemp)"
trap 'rm -f "${TMP_ARCHIVE_FOLDER_JS}" "${TMP_ARCHIVE_FOLDER_CSS}" "${TMP_ARCHIVE_SETTINGS_JS}" "${TMP_ARCHIVE_SETTINGS_CSS}"' EXIT
ARCHIVE_FOLDER_JS_PATH="./usr/local/emhttp/plugins/folderview.plus/scripts/folder.js"
ARCHIVE_FOLDER_CSS_PATH="./usr/local/emhttp/plugins/folderview.plus/styles/folder.css"
ARCHIVE_SETTINGS_JS_PATH="./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.js"
ARCHIVE_SETTINGS_CSS_PATH="./usr/local/emhttp/plugins/folderview.plus/styles/folderviewplus.css"
if ! grep -Fxq "${ARCHIVE_FOLDER_JS_PATH}" <<< "${ARCHIVE_LIST}"; then
  ARCHIVE_FOLDER_JS_PATH="${ARCHIVE_FOLDER_JS_PATH#./}"
fi
if ! grep -Fxq "${ARCHIVE_FOLDER_CSS_PATH}" <<< "${ARCHIVE_LIST}"; then
  ARCHIVE_FOLDER_CSS_PATH="${ARCHIVE_FOLDER_CSS_PATH#./}"
fi
if ! grep -Fxq "${ARCHIVE_SETTINGS_JS_PATH}" <<< "${ARCHIVE_LIST}"; then
  ARCHIVE_SETTINGS_JS_PATH="${ARCHIVE_SETTINGS_JS_PATH#./}"
fi
if ! grep -Fxq "${ARCHIVE_SETTINGS_CSS_PATH}" <<< "${ARCHIVE_LIST}"; then
  ARCHIVE_SETTINGS_CSS_PATH="${ARCHIVE_SETTINGS_CSS_PATH#./}"
fi
tar -xOf "${ARCHIVE_FILE}" "${ARCHIVE_FOLDER_JS_PATH}" > "${TMP_ARCHIVE_FOLDER_JS}"
tar -xOf "${ARCHIVE_FILE}" "${ARCHIVE_FOLDER_CSS_PATH}" > "${TMP_ARCHIVE_FOLDER_CSS}"
tar -xOf "${ARCHIVE_FILE}" "${ARCHIVE_SETTINGS_JS_PATH}" > "${TMP_ARCHIVE_SETTINGS_JS}"
tar -xOf "${ARCHIVE_FILE}" "${ARCHIVE_SETTINGS_CSS_PATH}" > "${TMP_ARCHIVE_SETTINGS_CSS}"

if ! grep -q 'fv-force-left-v2 marker' "${TMP_ARCHIVE_FOLDER_JS}"; then
  echo "ERROR: Packaged folder.js is missing the alignment regression marker comment." >&2
  exit 1
fi

if ! cmp -s "${SOURCE_FOLDER_JS}" "${TMP_ARCHIVE_FOLDER_JS}"; then
  echo "ERROR: Packaged folder.js does not match source folder.js." >&2
  exit 1
fi

if ! cmp -s "${SOURCE_FOLDER_CSS}" "${TMP_ARCHIVE_FOLDER_CSS}"; then
  echo "ERROR: Packaged folder.css does not match source folder.css." >&2
  exit 1
fi
if ! cmp -s "${SOURCE_SETTINGS_JS}" "${TMP_ARCHIVE_SETTINGS_JS}"; then
  echo "ERROR: Packaged folderviewplus.js does not match source folderviewplus.js." >&2
  exit 1
fi
if ! cmp -s "${SOURCE_SETTINGS_CSS}" "${TMP_ARCHIVE_SETTINGS_CSS}"; then
  echo "ERROR: Packaged folderviewplus.css does not match source folderviewplus.css." >&2
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
