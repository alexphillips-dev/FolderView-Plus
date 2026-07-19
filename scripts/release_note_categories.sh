#!/usr/bin/env bash

if [[ -z "${ROOT_DIR:-}" ]]; then
  ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fi

FVPLUS_RELEASE_NOTE_CATEGORY_FILE="${ROOT_DIR}/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/release-note-categories.json"

fvplus::release_note_categories() {
  if [[ ! -f "${FVPLUS_RELEASE_NOTE_CATEGORY_FILE}" ]]; then
    return 1
  fi
  sed -n 's/^[[:space:]]*{[[:space:]]*"tag"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "${FVPLUS_RELEASE_NOTE_CATEGORY_FILE}"
}

fvplus::is_release_note_category() {
  local candidate="${1:-}"
  local category=""
  while IFS= read -r category; do
    if [[ "${candidate}" == "${category}" ]]; then
      return 0
    fi
  done < <(fvplus::release_note_categories)
  return 1
}

fvplus::release_note_category_list() {
  fvplus::release_note_categories | awk 'BEGIN { first = 1 } { if (!first) printf ", "; printf "%s", $0; first = 0 } END { print "" }'
}

