#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib.sh
source "${ROOT_DIR}/scripts/lib.sh"
fvplus::require_commands gh git node sha256sum cmp mktemp

tag="${1:?Expected a release tag}"
archive="${2:?Expected the release archive}"
checksum="${3:?Expected the release checksum}"
notes="${4:?Expected the release notes}"
candidate="${GITHUB_SHA:?Expected the qualified candidate SHA}"
attempts="${FVPLUS_GITHUB_RELEASE_ATTEMPTS:-6}"
initial_delay="${FVPLUS_GITHUB_RELEASE_DELAY_SEC:-10}"
version="${tag#v}"
[[ "${tag}" =~ ^v[0-9]{4}\.[0-9]{2}\.[0-9]{2}\.[0-9]{2}$ && "${candidate}" =~ ^[a-f0-9]{40}$ ]] \
  || fvplus::fail 'Invalid release tag or candidate commit.'
[[ "${archive##*/}" == "folderview.plus-${version}.txz" && "${checksum##*/}" == "${archive##*/}.sha256" ]] \
  || fvplus::fail 'Release assets do not match the release tag.'
[[ -s "${archive}" && -s "${checksum}" && -s "${notes}" ]] || fvplus::fail 'Release inputs are incomplete.'

retry() {
  local label="$1" attempt=1 delay="${initial_delay}"
  shift
  until "$@"; do
    if (( attempt >= attempts )); then
      echo "::error::${label} failed after ${attempts} attempts." >&2
      return 1
    fi
    echo "::warning::${label} failed on attempt ${attempt}/${attempts}. Retrying in ${delay}s." >&2
    sleep "${delay}"
    attempt=$((attempt + 1))
    delay=$((delay < 60 ? delay * 2 : 60))
  done
}

verify_tag() {
  local required="$1" ref="refs/tags/${tag}" status=0
  git ls-remote --exit-code --tags origin "${ref}" >/dev/null || status=$?
  if (( status == 2 && required == 0 )); then return 0; fi
  (( status == 0 )) || return 1
  git fetch --no-tags --depth=1 origin "${ref}" || return 1
  [[ "$(git rev-parse 'FETCH_HEAD^{commit}')" == "${candidate}" ]] \
    || fvplus::fail "Release tag ${tag} does not point to the qualified commit."
}

get_release() {
  local status=0 response
  response="$(gh release view "${tag}" --json isDraft,targetCommitish,assets 2>&1)" || status=$?
  if (( status == 0 )); then
    release="$(node --input-type=module -e '
      import fs from "node:fs";
      const { isDraft, targetCommitish, assets } = JSON.parse(fs.readFileSync(0, "utf8"));
      if (typeof isDraft !== "boolean" || !Array.isArray(assets)) process.exit(1);
      const asset = assets.find(entry => entry.name === process.argv[2]);
      const state = !asset ? "missing" : ["uploaded", "starter"].includes(asset.state) ? asset.state : "unknown";
      const digest = /^sha256:[a-f0-9]{64}$/.test(asset?.digest) ? asset.digest : "-";
      console.log(isDraft, targetCommitish === process.argv[1], state, digest);
    ' "${candidate}" "${1:-}" <<<"${response}")"
  elif grep -Eiq 'release not found|HTTP 404|Not Found' <<<"${response}"; then
    release=''
  else
    return 1
  fi
}

create_or_confirm_draft() {
  get_release || return 1
  [[ -n "${release}" ]] && return 0
  gh release create "${tag}" --draft --target "${candidate}" --title "${tag}" --notes-file "${notes}"
}

get_existing_release() {
  get_release && [[ -n "${release}" ]]
}

verify_release_target() {
  local draft exact_target
  read -r draft exact_target _ _ <<<"${release}"
  # A draft may not have created its tag yet. A nonexact draft target is safe
  # only when the existing tag has independently been verified.
  if [[ "${draft}" == true && "${exact_target}" == true ]]; then
    verify_tag 0
  else
    verify_tag 1
  fi
}

verify_asset() (
  local file="$1" digest="$2" local_digest temp
  if [[ "${digest}" == sha256:* ]]; then
    local_digest="$(sha256sum "${file}")" || return 1
    [[ "${digest}" == "sha256:${local_digest%% *}" ]]
  else
    # Older GitHub CLI versions do not expose release asset digests.
    temp="$(mktemp -d)" || return 1
    trap 'rm -f -- "${temp}/asset"; rmdir -- "${temp}"' EXIT
    gh release download "${tag}" --pattern "${file##*/}" --output "${temp}/asset" && cmp -s -- "${file}" "${temp}/asset"
  fi
)

release_asset() {
  local file="$1" mode="$2" draft state digest
  get_release "${file##*/}" && [[ -n "${release}" ]] || return 1
  read -r draft _ state digest <<<"${release}"
  if [[ "${state}" != missing ]]; then
    if [[ "${state}" == uploaded ]] && verify_asset "${file}" "${digest}"; then return 0; fi
    if [[ "${mode}" == upload && "${draft}" == true && "${state}" == starter ]]; then
      # A failed GitHub upload can leave a starter record with no complete asset.
      gh release delete-asset "${tag}" "${file##*/}" --yes || return 1
    else
      echo "::error::Could not verify release asset ${file##*/} against the qualified bytes." >&2
      return 1
    fi
  fi
  [[ "${mode}" == upload ]] && gh release upload "${tag}" "${file}"
}

verify_tag 0
retry 'Prepare draft release' create_or_confirm_draft
retry 'Read release metadata' get_existing_release
verify_release_target

retry 'Upload release package' release_asset "${archive}" upload
retry 'Upload release checksum' release_asset "${checksum}" upload
retry 'Verify uploaded release package' release_asset "${archive}" verify
retry 'Verify uploaded release checksum' release_asset "${checksum}" verify
retry 'Read release metadata' get_existing_release
verify_release_target
read -r draft _ _ _ <<<"${release}"
if [[ "${draft}" == true ]]; then
  retry 'Publish verified release' gh release edit "${tag}" --draft=false --title "${tag}" --notes-file "${notes}"
else
  retry 'Update release metadata' gh release edit "${tag}" --title "${tag}" --notes-file "${notes}"
fi
retry 'Verify published release tag' verify_tag 1
echo "Published release ${tag} with the verified package and checksum."
