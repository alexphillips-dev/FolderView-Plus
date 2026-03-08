#!/usr/bin/env bash

fvplus::fail() {
  echo "ERROR: $*" >&2
  exit 1
}

fvplus::require_commands() {
  local missing=()
  local cmd
  for cmd in "$@"; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
      missing+=("$cmd")
    fi
  done
  if [[ ${#missing[@]} -gt 0 ]]; then
    fvplus::fail "Missing required commands: ${missing[*]}"
  fi
}

fvplus::parse_plg_entity() {
  local entity_name="${1:-}"
  local plg_file="${2:-}"
  sed -n "s/^<!ENTITY ${entity_name} \"\\([^\"]*\\)\".*/\\1/p" "${plg_file}" | head -n 1 || true
}

fvplus::read_plg_version() {
  local plg_file="${1:-}"
  local version=""
  version="$(fvplus::parse_plg_entity version "${plg_file}")"
  if [[ -z "${version}" ]]; then
    fvplus::fail "Could not parse version from ${plg_file}"
  fi
  echo "${version}"
}

fvplus::archive_dir() {
  local root_dir="${1:-}"
  echo "${FVPLUS_ARCHIVE_DIR:-${root_dir}/archive}"
}

fvplus::archive_file() {
  local root_dir="${1:-}"
  local version="${2:-}"
  local archive_dir=""
  archive_dir="$(fvplus::archive_dir "${root_dir}")"
  echo "${archive_dir}/folderview.plus-${version}.txz"
}

