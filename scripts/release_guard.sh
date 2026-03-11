#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLG_FILE="${ROOT_DIR}/folderview.plus.plg"
CA_TEMPLATE_FILE="${ROOT_DIR}/folderview.plus.xml"
PLUGIN_SRC_DIR="${ROOT_DIR}/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus"
SERVER_DIR="${PLUGIN_SRC_DIR}/server"
ARCHIVE_DIR="${FVPLUS_ARCHIVE_DIR:-${ROOT_DIR}/archive}"
MAX_ARCHIVE_BYTES="${FVPLUS_MAX_ARCHIVE_BYTES:-52428800}" # 50 MiB default ceiling
MAX_ARCHIVE_FILE_COUNT="${FVPLUS_MAX_ARCHIVE_FILE_COUNT:-10000}"

packaging_sync_hint() {
  echo "HINT: Run 'bash pkg_build.sh' and commit updated release artifacts (folderview.plus.plg + archive/*.txz + archive/*.sha256)." >&2
}

fail_packaged_source_mismatch() {
  local message="${1:-Packaged artifact does not match source.}"
  echo "ERROR: ${message}" >&2
  packaging_sync_hint
  exit 1
}

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

if [[ ! -f "${CA_TEMPLATE_FILE}" ]]; then
  echo "ERROR: Missing CA template file: ${CA_TEMPLATE_FILE}" >&2
  exit 1
fi

CA_TEMPLATE_DATE="$(sed -n 's|.*<Date>\([^<]*\)</Date>.*|\1|p' "${CA_TEMPLATE_FILE}" | head -n 1 || true)"
if [[ -z "${CA_TEMPLATE_DATE}" ]]; then
  echo "ERROR: Could not parse <Date> from ${CA_TEMPLATE_FILE}" >&2
  exit 1
fi

EXPECTED_CA_TEMPLATE_DATE="${VERSION_DATE//./-}"
if [[ "${CA_TEMPLATE_DATE}" != "${EXPECTED_CA_TEMPLATE_DATE}" ]]; then
  echo "ERROR: CA template <Date> mismatch. expected=${EXPECTED_CA_TEMPLATE_DATE}, found=${CA_TEMPLATE_DATE}" >&2
  exit 1
fi

if command -v xmllint >/dev/null 2>&1; then
  xmllint --noout "${PLG_FILE}"
else
  # shellcheck disable=SC2016
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

ARCHIVE_FILE="${ARCHIVE_DIR}/folderview.plus-${VERSION}.txz"
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
SOURCE_FOLDER_PAGE="${ROOT_DIR}/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/Folder.page"
SOURCE_SETTINGS_PAGE="${ROOT_DIR}/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/FolderViewPlus.page"
SOURCE_SERVER_LIB="${ROOT_DIR}/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.php"
SOURCE_SERVER_UPDATE_NOTES="${ROOT_DIR}/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/update_notes.php"

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
if [[ ! -f "${SOURCE_FOLDER_PAGE}" ]]; then
  echo "ERROR: Missing source folder editor page: ${SOURCE_FOLDER_PAGE}" >&2
  exit 1
fi
if [[ ! -f "${SOURCE_SETTINGS_PAGE}" ]]; then
  echo "ERROR: Missing source settings page: ${SOURCE_SETTINGS_PAGE}" >&2
  exit 1
fi
if [[ ! -f "${SOURCE_SERVER_LIB}" ]]; then
  echo "ERROR: Missing source server lib: ${SOURCE_SERVER_LIB}" >&2
  exit 1
