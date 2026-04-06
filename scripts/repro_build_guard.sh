#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PKG_BUILD_SCRIPT="${ROOT_DIR}/pkg_build.sh"
PLG_FILE="${ROOT_DIR}/folderview.plus.plg"
XML_FILE="${ROOT_DIR}/folderview.plus.xml"
VERSION="$(sed -n 's/^<!ENTITY version "\([^"]*\)".*/\1/p' "${PLG_FILE}" | head -n 1 || true)"
VERSION_OVERRIDE="${FVPLUS_REPRO_VERSION_OVERRIDE:-${VERSION}}"
ALLOW_STALE_STABLE_RAW="${FVPLUS_REPRO_ALLOW_STALE_STABLE:-0}"
# shellcheck source=scripts/lib.sh
source "${ROOT_DIR}/scripts/lib.sh"

fvplus::require_commands bash mktemp cp sha256sum cmp date sed

if [[ ! -x "${PKG_BUILD_SCRIPT}" ]]; then
  chmod +x "${PKG_BUILD_SCRIPT}"
fi

if [[ -z "${VERSION_OVERRIDE}" ]]; then
  fvplus::fail "Could not resolve release version for deterministic build guard."
fi

case "$(printf '%s' "${ALLOW_STALE_STABLE_RAW}" | tr '[:upper:]' '[:lower:]')" in
  1|true|yes|on)
    ALLOW_STALE_STABLE=1
    ;;
  *)
    ALLOW_STALE_STABLE=0
    ;;
esac

if [[ "${VERSION_OVERRIDE}" =~ ^([0-9]{4}\.[0-9]{2}\.[0-9]{2})(\.[0-9]+)?$ ]]; then
  stable_date="${BASH_REMATCH[1]}"
  # Use UTC to match pkg_build.sh date resolution during deterministic checks.
  today_date="$(TZ=UTC date +"%Y.%m.%d")"
  if [[ "${stable_date}" != "${today_date}" && "${ALLOW_STALE_STABLE}" -ne 1 ]]; then
    echo "Skipping deterministic build guard for stale stable version ${VERSION_OVERRIDE} (today: ${today_date})."
    echo "Set FVPLUS_REPRO_ALLOW_STALE_STABLE=1 to force this check."
    exit 0
  fi
fi

tmp_dir="$(mktemp -d)"
out_a="${tmp_dir}/build-a"
out_b="${tmp_dir}/build-b"
backup_plg="${tmp_dir}/folderview.plus.plg.bak"
backup_xml="${tmp_dir}/folderview.plus.xml.bak"
mkdir -p "${out_a}" "${out_b}"
cp "${PLG_FILE}" "${backup_plg}"
cp "${XML_FILE}" "${backup_xml}"

cleanup() {
  if [[ -f "${backup_plg}" ]]; then
    cp "${backup_plg}" "${PLG_FILE}"
  fi
  if [[ -f "${backup_xml}" ]]; then
    cp "${backup_xml}" "${XML_FILE}"
  fi
  rm -rf "${tmp_dir}"
}
trap cleanup EXIT

build_once() {
  local output_dir="$1"
  (
    cd "${ROOT_DIR}"
    TZ=UTC \
    LC_ALL=C \
    LANG=C \
    FVPLUS_VERSION_OVERRIDE="${VERSION_OVERRIDE}" \
    bash "${PKG_BUILD_SCRIPT}" --output-dir "${output_dir}" --no-validate
  )
}

build_once "${out_a}"
build_once "${out_b}"

archive_name="folderview.plus-${VERSION_OVERRIDE}.txz"
archive_a="${out_a}/${archive_name}"
archive_b="${out_b}/${archive_name}"

if [[ ! -f "${archive_a}" || ! -f "${archive_b}" ]]; then
  fvplus::fail "Deterministic build guard could not locate output archives (${archive_name})."
fi

sha_a="$(sha256sum "${archive_a}" | awk '{print $1}')"
sha_b="$(sha256sum "${archive_b}" | awk '{print $1}')"
if [[ "${sha_a}" != "${sha_b}" ]]; then
  fvplus::fail "Deterministic build guard failed: archive hashes differ (${sha_a} vs ${sha_b})."
fi

if ! cmp -s "${archive_a}" "${archive_b}"; then
  fvplus::fail "Deterministic build guard failed: archive bytes differ despite matching hash."
fi

echo "Deterministic build guard passed for ${archive_name} (sha256: ${sha_a})."
