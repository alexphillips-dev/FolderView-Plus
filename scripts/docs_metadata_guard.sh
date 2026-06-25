#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib.sh
source "${ROOT_DIR}/scripts/lib.sh"
cd "${ROOT_DIR}"

fvplus::require_commands bash node
NODE_BIN="$(fvplus::resolve_platform_command node)"

"${NODE_BIN}" - "$(fvplus::path_for_command "${NODE_BIN}" "${ROOT_DIR}")" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const root = process.argv[2];
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const fail = (message) => {
  console.error(`ERROR: ${message}`);
  process.exit(1);
};

const rootReadme = read('README.md');
const troubleshootingDoc = read('docs/TROUBLESHOOTING.md');
const pluginReadme = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/README.md');
const localeEn = JSON.parse(read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/langs/en.json'));
const xml = read('folderview.plus.xml');

const descMatch = pluginReadme.match(/<span id="folderviewplus-desc">([^<]+)<\/span>/);
if (!descMatch) {
  fail('Could not find packaged README folderviewplus-desc fallback text.');
}

const packagedDescription = descMatch[1].trim();
const localeDescription = String(localeEn['folderviewplus-desc'] || '').trim();
if (!localeDescription) {
  fail('Missing en.json folderviewplus-desc value.');
}
if (localeDescription !== packagedDescription) {
  fail('Packaged README fallback text must match langs/en.json folderviewplus-desc.');
}

if (pluginReadme.includes('powerful folder-based organization to Unraid Docker and VM tabs')) {
  fail('Packaged README still contains the legacy Docker/VM-only description.');
}

const requiredReadmeSections = [
  '## Settings Overview',
  '## Getting Started',
  '## Backups and Recovery',
  '## Troubleshooting',
  '## Customization'
];
for (const heading of requiredReadmeSections) {
  if (!rootReadme.includes(heading)) {
    fail(`README.md is missing required section: ${heading}`);
  }
}

const requiredReadmePhrases = [
  'Settings changes save automatically',
  'Setup Assistant',
  'Dashboard',
  'Folder editor bootstrap diagnostics',
  'docs/TROUBLESHOOTING.md'
];
for (const phrase of requiredReadmePhrases) {
  if (!rootReadme.includes(phrase)) {
    fail(`README.md is missing required current-state phrase: ${phrase}`);
  }
}

const requiredTroubleshootingSections = [
  '## Common Issues',
  '## Support Bundles',
  '## Paths',
  '## Legacy CSS/JS Overrides'
];
for (const heading of requiredTroubleshootingSections) {
  if (!troubleshootingDoc.includes(heading)) {
    fail(`docs/TROUBLESHOOTING.md is missing required section: ${heading}`);
  }
}

const xmlDescriptionMatch = xml.match(/<Description>\s*([\s\S]*?)\s*<\/Description>/);
if (!xmlDescriptionMatch) {
  fail('Could not parse folderview.plus.xml <Description>.');
}
const xmlDescription = xmlDescriptionMatch[1].replace(/\s+/g, ' ').trim().toLowerCase();
for (const phrase of ['dashboard', 'bulk assignment', 'recovery', 'templates', 'diagnostics']) {
  if (!xmlDescription.includes(phrase)) {
    fail(`folderview.plus.xml description is missing expected phrase: ${phrase}`);
  }
}

console.log('Docs metadata guard passed.');
NODE
