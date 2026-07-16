#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION_FILE="${ROOT_DIR}/asset-packs/icon-pack.version"
SOURCE_DIR="${ROOT_DIR}/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/images/third-party-icons"
OUTPUT_DIR="${FVPLUS_ICON_PACK_OUTPUT_DIR:-${ROOT_DIR}/asset-packs}"
VERSION="${FVPLUS_ICON_PACK_VERSION:-}"
TMP_DIR=""

cleanup() {
  if [[ -n "${TMP_DIR}" && -d "${TMP_DIR}" ]]; then
    rm -rf "${TMP_DIR}"
  fi
}
trap cleanup EXIT

if [[ -z "${VERSION}" ]]; then
  if [[ ! -f "${VERSION_FILE}" ]]; then
    echo "ERROR: Missing icon asset-pack version file: ${VERSION_FILE}" >&2
    exit 1
  fi
  VERSION="$(tr -d '[:space:]' < "${VERSION_FILE}")"
fi
if [[ ! "${VERSION}" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "ERROR: Icon asset-pack version must use semantic versioning (received: ${VERSION})." >&2
  exit 1
fi
if [[ ! -d "${SOURCE_DIR}" ]]; then
  echo "ERROR: Missing third-party icon source directory: ${SOURCE_DIR}" >&2
  exit 1
fi

for command_name in tar sha256sum md5sum find sort awk wc cp mkdir mktemp; do
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "ERROR: Missing required command: ${command_name}" >&2
    exit 1
  fi
done

mkdir -p "${OUTPUT_DIR}" "${ROOT_DIR}/tmp"
TMP_DIR="$(mktemp -d "${ROOT_DIR}/tmp/icon-pack.XXXXXX")"
STAGE_DIR="${TMP_DIR}/stage"
PACK_ICON_DIR="${STAGE_DIR}/third-party-icons"
mkdir -p "${PACK_ICON_DIR}"

while IFS= read -r -d '' source_file; do
  relative_path="${source_file#${SOURCE_DIR}/}"
  extension="${relative_path##*.}"
  extension="${extension,,}"
  case "${extension}" in
    png|jpg|jpeg|gif|webp|svg|bmp|ico|avif)
      destination="${PACK_ICON_DIR}/${relative_path}"
      mkdir -p "$(dirname "${destination}")"
      cp -f "${source_file}" "${destination}"
      ;;
  esac
done < <(find "${SOURCE_DIR}" -type f -print0 | sort -z)

FILE_COUNT="$(find "${PACK_ICON_DIR}" -type f | wc -l | tr -d '[:space:]')"
SOURCE_BYTES="$(find "${PACK_ICON_DIR}" -type f -printf '%s\n' | awk '{sum += $1} END {print sum + 0}')"
if [[ "${FILE_COUNT}" -le 0 || "${SOURCE_BYTES}" -le 0 ]]; then
  echo "ERROR: Icon asset pack would be empty." >&2
  exit 1
fi

CONTENT_SHA256="$({
  cd "${PACK_ICON_DIR}"
  while IFS= read -r -d '' icon_file; do
    sha256sum "${icon_file}"
  done < <(find . -type f -print0 | sort -z)
} | sha256sum | awk '{print $1}')"

cat > "${STAGE_DIR}/asset-pack.json" <<EOF
{
  "schemaVersion": 1,
  "id": "folderview.plus-icons",
  "version": "${VERSION}",
  "fileCount": ${FILE_COUNT},
  "sourceBytes": ${SOURCE_BYTES},
  "contentSha256": "${CONTENT_SHA256}"
}
EOF

ARCHIVE_NAME="folderview.plus-icons-${VERSION}.txz"
ARCHIVE_PATH="${OUTPUT_DIR}/${ARCHIVE_NAME}"
tar --sort=name \
  --mtime='UTC 1970-01-01' \
  --owner=0 \
  --group=0 \
  --numeric-owner \
  -C "${STAGE_DIR}" \
  -cJf "${ARCHIVE_PATH}" asset-pack.json third-party-icons

SHA256="$(sha256sum "${ARCHIVE_PATH}" | awk '{print $1}')"
MD5="$(md5sum "${ARCHIVE_PATH}" | awk '{print $1}')"
printf '%s  %s\n' "${SHA256}" "${ARCHIVE_NAME}" > "${ARCHIVE_PATH}.sha256"

echo "Icon asset pack created: ${ARCHIVE_PATH}"
echo "Version: ${VERSION}"
echo "Files: ${FILE_COUNT}"
echo "Source bytes: ${SOURCE_BYTES}"
echo "Content SHA256: ${CONTENT_SHA256}"
echo "Archive MD5: ${MD5}"
echo "Archive SHA256: ${SHA256}"
