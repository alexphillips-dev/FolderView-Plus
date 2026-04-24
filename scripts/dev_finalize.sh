#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib.sh
source "${ROOT_DIR}/scripts/lib.sh"

RUN_BUILD=true
OPEN_FIXTURE=false
PUSH_AFTER_COMMIT=true
FAST_DEV_PUSH=false
COMMIT_MESSAGE=""

print_usage() {
    cat <<'EOF'
Usage: scripts/dev_finalize.sh [options]
  --message TEXT         Commit message for the finalize commit
  --open-fixture         Regenerate the local runtime fixture before validation
  --skip-build           Stop after doctor + lint/tests without packaging, commit, or push
  --no-push              Create the finalize commit locally but do not push dev
  --fast-dev-push        Package, commit, and push dev without local validation hooks
  -h, --help             Show this help

This script is the deterministic "finish dev work" path:
1. Optionally regenerate the local runtime fixture
2. Run doctor + shared lint/tests unless --fast-dev-push is used
3. Require a clean unstaged worktree with intended source changes already staged
4. Rebuild the dev package via pkg_build.sh
5. Stage generated manifest/archive artifacts
6. Commit the staged source + generated artifacts
7. Push dev, using --no-verify when --fast-dev-push is used
EOF
}

print_path_list() {
    local prefix="$1"
    shift
    local entry=""
    for entry in "$@"; do
        printf '%s%s\n' "${prefix}" "${entry}" >&2
    done
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --message)
            COMMIT_MESSAGE="${2:-}"
            if [[ -z "${COMMIT_MESSAGE}" ]]; then
                fvplus::fail "--message requires a non-empty value."
            fi
            shift
            ;;
        --open-fixture)
            OPEN_FIXTURE=true
            ;;
        --skip-build)
            RUN_BUILD=false
            ;;
        --no-push)
            PUSH_AFTER_COMMIT=false
            ;;
        --fast-dev-push)
            FAST_DEV_PUSH=true
            ;;
        -h|--help)
            print_usage
            exit 0
            ;;
        *)
            fvplus::fail "Unknown option: $1"
            ;;
    esac
    shift
done

cd "${ROOT_DIR}"

fvplus::require_commands bash node git
NODE_BIN="$(fvplus::resolve_platform_command node)"

if [[ "${OPEN_FIXTURE}" == true ]]; then
    "${NODE_BIN}" "$(fvplus::path_for_command "${NODE_BIN}" "scripts/generate_runtime_fixture.mjs")"
fi

if [[ "${FAST_DEV_PUSH}" == true && "${RUN_BUILD}" != true ]]; then
    fvplus::fail "--fast-dev-push cannot be combined with --skip-build."
fi

if [[ "${FAST_DEV_PUSH}" == true ]]; then
    echo "dev_finalize.sh fast dev push: skipping doctor + shared lint/tests."
else
    bash scripts/doctor.sh
    bash scripts/run_ci_suite.sh --lane lint --lane tests
fi

if [[ "${RUN_BUILD}" != true ]]; then
    echo "dev_finalize.sh validation completed successfully."
    exit 0
fi

if [[ -z "${COMMIT_MESSAGE}" ]]; then
    fvplus::fail "--message is required unless --skip-build is used."
fi

CURRENT_BRANCH="$(git branch --show-current)"
if [[ "${CURRENT_BRANCH}" != "dev" ]]; then
    fvplus::fail "dev_finalize.sh must run from branch 'dev' (current: ${CURRENT_BRANCH:-detached})."
fi

mapfile -t STAGED_FILES < <(git diff --cached --name-only --diff-filter=ACMR || true)
if [[ "${#STAGED_FILES[@]}" -eq 0 ]]; then
    fvplus::fail "Stage the intended source changes before running dev_finalize.sh."
fi

mapfile -t UNSTAGED_FILES < <(git diff --name-only --diff-filter=ACMR || true)
if [[ "${#UNSTAGED_FILES[@]}" -gt 0 ]]; then
    echo "ERROR: dev_finalize.sh requires a clean unstaged worktree. Stage or revert these files first:" >&2
    print_path_list "  " "${UNSTAGED_FILES[@]}"
    exit 1
fi

mapfile -t UNTRACKED_FILES < <(git ls-files --others --exclude-standard || true)
if [[ "${#UNTRACKED_FILES[@]}" -gt 0 ]]; then
    echo "ERROR: dev_finalize.sh requires no untracked files before packaging. Add or remove these paths first:" >&2
    print_path_list "  " "${UNTRACKED_FILES[@]}"
    exit 1
fi

bash pkg_build.sh --branch "${CURRENT_BRANCH}"

VERSION="$(fvplus::read_plg_version "${ROOT_DIR}/folderview.plus.plg")"
git add folderview.plus.plg folderview.plus.xml archive/

if git diff --cached --quiet; then
    fvplus::fail "No staged changes remain to commit after packaging."
fi

git commit -m "${COMMIT_MESSAGE}"

if [[ "${PUSH_AFTER_COMMIT}" == true ]]; then
    if [[ "${FAST_DEV_PUSH}" == true ]]; then
        git push --no-verify -u origin dev
    else
        git push -u origin dev
    fi
    echo "dev_finalize.sh completed successfully: pushed dev @ version ${VERSION}."
    exit 0
fi

echo "dev_finalize.sh completed successfully: created local commit for dev @ version ${VERSION}."
