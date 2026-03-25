#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_TESTS=true
RUN_BUILD=true
OPEN_FIXTURE=false
STAGE_ARTIFACTS=false

print_usage() {
    cat <<'EOF'
Usage: scripts/dev_finalize.sh [options]
  --skip-tests           Skip the targeted test pass
  --skip-build           Skip pkg_build.sh
  --open-fixture         Regenerate the local runtime fixture before validation
  --stage-artifacts      git add package artifacts after a successful build
  -h, --help             Show this help

This script is the deterministic "finish UI/runtime work" path:
1. Regenerate the local runtime fixture if requested
2. Run the contract/layout regression tests
3. Build package artifacts via pkg_build.sh --no-validate
4. Optionally stage the generated package files
EOF
}

while [ $# -gt 0 ]; do
    case "$1" in
        --skip-tests)
            RUN_TESTS=false
            ;;
        --skip-build)
            RUN_BUILD=false
            ;;
        --open-fixture)
            OPEN_FIXTURE=true
            ;;
        --stage-artifacts)
            STAGE_ARTIFACTS=true
            ;;
        -h|--help)
            print_usage
            exit 0
            ;;
        *)
            echo "ERROR: Unknown option: $1" >&2
            print_usage >&2
            exit 1
            ;;
    esac
    shift
done

cd "$ROOT_DIR"

if [ "$OPEN_FIXTURE" = true ]; then
    node scripts/generate_runtime_fixture.mjs
fi

if [ "$RUN_TESTS" = true ]; then
    node --test \
        tests/folder-contract-shared-architecture.test.mjs \
        tests/docker-runtime-shared-architecture.test.mjs \
        tests/vm-runtime-shared-architecture.test.mjs \
        tests/preview-border-toggle.test.mjs \
        tests/ui-smoke-layout.test.mjs \
        tests/vm-mobile-name-alignment-guard.test.mjs
fi

if [ "$RUN_BUILD" = true ]; then
    bash pkg_build.sh --no-validate
fi

if [ "$STAGE_ARTIFACTS" = true ]; then
    git add folderview.plus.plg folderview.plus.xml archive/
fi

echo "dev_finalize.sh completed successfully."
