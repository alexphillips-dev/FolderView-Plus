#!/bin/bash
set -eu

ACTION="${1:-}"
NEW_VERSION="${2:-unknown}"
ICON_PACK_VERSION="${3:-unknown}"
ICON_STATUS_FILE="${4:-/tmp/folderview.plus-icon-pack-status}"
SCHEDULER_STATUS="${5:-unknown}"
CONTEXT_FILE="${FVPLUS_INSTALL_CONTEXT_FILE:-/tmp/folderview.plus-install-context}"

read_value() {
    key="${1:-}"
    source_file="${2:-}"
    default_value="${3:-}"
    value=""
    if [ -n "${key}" ] && [ -f "${source_file}" ]; then
        value="$(sed -n "s/^${key}=//p" "${source_file}" | head -n 1 | tr -d '\r\n')"
    fi
    if [ -z "${value}" ]; then
        value="${default_value}"
    fi
    printf '%s' "${value}"
}

safe_integer() {
    value="${1:-0}"
    case "${value}" in
        ''|*[!0-9]*) printf '0' ;;
        *) printf '%s' "${value}" ;;
    esac
}

detect_operation() {
    previous="${1:-}"
    current="${2:-}"
    if [ -z "${previous}" ]; then
        printf 'install'
        return
    fi
    if [ "${previous}" = "${current}" ]; then
        printf 'reinstall'
        return
    fi
    highest="$(printf '%s\n%s\n' "${previous}" "${current}" | sort -V | tail -n 1)"
    if [ "${highest}" = "${current}" ]; then
        printf 'upgrade'
        return
    fi
    printf 'downgrade'
}

title_case_operation() {
    case "${1:-install}" in
        upgrade) printf 'Upgrade' ;;
        reinstall) printf 'Reinstall' ;;
        downgrade) printf 'Downgrade' ;;
        *) printf 'Installation' ;;
    esac
}

report_line() {
    label="${1:-Status}"
    shift || true
    printf '  %-14s %s\n' "${label}" "$*"
}

previous_version="$(read_value previous_version "${CONTEXT_FILE}" '')"
started_at="$(safe_integer "$(read_value started_at "${CONTEXT_FILE}" '0')")"
had_config="$(safe_integer "$(read_value had_config "${CONTEXT_FILE}" '0')")"
backup_count="$(safe_integer "$(read_value backup_count "${CONTEXT_FILE}" '0')")"
custom_icon_count="$(safe_integer "$(read_value custom_icon_count "${CONTEXT_FILE}" '0')")"
override_count="$(safe_integer "$(read_value override_count "${CONTEXT_FILE}" '0')")"
operation="$(detect_operation "${previous_version}" "${NEW_VERSION}")"
operation_title="$(title_case_operation "${operation}")"

if [ "${ACTION}" = "failure" ]; then
    failed_stage="${5:-unknown}"
    exit_code="$(safe_integer "${6:-1}")"
    error_message="$(read_value error "${ICON_STATUS_FILE}" '')"
    printf '\nFolderView Plus - %s failed\n\n' "${operation_title}"
    report_line "Stage" "${failed_stage}"
    report_line "Exit code" "${exit_code}"
    if [ -n "${error_message}" ]; then
        report_line "Error" "${error_message}"
    fi
    if [ -n "${previous_version}" ]; then
        report_line "Previous" "${previous_version}"
    fi
    printf '\n  Review the installation output above. The previous configuration was not intentionally removed.\n'
    rm -f "${CONTEXT_FILE}" "${ICON_STATUS_FILE}"
    exit 0
fi

if [ "${ACTION}" != "complete" ]; then
    echo "ERROR: install_report.sh expects complete or failure." >&2
    exit 1
fi

icon_state="$(read_value state "${ICON_STATUS_FILE}" 'unknown')"
icon_count="$(safe_integer "$(read_value file_count "${ICON_STATUS_FILE}" '0')")"
case "${icon_state}" in
    reused) icon_summary="${ICON_PACK_VERSION} verified and reused from cache" ;;
    activated) icon_summary="${ICON_PACK_VERSION} verified and activated" ;;
    *) icon_summary="${ICON_PACK_VERSION} status unavailable" ;;
esac
if [ "${icon_count}" -gt 0 ]; then
    icon_summary="${icon_summary} (${icon_count} icons)"
fi

case "${SCHEDULER_STATUS}" in
    registered) scheduler_summary="Registered" ;;
    registered-restart-warning) scheduler_summary="Registered; cron reload warning" ;;
    *) scheduler_summary="Status unavailable" ;;
esac

if [ "${had_config}" -eq 1 ]; then
    config_summary="Preserved"
else
    config_summary="Initialized"
fi
if [ "${backup_count}" -gt 0 ]; then
    backup_summary="Preserved (${backup_count} snapshots)"
else
    backup_summary="No existing snapshots"
fi
if [ "${custom_icon_count}" -gt 0 ] || [ "${override_count}" -gt 0 ]; then
    custom_summary="Preserved (${custom_icon_count} icons, ${override_count} overrides)"
else
    custom_summary="No existing custom content"
fi

finished_at="$(date +%s)"
elapsed_seconds=0
if [ "${started_at}" -gt 0 ] && [ "${finished_at}" -ge "${started_at}" ]; then
    elapsed_seconds="$((finished_at - started_at))"
fi

printf '\nFolderView Plus - %s complete\n\n' "${operation_title}"
if [ -n "${previous_version}" ] && [ "${previous_version}" != "${NEW_VERSION}" ]; then
    report_line "Version" "${previous_version} -> ${NEW_VERSION}"
elif [ "${operation}" = "reinstall" ]; then
    report_line "Version" "${NEW_VERSION} (reinstalled)"
else
    report_line "Version" "${NEW_VERSION}"
fi
report_line "Core package" "Installed"
report_line "Icon pack" "${icon_summary}"
report_line "Configuration" "${config_summary}"
report_line "Backups" "${backup_summary}"
report_line "Custom data" "${custom_summary}"
report_line "Scheduler" "${scheduler_summary}"
report_line "Elapsed" "${elapsed_seconds}s"
if [ "${operation}" = "downgrade" ]; then
    report_line "Warning" "Verify configuration compatibility before making further changes."
fi
printf '\n  Next step: reload the Docker, VM, Dashboard, or Settings page.\n\n'

rm -f "${CONTEXT_FILE}" "${ICON_STATUS_FILE}"
