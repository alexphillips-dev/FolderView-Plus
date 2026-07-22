#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pluginRoot = path.join(repoRoot, 'src', 'folderview.plus', 'usr', 'local', 'emhttp', 'plugins', 'folderview.plus');
const schemaPath = path.join(pluginRoot, 'schemas', 'filter-view-settings.schema.json');
const pagePath = path.join(pluginRoot, 'FolderViewPlus.page');
const clientNormalizerPath = path.join(pluginRoot, 'scripts', 'folderviewplus.utils.js');
const serverPrefsPath = path.join(pluginRoot, 'server', 'lib.prefs.php');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const page = fs.readFileSync(pagePath, 'utf8');
const clientNormalizer = fs.readFileSync(clientNormalizerPath, 'utf8');
const serverPrefs = fs.readFileSync(serverPrefsPath, 'utf8');
const allowedTypes = new Set(schema.types || []);
const allowedKinds = new Set(['boolean', 'integer', 'enum']);
const definitions = [];
const failures = [];
const fail = (message) => failures.push(message);

const readPath = (source, pathParts) => pathParts.reduce((value, part) => (
    value && typeof value === 'object' ? value[part] : undefined
), source);

for (const [group, groupDefinition] of Object.entries(schema.groups || {})) {
    const handler = String(groupDefinition.handler || '');
    const consumerFiles = Array.isArray(groupDefinition.consumerFiles) ? groupDefinition.consumerFiles : [];
    if (!/^change[A-Z][A-Za-z]+Pref$/.test(handler)) fail(`${group}.handler is invalid.`);
    if (consumerFiles.length === 0) fail(`${group} has no declared runtime consumers.`);
    for (const relativePath of consumerFiles) {
        if (!fs.existsSync(path.join(pluginRoot, relativePath))) fail(`${group} consumer does not exist: ${relativePath}`);
    }
    for (const [key, setting] of Object.entries(groupDefinition.settings || {})) {
        const definition = {
            ...setting,
            group,
            handler,
            key,
            path: String(groupDefinition.path || ''),
            storageKey: String(setting.storageKey || key),
            consumerFiles
        };
        definitions.push(definition);
        if (!allowedKinds.has(definition.kind)) fail(`${handler}:${key} has unsupported kind ${definition.kind}.`);
        if (!Array.isArray(definition.types) || definition.types.length === 0) fail(`${handler}:${key} has no supported types.`);
        for (const type of definition.types || []) {
            if (!allowedTypes.has(type)) fail(`${handler}:${key} declares unknown type ${type}.`);
        }
        if (definition.kind === 'enum') {
            if (!Array.isArray(definition.values) || !definition.values.includes(definition.default)) {
                fail(`${handler}:${key} enum default is not in its allowed values.`);
            }
        }
        if (definition.kind === 'integer') {
            if (![definition.default, definition.min, definition.max].every(Number.isFinite) || definition.min > definition.max) {
                fail(`${handler}:${key} has an invalid integer range.`);
            }
            if (definition.default < definition.min || definition.default > definition.max) {
                fail(`${handler}:${key} default is outside its integer range.`);
            }
        }
        if (definition.kind === 'boolean' && typeof definition.default !== 'boolean') {
            fail(`${handler}:${key} boolean default must be a boolean.`);
        }
        if (definition.liveApply !== true) fail(`${handler}:${key} must explicitly declare liveApply: true.`);
    }
}

const identities = definitions.map((definition) => `${definition.handler}:${definition.key}`);
if (new Set(identities).size !== identities.length) fail('Filter/View registry contains duplicate handler/key definitions.');

const expectedBindings = new Set(definitions.filter((definition) => definition.ui !== false).flatMap((definition) => (
    definition.types.map((type) => `${definition.handler}:${type}:${definition.key}`)
)));
const actualBindings = new Set();
const bindingPattern = /(change(?:Visibility|Status|Badge|Runtime|Dashboard|Health)Pref)\('(docker|vm)',\s*'([^']+)'/g;
for (const match of page.matchAll(bindingPattern)) actualBindings.add(`${match[1]}:${match[2]}:${match[3]}`);
for (const binding of expectedBindings) if (!actualBindings.has(binding)) fail(`Registered setting has no page control: ${binding}`);
for (const binding of actualBindings) if (!expectedBindings.has(binding)) fail(`Page control is absent from the registry: ${binding}`);

const libPath = path.join(pluginRoot, 'server', 'lib.php').replace(/\\/g, '/').replace(/'/g, "\\'");
const phpResult = spawnSync('php', ['-r', `require '${libPath}'; echo json_encode(defaultTypePrefs());`], {
    cwd: repoRoot,
    encoding: 'utf8'
});
if (phpResult.status !== 0) {
    fail(`Unable to read PHP preference defaults: ${phpResult.stderr || phpResult.stdout}`);
} else {
    const defaults = JSON.parse(phpResult.stdout);
    for (const definition of definitions) {
        const storagePath = [...(definition.path ? definition.path.split('.') : []), definition.storageKey];
        const actualDefault = readPath(defaults, storagePath);
        if (actualDefault !== definition.default) {
            fail(`${definition.handler}:${definition.key} default mismatch: schema=${JSON.stringify(definition.default)} php=${JSON.stringify(actualDefault)}`);
        }
        if (!clientNormalizer.includes(definition.storageKey)) {
            fail(`${definition.handler}:${definition.key} is absent from the client preference normalizer.`);
        }
        if (!serverPrefs.includes(`'${definition.storageKey}'`)) {
            fail(`${definition.handler}:${definition.key} is absent from PHP preference normalization.`);
        }
        const hasConsumer = definition.consumerFiles.some((relativePath) => (
            fs.readFileSync(path.join(pluginRoot, relativePath), 'utf8').includes(definition.storageKey)
        ));
        if (!hasConsumer) fail(`${definition.handler}:${definition.key} has no declared runtime consumer reference.`);
    }
}

assert.equal(failures.length, 0, failures.join('\n'));
console.log(`Filter/View settings guard passed: ${definitions.length} settings and ${expectedBindings.size} typed controls are fully registered.`);
