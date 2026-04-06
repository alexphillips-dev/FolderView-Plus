#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

DEV_BRANCH="${FVPLUS_BACKMERGE_LOCAL_BRANCH:-dev}"
MAIN_REF="origin/main"
DEV_REF="origin/dev"

git fetch origin main dev --tags

release_only_path() {
  local path="${1:-}"
  case "${path}" in
    folderview.plus.plg|folderview.plus.xml|archive/folderview.plus-*.txz|archive/folderview.plus-*.txz.sha256|docs/releases/*.md)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

restore_release_only_paths_from_previous() {
  reconcile_release_only_paths_from_ref HEAD^ "$@"
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

commit_paths_for_sync() {
  local commit="${1:-}"
  local status=""
  local first_path=""
  local second_path=""
  while IFS=$'\t' read -r status first_path second_path; do
    if [ -z "${status}" ]; then
      continue
    fi
    case "${status}" in
      R*|C*)
        printf '%s\n' "${first_path}" "${second_path}"
        ;;
      *)
        printf '%s\n' "${first_path}"
        ;;
    esac
  done < <(git show --pretty=format: --name-status --find-renames "${commit}")
}

latest_dev_merge_into_main() {
  git log "${MAIN_REF}" --first-parent --grep='^Merge dev into main for ' --format='%H' -n 1
}

resolve_release_only_conflicts() {
  local path=""
  local -a commit_paths=("$@")
  local -a reconcile_paths=()
  mapfile -t CONFLICT_PATHS < <(git diff --name-only --diff-filter=U || true)
  if [ "${#CONFLICT_PATHS[@]}" -eq 0 ]; then
    return 1
  fi
  for path in "${CONFLICT_PATHS[@]}"; do
    if ! release_only_path "${path}"; then
      return 1
    fi
  done
  reconcile_paths=("${commit_paths[@]}" "${CONFLICT_PATHS[@]}")
  reconcile_release_only_paths_from_ref HEAD "${reconcile_paths[@]}"
  return 0
}

main_differs_from_dev_only_by_release_artifacts() {
  local path=""
  mapfile -t DIFF_PATHS < <(git diff --name-only "${DEV_REF}..${MAIN_REF}" || true)
  if [ "${#DIFF_PATHS[@]}" -eq 0 ]; then
    return 1
  fi
  for path in "${DIFF_PATHS[@]}"; do
    if ! release_only_path "${path}"; then
      return 1
    fi
  done
  return 0
}

if git show-ref --verify --quiet "refs/heads/${DEV_BRANCH}"; then
  git checkout "${DEV_BRANCH}"
  git reset --hard "${DEV_REF}"
else
  git checkout -b "${DEV_BRANCH}" "${DEV_REF}"
fi

if git merge-base --is-ancestor "${MAIN_REF}" "${DEV_BRANCH}"; then
  echo "Dev already includes main. Nothing to sync."
  exit 0
fi

if main_differs_from_dev_only_by_release_artifacts; then
  echo "Main differs from dev only by release artifacts/metadata. Skipping back-merge."
  exit 0
fi

SYNC_BASE="$(latest_dev_merge_into_main || true)"
if [ -z "${SYNC_BASE}" ]; then
  SYNC_BASE="$(git merge-base "${DEV_REF}" "${MAIN_REF}")"
fi

mapfile -t MAIN_ONLY_COMMITS < <(git rev-list --reverse --first-parent --no-merges "${SYNC_BASE}..${MAIN_REF}" || true)

if [ "${#MAIN_ONLY_COMMITS[@]}" -eq 0 ]; then
  echo "No linear main-only commits to sync."
  exit 0
fi

applied_commits=0

for COMMIT in "${MAIN_ONLY_COMMITS[@]}"; do
  mapfile -t COMMIT_PATHS < <(commit_paths_for_sync "${COMMIT}" | sed '/^[[:space:]]*$/d')
  if [ "${#COMMIT_PATHS[@]}" -eq 0 ]; then
    continue
  fi

  commit_has_non_release_paths=0
  commit_touched_release_paths=0
  for FILE in "${COMMIT_PATHS[@]}"; do
    if release_only_path "${FILE}"; then
      commit_touched_release_paths=1
    else
      commit_has_non_release_paths=1
    fi
  done

  if [ "${commit_has_non_release_paths}" -eq 0 ]; then
    echo "Skipping release-only commit ${COMMIT}."
    continue
  fi

  commit_applied=0

  if ! git cherry-pick -x "${COMMIT}"; then
    if resolve_release_only_conflicts "${COMMIT_PATHS[@]}"; then
      mapfile -t REMAINING_CONFLICT_PATHS < <(git diff --name-only --diff-filter=U || true)
      if [ "${#REMAINING_CONFLICT_PATHS[@]}" -gt 0 ]; then
        echo "Cherry-pick failed for ${COMMIT}; aborting auto back-merge." >&2
        git cherry-pick --abort
        exit 1
      fi
      if git diff --cached --quiet && git diff --quiet; then
        git cherry-pick --skip
        continue
      elif git cherry-pick --continue; then
        commit_applied=1
      else
        echo "Cherry-pick failed for ${COMMIT}; aborting auto back-merge." >&2
        git cherry-pick --abort
        exit 1
      fi
    else
      echo "Cherry-pick failed for ${COMMIT}; aborting auto back-merge." >&2
      git cherry-pick --abort
      exit 1
    fi
  else
    commit_applied=1
  fi

  if [ "${commit_applied}" -eq 0 ]; then
    continue
  fi

  if [ "${commit_touched_release_paths}" -eq 1 ]; then
    restore_release_only_paths_from_previous "${COMMIT_PATHS[@]}"
    if ! git diff --cached --quiet || ! git diff --quiet; then
      git add --all
      git commit --amend --no-edit
    fi
  fi

  applied_commits=1
done

if [ "${applied_commits}" -eq 0 ]; then
  echo "No non-release commits required syncing."
  exit 0
fi

echo "Back-merge branch updated linearly."
