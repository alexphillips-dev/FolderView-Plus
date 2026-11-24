#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLG_FILE="${ROOT_DIR}/folderview.plus.plg"

# shellcheck source=scripts/lib.sh
source "${ROOT_DIR}/scripts/lib.sh"

fvplus::require_commands curl sed head mktemp sleep tr cmp sha256sum md5sum

if [[ ! -f "${PLG_FILE}" ]]; then
  fvplus::fail "Missing plugin manifest: ${PLG_FILE}"
fi

VERSION="$(fvplus::read_plg_version "${PLG_FILE}")"
NAME_ENTITY="$(fvplus::parse_plg_entity name "${PLG_FILE}")"
GITHUB_ENTITY="$(fvplus::parse_plg_entity github "${PLG_FILE}")"
PLUGIN_URL_TEMPLATE="$(fvplus::parse_plg_entity pluginURL "${PLG_FILE}")"
ARCHIVE_URL_TEMPLATE="$(sed -n 's|.*<URL>\(https://raw.githubusercontent.com/&github;/[^<]*/archive/&name;-&version;.txz\)</URL>.*|\1|p' "${PLG_FILE}" | head -n 1 || true)"
CORE_SHA256="$(fvplus::parse_plg_entity sha256 "${PLG_FILE}")"
CORE_MD5="$(fvplus::parse_plg_entity md5 "${PLG_FILE}")"
ICON_PACK_VERSION="$(fvplus::parse_plg_entity iconPackVersion "${PLG_FILE}")"
ICON_PACK_URL_TEMPLATE="$(fvplus::parse_plg_entity iconPackURL "${PLG_FILE}")"
ICON_PACK_SHA256="$(fvplus::parse_plg_entity iconPackSha256 "${PLG_FILE}")"
ICON_PACK_MD5="$(fvplus::parse_plg_entity iconPackMd5 "${PLG_FILE}")"
ARCHIVE_FILE="$(fvplus::archive_file "${ROOT_DIR}" "${VERSION}")"
CHECKSUM_FILE="${ARCHIVE_FILE}.sha256"
ATTEMPTS_RAW="${FVPLUS_REMOTE_PUBLISH_ATTEMPTS:-12}"
DELAY_SEC_RAW="${FVPLUS_REMOTE_PUBLISH_DELAY_SEC:-5}"

if [[ -z "${NAME_ENTITY}" || -z "${GITHUB_ENTITY}" || -z "${PLUGIN_URL_TEMPLATE}" || -z "${ARCHIVE_URL_TEMPLATE}" || -z "${ICON_PACK_URL_TEMPLATE}" ]]; then
  fvplus::fail "Could not parse required manifest entities for remote publish validation."
fi

