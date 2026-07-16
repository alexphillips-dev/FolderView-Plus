#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLG_FILE="${ROOT_DIR}/folderview.plus.plg"
ARCHIVE_DIR="${FVPLUS_ARCHIVE_DIR:-${ROOT_DIR}/archive}"
# shellcheck source=scripts/lib.sh
source "${ROOT_DIR}/scripts/lib.sh"

if [[ ! -f "${PLG_FILE}" ]]; then
  fvplus::fail "Missing plugin manifest: ${PLG_FILE}"
fi

VERSION="$(fvplus::read_plg_version "${PLG_FILE}")"

ARCHIVE_FILE="${ARCHIVE_DIR}/folderview.plus-${VERSION}.txz"
if [[ ! -f "${ARCHIVE_FILE}" ]]; then
  fvplus::fail "Missing archive for current version: ${ARCHIVE_FILE}"
fi

fvplus::require_commands php node tar sed grep find
PHP_BIN="$(fvplus::resolve_platform_command php)"
NODE_BIN="$(fvplus::resolve_platform_command node)"

command_uses_windows_path_translation() {
  local command_path="${1:-}"
  [[ -n "${command_path}" ]] || return 1
  [[ "${command_path}" == *.exe ]] && return 0
  [[ "${command_path}" == /mnt/c/* ]] && return 0
  [[ "${command_path}" == *fvplus-bash-shims/* ]] && return 0
  return 1
}

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
  "./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.dirty.js"
  "./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.runtime-parity.js"
  "./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.settings-sections.js"
  "./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.setup-assistant.js"
  "./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.smart-detect-config.js"
  "./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.starter-templates.js"
  "./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.support-bundle-preview.js"
  "./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.support-bundle-telemetry.js"
  "./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.activity-diagnostics.js"
  "./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.settings-tree.js"
  "./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.folder-editor.js"
  "./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.settings-health.js"
  "./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.settings-workspaces.js"
  "./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.bulk-assignment.shared.js"
  "./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.bulk-assignment.js"
  "./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.runtime-actions.js"
  "./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.wizard.js"
  "./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.import.js"
  "./usr/local/emhttp/plugins/folderview.plus/scripts/install_icon_asset_pack.sh"
  "./usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.hierarchy.js"
  "./usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.actions.js"
  "./usr/local/emhttp/plugins/folderview.plus/scripts/folder.settings-transfer.js"
  "./usr/local/emhttp/plugins/folderview.plus/scripts/folder.editor.preview-runtime.js"
  "./usr/local/emhttp/plugins/folderview.plus/scripts/folder.editor.icons.js"
  "./usr/local/emhttp/plugins/folderview.plus/scripts/folder.js"
  "./usr/local/emhttp/plugins/folderview.plus/server/lib.php"
  "./usr/local/emhttp/plugins/folderview.plus/server/lib.diagnostics.php"
  "./usr/local/emhttp/plugins/folderview.plus/server/apply_folder_settings.php"
  "./usr/local/emhttp/plugins/folderview.plus/server/read.php"
  "./usr/local/emhttp/plugins/folderview.plus/server/read_info.php"
  "./usr/local/emhttp/plugins/folderview.plus/server/create.php"
  "./usr/local/emhttp/plugins/folderview.plus/server/update.php"
  "./usr/local/emhttp/plugins/folderview.plus/server/delete.php"
  "./usr/local/emhttp/plugins/folderview.plus/server/backup.php"
  "./usr/local/emhttp/plugins/folderview.plus/styles/theme.tokens.css"
  "./usr/local/emhttp/plugins/folderview.plus/styles/folderviewplus.css"
)

for required_entry in "${REQUIRED_ARCHIVE_ENTRIES[@]}"; do
  normalized_required_entry="${required_entry#./}"
  if ! grep -Fxq "${normalized_required_entry}" <<< "${ARCHIVE_LIST_NORMALIZED}"; then
    echo "ERROR: Missing required archive entry: ${required_entry}" >&2
    exit 1
  fi
done

ICON_ARCHIVE_ENTRIES="$(printf '%s\n' "${ARCHIVE_LIST_NORMALIZED}" | grep -E '^usr/local/emhttp/plugins/folderview.plus/images/third-party-icons/' || true)"
if [[ -n "${ICON_ARCHIVE_ENTRIES}" ]]; then
  echo "ERROR: Core plugin archive must not contain the versioned third-party icon library." >&2
  exit 1
fi

TMP_DIR="$(mktemp -d "${ROOT_DIR}/.tmp-install-smoke.XXXXXX")"
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
  "scripts/folderviewplus.dirty.js"
  "scripts/folderviewplus.runtime-parity.js"
  "scripts/folderviewplus.settings-sections.js"
  "scripts/folderviewplus.setup-assistant.js"
  "scripts/folderviewplus.smart-detect-config.js"
  "scripts/folderviewplus.starter-templates.js"
  "scripts/folderviewplus.support-bundle-preview.js"
  "scripts/folderviewplus.support-bundle-telemetry.js"
  "scripts/folderviewplus.activity-diagnostics.js"
  "scripts/folderviewplus.settings-tree.js"
  "scripts/folderviewplus.folder-editor.js"
  "scripts/folderviewplus.settings-health.js"
  "scripts/folderviewplus.settings-workspaces.js"
  "scripts/folderviewplus.bulk-assignment.shared.js"
  "scripts/folderviewplus.bulk-assignment.js"
  "scripts/folderviewplus.runtime-actions.js"
  "scripts/folderviewplus.wizard.js"
  "scripts/folderviewplus.import.js"
  "scripts/install_icon_asset_pack.sh"
  "scripts/docker.runtime.hierarchy.js"
  "scripts/docker.runtime.actions.js"
  "scripts/folder.settings-transfer.js"
  "scripts/docker.js"
  "scripts/vm.js"
  "scripts/folder.editor.preview-runtime.js"
  "scripts/folder.editor.icons.js"
  "scripts/folder.js"
  "styles/theme.tokens.css"
  "styles/folderviewplus.css"
  "styles/folder.css"
  "server/lib.php"
  "server/lib.diagnostics.php"
  "server/apply_folder_settings.php"
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
  if command -v wslpath >/dev/null 2>&1 && command_uses_windows_path_translation "${PHP_BIN}"; then
    php_target="$(wslpath -w "${file}")"
  else
    php_target="${file}"
  fi
  "${PHP_BIN}" -l "${php_target}" >/dev/null
done < <(find "${PLUGIN_DIR}/server" -type f -name "*.php" -print0)

while IFS= read -r -d '' file; do
  if command -v wslpath >/dev/null 2>&1 && command_uses_windows_path_translation "${NODE_BIN}"; then
    node_target="$(wslpath -w "${file}")"
  else
    node_target="${file}"
  fi
  "${NODE_BIN}" --check "${node_target}" >/dev/null
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
  "apply_folder_settings.php"
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