fi
if [[ ! -f "${SOURCE_SERVER_UPDATE_NOTES}" ]]; then
  echo "ERROR: Missing source server update notes endpoint: ${SOURCE_SERVER_UPDATE_NOTES}" >&2
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
  "./usr/local/emhttp/plugins/folderview.plus/Folder.page"
  "./usr/local/emhttp/plugins/folderview.plus/FolderViewPlus.page"
  "./usr/local/emhttp/plugins/folderview.plus/server/lib.php"
  "./usr/local/emhttp/plugins/folderview.plus/server/update_notes.php"
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
TMP_ARCHIVE_FOLDER_PAGE="$(mktemp)"
TMP_ARCHIVE_SETTINGS_PAGE="$(mktemp)"
TMP_ARCHIVE_SERVER_LIB="$(mktemp)"
TMP_ARCHIVE_SERVER_UPDATE_NOTES="$(mktemp)"
trap 'rm -f "${TMP_ARCHIVE_FOLDER_JS}" "${TMP_ARCHIVE_FOLDER_CSS}" "${TMP_ARCHIVE_SETTINGS_JS}" "${TMP_ARCHIVE_SETTINGS_CSS}" "${TMP_ARCHIVE_FOLDER_PAGE}" "${TMP_ARCHIVE_SETTINGS_PAGE}" "${TMP_ARCHIVE_SERVER_LIB}" "${TMP_ARCHIVE_SERVER_UPDATE_NOTES}"' EXIT
ARCHIVE_FOLDER_JS_PATH="./usr/local/emhttp/plugins/folderview.plus/scripts/folder.js"
ARCHIVE_FOLDER_CSS_PATH="./usr/local/emhttp/plugins/folderview.plus/styles/folder.css"
ARCHIVE_SETTINGS_JS_PATH="./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.js"
ARCHIVE_SETTINGS_CSS_PATH="./usr/local/emhttp/plugins/folderview.plus/styles/folderviewplus.css"
ARCHIVE_FOLDER_PAGE_PATH="./usr/local/emhttp/plugins/folderview.plus/Folder.page"
ARCHIVE_SETTINGS_PAGE_PATH="./usr/local/emhttp/plugins/folderview.plus/FolderViewPlus.page"
ARCHIVE_SERVER_LIB_PATH="./usr/local/emhttp/plugins/folderview.plus/server/lib.php"
ARCHIVE_SERVER_UPDATE_NOTES_PATH="./usr/local/emhttp/plugins/folderview.plus/server/update_notes.php"
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
if ! grep -Fxq "${ARCHIVE_FOLDER_PAGE_PATH}" <<< "${ARCHIVE_LIST}"; then
  ARCHIVE_FOLDER_PAGE_PATH="${ARCHIVE_FOLDER_PAGE_PATH#./}"
fi
if ! grep -Fxq "${ARCHIVE_SETTINGS_PAGE_PATH}" <<< "${ARCHIVE_LIST}"; then
  ARCHIVE_SETTINGS_PAGE_PATH="${ARCHIVE_SETTINGS_PAGE_PATH#./}"
fi
if ! grep -Fxq "${ARCHIVE_SERVER_LIB_PATH}" <<< "${ARCHIVE_LIST}"; then
  ARCHIVE_SERVER_LIB_PATH="${ARCHIVE_SERVER_LIB_PATH#./}"
fi
if ! grep -Fxq "${ARCHIVE_SERVER_UPDATE_NOTES_PATH}" <<< "${ARCHIVE_LIST}"; then
  ARCHIVE_SERVER_UPDATE_NOTES_PATH="${ARCHIVE_SERVER_UPDATE_NOTES_PATH#./}"
fi
tar -xOf "${ARCHIVE_FILE}" "${ARCHIVE_FOLDER_JS_PATH}" > "${TMP_ARCHIVE_FOLDER_JS}"
tar -xOf "${ARCHIVE_FILE}" "${ARCHIVE_FOLDER_CSS_PATH}" > "${TMP_ARCHIVE_FOLDER_CSS}"
tar -xOf "${ARCHIVE_FILE}" "${ARCHIVE_SETTINGS_JS_PATH}" > "${TMP_ARCHIVE_SETTINGS_JS}"
tar -xOf "${ARCHIVE_FILE}" "${ARCHIVE_SETTINGS_CSS_PATH}" > "${TMP_ARCHIVE_SETTINGS_CSS}"
tar -xOf "${ARCHIVE_FILE}" "${ARCHIVE_FOLDER_PAGE_PATH}" > "${TMP_ARCHIVE_FOLDER_PAGE}"
tar -xOf "${ARCHIVE_FILE}" "${ARCHIVE_SETTINGS_PAGE_PATH}" > "${TMP_ARCHIVE_SETTINGS_PAGE}"
tar -xOf "${ARCHIVE_FILE}" "${ARCHIVE_SERVER_LIB_PATH}" > "${TMP_ARCHIVE_SERVER_LIB}"
tar -xOf "${ARCHIVE_FILE}" "${ARCHIVE_SERVER_UPDATE_NOTES_PATH}" > "${TMP_ARCHIVE_SERVER_UPDATE_NOTES}"

