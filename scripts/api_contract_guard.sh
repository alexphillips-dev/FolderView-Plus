#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_DIR="${ROOT_DIR}/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server"
# shellcheck source=scripts/lib.sh
source "${ROOT_DIR}/scripts/lib.sh"

fvplus::require_commands find grep

[[ -d "${SERVER_DIR}" ]] || fvplus::fail "Missing server directory: ${SERVER_DIR}"

files=()
while IFS= read -r -d '' file; do
  files+=("${file}")
done < <(find "${SERVER_DIR}" -maxdepth 1 -type f -name '*.php' -print0)

if [[ ${#files[@]} -eq 0 ]]; then
  fvplus::fail "No PHP endpoint files found in ${SERVER_DIR}"
fi

require_lib_exceptions=("lib.php" "cpu.php")
legacy_json_endpoints=("read.php" "read_info.php" "read_order.php" "read_unraid_order.php")
plain_text_endpoints=("cpu.php" "version.php")
mutation_endpoints=(
  "create.php"
  "update.php"
  "delete.php"
  "prefs.php"
  "reorder.php"
  "sync_order.php"
  "bulk_assign.php"
  "bulk_folder_action.php"
  "upload_custom_icon.php"
)
multi_action_guard_endpoints=("backup.php" "templates.php" "diagnostics.php")

contains_item() {
  local needle="${1:-}"
  shift || true
  local item
  for item in "$@"; do
    if [[ "${item}" == "${needle}" ]]; then
      return 0
    fi
  done
  return 1
}

for file in "${files[@]}"; do
  name="$(basename "${file}")"

  if ! contains_item "${name}" "${require_lib_exceptions[@]}"; then
    if ! grep -q 'require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php")' "${file}"; then
      fvplus::fail "Endpoint ${name} is missing lib.php include."
    fi
  fi

  if contains_item "${name}" "${plain_text_endpoints[@]}"; then
    continue
  fi

  if contains_item "${name}" "${legacy_json_endpoints[@]}"; then
    if ! grep -q 'catch (Throwable' "${file}"; then
      fvplus::fail "Legacy JSON endpoint ${name} is missing Throwable catch."
    fi
    if ! grep -Eq "'ok'[[:space:]]*=>[[:space:]]*false" "${file}"; then
      fvplus::fail "Legacy JSON endpoint ${name} must return ok=false on errors."
    fi
    if ! grep -Eq "'error'[[:space:]]*=>" "${file}"; then
      fvplus::fail "Legacy JSON endpoint ${name} must return error field on failures."
    fi
    continue
  fi

  if ! grep -Eq 'fvplus_json_try\(|fvplus_json_ok\(' "${file}"; then
    fvplus::fail "Endpoint ${name} is missing JSON response contract wrapper."
  fi
done

for name in "${mutation_endpoints[@]}"; do
  file="${SERVER_DIR}/${name}"
  [[ -f "${file}" ]] || fvplus::fail "Missing mutation endpoint: ${name}"
  if ! grep -q 'requireMutationRequestGuard()' "${file}"; then
    fvplus::fail "Mutation endpoint ${name} is missing requireMutationRequestGuard()."
  fi
done

for name in "${multi_action_guard_endpoints[@]}"; do
  file="${SERVER_DIR}/${name}"
  [[ -f "${file}" ]] || fvplus::fail "Missing multi-action endpoint: ${name}"
  if ! grep -q 'requireMutationRequestGuard()' "${file}"; then
    fvplus::fail "Multi-action endpoint ${name} must guard mutation actions."
  fi
done

echo "API contract guard passed."
