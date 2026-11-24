#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
fixture="$(mktemp -d /tmp/fvplus-remote-publish.XXXXXX)"
trap 'rm -rf -- "${fixture}"' EXIT
mkdir -p "${fixture}"/{archive,bin,scripts}
cp "${repo_root}/scripts/"{remote_publish_guard.sh,lib.sh} "${fixture}/scripts/"

version=2026.01.01.01
icon_version=1.0.0
archive_name="folderview.plus-${version}.txz"
icon_archive_name="folderview.plus-icons-${icon_version}.txz"
archive="${fixture}/archive/${archive_name}"
icon_archive="${fixture}/${icon_archive_name}"
printf '%s\n' 'synthetic core archive' > "${archive}"
printf '%s\n' 'synthetic icon archive' > "${icon_archive}"
(cd "${fixture}/archive"; sha256sum "${archive_name}" > "${archive_name}.sha256")
core_sha256="$(sha256sum "${archive}" | cut -d ' ' -f 1)"
core_md5="$(md5sum "${archive}" | cut -d ' ' -f 1)"
icon_sha256="$(sha256sum "${icon_archive}" | cut -d ' ' -f 1)"
icon_md5="$(md5sum "${icon_archive}" | cut -d ' ' -f 1)"

cat > "${fixture}/bin/curl" <<'CURL'
#!/usr/bin/env bash
set -euo pipefail
destination="${@: -1}"
url="${@: -3:1}"
prefix="https://raw.githubusercontent.com/example/fixture/${FVPLUS_FIXTURE_REF}/"
[[ "${url}" == "${prefix}"* ]]
relative="${url#"${prefix}"}"
printf '%s\n' "${relative}" >> "${FVPLUS_FIXTURE_HTTP_LOG}"
[[ -f "${FVPLUS_FIXTURE_REMOTE}/${relative}" ]] || exit 22
cp -- "${FVPLUS_FIXTURE_REMOTE}/${relative}" "${destination}"
CURL
chmod +x "${fixture}/bin/curl"
export PATH="${fixture}/bin:${PATH}"
export FVPLUS_REMOTE_PUBLISH_ATTEMPTS=1 FVPLUS_REMOTE_PUBLISH_DELAY_SEC=0
export FVPLUS_FIXTURE_REMOTE="${fixture}/served"
export FVPLUS_FIXTURE_HTTP_LOG="${fixture}/http-requests"

run_guard() {
  bash "${fixture}/scripts/remote_publish_guard.sh"
}

verify_failure() {
  local expected="$1" output
  if output="$(run_guard 2>&1)" || [[ "${output}" != *"${expected}"* ]]; then
    printf 'Expected guard failure with %s. Output:\n%s\n' "${expected}" "${output}" >&2
    exit 1
  fi
}

for branch in dev main; do
  export FVPLUS_FIXTURE_REF="${branch}"
  manifest="${fixture}/folderview.plus.plg"
  served_manifest="${FVPLUS_FIXTURE_REMOTE}/folderview.plus.plg"
  served_archive="${FVPLUS_FIXTURE_REMOTE}/archive/${archive_name}"
  served_icon_archive="${FVPLUS_FIXTURE_REMOTE}/asset-packs/${icon_archive_name}"
  mkdir -p "${FVPLUS_FIXTURE_REMOTE}/"{archive,asset-packs}
  cat > "${manifest}" <<MANIFEST
<!DOCTYPE PLUGIN [
<!ENTITY name "folderview.plus">
<!ENTITY github "example/fixture">
<!ENTITY version "${version}">
<!ENTITY md5 "${core_md5}">
<!ENTITY sha256 "${core_sha256}">
<!ENTITY pluginURL "https://raw.githubusercontent.com/&github;/${branch}/folderview.plus.plg">
<!ENTITY iconPackVersion "${icon_version}">
<!ENTITY iconPackURL "https://raw.githubusercontent.com/&github;/${branch}/asset-packs/folderview.plus-icons-&iconPackVersion;.txz">
<!ENTITY iconPackMd5 "${icon_md5}">
<!ENTITY iconPackSha256 "${icon_sha256}">
]>
<PLUGIN>
  <FILE>
    <URL>https://raw.githubusercontent.com/&github;/${branch}/archive/&name;-&version;.txz</URL>
  </FILE>
</PLUGIN>
MANIFEST
  cp "${manifest}" "${served_manifest}"
  cp "${archive}" "${archive}.sha256" "${FVPLUS_FIXTURE_REMOTE}/archive/"
  cp "${icon_archive}" "${served_icon_archive}"
  run_guard >/dev/null

  sed "s/${core_sha256}/$(printf '%064d' 0)/" "${manifest}" > "${served_manifest}"
  verify_failure 'published manifest differs from the checked-out manifest'
  cp "${manifest}" "${served_manifest}"

  printf '%s\n' 'incorrect archive bytes' > "${served_archive}"
  verify_failure 'published archive bytes stale or mismatched'
  cp "${archive}" "${served_archive}"

  rm -- "${served_icon_archive}"
  verify_failure 'icon pack unavailable'

  printf '%s\n' 'incorrect icon archive bytes' > "${served_icon_archive}"
  verify_failure 'published icon pack bytes stale or mismatched'

  rm -- "${served_manifest}"
  : > "${FVPLUS_FIXTURE_HTTP_LOG}"
  FVPLUS_REMOTE_PUBLISH_ATTEMPTS=08 verify_failure 'after 8 attempt(s): manifest unavailable.'
  [[ "$(wc -l < "${FVPLUS_FIXTURE_HTTP_LOG}")" -eq 8 ]]
  printf '%s publication fixture passed\n' "${branch}"
done
