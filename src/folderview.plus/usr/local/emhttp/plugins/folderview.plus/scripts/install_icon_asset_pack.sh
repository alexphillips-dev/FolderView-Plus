#!/bin/bash
set -eu

ICON_PACK_VERSION="${1:-}"
ICON_PACK_SHA256="${2:-}"
PLUGIN_DIR="${FVPLUS_PLUGIN_DIR:-/usr/local/emhttp/plugins/folderview.plus}"
CONFIG_DIR="${FVPLUS_CONFIG_DIR:-/boot/config/plugins/folderview.plus}"
CACHE_BASE="${FVPLUS_ICON_PACK_CACHE_BASE:-/tmp/folderview.plus-assets}"
ICON_PACK_ARCHIVE="${FVPLUS_ICON_PACK_ARCHIVE:-${CONFIG_DIR}/folderview.plus-icons-${ICON_PACK_VERSION}.txz}"
ICON_PACK_CACHE_ROOT="${CACHE_BASE}/icons-${ICON_PACK_VERSION}"
ICON_PACK_MARKER="${ICON_PACK_CACHE_ROOT}/.folderview-plus-asset-pack"
ICON_PACK_EXPECTED_MARKER="${ICON_PACK_VERSION}:${ICON_PACK_SHA256}"

fail() {
    echo "ERROR: $1" >&2
    exit 1
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
    [ -f "${ICON_PACK_ARCHIVE}" ] || fail "FolderView Plus icon asset pack is missing: ${ICON_PACK_ARCHIVE}"
    ICON_PACK_ACTUAL_SHA256="$(sha256sum "${ICON_PACK_ARCHIVE}" | awk '{print $1}')"
    [ "${ICON_PACK_ACTUAL_SHA256}" = "${ICON_PACK_SHA256}" ] || fail "FolderView Plus icon asset-pack checksum verification failed."

    mkdir -p "${CACHE_BASE}"
    ICON_PACK_STAGE="${ICON_PACK_CACHE_ROOT}.stage.$$"
    ICON_PACK_PREVIOUS="${ICON_PACK_CACHE_ROOT}.previous.$$"
    rm -rf "${ICON_PACK_STAGE}" "${ICON_PACK_PREVIOUS}"
    mkdir -p "${ICON_PACK_STAGE}"
    if ! tar -xJf "${ICON_PACK_ARCHIVE}" -C "${ICON_PACK_STAGE}"; then
        rm -rf "${ICON_PACK_STAGE}"
        fail "FolderView Plus icon asset pack could not be extracted."
    fi
    if [ ! -f "${ICON_PACK_STAGE}/asset-pack.json" ] || [ ! -d "${ICON_PACK_STAGE}/third-party-icons" ]; then
        rm -rf "${ICON_PACK_STAGE}"
        fail "FolderView Plus icon asset pack is incomplete."
    fi
    if ! grep -Fq "\"version\": \"${ICON_PACK_VERSION}\"" "${ICON_PACK_STAGE}/asset-pack.json"; then
        rm -rf "${ICON_PACK_STAGE}"
        fail "FolderView Plus icon asset-pack version does not match the plugin manifest."
    fi
    ICON_PACK_FILE_COUNT="$(find "${ICON_PACK_STAGE}/third-party-icons" -type f | wc -l | tr -d '[:space:]')"
    if [ -z "${ICON_PACK_FILE_COUNT}" ] || [ "${ICON_PACK_FILE_COUNT}" -eq 0 ]; then
        rm -rf "${ICON_PACK_STAGE}"
        fail "FolderView Plus icon asset pack contains no icons."
    fi

    find "${ICON_PACK_STAGE}" -type d -exec chmod 0755 {} +
    find "${ICON_PACK_STAGE}" -type f -exec chmod 0644 {} +
    printf '%s\n' "${ICON_PACK_EXPECTED_MARKER}" > "${ICON_PACK_STAGE}/.folderview-plus-asset-pack"
    if [ -e "${ICON_PACK_CACHE_ROOT}" ] || [ -L "${ICON_PACK_CACHE_ROOT}" ]; then
        mv "${ICON_PACK_CACHE_ROOT}" "${ICON_PACK_PREVIOUS}"
    fi
    if mv "${ICON_PACK_STAGE}" "${ICON_PACK_CACHE_ROOT}"; then
        rm -rf "${ICON_PACK_PREVIOUS}"
    else
        if [ -e "${ICON_PACK_PREVIOUS}" ] || [ -L "${ICON_PACK_PREVIOUS}" ]; then
            mv "${ICON_PACK_PREVIOUS}" "${ICON_PACK_CACHE_ROOT}"
        fi
        rm -rf "${ICON_PACK_STAGE}"
        fail "FolderView Plus icon asset pack could not be activated."
    fi
fi

mkdir -p "${PLUGIN_DIR}/images"
RUNTIME_LINK="${PLUGIN_DIR}/images/third-party-icons"
RUNTIME_LINK_STAGE="${RUNTIME_LINK}.stage.$$"
rm -rf "${RUNTIME_LINK_STAGE}"
ln -s "${ICON_PACK_CACHE_ROOT}/third-party-icons" "${RUNTIME_LINK_STAGE}"
rm -rf "${RUNTIME_LINK}"
mv -Tf "${RUNTIME_LINK_STAGE}" "${RUNTIME_LINK}"
cp -f "${ICON_PACK_CACHE_ROOT}/asset-pack.json" "${PLUGIN_DIR}/icon-asset-pack.json.tmp"
mv -f "${PLUGIN_DIR}/icon-asset-pack.json.tmp" "${PLUGIN_DIR}/icon-asset-pack.json"

for stale_root in "${CACHE_BASE}"/icons-*; do
    if [ "${stale_root}" != "${ICON_PACK_CACHE_ROOT}" ]; then
        rm -rf "${stale_root}"
    fi
done
for stale_archive in "${CONFIG_DIR}"/folderview.plus-icons-*.txz; do
    if [ "${stale_archive}" != "${ICON_PACK_ARCHIVE}" ]; then
        rm -f "${stale_archive}"
    fi
done

echo "FolderView Plus icon asset pack ${ICON_PACK_VERSION} is ready (${ICON_PACK_FILE_COUNT:-cached} icons)."
