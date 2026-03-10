#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLG_FILE="${ROOT_DIR}/folderview.plus.plg"
MAX_AUTO_LINES="${FVPLUS_AUTO_CHANGE_LINES:-6}"
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
    feat*|feature*|add*|implement*)
      printf 'Feature'
      ;;
    fix*|bug*|hotfix*|resolve*)
      printf 'Fix'
      ;;
    sec*|security*|hardening*)
      printf 'Security'
      ;;
    perf*|performance*|optimi*|speed*)
      printf 'Performance'
      ;;
    ux*|ui*|style*|polish*)
      printf 'UX'
      ;;
    compat*|compatibility*)
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

build_auto_notes() {
  local previous_version="${1:-}"
  local -a subjects=()
  local -a notes=()
  local note

  if command -v git >/dev/null 2>&1 && git -C "${ROOT_DIR}" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    local range=""
    if [[ -n "${previous_version}" ]] && git -C "${ROOT_DIR}" rev-parse -q --verify "refs/tags/v${previous_version}^{tag}" >/dev/null 2>&1; then
      range="v${previous_version}..HEAD"
    fi
    if [[ -n "${range}" ]]; then
      mapfile -t subjects < <(git -C "${ROOT_DIR}" log --no-merges --pretty=%s "${range}" | sed '/^[[:space:]]*$/d' | head -n "${MAX_AUTO_LINES}")
    else
      mapfile -t subjects < <(git -C "${ROOT_DIR}" log --no-merges -n "${MAX_AUTO_LINES}" --pretty=%s | sed '/^[[:space:]]*$/d')
    fi
  fi

  if [[ ${#subjects[@]} -eq 0 ]]; then
    printf -- '- Maintenance: release metadata and packaging sync.\n'
    return
  fi

  for subject in "${subjects[@]}"; do
    local normalized
    local category
    normalized="$(normalize_subject "${subject}")"
    if [[ -z "${normalized}" ]]; then
      continue
    fi
    category="$(guess_category_from_subject "${normalized}")"
    note="$(format_change_line "${category}" "${normalized}")"
    if [[ -n "${note}" ]]; then
      notes+=("${note}")
    fi
  done

  if [[ ${#notes[@]} -eq 0 ]]; then
    printf -- '- Maintenance: release metadata and packaging sync.\n'
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
  AUTO_NOTES='- Maintenance: release metadata and packaging sync.'
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
