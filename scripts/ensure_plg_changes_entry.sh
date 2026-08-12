#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLG_FILE="${ROOT_DIR}/folderview.plus.plg"
MAX_AUTO_LINES="${FVPLUS_AUTO_CHANGE_LINES:-6}"
AUTO_FALLBACK_NOTE='Maintenance: Release metadata and packaging sync.'
CHECK_ONLY=0
VERSION_OVERRIDE="${FVPLUS_TARGET_RELEASE_VERSION:-}"
REQUIRE_EXPLICIT="${FVPLUS_REQUIRE_EXPLICIT_RELEASE_NOTES:-0}"
PRUNE_STALE_CHANGES="${FVPLUS_PRUNE_STALE_CHANGES:-0}"
# shellcheck source=scripts/lib.sh
source "${ROOT_DIR}/scripts/lib.sh"
# shellcheck source=scripts/release_note_categories.sh
source "${ROOT_DIR}/scripts/release_note_categories.sh"

print_usage() {
  cat <<'EOF'
Usage: ensure_plg_changes_entry.sh [options]
  --version VERSION      Validate or insert notes for VERSION instead of the manifest version
  --check-only           Validate note availability/content without modifying folderview.plus.plg
  --require-explicit     Require curated or explicit non-generic release notes instead of auto-generated notes
  -h, --help             Show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "${1:-}" in
    --version)
      VERSION_OVERRIDE="${2:-}"
      shift
      ;;
    --check-only)
      CHECK_ONLY=1
      ;;
    --require-explicit)
      REQUIRE_EXPLICIT=1
      ;;
    -h|--help)
      print_usage
      exit 0
      ;;
    *)
      fvplus::fail "Unknown argument: ${1}"
      ;;
  esac
  shift
done

if [[ ! -f "${PLG_FILE}" ]]; then
  fvplus::fail "Missing plugin manifest: ${PLG_FILE}"
fi

VERSION="${VERSION_OVERRIDE:-$(fvplus::read_plg_version "${PLG_FILE}")}"
OVERRIDE_FILE="${ROOT_DIR}/docs/releases/${VERSION}.md"

normalize_changes_block() {
  local raw="${1:-}"
  printf '%s' "${raw}" | sed -E '/^[[:space:]]*$/d; s/[[:space:]]+/ /g; s/^[[:space:]]+|[[:space:]]+$//g'
}

changes_block_for_version() {
  local target_version="${1:-}"
  awk -v version="${target_version}" '
    BEGIN { capture = 0 }
    /^###[0-9]{4}\.[0-9]{2}\.[0-9]{2}\.[0-9]{2}[[:space:]]*$/ {
      if (capture) {
        exit
      }
      if ($0 ~ "^###" version "[[:space:]]*$") {
        capture = 1
        next
      }
    }
    capture {
      print
    }
  ' "${PLG_FILE}" | sed '/^[[:space:]]*$/d'
}

previous_changes_version() {
  local target_version="${1:-}"
  awk -v version="${target_version}" '
    /^###[0-9]{4}\.[0-9]{2}\.[0-9]{2}\.[0-9]{2}[[:space:]]*$/ {
      candidate = $0
      sub(/^###/, "", candidate)
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", candidate)
      if (candidate != version) {
        print candidate
        exit
      }
    }
  ' "${PLG_FILE}"
}

version_greater_than() {
  local left="${1:-}"
  local right="${2:-}"
  local max_ver=""
  [[ -n "${left}" ]] || return 1
  [[ -n "${right}" ]] || return 1
  [[ "${left}" != "${right}" ]] || return 1
  max_ver="$(printf '%s\n%s\n' "${left}" "${right}" | sort -V | tail -n 1)"
  [[ "${max_ver}" == "${left}" ]]
}

head_manifest_version() {
  local version_line=""
  if ! command -v git >/dev/null 2>&1 || ! git -C "${ROOT_DIR}" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    return 0
  fi
  version_line="$(
    git -C "${ROOT_DIR}" show HEAD:folderview.plus.plg 2>/dev/null \
      | sed -n 's/^<!ENTITY version "\([^"]*\)".*/\1/p' \
      | head -n 1 \
      || true
  )"
  printf '%s' "${version_line}"
}

