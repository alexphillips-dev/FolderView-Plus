#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pluginRoot = path.join(repoRoot, 'src', 'folderview.plus', 'usr', 'local', 'emhttp', 'plugins', 'folderview.plus');
const scriptsRoot = path.join(pluginRoot, 'scripts');
const schemaPath = path.join(pluginRoot, 'schemas', 'architecture-contracts.schema.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const require = createRequire(import.meta.url);
const failures = [];
const fail = (message) => failures.push(message);

const loadModule = (contract, source, absolutePath) => {
    if (contract.loader === 'commonjs') {
        delete require.cache[require.resolve(absolutePath)];
        return require(absolutePath);
    }
    if (contract.loader === 'window') {
        const window = {
            document: { documentElement: {} },
            setTimeout,
            clearTimeout,
            performance: globalThis.performance
        };
        window.window = window;
        const context = vm.createContext({
            window,
            document: window.document,
            console,
            performance: globalThis.performance,
            setTimeout,
            clearTimeout,
            Element: class Element {},
            Map,
            Set,
            WeakMap,
            Promise,
            Object,
            Array,
            String,
            Number,
            Boolean,
            Date,
            Math,
            JSON
        });
        vm.runInContext(source, context, { filename: contract.file });
        return window[contract.global];
    }
    throw new Error(`Unsupported contract loader: ${contract.loader}`);
};

for (const contract of schema.moduleContracts || []) {
    const absolutePath = path.join(pluginRoot, contract.file);
    if (!fs.existsSync(absolutePath)) {
        fail(`Contract file does not exist: ${contract.file}`);
        continue;
    }
    const source = fs.readFileSync(absolutePath, 'utf8');
    if (!source.includes(contract.global)) fail(`${contract.file} does not publish ${contract.global}.`);
    if (contract.moduleLoaded && !source.includes(contract.moduleLoaded)) fail(`${contract.file} does not publish ${contract.moduleLoaded}.`);
    if (contract.typeChecked === true && !source.startsWith('// @ts-check')) fail(`${contract.file} must enable // @ts-check.`);
    let api;
    try {
        api = loadModule(contract, source, absolutePath);
    } catch (error) {
        fail(`${contract.file} could not be loaded for contract validation: ${error.message}`);
        continue;
    }
    for (const exportName of contract.exports || []) {
        if (!(exportName in (api || {}))) fail(`${contract.file} is missing export ${exportName}.`);
    }
    if (contract.apiFactory) {
        try {
            const nestedApi = api[contract.apiFactory](...(contract.apiFactoryArgs || []));
            for (const exportName of contract.apiExports || []) {
                if (!(exportName in (nestedApi || {}))) fail(`${contract.file} ${contract.apiFactory} API is missing ${exportName}.`);
            }
            nestedApi?.destroy?.();
            nestedApi?.dispose?.();
        } catch (error) {
            fail(`${contract.file} ${contract.apiFactory} API validation failed: ${error.message}`);
        }
    }
    for (const lifecycle of contract.lifecycleFactories || []) {
        try {
            const lifecycleApi = api[lifecycle.name](...(lifecycle.args || []));
            for (const exportName of lifecycle.exports || []) {
                if (typeof lifecycleApi?.[exportName] !== 'function') {
                    fail(`${contract.file} ${lifecycle.name} lifecycle is missing ${exportName}().`);
                }
            }
            lifecycleApi?.destroy?.();
            lifecycleApi?.dispose?.();
        } catch (error) {
            fail(`${contract.file} ${lifecycle.name} lifecycle validation failed: ${error.message}`);
        }
    }
}

const sources = new Map(fs.readdirSync(scriptsRoot)
    .filter((file) => file.endsWith('.js'))
    .map((file) => [file, fs.readFileSync(path.join(scriptsRoot, file), 'utf8')]));
const policy = schema.browserGlobals || {};
const namespacePrefixes = policy.namespacePrefixes || [];
const multiOwnerGlobals = new Set(policy.multiOwnerGlobals || []);
const ambientFallbacks = new Set(policy.ambientFallbacks || []);
const hostCompatibilityGlobals = new Set(policy.hostCompatibilityGlobals || []);
const bridgeFiles = new Set(policy.bridgeFiles || []);
const diagnosticGlobals = new Set(policy.diagnosticGlobals || []);
const runtimeUiGlobals = new Set(policy.runtimeUiGlobals || []);
const removedGlobals = new Set(policy.removedGlobals || []);
const ownersByGlobal = new Map();
const registeredActions = new Set();

for (const [file, source] of sources) {
    const names = new Set();
    for (const match of source.matchAll(/\b(?:root|window|globalThis)\.([A-Za-z_$][\w$]*)\s*=(?!=)/g)) names.add(match[1]);
    for (const match of source.matchAll(/Object\.assign\(window,\s*\{([\s\S]*?)\}\);/g)) {
        for (const entry of match[1].matchAll(/^\s*([A-Za-z_$][\w$]*)\s*(?::|,)/gm)) names.add(entry[1]);
    }
    for (const match of source.matchAll(/registerWindowActions\(window,\s*\{([\s\S]*?)\}\);/g)) {
        for (const entry of match[1].matchAll(/^\s*([A-Za-z_$][\w$]*)\s*(?::|,)/gm)) {
            names.add(entry[1]);
            registeredActions.add(entry[1]);
        }
    }
    for (const name of names) {
        if (!ownersByGlobal.has(name)) ownersByGlobal.set(name, []);
        ownersByGlobal.get(name).push(file);
    }
}

const pageSources = fs.readdirSync(pluginRoot)
    .filter((file) => file.endsWith('.page'))
    .map((file) => fs.readFileSync(path.join(pluginRoot, file), 'utf8'));
const pageActions = new Set(pageSources.flatMap((page) => [
    ...page.matchAll(/on(?:click|input|change|keydown|submit)="([A-Za-z_$][\w$]*)\(/g)
].map((match) => match[1])));

for (const [name, owners] of ownersByGlobal) {
    if (removedGlobals.has(name)) {
        fail(`Removed global was reintroduced: ${name} (${owners.join(', ')})`);
        continue;
    }
    const namespaced = namespacePrefixes.some((prefix) => name.startsWith(prefix));
    const usedByGeneratedMarkup = owners.some((file) => new RegExp(`on(?:click|input|change|keydown|submit)[^\\n]{0,160}\\b${name}\\(`).test(sources.get(file)));
    const explicitlyAllowed = namespaced
        || ambientFallbacks.has(name)
        || hostCompatibilityGlobals.has(name)
        || diagnosticGlobals.has(name)
        || runtimeUiGlobals.has(name)
        || pageActions.has(name)
        || registeredActions.has(name)
        || usedByGeneratedMarkup
        || owners.some((file) => bridgeFiles.has(file));
    if (!explicitlyAllowed) {
        const consumedElsewhere = [...sources].some(([file, source]) => !owners.includes(file) && new RegExp(`\\b${name}\\b`).test(source));
        if (!consumedElsewhere) fail(`Unlisted browser global has no cross-module consumer: ${name} (${owners.join(', ')})`);
    }
    if (owners.length > 1 && namespaced && !multiOwnerGlobals.has(name)) {
        fail(`Namespaced browser global has multiple owners: ${name} (${owners.join(', ')})`);
    }
}

for (const action of pageActions) {
    if (!ownersByGlobal.has(action)) fail(`Inline page action is not registered on window: ${action}`);
}

for (const removed of removedGlobals) {
    for (const [file, source] of sources) {
        if (new RegExp(`\\b${removed}\\b`).test(source)) fail(`Removed global token remains in ${file}: ${removed}`);
    }
}

const budgets = schema.budgets || {};
if (Number.isFinite(Number(budgets.maxBrowserGlobals)) && ownersByGlobal.size > Number(budgets.maxBrowserGlobals)) {
    fail(`Browser global budget exceeded: ${ownersByGlobal.size} > ${budgets.maxBrowserGlobals}.`);
}
if (Number.isFinite(Number(budgets.maxInlineActions)) && pageActions.size > Number(budgets.maxInlineActions)) {
    fail(`Inline action budget exceeded: ${pageActions.size} > ${budgets.maxInlineActions}.`);
}
for (const [relativePath, rawLimit] of Object.entries(budgets.maxFileLines || {})) {
    const absolutePath = path.join(pluginRoot, relativePath);
    if (!fs.existsSync(absolutePath)) {
        fail(`File-line budget target does not exist: ${relativePath}.`);
        continue;
    }
    const lineCount = fs.readFileSync(absolutePath, 'utf8').split(/\r?\n/).length;
    const limit = Number(rawLimit);
    if (!Number.isFinite(limit) || limit < 1) {
        fail(`File-line budget is invalid for ${relativePath}: ${rawLimit}.`);
    } else if (lineCount > limit) {
        fail(`File-line budget exceeded for ${relativePath}: ${lineCount} > ${limit}. Extract new logic into a focused module.`);
    }
}

assert.equal(failures.length, 0, failures.join('\n'));
console.log(`Architecture contract guard passed: ${schema.moduleContracts.length} module contracts, ${ownersByGlobal.size} browser globals, ${pageActions.size} inline actions, and ${Object.keys(budgets.maxFileLines || {}).length} file-line budgets validated.`);
