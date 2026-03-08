#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLG_FILE="${ROOT_DIR}/folderview.plus.plg"
PLUGIN_SRC_DIR="${ROOT_DIR}/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus"
SERVER_DIR="${PLUGIN_SRC_DIR}/server"
MAX_ARCHIVE_BYTES="${FVPLUS_MAX_ARCHIVE_BYTES:-52428800}" # 50 MiB default ceiling
MAX_ARCHIVE_FILE_COUNT="${FVPLUS_MAX_ARCHIVE_FILE_COUNT:-10000}"

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

if ! [[ "${VERSION}" =~ ^[0-9]{4}\.[0-9]{2}\.[0-9]{2}(\.[0-9]{2,}|-beta[0-9]*)$ ]]; then
  echo "ERROR: Version has unexpected format: ${VERSION}" >&2
  exit 1
fi

if [[ "${VERSION}" =~ ^([0-9]{4}\.[0-9]{2}\.[0-9]{2})(\.[0-9]{2,}|-beta[0-9]*)$ ]]; then
  VERSION_DATE="${BASH_REMATCH[1]}"
  TODAY_DATE="$(date +"%Y.%m.%d")"
  if [[ "${VERSION_DATE}" > "${TODAY_DATE}" ]]; then
    echo "ERROR: Version date (${VERSION_DATE}) is in the future (today: ${TODAY_DATE})." >&2
    exit 1
  fi
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

ARCHIVE_SIZE_BYTES="$(wc -c < "${ARCHIVE_FILE}" | tr -d '[:space:]')"
if [[ -z "${ARCHIVE_SIZE_BYTES}" || "${ARCHIVE_SIZE_BYTES}" -gt "${MAX_ARCHIVE_BYTES}" ]]; then
  echo "ERROR: Archive exceeds size budget (${ARCHIVE_SIZE_BYTES:-unknown} bytes > ${MAX_ARCHIVE_BYTES} bytes)." >&2
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
ARCHIVE_FILES_ONLY="$(printf '%s\n' "${ARCHIVE_LIST_NORMALIZED}" | grep -Ev '/$' || true)"

ARCHIVE_FILE_COUNT="$(printf '%s\n' "${ARCHIVE_FILES_ONLY}" | sed '/^$/d' | wc -l | tr -d '[:space:]')"
if [[ -z "${ARCHIVE_FILE_COUNT}" || "${ARCHIVE_FILE_COUNT}" -gt "${MAX_ARCHIVE_FILE_COUNT}" ]]; then
  echo "ERROR: Archive file count exceeds budget (${ARCHIVE_FILE_COUNT:-unknown} > ${MAX_ARCHIVE_FILE_COUNT})." >&2
  exit 1
fi

if grep -q '^./local/' <<< "${ARCHIVE_LIST}"; then
  echo "ERROR: Archive contains invalid top-level './local/' paths. Must install under './usr/local/'." >&2
  exit 1
fi

DANGEROUS_ARCHIVE_EXTENSIONS='exe|dll|bat|cmd|com|msi|scr|ps1|jar|apk|deb|rpm|dmg|pkg|appimage|iso'
DANGEROUS_ARCHIVE_FILES="$(printf '%s\n' "${ARCHIVE_FILES_ONLY}" | grep -Ei "\.(${DANGEROUS_ARCHIVE_EXTENSIONS})$" || true)"
if [[ -n "${DANGEROUS_ARCHIVE_FILES}" ]]; then
  echo "ERROR: Archive contains blocked executable/binary artifacts:" >&2
  echo "${DANGEROUS_ARCHIVE_FILES}" >&2
  exit 1
fi

ALLOWED_ARCHIVE_EXTENSIONS='page|php|js|css|png|jpg|jpeg|gif|webp|svg|bmp|ico|avif|json|md|txt|woff|woff2|ttf|eot|otf|map'
UNEXPECTED_ARCHIVE_FILES="$(printf '%s\n' "${ARCHIVE_FILES_ONLY}" | grep -Evi "\.(${ALLOWED_ARCHIVE_EXTENSIONS})$" || true)"
if [[ -n "${UNEXPECTED_ARCHIVE_FILES}" ]]; then
  echo "ERROR: Archive contains files with unexpected extensions:" >&2
  echo "${UNEXPECTED_ARCHIVE_FILES}" >&2
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

if ! grep -Eq "define\('FV3_DEBUG_MODE', false\)" "${SERVER_DIR}/lib.php"; then
  echo "ERROR: FV3_DEBUG_MODE must be false for release builds." >&2
  exit 1
fi
if grep -Eq "define\('FV3_DEBUG_MODE', true\)" "${SERVER_DIR}/lib.php"; then
  echo "ERROR: FV3_DEBUG_MODE is enabled in lib.php." >&2
  exit 1
fi
if grep -Eq 'const FOLDER_VIEW_DEBUG_MODE = true;' "${PLUGIN_SRC_DIR}/scripts/docker.js"; then
  echo "ERROR: FOLDER_VIEW_DEBUG_MODE is enabled in docker.js." >&2
  exit 1
fi
if grep -Eq 'const VM_DEBUG_MODE = true;' "${PLUGIN_SRC_DIR}/scripts/vm.js"; then
  echo "ERROR: VM_DEBUG_MODE is enabled in vm.js." >&2
  exit 1
fi
if grep -Eq 'const DASHBOARD_DEBUG_MODE = true;' "${PLUGIN_SRC_DIR}/scripts/dashboard.js"; then
  echo "ERROR: DASHBOARD_DEBUG_MODE is enabled in dashboard.js." >&2
  exit 1
fi