list_changes_versions() {
  awk '
    /^###[0-9]{4}\.[0-9]{2}\.[0-9]{2}\.[0-9]{2}[[:space:]]*$/ {
      candidate = $0
      sub(/^###/, "", candidate)
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", candidate)
      if (candidate != "") {
        print candidate
      }
    }
  ' "${PLG_FILE}"
}

remove_changes_block_for_version() {
  local target_version="${1:-}"
  local tmp_file=""
  [[ -n "${target_version}" ]] || return 0
  tmp_file="$(mktemp)"
  awk -v version="${target_version}" '
    BEGIN { skip = 0 }
    /^###[0-9]{4}\.[0-9]{2}\.[0-9]{2}\.[0-9]{2}[[:space:]]*$/ {
      if ($0 ~ "^###" version "[[:space:]]*$") {
        skip = 1
        next
      }
      if (skip) {
        skip = 0
      }
    }
    {
      if (!skip) {
        print
      }
    }
  ' "${PLG_FILE}" > "${tmp_file}"
  mv "${tmp_file}" "${PLG_FILE}"
}

prune_unreleased_retry_blocks() {
  local target_version="${1:-}"
  local head_version=""
  local stale_version=""
  local removed=0
  [[ -n "${target_version}" ]] || return 0
  head_version="$(head_manifest_version)"
  [[ -n "${head_version}" ]] || return 0
  while IFS= read -r stale_version; do
    [[ -n "${stale_version}" ]] || continue
    if ! version_greater_than "${stale_version}" "${head_version}"; then
      continue
    fi
    if [[ "${stale_version}" == "${target_version}" ]]; then
      continue
    fi
    remove_changes_block_for_version "${stale_version}"
    removed=$((removed + 1))
  done < <(list_changes_versions)
  if [[ "${removed}" -gt 0 ]]; then
    echo "Pruned ${removed} unreleased local CHANGES block(s) newer than HEAD before inserting ${target_version}"
  fi
}

is_metadata_only_changes_line() {
  local line="${1:-}"
  local lowered=""
  lowered="$(printf '%s' "${line}" | tr '[:upper:]' '[:lower:]')"
  [[ "${lowered}" == *"release metadata and packaging sync"* ]] && return 0
  [[ "${lowered}" == *"automated release metadata update"* ]] && return 0
  [[ "${lowered}" == *"metadata update"* ]] && return 0
  [[ "${lowered}" == *"packaging sync"* ]] && return 0
  [[ "${lowered}" == *"folder editor flows, previews, and bootstrap behavior."* ]] && return 0
  return 1
}

block_is_metadata_only() {
  local block="${1:-}"
  local line=""
  local saw_content=0
  while IFS= read -r line; do
    [[ -z "${line}" ]] && continue
    saw_content=1
    if ! is_metadata_only_changes_line "${line}"; then
      return 1
    fi
  done <<< "${block}"
  [[ "${saw_content}" -eq 1 ]]
}

if [[ "${CHECK_ONLY}" != "1" && "${PRUNE_STALE_CHANGES}" == "1" ]]; then
  prune_unreleased_retry_blocks "${VERSION}"
fi

current_block="$(changes_block_for_version "${VERSION}")"
if [[ -n "${current_block}" ]]; then
  if [[ "${REQUIRE_EXPLICIT}" == "1" ]]; then
    if block_is_metadata_only "${current_block}"; then
      fvplus::fail "CHANGES entry for ${VERSION} contains only generic release-metadata boilerplate. Add explicit release notes or docs/releases/${VERSION}.md."
    fi
    previous_version="$(previous_changes_version "${VERSION}")"
    if [[ -n "${previous_version}" ]]; then
      previous_block="$(changes_block_for_version "${previous_version}")"
      if [[ -n "${previous_block}" ]] && [[ "$(normalize_changes_block "${current_block}")" == "$(normalize_changes_block "${previous_block}")" ]]; then
        fvplus::fail "CHANGES entry for ${VERSION} duplicates the previous release notes block. Add explicit release deltas or docs/releases/${VERSION}.md."
      fi
    fi
  fi
  echo "CHANGES entry already present for ${VERSION}"
  exit 0
fi

if [[ -f "${OVERRIDE_FILE}" ]]; then
  OVERRIDE_NOTES="$(sed '/^[[:space:]]*$/d' "${OVERRIDE_FILE}")"
  if [[ -z "${OVERRIDE_NOTES}" ]]; then
    fvplus::fail "Curated release note override is empty: docs/releases/${VERSION}.md"
  fi
  if [[ "${CHECK_ONLY}" == "1" ]]; then
    echo "Validated curated release notes for ${VERSION} from docs/releases/${VERSION}.md"
    exit 0
  fi
  AUTO_NOTES="${OVERRIDE_NOTES}"
