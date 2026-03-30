#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib.sh
source "${ROOT_DIR}/scripts/lib.sh"
cd "${ROOT_DIR}"

fvplus::require_commands git sed

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

  if git rev-parse --verify 'HEAD~1' >/dev/null 2>&1; then
    printf '%s' 'HEAD~1'
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

is_release_relevant_path() {
  local file_path="${1:-}"
  case "${file_path}" in
    src/folderview.plus/*|folderview.plus.plg|folderview.plus.xml)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

TARGET_BRANCH="$(detect_branch)"
if [[ "${TARGET_BRANCH}" != "dev" ]]; then
  echo "Dev version bump guard skipped: branch=${TARGET_BRANCH:-unknown}"
  exit 0
fi

BASE_REF="$(resolve_base_ref)"
if [[ -z "${BASE_REF}" ]]; then
  echo "Dev version bump guard passed: no comparison base available."
  exit 0
fi

CURRENT_VERSION="$(fvplus::read_plg_version "${ROOT_DIR}/folderview.plus.plg")"
BASE_VERSION="$(read_version_from_ref "${BASE_REF}")"
if [[ -z "${BASE_VERSION}" ]]; then
  echo "Dev version bump guard passed: base manifest unavailable at ${BASE_REF}."
  exit 0
fi

mapfile -t CHANGED_FILES < <(git diff --name-only "${BASE_REF}..HEAD" || true)
RELEASE_RELEVANT_FILES=()
for file_path in "${CHANGED_FILES[@]}"; do
  [[ -z "${file_path}" ]] && continue
  if is_release_relevant_path "${file_path}"; then
    RELEASE_RELEVANT_FILES+=("${file_path}")
  fi
done

if [[ "${#RELEASE_RELEVANT_FILES[@]}" -eq 0 ]]; then
  echo "Dev version bump guard passed: no shipped plugin files changed."
  exit 0
fi

if [[ "${CURRENT_VERSION}" == "${BASE_VERSION}" ]]; then
  echo "ERROR: dev pushes that change shipped plugin files must bump folderview.plus.plg version." >&2
  echo "base=${BASE_REF} version=${BASE_VERSION} current=${CURRENT_VERSION}" >&2
  echo "Changed shipped files:" >&2
  printf '  %s\n' "${RELEASE_RELEVANT_FILES[@]}" >&2
  echo "HINT: Run 'bash scripts/dev_finalize.sh --message \"...\"' or rebuild with 'bash pkg_build.sh', commit the updated manifest/archive artifacts, then push dev again." >&2
  exit 1
fi

echo "Dev version bump guard passed: ${BASE_VERSION} -> ${CURRENT_VERSION}"
