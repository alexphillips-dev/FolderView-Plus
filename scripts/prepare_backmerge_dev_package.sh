#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib.sh
source "${ROOT_DIR}/scripts/lib.sh"
cd "${ROOT_DIR}"

fvplus::require_commands bash git sed

if [[ "$(git branch --show-current)" != "dev" ]]; then
  fvplus::fail "Back-merge package preparation must run on dev."
fi
if ! git rev-parse -q --verify "origin/dev^{commit}" >/dev/null 2>&1; then
  fvplus::fail "origin/dev is required to prepare a back-merge package."
fi

mapfile -t changed_source_paths < <(
  git diff --name-only origin/dev...HEAD -- \
    . \
    ':(exclude)folderview.plus.plg' \
    ':(exclude)folderview.plus.xml' \
    ':(exclude)archive/**' \
    ':(exclude)docs/releases/**'
)
if [[ "${#changed_source_paths[@]}" -eq 0 ]]; then
  echo "Back-merge contains no source or workflow changes; package preparation skipped."
  exit 0
fi

dry_run_output="$(bash pkg_build.sh --branch dev --dry-run)"
version="$(printf '%s\n' "${dry_run_output}" | sed -n 's/^Version: //p' | head -n 1)"
if [[ -z "${version}" ]]; then
  fvplus::fail "Could not resolve a dev package version for the back-merge."
fi

notes_path="docs/releases/${version}.md"
if [[ ! -f "${notes_path}" ]]; then
  {
    echo "- Maintenance: Synchronized stable source and workflow fixes from main back into dev."
    echo "- Quality: Rebuilt the dev package so the shipped archive exactly matches the synchronized source."
    echo "- Test: Revalidated the complete dev state without allowing packaged-source drift."
  } > "${notes_path}"
fi

FVPLUS_EXPECT_PLUGIN_BRANCH=dev \
FVPLUS_REQUIRE_EXPLICIT_RELEASE_NOTES=1 \
bash pkg_build.sh --branch dev
echo "Prepared back-merge dev package ${version}."
