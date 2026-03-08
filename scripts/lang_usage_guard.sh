#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLUGIN_DIR="${ROOT_DIR}/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus"
EN_FILE="${PLUGIN_DIR}/langs/en.json"
STRICT_MODE="${FVPLUS_I18N_STRICT:-0}"
ALLOW_UNUSED_KEYS="${FVPLUS_I18N_ALLOW_UNUSED_KEYS:-el-id,folderviewplus-desc}"
# shellcheck source=scripts/lib.sh
source "${ROOT_DIR}/scripts/lib.sh"

fvplus::require_commands node

if [[ ! -f "${EN_FILE}" ]]; then
  fvplus::fail "Missing base locale file: ${EN_FILE}"
fi

node - "${PLUGIN_DIR}" "${EN_FILE}" "${STRICT_MODE}" "${ALLOW_UNUSED_KEYS}" <<'NODE'
const fs = require('fs');
const path = require('path');

const pluginDir = process.argv[2];
const enFile = process.argv[3];
const strictMode = /^(1|true|yes|on)$/i.test(String(process.argv[4] || '').trim());
const allowUnusedKeys = new Set(
  String(process.argv[5] || '')
    .split(/[,\n;]+/)
    .map((raw) => raw.trim())
    .filter(Boolean)
);

const normalizeKey = (raw) => {
  if (!raw) return '';
  const trimmed = String(raw).trim();
  if (!trimmed) return '';
  const segments = trimmed.split(';');
  const normalized = [];
  for (const segment of segments) {
    const token = segment.trim();
    if (!token) continue;
    const key = token.replace(/^\[[^\]]+]/, '').trim();
    if (key) normalized.push(key);
  }
  return normalized;
};

const lineNumberAt = (source, index) => source.slice(0, index).split('\n').length;

const sourceFiles = [];
const queue = [pluginDir];
while (queue.length > 0) {
  const current = queue.pop();
  const entries = fs.readdirSync(current, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(current, entry.name);
    const relativePath = path.relative(pluginDir, fullPath).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      if (relativePath.startsWith('scripts/include') || relativePath.startsWith('langs')) {
        continue;
      }
      queue.push(fullPath);
      continue;
    }
    if (!/\.(page|js)$/i.test(entry.name)) {
      continue;
    }
    sourceFiles.push(fullPath);
  }
}

let en;
try {
  en = JSON.parse(fs.readFileSync(enFile, 'utf8'));
} catch (error) {
  console.error(`ERROR: Failed to parse ${enFile}: ${error.message}`);
  process.exit(1);
}

if (!en || typeof en !== 'object' || Array.isArray(en)) {
  console.error('ERROR: en.json must contain a JSON object.');
  process.exit(1);
}

const localeKeys = new Set(Object.keys(en));
const referencedKeys = new Map();

for (const fullPath of sourceFiles.sort()) {
  const relPath = path.relative(pluginDir, fullPath).replace(/\\/g, '/');
  const source = fs.readFileSync(fullPath, 'utf8');

  const dataI18nRegex = /data-i18n\s*=\s*["']([^"']+)["']/g;
  let match;
  while ((match = dataI18nRegex.exec(source)) !== null) {
    for (const key of normalizeKey(match[1])) {
      const line = lineNumberAt(source, match.index);
      if (!referencedKeys.has(key)) referencedKeys.set(key, []);
      referencedKeys.get(key).push(`${relPath}:${line}`);
    }
  }

  const jqueryI18nRegex = /\$\.i18n\(\s*['"]([^'"]+)['"]/g;
  while ((match = jqueryI18nRegex.exec(source)) !== null) {
    const key = match[1].trim();
    if (!key) continue;
    const line = lineNumberAt(source, match.index);
    if (!referencedKeys.has(key)) referencedKeys.set(key, []);
    referencedKeys.get(key).push(`${relPath}:${line}`);
  }
}

const missing = [...referencedKeys.keys()].filter((key) => !localeKeys.has(key)).sort();
if (missing.length > 0) {
  console.error(`ERROR: ${missing.length} i18n key(s) are referenced but missing from en.json.`);
  for (const key of missing.slice(0, 40)) {
    const refs = referencedKeys.get(key) || [];
    console.error(`  - ${key}: ${refs.slice(0, 3).join(', ')}`);
  }
  process.exit(1);
}

const unused = [...localeKeys]
  .filter((key) => key !== '@metadata' && !allowUnusedKeys.has(key) && !referencedKeys.has(key))
  .sort();
if (unused.length > 0) {
  const details = unused.slice(0, 20).join(', ');
  const prefix = strictMode ? 'ERROR' : 'WARN';
  console.log(
    `${prefix}: ${unused.length} locale key(s) in en.json are not referenced by .page/.js files: ${details}`
  );
  if (strictMode) {
    process.exit(1);
  }
}

console.log(`Language usage guard passed: ${sourceFiles.length} files scanned, ${referencedKeys.size} unique keys referenced.`);
NODE
