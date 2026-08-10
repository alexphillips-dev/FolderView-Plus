#!/bin/bash
set -euo pipefail
IFS=$'\n\t'
umask 077

ARCHIVE_PATH="${1:-}"
ARCHIVE_KIND="${2:-icon-pack}"
MAX_ENTRIES="${FVPLUS_ARCHIVE_MAX_ENTRIES:-4096}"
MAX_TOTAL_BYTES="${FVPLUS_ARCHIVE_MAX_TOTAL_BYTES:-536870912}"
MAX_ENTRY_BYTES="${FVPLUS_ARCHIVE_MAX_ENTRY_BYTES:-33554432}"
MAX_DEPTH="${FVPLUS_ARCHIVE_MAX_DEPTH:-16}"

fail() {
    echo "ERROR: $1" >&2
    exit 1
}

case "${ARCHIVE_KIND}" in
    icon-pack) ;;
    *) fail "Unsupported archive profile: ${ARCHIVE_KIND}" ;;
esac

[ -f "${ARCHIVE_PATH}" ] || fail "Archive is missing."
[ ! -L "${ARCHIVE_PATH}" ] || fail "Archive path must not be a symbolic link."
for value in "${MAX_ENTRIES}" "${MAX_TOTAL_BYTES}" "${MAX_ENTRY_BYTES}" "${MAX_DEPTH}"; do
    case "${value}" in
        ''|*[!0-9]*) fail "Archive limit configuration is invalid." ;;
    esac
done

magic="$(od -An -tx1 -N6 "${ARCHIVE_PATH}" | tr -d '[:space:]')"
[ "${magic}" = "fd377a585a00" ] || fail "Archive does not have the required XZ signature."

PREFLIGHT_DIR="$(mktemp -d "/tmp/folderview-plus-archive.XXXXXX")"
cleanup() {
    rm -rf -- "${PREFLIGHT_DIR}"
}
trap cleanup EXIT

ENTRY_LIST="${PREFLIGHT_DIR}/entries.txt"
VERBOSE_LIST="${PREFLIGHT_DIR}/entries.verbose.txt"
LC_ALL=C tar --quoting-style=escape --list --xz --file "${ARCHIVE_PATH}" > "${ENTRY_LIST}" \
    || fail "Archive table of contents could not be read."
LC_ALL=C tar --quoting-style=escape --list --verbose --numeric-owner --full-time --xz --file "${ARCHIVE_PATH}" > "${VERBOSE_LIST}" \
    || fail "Archive metadata could not be read."

entry_count=0
while IFS= read -r entry || [ -n "${entry}" ]; do
    entry_count=$((entry_count + 1))
    [ "${entry_count}" -le "${MAX_ENTRIES}" ] || fail "Archive exceeds the ${MAX_ENTRIES}-entry limit."
    [ -n "${entry}" ] || fail "Archive contains an empty entry name."
    case "${entry}" in
        /*|[A-Za-z]:*|*\\*) fail "Archive contains an unsafe path: ${entry}" ;;
    esac
    if printf '%s\n' "${entry}" | grep -Eq '(^|/)\.\.?(/|$)|//'; then
        fail "Archive contains a traversal path: ${entry}"
    fi
    depth="$(awk -F/ '{ print NF }' <<<"${entry}")"
    [ "${depth}" -le "${MAX_DEPTH}" ] || fail "Archive entry exceeds the ${MAX_DEPTH}-segment depth limit: ${entry}"
    case "${entry}" in
        asset-pack.json|third-party-icons/|third-party-icons/*/) ;;
        third-party-icons/*)
            extension="${entry##*.}"
            extension="${extension,,}"
            case "${extension}" in
                png|jpg|jpeg|gif|webp|svg|bmp|ico|avif) ;;
                *) fail "Icon asset pack contains an unsupported file type: ${entry}" ;;
            esac
            ;;
        *) fail "Icon asset pack contains an unexpected path: ${entry}" ;;
    esac
done < "${ENTRY_LIST}"
[ "${entry_count}" -gt 0 ] || fail "Archive is empty."

metadata_count=0
total_bytes=0
while IFS= read -r metadata || [ -n "${metadata}" ]; do
    metadata_count=$((metadata_count + 1))
    entry_type="${metadata:0:1}"
    case "${entry_type}" in
        -|d) ;;
        l|h) fail "Archive contains a symbolic or hard link." ;;
        *) fail "Archive contains a special file entry." ;;
    esac
    entry_bytes="$(awk '{ print $3 }' <<<"${metadata}")"
    case "${entry_bytes}" in
        ''|*[!0-9]*) fail "Archive contains unreadable size metadata." ;;
    esac
    [ "${entry_bytes}" -le "${MAX_ENTRY_BYTES}" ] || fail "Archive entry exceeds the ${MAX_ENTRY_BYTES}-byte limit."
    total_bytes=$((total_bytes + entry_bytes))
    [ "${total_bytes}" -le "${MAX_TOTAL_BYTES}" ] || fail "Archive exceeds the ${MAX_TOTAL_BYTES}-byte expanded-size limit."
done < "${VERBOSE_LIST}"
[ "${metadata_count}" -eq "${entry_count}" ] || fail "Archive metadata and path listings are inconsistent."

printf 'Archive preflight passed: kind=%s entries=%s expanded_bytes=%s.\n' \
    "${ARCHIVE_KIND}" "${entry_count}" "${total_bytes}"
