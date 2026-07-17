#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LANG_DIR="${ROOT_DIR}/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/langs"
# shellcheck source=scripts/lib.sh
source "${ROOT_DIR}/scripts/lib.sh"

fvplus::require_commands node
NODE_BIN="$(fvplus::resolve_platform_command node)"

if [[ ! -d "${LANG_DIR}" ]]; then
  fvplus::fail "Missing language directory: ${LANG_DIR}"
fi

"${NODE_BIN}" - "$(fvplus::path_for_command "${NODE_BIN}" "${LANG_DIR}")" <<'NODE'
const fs = require('fs');
const path = require('path');

const langDir = process.argv[2];
const rootFiles = fs.readdirSync(langDir).filter((name) => /^[a-z]{2,3}(?:-[A-Za-z0-9]+)*\.json$/.test(name)).sort();
const namespaceRoot = path.join(langDir, 'namespaces');
const requiredMetadata = [
  'catalog-version', 'direction', 'last-updated', 'locale', 'native-name', 'reviewed',
  'source-revision', 'status', 'translated-messages', 'total-source-messages'
];
const allowedStatuses = new Set(['source', 'complete', 'partial', 'placeholder']);
const allowedDirections = new Set(['ltr', 'rtl']);
let failed = false;
const warnings = [];

const fail = (message) => {
  console.error(`ERROR: ${message}`);
  failed = true;
};

const readJson = (fullPath) => {
  try {
    const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('catalog must contain a JSON object');
    }
    return parsed;
  } catch (error) {
    console.error(`ERROR: Invalid locale catalog ${fullPath}: ${error.message}`);
    process.exit(1);
  }
};

const localeNamespaceFiles = (locale) => {
  const dir = path.join(namespaceRoot, locale);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => path.join(dir, name));
};

const buildCatalog = (locale) => {
  const files = [path.join(langDir, `${locale}.json`), ...localeNamespaceFiles(locale)].filter(fs.existsSync);
  const messages = {};
  let metadata = null;
  for (const fullPath of files) {
    const parsed = readJson(fullPath);
    const fileMetadata = parsed['@metadata'];
    if (fullPath === path.join(langDir, `${locale}.json`)) metadata = fileMetadata;
    for (const [key, value] of Object.entries(parsed)) {
      if (key === '@metadata') continue;
      if (Object.prototype.hasOwnProperty.call(messages, key)) {
        fail(`${locale} defines duplicate key "${key}" in ${fullPath}.`);
        continue;
      }
      messages[key] = value;
    }
  }
  return { files, messages, metadata };
};

const messageParameters = (value) => [...new Set(String(value || '').match(/\$\d+/g) || [])].sort();
const htmlTags = (value) => [...String(value || '').matchAll(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi)].map((match) => match[1].toLowerCase());
const hasBalancedPluralSyntax = (value) => {
  const source = String(value || '');
  const starts = (source.match(/\{\{PLURAL:/g) || []).length;
  const ends = (source.match(/}}/g) || []).length;
  return starts === 0 || ends >= starts;
};
const payloadFingerprint = (messages) => JSON.stringify(Object.fromEntries(Object.entries(messages).sort(([a], [b]) => a.localeCompare(b))));

if (!rootFiles.includes('en.json')) {
  console.error(`ERROR: Missing base locale file: ${path.join(langDir, 'en.json')}`);
  process.exit(1);
}

const base = buildCatalog('en');
const baseKeys = Object.keys(base.messages).sort();
if (baseKeys.length === 0) fail('English source catalog has no messages.');

for (const [key, value] of Object.entries(base.messages)) {
  if (typeof value !== 'string') fail(`English key "${key}" must map to a string.`);
  if (!hasBalancedPluralSyntax(value)) fail(`English key "${key}" has invalid plural syntax.`);
}

