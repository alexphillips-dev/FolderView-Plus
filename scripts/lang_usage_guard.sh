#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLUGIN_DIR="${ROOT_DIR}/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus"
LANG_DIR="${PLUGIN_DIR}/langs"
STRICT_MODE="${FVPLUS_I18N_STRICT:-0}"
ALLOW_UNUSED_KEYS="${FVPLUS_I18N_ALLOW_UNUSED_KEYS:-}"
SURFACE_TOOLS="${ROOT_DIR}/scripts/lib/i18n_surface_tools.cjs"
# shellcheck source=scripts/lib.sh
source "${ROOT_DIR}/scripts/lib.sh"

fvplus::require_commands node
NODE_BIN="$(fvplus::resolve_platform_command node)"

if [[ ! -f "${LANG_DIR}/en.json" ]]; then
  fvplus::fail "Missing base locale file: ${LANG_DIR}/en.json"
fi

"${NODE_BIN}" - "$(fvplus::path_for_command "${NODE_BIN}" "${PLUGIN_DIR}")" "$(fvplus::path_for_command "${NODE_BIN}" "${LANG_DIR}")" "${STRICT_MODE}" "${ALLOW_UNUSED_KEYS}" "$(fvplus::path_for_command "${NODE_BIN}" "${SURFACE_TOOLS}")" <<'NODE'
const fs = require('fs');
const path = require('path');

const pluginDir = process.argv[2];
const langDir = process.argv[3];
const strictMode = /^(1|true|yes|on)$/i.test(String(process.argv[4] || '').trim());
const surfaceTools = require(process.argv[6]);
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

  const applicationWrapperRegex = /\b(?:setupAssistantT|importT|folderEditorT|dashboardT|dockerT|diagnosticsT|translate)\(\s*['"]([^'"]+)['"]/g;
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
  .filter((key) => key !== '@metadata' && !key.startsWith(surfaceTools.AUTO_KEY_PREFIX) && !allowUnusedKeys.has(key) && !referencedKeys.has(key))
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

const surface = surfaceTools.collectSurfaceCandidates(pluginDir);
const generatedSurfaceMessages = new Map(
  Object.entries(en).filter(([key]) => key.startsWith(surfaceTools.AUTO_KEY_PREFIX)).map(([key, value]) => [String(value), key])
);
const uncoveredSurface = [...surface.byPhrase.keys()].filter((phrase) => !generatedSurfaceMessages.has(phrase));
const staleSurface = [...generatedSurfaceMessages.keys()].filter((phrase) => !surface.byPhrase.has(phrase));
if (uncoveredSurface.length > 0 || staleSurface.length > 0) {
  console.error(`ERROR: Generated localization surface is out of date (${uncoveredSurface.length} uncovered, ${staleSurface.length} stale).`);
  uncoveredSurface.slice(0, 30).forEach((phrase) => console.error(`  - uncovered: ${phrase}`));
  staleSurface.slice(0, 30).forEach((phrase) => console.error(`  - stale: ${phrase}`));
  console.error('Run: node scripts/build_i18n_surface_catalogs.mjs --translate');
  process.exit(1);
}
const extractionReportPath = path.join(langDir, 'extraction-report.json');
let extractionReport;
try {
  extractionReport = JSON.parse(fs.readFileSync(extractionReportPath, 'utf8'));
} catch (error) {
  console.error(`ERROR: Missing or invalid localization extraction report ${extractionReportPath}: ${error.message}`);
  process.exit(1);
}
const englishRoot = JSON.parse(fs.readFileSync(path.join(langDir, 'en.json'), 'utf8'));
const catalogVersion = String(englishRoot?.['@metadata']?.['catalog-version'] || '');
if (String(extractionReport?.['catalog-version'] || '') !== catalogVersion) {
  console.error(`ERROR: Localization extraction report catalog version does not match ${catalogVersion}.`);
  process.exit(1);
}
if (Number(extractionReport?.['candidate-count']) !== 0) {
  console.error(`ERROR: Localization extraction report must report zero uncovered candidates.`);
  process.exit(1);
}
if (Number(extractionReport?.['auto-bound-message-count']) !== surface.byPhrase.size) {
  console.error(`ERROR: Localization extraction report has ${Number(extractionReport?.['auto-bound-message-count']) || 0} auto-bound messages; measured ${surface.byPhrase.size}.`);
  process.exit(1);
}
if (Number(extractionReport?.['catalog-message-count']) !== localeKeys.size) {
  console.error(`ERROR: Localization extraction report has ${Number(extractionReport?.['catalog-message-count']) || 0} catalog messages; measured ${localeKeys.size}.`);
  process.exit(1);
}

console.log(`Language usage guard passed: ${sourceFiles.length} files scanned, ${catalogFiles.length} English catalog file(s), ${referencedKeys.size} explicit keys referenced, ${surface.byPhrase.size} legacy surface messages auto-bound, zero uncovered UI strings.`);
NODE
