#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib.sh
source "${ROOT_DIR}/scripts/lib.sh"
cd "${ROOT_DIR}"

fvplus::require_commands git

detect_branch() {
  local branch=""
  branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
  if [[ -z "${branch}" || "${branch}" == "HEAD" ]]; then
    branch="${GITHUB_REF_NAME:-}"
    branch="${branch#refs/heads/}"
  fi
  printf '%s' "${branch}"
}

resolve_range() {
  local explicit_base="${FVPLUS_MAIN_HISTORY_BASE_REF:-}"
  if [[ -n "${explicit_base}" ]]; then
    if git rev-parse --verify "${explicit_base}^{commit}" >/dev/null 2>&1; then
      printf '%s..HEAD' "${explicit_base}"
      return
    fi
    fvplus::fail "FVPLUS_MAIN_HISTORY_BASE_REF does not resolve to a commit: ${explicit_base}"
  fi

  if git rev-parse --verify '@{upstream}' >/dev/null 2>&1; then
    printf '%s' '@{upstream}..HEAD'
    return
  fi

  if git rev-parse --verify 'HEAD~1' >/dev/null 2>&1; then
    printf '%s' 'HEAD~1..HEAD'
    return
  fi

  printf '%s' ''
}

TARGET_BRANCH="$(detect_branch)"
if [[ "${TARGET_BRANCH}" != "main" ]]; then
  echo "Main branch history guard skipped: branch=${TARGET_BRANCH:-unknown}"
  exit 0
fi

RANGE="$(resolve_range)"
if [[ -z "${RANGE}" ]]; then
  echo "Main branch history guard passed: no comparison range available."
  exit 0
fi

MERGES="$(git rev-list --merges "${RANGE}" || true)"
if [[ -n "${MERGES}" ]]; then
  echo "ERROR: merge commits are not allowed in the checked main-branch range (${RANGE})." >&2
  echo "${MERGES}" >&2
  exit 1
fi

echo "Main branch history guard passed: range=${RANGE}"
