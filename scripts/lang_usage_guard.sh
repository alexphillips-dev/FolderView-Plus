#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLUGIN_DIR="${ROOT_DIR}/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus"
LANG_DIR="${PLUGIN_DIR}/langs"
STRICT_MODE="${FVPLUS_I18N_STRICT:-0}"
ALLOW_UNUSED_KEYS="${FVPLUS_I18N_ALLOW_UNUSED_KEYS:-}"
HARDCODED_BASELINE="${ROOT_DIR}/scripts/i18n_hardcoded_baseline.json"
# shellcheck source=scripts/lib.sh
source "${ROOT_DIR}/scripts/lib.sh"

fvplus::require_commands node
NODE_BIN="$(fvplus::resolve_platform_command node)"

if [[ ! -f "${LANG_DIR}/en.json" ]]; then
  fvplus::fail "Missing base locale file: ${LANG_DIR}/en.json"
fi

"${NODE_BIN}" - "$(fvplus::path_for_command "${NODE_BIN}" "${PLUGIN_DIR}")" "$(fvplus::path_for_command "${NODE_BIN}" "${LANG_DIR}")" "${STRICT_MODE}" "${ALLOW_UNUSED_KEYS}" "$(fvplus::path_for_command "${NODE_BIN}" "${HARDCODED_BASELINE}")" <<'NODE'
const fs = require('fs');
const path = require('path');

const pluginDir = process.argv[2];
const langDir = process.argv[3];
const strictMode = /^(1|true|yes|on)$/i.test(String(process.argv[4] || '').trim());
const hardcodedBaselineFile = process.argv[6];
const allowUnusedKeys = new Set(
  String(process.argv[5] || '')
    .split(/[,\n;]+/)
    .map((raw) => raw.trim())
    .filter(Boolean)
);
[
  'custom-action',
  'custom-actions-type-0',
  'custom-actions-type-1',
  'folderviewplus-desc',
  'member-preview-visible',
  'updating'
].forEach((key) => allowUnusedKeys.add(key));

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
    const isRuntimeSource = /\.(page|js)$/i.test(entry.name);
    const isPluginReadme = relativePath === 'README.md';
    if (!isRuntimeSource && !isPluginReadme) {
      continue;
    }
    sourceFiles.push(fullPath);
  }
}

const catalogFiles = [path.join(langDir, 'en.json')];
const englishNamespaces = path.join(langDir, 'namespaces', 'en');
if (fs.existsSync(englishNamespaces)) {
  catalogFiles.push(...fs.readdirSync(englishNamespaces)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => path.join(englishNamespaces, name)));
}
const en = {};
for (const catalogFile of catalogFiles) {
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(catalogFile, 'utf8'));
  } catch (error) {
    console.error(`ERROR: Failed to parse ${catalogFile}: ${error.message}`);
    process.exit(1);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    console.error(`ERROR: ${catalogFile} must contain a JSON object.`);
    process.exit(1);
  }
  for (const [key, value] of Object.entries(parsed)) {
    if (key === '@metadata') continue;
    if (Object.prototype.hasOwnProperty.call(en, key)) {
      console.error(`ERROR: Duplicate English locale key "${key}" in ${catalogFile}.`);
      process.exit(1);
    }
    en[key] = value;
  }
}

const localeKeys = new Set(Object.keys(en));
const referencedKeys = new Map();
const hardcodedCounts = {};

