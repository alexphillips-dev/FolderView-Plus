#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib.sh
source "${ROOT_DIR}/scripts/lib.sh"
cd "${ROOT_DIR}"

fvplus::require_commands bash gh mktemp

REPO="${FVPLUS_GITHUB_REPO:-alexphillips-dev/FolderView-Plus}"
TMP_DIR="$(mktemp -d "${ROOT_DIR}/tmp/branch-protection.XXXXXX")"
trap 'rm -rf "${TMP_DIR}"' EXIT

cat > "${TMP_DIR}/main.json" <<'EOF'
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "quality",
      "Analyze (JavaScript)",
      "Dependency Review"
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": true,
    "require_last_push_approval": false,
    "required_approving_review_count": 1
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": true,
  "lock_branch": false,
  "allow_fork_syncing": false
}
EOF

cat > "${TMP_DIR}/dev.json" <<'EOF'
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "quality",
      "Dependency Review"
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": false,
  "lock_branch": false,
  "allow_fork_syncing": false
}
EOF

gh api --method PUT -H "Accept: application/vnd.github+json" "repos/${REPO}/branches/main/protection" --input "${TMP_DIR}/main.json" >/dev/null
gh api --method PUT -H "Accept: application/vnd.github+json" "repos/${REPO}/branches/dev/protection" --input "${TMP_DIR}/dev.json" >/dev/null

echo "Applied branch protection for main and dev on ${REPO}."
