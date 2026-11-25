#!/bin/bash
set -euo pipefail

state_dir="/run/folderview.plus-registration"
registered_manifest="/boot/config/plugins/folderview.plus.plg"
running_manifest="/var/log/plugins/folderview.plus.plg"
config_dir="/boot/config/plugins/folderview.plus"
runtime_dir="/usr/local/emhttp/plugins/folderview.plus"
hook="/usr/local/emhttp/plugins/dynamix.plugin.manager/post-hooks/00-folderview.plus-registration"
helper="${runtime_dir}/scripts/complete_native_registration.sh"

process_start() {
    sed -E 's/^[0-9]+ \(.*\) //' "/proc/$1/stat" 2>/dev/null | awk '{ print $20 }' || true
}

read_owner() {
    [ -d "${state_dir}" ] && [ ! -L "${state_dir}" ] &&
        read -r owner_pid owner_start owner_method owner_version < "${state_dir}/owner" &&
        [[ "${owner_pid}" =~ ^[1-9][0-9]*$ && "${owner_start}" =~ ^[0-9]+$ ]] &&
        [[ "${owner_method}" = install || "${owner_method}" = update ]] &&
        [[ "${owner_version}" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]
}

is_owner_callback() {
    local pid="${PPID}" ancestor
    [ "${1}" = "${owner_method}" ] || return 1
    for ((ancestor=0; ancestor<4 && pid>1; ancestor++)); do
        if [ "${pid}" = "${owner_pid}" ] && [ "$(process_start "${pid}")" = "${owner_start}" ]; then
            return 0
        fi
        pid="$(awk '/^PPid:/ { print $2 }' "/proc/${pid}/status" 2>/dev/null || true)"
    done
    return 1
}

fail_registration() {
    printf 'FolderView Plus could not confirm native boot registration. Review the installation output before retrying.\n' >&2
    exit 1
}

if [ "${1:-}" = recover ]; then
    # The manifest calls recovery while it already holds the activation lock.
    read_owner || fail_registration
    if [ "$(process_start "${owner_pid}")" = "${owner_start}" ]; then
        printf 'Another FolderView Plus installation or removal is in progress. Retry after it finishes.\n' >&2
        exit 1
    fi
else
    [ "${1:-}" = plugin ] && [ "${3:-}" = folderview.plus.plg ] && [ -z "${4:-}" ] || exit 0
    read_owner && is_owner_callback "${2:-}" || exit 0
    exec 9>>/run/folderview.plus-install.lock
    flock 9 || fail_registration
    read_owner && is_owner_callback "${2:-}" || exit 0
    report="$(cat "${state_dir}/report" 2>/dev/null || true)"
fi

candidate_manifest="${state_dir}/manifest"
deployed_version="$(sed -nE 's/^[[:space:]]*"packageVersion":[[:space:]]*"([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)"[,]?[[:space:]]*$/\1/p' "${runtime_dir}/build-metadata.json" 2>/dev/null || true)"
[[ "${deployed_version}" = "${owner_version}" &&
    "$(cat "${config_dir}/version" 2>/dev/null)" = "${owner_version}" &&
    -f "${candidate_manifest}" && ! -L "${candidate_manifest}" ]] || fail_registration

if [ -L "${registered_manifest}" ] || ! cmp -s -- "${candidate_manifest}" "${registered_manifest}"; then
    target="$(mktemp /boot/config/plugins/.folderview.plus.plg.XXXXXX)" || fail_registration
    trap 'rm -f -- "${target}"' EXIT
    cp -- "${candidate_manifest}" "${target}" || fail_registration
    mv -fT -- "${target}" "${registered_manifest}" || fail_registration
fi
# Native remove has already detached the link and will restore it if removal fails.
if [[ "${1:-}:${2:-}" != recover:remove ]] &&
    [ "$(readlink -- "${running_manifest}" 2>/dev/null || true)" != "${registered_manifest}" ]; then
    ln -sT -- "${registered_manifest}" "${running_manifest}" || fail_registration
fi

if [ "$(readlink -- "${hook}" 2>/dev/null || true)" = "${helper}" ]; then
    rm -f -- "${hook}" || fail_registration
fi
rm -f -- "${state_dir}/owner" "${candidate_manifest}" "${state_dir}/report" || fail_registration
rmdir -- "${state_dir}" || fail_registration
if [ "${1:-}" != recover ]; then
    if [ -n "${report}" ]; then
        printf '%s\n' "${report}"
    else
        printf 'FolderView Plus confirmed boot registration for %s.\n' "${owner_version}"
    fi
fi
