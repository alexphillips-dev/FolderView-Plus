#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
fixture="$(mktemp -d /tmp/fvplus-sync-moving-refs.XXXXXX)"
trap 'rm -rf -- "${fixture}"' EXIT
FVPLUS_FIXTURE_GIT="$(command -v git)"
export FVPLUS_FIXTURE_GIT
git init -q -b main "${fixture}/source"
cd "${fixture}/source"
git config user.name 'FolderView Plus Fixture'
git config user.email 'folderviewplus@example.invalid'
mkdir scripts
cp "${repo_root}/scripts/"{lib.sh,release_sync.sh,sync_main_to_dev.sh} scripts/
cp "${repo_root}/folderview.plus.plg" .
printf '/tmp/\n' > .gitignore
git add .
git commit -qm 'Qualified fixture baseline'
baseline="$(git rev-parse HEAD)"
git branch dev
git commit -q --allow-empty -m 'Second fixture revision'
FVPLUS_FIXTURE_ADVANCE="$(git rev-parse HEAD)"
export FVPLUS_FIXTURE_ADVANCE

mkdir "${fixture}/bin"
cat > "${fixture}/bin/git" <<'GIT'
#!/usr/bin/env bash
set -euo pipefail
case "${1:-}" in
  fetch)
    count="$(cat "${FVPLUS_FIXTURE_FETCHES}")"
    count="$((count + 1))"
    printf '%s\n' "${count}" > "${FVPLUS_FIXTURE_FETCHES}"
    if [[ "${count}" == 3 && "${FVPLUS_FIXTURE_STAGE}" == 'nested fetch' ]]; then
      "${FVPLUS_FIXTURE_GIT}" --git-dir="${FVPLUS_FIXTURE_ORIGIN}" update-ref "refs/heads/${FVPLUS_FIXTURE_BRANCH}" "${FVPLUS_FIXTURE_ADVANCE}"
    fi
    ;;
  push)
    touch "${FVPLUS_FIXTURE_PUSH}"
    exit 85
    ;;
esac
exec "${FVPLUS_FIXTURE_GIT}" "$@"
GIT
cat > "${fixture}/bin/node" <<'NODE'
#!/usr/bin/env bash
set -euo pipefail
[[ "$*" == 'scripts/release_validation.mjs wait' ]]
if [[ "${FVPLUS_FIXTURE_STAGE}" == wait ]]; then
  "${FVPLUS_FIXTURE_GIT}" --git-dir="${FVPLUS_FIXTURE_ORIGIN}" update-ref "refs/heads/${FVPLUS_FIXTURE_BRANCH}" "${FVPLUS_FIXTURE_ADVANCE}"
fi
NODE
chmod +x "${fixture}/bin/"{git,node}

for stage in wait 'nested fetch'; do
  for branch in main dev; do
    case_dir="$(mktemp -d "${fixture}/case.XXXXXX")"
    git clone -q --bare "${fixture}/source" "${case_dir}/origin.git"
    git --git-dir="${case_dir}/origin.git" update-ref refs/heads/main "${baseline}"
    git clone -q -b main "${case_dir}/origin.git" "${case_dir}/work"
    printf '0\n' > "${case_dir}/fetches"
    status=0
    output="$(
      cd "${case_dir}/work"
      FVPLUS_FIXTURE_BRANCH="${branch}" FVPLUS_FIXTURE_STAGE="${stage}" FVPLUS_FIXTURE_ORIGIN="${case_dir}/origin.git" \
        FVPLUS_FIXTURE_FETCHES="${case_dir}/fetches" FVPLUS_FIXTURE_PUSH="${case_dir}/pushed" PATH="${fixture}/bin:${PATH}" \
        bash scripts/release_sync.sh --push-dev 2>&1
    )" || status=$?
    expected="${branch^} moved during synchronization"
    if [[ "${status}" -eq 0 || "${output}" != *"${expected}"* || -e "${case_dir}/pushed" ]]; then
      printf 'Expected early refusal for %s moving during %s. Output:\n%s\n' "${branch}" "${stage}" "${output}" >&2
      exit 1
    fi
    printf '%s moved during %s\n' "${branch}" "${stage}"
  done
done
