#!/bin/sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
PHP_BIN="${FVPLUS_PHP_BIN:-php}"
EXPECTED_PREFIX="${FVPLUS_EXPECT_PHP_VERSION_PREFIX:-}"

if ! command -v "${PHP_BIN}" >/dev/null 2>&1; then
  echo "PHP runtime compatibility failed: ${PHP_BIN} is unavailable." >&2
  exit 1
fi

ACTUAL_VERSION="$(${PHP_BIN} -r 'echo PHP_MAJOR_VERSION, ".", PHP_MINOR_VERSION, ".", PHP_RELEASE_VERSION;')"
if [ -n "${EXPECTED_PREFIX}" ]; then
  case "${ACTUAL_VERSION}" in
    "${EXPECTED_PREFIX}"*) ;;
    *)
      echo "PHP runtime compatibility failed: expected ${EXPECTED_PREFIX}, received ${ACTUAL_VERSION}." >&2
      exit 1
      ;;
  esac
fi

COUNT=0
find "${ROOT_DIR}/src/folderview.plus" -type f -name '*.php' -print | LC_ALL=C sort | while IFS= read -r file; do
  "${PHP_BIN}" -l "${file}" >/dev/null
done
COUNT="$(find "${ROOT_DIR}/src/folderview.plus" -type f -name '*.php' | wc -l | tr -d '[:space:]')"
"${PHP_BIN}" "${ROOT_DIR}/tests/php-runtime-compatibility.php"

echo "PHP runtime compatibility passed: php=${ACTUAL_VERSION}, files=${COUNT}."
