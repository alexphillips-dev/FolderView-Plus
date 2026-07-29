#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib.sh
source "${ROOT_DIR}/scripts/lib.sh"
# shellcheck source=scripts/release_note_categories.sh
source "${ROOT_DIR}/scripts/release_note_categories.sh"
PLG_FILE="${ROOT_DIR}/folderview.plus.plg"
PRIMARY_CA_TEMPLATE_FILE="${ROOT_DIR}/folderview.plus.xml"
CA_TEMPLATE_FILE="${PRIMARY_CA_TEMPLATE_FILE}"
PLUGIN_SRC_DIR="${ROOT_DIR}/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus"
SERVER_DIR="${PLUGIN_SRC_DIR}/server"
ICON_ASSET_PACK_GUARD="${ROOT_DIR}/scripts/icon_asset_pack_guard.sh"
ARCHIVE_DIR="${FVPLUS_ARCHIVE_DIR:-${ROOT_DIR}/archive}"
MAX_ARCHIVE_BYTES="${FVPLUS_MAX_ARCHIVE_BYTES:-52428800}" # 50 MiB default ceiling
MAX_ARCHIVE_FILE_COUNT="${FVPLUS_MAX_ARCHIVE_FILE_COUNT:-10000}"
NODE_BIN="$(fvplus::resolve_platform_command node)"

resolve_php_bin() {
  fvplus::resolve_platform_command php
}

packaging_sync_hint() {
  echo "HINT: Run 'bash pkg_build.sh' and commit updated release artifacts (folderview.plus.plg + folderview.plus.xml + archive/*.txz + archive/*.sha256)." >&2
}

fail_packaged_source_mismatch() {
  local message="${1:-Packaged artifact does not match source.}"
  echo "ERROR: ${message}" >&2
  packaging_sync_hint
  exit 1
}

# Compare text files while tolerating cross-platform line endings.
# This keeps real content mismatches failing while avoiding CRLF/LF false positives.
text_files_match() {
  local source_file="$1"
  local packaged_file="$2"
  if cmp -s "${source_file}" "${packaged_file}"; then
    return 0
  fi
  diff -u <(tr -d '\r' < "${source_file}") <(tr -d '\r' < "${packaged_file}") >/dev/null
}

env_truthy() {
  case "$(printf '%s' "${1:-0}" | tr '[:upper:]' '[:lower:]')" in
    1|true|yes|on)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

if [[ ! -f "${PLG_FILE}" ]]; then
  echo "ERROR: Missing plugin manifest: ${PLG_FILE}" >&2
  exit 1
fi

