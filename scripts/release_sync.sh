#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib.sh
source "$ROOT_DIR/scripts/lib.sh"
cd "$ROOT_DIR"
[[ "${1:-}" == --push-dev ]] || fvplus::fail 'Usage: release_sync.sh --push-dev (only after an authorized stable release)'
[[ -z "$(git status --porcelain)" ]] || fvplus::fail 'Synchronization requires a clean worktree.'
git fetch --filter=blob:none --no-tags origin main dev
[[ "$(git rev-parse HEAD)" == "$(git rev-parse origin/main)" ]] || fvplus::fail 'Run synchronization from the current published main release.'
node scripts/release_validation.mjs wait
mkdir -p "$ROOT_DIR/tmp"
task_dir="$(mktemp -d "$ROOT_DIR/tmp/release-sync.XXXXXX")"
worktree="$task_dir/worktree"
git worktree add --detach "$worktree" origin/dev
(
  cd "$worktree"
  # WSL and native Windows Git both need a relative gitfile.
  if command -v wslpath >/dev/null 2>&1; then
    worktree_git_dir="$(git rev-parse --absolute-git-dir)"
    printf 'gitdir: %s\n' "$(realpath --relative-to="$worktree" "$worktree_git_dir")" > .git
  fi
  FVPLUS_BACKMERGE_LOCAL_BRANCH=HEAD bash scripts/sync_main_to_dev.sh
  node scripts/sync_plan.mjs
  if ! git diff --quiet origin/dev HEAD; then
    FVPLUS_BACKMERGE_LOCAL_BRANCH=HEAD FVPLUS_EXPECT_PLUGIN_BRANCH=dev bash scripts/prepare_backmerge_dev_package.sh
    git add --all
    if ! git diff --cached --quiet; then git commit --no-verify -m 'Rebuild dev package after stable synchronization'; fi
    node scripts/release_validation.mjs qualify
  else
    echo 'Reusing the already-published dev tree; browser, benchmark, and security rescans are unnecessary.'
  fi
  git fetch --no-tags origin main dev
  [[ "$(git rev-parse origin/main)" == "$(node -e 'console.log(JSON.parse(require("fs").readFileSync("tmp/synchronization-plan.json")).mainCommit)')" ]] || { echo 'Main moved during synchronization; no push performed.' >&2; exit 1; }
  [[ "$(git rev-parse origin/dev)" == "$(node -e 'console.log(JSON.parse(require("fs").readFileSync("tmp/synchronization-plan.json")).devBaseCommit)')" ]] || { echo 'Dev moved during synchronization; no push performed.' >&2; exit 1; }
  git push --no-verify origin HEAD:dev
  tag="fvplus-sync-candidate-$(git rev-parse HEAD)"
  if [[ -n "$(git ls-remote --tags origin "refs/tags/$tag")" ]]; then git push --no-verify origin ":refs/tags/$tag"; fi
  bash scripts/remote_publish_guard.sh
  git fetch --no-tags origin dev
  [[ "$(git rev-list --left-right --count origin/dev...HEAD)" == $'0\t0' ]]
  echo 'Verified synchronized dev publication and 0 0 alignment.'
)
# Failed worktrees are retained for inspection; remove only this clean success.
git worktree remove "$worktree"
rmdir "$task_dir"
echo 'Return to dev and fast-forward it to origin/dev. No temporary remote branch was created.'