if [[ ! "${CORE_SHA256}" =~ ^[a-f0-9]{64}$ || ! "${ICON_PACK_SHA256}" =~ ^[a-f0-9]{64}$ \
   || ! "${CORE_MD5}" =~ ^[a-f0-9]{32}$ || ! "${ICON_PACK_MD5}" =~ ^[a-f0-9]{32}$ \
   || ! "${ICON_PACK_VERSION}" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  fvplus::fail "Invalid archive version or checksums in the local plugin manifest."
fi

if [[ ! -f "${ARCHIVE_FILE}" ]]; then
  fvplus::fail "Missing archive for remote publish validation: ${ARCHIVE_FILE}"
fi

if [[ ! -f "${CHECKSUM_FILE}" ]]; then
  fvplus::fail "Missing checksum for remote publish validation: ${CHECKSUM_FILE}"
fi

if ! [[ "${ATTEMPTS_RAW}" =~ ^[0-9]+$ ]] || [[ "${ATTEMPTS_RAW}" -lt 1 ]]; then
  fvplus::fail "FVPLUS_REMOTE_PUBLISH_ATTEMPTS must be a positive integer."
fi

if ! [[ "${DELAY_SEC_RAW}" =~ ^[0-9]+$ ]] || [[ "${DELAY_SEC_RAW}" -lt 0 ]]; then
  fvplus::fail "FVPLUS_REMOTE_PUBLISH_DELAY_SEC must be a non-negative integer."
fi

expand_manifest_url() {
  local template="$1"
  local expanded="${template}"
  expanded="${expanded//&github;/${GITHUB_ENTITY}}"
  expanded="${expanded//&name;/${NAME_ENTITY}}"
  expanded="${expanded//&version;/${VERSION}}"
  expanded="${expanded//&iconPackVersion;/${ICON_PACK_VERSION}}"
  printf '%s\n' "${expanded}"
}

normalize_checksum_line() {
  tr -d '\r' | sed -e 's/[[:space:]]\+/ /g' -e 's/^ //' -e 's/ $//'
}

fetch_once() {
  local url="$1"
  local dest="$2"
  if ! curl -fsSL --connect-timeout 20 --max-time 60 "${url}" -o "${dest}"; then
    return 1
  fi
  return 0
}

archive_matches() {
  local path="$1" expected_sha256="$2" expected_md5="$3"
  printf '%s  %s\n' "${expected_sha256}" "${path}" | sha256sum --check --status \
    && printf '%s  %s\n' "${expected_md5}" "${path}" | md5sum --check --status
}

LOCAL_CHECKSUM_LINE="$(normalize_checksum_line < "${CHECKSUM_FILE}" | head -n 1)"
if [[ "${LOCAL_CHECKSUM_LINE%% *}" != "${CORE_SHA256}" ]]; then
  fvplus::fail "Local core archive checksum file disagrees with the plugin manifest."
fi

TMP_BASE_DIR="${ROOT_DIR}/tmp"
mkdir -p "${TMP_BASE_DIR}"
TMP_DIR="$(mktemp -d "${TMP_BASE_DIR}/remote-publish.XXXXXX")"
cleanup_tmpdir() {
  rm -rf "${TMP_DIR}"
}
trap cleanup_tmpdir EXIT

REMOTE_PLG_FILE="${TMP_DIR}/folderview.plus.plg"
REMOTE_CHECKSUM_FILE="${TMP_DIR}/folderview.plus.txz.sha256"
REMOTE_ARCHIVE_FILE="${TMP_DIR}/folderview.plus.txz"
REMOTE_ICON_PACK_FILE="${TMP_DIR}/folderview.plus-icons.txz"
PLUGIN_URL="$(expand_manifest_url "${PLUGIN_URL_TEMPLATE}")"
ARCHIVE_URL="$(expand_manifest_url "${ARCHIVE_URL_TEMPLATE}")"
CHECKSUM_URL="${ARCHIVE_URL}.sha256"
ICON_PACK_URL="$(expand_manifest_url "${ICON_PACK_URL_TEMPLATE}")"

echo "Remote publish guard: version=${VERSION}"
echo "Remote publish guard: manifest=${PLUGIN_URL}"
echo "Remote publish guard: archive=${ARCHIVE_URL}"
echo "Remote publish guard: icon pack=${ICON_PACK_URL}"

attempt=1
while [[ "${attempt}" -le "${ATTEMPTS_RAW}" ]]; do
  if ! fetch_once "${PLUGIN_URL}" "${REMOTE_PLG_FILE}"; then
    attempt_state="manifest unavailable"
  elif ! cmp -s "${PLG_FILE}" "${REMOTE_PLG_FILE}"; then
    attempt_state="published manifest differs from the checked-out manifest"
  elif ! fetch_once "${ARCHIVE_URL}" "${REMOTE_ARCHIVE_FILE}"; then
    attempt_state="archive unavailable"
  elif ! fetch_once "${CHECKSUM_URL}" "${REMOTE_CHECKSUM_FILE}"; then
    attempt_state="checksum unavailable"
  elif [[ "$(normalize_checksum_line < "${REMOTE_CHECKSUM_FILE}" | head -n 1)" != "${LOCAL_CHECKSUM_LINE}" ]]; then
    attempt_state="published checksum file stale or mismatched"
  elif ! archive_matches "${REMOTE_ARCHIVE_FILE}" "${CORE_SHA256}" "${CORE_MD5}"; then
    attempt_state="published archive bytes stale or mismatched"
  elif ! fetch_once "${ICON_PACK_URL}" "${REMOTE_ICON_PACK_FILE}"; then
    attempt_state="icon pack unavailable"
  elif ! archive_matches "${REMOTE_ICON_PACK_FILE}" "${ICON_PACK_SHA256}" "${ICON_PACK_MD5}"; then
    attempt_state="published icon pack bytes stale or mismatched"
  else
    echo "Remote publish guard passed: raw manifest, core archive, core checksum, and icon pack match ${VERSION}."
    exit 0
  fi

  if [[ "${attempt}" -eq "${ATTEMPTS_RAW}" ]]; then
    fvplus::fail "Remote publish guard did not observe the expected release artifacts after ${ATTEMPTS_RAW} attempt(s): ${attempt_state}."
  fi
  echo "Remote publish artifacts not ready yet (${attempt_state}; attempt ${attempt}/${ATTEMPTS_RAW}); retrying in ${DELAY_SEC_RAW}s..." >&2
  sleep "${DELAY_SEC_RAW}"
  attempt=$((attempt + 1))
done
