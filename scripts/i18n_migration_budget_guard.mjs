#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const englishRoot = path.join(
    repoRoot,
    'src',
    'folderview.plus',
    'usr',
    'local',
    'emhttp',
    'plugins',
    'folderview.plus',
    'langs'
);
const namespaceRoot = path.join(englishRoot, 'namespaces', 'en');
const MAX_LEGACY_SURFACE_KEYS = 1583;
const MIN_EXPLICIT_KEYS = 463;

const readMessages = (file) => Object.keys(JSON.parse(fs.readFileSync(file, 'utf8')))
    .filter((key) => key !== '@metadata');
const rootKeys = readMessages(path.join(englishRoot, 'en.json'));
const namespaceFiles = fs.readdirSync(namespaceRoot)
    .filter((name) => name.endsWith('.json'))
    .sort();
const namespaceKeys = namespaceFiles.flatMap((name) => readMessages(path.join(namespaceRoot, name)));
const allKeys = [...rootKeys, ...namespaceKeys];
const legacyKeys = allKeys.filter((key) => key.startsWith('legacy.surface.'));
const explicitKeys = allKeys.filter((key) => !key.startsWith('legacy.surface.'));

assert.ok(
    legacyKeys.length <= MAX_LEGACY_SURFACE_KEYS,
    `Legacy auto-bound i18n budget regressed: ${legacyKeys.length} > ${MAX_LEGACY_SURFACE_KEYS}. Add an explicit semantic key instead.`
);
assert.ok(
    explicitKeys.length >= MIN_EXPLICIT_KEYS,
    `Explicit semantic i18n coverage regressed: ${explicitKeys.length} < ${MIN_EXPLICIT_KEYS}.`
);
assert.equal(
    new Set(allKeys).size,
    allKeys.length,
    'English i18n keys must be unique across the root catalog and namespaces.'
);
console.log(`i18n migration budget passed: ${explicitKeys.length} explicit keys, ${legacyKeys.length}/${MAX_LEGACY_SURFACE_KEYS} legacy auto-bound keys.`);
