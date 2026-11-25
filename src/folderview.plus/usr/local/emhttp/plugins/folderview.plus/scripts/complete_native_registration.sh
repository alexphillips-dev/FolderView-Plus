#!/bin/bash
set -euo pipefail

registered_manifest="/boot/config/plugins/folderview.plus.plg"
running_manifest="/var/log/plugins/folderview.plus.plg"
config_dir="/boot/config/plugins/folderview.plus"
runtime_dir="/usr/local/emhttp/plugins/folderview.plus"
hook="/usr/local/emhttp/plugins/dynamix.plugin.manager/post-hooks/00-folderview.plus-registration"
helper="${runtime_dir}/scripts/complete_native_registration.sh"
boot_wrapper="/boot/config/plugins/00-folderview.plus-registration-recovery.plg"
legacy_dir="/run/folderview.plus-registration"
state_dir="${config_dir}/.native-registration"
pending_dir="${state_dir}.pending"
legacy=0
if [ ! -d "${state_dir}" ] && [ -d "${legacy_dir}" ]; then
    state_dir="${legacy_dir}"
    legacy=1
fi

process_start() {
    sed -E 's/^[0-9]+ \(.*\) //' "/proc/$1/stat" 2>/dev/null | awk '{ print $20 }' || true
}

read_owner() {
    [ -d "${state_dir}" ] && [ ! -L "${state_dir}" ] &&
        read -r owner_pid owner_start owner_method owner_version 2>/dev/null < "${state_dir}/owner" &&
        [[ "${owner_pid}" =~ ^[1-9][0-9]*$ && "${owner_start}" =~ ^[0-9]+$ ]] &&
        [[ "${owner_method}" = install || "${owner_method}" = update ]] &&
        [[ "${owner_version}" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]
}

owner_on_this_boot() {
    [ "${legacy}" -eq 1 ] ||
        cmp -s -- "${state_dir}/boot-id" /proc/sys/kernel/random/boot_id
}

is_owner_callback() {
    local pid="${PPID}" ancestor
    [ "${1}" = "${owner_method}" ] && owner_on_this_boot || return 1
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

manifest_entity() {
    sed -n "s/^<!ENTITY $1 \"\([^\"]*\)\">\r\{0,1\}$/\1/p" "$2" 2>/dev/null | head -n 1
}

validate_manifest() {
    local expected="${2:-${owner_version}}" sha md5 archive
    [ -f "$1" ] && [ ! -L "$1" ] &&
        [ "$(manifest_entity name "$1")" = folderview.plus ] &&
        [ "$(manifest_entity version "$1")" = "${expected}" ] || return 1
    sha="$(manifest_entity sha256 "$1")"
    archive="${config_dir}/folderview.plus-${expected}.txz"
    [ -f "${archive}" ] && [ ! -L "${archive}" ] || return 1
    if [[ "${sha}" =~ ^[a-f0-9]{64}$ ]]; then
        printf '%s  %s\n' "${sha}" "${archive}" | sha256sum --check --status
    else
        md5="$(manifest_entity md5 "$1")"
        [[ -z "${sha}" && "${md5}" =~ ^[a-f0-9]{32}$ ]] &&
            printf '%s  %s\n' "${md5}" "${archive}" | md5sum --check --status
    fi
}

write_registered_manifest() {
    local source="$1" target
    if [ ! -L "${registered_manifest}" ] && cmp -s -- "${source}" "${registered_manifest}"; then
        return 0
    fi
    target="$(mktemp /boot/config/plugins/.folderview.plus.plg.XXXXXX)" || fail_registration
    if ! cp -- "${source}" "${target}" || ! mv -fT -- "${target}" "${registered_manifest}"; then
        rm -f -- "${target}"
        fail_registration
    fi
}

clear_state() {
    local retired="${state_dir}"
    if [ "$(readlink -- "${hook}" 2>/dev/null || true)" = "${helper}" ]; then
        rm -f -- "${hook}" || fail_registration
    fi
    if [ "${legacy}" -eq 0 ]; then
        if [ "$(readlink -- "${legacy_dir}" 2>/dev/null || true)" = "${state_dir}" ]; then
            rm -f -- "${legacy_dir}" || fail_registration
        fi
        # Retire the journal atomically before deleting its individual files.
        retired="${pending_dir}"
        mv -T -- "${state_dir}" "${retired}" || fail_registration
    fi
    rm -f -- "${retired}/"{manifest,owner,report,boot-id,recover.sh,previous-version,previous-manifest,manifest-absent,saved-version,version-absent,cron,cron-mode,core-started,activated,committed,rollback} || fail_registration
    rmdir -- "${retired}" || fail_registration
    # The native boot CLI still rereads the wrapper's noInstall attribute.
    if [ "${1:-}" != boot ]; then
        rm -f -- "${boot_wrapper}" || fail_registration
    fi
}

restore_scheduler() {
    local cron_file="/etc/cron.d/folderview.plus" cron_mode target
    cron_mode="$(cat "${state_dir}/cron-mode")" || return 1
    [ ! -L "${cron_file}" ] || return 1
    case "${cron_mode}" in
        blocked) return 0 ;;
        absent) rm -f -- "${cron_file}" || return 1 ;;
        *)
            [[ "${cron_mode}" =~ ^[0-7]{3,4}$ ]] || return 1
            target="$(mktemp /etc/cron.d/.folderview.plus.restore.XXXXXX)" || return 1
            if ! cp -- "${state_dir}/cron" "${target}" ||
                ! chmod "${cron_mode}" "${target}" || ! mv -fT -- "${target}" "${cron_file}"; then
                rm -f -- "${target}"
                return 1
            fi
            ;;
    esac
    /etc/rc.d/rc.crond restart 9>&- >/dev/null 2>&1
}

