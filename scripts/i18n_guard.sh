#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LANG_DIR="${ROOT_DIR}/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/langs"
# shellcheck source=scripts/lib.sh
source "${ROOT_DIR}/scripts/lib.sh"

fvplus::require_commands node

if [[ ! -d "${LANG_DIR}" ]]; then
  fvplus::fail "Missing language directory: ${LANG_DIR}"
fi

node - "${LANG_DIR}" <<'NODE'
const fs = require('fs');
const path = require('path');

const langDir = process.argv[2];
const files = fs.readdirSync(langDir).filter((name) => name.endsWith('.json')).sort();

if (!files.includes('en.json')) {
  console.error(`ERROR: Missing base locale file: ${path.join(langDir, 'en.json')}`);
  process.exit(1);
}

const readLocale = (file) => {
  const fullPath = path.join(langDir, file);
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  } catch (error) {
    console.error(`ERROR: Invalid JSON in ${fullPath}: ${error.message}`);
    process.exit(1);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    console.error(`ERROR: Locale file must contain a JSON object: ${fullPath}`);
    process.exit(1);
  }
  return parsed;
};

const base = readLocale('en.json');
const baseKeys = Object.keys(base).sort();
let failed = false;

for (const key of baseKeys) {
  if (key === '@metadata') {
    if (!base[key] || typeof base[key] !== 'object' || Array.isArray(base[key])) {
      console.error('ERROR: en.json key "@metadata" must map to an object value.');
      failed = true;
    }
    continue;
  }
  if (typeof base[key] !== 'string') {
    console.error(`ERROR: en.json key "${key}" must map to a string value.`);
    failed = true;
  }
}

for (const file of files) {
  const locale = readLocale(file);
  const localeKeys = Object.keys(locale).sort();
  const missing = baseKeys.filter((key) => !Object.prototype.hasOwnProperty.call(locale, key));
  const extra = localeKeys.filter((key) => !Object.prototype.hasOwnProperty.call(base, key));
  if (missing.length > 0) {
    console.error(`ERROR: ${file} is missing ${missing.length} key(s): ${missing.slice(0, 12).join(', ')}`);
    failed = true;
  }
  if (extra.length > 0) {
    console.error(`ERROR: ${file} has ${extra.length} unexpected key(s): ${extra.slice(0, 12).join(', ')}`);
    failed = true;
  }
  for (const key of localeKeys) {
    if (key === '@metadata') {
      if (!locale[key] || typeof locale[key] !== 'object' || Array.isArray(locale[key])) {
        console.error(`ERROR: ${file} key "@metadata" must map to an object value.`);
        failed = true;
      }
      continue;
    }
    if (typeof locale[key] !== 'string') {
      console.error(`ERROR: ${file} key "${key}" must map to a string value.`);
      failed = true;
    }
  }
}

if (failed) {
  process.exit(1);
}

console.log(`i18n guard passed: ${files.length} locale file(s) aligned with en.json (${baseKeys.length} keys).`);
NODE
