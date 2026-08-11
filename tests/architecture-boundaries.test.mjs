import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { validateLoadOrderContracts } from '../scripts/include_order_guard.mjs';

const repoRoot = path.resolve(process.cwd());
const pluginRoot = path.join(repoRoot, 'src', 'folderview.plus', 'usr', 'local', 'emhttp', 'plugins', 'folderview.plus');
const architecturePath = path.join(pluginRoot, 'schemas', 'architecture-contracts.schema.json');
const architecture = JSON.parse(fs.readFileSync(architecturePath, 'utf8'));

test('all FolderView Plus page and loader script graphs are contract-guarded', () => {
    const result = validateLoadOrderContracts();
    assert.deepEqual(result.failures, []);
    assert.equal(result.pageCount, 5);
    assert.equal(result.sourceCount, 8);
    assert.equal(result.referenceCount, 201);
});

test('entrypoints and contracted modules declare ownership boundaries', () => {
    assert.equal(architecture.schemaVersion, 2);
    assert.equal(architecture.entrypointContracts.length, 9);
    assert.equal(architecture.moduleContracts.length, 12);
    const allowedConsumers = new Set(architecture.consumerScopes);
    for (const contract of [...architecture.entrypointContracts, ...architecture.moduleContracts]) {
        assert.ok(contract.file, 'boundary contract must name its file');
        assert.ok(contract.stateModel, `${contract.file} must declare its state model`);
        assert.ok(Array.isArray(contract.consumers) && contract.consumers.length > 0, `${contract.file} must declare consumers`);
        assert.ok(contract.consumers.every((consumer) => allowedConsumers.has(consumer)), `${contract.file} has an unknown consumer`);
        assert.ok(Array.isArray(contract.dependsOn), `${contract.file} must declare dependencies`);
        assert.ok(Array.isArray(contract.compatibilityGlobals), `${contract.file} must declare compatibility globals`);
        assert.ok(fs.existsSync(path.join(pluginRoot, contract.file)), `${contract.file} must exist`);
    }
});

test('declarative actions are registry-owned with a ratcheted compatibility ceiling', () => {
    assert.equal(architecture.budgets.maxBrowserGlobals, 375);
    assert.equal(architecture.budgets.minRegisteredActions, 145);
    assert.equal(architecture.budgets.maxRegisteredActionGlobals, 11);
    assert.deepEqual(architecture.browserGlobals.removedActionRegistrars, ['registerWindowActions']);
    const actionRuntime = architecture.moduleContracts.find((contract) => contract.file === 'scripts/folderviewplus.csp-events.js');
    const settingsActions = architecture.moduleContracts.find((contract) => contract.file === 'scripts/folderviewplus.actions-support.js');
    assert.equal(actionRuntime?.owner, 'declarative-action-runtime');
    assert.ok(actionRuntime?.exports.includes('registerActions'));
    assert.ok(actionRuntime?.exports.includes('unregisterOwner'));
    assert.deepEqual(settingsActions?.dependsOn, ['scripts/folderviewplus.csp-events.js']);
    assert.ok(settingsActions?.exports.includes('registerActions'));
});

test('file budgets have non-increasing audit histories and explicit reduction targets', () => {
    const budgets = architecture.budgets.fileLineBudgets;
    const requiredEntrypoints = [
        'scripts/folderviewplus.js',
        'scripts/docker.js',
        'scripts/vm.js',
        'scripts/dashboard.js',
        'scripts/folder.js',
        'scripts/folderviewplus.wizard.js',
        'server/lib.php',
        'server/lib.diagnostics.php',
        'server/upload_custom_icon.php'
    ];
    requiredEntrypoints.forEach((file) => assert.ok(budgets[file], `${file} must have a ratcheting line budget`));
    for (const [file, budget] of Object.entries(budgets)) {
        assert.ok(Array.isArray(budget.history) && budget.history.length > 0, `${file} must have budget history`);
        assert.equal(budget.limit, budget.history.at(-1), `${file} limit must match latest budget history`);
        assert.ok(budget.target <= budget.limit, `${file} target must not exceed its current limit`);
        for (let index = 1; index < budget.history.length; index += 1) {
            assert.ok(budget.history[index] <= budget.history[index - 1], `${file} budget history must not increase`);
        }
    }
});

test('new browser and PHP modules cannot silently expand the legacy inventory', () => {
    assert.deepEqual(architecture.modulePolicy.legacyUncontractedBrowserScripts, {
        count: 98,
        sha256: '22d53706609e0098112b6b19567bc181a0bd1378189c3e9b15f90ad1a3fdc45a'
    });
    assert.deepEqual(architecture.modulePolicy.legacyUncontractedServerPhp, {
        count: 40,
        sha256: 'e80f4fe5203d2e284d1dc08baf271e990352fa09991420b3da7c4b197aa3100e'
    });
});
