#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UTILS_FILE="${ROOT_DIR}/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.utils.js"
LIB_FILE="${ROOT_DIR}/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.php"
FIXTURE_DIR="${ROOT_DIR}/tests/fixtures/imports"
# shellcheck source=scripts/lib.sh
source "${ROOT_DIR}/scripts/lib.sh"

fvplus::require_commands grep

[[ -f "${UTILS_FILE}" ]] || fvplus::fail "Missing utils file: ${UTILS_FILE}"
[[ -f "${LIB_FILE}" ]] || fvplus::fail "Missing lib file: ${LIB_FILE}"
[[ -d "${FIXTURE_DIR}" ]] || fvplus::fail "Missing fixture directory: ${FIXTURE_DIR}"

required_label_keys=(
  "folderview.plus"
  "folder.view3"
  "folder.view2"
  "folder.view"
)

for key in "${required_label_keys[@]}"; do
  if ! grep -q "${key}" "${UTILS_FILE}"; then
    fvplus::fail "Legacy label key '${key}' missing from utils compatibility list."
  fi
  if ! grep -q "${key}" "${LIB_FILE}"; then
    fvplus::fail "Legacy label key '${key}' missing from server compatibility list."
  fi
done

required_legacy_dirs=(
  "/boot/config/plugins/folder.view3"
  "/boot/config/plugins/folder.view2"
  "/boot/config/plugins/folder.view"
)

for dir in "${required_legacy_dirs[@]}"; do
  if ! grep -q "${dir}" "${LIB_FILE}"; then
    fvplus::fail "Legacy config directory '${dir}' missing from migration candidates."
  fi
done

required_runtime_conflicts=(
  "folder.view3"
  "folder.view2"
)

for plugin_id in "${required_runtime_conflicts[@]}"; do
  if ! grep -q "'${plugin_id}' => \\[" "${LIB_FILE}"; then
    fvplus::fail "Runtime conflict contract missing plugin id '${plugin_id}'."
  fi
  if ! grep -q "'runtimeDir' => '/usr/local/emhttp/plugins/${plugin_id}'" "${LIB_FILE}"; then
    fvplus::fail "Runtime conflict contract missing runtimeDir for '${plugin_id}'."
  fi
  if ! grep -q "'${plugin_id}.Docker.page'" "${LIB_FILE}"; then
    fvplus::fail "Runtime conflict contract missing Docker marker for '${plugin_id}'."
  fi
  if ! grep -q "'${plugin_id}.VMs.page'" "${LIB_FILE}"; then
    fvplus::fail "Runtime conflict contract missing VM marker for '${plugin_id}'."
  fi
  if ! grep -q "'${plugin_id}.Dashboard.page'" "${LIB_FILE}"; then
    fvplus::fail "Runtime conflict contract missing Dashboard marker for '${plugin_id}'."
  fi
done

required_lib_helpers=(
  "function writeJsonObjectWithLastGood"
  "function recoverJsonObjectFromLastGood"
  "function normalizeFolderMapPayload"
)

for helper in "${required_lib_helpers[@]}"; do
  if ! grep -q "${helper}" "${LIB_FILE}"; then
    fvplus::fail "Self-heal helper missing: ${helper}"
  fi
done

required_fixtures=(
  "folder-view2-single-export.json"
  "folder-view3-full-export.json"
  "folderview-plus-schema1-full.json"
)

for fixture in "${required_fixtures[@]}"; do
  if [[ ! -f "${FIXTURE_DIR}/${fixture}" ]]; then
    fvplus::fail "Required import fixture missing: ${fixture}"
  fi
done

echo "Legacy support guard passed."
