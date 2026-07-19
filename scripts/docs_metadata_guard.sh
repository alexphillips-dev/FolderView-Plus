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
const currentState = JSON.parse(read('docs/current-state.json'));
const settingsPage = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/FolderViewPlus.page');
const settingsSectionsSource = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.settings-sections.js');
const settingsChromeSource = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.chrome.js');
const settingsRuntimeSource = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.js');
const folderActionSource = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.folder-editor.js');
const settingsCss = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/folderviewplus.css');
const runtimeSharedSource = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.shared.js');

if (currentState.schemaVersion !== 1) {
  fail('docs/current-state.json schemaVersion must be 1.');
}

const documentationContracts = currentState.documentationContracts || {};
const featureNames = currentState.featureNames || {};
const settingsPersistence = currentState.settingsPersistence || {};
const performanceProfiles = Array.isArray(currentState.performanceProfiles) ? currentState.performanceProfiles : [];
const assertStringArray = (value, label) => {
  if (!Array.isArray(value) || value.length === 0 || value.some((entry) => typeof entry !== 'string' || entry.trim() === '')) {
    fail(`docs/current-state.json ${label} must be a non-empty string array.`);
  }
};

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

const requiredReadmeSections = documentationContracts.requiredReadmeSections;
assertStringArray(requiredReadmeSections, 'documentationContracts.requiredReadmeSections');
for (const heading of requiredReadmeSections) {
  if (!rootReadme.includes(heading)) {
    fail(`README.md is missing required section: ${heading}`);
  }
}

const requiredReadmePhrases = documentationContracts.requiredReadmePhrases;
assertStringArray(requiredReadmePhrases, 'documentationContracts.requiredReadmePhrases');
for (const phrase of requiredReadmePhrases) {
  if (!rootReadme.includes(phrase)) {
    fail(`README.md is missing required current-state phrase: ${phrase}`);
  }
}

const readmeStatement = String(settingsPersistence.readmeStatement || '').trim();
if (!readmeStatement || !rootReadme.includes(readmeStatement)) {
  fail('README.md does not describe the current settings persistence behavior from docs/current-state.json.');
}

const removedUiTokens = settingsPersistence.removedUiTokens;
assertStringArray(removedUiTokens, 'settingsPersistence.removedUiTokens');
if (settingsPersistence.visibleSavedIndicator !== false) {
  fail('docs/current-state.json must explicitly record that the visible saved indicator is retired.');
}
const settingsUiSource = `${settingsChromeSource}\n${settingsRuntimeSource}\n${settingsCss}`;
for (const token of removedUiTokens) {
  if (settingsUiSource.includes(token)) {
    fail(`Retired saved-indicator UI token is present in current Settings source: ${token}`);
  }
}

