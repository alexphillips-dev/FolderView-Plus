#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib.sh
source "${ROOT_DIR}/scripts/lib.sh"
cd "${ROOT_DIR}"

fvplus::require_commands bash node awk sed mktemp grep

VERSION="$(fvplus::read_plg_version "${ROOT_DIR}/folderview.plus.plg")"
TMP_DIR="$(mktemp -d "${ROOT_DIR}/tmp/release-notes-guard.XXXXXX")"
trap 'rm -rf "${TMP_DIR}"' EXIT
OUTPUT_FILE="${TMP_DIR}/release_notes.md"

chmod +x scripts/build_release_notes.sh
bash scripts/build_release_notes.sh --version "${VERSION}" --output "${OUTPUT_FILE}"

node - "${VERSION}" "${OUTPUT_FILE}" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const version = process.argv[2];
const outputFile = process.argv[3];
const root = process.cwd();
const plg = fs.readFileSync(path.join(root, 'folderview.plus.plg'), 'utf8');
const releaseOnMain = fs.readFileSync(path.join(root, '.github/workflows/release-on-main.yml'), 'utf8');
const releaseMain = fs.readFileSync(path.join(root, '.github/workflows/release-main.yml'), 'utf8');
const rendered = fs.readFileSync(outputFile, 'utf8');

const fail = (message) => {
  console.error(`ERROR: ${message}`);
  process.exit(1);
};

const blockMatch = plg.match(new RegExp(`^###${version}\\s*$([\\s\\S]*?)(?=^###|\\Z)`, 'm'));
if (!blockMatch) {
  fail(`Missing CHANGES block for version ${version}.`);
}
const notesBlock = blockMatch[1].replace(/^\s+|\s+$/g, '');
if (!notesBlock) {
  fail(`CHANGES block for version ${version} is empty.`);
}
if (!rendered.includes(`## FolderView Plus ${version}`)) {
  fail('Generated release notes are missing the expected version header.');
}
if (!rendered.includes('### Changes')) {
  fail('Generated release notes are missing the changes heading.');
}
for (const line of notesBlock.split(/\r?\n/).filter(Boolean)) {
  if (!rendered.includes(line)) {
    fail(`Generated release notes are missing CHANGES line: ${line}`);
  }
}
if (!/bash scripts\/build_release_notes\.sh/.test(releaseOnMain)) {
  fail('Release On Main workflow is not using scripts/build_release_notes.sh.');
}
if (!/--notes-file release_notes\.md/.test(releaseOnMain)) {
  fail('Release On Main workflow must publish GitHub releases from release_notes.md.');
}
if (/release_notes\.md/.test(releaseMain) && /gh release/.test(releaseMain)) {
  fail('Release Main workflow must not own release note publishing.');
}

console.log('Release notes consistency guard passed.');
NODE