for (const fullPath of sourceFiles.sort()) {
  const relPath = path.relative(pluginDir, fullPath).replace(/\\/g, '/');
  const source = fs.readFileSync(fullPath, 'utf8');
  let hardcodedCount = 0;
  const attributeRegex = /\b(?:placeholder|aria-label|title)\s*=\s*["']([A-Za-z][^"'<>]*[A-Za-z])["']/g;
  let attributeMatch;
  while ((attributeMatch = attributeRegex.exec(source)) !== null) {
    const tagStart = source.lastIndexOf('<', attributeMatch.index);
    const tagEnd = source.indexOf('>', attributeMatch.index);
    const tagSource = tagStart >= 0 && tagEnd >= 0 ? source.slice(tagStart, tagEnd + 1) : '';
    if (/\bdata-i18n\s*=/.test(tagSource) || /\bdata-i18n-ignore\b/.test(tagSource)) continue;
    hardcodedCount += 1;
  }
  const textNodeRegex = />([^<>{}`$]*[A-Za-z][^<>{}`$]*)</g;
  let textMatch;
  while ((textMatch = textNodeRegex.exec(source)) !== null) {
    const text = String(textMatch[1] || '').replace(/\s+/g, ' ').trim();
    if (!text || text.length < 2 || /^(?:https?:|\/|[A-Z0-9_.-]+)$/.test(text)) continue;
    const tagStart = source.lastIndexOf('<', textMatch.index);
    const tagSource = tagStart >= 0 ? source.slice(tagStart, textMatch.index + 1) : '';
    if (/\bdata-i18n\s*=/.test(tagSource) || /\bdata-i18n-ignore\b/.test(tagSource)) continue;
    hardcodedCount += 1;
  }
  if (hardcodedCount > 0) hardcodedCounts[relPath] = hardcodedCount;

  const dataI18nRegex = /data-i18n\s*=\s*["']([^"']+)["']/g;
  let match;
  while ((match = dataI18nRegex.exec(source)) !== null) {
    for (const key of normalizeKey(match[1])) {
      const line = lineNumberAt(source, match.index);
      if (!referencedKeys.has(key)) referencedKeys.set(key, []);
      referencedKeys.get(key).push(`${relPath}:${line}`);
    }
  }

  const i18nCallRegexes = [
    /\$\.i18n\(\s*['"]([^'"]+)['"]/g,
    /\bjq\.i18n\(\s*['"]([^'"]+)['"]/g
  ];
  for (const i18nCallRegex of i18nCallRegexes) {
    while ((match = i18nCallRegex.exec(source)) !== null) {
      const key = match[1].trim();
      if (!key) continue;
      const line = lineNumberAt(source, match.index);
      if (!referencedKeys.has(key)) referencedKeys.set(key, []);
      referencedKeys.get(key).push(`${relPath}:${line}`);
    }
  }

  const i18nWrapperRegex = /\b(?:i18nLabel|i18nText)\(\s*['"]([^'"]+)['"]/g;
  while ((match = i18nWrapperRegex.exec(source)) !== null) {
    const key = match[1].trim();
    if (!key) continue;
    const line = lineNumberAt(source, match.index);
    if (!referencedKeys.has(key)) referencedKeys.set(key, []);
    referencedKeys.get(key).push(`${relPath}:${line}`);
  }

  const applicationWrapperRegex = /\b(?:setupAssistantT|importT|folderEditorT|dashboardT|dockerT|translate)\(\s*['"]([^'"]+)['"]/g;
  while ((match = applicationWrapperRegex.exec(source)) !== null) {
    const key = match[1].trim();
    if (!key) continue;
    const line = lineNumberAt(source, match.index);
    if (!referencedKeys.has(key)) referencedKeys.set(key, []);
    referencedKeys.get(key).push(`${relPath}:${line}`);
  }

  const declaredApplicationKeyRegex = /\bi18nKey\s*:\s*['"]([^'"]+)['"]/g;
  while ((match = declaredApplicationKeyRegex.exec(source)) !== null) {
    const key = match[1].trim();
    if (!key) continue;
    const line = lineNumberAt(source, match.index);
    if (!referencedKeys.has(key)) referencedKeys.set(key, []);
    referencedKeys.get(key).push(`${relPath}:${line}`);
  }

  const directApplicationRegex = /FolderViewPlusI18n(?:\?\.|\.)t(?:\?\.)?\(\s*['"]([^'"]+)['"]/g;
  while ((match = directApplicationRegex.exec(source)) !== null) {
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

let hardcodedBaseline = null;
try {
  hardcodedBaseline = JSON.parse(fs.readFileSync(hardcodedBaselineFile, 'utf8'));
} catch (error) {
  console.error(`ERROR: Missing or invalid hard-coded UI baseline ${hardcodedBaselineFile}: ${error.message}`);
  console.error(JSON.stringify(hardcodedCounts, null, 2));
  process.exit(1);
}
const baselineCounts = hardcodedBaseline?.files && typeof hardcodedBaseline.files === 'object'
  ? hardcodedBaseline.files
  : {};
const hardcodedRegressions = Object.entries(hardcodedCounts)
  .filter(([file, count]) => count > Number(baselineCounts[file] || 0));
if (hardcodedRegressions.length > 0) {
  console.error(`ERROR: ${hardcodedRegressions.length} file(s) introduced additional hard-coded user-facing strings.`);
  for (const [file, count] of hardcodedRegressions.slice(0, 30)) {
    console.error(`  - ${file}: ${count} candidate(s), baseline ${Number(baselineCounts[file] || 0)}`);
  }
  process.exit(1);
}
const hardcodedTotal = Object.values(hardcodedCounts).reduce((sum, count) => sum + Number(count || 0), 0);

console.log(`Language usage guard passed: ${sourceFiles.length} files scanned, ${catalogFiles.length} English catalog file(s), ${referencedKeys.size} unique keys referenced, ${hardcodedTotal} baselined hard-coded candidate(s).`);
NODE
