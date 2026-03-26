#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLG_FILE="${ROOT_DIR}/folderview.plus.plg"

# shellcheck source=scripts/lib.sh
source "${ROOT_DIR}/scripts/lib.sh"

fvplus::require_commands curl sed awk grep head mktemp sleep tr basename

if [[ ! -f "${PLG_FILE}" ]]; then
  fvplus::fail "Missing plugin manifest: ${PLG_FILE}"
fi

VERSION="$(fvplus::read_plg_version "${PLG_FILE}")"
NAME_ENTITY="$(fvplus::parse_plg_entity name "${PLG_FILE}")"
GITHUB_ENTITY="$(fvplus::parse_plg_entity github "${PLG_FILE}")"
PLUGIN_URL_TEMPLATE="$(fvplus::parse_plg_entity pluginURL "${PLG_FILE}")"
ARCHIVE_URL_TEMPLATE="$(sed -n 's|.*<URL>\(https://raw.githubusercontent.com/&github;/[^<]*/archive/&name;-&version;.txz\)</URL>.*|\1|p' "${PLG_FILE}" | head -n 1 || true)"
ARCHIVE_FILE="$(fvplus::archive_file "${ROOT_DIR}" "${VERSION}")"
CHECKSUM_FILE="${ARCHIVE_FILE}.sha256"
ATTEMPTS_RAW="${FVPLUS_REMOTE_PUBLISH_ATTEMPTS:-12}"
DELAY_SEC_RAW="${FVPLUS_REMOTE_PUBLISH_DELAY_SEC:-5}"

if [[ -z "${NAME_ENTITY}" || -z "${GITHUB_ENTITY}" || -z "${PLUGIN_URL_TEMPLATE}" || -z "${ARCHIVE_URL_TEMPLATE}" ]]; then
  fvplus::fail "Could not parse required manifest entities for remote publish validation."
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
  printf '%s\n' "${expanded}"
}

normalize_checksum_line() {
  tr -d '\r' | sed -e 's/[[:space:]]\+/ /g' -e 's/^ //' -e 's/ $//'
}

fetch_with_retry() {
  local url="$1"
  local dest="$2"
  local label="$3"
  local attempt=1
  while [[ "${attempt}" -le "${ATTEMPTS_RAW}" ]]; do
    if curl -fsSL --connect-timeout 20 --max-time 60 "${url}" -o "${dest}"; then
      return 0
    fi
    if [[ "${attempt}" -eq "${ATTEMPTS_RAW}" ]]; then
      fvplus::fail "Could not fetch remote ${label} after ${ATTEMPTS_RAW} attempt(s): ${url}"
    fi
    echo "Remote ${label} not ready yet (attempt ${attempt}/${ATTEMPTS_RAW}); retrying in ${DELAY_SEC_RAW}s..." >&2
    sleep "${DELAY_SEC_RAW}"
    attempt=$((attempt + 1))
  done
}

probe_with_retry() {
  local url="$1"
  local label="$2"
  local attempt=1
  while [[ "${attempt}" -le "${ATTEMPTS_RAW}" ]]; do
    if curl -fsSI -L --connect-timeout 20 --max-time 60 "${url}" >/dev/null; then
      return 0
    fi
    if [[ "${attempt}" -eq "${ATTEMPTS_RAW}" ]]; then
      fvplus::fail "Could not reach remote ${label} after ${ATTEMPTS_RAW} attempt(s): ${url}"
    fi
    echo "Remote ${label} not ready yet (attempt ${attempt}/${ATTEMPTS_RAW}); retrying in ${DELAY_SEC_RAW}s..." >&2
    sleep "${DELAY_SEC_RAW}"
    attempt=$((attempt + 1))
  done
}

TMP_DIR="$(mktemp -d "${ROOT_DIR}/tmp/remote-publish.XXXXXX")"
cleanup_tmpdir() {
  rm -rf "${TMP_DIR}"
}
trap cleanup_tmpdir EXIT

REMOTE_PLG_FILE="${TMP_DIR}/folderview.plus.plg"
REMOTE_CHECKSUM_FILE="${TMP_DIR}/folderview.plus.txz.sha256"
PLUGIN_URL="$(expand_manifest_url "${PLUGIN_URL_TEMPLATE}")"
ARCHIVE_URL="$(expand_manifest_url "${ARCHIVE_URL_TEMPLATE}")"
CHECKSUM_URL="${ARCHIVE_URL}.sha256"

echo "Remote publish guard: version=${VERSION}"
echo "Remote publish guard: manifest=${PLUGIN_URL}"
echo "Remote publish guard: archive=${ARCHIVE_URL}"

fetch_with_retry "${PLUGIN_URL}" "${REMOTE_PLG_FILE}" "plugin manifest"
probe_with_retry "${ARCHIVE_URL}" "archive"
fetch_with_retry "${CHECKSUM_URL}" "${REMOTE_CHECKSUM_FILE}" "archive checksum"

REMOTE_VERSION="$(fvplus::read_plg_version "${REMOTE_PLG_FILE}")"
REMOTE_PLUGIN_URL_TEMPLATE="$(fvplus::parse_plg_entity pluginURL "${REMOTE_PLG_FILE}")"
REMOTE_ARCHIVE_URL_TEMPLATE="$(sed -n 's|.*<URL>\(https://raw.githubusercontent.com/&github;/[^<]*/archive/&name;-&version;.txz\)</URL>.*|\1|p' "${REMOTE_PLG_FILE}" | head -n 1 || true)"
LOCAL_CHECKSUM_LINE="$(normalize_checksum_line < "${CHECKSUM_FILE}" | head -n 1)"
REMOTE_CHECKSUM_LINE="$(normalize_checksum_line < "${REMOTE_CHECKSUM_FILE}" | head -n 1)"

if [[ "${REMOTE_VERSION}" != "${VERSION}" ]]; then
  fvplus::fail "Remote manifest version mismatch. expected=${VERSION} found=${REMOTE_VERSION}"
fi

if [[ "${REMOTE_PLUGIN_URL_TEMPLATE}" != "${PLUGIN_URL_TEMPLATE}" ]]; then
  fvplus::fail "Remote manifest pluginURL mismatch. expected=${PLUGIN_URL_TEMPLATE} found=${REMOTE_PLUGIN_URL_TEMPLATE}"
fi

if [[ "${REMOTE_ARCHIVE_URL_TEMPLATE}" != "${ARCHIVE_URL_TEMPLATE}" ]]; then
  fvplus::fail "Remote manifest archive URL mismatch. expected=${ARCHIVE_URL_TEMPLATE} found=${REMOTE_ARCHIVE_URL_TEMPLATE}"
fi

if [[ "${REMOTE_CHECKSUM_LINE}" != "${LOCAL_CHECKSUM_LINE}" ]]; then
  fvplus::fail "Remote checksum mismatch. expected=${LOCAL_CHECKSUM_LINE} found=${REMOTE_CHECKSUM_LINE}"
fi

echo "Remote publish guard passed: remote raw manifest, archive, and checksum match ${VERSION}."
