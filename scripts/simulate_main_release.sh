#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib.sh
source "${ROOT_DIR}/scripts/lib.sh"
cd "${ROOT_DIR}"

fvplus::require_commands git bash mktemp npm realpath

mkdir -p "${ROOT_DIR}/tmp"
TMP_DIR="$(mktemp -d "${ROOT_DIR}/tmp/main-release-sim.XXXXXX")"
WORKTREE_DIR="${TMP_DIR}/worktree"
NOTES_OUTPUT="${ROOT_DIR}/tmp/release-main-simulation-notes.md"

cleanup() {
  if git -C "${ROOT_DIR}" worktree list --porcelain | grep -Fq "worktree ${WORKTREE_DIR}"; then
    git -C "${ROOT_DIR}" worktree remove --force "${WORKTREE_DIR}" >/dev/null 2>&1 || true
  fi
  rm -rf "${TMP_DIR}"
}
trap cleanup EXIT

git -C "${ROOT_DIR}" worktree add --detach "${WORKTREE_DIR}" HEAD >/dev/null

(
  cd "${WORKTREE_DIR}"
  # A relative gitfile is readable by both WSL Git and native Windows tests.
  if command -v wslpath >/dev/null 2>&1; then
    WORKTREE_GIT_DIR="$(git rev-parse --absolute-git-dir)"
    printf 'gitdir: %s\n' "$(realpath --relative-to="${WORKTREE_DIR}" "${WORKTREE_GIT_DIR}")" > .git
  fi
  NPM_BIN="$(fvplus::resolve_platform_command npm)"
  "${NPM_BIN}" ci --ignore-scripts
  FVPLUS_EXPECT_PLUGIN_BRANCH=main \
    bash scripts/release_prepare.sh --notes-output "${TMP_DIR}/release_notes.md"
)

cp "${TMP_DIR}/release_notes.md" "${NOTES_OUTPUT}"
echo "Simulated main release successfully. Notes preview: ${NOTES_OUTPUT}"
