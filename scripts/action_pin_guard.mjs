#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workflowRoot = path.join(repoRoot, '.github', 'workflows');
const files = [
    ...fs.readdirSync(workflowRoot)
        .filter((name) => /\.ya?ml$/i.test(name))
        .map((name) => path.join(workflowRoot, name)),
    path.join(repoRoot, '.github', 'actions', 'setup-ci-env', 'action.yml')
];
const failures = [];
let externalUses = 0;
for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    const relative = path.relative(repoRoot, file).replaceAll('\\', '/');
    for (const match of source.matchAll(/^\s*uses:\s*([^\s#]+)(?:\s*#\s*(.+))?$/gm)) {
        const reference = match[1];
        if (reference.startsWith('./') || reference.startsWith('docker://')) continue;
        externalUses += 1;
        const separator = reference.lastIndexOf('@');
        const revision = separator >= 0 ? reference.slice(separator + 1) : '';
        if (!/^[0-9a-f]{40}$/.test(revision)) {
            failures.push(`${relative}: external action is not pinned to a full commit SHA: ${reference}`);
        }
        if (!match[2] || !/\bv\d+\b/.test(match[2])) {
            failures.push(`${relative}: pinned action must retain a human-readable major-version comment: ${reference}`);
        }
    }
}
const dependabotPath = path.join(repoRoot, '.github', 'dependabot.yml');
assert.equal(fs.existsSync(dependabotPath), true, '.github/dependabot.yml must keep pinned Actions and npm tooling current.');
const dependabot = fs.readFileSync(dependabotPath, 'utf8');
assert.match(dependabot, /package-ecosystem:\s*["']?github-actions["']?/);
assert.match(dependabot, /package-ecosystem:\s*["']?npm["']?/);
assert.equal(failures.length, 0, failures.join('\n'));
console.log(`Action pin guard passed: ${externalUses} external uses are immutable and Dependabot covers Actions plus npm.`);
