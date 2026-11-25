#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLG_FILE="${ROOT_DIR}/folderview.plus.plg"
VERSION="$(sed -n 's/^<!ENTITY version "\([^"]*\)".*/\1/p' "${PLG_FILE}" | head -n 1 || true)"
VERSION_OVERRIDE="${FVPLUS_REPRO_VERSION_OVERRIDE:-${VERSION}}"
ALLOW_STALE_STABLE_RAW="${FVPLUS_REPRO_ALLOW_STALE_STABLE:-0}"
# shellcheck source=scripts/lib.sh
source "${ROOT_DIR}/scripts/lib.sh"

fvplus::require_commands bash mktemp cp sha256sum cmp date sed

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
trap 'rm -rf -- "${tmp_dir}"' EXIT

snapshot="${tmp_dir}/snapshot"
out_a="${tmp_dir}/out-a"
out_b="${tmp_dir}/out-b"
archive_name="folderview.plus-${VERSION_OVERRIDE}.txz"
published_archive="${ROOT_DIR}/archive/${archive_name}"
if [[ ! -f "${published_archive}" ]]; then
  fvplus::fail "Deterministic build guard could not locate the repository archive (${published_archive})."
fi
cp -- "${published_archive}" "${tmp_dir}/${archive_name}"

mkdir -p "${snapshot}/docs" "${out_a}" "${out_b}"
cp -a -- "${ROOT_DIR}/pkg_build.sh" "${PLG_FILE}" "${ROOT_DIR}/folderview.plus.xml" \
  "${ROOT_DIR}/package-lock.json" "${ROOT_DIR}/.github" "${ROOT_DIR}/asset-packs" \
  "${ROOT_DIR}/scripts" "${ROOT_DIR}/src" "${snapshot}/"
cp -a -- "${ROOT_DIR}/docs/releases" "${snapshot}/docs/"

branch_args=()
if [[ -z "${FVPLUS_BUILD_BRANCH:-}" ]] && command -v git >/dev/null 2>&1; then
  source_branch="$(git -C "${ROOT_DIR}" symbolic-ref --quiet --short HEAD 2>/dev/null || true)"
  source_branch="${source_branch:-${GITHUB_REF_NAME:-}}"
  source_branch="${source_branch#refs/heads/}"
  if [[ "${source_branch}" == dev || "${source_branch}" == main ]]; then
    branch_args=(--branch "${source_branch}")
  fi
fi

build_once() {
  local checkout="$1" output_dir="$2"
  cp -a -- "${snapshot}" "${checkout}"
  (
    cd "${checkout}"
    TZ=UTC \
    LC_ALL=C \
    LANG=C \
    FVPLUS_HISTORICAL_REBUILD=1 \
    FVPLUS_VERSION_OVERRIDE="${VERSION_OVERRIDE}" \
    bash ./pkg_build.sh "${branch_args[@]}" --output-dir "${output_dir}" --no-validate
  )
}

build_once "${tmp_dir}/checkout-a" "${out_a}"
build_once "${tmp_dir}/checkout-b" "${out_b}"

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
published_sha="$(sha256sum "${tmp_dir}/${archive_name}" | awk '{print $1}')"
if [[ "${published_sha}" != "${sha_a}" ]] || ! cmp -s "${tmp_dir}/${archive_name}" "${archive_a}"; then
  fvplus::fail "Deterministic build guard failed: repository archive differs from the reproducible build (${published_sha} vs ${sha_a})."
fi

echo "Deterministic build guard passed for ${archive_name}; repository and isolated builds match (sha256: ${sha_a})."
