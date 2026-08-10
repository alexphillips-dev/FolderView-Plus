#!/usr/bin/env node
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = path.join(repoRoot, 'docs', 'sbom.cdx.json');
const checkOnly = process.argv.includes('--check');
const packageLock = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package-lock.json'), 'utf8'));
const runtimeInventory = JSON.parse(fs.readFileSync(path.join(repoRoot, 'scripts', 'runtime_components.json'), 'utf8'));
const manifest = fs.readFileSync(path.join(repoRoot, 'folderview.plus.plg'), 'utf8');
const version = manifest.match(/<!ENTITY\s+version\s+"([^"]+)">/)?.[1] || 'unknown';

const uuidV8 = (name) => {
    const bytes = Buffer.from(crypto.createHash('sha256').update(String(name), 'utf8').digest().subarray(0, 16));
    bytes[6] = (bytes[6] & 0x0f) | 0x80;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = bytes.toString('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};
const serialNumber = `urn:uuid:${uuidV8(`folderview-plus:${version}`)}`;

assert.equal(runtimeInventory.schemaVersion, 1, 'scripts/runtime_components.json schemaVersion must be 1');
const includeRoot = path.join(
    repoRoot,
    'src',
    'folderview.plus',
    'usr',
    'local',
    'emhttp',
    'plugins',
    'folderview.plus',
    'scripts',
    'include'
);
const inventoriedFiles = new Set([
    ...(runtimeInventory.firstPartyFiles || []),
    ...(runtimeInventory.components || []).flatMap((component) => component.files || [])
]);
const shippedIncludeFiles = fs.readdirSync(includeRoot)
    .filter((name) => fs.statSync(path.join(includeRoot, name)).isFile())
    .map((name) => path.relative(repoRoot, path.join(includeRoot, name)).replaceAll('\\', '/'))
    .sort();
assert.deepEqual(
    [...inventoriedFiles].sort(),
    shippedIncludeFiles,
    'Every shipped scripts/include file must be classified in scripts/runtime_components.json'
);

const hashFiles = (files) => {
    const digest = crypto.createHash('sha256');
    for (const file of [...files].sort()) {
        const absolute = path.join(repoRoot, file);
        assert.equal(fs.existsSync(absolute), true, `Missing runtime component file: ${file}`);
        const fileDigest = crypto.createHash('sha256').update(fs.readFileSync(absolute)).digest('hex');
        digest.update(`${file}\0${fileDigest}\n`);
    }
    return digest.digest('hex');
};

const runtimeComponents = (runtimeInventory.components || []).map((component) => ({
    type: 'library',
    name: String(component.name),
    version: String(component.version),
    scope: 'required',
    hashes: [{ alg: 'SHA-256', content: hashFiles(component.files || []) }],
    licenses: [{ expression: String(component.license) }],
    ...(component.purl ? { purl: String(component.purl) } : {}),
    externalReferences: [{ type: 'website', url: String(component.source) }],
    properties: [
        { name: 'folderview-plus:usage', value: component.embedded === true ? 'embedded-runtime-library' : 'shipped-runtime-library' },
        { name: 'folderview-plus:files', value: (component.files || []).join(',') },
        { name: 'folderview-plus:modified', value: component.modified === true ? 'true' : 'false' }
    ]
}));

const hostComponents = (runtimeInventory.hostProvidedComponents || []).map((component) => ({
    type: 'library',
    name: String(component.name),
    version: String(component.version),
    scope: 'required',
    externalReferences: [{ type: 'website', url: String(component.source) }],
    properties: [{ name: 'folderview-plus:usage', value: 'unraid-host-provided-runtime-library' }]
}));

const npmComponents = Object.entries(packageLock.packages || {})
    .filter(([packagePath, metadata]) => packagePath.startsWith('node_modules/') && metadata?.version)
    .map(([packagePath, metadata]) => {
        const name = packagePath.slice('node_modules/'.length);
        return {
            type: 'library',
            name,
            version: String(metadata.version),
            scope: 'optional',
            ...(metadata.license ? { licenses: [{ license: { id: String(metadata.license) } }] } : {}),
            purl: `pkg:npm/${encodeURIComponent(name).replaceAll('%40', '@')}@${encodeURIComponent(String(metadata.version))}`
        };
    });

const actionComponents = [];
const workflowFiles = [
    ...fs.readdirSync(path.join(repoRoot, '.github', 'workflows')).map((name) => path.join(repoRoot, '.github', 'workflows', name)),
    path.join(repoRoot, '.github', 'actions', 'setup-ci-env', 'action.yml')
].filter((file) => fs.existsSync(file));
const actionKeys = new Set();
for (const file of workflowFiles) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(/uses:\s*([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)(?:\/[A-Za-z0-9_.-]+)*@([0-9a-f]{40})/g)) {
        const [, name, revision] = match;
        const key = `${name}@${revision}`;
        if (actionKeys.has(key)) continue;
        actionKeys.add(key);
        actionComponents.push({
            type: 'application',
            name,
            version: revision,
            scope: 'optional',
            purl: `pkg:github/${name}@${revision}`,
            properties: [{ name: 'folderview-plus:usage', value: 'build-only-github-action' }]
        });
    }
}

const components = [...runtimeComponents, ...hostComponents, ...npmComponents, ...actionComponents]
    .sort((left, right) => `${left.type}:${left.name}:${left.version}`.localeCompare(`${right.type}:${right.name}:${right.version}`));
const bom = {
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    serialNumber,
    version: 1,
    metadata: {
        component: {
            type: 'application',
            name: 'FolderView Plus',
            version,
            properties: [
                { name: 'folderview-plus:runtime-dependencies', value: 'shipped-and-unraid-host-provided' },
                { name: 'folderview-plus:component-scope', value: 'runtime-development-and-ci-tooling' },
                { name: 'folderview-plus:runtime-inventory', value: 'scripts/runtime_components.json' }
            ]
        }
    },
    components
};
const serialized = `${JSON.stringify(bom, null, 2)}\n`;

if (checkOnly) {
    assert.equal(fs.existsSync(outputPath), true, `Missing generated SBOM: ${path.relative(repoRoot, outputPath)}`);
    assert.equal(fs.readFileSync(outputPath, 'utf8'), serialized, 'docs/sbom.cdx.json is stale; run node scripts/generate_sbom.mjs');
    console.log(`SBOM guard passed: FolderView Plus ${version}, ${runtimeComponents.length} shipped runtime libraries, ${hostComponents.length} host runtime libraries, ${npmComponents.length} npm packages, ${actionComponents.length} GitHub Actions.`);
} else {
    fs.writeFileSync(outputPath, serialized);
    console.log(`Wrote ${path.relative(repoRoot, outputPath)} with ${components.length} components for ${version}.`);
}
