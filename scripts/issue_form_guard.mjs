#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const failures = [];

const fail = (message) => failures.push(message);
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
const formPaths = Object.freeze([
    '.github/ISSUE_TEMPLATE/bug_report.yml',
    '.github/ISSUE_TEMPLATE/feature_request.yml',
    '.github/ISSUE_TEMPLATE/support_troubleshooting.yml',
    '.github/ISSUE_TEMPLATE/translation.yml'
]);

const findBodyBlock = (source, id) => {
    const lines = source.split(/\r?\n/);
    const idIndex = lines.findIndex((line) => line === `    id: ${id}`);
    if (idIndex < 0) return '';
    let start = idIndex;
    while (start >= 0 && !lines[start].startsWith('  - type:')) start -= 1;
    let end = idIndex + 1;
    while (end < lines.length && !lines[end].startsWith('  - type:')) end += 1;
    return lines.slice(Math.max(0, start), end).join('\n');
};

const extractOptions = (source, id) => {
    const block = findBodyBlock(source, id);
    if (!block) return [];
    const lines = block.split(/\r?\n/);
    const optionsIndex = lines.findIndex((line) => line === '      options:');
    if (optionsIndex < 0) return [];
    return lines.slice(optionsIndex + 1)
        .filter((line) => line.startsWith('        - '))
        .map((line) => line.slice('        - '.length).trim());
};

const requireText = (source, text, label) => {
    if (!source.includes(text)) fail(`${label} is missing required text: ${text}`);
};

const requireIds = (source, relativePath, ids) => {
    for (const id of ids) {
        const block = findBodyBlock(source, id);
        if (!block) {
            fail(`${relativePath} is missing required field id: ${id}`);
            continue;
        }
        if (id !== 'relevant_settings' && !/\n    validations:\n      required: true(?:\n|$)/.test(block)) {
            fail(`${relativePath} field ${id} must be required.`);
        }
    }
};

const requireOptions = (source, relativePath, id, expectedOptions) => {
    const options = extractOptions(source, id);
    for (const expected of expectedOptions) {
        if (!options.includes(expected)) {
            fail(`${relativePath} field ${id} is missing option: ${expected}`);
        }
    }
};

const requireRequiredCheckbox = (source, relativePath, id) => {
    const block = findBodyBlock(source, id);
    if (!block) {
        fail(`${relativePath} is missing required checkbox field id: ${id}`);
    } else if (!/\n          required: true(?:\n|$)/.test(block)) {
        fail(`${relativePath} checkbox field ${id} must contain a required confirmation.`);
    }
};

for (const relativePath of formPaths) {
    const fullPath = path.join(repoRoot, relativePath);
    if (!fs.existsSync(fullPath)) {
        fail(`Required issue form is missing: ${relativePath}`);
        continue;
    }
    const source = fs.readFileSync(fullPath, 'utf8');
    const ids = [...source.matchAll(/^    id: ([A-Za-z][A-Za-z0-9_-]*)\s*$/gm)].map((match) => match[1]);
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
    if (duplicates.length) {
        fail(`${relativePath} contains duplicate field ids: ${[...new Set(duplicates)].join(', ')}`);
    }
    for (const key of ['name:', 'description:', 'title:', 'labels:', 'body:']) {
        if (!source.includes(key)) fail(`${relativePath} is missing top-level key: ${key}`);
    }
}

const bugPath = '.github/ISSUE_TEMPLATE/bug_report.yml';
const bug = read(bugPath);
requireIds(bug, bugPath, [
    'unraid_version', 'plugin_version', 'release_channel', 'browser_device', 'install_method',
    'access_method', 'docker_view_mode', 'theme_context', 'conflict_plugins', 'configuration_origin',
    'affected_area', 'reproducibility', 'steps_to_reproduce', 'expected_behavior', 'actual_behavior',
    'relevant_settings', 'support_bundle_status'
]);
requireOptions(bug, bugPath, 'affected_area', [
    'Docker container actions / context menus',
    'Docker API / provider compatibility',
    'Unraid native Docker / prerelease compatibility',
    'Reverse proxy / request guard',
    'Diagnostics / support bundles',
    'Docker Start Order',
    'Privacy / security behavior'
]);
requireOptions(bug, bugPath, 'release_channel', ['Stable / main', 'Dev testing build', 'Commit-specific build']);
requireOptions(bug, bugPath, 'access_method', ['Direct LAN IP', 'Reverse proxy or custom domain', 'Unraid Connect']);
requireOptions(bug, bugPath, 'docker_view_mode', ['Basic View', 'Advanced View', 'Tested in both', 'Not applicable']);
requireOptions(bug, bugPath, 'configuration_origin', ['Fresh FolderView Plus configuration', 'Imported from FolderView3', 'Imported from FolderView2', 'Restored from a backup or export']);
requireOptions(bug, bugPath, 'support_bundle_status', ['Attached below', 'Unable to export because Settings or Diagnostics will not load', 'Unable to export because installation failed', 'Need instructions']);
requireRequiredCheckbox(bug, bugPath, 'privacy_confirmation');
for (const text of [
    'latest stable release',
    'Advanced View',
    'Reverse proxy or custom domain',
    'Imported from FolderView3',
    'Sanitized support bundle status',
    'full/unsanitized bundle',
    'raw configuration export'
]) requireText(bug, text, bugPath);
if (bug.includes('main or latest commit URL')) {
    fail(`${bugPath} must not use the ambiguous latest-commit pre-check wording.`);
}

