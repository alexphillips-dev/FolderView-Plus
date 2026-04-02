#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLG_FILE="${ROOT_DIR}/folderview.plus.plg"
MAX_AUTO_LINES="${FVPLUS_AUTO_CHANGE_LINES:-6}"
AUTO_FALLBACK_NOTE='Maintenance: Release metadata and packaging sync.'
# shellcheck source=scripts/lib.sh
source "${ROOT_DIR}/scripts/lib.sh"

if [[ ! -f "${PLG_FILE}" ]]; then
  fvplus::fail "Missing plugin manifest: ${PLG_FILE}"
fi

VERSION="$(fvplus::read_plg_version "${PLG_FILE}")"

if grep -q "^###${VERSION}$" "${PLG_FILE}"; then
  echo "CHANGES entry already present for ${VERSION}"
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
    return
  fi

  if [[ -n "${previous_version}" ]] && git -C "${ROOT_DIR}" rev-parse -q --verify "refs/tags/v${previous_version}^{tag}" >/dev/null 2>&1; then
    printf 'v%s\n' "${previous_version}"
    return
  fi

  if [[ -n "${previous_version}" ]]; then
    anchor_ref="$(git -C "${ROOT_DIR}" log --no-merges --format=%H -S "###${previous_version}" -- "${PLG_FILE}" | head -n 1 || true)"
  fi

  if [[ -n "${anchor_ref}" ]]; then
    printf '%s\n' "${anchor_ref}"
  fi
}

collect_changed_files() {
  local previous_version="${1:-}"
  local anchor_ref=""
  local range=""

  if ! command -v git >/dev/null 2>&1 || ! git -C "${ROOT_DIR}" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    return
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
    README.md|docs/*|CHANGELOG-fixes.md|SECURITY.md|SUPPORT*.md|CONTRIBUTING.md|src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/README.md)
      printf '%s\n' "docs"
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
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.utils.js|\
    src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/runtime.column-layout.js|\
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
    docker-runtime
    vm-runtime
    dashboard
    folder-editor
    settings-workspace
    settings-diagnostics
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
    return
  fi

  mapfile -t changed_files < <(collect_changed_files "${previous_version}" || true)

  if [[ ${#changed_files[@]} -eq 0 ]]; then
    return
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
    return
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

PREVIOUS_VERSION="$(awk '
  /<CHANGES>/ { in_changes = 1; next }
  in_changes && /^###/ {
    gsub(/^###/, "", $0)
    print
    exit
  }
' "${PLG_FILE}")"

AUTO_NOTES="$(build_auto_notes "${PREVIOUS_VERSION}")"
if [[ -z "${AUTO_NOTES}" ]]; then
  AUTO_NOTES="- ${AUTO_FALLBACK_NOTE}"
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
