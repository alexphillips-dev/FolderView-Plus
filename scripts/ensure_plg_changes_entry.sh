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

build_diff_based_notes() {
  local -a changed_files=()
  local -a notes=()
  local has_ui=0
  local has_backend=0
  local has_quality=0
  local has_docs=0

  if ! command -v git >/dev/null 2>&1 || ! git -C "${ROOT_DIR}" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    return
  fi

  mapfile -t changed_files < <(
    {
      git -C "${ROOT_DIR}" diff --name-only --relative HEAD -- .
      git -C "${ROOT_DIR}" ls-files --others --exclude-standard
    } | sed '/^[[:space:]]*$/d' | sort -u
  )

  if [[ ${#changed_files[@]} -eq 0 ]]; then
    return
  fi

  for changed in "${changed_files[@]}"; do
    case "${changed}" in
      src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/*|\
      src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/*.page|\
      src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/*.js)
        has_ui=1
        ;;
    esac
    case "${changed}" in
      src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/*)
        has_backend=1
        ;;
    esac
    case "${changed}" in
      tests/*|scripts/*|.github/workflows/*|.githooks/*)
        has_quality=1
        ;;
    esac
    case "${changed}" in
      README.md|CHANGELOG-fixes.md|SECURITY.md|SUPPORT.md|CONTRIBUTING.md)
        has_docs=1
        ;;
    esac
  done

  if (( has_ui )); then
    notes+=("- UX: Refined settings and on-screen update messaging for clarity and consistency.")
  fi
  if (( has_backend )); then
    notes+=("- Fix: Improved backend release-note parsing and category detection for accurate summaries.")
  fi
  if (( has_quality )); then
    notes+=("- Quality: Strengthened release automation and regression guards to prevent note drift.")
  fi
  if (( has_docs )); then
    notes+=("- Docs: Updated project documentation to match the latest behavior.")
  fi

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

  if command -v git >/dev/null 2>&1 && git -C "${ROOT_DIR}" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    if [[ -n "${previous_version}" ]] && git -C "${ROOT_DIR}" rev-parse -q --verify "refs/tags/v${previous_version}^{tag}" >/dev/null 2>&1; then
      anchor_ref="v${previous_version}"
    elif [[ -n "${previous_version}" ]]; then
      anchor_ref="$(git -C "${ROOT_DIR}" log --no-merges --format=%H -S "###${previous_version}" -- "${PLG_FILE}" | head -n 1 || true)"
    fi
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
    mapfile -t notes < <(build_diff_based_notes || true)
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
    mapfile -t notes < <(build_diff_based_notes || true)
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
