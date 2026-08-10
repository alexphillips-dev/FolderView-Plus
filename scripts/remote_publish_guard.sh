#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLG_FILE="${ROOT_DIR}/folderview.plus.plg"

# shellcheck source=scripts/lib.sh
source "${ROOT_DIR}/scripts/lib.sh"

fvplus::require_commands curl sed awk grep head mktemp sleep tr basename sha256sum

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

fetch_once() {
  local url="$1"
  local dest="$2"
  if ! curl -fsSL --connect-timeout 20 --max-time 60 "${url}" -o "${dest}"; then
    return 1
  fi
  return 0
}

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
PLUGIN_URL="$(expand_manifest_url "${PLUGIN_URL_TEMPLATE}")"
ARCHIVE_URL="$(expand_manifest_url "${ARCHIVE_URL_TEMPLATE}")"
CHECKSUM_URL="${ARCHIVE_URL}.sha256"
# archive checksum
# Remote manifest version mismatch.
# Remote manifest pluginURL mismatch.
# Remote manifest archive URL mismatch.
# Remote checksum mismatch.

echo "Remote publish guard: version=${VERSION}"
echo "Remote publish guard: manifest=${PLUGIN_URL}"
echo "Remote publish guard: archive=${ARCHIVE_URL}"

LOCAL_CHECKSUM_LINE="$(normalize_checksum_line < "${CHECKSUM_FILE}" | head -n 1)"
attempt=1
while [[ "${attempt}" -le "${ATTEMPTS_RAW}" ]]; do
  attempt_state="unknown"
  if ! fetch_once "${PLUGIN_URL}" "${REMOTE_PLG_FILE}"; then
    attempt_state="manifest unavailable"
  elif ! fetch_once "${ARCHIVE_URL}" "${REMOTE_ARCHIVE_FILE}"; then
    attempt_state="archive unavailable"
  elif ! fetch_once "${CHECKSUM_URL}" "${REMOTE_CHECKSUM_FILE}"; then
    attempt_state="checksum unavailable"
  else
    REMOTE_VERSION="$(fvplus::read_plg_version "${REMOTE_PLG_FILE}")"
    REMOTE_PLUGIN_URL_TEMPLATE="$(fvplus::parse_plg_entity pluginURL "${REMOTE_PLG_FILE}")"
    REMOTE_ARCHIVE_URL_TEMPLATE="$(sed -n 's|.*<URL>\(https://raw.githubusercontent.com/&github;/[^<]*/archive/&name;-&version;.txz\)</URL>.*|\1|p' "${REMOTE_PLG_FILE}" | head -n 1 || true)"
    REMOTE_CHECKSUM_LINE="$(normalize_checksum_line < "${REMOTE_CHECKSUM_FILE}" | head -n 1)"
    REMOTE_ARCHIVE_SHA256="$(sha256sum "${REMOTE_ARCHIVE_FILE}" | awk '{print $1}')"
    LOCAL_ARCHIVE_SHA256="$(awk 'NR == 1 { print $1 }' "${CHECKSUM_FILE}")"

    if [[ "${REMOTE_VERSION}" != "${VERSION}" ]]; then
      attempt_state="manifest version stale (${REMOTE_VERSION:-unknown})"
    elif [[ "${REMOTE_PLUGIN_URL_TEMPLATE}" != "${PLUGIN_URL_TEMPLATE}" ]]; then
      attempt_state="manifest plugin URL mismatch"
    elif [[ "${REMOTE_ARCHIVE_URL_TEMPLATE}" != "${ARCHIVE_URL_TEMPLATE}" ]]; then
      attempt_state="manifest archive URL mismatch"
    elif [[ "${REMOTE_CHECKSUM_LINE}" != "${LOCAL_CHECKSUM_LINE}" ]]; then
      attempt_state="published checksum file stale or mismatched"
    elif [[ "${REMOTE_ARCHIVE_SHA256}" != "${LOCAL_ARCHIVE_SHA256}" ]]; then
      attempt_state="published archive bytes stale or mismatched"
    else
      echo "Remote publish guard passed: remote raw manifest, downloaded archive bytes, and checksum match ${VERSION}."
      exit 0
    fi
  fi

  if [[ "${attempt}" -eq "${ATTEMPTS_RAW}" ]]; then
    fvplus::fail "Remote publish guard did not observe the expected release artifacts after ${ATTEMPTS_RAW} attempt(s)."
  fi
  echo "Remote publish artifacts not ready yet (${attempt_state}; attempt ${attempt}/${ATTEMPTS_RAW}); retrying in ${DELAY_SEC_RAW}s..." >&2
  sleep "${DELAY_SEC_RAW}"
  attempt=$((attempt + 1))
done
