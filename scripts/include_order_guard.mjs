#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pluginRoot = path.join(repoRoot, 'src', 'folderview.plus', 'usr', 'local', 'emhttp', 'plugins', 'folderview.plus');
const contractsPath = path.join(repoRoot, 'scripts', 'load_order_contracts.json');

export const extractPluginScriptReferences = (source) => [
    ...String(source || '').matchAll(/\/plugins\/folderview\.plus\/scripts\/([A-Za-z0-9_./-]+\.js)/g)
].map((match) => `scripts/${match[1]}`);

export const validateLoadOrderContracts = ({ root = pluginRoot, contractFile = contractsPath } = {}) => {
    const contracts = JSON.parse(fs.readFileSync(contractFile, 'utf8'));
    const failures = [];
    const fail = (message) => failures.push(message);
    if (contracts.schemaVersion !== 1) fail(`Unsupported load-order schema version: ${contracts.schemaVersion}.`);

    const sourceContracts = Array.isArray(contracts.sourceContracts) ? contracts.sourceContracts : [];
    const sourceById = new Map();
    for (const contract of sourceContracts) {
        const id = String(contract?.id || '').trim();
        const relativeSource = String(contract?.source || '').trim();
        if (!id) {
            fail('Load-order source contract is missing an id.');
            continue;
        }
        if (sourceById.has(id)) fail(`Duplicate load-order source contract id: ${id}.`);
        sourceById.set(id, contract);
        const absoluteSource = path.join(root, relativeSource);
        if (!relativeSource || !fs.existsSync(absoluteSource)) {
            fail(`Load-order source does not exist for ${id}: ${relativeSource || '(empty)'}.`);
            continue;
        }
        const expected = Array.isArray(contract.references) ? contract.references.map(String) : [];
        const actual = extractPluginScriptReferences(fs.readFileSync(absoluteSource, 'utf8'));
        try {
            assert.deepEqual(actual, expected);
        } catch (_error) {
            fail(`${id} script order changed.\nExpected: ${expected.join(' -> ') || '(none)'}\nActual: ${actual.join(' -> ') || '(none)'}`);
        }
        for (const reference of expected) {
            if (!fs.existsSync(path.join(root, reference))) {
                fail(`${id} references a missing script: ${reference}.`);
            }
        }
    }

    const pageGraphs = Array.isArray(contracts.pageGraphs) ? contracts.pageGraphs : [];
    const pageFiles = fs.readdirSync(root).filter((file) => file.endsWith('.page')).sort();
    const contractedPages = pageGraphs.map((graph) => String(graph?.page || '')).sort();
    try {
        assert.deepEqual(contractedPages, pageFiles);
    } catch (_error) {
        fail(`Page graph coverage changed.\nExpected pages: ${pageFiles.join(', ')}\nContracted pages: ${contractedPages.join(', ')}`);
    }
    const surfaces = new Set();
    for (const graph of pageGraphs) {
        const surface = String(graph?.surface || '').trim();
        const page = String(graph?.page || '').trim();
        const entrypoint = String(graph?.entrypoint || '').trim();
        if (!surface) fail(`Page graph for ${page || '(unknown page)'} is missing a surface.`);
        if (surfaces.has(surface)) fail(`Duplicate page graph surface: ${surface}.`);
        surfaces.add(surface);
        if (!page || !fs.existsSync(path.join(root, page))) fail(`Page graph source does not exist: ${page || '(empty)'}.`);
        if (!entrypoint || !fs.existsSync(path.join(root, entrypoint))) fail(`${surface || page} entrypoint does not exist: ${entrypoint || '(empty)'}.`);
        const sourceIds = Array.isArray(graph.sources) ? graph.sources.map(String) : [];
        const graphReferences = sourceIds.flatMap((id) => {
            if (!sourceById.has(id)) {
                fail(`${surface || page} references an unknown load-order source: ${id}.`);
                return [];
            }
            return sourceById.get(id).references || [];
        });
        if (!graphReferences.includes(entrypoint)) fail(`${surface || page} load graph does not include its entrypoint: ${entrypoint}.`);
    }

    const usedSourceIds = new Set(pageGraphs.flatMap((graph) => Array.isArray(graph.sources) ? graph.sources : []));
    for (const id of sourceById.keys()) {
        if (!usedSourceIds.has(id)) fail(`Load-order source contract is not attached to a page graph: ${id}.`);
    }
    return Object.freeze({
        failures: Object.freeze(failures),
        pageCount: pageGraphs.length,
        sourceCount: sourceContracts.length,
        referenceCount: sourceContracts.reduce((total, contract) => total + (contract.references?.length || 0), 0)
    });
};

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
    const result = validateLoadOrderContracts();
    assert.equal(result.failures.length, 0, result.failures.join('\n'));
    console.log(`Include order guard passed: ${result.pageCount} page graphs, ${result.sourceCount} ordered sources, and ${result.referenceCount} script references validated.`);
}
