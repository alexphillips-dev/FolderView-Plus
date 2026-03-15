#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PAGE_FILE="${ROOT_DIR}/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/FolderViewPlus.page"

# shellcheck source=scripts/lib.sh
source "${ROOT_DIR}/scripts/lib.sh"

fvplus::require_commands node

if [[ ! -f "${PAGE_FILE}" ]]; then
  fvplus::fail "Missing settings page file: ${PAGE_FILE}"
fi

node - "${PAGE_FILE}" <<'NODE'
const fs = require('fs');

const pageFile = process.argv[2];
const source = fs.readFileSync(pageFile, 'utf8');
const includes = [...source.matchAll(/folderviewplus(?:\.[a-z]+)?\.js/g)].map((match) => match[0]);

const expectedOrder = [
  'folderviewplus.utils.js',
  'folderviewplus.request.js',
  'folderviewplus.chrome.js',
  'folderviewplus.dirty.js',
  'folderviewplus.wizard.js',
  'folderviewplus.import.js',
  'folderviewplus.js'
];

const includeSet = new Set(includes);
let failed = false;

for (const expected of expectedOrder) {
  const count = includes.filter((entry) => entry === expected).length;
  if (count !== 1) {
    console.error(`ERROR: Expected exactly one include for ${expected}, found ${count}.`);
    failed = true;
  }
}

for (const include of includeSet) {
  if (!expectedOrder.includes(include)) {
    console.error(`ERROR: Unexpected settings include detected: ${include}`);
    failed = true;
  }
}

const positions = expectedOrder.map((entry) => includes.indexOf(entry));
for (let index = 1; index < positions.length; index += 1) {
  if (positions[index - 1] > positions[index]) {
    console.error(
      `ERROR: Invalid include order: ${expectedOrder[index - 1]} must load before ${expectedOrder[index]}.`
    );
    failed = true;
  }
}

if (failed) {
  console.error(`Found include order: ${includes.join(' -> ') || '(none)'}`);
  process.exit(1);
}

console.log(`Include order guard passed: ${expectedOrder.join(' -> ')}`);
NODE
