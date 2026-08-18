#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

read_host_env_var() {
  local name="${1:-}"
  local current=""
  local win_value=""
  if [[ -n "${name}" ]]; then
    current="${!name:-}"
    if [[ -n "${current}" ]]; then
      printf '%s\n' "${current}"
      return 0
    fi
  fi
  if command -v cmd.exe >/dev/null 2>&1 && [[ -n "${name}" ]]; then
    win_value="$(cmd.exe /c echo %"${name}"% 2>/dev/null | tr -d '\r' | tail -n 1)"
    if [[ -n "${win_value}" && "${win_value}" != "%${name}%" ]]; then
      printf '%s\n' "${win_value}"
      return 0
    fi
  fi
  printf '%s\n' ""
}

DEV_BRANCH="$(read_host_env_var FVPLUS_BACKMERGE_LOCAL_BRANCH)"
DEV_BRANCH="${DEV_BRANCH:-dev}"
MAIN_REF="origin/main"
DEV_REF="origin/dev"

normalize_local_remote_url() {
  local url="${1:-}"
  if [[ -z "${url}" ]]; then
    printf '%s\n' ""
    return 0
  fi
  if command -v wslpath >/dev/null 2>&1; then
    if [[ "${url}" =~ ^file://([A-Za-z]:[\\/].*)$ ]]; then
      printf 'file://%s\n' "$(wslpath -u "${BASH_REMATCH[1]}")"
      return 0
    fi
    if [[ "${url}" =~ ^[A-Za-z]:[\\/].* ]]; then
      wslpath -u "${url}"
      return 0
    fi
  fi
  printf '%s\n' "${url}"
}

ensure_origin_remote_usable() {
  local remote_url=""
  local normalized_url=""
  remote_url="$(git remote get-url origin 2>/dev/null || true)"
  if [[ -z "${remote_url}" ]]; then
    return 0
  fi
  normalized_url="$(normalize_local_remote_url "${remote_url}")"
  if [[ -n "${normalized_url}" && "${normalized_url}" != "${remote_url}" ]]; then
    git remote set-url origin "${normalized_url}"
  fi
}

ensure_origin_remote_usable
git fetch origin main dev --tags

release_only_path() {
  local path="${1:-}"
  case "${path}" in
    folderview.plus.plg|folderview.plus.xml|docs/sbom.cdx.json|archive/folderview.plus-*.txz|archive/folderview.plus-*.txz.sha256|docs/releases/*.md)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

path_exists_at_ref() {
  local ref="${1:-}"
  local path="${2:-}"
  git cat-file -e "${ref}:${path}" 2>/dev/null
}

reconcile_release_only_paths_from_ref() {
  local source_ref="${1:-}"
  shift || true
  local file=""
  local -a restore_paths=()
  local -a remove_paths=()
  for file in "$@"; do
    if release_only_path "${file}"; then
      if path_exists_at_ref "${source_ref}" "${file}"; then
        restore_paths+=("${file}")
      else
        remove_paths+=("${file}")
      fi
    fi
  done
  if [ "${#restore_paths[@]}" -gt 0 ]; then
    git restore --source="${source_ref}" --staged --worktree -- "${restore_paths[@]}"
  fi
  if [ "${#remove_paths[@]}" -gt 0 ]; then
    git rm -f --ignore-unmatch -- "${remove_paths[@]}" >/dev/null 2>&1 || true
  fi
}

resolve_release_only_conflicts_from_ref() {
  local source_ref="${1:-}"
  local path=""
  mapfile -t CONFLICT_PATHS < <(git diff --name-only --diff-filter=U || true)
  if [ "${#CONFLICT_PATHS[@]}" -eq 0 ]; then
    return 1
  fi
  for path in "${CONFLICT_PATHS[@]}"; do
    if ! release_only_path "${path}"; then
      return 1
    fi
  done
  reconcile_release_only_paths_from_ref "${source_ref}" "${CONFLICT_PATHS[@]}"
  return 0
}

changed_paths_since_ref() {
  local source_ref="${1:-}"
  git diff --name-only --find-renames "${source_ref}" || true
}

if git show-ref --verify --quiet "refs/heads/${DEV_BRANCH}"; then
  git checkout -f "${DEV_BRANCH}"
  git reset --hard "${DEV_REF}"
else
  git checkout -f -b "${DEV_BRANCH}" "${DEV_REF}"
fi

if git merge-base --is-ancestor "${MAIN_REF}" "${DEV_BRANCH}"; then
  echo "Dev already includes main. Nothing to sync."
  exit 0
fi

PRE_MERGE_REF="$(git rev-parse HEAD)"

if ! git merge --no-ff --no-commit -m "Sync main into dev" "${MAIN_REF}"; then
  if ! resolve_release_only_conflicts_from_ref "${PRE_MERGE_REF}"; then
    echo "Merge failed for non-release paths; aborting auto back-merge." >&2
    git merge --abort
    exit 1
  fi
fi

mapfile -t MERGED_PATHS < <(changed_paths_since_ref "${PRE_MERGE_REF}")
if [ "${#MERGED_PATHS[@]}" -gt 0 ]; then
  reconcile_release_only_paths_from_ref "${PRE_MERGE_REF}" "${MERGED_PATHS[@]}"
fi

mapfile -t REMAINING_CONFLICT_PATHS < <(git diff --name-only --diff-filter=U || true)
if [ "${#REMAINING_CONFLICT_PATHS[@]}" -gt 0 ]; then
  echo "Merge left unresolved conflicts; aborting auto back-merge." >&2
  git merge --abort
  exit 1
fi

git add --all
if git diff --cached --quiet && git diff --quiet; then
  git commit --no-verify --allow-empty --no-edit
else
  git commit --no-verify --no-edit
fi

echo "Back-merge branch updated with merge ancestry."

