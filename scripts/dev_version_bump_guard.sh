#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib.sh
source "${ROOT_DIR}/scripts/lib.sh"
cd "${ROOT_DIR}"

fvplus::require_commands git sed head sort tail

detect_branch() {
  local branch=""
  branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
  if [[ -z "${branch}" || "${branch}" == "HEAD" ]]; then
    branch="${GITHUB_REF_NAME:-}"
    branch="${branch#refs/heads/}"
  fi
  printf '%s' "${branch}"
}

resolve_base_ref() {
  local explicit_base="${FVPLUS_DEV_VERSION_BASE_REF:-}"
  if [[ -n "${explicit_base}" ]]; then
    if git rev-parse --verify "${explicit_base}^{commit}" >/dev/null 2>&1; then
      printf '%s' "${explicit_base}"
      return
    fi
    fvplus::fail "FVPLUS_DEV_VERSION_BASE_REF does not resolve to a commit: ${explicit_base}"
  fi

  if git rev-parse --verify '@{upstream}' >/dev/null 2>&1; then
    printf '%s' '@{upstream}'
    return
  fi

  if git rev-parse --verify 'refs/remotes/origin/dev^{commit}' >/dev/null 2>&1; then
    printf '%s' 'refs/remotes/origin/dev'
    return
  fi

  if git rev-parse --verify "${CANDIDATE_REF}^" >/dev/null 2>&1; then
    printf '%s' "${CANDIDATE_REF}^"
    return
  fi

  printf '%s' ''
}

read_version_from_ref() {
  local ref_name="${1:-}"
  local payload=""
  payload="$(git show "${ref_name}:folderview.plus.plg" 2>/dev/null || true)"
  if [[ -z "${payload}" ]]; then
    printf '%s' ''
    return
  fi
  printf '%s\n' "${payload}" | sed -n 's/^<!ENTITY version "\([^"]*\)".*/\1/p' | head -n 1
}

TARGET_BRANCH="$(detect_branch)"
if [[ -n "${FVPLUS_DEV_VERSION_CANDIDATE_REF:-}" ]]; then
  TARGET_BRANCH=dev
fi
if [[ "${TARGET_BRANCH}" != "dev" ]]; then
  echo "Dev version bump guard skipped: branch=${TARGET_BRANCH:-unknown}"
  exit 0
fi
if ! CANDIDATE_REF="$(git rev-parse --verify "${FVPLUS_DEV_VERSION_CANDIDATE_REF:-HEAD}^{commit}")"; then
  fvplus::fail "Dev version bump guard could not resolve the candidate commit."
fi

BASE_REF="$(resolve_base_ref)"
if [[ -z "${BASE_REF}" ]]; then
  echo "Dev version bump guard passed: no comparison base available."
  exit 0
fi

CURRENT_VERSION="$(read_version_from_ref "${CANDIDATE_REF}")"
BASE_VERSION="$(read_version_from_ref "${BASE_REF}")"
if [[ -z "${BASE_VERSION}" ]]; then
  echo "Dev version bump guard passed: base manifest unavailable at ${BASE_REF}."
  exit 0
fi

RELEASE_RELEVANT_FILES="$(git diff --name-only --no-renames "${BASE_REF}" "${CANDIDATE_REF}" -- \
  "${FVPLUS_SHIPPED_PATHS[@]}")"

if [[ -z "${RELEASE_RELEVANT_FILES}" ]]; then
  echo "Dev version bump guard passed: no shipped plugin files changed."
  exit 0
fi

if [[ -z "${CURRENT_VERSION}" || "${CURRENT_VERSION}" == "${BASE_VERSION}" ]] || \
    [[ "$(printf '%s\n%s\n' "${BASE_VERSION}" "${CURRENT_VERSION}" | sort -V | tail -n 1)" != "${CURRENT_VERSION}" ]]; then
  echo "ERROR: dev pushes that change shipped plugin files must bump folderview.plus.plg version." >&2
  echo "base=${BASE_REF} version=${BASE_VERSION} current=${CURRENT_VERSION}" >&2
  echo "Changed shipped files:" >&2
  printf '%s\n' "${RELEASE_RELEVANT_FILES}" >&2
  echo "HINT: Run 'bash scripts/dev_finalize.sh --message \"...\"' or rebuild with 'bash pkg_build.sh', commit the updated manifest/archive artifacts, then push dev again." >&2
  exit 1
fi

echo "Dev version bump guard passed: ${BASE_VERSION} -> ${CURRENT_VERSION}"