read_deployed_version() {
    sed -nE 's/^[[:space:]]*"packageVersion":[[:space:]]*"([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)"[,]?[[:space:]]*$/\1/p' "${runtime_dir}/build-metadata.json" 2>/dev/null || true
}

has_package_record() {
    [ -f "/var/lib/pkgtools/packages/folderview.plus-$1" ] || [ -f "/var/log/packages/folderview.plus-$1" ]
}

restore_prior_registration() {
    local previous_version target previous_manifest="${state_dir}/previous-manifest"
    previous_version="$(cat "${state_dir}/previous-version")" || return 1
    if [ -f "${previous_manifest}" ]; then
        if [ -n "${previous_version}" ]; then
            validate_manifest "${previous_manifest}" "${previous_version}" || return 1
        fi
        write_registered_manifest "${previous_manifest}"
    elif [ -f "${state_dir}/manifest-absent" ] &&
        { [ -e "${registered_manifest}" ] || [ -L "${registered_manifest}" ]; }; then
        [ ! -L "${registered_manifest}" ] &&
            cmp -s -- "${registered_manifest}" "${state_dir}/manifest" &&
            rm -f -- "${registered_manifest}" || return 1
    fi
    if [ -f "${state_dir}/saved-version" ]; then
        target="$(mktemp "${config_dir}/.version.rollback.XXXXXX")" || return 1
        if ! cp -p -- "${state_dir}/saved-version" "${target}" ||
            ! mv -fT -- "${target}" "${config_dir}/version" ||
            ! cmp -s -- "${state_dir}/saved-version" "${config_dir}/version"; then
            rm -f -- "${target}"
            return 1
        fi
    elif [ -f "${state_dir}/version-absent" ]; then
        rm -f -- "${config_dir}/version" || return 1
    fi
    sync -f "${config_dir}"
}

restore_interrupted_activation() {
    local previous_version previous_icon previous_icon_sha icon_archive restored_version
    local previous_manifest="${state_dir}/previous-manifest"
    [ ! -f "${state_dir}/core-started" ] && return 0
    previous_version="$(cat "${state_dir}/previous-version")" || return 1
    # A different deployed package could belong to a later installation.
    if [[ -n "${deployed_version}" && "${deployed_version}" != "${previous_version}" &&
          "${deployed_version}" != "${owner_version}" ]]; then
        return 1
    fi
    if [ -n "${previous_version}" ]; then
        [ -f "${previous_manifest}" ] || previous_manifest="${registered_manifest}"
        [[ "${previous_version}" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] &&
            validate_manifest "${previous_manifest}" "${previous_version}" || return 1
        previous_icon="$(manifest_entity iconPackVersion "${previous_manifest}")"
        if [ -n "${previous_icon}" ]; then
            previous_icon_sha="$(manifest_entity iconPackSha256 "${previous_manifest}")"
            icon_archive="${config_dir}/folderview.plus-icons-${previous_icon}.txz"
            [[ "${previous_icon}" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ && "${previous_icon_sha}" =~ ^[a-f0-9]{64}$ ]] &&
                [ -f "${icon_archive}" ] && [ ! -L "${icon_archive}" ] &&
                printf '%s  %s\n' "${previous_icon_sha}" "${icon_archive}" | sha256sum --check --status || return 1
        fi
    fi
    if [ -L "${runtime_dir}/images/third-party-icons" ]; then
        rm -f -- "${runtime_dir}/images/third-party-icons" || return 1
    fi
    rm -f -- "${runtime_dir}/icon-asset-pack.json" "${runtime_dir}/icon-asset-pack.json.tmp" || return 1
    if [ -n "${previous_version}" ]; then
        upgradepkg --install-new --reinstall "${config_dir}/folderview.plus-${previous_version}.txz" 9>&- || return 1
        if [ -n "${previous_icon}" ]; then
            /bin/bash "${runtime_dir}/scripts/install_icon_asset_pack.sh" "${previous_icon}" "${previous_icon_sha}" || return 1
        fi
        restored_version="$(read_deployed_version)"
        if [ -n "${restored_version}" ]; then
            [ "${restored_version}" = "${previous_version}" ] || return 1
        else
            has_package_record "${previous_version}" || return 1
        fi
    elif [ "${deployed_version}" = "${owner_version}" ] || has_package_record "${owner_version}"; then
        removepkg "folderview.plus-${owner_version}" 9>&- || return 1
        [ -z "$(read_deployed_version)" ] && ! has_package_record "${owner_version}" || return 1
    fi
    restore_scheduler
}

mode="${1:-}"
case "${mode}" in
    boot)
        exec 9>>/run/folderview.plus-install.lock
        flock 9 || fail_registration
        [ -d "${state_dir}" ] && [ "${legacy}" -eq 0 ] || exit 0
        owner_on_this_boot && exit 0
        read_owner || fail_registration
        bootstrap=0
        if [ -f "${state_dir}/rollback" ]; then
            restore_prior_registration || fail_registration
        elif [ -f "${state_dir}/committed" ]; then
            [ -f "${registered_manifest}" ] || bootstrap=1
            validate_manifest "${state_dir}/manifest" || fail_registration
            write_registered_manifest "${state_dir}/manifest"
            sync -f "${config_dir}" || fail_registration
        fi
        clear_state boot
        # A first installation interrupted before the primary file was created
        # has no primary manifest in the boot loader's already-expanded list.
        if [ "${bootstrap}" -eq 1 ]; then
            exec plugin install "${registered_manifest}" 9>&-
        fi
        exit 0
        ;;
    rollback)
        # The activation hook still owns the lock and has recorded the failure on flash.
        read_owner || fail_registration
        is_owner_callback "${owner_method}" || fail_registration
        [ -f "${state_dir}/rollback" ] || fail_registration
        ;;
    recover)
        # The main manifest already holds the activation lock.
        if read_owner && owner_on_this_boot && [ "$(process_start "${owner_pid}")" = "${owner_start}" ]; then
            printf 'Another FolderView Plus installation or removal is in progress. Retry after it finishes.\n' >&2
            exit 1
        fi
        ;;
    plugin)
        [ "${3:-}" = folderview.plus.plg ] && [ -z "${4:-}" ] || exit 0
        read_owner && is_owner_callback "${2:-}" || exit 0
        exec 9>>/run/folderview.plus-install.lock
        flock 9 || fail_registration
        read_owner && is_owner_callback "${2:-}" || exit 0
        [ ! -f "${state_dir}/rollback" ] || fail_registration
        ;;
    *) exit 0 ;;
