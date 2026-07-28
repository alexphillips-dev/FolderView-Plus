#!/bin/bash
set -euo pipefail
IFS=$'\n\t'
umask 077

ICON_PACK_VERSION="${1:-}"
ICON_PACK_SHA256="${2:-}"
PLUGIN_DIR="${FVPLUS_PLUGIN_DIR:-/usr/local/emhttp/plugins/folderview.plus}"
CONFIG_DIR="${FVPLUS_CONFIG_DIR:-/boot/config/plugins/folderview.plus}"
CACHE_BASE="${FVPLUS_ICON_PACK_CACHE_BASE:-/tmp/folderview.plus-assets}"
ICON_PACK_ARCHIVE="${FVPLUS_ICON_PACK_ARCHIVE:-${CONFIG_DIR}/folderview.plus-icons-${ICON_PACK_VERSION}.txz}"
ICON_PACK_CACHE_ROOT="${CACHE_BASE}/icons-${ICON_PACK_VERSION}"
ICON_PACK_MARKER="${ICON_PACK_CACHE_ROOT}/.folderview-plus-asset-pack"
ICON_PACK_EXPECTED_MARKER="${ICON_PACK_VERSION}:${ICON_PACK_SHA256}"
ICON_PACK_STATUS_FILE="${FVPLUS_ICON_PACK_STATUS_FILE:-}"
ICON_PACK_INSTALL_STATE="reused"
ARCHIVE_PREFLIGHT="${PLUGIN_DIR}/scripts/archive_preflight.sh"

write_status() {
    state="${1:-unknown}"
    file_count="${2:-0}"
    error_message="${3:-}"
    if [ -z "${ICON_PACK_STATUS_FILE}" ]; then
        return
    fi
    {
        printf 'state=%s\n' "${state}"
        printf 'version=%s\n' "${ICON_PACK_VERSION}"
        printf 'file_count=%s\n' "${file_count}"
        if [ -n "${error_message}" ]; then
            printf 'error=%s\n' "${error_message}"
        fi
    } > "${ICON_PACK_STATUS_FILE}"
}

fail() {
    write_status "failed" "0" "$1"
    echo "ERROR: $1" >&2
    exit 1
}

