#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SETTINGS_PAGE="${ROOT_DIR}/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/FolderViewPlus.page"
SETTINGS_CSS="${ROOT_DIR}/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/folderviewplus.css"
# shellcheck source=scripts/lib.sh
source "${ROOT_DIR}/scripts/lib.sh"

fvplus::require_commands grep

[[ -f "${SETTINGS_PAGE}" ]] || fvplus::fail "Missing settings page: ${SETTINGS_PAGE}"
[[ -f "${SETTINGS_CSS}" ]] || fvplus::fail "Missing settings stylesheet: ${SETTINGS_CSS}"

if ! grep -Eq '<div id="fv-settings-root"[^>]*>' "${SETTINGS_PAGE}"; then
  fvplus::fail "Settings page is missing #fv-settings-root wrapper."
fi

if grep -En '^[[:space:]]*body[[:space:]]*\{' "${SETTINGS_CSS}" >/dev/null; then
  fvplus::fail "Global body selector found in folderviewplus.css. Scope styles to #fv-settings-root."
fi

if grep -En '^[[:space:]]*(button|input|select|textarea|a):focus-visible' "${SETTINGS_CSS}" >/dev/null; then
  fvplus::fail "Unscoped :focus-visible selector found. Scope focus styles to #fv-settings-root."
fi

for selector in \
  '#fv-settings-root button:focus-visible' \
  '#fv-settings-root input:focus-visible' \
  '#fv-settings-root select:focus-visible' \
  '#fv-settings-root textarea:focus-visible' \
  '#fv-settings-root a:focus-visible'
do
  if ! grep -Fq "${selector}" "${SETTINGS_CSS}"; then
    fvplus::fail "Missing scoped focus selector: ${selector}"
  fi
done

if ! grep -Eq '#fv-settings-root[[:space:]]*\{' "${SETTINGS_CSS}"; then
  fvplus::fail "Missing #fv-settings-root block in settings stylesheet."
fi

echo "Theme scope guard passed."