esac

report="$(cat "${state_dir}/report" 2>/dev/null || true)"
candidate_manifest="${state_dir}/manifest"
deployed_version="$(read_deployed_version)"
saved_version="$(cat "${config_dir}/version" 2>/dev/null || true)"
if [ "${mode}" = rollback ] || { [ "${mode}" = recover ] && [ "${legacy}" -eq 0 ] &&
    { [ -f "${state_dir}/rollback" ] || [ ! -f "${state_dir}/activated" ]; }; }; then
    read_owner || fail_registration
    restore_interrupted_activation || fail_registration
    restore_prior_registration || fail_registration
    clear_state
    exit 0
fi
if [ "${mode}" = recover ]; then
    if [ "${legacy}" -eq 1 ]; then
        if ! read_owner; then
            # Older installers could leave the directory empty. Clear it if the
            # installed triplet already agrees, or verify the staged candidate.
            if [ "${deployed_version}" = "${saved_version}" ] &&
                [ "${saved_version}" = "$(manifest_entity version "${registered_manifest}")" ]; then
                clear_state
                exit 0
            fi
            owner_version="${saved_version}"
            [ -f "${candidate_manifest}" ] || candidate_manifest="/tmp/plugins/folderview.plus.plg"
        fi
    else
        read_owner || fail_registration
        if [ "${saved_version}" != "${owner_version}" ] && [ "${deployed_version}" = "${owner_version}" ]; then
            validate_manifest "${candidate_manifest}" || fail_registration
            target="$(mktemp "${config_dir}/.version.XXXXXX")" || fail_registration
            if ! printf '%s\n' "${owner_version}" > "${target}" || ! mv -fT -- "${target}" "${config_dir}/version"; then
                rm -f -- "${target}"
                fail_registration
            fi
            saved_version="${owner_version}"
        fi
    fi
fi
if [[ ! "${owner_version}" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ||
      "${deployed_version}" != "${owner_version}" || "${saved_version}" != "${owner_version}" ]] ||
    ! validate_manifest "${candidate_manifest}"; then
    fail_registration
fi
write_registered_manifest "${candidate_manifest}"
sync -f "${config_dir}" || fail_registration
# Native remove has already detached the link and will restore it if removal fails.
if [[ "${mode}:${2:-}" != recover:remove ]] &&
    [ "$(readlink -- "${running_manifest}" 2>/dev/null || true)" != "${registered_manifest}" ]; then
    ln -sT -- "${registered_manifest}" "${running_manifest}" || fail_registration
fi
clear_state
if [ "${mode}" = plugin ]; then
    if [ -n "${report}" ]; then
        printf '%s\n' "${report}"
    else
        printf 'FolderView Plus confirmed boot registration for %s.\n' "${owner_version}"
    fi
fi
