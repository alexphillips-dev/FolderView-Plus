#!/usr/bin/env node
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
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
const allowedStateModels = new Set(['pure', 'factory-owned', 'singleton', 'entrypoint-owned', 'request-scoped']);
const consumerScopes = new Set(schema.consumerScopes || []);

if (schema.schemaVersion !== 2) fail(`Unsupported architecture schema version: ${schema.schemaVersion}.`);

const validateBoundaryMetadata = (contract, label, { requireOwner = false } = {}) => {
    if (requireOwner && !String(contract.owner || '').trim()) fail(`${label} is missing an owner.`);
    if (!allowedStateModels.has(contract.stateModel)) fail(`${label} has invalid stateModel: ${contract.stateModel || '(empty)'}.`);
    if (!Array.isArray(contract.consumers) || contract.consumers.length === 0) fail(`${label} must declare at least one consumer.`);
    for (const consumer of contract.consumers || []) {
        if (!consumerScopes.has(consumer)) fail(`${label} declares unknown consumer scope: ${consumer}.`);
    }
    if (!Array.isArray(contract.dependsOn)) fail(`${label} must declare dependsOn as an array.`);
    for (const dependency of contract.dependsOn || []) {
        if (!fs.existsSync(path.join(pluginRoot, dependency))) fail(`${label} dependency does not exist: ${dependency}.`);
    }
    if (!Array.isArray(contract.compatibilityGlobals)) fail(`${label} must declare compatibilityGlobals as an array.`);
};

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
    validateBoundaryMetadata(contract, contract.file, { requireOwner: true });
    if (!fs.existsSync(absolutePath)) {
        fail(`Contract file does not exist: ${contract.file}`);
        continue;
    }
    const source = fs.readFileSync(absolutePath, 'utf8');
    for (const globalName of contract.compatibilityGlobals || []) {
        if (!source.includes(globalName)) fail(`${contract.file} does not contain declared compatibility global ${globalName}.`);
    }
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

const entrypointFiles = new Set();
for (const contract of schema.entrypointContracts || []) {
    const file = String(contract?.file || '').trim();
    if (!file) {
        fail('Entrypoint contract is missing a file.');
        continue;
    }
    if (entrypointFiles.has(file)) fail(`Duplicate entrypoint contract: ${file}.`);
    entrypointFiles.add(file);
    validateBoundaryMetadata(contract, file);
    const absolutePath = path.join(pluginRoot, file);
    if (!fs.existsSync(absolutePath)) {
        fail(`Entrypoint contract file does not exist: ${file}.`);
        continue;
    }
    if (!String(contract.surface || '').trim()) fail(`${file} is missing a surface.`);
    if (!['browser-entrypoint', 'server-facade', 'server-endpoint'].includes(contract.kind)) {
        fail(`${file} has invalid entrypoint kind: ${contract.kind || '(empty)'}.`);
    }
    if (!contract.lifecycle || !String(contract.lifecycle.startup || '').trim() || !String(contract.lifecycle.teardown || '').trim()) {
        fail(`${file} must declare lifecycle startup and teardown ownership.`);
    }
    const source = fs.readFileSync(absolutePath, 'utf8');
    for (const globalName of contract.compatibilityGlobals || []) {
        if (!source.includes(globalName)) fail(`${file} does not contain declared compatibility global ${globalName}.`);
    }
}