if command -v rg >/dev/null 2>&1; then
  TARGET_BLANK_LINES="$(rg -n 'target=\"_blank\"' "${PLUGIN_SRC_DIR}" -g '*.js' -g '*.page' || true)"
else
  TARGET_BLANK_LINES="$(grep -RIn --include='*.js' --include='*.page' 'target="_blank"' "${PLUGIN_SRC_DIR}" || true)"
fi
if [[ -n "${TARGET_BLANK_LINES}" ]]; then
  TARGET_BLANK_MISSING_REL="$(printf '%s\n' "${TARGET_BLANK_LINES}" | grep -Ev 'rel=\"noopener noreferrer\"' || true)"
  if [[ -n "${TARGET_BLANK_MISSING_REL}" ]]; then
    echo "ERROR: Found target=\"_blank\" without rel=\"noopener noreferrer\":" >&2
    echo "${TARGET_BLANK_MISSING_REL}" >&2
    exit 1
  fi
fi

if command -v rg >/dev/null 2>&1; then
  WINDOW_OPEN_BLANK_LINES="$(rg -n "window\\.open\\([^\\n]*['\"]_blank['\"]" "${PLUGIN_SRC_DIR}" -g '*.js' || true)"
else
  WINDOW_OPEN_BLANK_LINES="$(grep -RInE --include='*.js' "window\\.open\\([^)]*['_\"]_blank['_\"]" "${PLUGIN_SRC_DIR}" || true)"
fi
if [[ -n "${WINDOW_OPEN_BLANK_LINES}" ]]; then
  WINDOW_OPEN_MISSING_NOOPENER="$(printf '%s\n' "${WINDOW_OPEN_BLANK_LINES}" | grep -Evi 'noopener' || true)"
  if [[ -n "${WINDOW_OPEN_MISSING_NOOPENER}" ]]; then
    echo "ERROR: Found window.open(..., '_blank', ...) calls without noopener:" >&2
    echo "${WINDOW_OPEN_MISSING_NOOPENER}" >&2
    exit 1
  fi
fi

if [[ ! -f "${SERVER_DIR}/update_notes.php" ]]; then
  echo "ERROR: Missing update_notes.php endpoint." >&2
  exit 1
fi
if ! grep -q 'readCurrentVersionChangeSummary' "${SERVER_DIR}/update_notes.php"; then
  echo "ERROR: update_notes.php must use readCurrentVersionChangeSummary()." >&2
  exit 1
fi
if ! grep -q "'lines' =>" "${SERVER_DIR}/update_notes.php"; then
  echo "ERROR: update_notes.php must return lines payload." >&2
  exit 1
fi
if ! grep -q "'category' =>" "${SERVER_DIR}/update_notes.php"; then
  echo "ERROR: update_notes.php must return category payload." >&2
  exit 1
fi
if ! grep -q "'headline' =>" "${SERVER_DIR}/update_notes.php"; then
  echo "ERROR: update_notes.php must return headline payload." >&2
  exit 1
fi
if ! grep -q 'function classifyChangesCategory' "${SERVER_DIR}/lib.php"; then
  echo "ERROR: lib.php must define classifyChangesCategory()." >&2
  exit 1
fi
if ! grep -q 'function readCurrentVersionChangeSummary' "${SERVER_DIR}/lib.php"; then
  echo "ERROR: lib.php must define readCurrentVersionChangeSummary()." >&2
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

if [[ ! -d "${SERVER_DIR}" ]]; then
  echo "ERROR: Missing server directory: ${SERVER_DIR}" >&2
  exit 1
fi

READ_ONLY_ENDPOINTS=(
  "cpu.php"
  "read.php"
  "read_info.php"
  "read_order.php"
  "read_unraid_order.php"
  "third_party_icons.php"
  "update_check.php"
  "update_notes.php"
  "version.php"
)

while IFS= read -r endpoint_path; do
  endpoint_name="$(basename "${endpoint_path}")"
  if [[ "${endpoint_name}" == "lib.php" ]]; then
    continue
  fi
  if printf '%s\n' "${READ_ONLY_ENDPOINTS[@]}" | grep -Fxq "${endpoint_name}"; then
    continue
  fi
  if ! grep -q 'requireMutationRequestGuard()' "${endpoint_path}"; then
    echo "ERROR: Mutating endpoint is missing requireMutationRequestGuard(): ${endpoint_name}" >&2
    exit 1
  fi
done < <(find "${SERVER_DIR}" -maxdepth 1 -type f -name '*.php' | sort)

if ! grep -q "###${VERSION}" "${PLG_FILE}"; then
  echo "ERROR: CHANGES section does not contain an entry for ${VERSION}" >&2
  exit 1
fi

CURRENT_CHANGES_BLOCK="$(awk -v version="${VERSION}" '
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
' "${PLG_FILE}")"

CURRENT_CHANGES_LINES="$(printf '%s\n' "${CURRENT_CHANGES_BLOCK}" | sed '/^[[:space:]]*$/d')"
if [[ -z "${CURRENT_CHANGES_LINES}" ]]; then
  echo "ERROR: CHANGES entry for ${VERSION} is empty." >&2
  exit 1
fi

if ! grep -Eiq '(feature|enhancement|fix|bug|security|harden|performance|optimi|ui|ux|layout|mobile|usability|maintenance|refactor|docs|test|reliab|compat)' <<< "${CURRENT_CHANGES_LINES}"; then
  echo "ERROR: CHANGES entry for ${VERSION} lacks category-signaling keywords." >&2
  echo "Add release notes that indicate update type (feature/fix/security/performance/ui/maintenance)." >&2
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