elif [[ "${REQUIRE_EXPLICIT}" == "1" ]]; then
  fvplus::fail "Explicit release notes are required for ${VERSION}. Add docs/releases/${VERSION}.md or a non-generic CHANGES block before packaging."
fi

if [[ "${CHECK_ONLY}" == "1" ]]; then
  echo "Validated auto-generated CHANGES plan for ${VERSION}"
  exit 0
fi

normalize_subject() {
  local raw="${1:-}"
  local cleaned
  cleaned="$(printf '%s' "${raw}" | sed -E 's/^[[:space:]]+|[[:space:]]+$//g')"
  # Strip conventional-commit prefixes like "feat(scope): " while keeping content.
  cleaned="$(printf '%s' "${cleaned}" | sed -E 's/^[a-zA-Z]+(\([^)]+\))?!?:[[:space:]]*//')"
  cleaned="$(printf '%s' "${cleaned}" | sed -E 's/[[:space:]]+/ /g')"
  printf '%s' "${cleaned}"
}

guess_category_from_subject() {
  local subject="${1:-}"
  local lowered
  lowered="$(printf '%s' "${subject}" | tr '[:upper:]' '[:lower:]')"
  case "${lowered}" in
    feature*|feat*|add*|implement*)
      printf 'Feature'
      ;;
    fix*|bug*|hotfix*|resolve*)
      printf 'Fix'
      ;;
    security*|sec*|hardening*)
      printf 'Security'
      ;;
    performance*|perf*|optimi*|speed*)
      printf 'Performance'
      ;;
    ux*|ui*|style*|polish*)
      printf 'UX'
      ;;
    compatibility*|compat*)
      printf 'Compatibility'
      ;;
    refactor*)
      printf 'Refactor'
      ;;
    docs*|readme*)
      printf 'Docs'
      ;;
    test*|qa*)
      printf 'Test'
      ;;
    *)
      printf 'Maintenance'
      ;;
  esac
}

format_change_line() {
  local category="${1:-Maintenance}"
  local subject="${2:-}"
  if [[ -z "${subject}" ]]; then
    return
  fi
  if ! fvplus::is_release_note_category "${category}"; then
    category="Maintenance"
  fi
  if [[ "${subject}" =~ [.!?]$ ]]; then
    printf -- '- %s: %s\n' "${category}" "${subject}"
  else
    printf -- '- %s: %s.\n' "${category}" "${subject}"
  fi
}

is_subject_metadata_only() {
  local subject="${1:-}"
  local lowered
  lowered="$(printf '%s' "${subject}" | tr '[:upper:]' '[:lower:]')"
  [[ "${lowered}" == *"release metadata and packaging sync"* ]] && return 0
  [[ "${lowered}" == *"automated release metadata update"* ]] && return 0
  [[ "${lowered}" == *"metadata update"* ]] && return 0
  [[ "${lowered}" == *"packaging sync"* ]] && return 0
  return 1
}

resolve_changes_anchor_ref() {
  local previous_version="${1:-}"
  local anchor_ref=""

  if ! command -v git >/dev/null 2>&1 || ! git -C "${ROOT_DIR}" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    return 0
  fi

  if [[ -n "${previous_version}" ]] && git -C "${ROOT_DIR}" rev-parse -q --verify "refs/tags/v${previous_version}^{tag}" >/dev/null 2>&1; then
    printf 'v%s\n' "${previous_version}"
    return 0
  fi

  if [[ -n "${previous_version}" ]]; then
    anchor_ref="$(git -C "${ROOT_DIR}" log --no-merges --format=%H -S "###${previous_version}" -- "${PLG_FILE}" | head -n 1 || true)"
  fi

  if [[ -n "${anchor_ref}" ]]; then
    printf '%s\n' "${anchor_ref}"
  fi
  return 0
}

