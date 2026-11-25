#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib.sh
source "${ROOT_DIR}/scripts/lib.sh"
cd "${ROOT_DIR}"

fvplus::require_commands bash node awk sed grep mktemp

PUSH_MAIN=0
WORKFLOW_ONLY=0
NOTES_OUTPUT=""

usage() {
  cat <<'EOF'
Usage: release_prepare.sh [options]
  --push-main          Commit and push the prepared stable release to main
  --workflow-only      Qualify a workflow/documentation-only main update without rebuilding the plugin
  --notes-output FILE  Render release notes for the prepared version to FILE
  -h, --help           Show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "${1:-}" in
    --push-main)
      PUSH_MAIN=1
      ;;
    --workflow-only)
      WORKFLOW_ONLY=1
      ;;
    --notes-output)
      NOTES_OUTPUT="${2:-}"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fvplus::fail "Unknown argument: ${1}"
      ;;
  esac
  shift
done

if [[ "$PUSH_MAIN" == 1 ]]; then
  [[ "$(git branch --show-current)" == main ]] || fvplus::fail 'Stable publication must run from main.'
  [[ -z "$(git status --porcelain)" ]] || fvplus::fail 'Commit the reviewed release scope and notes before stable preparation.'
  export FVPLUS_REQUIRE_GITHOOKS=1
fi

bash scripts/doctor.sh

if [[ "$WORKFLOW_ONLY" == 1 ]]; then
  [[ "$PUSH_MAIN" == 1 ]] || fvplus::fail '--workflow-only requires --push-main.'
  git fetch --no-tags origin main
  git merge-base --is-ancestor origin/main HEAD || fvplus::fail 'Workflow-only publication must preserve published main ancestry.'
  fvplus::read_package_build_paths
  git diff --quiet --no-renames origin/main HEAD -- "${FVPLUS_PACKAGE_BUILD_PATHS[@]}" ':(exclude)scripts/package_channel_messages.mjs' \
    || fvplus::fail 'Workflow-only publication cannot change package or runtime files.'
  while IFS= read -r changed_path; do
    case "$changed_path" in
      docs/sbom.cdx.json) fvplus::fail 'Workflow-only publication cannot change the packaged dependency inventory.' ;;
      .github/*|scripts/*|tests/*|docs/*|README.md) ;;
      *) fvplus::fail "Workflow-only publication cannot change package or runtime files: $changed_path" ;;
    esac
  done < <(git diff --name-only --no-renames origin/main HEAD)
  echo 'Reusing the unchanged stable package for a qualified workflow-only update.'
else
DRY_RUN_OUTPUT="$(bash pkg_build.sh --branch main --dry-run)"
RELEASE_VERSION="$(printf '%s\n' "${DRY_RUN_OUTPUT}" | sed -n 's/^Version: //p' | head -n 1 || true)"
if [[ -z "${RELEASE_VERSION}" ]]; then
  fvplus::fail "Could not resolve the next stable release version from pkg_build.sh --dry-run."
fi

FVPLUS_TARGET_RELEASE_VERSION="${RELEASE_VERSION}" \
FVPLUS_REQUIRE_EXPLICIT_RELEASE_NOTES=1 \
bash scripts/ensure_plg_changes_entry.sh --check-only --require-explicit --version "${RELEASE_VERSION}"

FVPLUS_REQUIRE_EXPLICIT_RELEASE_NOTES=1 \
bash pkg_build.sh --branch main --no-validate
fi

# Local preparation checks packaging. The exact committed candidate is validated
# once by CI; the publisher consumes that evidence instead of repeating the suite.
FVPLUS_EXPECT_PLUGIN_BRANCH=main bash scripts/release_guard.sh
bash scripts/release_notes_consistency_guard.sh
bash scripts/install_smoke.sh

FINAL_VERSION="$(fvplus::read_plg_version "${ROOT_DIR}/folderview.plus.plg")"

if [[ -n "${NOTES_OUTPUT}" ]]; then
  bash scripts/build_release_notes.sh --version "${FINAL_VERSION}" --output "${NOTES_OUTPUT}"
fi

if [[ "${PUSH_MAIN}" == "1" ]]; then
  if [[ "$WORKFLOW_ONLY" == "1" ]]; then
    if ! git diff --quiet || ! git diff --cached --quiet; then
      fvplus::fail 'Workflow-only preparation changed tracked files.'
    fi
    echo "No release file changes to commit."
  else
    git add -A
    if git diff --cached --quiet; then
      echo "No release file changes to commit."
    else
      git commit -m "Stable release ${FINAL_VERSION}"
    fi
  fi
  node scripts/release_validation.mjs qualify
  git push origin main
  candidate_tag="fvplus-release-candidate-$(git rev-parse HEAD)"
  git push origin ":refs/tags/${candidate_tag}"
fi

echo "Release prepared successfully: ${FINAL_VERSION}"