VERSION="$(sed -n 's/^<!ENTITY version "\([^"]*\)".*/\1/p' "${PLG_FILE}" | head -n 1 || true)"
MD5_ENTITY="$(sed -n 's/^<!ENTITY md5 "\([^"]*\)".*/\1/p' "${PLG_FILE}" | head -n 1 || true)"
SHA256_ENTITY="$(sed -n 's/^<!ENTITY sha256 "\([^"]*\)".*/\1/p' "${PLG_FILE}" | head -n 1 || true)"
ICON_PACK_URL_ENTITY="$(sed -n 's/^<!ENTITY iconPackURL "\([^"]*\)".*/\1/p' "${PLG_FILE}" | head -n 1 || true)"

if [[ -z "${VERSION}" ]]; then
  echo "ERROR: Could not parse version entity from folderview.plus.plg" >&2
  exit 1
fi

if [[ -z "${MD5_ENTITY}" ]]; then
  echo "ERROR: Could not parse md5 entity from folderview.plus.plg" >&2
  exit 1
fi
if [[ ! "${SHA256_ENTITY}" =~ ^[a-f0-9]{64}$ ]]; then
  echo "ERROR: Could not parse a valid sha256 entity from folderview.plus.plg" >&2
  exit 1
fi
if [[ ! -x "${ICON_ASSET_PACK_GUARD}" && ! -f "${ICON_ASSET_PACK_GUARD}" ]]; then
  echo "ERROR: Missing icon asset-pack guard: ${ICON_ASSET_PACK_GUARD}" >&2
  exit 1
fi
if [[ "${FVPLUS_ICON_ASSET_PACK_GUARDED:-0}" != "1" ]]; then
  bash "${ICON_ASSET_PACK_GUARD}"
fi

PLUGIN_TAG_COMPACT="$(
  perl -0777 -ne '
    if (/<PLUGIN\b[^>]*>/s) {
      my $tag = $&;
      $tag =~ s/\s+/ /g;
      print $tag;
    }
  ' "${PLG_FILE}"
)"
if [[ -z "${PLUGIN_TAG_COMPACT}" ]]; then
  echo "ERROR: Could not locate <PLUGIN> tag in ${PLG_FILE}" >&2
  exit 1
fi
if [[ "${PLUGIN_TAG_COMPACT}" != *'name="&name;"'* ]] || [[ "${PLUGIN_TAG_COMPACT}" != *'author="&author;"'* ]] || [[ "${PLUGIN_TAG_COMPACT}" != *'version="&version;"'* ]] || [[ "${PLUGIN_TAG_COMPACT}" != *'launch="&launch;"'* ]] || [[ "${PLUGIN_TAG_COMPACT}" != *'pluginURL="&pluginURL;"'* ]]; then
  echo "ERROR: <PLUGIN> tag must remain in canonical entity form for Unraid plugin-check compatibility. tag=${PLUGIN_TAG_COMPACT}" >&2
  exit 1
fi

if ! [[ "${VERSION}" =~ ^[0-9]{4}\.[0-9]{2}\.[0-9]{2}(\.[0-9]{2,})$ ]]; then
  echo "ERROR: Version has unexpected format: ${VERSION}" >&2
  exit 1
fi

if [[ "${VERSION}" =~ ^([0-9]{4}\.[0-9]{2}\.[0-9]{2})(\.[0-9]{2,})$ ]]; then
  VERSION_DATE="${BASH_REMATCH[1]}"
  TODAY_DATE="$(date +"%Y.%m.%d")"
  if [[ "${VERSION_DATE}" > "${TODAY_DATE}" ]]; then
    echo "ERROR: Version date (${VERSION_DATE}) is in the future (today: ${TODAY_DATE})." >&2
    exit 1
  fi
fi

EXPECTED_PLUGIN_BRANCH="${FVPLUS_EXPECT_PLUGIN_BRANCH:-}"
if [[ -z "${EXPECTED_PLUGIN_BRANCH}" ]]; then
  if [[ "${GITHUB_BASE_REF:-}" =~ ^(main|dev)$ ]]; then
    EXPECTED_PLUGIN_BRANCH="${GITHUB_BASE_REF}"
  elif [[ -n "${GITHUB_REF_NAME:-}" ]]; then
    EXPECTED_PLUGIN_BRANCH="${GITHUB_REF_NAME#refs/heads/}"
  elif command -v git >/dev/null 2>&1 && git -C "${ROOT_DIR}" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    EXPECTED_PLUGIN_BRANCH="$(git -C "${ROOT_DIR}" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
  fi
fi
if [[ ! -f "${CA_TEMPLATE_FILE}" ]]; then
  echo "ERROR: Missing CA template file: ${CA_TEMPLATE_FILE}" >&2
  exit 1
fi

CA_TEMPLATE_DATE="$(sed -n 's|.*<Date>\([^<]*\)</Date>.*|\1|p' "${CA_TEMPLATE_FILE}" | head -n 1 || true)"
if [[ -z "${CA_TEMPLATE_DATE}" ]]; then
  echo "ERROR: Could not parse <Date> from ${CA_TEMPLATE_FILE}" >&2
  exit 1
fi

EXPECTED_CA_TEMPLATE_DATE="${VERSION_DATE//./-}"
if [[ "${CA_TEMPLATE_DATE}" != "${EXPECTED_CA_TEMPLATE_DATE}" ]]; then
  echo "ERROR: CA template <Date> mismatch. expected=${EXPECTED_CA_TEMPLATE_DATE}, found=${CA_TEMPLATE_DATE}" >&2
  exit 1
fi
if [[ "${EXPECTED_PLUGIN_BRANCH}" =~ ^(main|dev)$ ]]; then
  PLUGIN_URL_ENTITY="$(sed -n 's/^<!ENTITY pluginURL "\([^"]*\)".*/\1/p' "${PLG_FILE}" | head -n 1 || true)"
  if [[ -z "${PLUGIN_URL_ENTITY}" ]]; then
    echo "ERROR: Could not parse pluginURL entity from folderview.plus.plg" >&2
    exit 1
  fi
  EXPECTED_PLUGIN_URL="https://raw.githubusercontent.com/&github;/${EXPECTED_PLUGIN_BRANCH}/folderview.plus.plg"
  if [[ "${PLUGIN_URL_ENTITY}" != "${EXPECTED_PLUGIN_URL}" ]]; then
    echo "ERROR: pluginURL branch mismatch. expected=${EXPECTED_PLUGIN_URL}, found=${PLUGIN_URL_ENTITY}" >&2
    exit 1
  fi

  ARCHIVE_URL_TEMPLATE="$(sed -n 's|.*<URL>\(https://raw.githubusercontent.com/&github;/[^<]*/archive/&name;-&version;.txz\)</URL>.*|\1|p' "${PLG_FILE}" | head -n 1 || true)"
  if [[ -z "${ARCHIVE_URL_TEMPLATE}" ]]; then
    echo "ERROR: Could not parse archive URL template from folderview.plus.plg" >&2
    exit 1
  fi
  EXPECTED_ARCHIVE_URL="https://raw.githubusercontent.com/&github;/${EXPECTED_PLUGIN_BRANCH}/archive/&name;-&version;.txz"
  if [[ "${ARCHIVE_URL_TEMPLATE}" != "${EXPECTED_ARCHIVE_URL}" ]]; then
    echo "ERROR: archive URL branch mismatch. expected=${EXPECTED_ARCHIVE_URL}, found=${ARCHIVE_URL_TEMPLATE}" >&2
    exit 1
  fi
  EXPECTED_ICON_PACK_URL="https://raw.githubusercontent.com/&github;/${EXPECTED_PLUGIN_BRANCH}/asset-packs/folderview.plus-icons-&iconPackVersion;.txz"
  if [[ "${ICON_PACK_URL_ENTITY}" != "${EXPECTED_ICON_PACK_URL}" ]]; then
    echo "ERROR: icon asset-pack URL branch mismatch. expected=${EXPECTED_ICON_PACK_URL}, found=${ICON_PACK_URL_ENTITY}" >&2
    exit 1
  fi
fi

if command -v xmllint >/dev/null 2>&1; then
  xmllint --noout "${PLG_FILE}"
else
  PHP_BIN="$(resolve_php_bin)"
  # shellcheck disable=SC2016
  "${PHP_BIN}" -r '
      libxml_use_internal_errors(true);
      $xml = stream_get_contents(STDIN);
      if ($xml === false || $xml === "") { fwrite(STDERR, "ERROR: Failed to read PLG file\n"); exit(1); }
      $dom = new DOMDocument();
      if (!$dom->loadXML($xml, LIBXML_NONET | LIBXML_NOERROR | LIBXML_NOWARNING)) {
          fwrite(STDERR, "ERROR: Invalid PLG XML\n");
          exit(1);
      }
  ' < "${PLG_FILE}"
fi

ARCHIVE_FILE="${ARCHIVE_DIR}/folderview.plus-${VERSION}.txz"
if [[ ! -f "${ARCHIVE_FILE}" ]]; then
  echo "ERROR: Missing archive package for current version: ${ARCHIVE_FILE}" >&2
  exit 1
fi

ARCHIVE_SIZE_BYTES="$(wc -c < "${ARCHIVE_FILE}" | tr -d '[:space:]')"
if [[ -z "${ARCHIVE_SIZE_BYTES}" || "${ARCHIVE_SIZE_BYTES}" -gt "${MAX_ARCHIVE_BYTES}" ]]; then
  echo "ERROR: Archive exceeds size budget (${ARCHIVE_SIZE_BYTES:-unknown} bytes > ${MAX_ARCHIVE_BYTES} bytes)." >&2
  exit 1
fi

SOURCE_FOLDER_JS="${ROOT_DIR}/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.js"
SOURCE_DOCKER_RUNTIME_HIERARCHY_JS="${ROOT_DIR}/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.hierarchy.js"
SOURCE_DOCKER_RUNTIME_ACTIONS_JS="${ROOT_DIR}/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.actions.js"
SOURCE_FOLDER_SETTINGS_TRANSFER_JS="${ROOT_DIR}/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.settings-transfer.js"
SOURCE_FOLDER_CSS="${ROOT_DIR}/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/folder.css"
SOURCE_SETTINGS_JS="${ROOT_DIR}/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.js"
SOURCE_SETTINGS_DIRTY_JS="${ROOT_DIR}/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.dirty.js"
SOURCE_SETTINGS_RUNTIME_PARITY_JS="${ROOT_DIR}/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.runtime-parity.js"
SOURCE_SETTINGS_SECTIONS_JS="${ROOT_DIR}/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.settings-sections.js"
SOURCE_SETTINGS_SETUP_ASSISTANT_JS="${ROOT_DIR}/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.setup-assistant.js"
SOURCE_SETTINGS_SMART_DETECT_CONFIG_JS="${ROOT_DIR}/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.smart-detect-config.js"
SOURCE_SETTINGS_STARTER_TEMPLATES_JS="${ROOT_DIR}/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.starter-templates.js"
SOURCE_SETTINGS_SUPPORT_BUNDLE_PREVIEW_JS="${ROOT_DIR}/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.support-bundle-preview.js"
SOURCE_SETTINGS_SUPPORT_BUNDLE_TELEMETRY_JS="${ROOT_DIR}/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.support-bundle-telemetry.js"
SOURCE_SETTINGS_ACTIVITY_DIAGNOSTICS_JS="${ROOT_DIR}/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.activity-diagnostics.js"
SOURCE_SETTINGS_TREE_JS="${ROOT_DIR}/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.settings-tree.js"
SOURCE_SETTINGS_TREE_INTEGRITY_JS="${ROOT_DIR}/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.tree-integrity.js"
SOURCE_SETTINGS_MOBILE_REORDER_JS="${ROOT_DIR}/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.mobile-reorder.js"
SOURCE_SETTINGS_FOLDER_EDITOR_JS="${ROOT_DIR}/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.folder-editor.js"
SOURCE_SETTINGS_HEALTH_JS="${ROOT_DIR}/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.settings-health.js"
SOURCE_SETTINGS_WORKSPACES_JS="${ROOT_DIR}/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.settings-workspaces.js"
SOURCE_SETTINGS_BULK_ASSIGNMENT_SHARED_JS="${ROOT_DIR}/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.bulk-assignment.shared.js"
SOURCE_SETTINGS_BULK_ASSIGNMENT_JS="${ROOT_DIR}/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.bulk-assignment.js"
SOURCE_SETTINGS_RUNTIME_ACTIONS_JS="${ROOT_DIR}/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.runtime-actions.js"
SOURCE_SETTINGS_WIZARD_JS="${ROOT_DIR}/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.wizard.js"
SOURCE_SETTINGS_IMPORT_JS="${ROOT_DIR}/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.import.js"
SOURCE_SETTINGS_CSS="${ROOT_DIR}/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/folderviewplus.css"
SOURCE_SETTINGS_DOWNLOAD_DIAGNOSTICS_CSS="${ROOT_DIR}/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/folderviewplus.download-diagnostics.css"
SOURCE_FOLDER_PAGE="${ROOT_DIR}/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/Folder.page"
SOURCE_SETTINGS_PAGE="${ROOT_DIR}/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/FolderViewPlus.page"
SOURCE_SERVER_LIB="${ROOT_DIR}/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.php"
SOURCE_SERVER_LIB_DIAGNOSTICS="${ROOT_DIR}/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.diagnostics.php"
SOURCE_SERVER_APPLY_FOLDER_SETTINGS="${ROOT_DIR}/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/apply_folder_settings.php"
SOURCE_SERVER_UPDATE_NOTES="${ROOT_DIR}/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/update_notes.php"

if [[ ! -f "${SOURCE_FOLDER_JS}" ]]; then
  echo "ERROR: Missing source folder editor script: ${SOURCE_FOLDER_JS}" >&2
  exit 1
fi
if [[ ! -f "${SOURCE_DOCKER_RUNTIME_HIERARCHY_JS}" ]]; then
  echo "ERROR: Missing source Docker hierarchy helper script: ${SOURCE_DOCKER_RUNTIME_HIERARCHY_JS}" >&2
  exit 1
fi
if [[ ! -f "${SOURCE_DOCKER_RUNTIME_ACTIONS_JS}" ]]; then
  echo "ERROR: Missing source Docker action helper script: ${SOURCE_DOCKER_RUNTIME_ACTIONS_JS}" >&2
  exit 1
fi
if [[ ! -f "${SOURCE_FOLDER_SETTINGS_TRANSFER_JS}" ]]; then
  echo "ERROR: Missing source folder settings transfer script: ${SOURCE_FOLDER_SETTINGS_TRANSFER_JS}" >&2
  exit 1
fi
if [[ ! -f "${SOURCE_FOLDER_CSS}" ]]; then
  echo "ERROR: Missing source folder editor stylesheet: ${SOURCE_FOLDER_CSS}" >&2
  exit 1
fi
if [[ ! -f "${SOURCE_SETTINGS_JS}" ]]; then
  echo "ERROR: Missing source settings script: ${SOURCE_SETTINGS_JS}" >&2
  exit 1
fi
if [[ ! -f "${SOURCE_SETTINGS_DIRTY_JS}" ]]; then
  echo "ERROR: Missing source settings dirty-tracker script: ${SOURCE_SETTINGS_DIRTY_JS}" >&2
  exit 1
fi
if [[ ! -f "${SOURCE_SETTINGS_RUNTIME_PARITY_JS}" ]]; then
  echo "ERROR: Missing source settings runtime parity script: ${SOURCE_SETTINGS_RUNTIME_PARITY_JS}" >&2
  exit 1
fi
if [[ ! -f "${SOURCE_SETTINGS_SECTIONS_JS}" ]]; then
  echo "ERROR: Missing source settings section registry script: ${SOURCE_SETTINGS_SECTIONS_JS}" >&2
  exit 1
fi
if [[ ! -f "${SOURCE_SETTINGS_SETUP_ASSISTANT_JS}" ]]; then
  echo "ERROR: Missing source settings setup assistant support script: ${SOURCE_SETTINGS_SETUP_ASSISTANT_JS}" >&2
  exit 1
fi
if [[ ! -f "${SOURCE_SETTINGS_SMART_DETECT_CONFIG_JS}" ]]; then
  echo "ERROR: Missing source settings smart-detect config script: ${SOURCE_SETTINGS_SMART_DETECT_CONFIG_JS}" >&2
  exit 1
fi
if [[ ! -f "${SOURCE_SETTINGS_STARTER_TEMPLATES_JS}" ]]; then
  echo "ERROR: Missing source settings starter templates script: ${SOURCE_SETTINGS_STARTER_TEMPLATES_JS}" >&2
  exit 1
fi
if [[ ! -f "${SOURCE_SETTINGS_SUPPORT_BUNDLE_PREVIEW_JS}" ]]; then
  echo "ERROR: Missing source settings support-bundle preview script: ${SOURCE_SETTINGS_SUPPORT_BUNDLE_PREVIEW_JS}" >&2
  exit 1
fi
if [[ ! -f "${SOURCE_SETTINGS_SUPPORT_BUNDLE_TELEMETRY_JS}" ]]; then
  echo "ERROR: Missing source settings support-bundle telemetry script: ${SOURCE_SETTINGS_SUPPORT_BUNDLE_TELEMETRY_JS}" >&2
  exit 1
fi
if [[ ! -f "${SOURCE_SETTINGS_ACTIVITY_DIAGNOSTICS_JS}" ]]; then
  echo "ERROR: Missing source settings activity/diagnostics script: ${SOURCE_SETTINGS_ACTIVITY_DIAGNOSTICS_JS}" >&2
  exit 1
fi
if [[ ! -f "${SOURCE_SETTINGS_TREE_JS}" ]]; then
  echo "ERROR: Missing source settings tree script: ${SOURCE_SETTINGS_TREE_JS}" >&2
  exit 1
fi
if [[ ! -f "${SOURCE_SETTINGS_TREE_INTEGRITY_JS}" ]]; then
  echo "ERROR: Missing source settings tree integrity script: ${SOURCE_SETTINGS_TREE_INTEGRITY_JS}" >&2
  exit 1
fi
if [[ ! -f "${SOURCE_SETTINGS_MOBILE_REORDER_JS}" ]]; then
  echo "ERROR: Missing source settings mobile reorder script: ${SOURCE_SETTINGS_MOBILE_REORDER_JS}" >&2
  exit 1
fi
if [[ ! -f "${SOURCE_SETTINGS_FOLDER_EDITOR_JS}" ]]; then
  echo "ERROR: Missing source settings folder editor script: ${SOURCE_SETTINGS_FOLDER_EDITOR_JS}" >&2
  exit 1
fi
if [[ ! -f "${SOURCE_SETTINGS_HEALTH_JS}" ]]; then
  echo "ERROR: Missing source settings health script: ${SOURCE_SETTINGS_HEALTH_JS}" >&2
  exit 1
fi
if [[ ! -f "${SOURCE_SETTINGS_WORKSPACES_JS}" ]]; then
  echo "ERROR: Missing source settings workspaces script: ${SOURCE_SETTINGS_WORKSPACES_JS}" >&2
  exit 1
fi
if [[ ! -f "${SOURCE_SETTINGS_BULK_ASSIGNMENT_SHARED_JS}" ]]; then
  echo "ERROR: Missing source settings bulk assignment shared script: ${SOURCE_SETTINGS_BULK_ASSIGNMENT_SHARED_JS}" >&2
  exit 1
fi
if [[ ! -f "${SOURCE_SETTINGS_BULK_ASSIGNMENT_JS}" ]]; then
  echo "ERROR: Missing source settings bulk assignment script: ${SOURCE_SETTINGS_BULK_ASSIGNMENT_JS}" >&2
  exit 1
fi
if [[ ! -f "${SOURCE_SETTINGS_RUNTIME_ACTIONS_JS}" ]]; then
  echo "ERROR: Missing source settings runtime actions script: ${SOURCE_SETTINGS_RUNTIME_ACTIONS_JS}" >&2
  exit 1
fi
if [[ ! -f "${SOURCE_SETTINGS_WIZARD_JS}" ]]; then
  echo "ERROR: Missing source settings setup-assistant script: ${SOURCE_SETTINGS_WIZARD_JS}" >&2
  exit 1
fi
if [[ ! -f "${SOURCE_SETTINGS_IMPORT_JS}" ]]; then
  echo "ERROR: Missing source settings import workflow script: ${SOURCE_SETTINGS_IMPORT_JS}" >&2
  exit 1
fi
if [[ ! -f "${SOURCE_SETTINGS_CSS}" ]]; then
  echo "ERROR: Missing source settings stylesheet: ${SOURCE_SETTINGS_CSS}" >&2
  exit 1
fi
if [[ ! -f "${SOURCE_SETTINGS_DOWNLOAD_DIAGNOSTICS_CSS}" ]]; then
  echo "ERROR: Missing source download diagnostics stylesheet: ${SOURCE_SETTINGS_DOWNLOAD_DIAGNOSTICS_CSS}" >&2
  exit 1
fi
if [[ ! -f "${SOURCE_FOLDER_PAGE}" ]]; then
  echo "ERROR: Missing source folder editor page: ${SOURCE_FOLDER_PAGE}" >&2
  exit 1
fi
if [[ ! -f "${SOURCE_SETTINGS_PAGE}" ]]; then
  echo "ERROR: Missing source settings page: ${SOURCE_SETTINGS_PAGE}" >&2
  exit 1
fi
if [[ ! -f "${SOURCE_SERVER_LIB}" ]]; then
  echo "ERROR: Missing source server lib: ${SOURCE_SERVER_LIB}" >&2
  exit 1
fi
if [[ ! -f "${SOURCE_SERVER_LIB_DIAGNOSTICS}" ]]; then
  echo "ERROR: Missing source server diagnostics lib: ${SOURCE_SERVER_LIB_DIAGNOSTICS}" >&2
  exit 1
fi
if [[ ! -f "${SOURCE_SERVER_APPLY_FOLDER_SETTINGS}" ]]; then
  echo "ERROR: Missing source server apply-folder-settings endpoint: ${SOURCE_SERVER_APPLY_FOLDER_SETTINGS}" >&2
  exit 1
fi
if [[ ! -f "${SOURCE_SERVER_UPDATE_NOTES}" ]]; then
  echo "ERROR: Missing source server update notes endpoint: ${SOURCE_SERVER_UPDATE_NOTES}" >&2
  exit 1
fi

ARCHIVE_LIST="$(tar -tf "${ARCHIVE_FILE}")"
ARCHIVE_LIST_NORMALIZED="$(printf '%s\n' "${ARCHIVE_LIST}" | sed 's#^\./##')"
ARCHIVE_FILES_ONLY="$(printf '%s\n' "${ARCHIVE_LIST_NORMALIZED}" | grep -Ev '/$' || true)"
if grep -q '^usr/local/emhttp/plugins/folderview.plus/images/third-party-icons/' <<< "${ARCHIVE_LIST_NORMALIZED}"; then
  echo "ERROR: Core plugin archive still embeds the versioned third-party icon library." >&2
  exit 1
fi

ARCHIVE_FILE_COUNT="$(printf '%s\n' "${ARCHIVE_FILES_ONLY}" | sed '/^$/d' | wc -l | tr -d '[:space:]')"
if [[ -z "${ARCHIVE_FILE_COUNT}" || "${ARCHIVE_FILE_COUNT}" -gt "${MAX_ARCHIVE_FILE_COUNT}" ]]; then
  echo "ERROR: Archive file count exceeds budget (${ARCHIVE_FILE_COUNT:-unknown} > ${MAX_ARCHIVE_FILE_COUNT})." >&2
  exit 1
fi

if grep -q '^./local/' <<< "${ARCHIVE_LIST}"; then
  echo "ERROR: Archive contains invalid top-level './local/' paths. Must install under './usr/local/'." >&2
  exit 1
fi

DANGEROUS_ARCHIVE_EXTENSIONS='exe|dll|bat|cmd|com|msi|scr|ps1|jar|apk|deb|rpm|dmg|pkg|appimage|iso'
DANGEROUS_ARCHIVE_FILES="$(printf '%s\n' "${ARCHIVE_FILES_ONLY}" | grep -Ei "\.(${DANGEROUS_ARCHIVE_EXTENSIONS})$" || true)"
if [[ -n "${DANGEROUS_ARCHIVE_FILES}" ]]; then
  echo "ERROR: Archive contains blocked executable/binary artifacts:" >&2
  echo "${DANGEROUS_ARCHIVE_FILES}" >&2
  exit 1
fi

ALLOWED_ARCHIVE_EXTENSIONS='page|php|js|css|png|jpg|jpeg|gif|webp|svg|bmp|ico|avif|json|md|txt|woff|woff2|ttf|eot|otf|map'
UNEXPECTED_ARCHIVE_FILES="$(
  printf '%s\n' "${ARCHIVE_FILES_ONLY}" \
    | grep -Evi "\.(${ALLOWED_ARCHIVE_EXTENSIONS})$" \
    | grep -Fvx 'install/slack-desc' \
    | grep -Fvx 'usr/local/emhttp/plugins/folderview.plus/scripts/archive_preflight.sh' \
    | grep -Fvx 'usr/local/emhttp/plugins/folderview.plus/scripts/install_icon_asset_pack.sh' \
    | grep -Fvx 'usr/local/emhttp/plugins/folderview.plus/scripts/install_report.sh' \
    || true
)"
if [[ -n "${UNEXPECTED_ARCHIVE_FILES}" ]]; then
  echo "ERROR: Archive contains files with unexpected extensions:" >&2
  echo "${UNEXPECTED_ARCHIVE_FILES}" >&2
  exit 1
fi

REQUIRED_ARCHIVE_PATHS=(
  "./install/slack-desc"
  "./usr/local/emhttp/plugins/folderview.plus/build-metadata.json"
  "./usr/local/emhttp/plugins/folderview.plus/runtime-integrity.json"
  "./usr/local/emhttp/plugins/folderview.plus/scripts/archive_preflight.sh"
  "./usr/local/emhttp/plugins/folderview.plus/scripts/install_report.sh"
  "./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.csp-events.js"
  "./usr/local/emhttp/plugins/folderview.plus/scripts/folder.js"
  "./usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.hierarchy.js"
  "./usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.actions.js"
  "./usr/local/emhttp/plugins/folderview.plus/scripts/folder.settings-transfer.js"
  "./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.js"
  "./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.dirty.js"
  "./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.runtime-parity.js"
  "./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.settings-sections.js"
  "./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.setup-assistant.js"
  "./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.smart-detect-config.js"
  "./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.starter-templates.js"
  "./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.support-bundle-preview.js"
  "./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.support-bundle-telemetry.js"
  "./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.diagnostics-view-model.js"
  "./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.diagnostics-view.js"
  "./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.activity-diagnostics.js"
  "./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.settings-tree.js"
  "./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.tree-integrity.js"
  "./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.mobile-reorder.js"
  "./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.folder-editor.js"
  "./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.settings-health.js"
  "./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.settings-workspaces.js"
  "./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.bulk-assignment.shared.js"
  "./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.bulk-assignment.js"
  "./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.runtime-actions.js"
  "./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.runtime-snapshot.js"
  "./usr/local/emhttp/plugins/folderview.plus/scripts/folder.editor.preview-runtime.js"
  "./usr/local/emhttp/plugins/folderview.plus/scripts/folder.editor.icons.js"
  "./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.wizard.js"
  "./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.import.js"
  "./usr/local/emhttp/plugins/folderview.plus/styles/folder.css"
  "./usr/local/emhttp/plugins/folderview.plus/styles/folderviewplus.css"
  "./usr/local/emhttp/plugins/folderview.plus/styles/folderviewplus.download-diagnostics.css"
  "./usr/local/emhttp/plugins/folderview.plus/Folder.page"
  "./usr/local/emhttp/plugins/folderview.plus/FolderViewPlus.page"
  "./usr/local/emhttp/plugins/folderview.plus/server/lib.php"
  "./usr/local/emhttp/plugins/folderview.plus/server/lib.process.php"
  "./usr/local/emhttp/plugins/folderview.plus/server/lib.filesystem-security.php"
  "./usr/local/emhttp/plugins/folderview.plus/server/lib.security.php"
  "./usr/local/emhttp/plugins/folderview.plus/server/lib.diagnostics.php"
  "./usr/local/emhttp/plugins/folderview.plus/server/lib.runtime-snapshot.php"
  "./usr/local/emhttp/plugins/folderview.plus/server/runtime_snapshot.php"
  "./usr/local/emhttp/plugins/folderview.plus/server/security.php"
  "./usr/local/emhttp/plugins/folderview.plus/server/apply_folder_settings.php"
  "./usr/local/emhttp/plugins/folderview.plus/server/update_notes.php"
)

for required_path in "${REQUIRED_ARCHIVE_PATHS[@]}"; do
  normalized_required_path="${required_path#./}"
  if ! grep -Fxq "${normalized_required_path}" <<< "${ARCHIVE_LIST_NORMALIZED}"; then
    echo "ERROR: Missing required archive entry: ${required_path}" >&2
    exit 1
  fi
done

ARCHIVE_BUILD_METADATA_PATH="./usr/local/emhttp/plugins/folderview.plus/build-metadata.json"
BUILD_METADATA_JSON="$(tar -xOf "${ARCHIVE_FILE}" "${ARCHIVE_BUILD_METADATA_PATH}")"
"${NODE_BIN}" - "${BUILD_METADATA_JSON}" "${VERSION}" "${EXPECTED_PLUGIN_BRANCH}" <<'NODE'
const metadata = JSON.parse(process.argv[2] || '{}');
const version = String(process.argv[3] || '');
const branch = String(process.argv[4] || '');
const expectedArchiveUrl = `https://raw.githubusercontent.com/alexphillips-dev/FolderView-Plus/${branch}/archive/folderview.plus-${version}.txz`;
const fail = (message) => {
  console.error(`ERROR: Packaged build metadata ${message}`);
  process.exit(1);
};
if (metadata.packageVersion !== version) fail('version does not match the manifest.');
if (metadata.sourceBranch !== branch) fail('branch does not match the release channel.');
if (metadata.archiveUrl !== expectedArchiveUrl) fail('archive URL does not match version and channel.');
if (!/^[a-f0-9]{64}$/.test(String(metadata.sourceContentSha256 || ''))) fail('source content digest is invalid.');
if (metadata.sourceSnapshotMode !== 'content' || metadata.sourceCommitExact !== false) {
  fail('must use the reproducible content-addressed snapshot contract.');
}
for (const field of ['sourceCommitSha', 'headCommitSha', 'sourceTreeSha']) {
  if (String(metadata[field] || '') !== '') fail(`${field} must remain empty to avoid self-referential archives.`);
}
NODE

ARCHIVE_RUNTIME_INTEGRITY_PATH="./usr/local/emhttp/plugins/folderview.plus/runtime-integrity.json"
TMP_ARCHIVE_RUNTIME_INTEGRITY="$(mktemp)"
trap 'rm -f "${TMP_ARCHIVE_RUNTIME_INTEGRITY}"' EXIT
tar -xOf "${ARCHIVE_FILE}" "${ARCHIVE_RUNTIME_INTEGRITY_PATH}" > "${TMP_ARCHIVE_RUNTIME_INTEGRITY}"
NODE_RUNTIME_INTEGRITY_PATH="$(fvplus::path_for_command "${NODE_BIN}" "${TMP_ARCHIVE_RUNTIME_INTEGRITY}")"
"${NODE_BIN}" - "${NODE_RUNTIME_INTEGRITY_PATH}" <<'NODE'
const fs = require('node:fs');
const manifest = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const fail = (message) => {
  console.error(`ERROR: Packaged runtime integrity manifest ${message}`);
  process.exit(1);
};
if (manifest.schemaVersion !== 1 || manifest.algorithm !== 'sha256') fail('has an invalid schema or algorithm.');
if (!Array.isArray(manifest.files) || manifest.files.length < 100 || manifest.files.length > 1000) {
  fail('has an implausible file inventory.');
}
const paths = new Set();
for (const entry of manifest.files) {
  if (!entry || typeof entry.path !== 'string' || !/^[^/].+/.test(entry.path) || entry.path.includes('..')) {
    fail('contains an invalid relative path.');
  }
  if (!/^[a-f0-9]{64}$/.test(String(entry.sha256 || '')) || !Number.isInteger(entry.size) || entry.size < 0) {
    fail(`contains invalid metadata for ${entry.path || 'unknown'}.`);
  }
  if (entry.mode !== '0755' || paths.has(entry.path)) fail(`contains a duplicate or invalid mode for ${entry.path}.`);
  paths.add(entry.path);
}
for (const required of [
  'server/lib.php',
  'server/lib.security.php',
  'server/security.php',
  'scripts/folderviewplus.request.js'
]) {
  if (!paths.has(required)) fail(`does not cover ${required}.`);
}
NODE
rm -f "${TMP_ARCHIVE_RUNTIME_INTEGRITY}"
trap - EXIT

if ! grep -q 'click\.fvsectionheader' "${SOURCE_SETTINGS_JS}"; then
  echo "ERROR: Source folderviewplus.js is missing mobile section-toggle header binding." >&2
  exit 1
fi
if ! grep -Fq 'h2[data-fv-section][data-fv-advanced="1"]' "${SOURCE_SETTINGS_JS}"; then
  echo "ERROR: Source folderviewplus.js is missing advanced-section heading selector for mobile support." >&2
  exit 1
fi
if ! grep -q 'window.FolderViewPlusDirtyTracker' "${SOURCE_SETTINGS_JS}"; then
  echo "ERROR: Source folderviewplus.js is missing dirty-tracker module integration." >&2
  exit 1
fi
if ! grep -q 'folderviewplus\.dirty\.js' "${SOURCE_SETTINGS_PAGE}"; then
  echo "ERROR: Source FolderViewPlus.page is missing folderviewplus.dirty.js include." >&2
  exit 1
fi
if ! grep -q 'folderviewplus\.runtime-parity\.js' "${SOURCE_SETTINGS_PAGE}"; then
  echo "ERROR: Source FolderViewPlus.page is missing folderviewplus.runtime-parity.js include." >&2
  exit 1
fi
if ! grep -q 'folderviewplus\.settings-sections\.js' "${SOURCE_SETTINGS_PAGE}"; then
  echo "ERROR: Source FolderViewPlus.page is missing folderviewplus.settings-sections.js include." >&2
  exit 1
fi
if ! grep -q 'folderviewplus\.setup-assistant\.js' "${SOURCE_SETTINGS_PAGE}"; then
  echo "ERROR: Source FolderViewPlus.page is missing folderviewplus.setup-assistant.js include." >&2
  exit 1
fi
if ! grep -q 'folderviewplus\.starter-templates\.js' "${SOURCE_SETTINGS_PAGE}"; then
  echo "ERROR: Source FolderViewPlus.page is missing folderviewplus.starter-templates.js include." >&2
  exit 1
fi
if ! grep -q 'folderviewplus\.support-bundle-preview\.js' "${SOURCE_SETTINGS_PAGE}"; then
  echo "ERROR: Source FolderViewPlus.page is missing folderviewplus.support-bundle-preview.js include." >&2
  exit 1
fi
if ! grep -q 'folderviewplus\.support-bundle-telemetry\.js' "${SOURCE_SETTINGS_PAGE}"; then
  echo "ERROR: Source FolderViewPlus.page is missing folderviewplus.support-bundle-telemetry.js include." >&2
  exit 1
fi
if ! grep -q 'folderviewplus\.diagnostics-view-model\.js' "${SOURCE_SETTINGS_PAGE}"; then
  echo "ERROR: Source FolderViewPlus.page is missing folderviewplus.diagnostics-view-model.js include." >&2
  exit 1
fi
if ! grep -q 'folderviewplus\.diagnostics-view\.js' "${SOURCE_SETTINGS_PAGE}"; then
  echo "ERROR: Source FolderViewPlus.page is missing folderviewplus.diagnostics-view.js include." >&2
  exit 1
fi
if ! grep -q 'folderviewplus\.activity-diagnostics\.js' "${SOURCE_SETTINGS_PAGE}"; then
  echo "ERROR: Source FolderViewPlus.page is missing folderviewplus.activity-diagnostics.js include." >&2
  exit 1
fi
if ! grep -q 'folderviewplus\.settings-tree\.js' "${SOURCE_SETTINGS_PAGE}"; then
  echo "ERROR: Source FolderViewPlus.page is missing folderviewplus.settings-tree.js include." >&2
  exit 1
fi
if ! grep -q 'folderviewplus\.tree-integrity\.js' "${SOURCE_SETTINGS_PAGE}"; then
  echo "ERROR: Source FolderViewPlus.page is missing folderviewplus.tree-integrity.js include." >&2
  exit 1
fi
if ! grep -q 'folderviewplus\.mobile-reorder\.js' "${SOURCE_SETTINGS_PAGE}"; then
  echo "ERROR: Source FolderViewPlus.page is missing folderviewplus.mobile-reorder.js include." >&2
  exit 1
fi
if ! grep -q 'folderviewplus\.folder-editor\.js' "${SOURCE_SETTINGS_PAGE}"; then
  echo "ERROR: Source FolderViewPlus.page is missing folderviewplus.folder-editor.js include." >&2
  exit 1
fi
if ! grep -q 'folderviewplus\.bulk-assignment\.shared\.js' "${SOURCE_SETTINGS_PAGE}"; then
  echo "ERROR: Source FolderViewPlus.page is missing folderviewplus.bulk-assignment.shared.js include." >&2
  exit 1
fi
if ! grep -q 'folderviewplus\.bulk-assignment\.js' "${SOURCE_SETTINGS_PAGE}"; then
  echo "ERROR: Source FolderViewPlus.page is missing folderviewplus.bulk-assignment.js include." >&2
  exit 1
fi
if ! grep -q 'folderviewplus\.runtime-actions\.js' "${SOURCE_SETTINGS_PAGE}"; then
  echo "ERROR: Source FolderViewPlus.page is missing folderviewplus.runtime-actions.js include." >&2
  exit 1
fi
if ! grep -q 'folderviewplus\.wizard\.js' "${SOURCE_SETTINGS_PAGE}"; then
  echo "ERROR: Source FolderViewPlus.page is missing folderviewplus.wizard.js include." >&2
  exit 1
fi
if ! grep -q 'folderviewplus\.import\.js' "${SOURCE_SETTINGS_PAGE}"; then
  echo "ERROR: Source FolderViewPlus.page is missing folderviewplus.import.js include." >&2
  exit 1
fi
bash "${ROOT_DIR}/scripts/include_order_guard.sh"
bash "${ROOT_DIR}/scripts/theme_runtime_guard.sh"
if ! grep -q '@media (max-width: 760px)' "${SOURCE_SETTINGS_CSS}"; then
  echo "ERROR: Source folderviewplus.css is missing mobile settings breakpoint rules." >&2
  exit 1
fi
if ! grep -q '\.fv-section-toggle::before' "${SOURCE_SETTINGS_CSS}"; then
  echo "ERROR: Source folderviewplus.css is missing mobile-friendly section toggle affordance." >&2
  exit 1
fi

if ! grep -Eq "define\('FV3_DEBUG_MODE', false\)" "${SERVER_DIR}/lib.php"; then
  echo "ERROR: FV3_DEBUG_MODE must be false for release builds." >&2
  exit 1
fi
if grep -Eq "define\('FV3_DEBUG_MODE', true\)" "${SERVER_DIR}/lib.php"; then
  echo "ERROR: FV3_DEBUG_MODE is enabled in lib.php." >&2
  exit 1
fi
if grep -Eq 'const FOLDER_VIEW_DEBUG_MODE = true;' "${PLUGIN_SRC_DIR}/scripts/docker.js"; then
  echo "ERROR: FOLDER_VIEW_DEBUG_MODE is enabled in docker.js." >&2
  exit 1
fi
if grep -Eq 'const VM_DEBUG_MODE = true;' "${PLUGIN_SRC_DIR}/scripts/vm.js"; then
  echo "ERROR: VM_DEBUG_MODE is enabled in vm.js." >&2
  exit 1
fi
if grep -Eq 'const DASHBOARD_DEBUG_MODE = true;' "${PLUGIN_SRC_DIR}/scripts/dashboard.js"; then
  echo "ERROR: DASHBOARD_DEBUG_MODE is enabled in dashboard.js." >&2
  exit 1
fi

if command -v rg >/dev/null 2>&1; then
  TARGET_BLANK_LINES="$(rg -n 'target=\"_blank\"' "${PLUGIN_SRC_DIR}" -g '*.js' -g '*.page' || true)"
else
  TARGET_BLANK_LINES="$(grep -RIn --include='*.js' --include='*.page' 'target="_blank"' "${PLUGIN_SRC_DIR}" || true)"
fi
if [[ -n "${TARGET_BLANK_LINES}" ]]; then
  TARGET_BLANK_MISSING_REL="$(printf '%s\n' "${TARGET_BLANK_LINES}" | grep -Ev 'rel=\"noopener noreferrer\"' || true)"
  if [[ -n "${TARGET_BLANK_MISSING_REL}" ]]; then
    echo "ERROR: Found target=\"_blank\" without rel=\"noopener noreferrer\":" >&2
    echo "${TARGET_BLANK_MISSING_REL}" >&2
    exit 1
  fi
fi

if command -v rg >/dev/null 2>&1; then
  WINDOW_OPEN_BLANK_LINES="$(rg -n "window\\.open\\([^\\n]*['\"]_blank['\"]" "${PLUGIN_SRC_DIR}" -g '*.js' || true)"
else
  WINDOW_OPEN_BLANK_LINES="$(grep -RInE --include='*.js' "window\\.open\\([^)]*['_\"]_blank['_\"]" "${PLUGIN_SRC_DIR}" || true)"
fi
if [[ -n "${WINDOW_OPEN_BLANK_LINES}" ]]; then
  WINDOW_OPEN_MISSING_NOOPENER="$(printf '%s\n' "${WINDOW_OPEN_BLANK_LINES}" | grep -Evi 'noopener' || true)"
  if [[ -n "${WINDOW_OPEN_MISSING_NOOPENER}" ]]; then
    echo "ERROR: Found window.open(..., '_blank', ...) calls without noopener:" >&2
    echo "${WINDOW_OPEN_MISSING_NOOPENER}" >&2
    exit 1
  fi
fi

if [[ ! -f "${SERVER_DIR}/update_notes.php" ]]; then
  echo "ERROR: Missing update_notes.php endpoint." >&2
  exit 1
fi
if ! grep -q 'readCurrentVersionChangeSummary' "${SERVER_DIR}/update_notes.php"; then
  echo "ERROR: update_notes.php must use readCurrentVersionChangeSummary()." >&2
  exit 1
fi
if ! grep -q "'lines' =>" "${SERVER_DIR}/update_notes.php"; then
  echo "ERROR: update_notes.php must return lines payload." >&2
  exit 1
fi
if ! grep -q "'category' =>" "${SERVER_DIR}/update_notes.php"; then
  echo "ERROR: update_notes.php must return category payload." >&2
  exit 1
fi
if ! grep -q "'headline' =>" "${SERVER_DIR}/update_notes.php"; then
  echo "ERROR: update_notes.php must return headline payload." >&2
  exit 1
fi
if ! grep -q 'function classifyChangesCategory' "${SERVER_DIR}/lib.php"; then
  echo "ERROR: lib.php must define classifyChangesCategory()." >&2
  exit 1
fi
if ! grep -q 'function readCurrentVersionChangeSummary' "${SERVER_DIR}/lib.php"; then
  echo "ERROR: lib.php must define readCurrentVersionChangeSummary()." >&2
  exit 1
fi
current_version_notes_pattern="readChangesSummaryForVersion\\(readInstalledVersion\\(\\),[[:space:]]*\\\$maxLines,[[:space:]]*false\\)"
if ! grep -Eq "${current_version_notes_pattern}" "${SERVER_DIR}/lib.php"; then
  echo "ERROR: readCurrentVersionChangeSummary() must disable fallback so \"What Changed\" only shows current-version notes." >&2
  exit 1
fi

TMP_ARCHIVE_FOLDER_JS="$(mktemp)"
TMP_ARCHIVE_DOCKER_RUNTIME_HIERARCHY_JS="$(mktemp)"
TMP_ARCHIVE_DOCKER_RUNTIME_ACTIONS_JS="$(mktemp)"
TMP_ARCHIVE_FOLDER_SETTINGS_TRANSFER_JS="$(mktemp)"
TMP_ARCHIVE_FOLDER_CSS="$(mktemp)"
TMP_ARCHIVE_SETTINGS_JS="$(mktemp)"
TMP_ARCHIVE_SETTINGS_DIRTY_JS="$(mktemp)"
TMP_ARCHIVE_SETTINGS_RUNTIME_PARITY_JS="$(mktemp)"
TMP_ARCHIVE_SETTINGS_SECTIONS_JS="$(mktemp)"
TMP_ARCHIVE_SETTINGS_SETUP_ASSISTANT_JS="$(mktemp)"
TMP_ARCHIVE_SETTINGS_SMART_DETECT_CONFIG_JS="$(mktemp)"
TMP_ARCHIVE_SETTINGS_STARTER_TEMPLATES_JS="$(mktemp)"
TMP_ARCHIVE_SETTINGS_SUPPORT_BUNDLE_PREVIEW_JS="$(mktemp)"
TMP_ARCHIVE_SETTINGS_SUPPORT_BUNDLE_TELEMETRY_JS="$(mktemp)"
TMP_ARCHIVE_SETTINGS_ACTIVITY_DIAGNOSTICS_JS="$(mktemp)"
TMP_ARCHIVE_SETTINGS_TREE_JS="$(mktemp)"
TMP_ARCHIVE_SETTINGS_TREE_INTEGRITY_JS="$(mktemp)"
TMP_ARCHIVE_SETTINGS_MOBILE_REORDER_JS="$(mktemp)"
TMP_ARCHIVE_SETTINGS_FOLDER_EDITOR_JS="$(mktemp)"
TMP_ARCHIVE_SETTINGS_HEALTH_JS="$(mktemp)"
TMP_ARCHIVE_SETTINGS_WORKSPACES_JS="$(mktemp)"
TMP_ARCHIVE_SETTINGS_BULK_ASSIGNMENT_SHARED_JS="$(mktemp)"
TMP_ARCHIVE_SETTINGS_BULK_ASSIGNMENT_JS="$(mktemp)"
TMP_ARCHIVE_SETTINGS_RUNTIME_ACTIONS_JS="$(mktemp)"
TMP_ARCHIVE_SETTINGS_WIZARD_JS="$(mktemp)"
TMP_ARCHIVE_SETTINGS_IMPORT_JS="$(mktemp)"
TMP_ARCHIVE_SETTINGS_CSS="$(mktemp)"
TMP_ARCHIVE_SETTINGS_DOWNLOAD_DIAGNOSTICS_CSS="$(mktemp)"
TMP_ARCHIVE_FOLDER_PAGE="$(mktemp)"
TMP_ARCHIVE_SETTINGS_PAGE="$(mktemp)"
TMP_ARCHIVE_SERVER_LIB="$(mktemp)"
TMP_ARCHIVE_SERVER_LIB_DIAGNOSTICS="$(mktemp)"
TMP_ARCHIVE_SERVER_APPLY_FOLDER_SETTINGS="$(mktemp)"
TMP_ARCHIVE_SERVER_UPDATE_NOTES="$(mktemp)"
trap 'rm -f "${TMP_ARCHIVE_FOLDER_JS}" "${TMP_ARCHIVE_DOCKER_RUNTIME_HIERARCHY_JS}" "${TMP_ARCHIVE_DOCKER_RUNTIME_ACTIONS_JS}" "${TMP_ARCHIVE_FOLDER_SETTINGS_TRANSFER_JS}" "${TMP_ARCHIVE_FOLDER_CSS}" "${TMP_ARCHIVE_SETTINGS_JS}" "${TMP_ARCHIVE_SETTINGS_DIRTY_JS}" "${TMP_ARCHIVE_SETTINGS_RUNTIME_PARITY_JS}" "${TMP_ARCHIVE_SETTINGS_SECTIONS_JS}" "${TMP_ARCHIVE_SETTINGS_SETUP_ASSISTANT_JS}" "${TMP_ARCHIVE_SETTINGS_SMART_DETECT_CONFIG_JS}" "${TMP_ARCHIVE_SETTINGS_STARTER_TEMPLATES_JS}" "${TMP_ARCHIVE_SETTINGS_SUPPORT_BUNDLE_PREVIEW_JS}" "${TMP_ARCHIVE_SETTINGS_SUPPORT_BUNDLE_TELEMETRY_JS}" "${TMP_ARCHIVE_SETTINGS_ACTIVITY_DIAGNOSTICS_JS}" "${TMP_ARCHIVE_SETTINGS_TREE_JS}" "${TMP_ARCHIVE_SETTINGS_TREE_INTEGRITY_JS}" "${TMP_ARCHIVE_SETTINGS_MOBILE_REORDER_JS}" "${TMP_ARCHIVE_SETTINGS_FOLDER_EDITOR_JS}" "${TMP_ARCHIVE_SETTINGS_HEALTH_JS}" "${TMP_ARCHIVE_SETTINGS_WORKSPACES_JS}" "${TMP_ARCHIVE_SETTINGS_BULK_ASSIGNMENT_SHARED_JS}" "${TMP_ARCHIVE_SETTINGS_BULK_ASSIGNMENT_JS}" "${TMP_ARCHIVE_SETTINGS_RUNTIME_ACTIONS_JS}" "${TMP_ARCHIVE_SETTINGS_WIZARD_JS}" "${TMP_ARCHIVE_SETTINGS_IMPORT_JS}" "${TMP_ARCHIVE_SETTINGS_CSS}" "${TMP_ARCHIVE_SETTINGS_DOWNLOAD_DIAGNOSTICS_CSS}" "${TMP_ARCHIVE_FOLDER_PAGE}" "${TMP_ARCHIVE_SETTINGS_PAGE}" "${TMP_ARCHIVE_SERVER_LIB}" "${TMP_ARCHIVE_SERVER_LIB_DIAGNOSTICS}" "${TMP_ARCHIVE_SERVER_APPLY_FOLDER_SETTINGS}" "${TMP_ARCHIVE_SERVER_UPDATE_NOTES}"' EXIT
ARCHIVE_FOLDER_JS_PATH="./usr/local/emhttp/plugins/folderview.plus/scripts/folder.js"
ARCHIVE_DOCKER_RUNTIME_HIERARCHY_JS_PATH="./usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.hierarchy.js"
ARCHIVE_DOCKER_RUNTIME_ACTIONS_JS_PATH="./usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.actions.js"
ARCHIVE_FOLDER_SETTINGS_TRANSFER_JS_PATH="./usr/local/emhttp/plugins/folderview.plus/scripts/folder.settings-transfer.js"
ARCHIVE_FOLDER_CSS_PATH="./usr/local/emhttp/plugins/folderview.plus/styles/folder.css"
ARCHIVE_SETTINGS_JS_PATH="./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.js"
ARCHIVE_SETTINGS_DIRTY_JS_PATH="./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.dirty.js"
ARCHIVE_SETTINGS_RUNTIME_PARITY_JS_PATH="./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.runtime-parity.js"
ARCHIVE_SETTINGS_SECTIONS_JS_PATH="./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.settings-sections.js"
ARCHIVE_SETTINGS_SETUP_ASSISTANT_JS_PATH="./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.setup-assistant.js"
ARCHIVE_SETTINGS_SMART_DETECT_CONFIG_JS_PATH="./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.smart-detect-config.js"
ARCHIVE_SETTINGS_STARTER_TEMPLATES_JS_PATH="./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.starter-templates.js"
ARCHIVE_SETTINGS_SUPPORT_BUNDLE_PREVIEW_JS_PATH="./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.support-bundle-preview.js"
ARCHIVE_SETTINGS_SUPPORT_BUNDLE_TELEMETRY_JS_PATH="./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.support-bundle-telemetry.js"
ARCHIVE_SETTINGS_ACTIVITY_DIAGNOSTICS_JS_PATH="./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.activity-diagnostics.js"
ARCHIVE_SETTINGS_TREE_JS_PATH="./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.settings-tree.js"
ARCHIVE_SETTINGS_TREE_INTEGRITY_JS_PATH="./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.tree-integrity.js"
ARCHIVE_SETTINGS_MOBILE_REORDER_JS_PATH="./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.mobile-reorder.js"
ARCHIVE_SETTINGS_FOLDER_EDITOR_JS_PATH="./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.folder-editor.js"
ARCHIVE_SETTINGS_HEALTH_JS_PATH="./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.settings-health.js"
ARCHIVE_SETTINGS_WORKSPACES_JS_PATH="./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.settings-workspaces.js"
ARCHIVE_SETTINGS_BULK_ASSIGNMENT_SHARED_JS_PATH="./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.bulk-assignment.shared.js"
ARCHIVE_SETTINGS_BULK_ASSIGNMENT_JS_PATH="./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.bulk-assignment.js"
ARCHIVE_SETTINGS_RUNTIME_ACTIONS_JS_PATH="./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.runtime-actions.js"
ARCHIVE_SETTINGS_WIZARD_JS_PATH="./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.wizard.js"
ARCHIVE_SETTINGS_IMPORT_JS_PATH="./usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.import.js"
ARCHIVE_SETTINGS_CSS_PATH="./usr/local/emhttp/plugins/folderview.plus/styles/folderviewplus.css"
ARCHIVE_SETTINGS_DOWNLOAD_DIAGNOSTICS_CSS_PATH="./usr/local/emhttp/plugins/folderview.plus/styles/folderviewplus.download-diagnostics.css"
ARCHIVE_FOLDER_PAGE_PATH="./usr/local/emhttp/plugins/folderview.plus/Folder.page"
ARCHIVE_SETTINGS_PAGE_PATH="./usr/local/emhttp/plugins/folderview.plus/FolderViewPlus.page"
ARCHIVE_SERVER_LIB_PATH="./usr/local/emhttp/plugins/folderview.plus/server/lib.php"
ARCHIVE_SERVER_LIB_DIAGNOSTICS_PATH="./usr/local/emhttp/plugins/folderview.plus/server/lib.diagnostics.php"
ARCHIVE_SERVER_APPLY_FOLDER_SETTINGS_PATH="./usr/local/emhttp/plugins/folderview.plus/server/apply_folder_settings.php"
ARCHIVE_SERVER_UPDATE_NOTES_PATH="./usr/local/emhttp/plugins/folderview.plus/server/update_notes.php"
if ! grep -Fxq "${ARCHIVE_FOLDER_JS_PATH}" <<< "${ARCHIVE_LIST}"; then
  ARCHIVE_FOLDER_JS_PATH="${ARCHIVE_FOLDER_JS_PATH#./}"
fi
if ! grep -Fxq "${ARCHIVE_DOCKER_RUNTIME_HIERARCHY_JS_PATH}" <<< "${ARCHIVE_LIST}"; then
  ARCHIVE_DOCKER_RUNTIME_HIERARCHY_JS_PATH="${ARCHIVE_DOCKER_RUNTIME_HIERARCHY_JS_PATH#./}"
fi
if ! grep -Fxq "${ARCHIVE_DOCKER_RUNTIME_ACTIONS_JS_PATH}" <<< "${ARCHIVE_LIST}"; then
  ARCHIVE_DOCKER_RUNTIME_ACTIONS_JS_PATH="${ARCHIVE_DOCKER_RUNTIME_ACTIONS_JS_PATH#./}"
fi
if ! grep -Fxq "${ARCHIVE_FOLDER_SETTINGS_TRANSFER_JS_PATH}" <<< "${ARCHIVE_LIST}"; then
  ARCHIVE_FOLDER_SETTINGS_TRANSFER_JS_PATH="${ARCHIVE_FOLDER_SETTINGS_TRANSFER_JS_PATH#./}"
fi
if ! grep -Fxq "${ARCHIVE_FOLDER_CSS_PATH}" <<< "${ARCHIVE_LIST}"; then
  ARCHIVE_FOLDER_CSS_PATH="${ARCHIVE_FOLDER_CSS_PATH#./}"
fi
if ! grep -Fxq "${ARCHIVE_SETTINGS_JS_PATH}" <<< "${ARCHIVE_LIST}"; then
  ARCHIVE_SETTINGS_JS_PATH="${ARCHIVE_SETTINGS_JS_PATH#./}"
fi
if ! grep -Fxq "${ARCHIVE_SETTINGS_DIRTY_JS_PATH}" <<< "${ARCHIVE_LIST}"; then
  ARCHIVE_SETTINGS_DIRTY_JS_PATH="${ARCHIVE_SETTINGS_DIRTY_JS_PATH#./}"
fi
if ! grep -Fxq "${ARCHIVE_SETTINGS_RUNTIME_PARITY_JS_PATH}" <<< "${ARCHIVE_LIST}"; then
  ARCHIVE_SETTINGS_RUNTIME_PARITY_JS_PATH="${ARCHIVE_SETTINGS_RUNTIME_PARITY_JS_PATH#./}"
fi
if ! grep -Fxq "${ARCHIVE_SETTINGS_SECTIONS_JS_PATH}" <<< "${ARCHIVE_LIST}"; then
  ARCHIVE_SETTINGS_SECTIONS_JS_PATH="${ARCHIVE_SETTINGS_SECTIONS_JS_PATH#./}"
fi
if ! grep -Fxq "${ARCHIVE_SETTINGS_SETUP_ASSISTANT_JS_PATH}" <<< "${ARCHIVE_LIST}"; then
  ARCHIVE_SETTINGS_SETUP_ASSISTANT_JS_PATH="${ARCHIVE_SETTINGS_SETUP_ASSISTANT_JS_PATH#./}"
fi
if ! grep -Fxq "${ARCHIVE_SETTINGS_SMART_DETECT_CONFIG_JS_PATH}" <<< "${ARCHIVE_LIST}"; then
  ARCHIVE_SETTINGS_SMART_DETECT_CONFIG_JS_PATH="${ARCHIVE_SETTINGS_SMART_DETECT_CONFIG_JS_PATH#./}"
fi
if ! grep -Fxq "${ARCHIVE_SETTINGS_STARTER_TEMPLATES_JS_PATH}" <<< "${ARCHIVE_LIST}"; then
  ARCHIVE_SETTINGS_STARTER_TEMPLATES_JS_PATH="${ARCHIVE_SETTINGS_STARTER_TEMPLATES_JS_PATH#./}"
fi
if ! grep -Fxq "${ARCHIVE_SETTINGS_SUPPORT_BUNDLE_PREVIEW_JS_PATH}" <<< "${ARCHIVE_LIST}"; then
  ARCHIVE_SETTINGS_SUPPORT_BUNDLE_PREVIEW_JS_PATH="${ARCHIVE_SETTINGS_SUPPORT_BUNDLE_PREVIEW_JS_PATH#./}"
fi
if ! grep -Fxq "${ARCHIVE_SETTINGS_SUPPORT_BUNDLE_TELEMETRY_JS_PATH}" <<< "${ARCHIVE_LIST}"; then
  ARCHIVE_SETTINGS_SUPPORT_BUNDLE_TELEMETRY_JS_PATH="${ARCHIVE_SETTINGS_SUPPORT_BUNDLE_TELEMETRY_JS_PATH#./}"
fi
if ! grep -Fxq "${ARCHIVE_SETTINGS_ACTIVITY_DIAGNOSTICS_JS_PATH}" <<< "${ARCHIVE_LIST}"; then
  ARCHIVE_SETTINGS_ACTIVITY_DIAGNOSTICS_JS_PATH="${ARCHIVE_SETTINGS_ACTIVITY_DIAGNOSTICS_JS_PATH#./}"
fi
if ! grep -Fxq "${ARCHIVE_SETTINGS_TREE_JS_PATH}" <<< "${ARCHIVE_LIST}"; then
  ARCHIVE_SETTINGS_TREE_JS_PATH="${ARCHIVE_SETTINGS_TREE_JS_PATH#./}"
fi
if ! grep -Fxq "${ARCHIVE_SETTINGS_TREE_INTEGRITY_JS_PATH}" <<< "${ARCHIVE_LIST}"; then
  ARCHIVE_SETTINGS_TREE_INTEGRITY_JS_PATH="${ARCHIVE_SETTINGS_TREE_INTEGRITY_JS_PATH#./}"
fi
if ! grep -Fxq "${ARCHIVE_SETTINGS_MOBILE_REORDER_JS_PATH}" <<< "${ARCHIVE_LIST}"; then
  ARCHIVE_SETTINGS_MOBILE_REORDER_JS_PATH="${ARCHIVE_SETTINGS_MOBILE_REORDER_JS_PATH#./}"
fi
if ! grep -Fxq "${ARCHIVE_SETTINGS_FOLDER_EDITOR_JS_PATH}" <<< "${ARCHIVE_LIST}"; then
  ARCHIVE_SETTINGS_FOLDER_EDITOR_JS_PATH="${ARCHIVE_SETTINGS_FOLDER_EDITOR_JS_PATH#./}"
fi
if ! grep -Fxq "${ARCHIVE_SETTINGS_HEALTH_JS_PATH}" <<< "${ARCHIVE_LIST}"; then
  ARCHIVE_SETTINGS_HEALTH_JS_PATH="${ARCHIVE_SETTINGS_HEALTH_JS_PATH#./}"
fi
if ! grep -Fxq "${ARCHIVE_SETTINGS_WORKSPACES_JS_PATH}" <<< "${ARCHIVE_LIST}"; then
  ARCHIVE_SETTINGS_WORKSPACES_JS_PATH="${ARCHIVE_SETTINGS_WORKSPACES_JS_PATH#./}"
fi
if ! grep -Fxq "${ARCHIVE_SETTINGS_BULK_ASSIGNMENT_SHARED_JS_PATH}" <<< "${ARCHIVE_LIST}"; then
  ARCHIVE_SETTINGS_BULK_ASSIGNMENT_SHARED_JS_PATH="${ARCHIVE_SETTINGS_BULK_ASSIGNMENT_SHARED_JS_PATH#./}"
fi
if ! grep -Fxq "${ARCHIVE_SETTINGS_BULK_ASSIGNMENT_JS_PATH}" <<< "${ARCHIVE_LIST}"; then
  ARCHIVE_SETTINGS_BULK_ASSIGNMENT_JS_PATH="${ARCHIVE_SETTINGS_BULK_ASSIGNMENT_JS_PATH#./}"
fi
if ! grep -Fxq "${ARCHIVE_SETTINGS_RUNTIME_ACTIONS_JS_PATH}" <<< "${ARCHIVE_LIST}"; then
  ARCHIVE_SETTINGS_RUNTIME_ACTIONS_JS_PATH="${ARCHIVE_SETTINGS_RUNTIME_ACTIONS_JS_PATH#./}"
fi
if ! grep -Fxq "${ARCHIVE_SETTINGS_WIZARD_JS_PATH}" <<< "${ARCHIVE_LIST}"; then
  ARCHIVE_SETTINGS_WIZARD_JS_PATH="${ARCHIVE_SETTINGS_WIZARD_JS_PATH#./}"
fi
if ! grep -Fxq "${ARCHIVE_SETTINGS_IMPORT_JS_PATH}" <<< "${ARCHIVE_LIST}"; then
  ARCHIVE_SETTINGS_IMPORT_JS_PATH="${ARCHIVE_SETTINGS_IMPORT_JS_PATH#./}"
fi
if ! grep -Fxq "${ARCHIVE_SETTINGS_CSS_PATH}" <<< "${ARCHIVE_LIST}"; then
  ARCHIVE_SETTINGS_CSS_PATH="${ARCHIVE_SETTINGS_CSS_PATH#./}"
fi
if ! grep -Fxq "${ARCHIVE_SETTINGS_DOWNLOAD_DIAGNOSTICS_CSS_PATH}" <<< "${ARCHIVE_LIST}"; then
  ARCHIVE_SETTINGS_DOWNLOAD_DIAGNOSTICS_CSS_PATH="${ARCHIVE_SETTINGS_DOWNLOAD_DIAGNOSTICS_CSS_PATH#./}"
fi
if ! grep -Fxq "${ARCHIVE_FOLDER_PAGE_PATH}" <<< "${ARCHIVE_LIST}"; then
  ARCHIVE_FOLDER_PAGE_PATH="${ARCHIVE_FOLDER_PAGE_PATH#./}"
fi
if ! grep -Fxq "${ARCHIVE_SETTINGS_PAGE_PATH}" <<< "${ARCHIVE_LIST}"; then
  ARCHIVE_SETTINGS_PAGE_PATH="${ARCHIVE_SETTINGS_PAGE_PATH#./}"
fi
if ! grep -Fxq "${ARCHIVE_SERVER_LIB_PATH}" <<< "${ARCHIVE_LIST}"; then
  ARCHIVE_SERVER_LIB_PATH="${ARCHIVE_SERVER_LIB_PATH#./}"
fi
if ! grep -Fxq "${ARCHIVE_SERVER_LIB_DIAGNOSTICS_PATH}" <<< "${ARCHIVE_LIST}"; then
  ARCHIVE_SERVER_LIB_DIAGNOSTICS_PATH="${ARCHIVE_SERVER_LIB_DIAGNOSTICS_PATH#./}"
fi
if ! grep -Fxq "${ARCHIVE_SERVER_APPLY_FOLDER_SETTINGS_PATH}" <<< "${ARCHIVE_LIST}"; then
  ARCHIVE_SERVER_APPLY_FOLDER_SETTINGS_PATH="${ARCHIVE_SERVER_APPLY_FOLDER_SETTINGS_PATH#./}"
fi
if ! grep -Fxq "${ARCHIVE_SERVER_UPDATE_NOTES_PATH}" <<< "${ARCHIVE_LIST}"; then
  ARCHIVE_SERVER_UPDATE_NOTES_PATH="${ARCHIVE_SERVER_UPDATE_NOTES_PATH#./}"
fi
tar -xOf "${ARCHIVE_FILE}" "${ARCHIVE_FOLDER_JS_PATH}" > "${TMP_ARCHIVE_FOLDER_JS}"
tar -xOf "${ARCHIVE_FILE}" "${ARCHIVE_DOCKER_RUNTIME_HIERARCHY_JS_PATH}" > "${TMP_ARCHIVE_DOCKER_RUNTIME_HIERARCHY_JS}"
tar -xOf "${ARCHIVE_FILE}" "${ARCHIVE_DOCKER_RUNTIME_ACTIONS_JS_PATH}" > "${TMP_ARCHIVE_DOCKER_RUNTIME_ACTIONS_JS}"
tar -xOf "${ARCHIVE_FILE}" "${ARCHIVE_FOLDER_SETTINGS_TRANSFER_JS_PATH}" > "${TMP_ARCHIVE_FOLDER_SETTINGS_TRANSFER_JS}"
tar -xOf "${ARCHIVE_FILE}" "${ARCHIVE_FOLDER_CSS_PATH}" > "${TMP_ARCHIVE_FOLDER_CSS}"
tar -xOf "${ARCHIVE_FILE}" "${ARCHIVE_SETTINGS_JS_PATH}" > "${TMP_ARCHIVE_SETTINGS_JS}"
tar -xOf "${ARCHIVE_FILE}" "${ARCHIVE_SETTINGS_DIRTY_JS_PATH}" > "${TMP_ARCHIVE_SETTINGS_DIRTY_JS}"
tar -xOf "${ARCHIVE_FILE}" "${ARCHIVE_SETTINGS_RUNTIME_PARITY_JS_PATH}" > "${TMP_ARCHIVE_SETTINGS_RUNTIME_PARITY_JS}"
tar -xOf "${ARCHIVE_FILE}" "${ARCHIVE_SETTINGS_SECTIONS_JS_PATH}" > "${TMP_ARCHIVE_SETTINGS_SECTIONS_JS}"
tar -xOf "${ARCHIVE_FILE}" "${ARCHIVE_SETTINGS_SETUP_ASSISTANT_JS_PATH}" > "${TMP_ARCHIVE_SETTINGS_SETUP_ASSISTANT_JS}"
tar -xOf "${ARCHIVE_FILE}" "${ARCHIVE_SETTINGS_SMART_DETECT_CONFIG_JS_PATH}" > "${TMP_ARCHIVE_SETTINGS_SMART_DETECT_CONFIG_JS}"
tar -xOf "${ARCHIVE_FILE}" "${ARCHIVE_SETTINGS_STARTER_TEMPLATES_JS_PATH}" > "${TMP_ARCHIVE_SETTINGS_STARTER_TEMPLATES_JS}"
tar -xOf "${ARCHIVE_FILE}" "${ARCHIVE_SETTINGS_SUPPORT_BUNDLE_PREVIEW_JS_PATH}" > "${TMP_ARCHIVE_SETTINGS_SUPPORT_BUNDLE_PREVIEW_JS}"
tar -xOf "${ARCHIVE_FILE}" "${ARCHIVE_SETTINGS_SUPPORT_BUNDLE_TELEMETRY_JS_PATH}" > "${TMP_ARCHIVE_SETTINGS_SUPPORT_BUNDLE_TELEMETRY_JS}"
tar -xOf "${ARCHIVE_FILE}" "${ARCHIVE_SETTINGS_ACTIVITY_DIAGNOSTICS_JS_PATH}" > "${TMP_ARCHIVE_SETTINGS_ACTIVITY_DIAGNOSTICS_JS}"
tar -xOf "${ARCHIVE_FILE}" "${ARCHIVE_SETTINGS_TREE_JS_PATH}" > "${TMP_ARCHIVE_SETTINGS_TREE_JS}"
tar -xOf "${ARCHIVE_FILE}" "${ARCHIVE_SETTINGS_TREE_INTEGRITY_JS_PATH}" > "${TMP_ARCHIVE_SETTINGS_TREE_INTEGRITY_JS}"
tar -xOf "${ARCHIVE_FILE}" "${ARCHIVE_SETTINGS_MOBILE_REORDER_JS_PATH}" > "${TMP_ARCHIVE_SETTINGS_MOBILE_REORDER_JS}"
tar -xOf "${ARCHIVE_FILE}" "${ARCHIVE_SETTINGS_FOLDER_EDITOR_JS_PATH}" > "${TMP_ARCHIVE_SETTINGS_FOLDER_EDITOR_JS}"
tar -xOf "${ARCHIVE_FILE}" "${ARCHIVE_SETTINGS_HEALTH_JS_PATH}" > "${TMP_ARCHIVE_SETTINGS_HEALTH_JS}"
tar -xOf "${ARCHIVE_FILE}" "${ARCHIVE_SETTINGS_WORKSPACES_JS_PATH}" > "${TMP_ARCHIVE_SETTINGS_WORKSPACES_JS}"
tar -xOf "${ARCHIVE_FILE}" "${ARCHIVE_SETTINGS_BULK_ASSIGNMENT_SHARED_JS_PATH}" > "${TMP_ARCHIVE_SETTINGS_BULK_ASSIGNMENT_SHARED_JS}"
tar -xOf "${ARCHIVE_FILE}" "${ARCHIVE_SETTINGS_BULK_ASSIGNMENT_JS_PATH}" > "${TMP_ARCHIVE_SETTINGS_BULK_ASSIGNMENT_JS}"
tar -xOf "${ARCHIVE_FILE}" "${ARCHIVE_SETTINGS_RUNTIME_ACTIONS_JS_PATH}" > "${TMP_ARCHIVE_SETTINGS_RUNTIME_ACTIONS_JS}"
tar -xOf "${ARCHIVE_FILE}" "${ARCHIVE_SETTINGS_WIZARD_JS_PATH}" > "${TMP_ARCHIVE_SETTINGS_WIZARD_JS}"
tar -xOf "${ARCHIVE_FILE}" "${ARCHIVE_SETTINGS_IMPORT_JS_PATH}" > "${TMP_ARCHIVE_SETTINGS_IMPORT_JS}"
tar -xOf "${ARCHIVE_FILE}" "${ARCHIVE_SETTINGS_CSS_PATH}" > "${TMP_ARCHIVE_SETTINGS_CSS}"
tar -xOf "${ARCHIVE_FILE}" "${ARCHIVE_SETTINGS_DOWNLOAD_DIAGNOSTICS_CSS_PATH}" > "${TMP_ARCHIVE_SETTINGS_DOWNLOAD_DIAGNOSTICS_CSS}"
tar -xOf "${ARCHIVE_FILE}" "${ARCHIVE_FOLDER_PAGE_PATH}" > "${TMP_ARCHIVE_FOLDER_PAGE}"
tar -xOf "${ARCHIVE_FILE}" "${ARCHIVE_SETTINGS_PAGE_PATH}" > "${TMP_ARCHIVE_SETTINGS_PAGE}"
tar -xOf "${ARCHIVE_FILE}" "${ARCHIVE_SERVER_LIB_PATH}" > "${TMP_ARCHIVE_SERVER_LIB}"
tar -xOf "${ARCHIVE_FILE}" "${ARCHIVE_SERVER_LIB_DIAGNOSTICS_PATH}" > "${TMP_ARCHIVE_SERVER_LIB_DIAGNOSTICS}"
tar -xOf "${ARCHIVE_FILE}" "${ARCHIVE_SERVER_APPLY_FOLDER_SETTINGS_PATH}" > "${TMP_ARCHIVE_SERVER_APPLY_FOLDER_SETTINGS}"
tar -xOf "${ARCHIVE_FILE}" "${ARCHIVE_SERVER_UPDATE_NOTES_PATH}" > "${TMP_ARCHIVE_SERVER_UPDATE_NOTES}"

if ! env_truthy "${FVPLUS_ALLOW_PACKAGED_SOURCE_DRIFT:-0}"; then
  if ! text_files_match "${SOURCE_FOLDER_JS}" "${TMP_ARCHIVE_FOLDER_JS}"; then
    fail_packaged_source_mismatch "Packaged folder.js does not match source folder.js."
  fi

  if ! text_files_match "${SOURCE_DOCKER_RUNTIME_HIERARCHY_JS}" "${TMP_ARCHIVE_DOCKER_RUNTIME_HIERARCHY_JS}"; then
    fail_packaged_source_mismatch "Packaged docker.runtime.hierarchy.js does not match source docker.runtime.hierarchy.js."
  fi

  if ! text_files_match "${SOURCE_DOCKER_RUNTIME_ACTIONS_JS}" "${TMP_ARCHIVE_DOCKER_RUNTIME_ACTIONS_JS}"; then
    fail_packaged_source_mismatch "Packaged docker.runtime.actions.js does not match source docker.runtime.actions.js."
  fi
  if ! text_files_match "${SOURCE_FOLDER_SETTINGS_TRANSFER_JS}" "${TMP_ARCHIVE_FOLDER_SETTINGS_TRANSFER_JS}"; then
    fail_packaged_source_mismatch "Packaged folder.settings-transfer.js does not match source folder.settings-transfer.js."
  fi

  if ! text_files_match "${SOURCE_FOLDER_CSS}" "${TMP_ARCHIVE_FOLDER_CSS}"; then
    fail_packaged_source_mismatch "Packaged folder.css does not match source folder.css."
  fi
  if ! text_files_match "${SOURCE_SETTINGS_JS}" "${TMP_ARCHIVE_SETTINGS_JS}"; then
    fail_packaged_source_mismatch "Packaged folderviewplus.js does not match source folderviewplus.js."
  fi
  if ! text_files_match "${SOURCE_SETTINGS_DIRTY_JS}" "${TMP_ARCHIVE_SETTINGS_DIRTY_JS}"; then
    fail_packaged_source_mismatch "Packaged folderviewplus.dirty.js does not match source folderviewplus.dirty.js."
  fi
  if ! text_files_match "${SOURCE_SETTINGS_RUNTIME_PARITY_JS}" "${TMP_ARCHIVE_SETTINGS_RUNTIME_PARITY_JS}"; then
    fail_packaged_source_mismatch "Packaged folderviewplus.runtime-parity.js does not match source folderviewplus.runtime-parity.js."
  fi
  if ! text_files_match "${SOURCE_SETTINGS_SECTIONS_JS}" "${TMP_ARCHIVE_SETTINGS_SECTIONS_JS}"; then
    fail_packaged_source_mismatch "Packaged folderviewplus.settings-sections.js does not match source folderviewplus.settings-sections.js."
  fi
  if ! text_files_match "${SOURCE_SETTINGS_SETUP_ASSISTANT_JS}" "${TMP_ARCHIVE_SETTINGS_SETUP_ASSISTANT_JS}"; then
    fail_packaged_source_mismatch "Packaged folderviewplus.setup-assistant.js does not match source folderviewplus.setup-assistant.js."
  fi
  if ! text_files_match "${SOURCE_SETTINGS_SMART_DETECT_CONFIG_JS}" "${TMP_ARCHIVE_SETTINGS_SMART_DETECT_CONFIG_JS}"; then
    fail_packaged_source_mismatch "Packaged folderviewplus.smart-detect-config.js does not match source folderviewplus.smart-detect-config.js."
  fi
  if ! text_files_match "${SOURCE_SETTINGS_STARTER_TEMPLATES_JS}" "${TMP_ARCHIVE_SETTINGS_STARTER_TEMPLATES_JS}"; then
    fail_packaged_source_mismatch "Packaged folderviewplus.starter-templates.js does not match source folderviewplus.starter-templates.js."
  fi
  if ! text_files_match "${SOURCE_SETTINGS_SUPPORT_BUNDLE_PREVIEW_JS}" "${TMP_ARCHIVE_SETTINGS_SUPPORT_BUNDLE_PREVIEW_JS}"; then
    fail_packaged_source_mismatch "Packaged folderviewplus.support-bundle-preview.js does not match source folderviewplus.support-bundle-preview.js."
  fi
  if ! text_files_match "${SOURCE_SETTINGS_SUPPORT_BUNDLE_TELEMETRY_JS}" "${TMP_ARCHIVE_SETTINGS_SUPPORT_BUNDLE_TELEMETRY_JS}"; then
    fail_packaged_source_mismatch "Packaged folderviewplus.support-bundle-telemetry.js does not match source folderviewplus.support-bundle-telemetry.js."
  fi
  if ! text_files_match "${SOURCE_SETTINGS_ACTIVITY_DIAGNOSTICS_JS}" "${TMP_ARCHIVE_SETTINGS_ACTIVITY_DIAGNOSTICS_JS}"; then
    fail_packaged_source_mismatch "Packaged folderviewplus.activity-diagnostics.js does not match source folderviewplus.activity-diagnostics.js."
  fi
  if ! text_files_match "${SOURCE_SETTINGS_TREE_JS}" "${TMP_ARCHIVE_SETTINGS_TREE_JS}"; then
    fail_packaged_source_mismatch "Packaged folderviewplus.settings-tree.js does not match source folderviewplus.settings-tree.js."
  fi
  if ! text_files_match "${SOURCE_SETTINGS_TREE_INTEGRITY_JS}" "${TMP_ARCHIVE_SETTINGS_TREE_INTEGRITY_JS}"; then
    fail_packaged_source_mismatch "Packaged folderviewplus.tree-integrity.js does not match source folderviewplus.tree-integrity.js."
  fi
  if ! text_files_match "${SOURCE_SETTINGS_MOBILE_REORDER_JS}" "${TMP_ARCHIVE_SETTINGS_MOBILE_REORDER_JS}"; then
    fail_packaged_source_mismatch "Packaged folderviewplus.mobile-reorder.js does not match source folderviewplus.mobile-reorder.js."
  fi
  if ! text_files_match "${SOURCE_SETTINGS_FOLDER_EDITOR_JS}" "${TMP_ARCHIVE_SETTINGS_FOLDER_EDITOR_JS}"; then
    fail_packaged_source_mismatch "Packaged folderviewplus.folder-editor.js does not match source folderviewplus.folder-editor.js."
  fi
  if ! text_files_match "${SOURCE_SETTINGS_HEALTH_JS}" "${TMP_ARCHIVE_SETTINGS_HEALTH_JS}"; then
    fail_packaged_source_mismatch "Packaged folderviewplus.settings-health.js does not match source folderviewplus.settings-health.js."
  fi
  if ! text_files_match "${SOURCE_SETTINGS_WORKSPACES_JS}" "${TMP_ARCHIVE_SETTINGS_WORKSPACES_JS}"; then
    fail_packaged_source_mismatch "Packaged folderviewplus.settings-workspaces.js does not match source folderviewplus.settings-workspaces.js."
  fi
  if ! text_files_match "${SOURCE_SETTINGS_BULK_ASSIGNMENT_SHARED_JS}" "${TMP_ARCHIVE_SETTINGS_BULK_ASSIGNMENT_SHARED_JS}"; then
    fail_packaged_source_mismatch "Packaged folderviewplus.bulk-assignment.shared.js does not match source folderviewplus.bulk-assignment.shared.js."
  fi
  if ! text_files_match "${SOURCE_SETTINGS_BULK_ASSIGNMENT_JS}" "${TMP_ARCHIVE_SETTINGS_BULK_ASSIGNMENT_JS}"; then
    fail_packaged_source_mismatch "Packaged folderviewplus.bulk-assignment.js does not match source folderviewplus.bulk-assignment.js."
  fi
  if ! text_files_match "${SOURCE_SETTINGS_RUNTIME_ACTIONS_JS}" "${TMP_ARCHIVE_SETTINGS_RUNTIME_ACTIONS_JS}"; then
    fail_packaged_source_mismatch "Packaged folderviewplus.runtime-actions.js does not match source folderviewplus.runtime-actions.js."
  fi
  if ! text_files_match "${SOURCE_SETTINGS_WIZARD_JS}" "${TMP_ARCHIVE_SETTINGS_WIZARD_JS}"; then
    fail_packaged_source_mismatch "Packaged folderviewplus.wizard.js does not match source folderviewplus.wizard.js."
  fi
  if ! text_files_match "${SOURCE_SETTINGS_IMPORT_JS}" "${TMP_ARCHIVE_SETTINGS_IMPORT_JS}"; then
    fail_packaged_source_mismatch "Packaged folderviewplus.import.js does not match source folderviewplus.import.js."
  fi
  if ! text_files_match "${SOURCE_SETTINGS_CSS}" "${TMP_ARCHIVE_SETTINGS_CSS}"; then
    fail_packaged_source_mismatch "Packaged folderviewplus.css does not match source folderviewplus.css."
  fi
  if ! text_files_match "${SOURCE_SETTINGS_DOWNLOAD_DIAGNOSTICS_CSS}" "${TMP_ARCHIVE_SETTINGS_DOWNLOAD_DIAGNOSTICS_CSS}"; then
    fail_packaged_source_mismatch "Packaged folderviewplus.download-diagnostics.css does not match source folderviewplus.download-diagnostics.css."
  fi
  if ! text_files_match "${SOURCE_FOLDER_PAGE}" "${TMP_ARCHIVE_FOLDER_PAGE}"; then
    fail_packaged_source_mismatch "Packaged Folder.page does not match source Folder.page."
  fi
  if ! text_files_match "${SOURCE_SETTINGS_PAGE}" "${TMP_ARCHIVE_SETTINGS_PAGE}"; then
    fail_packaged_source_mismatch "Packaged FolderViewPlus.page does not match source FolderViewPlus.page."
  fi
  if ! text_files_match "${SOURCE_SERVER_LIB}" "${TMP_ARCHIVE_SERVER_LIB}"; then
    fail_packaged_source_mismatch "Packaged server/lib.php does not match source server/lib.php."
  fi
  if ! text_files_match "${SOURCE_SERVER_LIB_DIAGNOSTICS}" "${TMP_ARCHIVE_SERVER_LIB_DIAGNOSTICS}"; then
    fail_packaged_source_mismatch "Packaged server/lib.diagnostics.php does not match source server/lib.diagnostics.php."
  fi
  if ! text_files_match "${SOURCE_SERVER_APPLY_FOLDER_SETTINGS}" "${TMP_ARCHIVE_SERVER_APPLY_FOLDER_SETTINGS}"; then
    fail_packaged_source_mismatch "Packaged server/apply_folder_settings.php does not match source server/apply_folder_settings.php."
  fi
  if ! text_files_match "${SOURCE_SERVER_UPDATE_NOTES}" "${TMP_ARCHIVE_SERVER_UPDATE_NOTES}"; then
    fail_packaged_source_mismatch "Packaged server/update_notes.php does not match source server/update_notes.php."
  fi
fi

if [[ ! -d "${SERVER_DIR}" ]]; then
  echo "ERROR: Missing server directory: ${SERVER_DIR}" >&2
  exit 1
fi

API_CONTRACT_NODE_BIN="$(fvplus::resolve_platform_command node)"
API_CONTRACT_GUARD_PATH="$(fvplus::path_for_command "${API_CONTRACT_NODE_BIN}" "${ROOT_DIR}/scripts/api_contract_guard.mjs")"
API_CONTRACT_SERVER_PATH="$(fvplus::path_for_command "${API_CONTRACT_NODE_BIN}" "${SERVER_DIR}")"
"${API_CONTRACT_NODE_BIN}" "${API_CONTRACT_GUARD_PATH}" --server-dir "${API_CONTRACT_SERVER_PATH}"

if ! grep -q "###${VERSION}" "${PLG_FILE}"; then
  echo "ERROR: CHANGES section does not contain an entry for ${VERSION}" >&2
  exit 1
fi

CURRENT_CHANGES_BLOCK="$(awk -v version="${VERSION}" '
  BEGIN { capture = 0 }
  /^###[0-9]{4}\.[0-9]{2}\.[0-9]{2}\.[0-9]{2}[[:space:]]*$/ {
    if (capture) {
      exit
    }
    if ($0 ~ "^###" version "[[:space:]]*$") {
      capture = 1
      next
    }
  }
  {
    if (capture) {
      print
    }
  }
' "${PLG_FILE}")"

CURRENT_CHANGES_LINES="$(printf '%s\n' "${CURRENT_CHANGES_BLOCK}" | sed '/^[[:space:]]*$/d')"
if [[ -z "${CURRENT_CHANGES_LINES}" ]]; then
  echo "ERROR: CHANGES entry for ${VERSION} is empty." >&2
  exit 1
fi

if grep -Eiq 'Action required: replace these placeholder notes' <<< "${CURRENT_CHANGES_LINES}"; then
  echo "ERROR: CHANGES entry for ${VERSION} still contains placeholder notes from ensure_plg_changes_entry.sh." >&2
  exit 1
fi

is_allowed_changes_category() {
  local category_name="${1:-}"
  fvplus::is_release_note_category "${category_name}"
}

is_metadata_only_changes_line() {
  local line="${1:-}"
  local lowered
  lowered="$(printf '%s' "${line}" | tr '[:upper:]' '[:lower:]')"
  [[ "${lowered}" == *"maintenance: release metadata and packaging sync"* ]] && return 0
  [[ "${lowered}" == *"maintenance: automated release metadata update"* ]] && return 0
  return 1
}

normalize_changes_lines() {
  sed -E 's/^[[:space:]]*-[[:space:]]*//;s/[[:space:]]+$//' | sed '/^[[:space:]]*$/d'
}

mapfile -t CURRENT_CHANGES_CATEGORIES < <(printf '%s\n' "${CURRENT_CHANGES_LINES}" | sed -n 's/^[[:space:]]*-[[:space:]]*\([^:][^:]*\):.*/\1/p')
if [[ ${#CURRENT_CHANGES_CATEGORIES[@]} -eq 0 ]]; then
  echo "ERROR: CHANGES entry for ${VERSION} must include at least one category-formatted bullet (for example: '- Feature: ...')." >&2
  exit 1
fi

INVALID_CHANGE_CATEGORIES=()
for raw_category in "${CURRENT_CHANGES_CATEGORIES[@]}"; do
  category="$(printf '%s' "${raw_category}" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
  if [[ -z "${category}" ]]; then
    continue
  fi
  if ! is_allowed_changes_category "${category}"; then
    INVALID_CHANGE_CATEGORIES+=("${category}")
  fi
done

if [[ ${#INVALID_CHANGE_CATEGORIES[@]} -gt 0 ]]; then
  unique_invalid="$(printf '%s\n' "${INVALID_CHANGE_CATEGORIES[@]}" | sort -u | awk 'BEGIN{first=1} {if (!first) {printf ", "} printf "%s", $0; first=0}')"
  echo "ERROR: CHANGES entry for ${VERSION} contains unsupported category tag(s): ${unique_invalid}" >&2
  echo "Allowed categories: $(fvplus::release_note_category_list)." >&2
  exit 1
fi

METADATA_DRIFT_LINES=""
while IFS= read -r raw_line; do
  [[ -z "${raw_line}" ]] && continue
  if is_metadata_only_changes_line "${raw_line}"; then
    METADATA_DRIFT_LINES+="${raw_line}"$'\n'
  fi
done <<< "${CURRENT_CHANGES_LINES}"

if [[ -n "${METADATA_DRIFT_LINES}" ]]; then
  echo "ERROR: CHANGES entry for ${VERSION} contains release-metadata boilerplate lines. Remove these from release notes:" >&2
  printf '%s' "${METADATA_DRIFT_LINES}" >&2
  exit 1
fi

HAS_NON_METADATA_CHANGE_LINE=0
while IFS= read -r raw_line; do
  [[ -z "${raw_line}" ]] && continue
  if is_metadata_only_changes_line "${raw_line}"; then
    continue
  fi
  HAS_NON_METADATA_CHANGE_LINE=1
  break
done <<< "${CURRENT_CHANGES_LINES}"

if [[ ${HAS_NON_METADATA_CHANGE_LINE} -ne 1 ]]; then
  echo "ERROR: CHANGES entry for ${VERSION} contains only release-metadata boilerplate notes." >&2
  echo "Add at least one user-facing categorized bullet (for example: '- Fix: ...' or '- UX: ...')." >&2
  exit 1
fi

PREVIOUS_CHANGES_BLOCK="$(awk -v version="${VERSION}" '
  BEGIN { seen_current = 0; capture_previous = 0 }
  /^###[0-9]{4}\.[0-9]{2}\.[0-9]{2}\.[0-9]{2}[[:space:]]*$/ {
    if (!seen_current) {
      if ($0 ~ "^###" version "[[:space:]]*$") {
        seen_current = 1
      }
      next
    }
    if (!capture_previous) {
      capture_previous = 1
      next
    }
    exit
  }
  {
    if (capture_previous) {
      print
    }
  }
' "${PLG_FILE}")"

CURRENT_NORMALIZED_LINES="$(printf '%s\n' "${CURRENT_CHANGES_LINES}" | normalize_changes_lines)"
PREVIOUS_NORMALIZED_LINES="$(printf '%s\n' "${PREVIOUS_CHANGES_BLOCK}" | normalize_changes_lines)"
if [[ -n "${CURRENT_NORMALIZED_LINES}" && -n "${PREVIOUS_NORMALIZED_LINES}" ]]; then
  CURRENT_LINE_COUNT="$(printf '%s\n' "${CURRENT_NORMALIZED_LINES}" | wc -l | tr -d '[:space:]')"
  DUPLICATE_LINE_COUNT=0
  while IFS= read -r normalized_line; do
    [[ -z "${normalized_line}" ]] && continue
    if grep -Fqx "${normalized_line}" <<< "${PREVIOUS_NORMALIZED_LINES}"; then
      DUPLICATE_LINE_COUNT=$((DUPLICATE_LINE_COUNT + 1))
    fi
  done <<< "${CURRENT_NORMALIZED_LINES}"

  if [[ "${CURRENT_LINE_COUNT}" -gt 0 && "${DUPLICATE_LINE_COUNT}" -eq "${CURRENT_LINE_COUNT}" ]]; then
    echo "ERROR: CHANGES entry for ${VERSION} duplicates the previous release notes block." >&2
    echo "Update CHANGES with the current release deltas before packaging." >&2
    exit 1
  fi
fi

MD5_CALC="$(md5sum "${ARCHIVE_FILE}" | awk '{print $1}')"
if [[ "${MD5_ENTITY}" != "${MD5_CALC}" ]]; then
  echo "ERROR: md5 entity mismatch. plg=${MD5_ENTITY}, archive=${MD5_CALC}" >&2
  exit 1
fi
SHA256_CALC="$(sha256sum "${ARCHIVE_FILE}" | awk '{print $1}')"
if [[ "${SHA256_ENTITY}" != "${SHA256_CALC}" ]]; then
  echo "ERROR: sha256 entity mismatch. plg=${SHA256_ENTITY}, archive=${SHA256_CALC}" >&2
  exit 1
fi
EXPECTED_CHECKSUM_LINE="${SHA256_CALC}  ${ARCHIVE_FILE##*/}"
if [[ "$(tr -d '\r' < "${ARCHIVE_FILE}.sha256")" != "${EXPECTED_CHECKSUM_LINE}" ]]; then
  echo "ERROR: package checksum sidecar does not exactly match the archive name and SHA-256." >&2
  exit 1
fi

echo "Release guard checks passed:"
echo "  version: ${VERSION}"
echo "  archive: ${ARCHIVE_FILE##*/}"
echo "  md5: ${MD5_CALC}"
echo "  sha256: ${SHA256_CALC}"
