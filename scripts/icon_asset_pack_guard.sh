#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLG_FILE="${ROOT_DIR}/folderview.plus.plg"
VERSION_FILE="${ROOT_DIR}/asset-packs/icon-pack.version"
SOURCE_DIR="${ROOT_DIR}/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/images/third-party-icons"

read_entity() {
  local entity_name="${1:-}"
  sed -n 's/^<!ENTITY '"${entity_name}"' "\([^"]*\)".*/\1/p' "${PLG_FILE}" | head -n 1
}

if [[ ! -f "${PLG_FILE}" || ! -f "${VERSION_FILE}" || ! -d "${SOURCE_DIR}" ]]; then
  echo "ERROR: Icon asset-pack guard is missing the manifest, version file, or source directory." >&2
  exit 1
fi

VERSION="$(tr -d '[:space:]' < "${VERSION_FILE}")"
MANIFEST_VERSION="$(read_entity iconPackVersion)"
MANIFEST_MD5="$(read_entity iconPackMd5)"
MANIFEST_SHA256="$(read_entity iconPackSha256)"
MANIFEST_URL="$(read_entity iconPackURL)"
ARCHIVE_NAME="folderview.plus-icons-${VERSION}.txz"
ARCHIVE_PATH="${ROOT_DIR}/asset-packs/${ARCHIVE_NAME}"
SHA256_PATH="${ARCHIVE_PATH}.sha256"

if [[ ! "${VERSION}" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "ERROR: Invalid icon asset-pack version: ${VERSION}" >&2
  exit 1
fi
if [[ "${MANIFEST_VERSION}" != "${VERSION}" ]]; then
  echo "ERROR: PLG iconPackVersion does not match asset-packs/icon-pack.version." >&2
  exit 1
fi
if [[ ! "${MANIFEST_MD5}" =~ ^[a-f0-9]{32}$ || ! "${MANIFEST_SHA256}" =~ ^[a-f0-9]{64}$ ]]; then
  echo "ERROR: PLG icon asset-pack checksum entities are missing or invalid." >&2
  exit 1
fi
if [[ "${MANIFEST_URL}" != *"/asset-packs/folderview.plus-icons-&iconPackVersion;.txz" ]]; then
  echo "ERROR: PLG iconPackURL is not version-pinned to the asset-packs directory." >&2
  exit 1
fi
if [[ ! -f "${ARCHIVE_PATH}" || ! -f "${SHA256_PATH}" ]]; then
  echo "ERROR: Missing icon asset-pack archive or SHA256 sidecar for ${VERSION}." >&2
  exit 1
fi

ACTUAL_MD5="$(md5sum "${ARCHIVE_PATH}" | awk '{print $1}')"
ACTUAL_SHA256="$(sha256sum "${ARCHIVE_PATH}" | awk '{print $1}')"
SIDECAR_SHA256="$(awk 'NR == 1 {print $1}' "${SHA256_PATH}")"
if [[ "${ACTUAL_MD5}" != "${MANIFEST_MD5}" ]]; then
  echo "ERROR: Icon asset-pack MD5 does not match the PLG entity." >&2
  exit 1
fi
if [[ "${ACTUAL_SHA256}" != "${MANIFEST_SHA256}" || "${SIDECAR_SHA256}" != "${ACTUAL_SHA256}" ]]; then
  echo "ERROR: Icon asset-pack SHA256 does not match the PLG entity and sidecar." >&2
  exit 1
fi

ARCHIVE_LIST="$(tar -tf "${ARCHIVE_PATH}")"
if grep -Eq '(^/|(^|/)\.\.(/|$))' <<< "${ARCHIVE_LIST}"; then
  echo "ERROR: Icon asset pack contains an unsafe path." >&2
  exit 1
fi
INVALID_ENTRIES="$(printf '%s\n' "${ARCHIVE_LIST}" | grep -Ev '^(asset-pack\.json|third-party-icons/?|third-party-icons/.*/|third-party-icons/.*\.(png|jpg|jpeg|gif|webp|svg|bmp|ico|avif))$' || true)"
if [[ -n "${INVALID_ENTRIES}" ]]; then
  echo "ERROR: Icon asset pack contains unsupported entries:" >&2
  printf '%s\n' "${INVALID_ENTRIES}" >&2
  exit 1
fi

PACK_MANIFEST="$(tar -xOf "${ARCHIVE_PATH}" asset-pack.json)"
PACK_VERSION="$(sed -n 's/.*"version": "\([^"]*\)".*/\1/p' <<< "${PACK_MANIFEST}" | head -n 1)"
PACK_FILE_COUNT="$(sed -n 's/.*"fileCount": \([0-9][0-9]*\).*/\1/p' <<< "${PACK_MANIFEST}" | head -n 1)"
PACK_SOURCE_BYTES="$(sed -n 's/.*"sourceBytes": \([0-9][0-9]*\).*/\1/p' <<< "${PACK_MANIFEST}" | head -n 1)"
PACK_CONTENT_SHA256="$(sed -n 's/.*"contentSha256": "\([a-f0-9]*\)".*/\1/p' <<< "${PACK_MANIFEST}" | head -n 1)"
SOURCE_FILE_COUNT="$(find "${SOURCE_DIR}" -type f | grep -Eic '\.(png|jpg|jpeg|gif|webp|svg|bmp|ico|avif)$' || true)"
SOURCE_BYTES="$(find "${SOURCE_DIR}" -type f -printf '%p\t%s\n' | grep -Ei '\.(png|jpg|jpeg|gif|webp|svg|bmp|ico|avif)[[:space:]]' | awk '{sum += $NF} END {print sum + 0}')"
SOURCE_CONTENT_SHA256="$({
  cd "${SOURCE_DIR}"
  while IFS= read -r -d '' icon_file; do
    extension="${icon_file##*.}"
    extension="${extension,,}"
    case "${extension}" in
      png|jpg|jpeg|gif|webp|svg|bmp|ico|avif) sha256sum "${icon_file}" ;;
    esac
  done < <(find . -type f -print0 | sort -z)
} | sha256sum | awk '{print $1}')"
ARCHIVE_ICON_COUNT="$(printf '%s\n' "${ARCHIVE_LIST}" | grep -Ec '^third-party-icons/.*\.(png|jpg|jpeg|gif|webp|svg|bmp|ico|avif)$' || true)"

if [[ "${PACK_VERSION}" != "${VERSION}" ]]; then
  echo "ERROR: Embedded icon asset-pack version does not match ${VERSION}." >&2
  exit 1
fi
if [[ "${PACK_FILE_COUNT}" != "${SOURCE_FILE_COUNT}" || "${ARCHIVE_ICON_COUNT}" != "${SOURCE_FILE_COUNT}" ]]; then
  echo "ERROR: Icon asset-pack file count does not match the source library." >&2
  exit 1
fi
if [[ "${PACK_SOURCE_BYTES}" != "${SOURCE_BYTES}" ]]; then
  echo "ERROR: Icon asset-pack byte count does not match the source library." >&2
  exit 1
fi
if [[ "${PACK_CONTENT_SHA256}" != "${SOURCE_CONTENT_SHA256}" ]]; then
  echo "ERROR: Icon source changed without rebuilding or versioning the asset pack." >&2
  exit 1
fi

echo "Icon asset-pack guard passed: version=${VERSION}, files=${SOURCE_FILE_COUNT}, bytes=${SOURCE_BYTES}, sha256=${ACTUAL_SHA256}."