const settingsModes = featureNames.settingsModes;
assertStringArray(settingsModes, 'featureNames.settingsModes');
const runtimeSettingsModes = Array.from(settingsChromeSource.matchAll(/data-mode="[^"]+"[^>]*>([^<]+)<\/button>/g), (match) => match[1].trim());
if (JSON.stringify(runtimeSettingsModes) !== JSON.stringify(settingsModes)) {
  fail('docs/current-state.json Settings mode names do not match the Settings chrome.');
}
for (const mode of settingsModes) {
  if (!rootReadme.includes(mode)) {
    fail(`README.md is missing the current Settings mode name: ${mode}`);
  }
}

const advancedWorkspaces = Array.isArray(featureNames.advancedWorkspaces) ? featureNames.advancedWorkspaces : [];
if (advancedWorkspaces.length === 0) {
  fail('docs/current-state.json must define featureNames.advancedWorkspaces.');
}
const advancedLabelsMatch = settingsSectionsSource.match(/const ADVANCED_GROUP_LABELS\s*=\s*\{([\s\S]*?)\};/);
if (!advancedLabelsMatch) {
  fail('Could not parse the current Advanced workspace label registry.');
}
const runtimeAdvancedWorkspaces = Array.from(advancedLabelsMatch[1].matchAll(/([a-z][a-z0-9_-]*)\s*:\s*'([^']+)'/g))
  .map((match) => ({ id: match[1], label: match[2] }));
if (JSON.stringify(runtimeAdvancedWorkspaces) !== JSON.stringify(advancedWorkspaces)) {
  fail('docs/current-state.json Advanced workspace names do not match the Settings runtime registry.');
}
for (const workspace of advancedWorkspaces) {
  if (!rootReadme.includes(`| ${workspace.label} |`)) {
    fail(`README.md Advanced Tools is missing the current workspace name: ${workspace.label}`);
  }
}

if (performanceProfiles.length === 0) {
  fail('docs/current-state.json must define performanceProfiles.');
}
const expectedPerformanceOptions = performanceProfiles.map((profile) => ({
  id: String(profile.id || ''),
  label: String(profile.uiLabel || '')
}));
if (expectedPerformanceOptions.some((entry) => !entry.id || !entry.label)) {
  fail('Every current performance profile must define id, name, and uiLabel.');
}
const extractSelectOptions = (selectId) => {
  const selectMatch = settingsPage.match(new RegExp(`<select id="${selectId}"[\\s\\S]*?<\\/select>`));
  if (!selectMatch) fail(`Could not find current Settings select #${selectId}.`);
  return Array.from(selectMatch[0].matchAll(/<option value="([^"]+)">([^<]+)<\/option>/g))
    .map((match) => ({ id: match[1], label: match[2].trim() }));
};
for (const type of ['docker', 'vm']) {
  const actual = extractSelectOptions(`${type}-performance-profile`);
  if (JSON.stringify(actual) !== JSON.stringify(expectedPerformanceOptions)) {
    fail(`docs/current-state.json performance profiles do not match #${type}-performance-profile.`);
  }
}
const runtimeModesMatch = runtimeSharedSource.match(/if \(\[([^\]]+)\]\.includes\(raw\)\)/);
if (!runtimeModesMatch) {
  fail('Could not parse runtime performance profile modes.');
}
const runtimeModeIds = Array.from(runtimeModesMatch[1].matchAll(/['"]([^'"]+)['"]/g), (match) => match[1]);
if (JSON.stringify(runtimeModeIds) !== JSON.stringify(expectedPerformanceOptions.map((entry) => entry.id))) {
  fail('docs/current-state.json performance profiles do not match the runtime resolver.');
}
const architectureDocs = documentationContracts.performanceArchitectureDocs;
assertStringArray(architectureDocs, 'documentationContracts.performanceArchitectureDocs');
for (const relativePath of architectureDocs) {
  const architectureDoc = read(relativePath);
  for (const profile of performanceProfiles) {
    const name = String(profile.name || '').trim();
    if (!name || !architectureDoc.includes(`**${name}**`)) {
      fail(`${relativePath} is missing the current ${name || profile.id} performance profile.`);
    }
  }
}

const folderActionSurface = featureNames.folderActionSurface || {};
const folderActionLabel = String(folderActionSurface.label || '').trim();
const folderActionRuntimeToken = String(folderActionSurface.runtimeToken || '').trim();
const edgeCaseDocPath = String(documentationContracts.edgeCaseDoc || '').trim();
if (!folderActionLabel || !folderActionRuntimeToken || !edgeCaseDocPath) {
  fail('docs/current-state.json folder action surface contract is incomplete.');
}
if (!folderActionSource.includes(folderActionRuntimeToken) || !settingsCss.includes(folderActionRuntimeToken)) {
  fail('The current folder action surface metadata does not match its runtime implementation.');
}
const edgeCaseDoc = read(edgeCaseDocPath);
const folderActionMentions = edgeCaseDoc.toLowerCase().split(folderActionLabel.toLowerCase()).length - 1;
if (folderActionMentions < Number(folderActionSurface.edgeCaseMinimumMentions || 1)) {
  fail(`${edgeCaseDocPath} does not consistently use the current ${folderActionLabel} name.`);
}

const retiredTerms = Array.isArray(documentationContracts.retiredTerms) ? documentationContracts.retiredTerms : [];
for (const entry of retiredTerms) {
  const term = String(entry?.term || '').trim();
  const files = Array.isArray(entry?.files) ? entry.files : [];
  if (!term || files.length === 0) {
    fail('docs/current-state.json contains an incomplete retired terminology rule.');
  }
  for (const relativePath of files) {
    if (read(relativePath).toLowerCase().includes(term.toLowerCase())) {
      fail(`${relativePath} still uses retired current-state terminology: ${term}`);
    }
  }
}

const requiredTroubleshootingSections = documentationContracts.requiredTroubleshootingSections;
assertStringArray(requiredTroubleshootingSections, 'documentationContracts.requiredTroubleshootingSections');
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
const xmlFeaturePhrases = documentationContracts.xmlFeaturePhrases;
assertStringArray(xmlFeaturePhrases, 'documentationContracts.xmlFeaturePhrases');
for (const phrase of xmlFeaturePhrases) {
  if (!xmlDescription.includes(phrase)) {
    fail(`folderview.plus.xml description is missing expected phrase: ${phrase}`);
  }
}

console.log('Docs metadata guard passed.');
NODE