const seenFingerprints = new Map();
const coverageRows = [];
for (const file of rootFiles) {
  const locale = file.replace(/\.json$/, '');
  const catalog = buildCatalog(locale);
  const metadata = catalog.metadata;
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    fail(`${file} requires an @metadata object.`);
    continue;
  }
  for (const key of requiredMetadata) {
    if (!Object.prototype.hasOwnProperty.call(metadata, key)) fail(`${file} metadata is missing "${key}".`);
  }
  if (metadata.locale !== locale) fail(`${file} metadata locale must be "${locale}".`);
  if (!allowedStatuses.has(String(metadata.status || ''))) fail(`${file} has invalid translation status "${metadata.status}".`);
  if (!allowedDirections.has(String(metadata.direction || ''))) fail(`${file} has invalid direction "${metadata.direction}".`);
  if (typeof metadata.reviewed !== 'boolean') fail(`${file} metadata reviewed must be boolean.`);
  if (!Number.isInteger(metadata['translated-messages']) || metadata['translated-messages'] < 0) {
    fail(`${file} translated-messages must be a non-negative integer.`);
  }
  if (!Number.isInteger(metadata['total-source-messages']) || metadata['total-source-messages'] < 1) {
    fail(`${file} total-source-messages must be a positive integer.`);
  }
  if (metadata.status === 'placeholder' && metadata['translated-messages'] !== 0) {
    fail(`${file} placeholder locale must report zero translated messages.`);
  }
  if (metadata.status === 'complete' && metadata['source-revision'] !== base.metadata?.['source-revision']) {
    fail(`${file} claims complete status against a stale source revision.`);
  }

  const extra = Object.keys(catalog.messages).filter((key) => !Object.prototype.hasOwnProperty.call(base.messages, key));
  if (extra.length > 0) fail(`${file} has ${extra.length} key(s) absent from English: ${extra.slice(0, 12).join(', ')}`);

  for (const [key, value] of Object.entries(catalog.messages)) {
    if (typeof value !== 'string') {
      fail(`${file} key "${key}" must map to a string.`);
      continue;
    }
    if (!hasBalancedPluralSyntax(value)) fail(`${file} key "${key}" has invalid plural syntax.`);
    if (!Object.prototype.hasOwnProperty.call(base.messages, key)) continue;
    const sourceParams = messageParameters(base.messages[key]);
    const localeParams = messageParameters(value);
    if (sourceParams.join('|') !== localeParams.join('|')) {
      fail(`${file} key "${key}" parameters differ from English (${sourceParams.join(', ')} vs ${localeParams.join(', ')}).`);
    }
    const sourceTags = htmlTags(base.messages[key]).sort();
    const localeTags = htmlTags(value).sort();
    if (sourceTags.join('|') !== localeTags.join('|')) {
      if (metadata.status === 'complete' || metadata.status === 'source') {
        fail(`${file} key "${key}" HTML tags differ from English.`);
      } else if (metadata.status !== 'placeholder') {
        warnings.push(`${file} key "${key}" HTML tags differ from English and should be reviewed.`);
      }
    }
  }

  const fingerprint = payloadFingerprint(catalog.messages);
  const duplicateOf = seenFingerprints.get(fingerprint);
  if (duplicateOf && locale !== 'en' && metadata.status !== 'placeholder') {
    fail(`${file} duplicates ${duplicateOf} but is not marked placeholder.`);
  }
  if (!duplicateOf) seenFingerprints.set(fingerprint, file);

  const translated = locale === 'en'
    ? baseKeys.length
    : baseKeys.filter((key) => catalog.messages[key] && catalog.messages[key] !== base.messages[key]).length;
  if (metadata['total-source-messages'] !== baseKeys.length) {
    fail(`${file} total-source-messages is ${metadata['total-source-messages']}; expected ${baseKeys.length}.`);
  }
  if (metadata.status === 'source' && metadata['translated-messages'] !== baseKeys.length) {
    fail(`${file} source locale must report ${baseKeys.length} translated messages.`);
  }
  if (metadata.status === 'partial' && metadata['translated-messages'] !== translated) {
    fail(`${file} translated-messages is ${metadata['translated-messages']}; measured ${translated}.`);
  }
  coverageRows.push({ locale, status: metadata.status, translated, total: baseKeys.length, loadedKeys: Object.keys(catalog.messages).length });
}

if (failed) process.exit(1);

for (const warning of warnings.slice(0, 30)) console.log(`WARN: ${warning}`);
if (warnings.length > 30) console.log(`WARN: ${warnings.length - 30} additional translation review warning(s) omitted.`);
for (const row of coverageRows) {
  const percent = row.total > 0 ? Math.round((row.translated / row.total) * 100) : 0;
  console.log(`  ${row.locale.padEnd(7)} ${String(row.status).padEnd(11)} ${String(row.translated).padStart(3)}/${row.total} (${String(percent).padStart(3)}%) ${row.loadedKeys} loaded key(s)`);
}
console.log(`i18n guard passed: ${rootFiles.length} locale file(s), ${baseKeys.length} aggregate English keys, metadata and message contracts valid.`);
NODE
