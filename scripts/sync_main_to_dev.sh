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
    folderview.plus.plg|folderview.plus.xml|archive/folderview.plus-*.txz|archive/folderview.plus-*.txz.sha256)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

latest_dev_merge_into_main() {
  git log "${MAIN_REF}" --first-parent --grep='^Merge dev into main for ' --format='%H' -n 1
}

resolve_release_only_conflicts() {
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
  git checkout --ours -- "${CONFLICT_PATHS[@]}"
  git add -- "${CONFLICT_PATHS[@]}"
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
  echo "Main differs from dev only by release artifacts/manifest. Skipping back-merge."
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
  mapfile -t COMMIT_PATHS < <(git show --pretty=format: --name-only "${COMMIT}" | sed '/^[[:space:]]*$/d')
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

  if ! git cherry-pick -x "${COMMIT}"; then
    if resolve_release_only_conflicts && git cherry-pick --continue; then
      :
    else
      echo "Cherry-pick failed for ${COMMIT}; aborting auto back-merge." >&2
      git cherry-pick --abort
      exit 1
    fi
  fi

  if [ "${commit_touched_release_paths}" -eq 1 ]; then
    git restore --source=HEAD^ --staged --worktree folderview.plus.plg folderview.plus.xml archive
    if ! git diff --cached --quiet || ! git diff --quiet; then
      git add folderview.plus.plg folderview.plus.xml archive
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
