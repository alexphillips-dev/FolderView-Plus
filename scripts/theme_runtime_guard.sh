#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLUGIN_DIR="${ROOT_DIR}/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus"

DOCKER_CSS="${PLUGIN_DIR}/styles/docker.css"
VM_CSS="${PLUGIN_DIR}/styles/vm.css"
DASHBOARD_CSS="${PLUGIN_DIR}/styles/dashboard.css"
SETTINGS_CSS="${PLUGIN_DIR}/styles/folderviewplus.css"
DOCKER_JS="${PLUGIN_DIR}/scripts/docker.js"
VM_JS="${PLUGIN_DIR}/scripts/vm.js"
STYLES_CUSTOM_PHP="${PLUGIN_DIR}/styles/custom.php"
SCRIPTS_CUSTOM_PHP="${PLUGIN_DIR}/scripts/custom.php"

require_file() {
  local file_path="${1:-}"
  [[ -f "${file_path}" ]] || {
    echo "ERROR: Missing required file: ${file_path}" >&2
    exit 1
  }
}

require_contains() {
  local file_path="${1:-}"
  local pattern="${2:-}"
  local description="${3:-pattern check}"
  if ! grep -Eq -- "${pattern}" "${file_path}"; then
    echo "ERROR: Theme runtime guard failed (${description}) in ${file_path}" >&2
    exit 1
  fi
}

require_absent() {
  local file_path="${1:-}"
  local pattern="${2:-}"
  local description="${3:-negative pattern check}"
  if grep -Eq -- "${pattern}" "${file_path}"; then
    echo "ERROR: Theme runtime guard failed (${description}) in ${file_path}" >&2
    exit 1
  fi
}

require_file "${DOCKER_CSS}"
require_file "${VM_CSS}"
require_file "${DASHBOARD_CSS}"
require_file "${SETTINGS_CSS}"
require_file "${DOCKER_JS}"
require_file "${VM_JS}"
require_file "${STYLES_CUSTOM_PHP}"
require_file "${SCRIPTS_CUSTOM_PHP}"

require_contains "${DOCKER_CSS}" '--fvplus-theme-foreground:[[:space:]]*var\(--text,[[:space:]]*currentColor\)' 'docker theme foreground token'
require_contains "${VM_CSS}" '--fvplus-theme-foreground:[[:space:]]*var\(--text,[[:space:]]*currentColor\)' 'vm theme foreground token'
require_contains "${DASHBOARD_CSS}" '--fvplus-theme-foreground:[[:space:]]*var\(--text,[[:space:]]*currentColor\)' 'dashboard theme foreground token'
require_contains "${DOCKER_CSS}" '--fvplus-status-started:[[:space:]]*var\(--fvplus-theme-foreground\)' 'docker started token wiring'
require_contains "${VM_CSS}" '--fvplus-status-started:[[:space:]]*var\(--fvplus-theme-foreground\)' 'vm started token wiring'
require_contains "${DASHBOARD_CSS}" '--fvplus-status-started:[[:space:]]*var\(--fvplus-theme-foreground\)' 'dashboard started token wiring'

require_contains "${DOCKER_CSS}" '\.folder-state\.fv-folder-state-started' 'docker started state class token selector'
require_contains "${DOCKER_CSS}" 'i\.folder-load-status\.started' 'docker started icon selector'
require_contains "${VM_CSS}" '\.folder-state\.fv-folder-state-started' 'vm started state class token selector'
require_contains "${VM_CSS}" 'i\.folder-load-status\.started' 'vm started icon selector'
require_contains "${SETTINGS_CSS}" '--fvplus-settings-surface-muted:' 'settings tokenized surfaces'
require_contains "${SETTINGS_CSS}" '--fvplus-settings-accent:' 'settings tokenized accent'

require_absent "${DOCKER_JS}" '\.css\(\s*["'"'"']color["'"'"']\s*,\s*statusColors' 'docker inline status color painting'
require_absent "${VM_JS}" '\.css\(\s*["'"'"']color["'"'"']\s*,\s*statusColors' 'vm inline status color painting'

require_contains "${STYLES_CUSTOM_PHP}" 'realpath\(' 'styles loader realpath'
require_contains "${STYLES_CUSTOM_PHP}" 'strpos\(\$resolved,\s*\$baseDir\s*\.\s*'\''/'\''\)\s*!==\s*0' 'styles loader path boundary check'
require_contains "${STYLES_CUSTOM_PHP}" 'autov\(\$resolved\)' 'styles loader autov resolved path'
require_contains "${SCRIPTS_CUSTOM_PHP}" 'realpath\(' 'scripts loader realpath'
require_contains "${SCRIPTS_CUSTOM_PHP}" 'strpos\(\$resolved,\s*\$baseDir\s*\.\s*'\''/'\''\)\s*!==\s*0' 'scripts loader path boundary check'
require_contains "${SCRIPTS_CUSTOM_PHP}" 'autov\(\$resolved\)' 'scripts loader autov resolved path'

echo "Theme runtime guard passed."
