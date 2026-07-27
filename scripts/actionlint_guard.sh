#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib.sh
source "${ROOT_DIR}/scripts/lib.sh"
cd "${ROOT_DIR}"

readonly ACTIONLINT_VERSION="1.7.12"
readonly RELEASE_BASE_URL="https://github.com/rhysd/actionlint/releases/download/v${ACTIONLINT_VERSION}"

fvplus::require_commands curl uname

case "$(uname -s)" in
  Linux*)
    platform="linux"
    archive_extension="tar.gz"
    binary_name="actionlint"
    ;;
  Darwin*)
    platform="darwin"
    archive_extension="tar.gz"
    binary_name="actionlint"
    ;;
  MINGW*|MSYS*|CYGWIN*)
    platform="windows"
    archive_extension="zip"
    binary_name="actionlint.exe"
    ;;
  *)
    fvplus::fail "Unsupported actionlint platform: $(uname -s)"
    ;;
esac

case "$(uname -m)" in
  x86_64|amd64)
    architecture="amd64"
    ;;
  aarch64|arm64)
    architecture="arm64"
    ;;
  *)
    fvplus::fail "Unsupported actionlint architecture: $(uname -m)"
    ;;
esac

archive_name="actionlint_${ACTIONLINT_VERSION}_${platform}_${architecture}.${archive_extension}"
case "${platform}_${architecture}" in
  linux_amd64)
    archive_sha256="8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8"
    ;;
  linux_arm64)
    archive_sha256="325e971b6ba9bfa504672e29be93c24981eeb1c07576d730e9f7c8805afff0c6"
    ;;
  darwin_amd64)
    archive_sha256="5b44c3bc2255115c9b69e30efc0fecdf498fdb63c5d58e17084fd5f16324c644"
    ;;
  darwin_arm64)
    archive_sha256="aba9ced2dee8d27fecca3dc7feb1a7f9a52caefa1eb46f3271ea66b6e0e6953f"
    ;;
  windows_amd64)
    archive_sha256="6e7241b51e6817ea6a047693d8e6fed13b31819c9a0dd6c5a726e1592d22f6e9"
    ;;
  *)
    fvplus::fail "No pinned actionlint checksum for ${platform}_${architecture}."
    ;;
esac

tool_dir="${FVPLUS_TOOL_CACHE_DIR:-${ROOT_DIR}/tmp/tool-cache}/actionlint/${ACTIONLINT_VERSION}/${platform}_${architecture}"
archive_path="${tool_dir}/${archive_name}"
binary_path="${tool_dir}/${binary_name}"
mkdir -p "${tool_dir}"

if [[ ! -x "${binary_path}" ]]; then
  fvplus::require_commands sha256sum
  if [[ ! -f "${archive_path}" ]] ||
      ! printf '%s  %s\n' "${archive_sha256}" "${archive_path}" | sha256sum --check --status; then
    download_path="${archive_path}.download"
    curl --fail --location --silent --show-error \
      "${RELEASE_BASE_URL}/${archive_name}" \
      --output "${download_path}"
    printf '%s  %s\n' "${archive_sha256}" "${download_path}" | sha256sum --check
    mv "${download_path}" "${archive_path}"
  fi

  if [[ "${archive_extension}" == "zip" ]]; then
    fvplus::require_commands unzip
    unzip -oq "${archive_path}" "${binary_name}" -d "${tool_dir}"
  else
    fvplus::require_commands tar
    tar -xzf "${archive_path}" -C "${tool_dir}" "${binary_name}"
  fi
  chmod +x "${binary_path}"
fi

"${binary_path}" -version
"${binary_path}" -no-color
