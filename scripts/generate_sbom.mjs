#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = path.join(repoRoot, 'docs', 'sbom.cdx.json');
const checkOnly = process.argv.includes('--check');
const packageLock = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package-lock.json'), 'utf8'));
const manifest = fs.readFileSync(path.join(repoRoot, 'folderview.plus.plg'), 'utf8');
const version = manifest.match(/<!ENTITY\s+version\s+"([^"]+)">/)?.[1] || 'unknown';

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
            purl: `pkg:npm/${encodeURIComponent(name).replace('%40', '@')}@${encodeURIComponent(String(metadata.version))}`
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
    for (const match of source.matchAll(/uses:\s*([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)@([0-9a-f]{40})/g)) {
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

const components = [...npmComponents, ...actionComponents]
    .sort((left, right) => `${left.type}:${left.name}:${left.version}`.localeCompare(`${right.type}:${right.name}:${right.version}`));
const bom = {
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    version: 1,
    metadata: {
        component: {
            type: 'application',
            name: 'FolderView Plus',
            version,
            properties: [
                { name: 'folderview-plus:runtime-dependencies', value: 'none-vendored' },
                { name: 'folderview-plus:component-scope', value: 'development-and-ci-tooling' }
            ]
        }
    },
    components
};
const serialized = `${JSON.stringify(bom, null, 2)}\n`;

if (checkOnly) {
    assert.equal(fs.existsSync(outputPath), true, `Missing generated SBOM: ${path.relative(repoRoot, outputPath)}`);
    assert.equal(fs.readFileSync(outputPath, 'utf8'), serialized, 'docs/sbom.cdx.json is stale; run node scripts/generate_sbom.mjs');
    console.log(`SBOM guard passed: FolderView Plus ${version}, ${npmComponents.length} npm packages, ${actionComponents.length} GitHub Actions.`);
} else {
    fs.writeFileSync(outputPath, serialized);
    console.log(`Wrote ${path.relative(repoRoot, outputPath)} with ${components.length} components for ${version}.`);
}