const supportPath = '.github/ISSUE_TEMPLATE/support_troubleshooting.yml';
const support = read(supportPath);
requireIds(support, supportPath, [
    'help_topic', 'unraid_version', 'plugin_version', 'release_channel', 'install_source',
    'browser_device', 'access_method', 'docker_view_mode', 'theme_context', 'conflict_plugins',
    'configuration_origin', 'current_behavior', 'expected_behavior', 'troubleshooting_tried',
    'relevant_settings', 'support_bundle_status'
]);
requireOptions(support, supportPath, 'help_topic', [
    'Docker or VM actions / context menus',
    'Reverse proxy or custom hostname',
    'Diagnostics or support-bundle export',
    'Docker Start Order',
    'Unraid compatibility',
    'Performance or refresh behavior',
    'Privacy or security behavior'
]);
requireOptions(support, supportPath, 'release_channel', ['Stable / main', 'Dev testing build', 'Commit-specific build']);
requireOptions(support, supportPath, 'access_method', ['Direct LAN IP', 'Reverse proxy or custom domain', 'Unraid Connect']);
requireOptions(support, supportPath, 'docker_view_mode', ['Basic View', 'Advanced View', 'Tested in both', 'Not applicable']);
requireOptions(support, supportPath, 'configuration_origin', ['Fresh FolderView Plus configuration', 'Imported from FolderView3', 'Imported from FolderView2', 'Restored from a backup or export']);
requireOptions(support, supportPath, 'support_bundle_status', ['Attached below', 'Unable to export because Settings or Diagnostics will not load', 'Unable to export because installation failed', 'Need instructions']);
requireRequiredCheckbox(support, supportPath, 'checklist');
for (const text of [
    'Advanced View',
    'Reverse proxy or custom domain',
    'Imported from FolderView3',
    'Sanitized support bundle status',
    'full/unsanitized bundle',
    'raw configuration export',
    'I reviewed the Wiki and troubleshooting guidance'
]) requireText(support, text, supportPath);

const featurePath = '.github/ISSUE_TEMPLATE/feature_request.yml';
const feature = read(featurePath);
requireOptions(feature, featurePath, 'area', [
    'Docker container actions / context menus',
    'Docker API / provider compatibility',
    'Unraid native Docker / prerelease compatibility',
    'Docker Start Order',
    'Diagnostics / support bundles',
    'Reverse proxy / access paths',
    'Privacy / security behavior'
]);

const translationPath = '.github/ISSUE_TEMPLATE/translation.yml';
const translation = read(translationPath);
const localeDirectory = path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/langs');
const expectedLocales = fs.readdirSync(localeDirectory)
    .filter((name) => name.endsWith('.json'))
    .map((name) => path.basename(name, '.json'))
    .filter((locale) => !['en', 'extraction-report'].includes(locale))
    .sort();
const languageOptions = extractOptions(translation, 'language');
const optionLocales = languageOptions
    .map((option) => option.match(/\(([A-Za-z]{2,3}(?:-[A-Za-z0-9]+)*)\)$/)?.[1] || '')
    .filter(Boolean)
    .sort();
const missingLocales = expectedLocales.filter((locale) => !optionLocales.includes(locale));
const extraLocales = optionLocales.filter((locale) => !expectedLocales.includes(locale));
const duplicateLocales = optionLocales.filter((locale, index) => optionLocales.indexOf(locale) !== index);
if (missingLocales.length) fail(`${translationPath} is missing shipped locale options: ${missingLocales.join(', ')}`);
if (extraLocales.length) fail(`${translationPath} contains locale options without shipped catalogs: ${extraLocales.join(', ')}`);
if (duplicateLocales.length) fail(`${translationPath} contains duplicate locale options: ${[...new Set(duplicateLocales)].join(', ')}`);
if (!languageOptions.includes('Another locale or regional variant')) {
    fail(`${translationPath} must preserve the new-locale contribution option.`);
}
requireText(translation, 'Translation-and-Accessibility', translationPath);

const configPath = '.github/ISSUE_TEMPLATE/config.yml';
const config = read(configPath);
for (const text of [
    'blank_issues_enabled: false',
    'https://github.com/alexphillips-dev/FolderView-Plus/wiki',
    'https://github.com/alexphillips-dev/FolderView-Plus/wiki/Troubleshooting',
    'https://github.com/alexphillips-dev/FolderView-Plus/wiki/Activity-Diagnostics-and-Support',
    'https://github.com/alexphillips-dev/FolderView-Plus/security/policy'
]) requireText(config, text, configPath);

const supportGuidePath = '.github/SUPPORT.md';
const supportGuide = read(supportGuidePath);
for (const text of [
    'installed release channel',
    'access path',
    'Docker Basic/Advanced View status',
    'configuration origin',
    'relevant FolderView Plus settings',
    'sanitized support-bundle status',
    'raw configuration export publicly'
]) requireText(supportGuide, text, supportGuidePath);

if (failures.length) {
    for (const message of failures) console.error(`ERROR: ${message}`);
    process.exit(1);
}

console.log(`Issue form guard passed: ${formPaths.length} forms, ${expectedLocales.length} translated locales, and diagnostic/privacy contracts are synchronized.`);