normalize_root() {
    local root="${1:-}"
    root="${root%/}"
    case "${root}" in
        ''|/|.) fail "FolderView Plus asset-pack root path is unsafe." ;;
        /*) printf '%s\n' "${root}" ;;
        *) fail "FolderView Plus asset-pack root path must be absolute." ;;
    esac
}

CACHE_BASE="$(normalize_root "${CACHE_BASE}")"
CONFIG_DIR="$(normalize_root "${CONFIG_DIR}")"
PLUGIN_DIR="$(normalize_root "${PLUGIN_DIR}")"
ICON_PACK_CACHE_ROOT="${CACHE_BASE}/icons-${ICON_PACK_VERSION}"
ICON_PACK_MARKER="${ICON_PACK_CACHE_ROOT}/.folderview-plus-asset-pack"
ARCHIVE_PREFLIGHT="${PLUGIN_DIR}/scripts/archive_preflight.sh"

assert_cache_child() {
    case "${1:-}" in
        "${CACHE_BASE}/"*) ;;
        *) fail "Refusing filesystem operation outside the asset-pack cache root." ;;
    esac
}

safe_remove_cache_tree() {
    local target="${1:-}"
    assert_cache_child "${target}"
    rm -rf -- "${target}"
}

case "${ICON_PACK_VERSION}" in
    ''|*[!0-9.]*) fail "FolderView Plus icon asset-pack version is invalid." ;;
esac
if ! printf '%s' "${ICON_PACK_VERSION}" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$'; then
    fail "FolderView Plus icon asset-pack version is invalid."
fi
if ! printf '%s' "${ICON_PACK_SHA256}" | grep -Eq '^[a-f0-9]{64}$'; then
    fail "FolderView Plus icon asset-pack checksum is invalid."
fi

ICON_PACK_READY=0
if [ -f "${ICON_PACK_MARKER}" ] && [ -f "${ICON_PACK_CACHE_ROOT}/asset-pack.json" ] && [ -d "${ICON_PACK_CACHE_ROOT}/third-party-icons" ]; then
    ICON_PACK_CURRENT_MARKER="$(cat "${ICON_PACK_MARKER}" 2>/dev/null || true)"
    if [ "${ICON_PACK_CURRENT_MARKER}" = "${ICON_PACK_EXPECTED_MARKER}" ]; then
        ICON_PACK_READY=1
    fi
fi

if [ "${ICON_PACK_READY}" -ne 1 ]; then
    ICON_PACK_INSTALL_STATE="activated"
    [ -f "${ICON_PACK_ARCHIVE}" ] || fail "FolderView Plus icon asset pack is missing: ${ICON_PACK_ARCHIVE}"
    [ ! -L "${ICON_PACK_ARCHIVE}" ] || fail "FolderView Plus icon asset-pack archive must not be a symbolic link."
    ICON_PACK_ACTUAL_SHA256="$(sha256sum "${ICON_PACK_ARCHIVE}" | awk '{print $1}')"
    [ "${ICON_PACK_ACTUAL_SHA256}" = "${ICON_PACK_SHA256}" ] || fail "FolderView Plus icon asset-pack checksum verification failed."
    [ -f "${ARCHIVE_PREFLIGHT}" ] || fail "FolderView Plus archive preflight helper is unavailable."
    /bin/bash "${ARCHIVE_PREFLIGHT}" "${ICON_PACK_ARCHIVE}" icon-pack \
        || fail "FolderView Plus icon asset-pack archive failed security preflight."

    mkdir -p "${CACHE_BASE}"
    [ ! -L "${CACHE_BASE}" ] || fail "FolderView Plus asset-pack cache root must not be a symbolic link."
    chmod 0755 "${CACHE_BASE}"
    ICON_PACK_STAGE="$(mktemp -d "${CACHE_BASE}/.icons-${ICON_PACK_VERSION}.stage.XXXXXX")"
    ICON_PACK_PREVIOUS="$(mktemp -d "${CACHE_BASE}/.icons-${ICON_PACK_VERSION}.previous.XXXXXX")"
    rmdir "${ICON_PACK_PREVIOUS}"
    assert_cache_child "${ICON_PACK_STAGE}"
    assert_cache_child "${ICON_PACK_PREVIOUS}"
    if ! tar --extract --xz --file "${ICON_PACK_ARCHIVE}" --directory "${ICON_PACK_STAGE}" \
        --no-same-owner --no-same-permissions --delay-directory-restore; then
        safe_remove_cache_tree "${ICON_PACK_STAGE}"
        fail "FolderView Plus icon asset pack could not be extracted."
    fi
    if find "${ICON_PACK_STAGE}" -xdev \( ! -type f ! -type d \) -print -quit | grep -q .; then
        safe_remove_cache_tree "${ICON_PACK_STAGE}"
        fail "FolderView Plus icon asset pack extracted an unsupported filesystem object."
    fi
    if [ ! -f "${ICON_PACK_STAGE}/asset-pack.json" ] || [ ! -d "${ICON_PACK_STAGE}/third-party-icons" ]; then
        safe_remove_cache_tree "${ICON_PACK_STAGE}"
        fail "FolderView Plus icon asset pack is incomplete."
    fi
    if ! grep -Fq "\"version\": \"${ICON_PACK_VERSION}\"" "${ICON_PACK_STAGE}/asset-pack.json"; then
        safe_remove_cache_tree "${ICON_PACK_STAGE}"
        fail "FolderView Plus icon asset-pack version does not match the plugin manifest."
    fi
    ICON_PACK_FILE_COUNT="$(find "${ICON_PACK_STAGE}/third-party-icons" -type f | wc -l | tr -d '[:space:]')"
    if [ -z "${ICON_PACK_FILE_COUNT}" ] || [ "${ICON_PACK_FILE_COUNT}" -eq 0 ]; then
        safe_remove_cache_tree "${ICON_PACK_STAGE}"
        fail "FolderView Plus icon asset pack contains no icons."
    fi

    find "${ICON_PACK_STAGE}" -type d -exec chmod 0755 {} +
    find "${ICON_PACK_STAGE}" -type f -exec chmod 0644 {} +
    printf '%s\n' "${ICON_PACK_EXPECTED_MARKER}" > "${ICON_PACK_STAGE}/.folderview-plus-asset-pack"
    if [ -e "${ICON_PACK_CACHE_ROOT}" ] || [ -L "${ICON_PACK_CACHE_ROOT}" ]; then
        mv "${ICON_PACK_CACHE_ROOT}" "${ICON_PACK_PREVIOUS}"
    fi
    if mv "${ICON_PACK_STAGE}" "${ICON_PACK_CACHE_ROOT}"; then
        safe_remove_cache_tree "${ICON_PACK_PREVIOUS}"
    else
        if [ -e "${ICON_PACK_PREVIOUS}" ] || [ -L "${ICON_PACK_PREVIOUS}" ]; then
            mv "${ICON_PACK_PREVIOUS}" "${ICON_PACK_CACHE_ROOT}"
        fi
        safe_remove_cache_tree "${ICON_PACK_STAGE}"
        fail "FolderView Plus icon asset pack could not be activated."
    fi
fi

if [ -z "${ICON_PACK_FILE_COUNT:-}" ]; then
    ICON_PACK_FILE_COUNT="$(sed -n 's/.*"fileCount"[[:space:]]*:[[:space:]]*\([0-9][0-9]*\).*/\1/p' "${ICON_PACK_CACHE_ROOT}/asset-pack.json" | head -n 1)"
