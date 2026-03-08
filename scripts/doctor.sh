#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=./lib.sh
source "${ROOT_DIR}/scripts/lib.sh"

REQUIRED_COMMANDS=(
  bash
  tar
  sed
  awk
  grep
  find
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

