#!/usr/bin/env bash

FVPLUS_SHIPPED_PATHS=(src/folderview.plus/ folderview.plus.plg folderview.plus.xml)

fvplus::fail() {
  echo "ERROR: $*" >&2
  exit 1
}

fvplus::copy_indexed_package_source() (
  local repository="$1" destination="$2" filter="${3:-}" package_root file
  repository="$(cd "${repository}" && pwd -P)" || exit 1
  package_root="${repository}/src/folderview.plus"
  [[ "$(realpath -e -- "${package_root}")" == "${package_root}" ]] \
    || fvplus::fail 'The package source directory must be inside the checkout.'
  [[ -z "$(git -C "${repository}" ls-files --unmerged -- "${FVPLUS_SHIPPED_PATHS[0]}")" ]] \
    || fvplus::fail 'Resolve source conflicts before building the package.'
  cd "${package_root}" || exit 1
  git -C "${repository}" ls-files -z --error-unmatch -- "${FVPLUS_SHIPPED_PATHS[0]}" |
    while IFS= read -r -d '' file; do
      file="./${file#"${FVPLUS_SHIPPED_PATHS[0]}"}"
      if [[ -n "${filter}" ]] && ! "${filter}" "${file}"; then continue; fi
      [[ -f "${file}" && "$(realpath -e -- "${file}")" == "${package_root}/${file#./}" ]] \
        || fvplus::fail "The indexed package source is missing or redirected: ${file}"
      cp --parents -f -- "${file}" "${destination}/" || exit 1
    done
)

fvplus::resolve_platform_command() {
  local requested="${1:-}"
  local resolved=""
  [[ -n "${requested}" ]] || return 1
  if resolved="$(command -v "${requested}" 2>/dev/null)"; then
    printf '%s\n' "${resolved}"
    return 0
  fi
  if [[ "${requested}" != *.exe ]] && resolved="$(command -v "${requested}.exe" 2>/dev/null)"; then
    printf '%s\n' "${resolved}"
    return 0
  fi
  return 1
}

fvplus::path_for_command() {
  local command_path="${1:-}"
  local target_path="${2:-}"
  local normalized_path=""
  local translate_for_windows_runtime=1
  [[ -n "${target_path}" ]] || return 1
  translate_for_windows_runtime=0
  if [[ "${command_path}" == *.exe ]] || [[ "${command_path}" == *fvplus-bash-shims/* ]]; then
    translate_for_windows_runtime=1
  fi
  if [[ "${translate_for_windows_runtime}" -eq 1 ]] && command -v wslpath >/dev/null 2>&1; then
    normalized_path="${target_path}"
    if [[ "${normalized_path}" =~ ^[A-Za-z]:[\\/].* ]]; then
      printf '%s\n' "${normalized_path//\//\\}"
      return 0
    fi
    if [[ "${normalized_path}" != /* && ! "${normalized_path}" =~ ^[A-Za-z]:[\\/].* ]]; then
      normalized_path="$(realpath -m "${normalized_path}" 2>/dev/null || printf '%s/%s' "$(pwd)" "${normalized_path}")"
    fi
    wslpath -w "${normalized_path}"
    return 0
  fi
  printf '%s\n' "${target_path}"
}

fvplus::require_commands() {
  local missing=()
  local cmd
  for cmd in "$@"; do
    if ! fvplus::resolve_platform_command "$cmd" >/dev/null 2>&1; then
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