fi
case "${ICON_PACK_FILE_COUNT:-}" in
    ''|*[!0-9]*) ICON_PACK_FILE_COUNT=0 ;;
esac

mkdir -p "${PLUGIN_DIR}/images"
RUNTIME_LINK="${PLUGIN_DIR}/images/third-party-icons"
RUNTIME_LINK_STAGE_DIR="$(mktemp -d "${PLUGIN_DIR}/images/.third-party-icons.stage.XXXXXX")"
RUNTIME_LINK_STAGE="${RUNTIME_LINK_STAGE_DIR}/third-party-icons"
ln -s "${ICON_PACK_CACHE_ROOT}/third-party-icons" "${RUNTIME_LINK_STAGE}"
if [ -e "${RUNTIME_LINK}" ] || [ -L "${RUNTIME_LINK}" ]; then
    rm -rf -- "${RUNTIME_LINK}"
fi
mv -Tf "${RUNTIME_LINK_STAGE}" "${RUNTIME_LINK}"
rmdir "${RUNTIME_LINK_STAGE_DIR}"
cp -f "${ICON_PACK_CACHE_ROOT}/asset-pack.json" "${PLUGIN_DIR}/icon-asset-pack.json.tmp"
mv -f "${PLUGIN_DIR}/icon-asset-pack.json.tmp" "${PLUGIN_DIR}/icon-asset-pack.json"

for stale_root in "${CACHE_BASE}"/icons-*; do
    if [ "${stale_root}" != "${ICON_PACK_CACHE_ROOT}" ]; then
        safe_remove_cache_tree "${stale_root}"
    fi
done
for stale_archive in "${CONFIG_DIR}"/folderview.plus-icons-*.txz; do
    if [ "${stale_archive}" != "${ICON_PACK_ARCHIVE}" ]; then
        rm -f "${stale_archive}"
    fi
done

write_status "${ICON_PACK_INSTALL_STATE}" "${ICON_PACK_FILE_COUNT}" ""
if [ -z "${ICON_PACK_STATUS_FILE}" ]; then
    echo "[OK] FolderView Plus icon asset pack ${ICON_PACK_VERSION} is ready (${ICON_PACK_FILE_COUNT} icons; ${ICON_PACK_INSTALL_STATE})."
fi