collect_changed_files() {
  local previous_version="${1:-}"
  local anchor_ref=""
  local range=""

  if ! command -v git >/dev/null 2>&1 || ! git -C "${ROOT_DIR}" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    return 0
  fi

  anchor_ref="$(resolve_changes_anchor_ref "${previous_version}")"
  if [[ -n "${anchor_ref}" ]]; then
    range="${anchor_ref}..HEAD"
  fi

  {
    if [[ -n "${range}" ]]; then
      git -C "${ROOT_DIR}" diff --name-only --relative "${range}" -- .
    fi
    git -C "${ROOT_DIR}" diff --name-only --relative HEAD -- .
    git -C "${ROOT_DIR}" ls-files --others --exclude-standard
  } | sed '/^[[:space:]]*$/d' | sort -u
}

classify_changed_path_subsystems() {
  local changed="${1:-}"

  case "${changed}" in
    folderview.plus.plg|folderview.plus.xml|archive/*)
      return
      ;;
  esac

  case "${changed}" in
    README.md|docs/*|.github/SECURITY.md|.github/SUPPORT*.md|.github/CONTRIBUTING.md|src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/README.md)
      printf '%s\n' "docs"
      return
      ;;
  esac

  case "${changed}" in
    scripts/ensure_plg_changes_entry.sh|scripts/build_release_notes.sh|scripts/release_prepare.sh|scripts/release_guard.sh|scripts/dev_finalize.sh|tests/versioning-guard.test.mjs)
      printf '%s\n' "release-notes-tooling"
      return
      ;;
  esac

  case "${changed}" in
    .github/workflows/*|.github/actions/*|.githooks/*|pkg_build.sh|scripts/*)
      printf '%s\n' "release-tooling"
      return
      ;;
  esac

  case "${changed}" in
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js|\
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.support-bundle-browser.js|\
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.support-bundle-telemetry.js|\
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.activity-diagnostics.js|\
    tests/browser-smoke-docker-diagnostics.test.mjs|tests/support-bundle-browser-telemetry.test.mjs|tests/docker-update-status-regression.test.mjs)
      printf '%s\n' "docker-diagnostics"
      return
      ;;
  esac

  case "${changed}" in
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js|\
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.*|\
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/docker.css|\
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/folderview.plus.Docker.page|\
    tests/docker*)
      printf '%s\n' "docker-runtime"
      return
      ;;
  esac

  case "${changed}" in
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/vm.js|\
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/vm.css|\
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/folderview.plus.VMs.page|\
    tests/vm*)
      printf '%s\n' "vm-runtime"
      return
      ;;
  esac

  case "${changed}" in
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/dashboard.js|\
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/dashboard.*|\
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/dashboard.css|\
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/folderview.plus.Dashboard.page|\
    tests/dashboard*)
      printf '%s\n' "dashboard"
      return
      ;;
  esac

  case "${changed}" in
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/Folder.page|\
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.js|\
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.legacy.js|\
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.editor.*|\
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.folder-editor.js|\
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/folder.css|\
    tests/folder-editor*|tests/folder-accent*|tests/ui-smoke-layout.test.mjs)
      printf '%s\n' "folder-editor"
      return
      ;;
  esac

  case "${changed}" in
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.activity-diagnostics.js|\
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.fatal-banner.js|\
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/diagnostics.php|\
    tests/runtime-preflight-diagnostics.test.mjs)
      printf '%s\n' "settings-diagnostics"
      return
      ;;
  esac

  case "${changed}" in
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/FolderViewPlus.page|\
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.js|\
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.chrome.js|\
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.dirty.js|\
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.row-details.js|\
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.bulk-assignment.js|\
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.runtime-actions.js|\
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.settings-*|\
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.updates.js|\
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/folderviewplus.css|\
    tests/settings-*|tests/update-notes-category.test.mjs)
      printf '%s\n' "settings-workspace"
      return
      ;;
  esac

  case "${changed}" in
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.setup-assistant.js|\
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.smart-detect-config.js|\
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.starter-templates.js|\
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.wizard*|\
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.editor.rules.js|\
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/bulk_assign.php|\
    tests/wizard*|tests/bulk-*|tests/folderviewplus-utils.test.mjs)
      printf '%s\n' "automation-rules"
      return
      ;;
  esac

  case "${changed}" in
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.import.js|\
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.actions-support.js|\
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/scheduled_backup.php|\
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/backup.php|\
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/bulk_folder_action.php|\
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/templates.php|\
    tests/backup*|tests/import*|tests/workflow-utils-contract.test.mjs)
      printf '%s\n' "operations-recovery"
      return
      ;;
  esac

  case "${changed}" in
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/icon-picker.runtime.js|\
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.editor.icon-api.js|\
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/third_party_icons.php|\
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/upload_custom_icon.php|\
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/images/*|\
    tests/icon*)
      printf '%s\n' "icon-workflows"
      return
      ;;
  esac

  case "${changed}" in
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.shared.js|\
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.runtime.state-observers.js|\
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.folder-contract.js|\
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.request.js|\
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.runtime-parity.js|\
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.theme-resolver.js|\
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.utils-foundation.js|\
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.utils.js|\
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/runtime.transport.core.js|\
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/runtime.transport.subscription.js|\
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/runtime.transport.docker-actions.js|\
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/runtime.transport.js|\
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/runtime.column-layout.js|\
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/runtime.folder-ordering.js|\
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/runtime.live-refresh.js|\
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.column-controller.js|\
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/runtime.shared.css|\
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.validation.php|\
    tests/*shared*|tests/*parity*|tests/request-client-contract.test.mjs|tests/extracted-module-bootstrap-guard.test.mjs)
      printf '%s\n' "shared-runtime"
      return
      ;;
  esac

  case "${changed}" in
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/*|\
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/custom.php|\
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/custom.php|\
    tests/server*)
      printf '%s\n' "server-runtime"
      return
      ;;
  esac

  case "${changed}" in
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/*|\
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/*|\
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/*.page)
      printf '%s\n' "settings-workspace"
      return
      ;;
    tests/*)
      printf '%s\n' "release-tooling"
      return
      ;;
  esac
}

format_subsystem_note_line() {
  local subsystem="${1:-}"
  local category=""
  local subject=""

  case "${subsystem}" in
    docker-diagnostics)
      category="Fix"
      subject="Docker support-bundle snapshots, trace storage caps, and rendered-state diagnostics"
      ;;
    docker-runtime)
      category="Fix"
      subject="Docker runtime rows, folder state, and container interactions"
      ;;
    vm-runtime)
      category="Fix"
      subject="VM runtime rows, folder state, and VM actions"
      ;;
    dashboard)
      category="UX"
      subject="Dashboard layouts, quick rails, and folder card interactions"
      ;;
    folder-editor)
      category="UX"
      subject="Folder editor flows, previews, and bootstrap behavior"
      ;;
    settings-workspace)
      category="UX"
      subject="Settings workspace layout, section flows, and table behavior"
      ;;
    settings-diagnostics)
      category="Fix"
      subject="Diagnostics surfaces, issue reports, and support bundle coverage"
      ;;
    release-notes-tooling)
      category="Quality"
      subject="Release-note generation, retry cleanup, and packaging guards"
      ;;
    automation-rules)
      category="Feature"
      subject="Setup Assistant, rules, smart-detect, and starter-template workflows"
      ;;
    operations-recovery)
      category="Fix"
      subject="Runtime actions, templates, import/export, and backup recovery paths"
      ;;
    icon-workflows)
      category="UX"
      subject="Icon picker, bundled icon packs, and custom icon management"
      ;;
    shared-runtime)
      category="Refactor"
      subject="Shared runtime contracts, request plumbing, and cross-page foundations"
      ;;
    server-runtime)
      category="Fix"
      subject="Server endpoints, runtime payloads, and persistence or validation paths"
      ;;
    release-tooling)
      category="Quality"
      subject="Release automation, CI smoke coverage, and packaging guards"
      ;;
    docs)
      category="Docs"
      subject="Project documentation and support guidance"
      ;;
    *)
      return
      ;;
  esac

  format_change_line "${category}" "${subject}"
}

build_diff_based_notes() {
  local previous_version="${1:-}"
  local -a changed_files=()
  local -a notes=()
  local -a subsystem_order=(
    docker-diagnostics
    docker-runtime
    vm-runtime
    dashboard
    folder-editor
    settings-workspace
    settings-diagnostics
    release-notes-tooling
    automation-rules
    operations-recovery
    icon-workflows
    shared-runtime
    server-runtime
    release-tooling
    docs
  )
  local changed=""
  local subsystem=""
  local note=""
  declare -A seen_subsystems=()

  if ! command -v git >/dev/null 2>&1 || ! git -C "${ROOT_DIR}" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    return 0
  fi

  mapfile -t changed_files < <(collect_changed_files "${previous_version}" || true)

  if [[ ${#changed_files[@]} -eq 0 ]]; then
    return 0
  fi

  for changed in "${changed_files[@]}"; do
    while IFS= read -r subsystem; do
      [[ -z "${subsystem}" ]] && continue
      seen_subsystems["${subsystem}"]=1
    done < <(classify_changed_path_subsystems "${changed}")
  done

  for subsystem in "${subsystem_order[@]}"; do
    if [[ -z "${seen_subsystems["${subsystem}"]:-}" ]]; then
      continue
    fi
    note="$(format_subsystem_note_line "${subsystem}")"
    if [[ -n "${note}" ]]; then
      notes+=("${note}")
    fi
  done

  if [[ ${#notes[@]} -eq 0 ]]; then
    return 0
  fi

  printf '%s\n' "${notes[@]}" | head -n "${MAX_AUTO_LINES}"
}

build_auto_notes() {
  local previous_version="${1:-}"
  local -a subjects=()
  local -a notes=()
  local note
  local anchor_ref=""
  local range=""

  mapfile -t notes < <(build_diff_based_notes "${previous_version}" || true)
  if [[ ${#notes[@]} -gt 0 ]]; then
    printf '%s\n' "${notes[@]}"
    return
  fi

  if command -v git >/dev/null 2>&1 && git -C "${ROOT_DIR}" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    anchor_ref="$(resolve_changes_anchor_ref "${previous_version}")"
    if [[ -n "${anchor_ref}" ]]; then
      range="${anchor_ref}..HEAD"
    fi
    if [[ -n "${range}" ]]; then
      mapfile -t subjects < <(git -C "${ROOT_DIR}" log --no-merges --pretty=%s "${range}" | sed '/^[[:space:]]*$/d' | head -n "${MAX_AUTO_LINES}")
    else
      mapfile -t subjects < <(git -C "${ROOT_DIR}" log --no-merges -n "${MAX_AUTO_LINES}" --pretty=%s | sed '/^[[:space:]]*$/d')
    fi
  fi

  if [[ ${#subjects[@]} -eq 0 ]]; then
    mapfile -t notes < <(build_diff_based_notes "${previous_version}" || true)
    if [[ ${#notes[@]} -eq 0 ]]; then
      printf -- '- %s\n' "${AUTO_FALLBACK_NOTE}"
    else
      printf '%s\n' "${notes[@]}"
    fi
    return
  fi

  for subject in "${subjects[@]}"; do
    local normalized
    local category
    normalized="$(normalize_subject "${subject}")"
    if [[ -z "${normalized}" ]]; then
      continue
    fi
    if is_subject_metadata_only "${normalized}"; then
      continue
    fi
    category="$(guess_category_from_subject "${normalized}")"
    note="$(format_change_line "${category}" "${normalized}")"
    if [[ -n "${note}" ]]; then
      notes+=("${note}")
    fi
  done

  if [[ ${#notes[@]} -eq 0 ]]; then
    mapfile -t notes < <(build_diff_based_notes "${previous_version}" || true)
  fi

  if [[ ${#notes[@]} -eq 0 ]]; then
    printf -- '- %s\n' "${AUTO_FALLBACK_NOTE}"
    return
  fi

  printf '%s\n' "${notes[@]}"
}

PREVIOUS_VERSION="$(previous_changes_version "${VERSION}")"

if [[ -z "${AUTO_NOTES:-}" ]]; then
  AUTO_NOTES="$(build_auto_notes "${PREVIOUS_VERSION}")"
  if [[ -z "${AUTO_NOTES}" ]]; then
    AUTO_NOTES="- ${AUTO_FALLBACK_NOTE}"
  fi
fi

TMP_FILE="$(mktemp)"
trap 'rm -f "${TMP_FILE}"' EXIT

awk -v version="${VERSION}" -v notes="${AUTO_NOTES}" '
  BEGIN {
    inserted = 0
    notes_count = split(notes, notes_lines, /\n/)
  }
  {
    print
    if (!inserted && $0 ~ /<CHANGES>/) {
      print ""
      print "###" version
      for (idx = 1; idx <= notes_count; idx++) {
        if (notes_lines[idx] != "") {
          print notes_lines[idx]
        }
      }
      print ""
      inserted = 1
    }
  }
' "${PLG_FILE}" > "${TMP_FILE}"

mv "${TMP_FILE}" "${PLG_FILE}"
echo "Inserted CHANGES entry for ${VERSION}"
