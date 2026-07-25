#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib.sh
source "${ROOT_DIR}/scripts/lib.sh"
cd "${ROOT_DIR}"

fvplus::require_commands git awk find wc

history_mode=0
if [[ "${1:-}" == "--history" ]]; then
  history_mode=1
elif [[ -n "${1:-}" ]]; then
  fvplus::fail "Usage: artifact_history_audit.sh [--history]"
fi

current_count="$(find archive -maxdepth 1 -type f -name 'folderview.plus-*.txz' | wc -l | tr -d ' ')"
current_bytes="$(find archive -maxdepth 1 -type f -name 'folderview.plus-*.txz' -printf '%s\n' | awk '{sum += $1} END {print sum + 0}')"
printf 'Current archive tree: %s package(s), %s byte(s).\n' "${current_count}" "${current_bytes}"
if [[ "${current_count}" -gt 24 ]]; then
  fvplus::fail "Current archive tree exceeds the 24-package retention contract."
fi
if [[ "${history_mode}" -eq 0 ]]; then
  echo "Use --history for the slower reachable-object report."
  exit 0
fi

report="$(
  git rev-list --objects --all \
    | git cat-file --batch-check='%(objectname) %(objecttype) %(objectsize) %(rest)' \
    | awk '$2 == "blob" && $4 ~ /^archive\/folderview\.plus-.*\.txz$/ { count += 1; bytes += $3 } END { print count + 0, bytes + 0 }'
)"
printf 'Reachable archive history: %s blob(s), %s uncompressed byte(s).\n' "${report%% *}" "${report##* }"
