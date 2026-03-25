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

ensure_allowed_merge_refs() {
  local missing=()
  local branch=""
  for branch in dev beta; do
    if git rev-parse --verify "refs/remotes/origin/${branch}^{commit}" >/dev/null 2>&1; then
      continue
    fi
    missing+=("${branch}")
  done

  if [[ "${#missing[@]}" -eq 0 ]]; then
    return
  fi

  git fetch --no-tags origin "${missing[@]}" >/dev/null 2>&1 || true
}

merge_commit_allowed() {
  local commit="${1:-}"
  local subject=""
  local parent_refs=""
  local parent_list=()
  local parent_index=0
  local parent_commit=""
  local allowed_ref=""

  subject="$(git show -s --format=%s "${commit}" 2>/dev/null || true)"
  if [[ "${subject}" =~ ^Merge\ pull\ request\ #[0-9]+ ]]; then
    return 0
  fi

  parent_refs="$(git show -s --format=%P "${commit}" 2>/dev/null || true)"
  if [[ -z "${parent_refs}" ]]; then
    return 1
  fi

  # Non-first parents identify the merged branch tip(s).
  read -r -a parent_list <<< "${parent_refs}"
  for (( parent_index=1; parent_index<${#parent_list[@]}; parent_index++ )); do
    parent_commit="${parent_list[$parent_index]}"
    for allowed_ref in refs/remotes/origin/dev refs/heads/dev refs/remotes/origin/beta refs/heads/beta; do
      if ! git rev-parse --verify "${allowed_ref}^{commit}" >/dev/null 2>&1; then
        continue
      fi
      if git merge-base --is-ancestor "${parent_commit}" "${allowed_ref}"; then
        return 0
      fi
    done
  done

  return 1
}

MERGES="$(git rev-list --merges "${RANGE}" || true)"
if [[ -n "${MERGES}" ]]; then
  BAD_MERGES=()
  MERGE_COMMIT=""

  ensure_allowed_merge_refs

  while IFS= read -r MERGE_COMMIT; do
    [[ -z "${MERGE_COMMIT}" ]] && continue
    if ! merge_commit_allowed "${MERGE_COMMIT}"; then
      BAD_MERGES+=("${MERGE_COMMIT}")
    fi
  done <<< "${MERGES}"

  if [[ "${#BAD_MERGES[@]}" -gt 0 ]]; then
    echo "ERROR: main-branch merge commits must promote only dev/beta history in the checked range (${RANGE})." >&2
    printf '%s\n' "${BAD_MERGES[@]}" >&2
    exit 1
  fi
fi

echo "Main branch history guard passed: range=${RANGE}"
