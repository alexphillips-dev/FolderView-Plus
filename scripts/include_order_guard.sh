#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PAGE_FILE="${ROOT_DIR}/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/FolderViewPlus.page"

# shellcheck source=scripts/lib.sh
source "${ROOT_DIR}/scripts/lib.sh"

fvplus::require_commands node
NODE_BIN="$(fvplus::resolve_platform_command node)"

if [[ ! -f "${PAGE_FILE}" ]]; then
  fvplus::fail "Missing settings page file: ${PAGE_FILE}"
fi

"${NODE_BIN}" - "$(fvplus::path_for_command "${NODE_BIN}" "${PAGE_FILE}")" <<'NODE'
const fs = require('fs');
const path = require('path');

const normalizePageFile = (input) => {
  const raw = String(input || '').trim();
  if (!raw) {
    return raw;
  }
  if (fs.existsSync(raw)) {
    return raw;
  }
  const malformedWindowsMntMatch = raw.match(/^[A-Za-z]:\\mnt\\([A-Za-z])\\(.+)$/);
  if (malformedWindowsMntMatch) {
    const candidate = `${malformedWindowsMntMatch[1].toUpperCase()}:\\${malformedWindowsMntMatch[2]}`;
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  if (/^\/mnt\/[A-Za-z]\//.test(raw)) {
    const candidate = raw.replace(/^\/mnt\/([A-Za-z])\//, (_, drive) => `${drive.toUpperCase()}:\\`).replace(/\//g, '\\');
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return path.resolve(raw);
};

const pageFile = normalizePageFile(process.argv[2]);
const source = fs.readFileSync(pageFile, 'utf8');
const includes = [...source.matchAll(/folderviewplus(?:\.[a-z-]+)*\.js/g)].map((match) => match[0]);

const expectedOrder = [
  'folderviewplus.fatal-banner.js',
  'folderviewplus.utils.js',
  'folderviewplus.request.js',
  'folderviewplus.theme-resolver.js',
  'folderviewplus.theme-workspace.js',
  'folderviewplus.chrome.js',
  'folderviewplus.dirty.js',
  'folderviewplus.runtime-parity.js',
  'folderviewplus.settings-metadata.js',
  'folderviewplus.settings-sections.js',
  'folderviewplus.settings-table.js',
  'folderviewplus.setup-assistant.js',
  'folderviewplus.smart-detect-config.js',
  'folderviewplus.starter-templates.js',
  'folderviewplus.support-bundle-preview.js',
  'folderviewplus.support-bundle-browser.js',
  'folderviewplus.support-bundle-telemetry.js',
  'folderviewplus.activity-diagnostics.js',
  'folderviewplus.settings-tree.js',
  'folderviewplus.folder-editor.js',
  'folderviewplus.row-details.js',
  'folderviewplus.settings-health.js',
  'folderviewplus.settings-workspaces.js',
  'folderviewplus.bulk-assignment.shared.js',
  'folderviewplus.bulk-assignment.js',
  'folderviewplus.runtime-actions.js',
  'folderviewplus.native-organizer.js',
  'folderviewplus.wizard-smart-detect.js',
  'folderviewplus.wizard.js',
  'folderviewplus.import.js',
  'folderviewplus.updates.js',
  'folderviewplus.actions-support.js',
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
