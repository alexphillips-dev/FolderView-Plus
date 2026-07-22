#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pluginRoot = path.join(repoRoot, 'src', 'folderview.plus', 'usr', 'local', 'emhttp', 'plugins', 'folderview.plus');
const schemaRoot = path.join(pluginRoot, 'schemas');
const registry = JSON.parse(fs.readFileSync(path.join(schemaRoot, 'deprecations.schema.json'), 'utf8'));
const settings = JSON.parse(fs.readFileSync(path.join(schemaRoot, 'filter-view-settings.schema.json'), 'utf8'));
const failures = [];
const fail = (message) => failures.push(message);
const entries = Array.isArray(registry.entries) ? registry.entries : [];
const ids = entries.map((entry) => String(entry.id || '').trim());
const escapedPluginRoot = pluginRoot;

if (Number(registry.schemaVersion) < 1) fail('Deprecation registry schemaVersion must be positive.');
if (Number(registry.minimumStableReleasesBeforeRemoval) < 2) fail('Deprecation registry must preserve the two-stable-release support policy.');
if (new Set(ids).size !== ids.length) fail('Deprecation registry contains duplicate ids.');

const resolveSetting = (settingPath) => {
    const [group, key] = String(settingPath || '').split('.');
    return settings.groups?.[group]?.settings?.[key] || null;
};

for (const entry of entries) {
    const id = String(entry.id || '').trim();
    if (!id) {
        fail('Deprecation entry is missing id.');
        continue;
    }
    if (!['compatibility', 'deprecated', 'removed'].includes(entry.status)) fail(`${id} has invalid status ${entry.status}.`);
    if (!entry.kind || !entry.announcedRelease || !entry.note) fail(`${id} is missing kind, announcedRelease, or note.`);
    if (entry.status === 'removed') {
        if (!entry.removedRelease || !Array.isArray(entry.forbiddenPatterns) || entry.forbiddenPatterns.length === 0) {
            fail(`${id} removed entries require removedRelease and forbiddenPatterns.`);
            continue;
        }
        const liveFiles = [];
        const walk = (directory) => fs.readdirSync(directory, { withFileTypes: true }).forEach((item) => {
            const absolute = path.join(directory, item.name);
            if (item.isDirectory()) walk(absolute);
            else if (/\.(?:js|php|page)$/i.test(item.name)) liveFiles.push(absolute);
        });
        walk(escapedPluginRoot);
        for (const pattern of entry.forbiddenPatterns) {
            const expression = new RegExp(pattern);
            for (const file of liveFiles) {
                if (expression.test(fs.readFileSync(file, 'utf8'))) {
                    fail(`${id} removed pattern remains in ${path.relative(pluginRoot, file)}: ${pattern}`);
                }
            }
        }
        continue;
    }
    if (!entry.legacyPattern || !Array.isArray(entry.sourceScopes) || entry.sourceScopes.length === 0) {
        fail(`${id} active entries require legacyPattern and sourceScopes.`);
        continue;
    }
    const expression = new RegExp(entry.legacyPattern);
    for (const relativeFile of entry.sourceScopes) {
        const absolute = path.join(pluginRoot, relativeFile);
        if (!fs.existsSync(absolute)) fail(`${id} source scope does not exist: ${relativeFile}`);
        else if (!expression.test(fs.readFileSync(absolute, 'utf8'))) fail(`${id} compatibility pattern is missing from ${relativeFile}.`);
    }
    if (entry.replacementSetting && !resolveSetting(entry.replacementSetting)) {
        fail(`${id} replacement setting is not registered: ${entry.replacementSetting}`);
    }
}

for (const [group, groupDefinition] of Object.entries(settings.groups || {})) {
    for (const [key, definition] of Object.entries(groupDefinition.settings || {})) {
        if (!definition.deprecationId) continue;
        const entry = entries.find((candidate) => candidate.id === definition.deprecationId);
        if (!entry) fail(`${group}.${key} references unknown deprecation ${definition.deprecationId}.`);
        if (definition.ui !== false) fail(`${group}.${key} is deprecated but remains exposed in the settings UI.`);
    }
}

assert.equal(failures.length, 0, failures.join('\n'));
console.log(`Deprecation guard passed: ${entries.length} compatibility/deprecation records enforced.`);
