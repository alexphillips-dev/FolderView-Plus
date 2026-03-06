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
  echo "ERROR: Could not parse version from PLG manifest." >&2
  exit 1
fi

ARCHIVE_FILE="${ROOT_DIR}/archive/folderview.plus-${VERSION}.txz"
if [[ ! -f "${ARCHIVE_FILE}" ]]; then
  echo "ERROR: Missing archive for current version: ${ARCHIVE_FILE}" >&2
  exit 1
fi

if ! command -v php >/dev/null 2>&1; then
  echo "ERROR: php is required for install smoke checks." >&2
  exit 1
fi
if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node is required for install smoke checks." >&2
  exit 1
fi

ARCHIVE_LIST="$(tar -tf "${ARCHIVE_FILE}")"
ARCHIVE_LIST_NORMALIZED="$(printf '%s\n' "${ARCHIVE_LIST}" | sed 's#^\./##')"
if grep -q '^./local/' <<< "${ARCHIVE_LIST}"; then
  echo "ERROR: Archive contains invalid top-level './local/' paths." >&2
  exit 1
fi

REQUIRED_ARCHIVE_ENTRIES=(
  "./usr/local/emhttp/plugins/folderview.plus/Folder.page"
  "./usr/local/emhttp/plugins/folderview.plus/FolderViewPlus.page"
  "./usr/local/emhttp/plugins/folderview.plus/folderview.plus.Docker.page"
  "./usr/local/emhttp/plugins/folderview.plus/folderview.plus.VMs.page"
  "./usr/local/emhttp/plugins/folderview.plus/folderview.plus.Dashboard.page"
  "./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.js"
  "./usr/local/emhttp/plugins/folderview.plus/scripts/folder.js"
  "./usr/local/emhttp/plugins/folderview.plus/server/lib.php"
  "./usr/local/emhttp/plugins/folderview.plus/server/read.php"
  "./usr/local/emhttp/plugins/folderview.plus/server/read_info.php"
  "./usr/local/emhttp/plugins/folderview.plus/server/create.php"
  "./usr/local/emhttp/plugins/folderview.plus/server/update.php"
  "./usr/local/emhttp/plugins/folderview.plus/server/delete.php"
  "./usr/local/emhttp/plugins/folderview.plus/server/backup.php"
  "./usr/local/emhttp/plugins/folderview.plus/styles/folderviewplus.css"
)

for required_entry in "${REQUIRED_ARCHIVE_ENTRIES[@]}"; do
  normalized_required_entry="${required_entry#./}"
  if ! grep -Fxq "${normalized_required_entry}" <<< "${ARCHIVE_LIST_NORMALIZED}"; then
    echo "ERROR: Missing required archive entry: ${required_entry}" >&2
    exit 1
  fi
done

ICON_ARCHIVE_ENTRIES="$(printf '%s\n' "${ARCHIVE_LIST_NORMALIZED}" | grep -E '^usr/local/emhttp/plugins/folderview.plus/images/(third-party-icons|custom)/' || true)"
if [[ -n "${ICON_ARCHIVE_ENTRIES}" ]]; then
  ICON_ARCHIVE_FILES="$(printf '%s\n' "${ICON_ARCHIVE_ENTRIES}" | grep -Ev '/$' || true)"
  INVALID_ICON_ENTRIES="$(printf '%s\n' "${ICON_ARCHIVE_FILES}" | grep -Ev '\.(png|jpg|jpeg|gif|webp|svg|bmp|ico|avif)$' || true)"
  if [[ -n "${INVALID_ICON_ENTRIES}" ]]; then
    echo "ERROR: Archive contains non-icon files in icon asset directories:" >&2
    echo "${INVALID_ICON_ENTRIES}" >&2
    exit 1
  fi
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT
tar -xf "${ARCHIVE_FILE}" -C "${TMP_DIR}"
PLUGIN_DIR="${TMP_DIR}/usr/local/emhttp/plugins/folderview.plus"

if [[ ! -d "${PLUGIN_DIR}" ]]; then
  echo "ERROR: Extracted plugin directory not found: ${PLUGIN_DIR}" >&2
  exit 1
fi

REQUIRED_FILES=(
  "Folder.page"
  "FolderViewPlus.page"
  "folderview.plus.Docker.page"
  "folderview.plus.VMs.page"
  "folderview.plus.Dashboard.page"
  "scripts/folderviewplus.js"
  "scripts/docker.js"
  "scripts/vm.js"
  "scripts/folder.js"
  "styles/folderviewplus.css"
  "styles/folder.css"
  "server/lib.php"
  "server/read.php"
  "server/read_info.php"
  "server/create.php"
  "server/update.php"
  "server/delete.php"
  "server/backup.php"
)

for required_file in "${REQUIRED_FILES[@]}"; do
  path="${PLUGIN_DIR}/${required_file}"
  if [[ ! -s "${path}" ]]; then
    echo "ERROR: Missing or empty extracted file: ${path}" >&2
    exit 1
  fi
done

while IFS= read -r -d '' file; do
  php -l "${file}" >/dev/null
done < <(find "${PLUGIN_DIR}/server" -type f -name "*.php" -print0)

while IFS= read -r -d '' file; do
  node --check "${file}" >/dev/null
done < <(find "${PLUGIN_DIR}/scripts" -type f -name "*.js" ! -path "*/scripts/include/*" -print0)

MUTATING_ENDPOINTS=(
  "create.php"
  "update.php"
  "delete.php"
  "prefs.php"
  "reorder.php"
  "sync_order.php"
  "bulk_assign.php"
  "bulk_folder_action.php"
)
for endpoint in "${MUTATING_ENDPOINTS[@]}"; do
  file="${PLUGIN_DIR}/server/${endpoint}"
  if ! grep -q 'requireMutationRequestGuard()' "${file}"; then
    echo "ERROR: Missing mutation request guard in ${endpoint}" >&2
    exit 1
  fi
done

MULTI_ACTION_ENDPOINTS=(
  "backup.php"
  "templates.php"
  "diagnostics.php"
)
for endpoint in "${MULTI_ACTION_ENDPOINTS[@]}"; do
  file="${PLUGIN_DIR}/server/${endpoint}"
  if ! grep -q 'requireMutationRequestGuard()' "${file}"; then
    echo "ERROR: Missing mutation request guard branch in ${endpoint}" >&2
    exit 1
  fi
done

echo "Install smoke checks passed:"
echo "  version: ${VERSION}"
echo "  archive: ${ARCHIVE_FILE##*/}"
