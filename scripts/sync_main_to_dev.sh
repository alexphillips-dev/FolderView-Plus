#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

DEV_BRANCH="dev"
MAIN_REF="origin/main"
DEV_REF="origin/dev"

git fetch origin main dev --tags

if git show-ref --verify --quiet "refs/heads/${DEV_BRANCH}"; then
  git checkout "${DEV_BRANCH}"
else
  git checkout -b "${DEV_BRANCH}" "${DEV_REF}"
fi

if git merge-base --is-ancestor "${MAIN_REF}" "${DEV_BRANCH}"; then
  echo "Dev already includes main. Nothing to sync."
  exit 0
fi

MERGED_CLEANLY=1
if ! git merge --no-ff --no-commit "${MAIN_REF}"; then
  MERGED_CLEANLY=0
fi

if [ "${MERGED_CLEANLY}" -eq 0 ]; then
  mapfile -t CONFLICTS < <(git diff --name-only --diff-filter=U)

  if [ "${#CONFLICTS[@]}" -eq 0 ]; then
    echo "Merge reported conflicts but none were detected." >&2
    exit 1
  fi

  for FILE in "${CONFLICTS[@]}"; do
    case "${FILE}" in
      folderview.plus.plg|archive/folderview.plus-*.txz|archive/folderview.plus-*.txz.sha256)
        ;;
      *)
        echo "Unexpected merge conflict in ${FILE}; aborting auto back-merge." >&2
        git merge --abort
        exit 1
        ;;
    esac
  done

  for FILE in "${CONFLICTS[@]}"; do
    git checkout --ours -- "${FILE}"
    git add "${FILE}"
  done
fi

# Always force dev channel URLs in case main touched these lines without conflicts.
sed -E -i 's|^<!ENTITY pluginURL ".*">|<!ENTITY pluginURL "https://raw.githubusercontent.com/\&github;/dev/folderview.plus.plg">|' folderview.plus.plg
sed -E -i 's|<URL>https://raw.githubusercontent.com/.*?/archive/.*</URL>|<URL>https://raw.githubusercontent.com/\&github;/dev/archive/\&name;-\&version;.txz</URL>|' folderview.plus.plg
git add folderview.plus.plg

if git rev-parse -q --verify MERGE_HEAD >/dev/null; then
  if git diff --cached --quiet; then
    git commit --allow-empty -m "Sync main into dev (auto back-merge)"
  else
    git commit -m "Sync main into dev (auto back-merge)"
  fi
  echo "Back-merge commit created."
else
  echo "No merge head present; nothing to commit."
fi