for (const contract of schema.serverModuleContracts || []) {
    const file = String(contract?.file || '').trim();
    validateBoundaryMetadata(contract, file || 'server module', { requireOwner: true });
    if (!file.startsWith('server/') || !file.endsWith('.php')) fail(`Server module contract must target server/*.php: ${file || '(empty)'}.`);
    if (!fs.existsSync(path.join(pluginRoot, file))) fail(`Server module contract file does not exist: ${file}.`);
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
const inlineActionOccurrences = pageSources.reduce((total, page) => (
    total + [...page.matchAll(/on(?:click|input|change|keydown|submit)="([A-Za-z_$][\w$]*)\(/g)].length
), 0);

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
if (Number.isFinite(Number(budgets.maxInlineActionOccurrences)) && inlineActionOccurrences > Number(budgets.maxInlineActionOccurrences)) {
    fail(`Inline action occurrence budget exceeded: ${inlineActionOccurrences} > ${budgets.maxInlineActionOccurrences}.`);
}
const fileLineBudgets = budgets.fileLineBudgets || {};
for (const [relativePath, budget] of Object.entries(fileLineBudgets)) {
    const absolutePath = path.join(pluginRoot, relativePath);
    if (!fs.existsSync(absolutePath)) {
        fail(`File-line budget target does not exist: ${relativePath}.`);
        continue;
    }
    const lineCount = fs.readFileSync(absolutePath, 'utf8').split(/\r?\n/).length;
    const limit = Number(budget?.limit);
    const target = Number(budget?.target);
    const history = Array.isArray(budget?.history) ? budget.history.map(Number) : [];
    if (!Number.isFinite(limit) || limit < 1) {
        fail(`File-line budget is invalid for ${relativePath}: ${budget?.limit}.`);
    } else if (lineCount > limit) {
        fail(`File-line budget exceeded for ${relativePath}: ${lineCount} > ${limit}. Extract new logic into a focused module.`);
    }
    if (!Number.isFinite(target) || target < 1 || target > limit) {
        fail(`File-line target is invalid for ${relativePath}: target ${budget?.target}, limit ${budget?.limit}.`);
    }
    if (history.length === 0 || history.some((value) => !Number.isFinite(value) || value < 1)) {
        fail(`File-line budget history is invalid for ${relativePath}.`);
    } else {
        for (let index = 1; index < history.length; index += 1) {
            if (history[index] > history[index - 1]) {
                fail(`File-line budget history increased for ${relativePath}: ${history[index - 1]} -> ${history[index]}.`);
            }
        }
        if (history.at(-1) !== limit) fail(`File-line budget limit for ${relativePath} must equal the latest history value (${history.at(-1)}).`);
    }
}

const functionNamesByFile = new Map();
const collectFunctionNames = (relativePath) => {
    if (functionNamesByFile.has(relativePath)) return functionNamesByFile.get(relativePath);
    const absolutePath = path.join(pluginRoot, relativePath);
    if (!fs.existsSync(absolutePath)) {
        fail(`Function-overlap target does not exist: ${relativePath}.`);
        return new Set();
    }
    const source = fs.readFileSync(absolutePath, 'utf8');
    const names = new Set();
    for (const match of source.matchAll(/^\s*(?:(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=.*=>|(?:async\s+)?function\s+([A-Za-z_$][\w$]*))/gm)) {
        names.add(match[1] || match[2]);
    }
    functionNamesByFile.set(relativePath, names);
    return names;
};
const overlapSummary = [];
for (const overlapBudget of budgets.functionNameOverlap || []) {
    const files = Array.isArray(overlapBudget.files) ? overlapBudget.files.map(String) : [];
    if (files.length !== 2) {
        fail(`Function-overlap budget must declare exactly two files: ${files.join(', ') || '(none)'}.`);
        continue;
    }
    const [left, right] = files.map(collectFunctionNames);
    const overlap = [...left].filter((name) => right.has(name)).sort();
    const limit = Number(overlapBudget.limit);
    if (!Number.isFinite(limit) || limit < 0) fail(`Function-overlap limit is invalid for ${files.join(' / ')}.`);
    if (overlap.length > limit) fail(`Function-name overlap budget exceeded for ${files.join(' / ')}: ${overlap.length} > ${limit}.`);
    overlapSummary.push(`${path.basename(files[0])}/${path.basename(files[1])}=${overlap.length}`);
}

const inventoryHash = (files) => crypto.createHash('sha256').update(files.join('\n')).digest('hex');
const moduleContractFiles = new Set((schema.moduleContracts || []).map((contract) => contract.file));
const serverModuleFiles = new Set((schema.serverModuleContracts || []).map((contract) => contract.file));
const legacyBrowserScripts = fs.readdirSync(scriptsRoot)
    .filter((file) => file.endsWith('.js'))
    .map((file) => `scripts/${file}`)
    .filter((file) => !moduleContractFiles.has(file) && !entrypointFiles.has(file))
    .sort();
const serverRoot = path.join(pluginRoot, 'server');
const legacyServerPhp = fs.readdirSync(serverRoot)
    .filter((file) => file.endsWith('.php'))
    .map((file) => `server/${file}`)
    .filter((file) => !serverModuleFiles.has(file) && !entrypointFiles.has(file))
    .sort();
const validateLegacyInventory = (label, actual, expected = {}) => {
    if (actual.length !== Number(expected.count) || inventoryHash(actual) !== String(expected.sha256 || '')) {
        fail(`${label} inventory changed. New extracted modules must be added to a module contract; intentional legacy conversions must refresh the reviewed inventory baseline.`);
    }
};
validateLegacyInventory('Legacy browser script', legacyBrowserScripts, schema.modulePolicy?.legacyUncontractedBrowserScripts);
validateLegacyInventory('Legacy server PHP', legacyServerPhp, schema.modulePolicy?.legacyUncontractedServerPhp);

assert.equal(failures.length, 0, failures.join('\n'));
console.log(`Architecture contract guard passed: ${schema.moduleContracts.length} module contracts, ${schema.entrypointContracts?.length || 0} entrypoint contracts, ${ownersByGlobal.size} browser globals, ${pageActions.size} inline action names/${inlineActionOccurrences} occurrences, ${Object.keys(fileLineBudgets).length} ratcheting file-line budgets, and function overlap ${overlapSummary.join(', ')} validated.`);
