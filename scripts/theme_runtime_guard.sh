#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLUGIN_DIR="${ROOT_DIR}/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus"

DOCKER_CSS="${PLUGIN_DIR}/styles/docker.css"
VM_CSS="${PLUGIN_DIR}/styles/vm.css"
DASHBOARD_CSS="${PLUGIN_DIR}/styles/dashboard.css"
SETTINGS_CSS="${PLUGIN_DIR}/styles/folderviewplus.css"
SETTINGS_JS="${PLUGIN_DIR}/scripts/folderviewplus.js"
SETTINGS_PAGE="${PLUGIN_DIR}/FolderViewPlus.page"
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
require_file "${SETTINGS_JS}"
require_file "${SETTINGS_PAGE}"
require_file "${DOCKER_JS}"
require_file "${VM_JS}"
require_file "${STYLES_CUSTOM_PHP}"
require_file "${SCRIPTS_CUSTOM_PHP}"

require_contains "${DOCKER_CSS}" '--fvplus-theme-foreground:[[:space:]]*var\(--fvplus-runtime-theme-foreground,[[:space:]]*var\(--text,[[:space:]]*currentColor\)\)' 'docker theme foreground token'
require_contains "${VM_CSS}" '--fvplus-theme-foreground:[[:space:]]*var\(--fvplus-runtime-theme-foreground,[[:space:]]*var\(--text,[[:space:]]*currentColor\)\)' 'vm theme foreground token'
require_contains "${DASHBOARD_CSS}" '--fvplus-theme-foreground:[[:space:]]*var\(--fvplus-runtime-theme-foreground,[[:space:]]*var\(--text,[[:space:]]*currentColor\)\)' 'dashboard theme foreground token'
require_contains "${DOCKER_CSS}" '--fvplus-status-started:[[:space:]]*var\(--fvplus-runtime-status-started,[[:space:]]*var\(--fvplus-theme-foreground\)\)' 'docker started token wiring'
require_contains "${VM_CSS}" '--fvplus-status-started:[[:space:]]*var\(--fvplus-runtime-status-started,[[:space:]]*var\(--fvplus-theme-foreground\)\)' 'vm started token wiring'
require_contains "${DASHBOARD_CSS}" '--fvplus-status-started:[[:space:]]*var\(--fvplus-runtime-status-started,[[:space:]]*var\(--fvplus-theme-foreground\)\)' 'dashboard started token wiring'

require_contains "${DOCKER_CSS}" '\.folder-state\.fv-folder-state-started' 'docker started state class token selector'
require_contains "${DOCKER_CSS}" 'i\.folder-load-status\.started' 'docker started icon selector'
require_contains "${VM_CSS}" '\.folder-state\.fv-folder-state-started' 'vm started state class token selector'
require_contains "${VM_CSS}" 'i\.folder-load-status\.started' 'vm started icon selector'
require_contains "${SETTINGS_CSS}" '--fvplus-theme-text-primary:[[:space:]]*var\(--text,[[:space:]]*currentColor\)' 'settings semantic primary token'
require_contains "${SETTINGS_CSS}" '--fvplus-settings-text-primary:[[:space:]]*var\(--fvplus-theme-text-primary,[[:space:]]*var\(--fvplus-settings-safe-text-primary\)\)' 'settings token resolver chain'
require_contains "${SETTINGS_CSS}" '--fvplus-settings-surface-muted:' 'settings tokenized surfaces'
require_contains "${SETTINGS_CSS}" '--fvplus-settings-accent:' 'settings tokenized accent'
require_contains "${SETTINGS_CSS}" '#fv-setup-assistant-dialog[[:space:]]*\{' 'wizard dialog token block exists'
require_contains "${SETTINGS_CSS}" 'color-scheme:[[:space:]]*dark' 'wizard dark color scheme'
require_contains "${SETTINGS_CSS}" '\.fv-setup-card\[data-fv-card-tone="env"\]' 'wizard card tone selector (env)'
require_contains "${SETTINGS_CSS}" '\.fv-setup-card\[data-fv-card-tone="mode"\]' 'wizard card tone selector (mode)'
require_contains "${SETTINGS_CSS}" '\.fv-setup-card\[data-fv-card-tone="bundle"\]' 'wizard card tone selector (bundle)'
require_contains "${SETTINGS_CSS}" '\.fv-setup-card\[data-fv-card-tone="preset"\]' 'wizard card tone selector (preset)'
require_absent "${SETTINGS_CSS}" '\.fv-setup-step-grid > \.fv-setup-card:nth-child' 'wizard should not use positional tone mapping'
require_absent "${SETTINGS_CSS}" '--fv-wizard-text-primary:[[:space:]]*var\(--text' 'wizard text token must not follow host text token directly'
require_absent "${SETTINGS_CSS}" '--fv-wizard-text-primary:[[:space:]]*var\(--fvplus-settings-text-primary\)' 'wizard text token must not follow settings token directly'
require_contains "${SETTINGS_JS}" 'const buildResolvedThemeSnapshot = \(modeInput = null\) =>' 'theme resolver snapshot helper'
require_contains "${SETTINGS_JS}" 'const applyResolvedThemeTokens = \(reason = '\''runtime'\''\) =>' 'theme resolver apply helper'
require_contains "${SETTINGS_JS}" 'const runThemeSelfHeal = async \(\) =>' 'theme self-heal action'
require_contains "${SETTINGS_PAGE}" 'runThemeSelfHeal\(\)' 'theme self-heal button wiring'

require_absent "${DOCKER_JS}" '\.css\(\s*["'"'"']color["'"'"']\s*,\s*statusColors' 'docker inline status color painting'
require_absent "${VM_JS}" '\.css\(\s*["'"'"']color["'"'"']\s*,\s*statusColors' 'vm inline status color painting'

# shellcheck disable=SC2016
require_contains "${STYLES_CUSTOM_PHP}" 'realpath\(' 'styles loader realpath'
# shellcheck disable=SC2016
require_contains "${STYLES_CUSTOM_PHP}" 'strpos\(\$resolved,\s*\$baseDir\s*\.\s*'\''/'\''\)\s*!==\s*0' 'styles loader path boundary check'
# shellcheck disable=SC2016
require_contains "${STYLES_CUSTOM_PHP}" 'autov\(\$resolved\)' 'styles loader autov resolved path'
# shellcheck disable=SC2016
require_contains "${SCRIPTS_CUSTOM_PHP}" 'realpath\(' 'scripts loader realpath'
# shellcheck disable=SC2016
require_contains "${SCRIPTS_CUSTOM_PHP}" 'strpos\(\$resolved,\s*\$baseDir\s*\.\s*'\''/'\''\)\s*!==\s*0' 'scripts loader path boundary check'
# shellcheck disable=SC2016
require_contains "${SCRIPTS_CUSTOM_PHP}" 'autov\(\$resolved\)' 'scripts loader autov resolved path'

echo "Theme runtime guard passed."
