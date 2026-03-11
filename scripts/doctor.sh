#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib.sh
source "${ROOT_DIR}/scripts/lib.sh"

REQUIRED_COMMANDS=(
  bash
  tar
  sed
  awk
  grep
  find
  cmp
  md5sum
  sha256sum
  php
  node
  git
  gh
)

fvplus::require_commands "${REQUIRED_COMMANDS[@]}"

echo "Tooling doctor passed."
for cmd in "${REQUIRED_COMMANDS[@]}"; do
  if "${cmd}" --version >/dev/null 2>&1; then
    version_line="$("${cmd}" --version 2>/dev/null | head -n 1)"
    echo "  ${cmd}: ${version_line}"
  else
    echo "  ${cmd}: installed"
  fi
done

EXPECTED_HOOKS_PATH=".githooks"
CURRENT_HOOKS_PATH="$(git -C "${ROOT_DIR}" config --get core.hooksPath || true)"
if [[ "${CURRENT_HOOKS_PATH}" != "${EXPECTED_HOOKS_PATH}" ]]; then
  if [[ "${FVPLUS_REQUIRE_GITHOOKS:-0}" == "1" ]]; then
    echo "ERROR: Git hooks path is not configured to ${EXPECTED_HOOKS_PATH}." >&2
    echo "Run: bash scripts/install_git_hooks.sh" >&2
    exit 1
  fi
  echo "WARN: Git hooks path is '${CURRENT_HOOKS_PATH:-<unset>}' (expected '${EXPECTED_HOOKS_PATH}')." >&2
  echo "      Run 'bash scripts/install_git_hooks.sh' to enable pre-push release guards locally." >&2
else
  echo "  git hooks: ${CURRENT_HOOKS_PATH}"
fi