if ! grep -q 'fv-force-left-v2 marker' "${TMP_ARCHIVE_FOLDER_JS}"; then
  echo "ERROR: Packaged folder.js is missing the alignment regression marker comment." >&2
  exit 1
fi

if ! cmp -s "${SOURCE_FOLDER_JS}" "${TMP_ARCHIVE_FOLDER_JS}"; then
  fail_packaged_source_mismatch "Packaged folder.js does not match source folder.js."
fi

if ! cmp -s "${SOURCE_FOLDER_CSS}" "${TMP_ARCHIVE_FOLDER_CSS}"; then
  fail_packaged_source_mismatch "Packaged folder.css does not match source folder.css."
fi
if ! cmp -s "${SOURCE_SETTINGS_JS}" "${TMP_ARCHIVE_SETTINGS_JS}"; then
  fail_packaged_source_mismatch "Packaged folderviewplus.js does not match source folderviewplus.js."
fi
if ! cmp -s "${SOURCE_SETTINGS_CSS}" "${TMP_ARCHIVE_SETTINGS_CSS}"; then
  fail_packaged_source_mismatch "Packaged folderviewplus.css does not match source folderviewplus.css."
fi
if ! cmp -s "${SOURCE_FOLDER_PAGE}" "${TMP_ARCHIVE_FOLDER_PAGE}"; then
  fail_packaged_source_mismatch "Packaged Folder.page does not match source Folder.page."
fi
if ! cmp -s "${SOURCE_SETTINGS_PAGE}" "${TMP_ARCHIVE_SETTINGS_PAGE}"; then
  fail_packaged_source_mismatch "Packaged FolderViewPlus.page does not match source FolderViewPlus.page."
fi
if ! cmp -s "${SOURCE_SERVER_LIB}" "${TMP_ARCHIVE_SERVER_LIB}"; then
  fail_packaged_source_mismatch "Packaged server/lib.php does not match source server/lib.php."
fi
if ! cmp -s "${SOURCE_SERVER_UPDATE_NOTES}" "${TMP_ARCHIVE_SERVER_UPDATE_NOTES}"; then
  fail_packaged_source_mismatch "Packaged server/update_notes.php does not match source server/update_notes.php."
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

if grep -Eiq 'Action required: replace these placeholder notes' <<< "${CURRENT_CHANGES_LINES}"; then
  echo "ERROR: CHANGES entry for ${VERSION} still contains placeholder notes from ensure_plg_changes_entry.sh." >&2
  exit 1
fi

is_allowed_changes_category() {
  local category_name="${1:-}"
  case "${category_name}" in
    Feature|Fix|Security|Performance|UX|UI/UX|Maintenance|Docs|Test|Quality|"Regression guard"|Compatibility|Refactor)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

mapfile -t CURRENT_CHANGES_CATEGORIES < <(printf '%s\n' "${CURRENT_CHANGES_LINES}" | sed -n 's/^[[:space:]]*-[[:space:]]*\([^:][^:]*\):.*/\1/p')
if [[ ${#CURRENT_CHANGES_CATEGORIES[@]} -eq 0 ]]; then
  echo "ERROR: CHANGES entry for ${VERSION} must include at least one category-formatted bullet (for example: '- Feature: ...')." >&2
  exit 1
fi

INVALID_CHANGE_CATEGORIES=()
for raw_category in "${CURRENT_CHANGES_CATEGORIES[@]}"; do
  category="$(printf '%s' "${raw_category}" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
  if [[ -z "${category}" ]]; then
    continue
  fi
  if ! is_allowed_changes_category "${category}"; then
    INVALID_CHANGE_CATEGORIES+=("${category}")
  fi
done

if [[ ${#INVALID_CHANGE_CATEGORIES[@]} -gt 0 ]]; then
  unique_invalid="$(printf '%s\n' "${INVALID_CHANGE_CATEGORIES[@]}" | sort -u | awk 'BEGIN{first=1} {if (!first) {printf ", "} printf "%s", $0; first=0}')"
  echo "ERROR: CHANGES entry for ${VERSION} contains unsupported category tag(s): ${unique_invalid}" >&2
  echo "Allowed categories: Feature, Fix, Security, Performance, UX, UI/UX, Maintenance, Docs, Test, Quality, Regression guard, Compatibility, Refactor." >&2
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
