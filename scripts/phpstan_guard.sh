#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib.sh
source "${ROOT_DIR}/scripts/lib.sh"
cd "${ROOT_DIR}"

PHPSTAN_VERSION="${FVPLUS_PHPSTAN_VERSION:-2.1.56}"
PHPSTAN_SHA256="${FVPLUS_PHPSTAN_SHA256:-d9d42305ea80cd33cd4c3fb2699b5a3a563d9cf65b4320107071facf4201a294}"
TOOL_DIR="${ROOT_DIR}/tmp/tools"
PHPSTAN_PHAR="${TOOL_DIR}/phpstan-${PHPSTAN_VERSION}.phar"
PHPSTAN_URL="https://github.com/phpstan/phpstan/releases/download/${PHPSTAN_VERSION}/phpstan.phar"

fvplus::require_commands php curl sha256sum
PHP_BIN="$(fvplus::resolve_platform_command php)"
mkdir -p "${TOOL_DIR}"

verify_phar() {
  [[ -f "${PHPSTAN_PHAR}" ]] || return 1
  [[ "$(sha256sum "${PHPSTAN_PHAR}" | awk '{print $1}')" == "${PHPSTAN_SHA256}" ]]
}

if ! verify_phar; then
  rm -f "${PHPSTAN_PHAR}"
  curl -fsSL --retry 3 --connect-timeout 20 --max-time 180 "${PHPSTAN_URL}" -o "${PHPSTAN_PHAR}"
  if ! verify_phar; then
    rm -f "${PHPSTAN_PHAR}"
    fvplus::fail "Downloaded PHPStan ${PHPSTAN_VERSION} did not match the pinned SHA-256."
  fi
fi

PHPSTAN_LOG="${ROOT_DIR}/tmp/phpstan-output.log"
if ! "${PHP_BIN}" \
  "$(fvplus::path_for_command "${PHP_BIN}" "${PHPSTAN_PHAR}")" \
  analyse \
  --configuration="$(fvplus::path_for_command "${PHP_BIN}" "${ROOT_DIR}/phpstan.neon")" \
  --memory-limit=512M \
  --no-progress \
  --error-format=table >"${PHPSTAN_LOG}" 2>&1; then
  cat "${PHPSTAN_LOG}"
  fvplus::fail "PHPStan analysis failed."
fi
cat "${PHPSTAN_LOG}"
if grep -Eq 'Project config file .* does not exist|Could not open input file' "${PHPSTAN_LOG}"; then
  fvplus::fail "PHPStan did not load the configured project or analyzer."
fi
