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
    assert.equal(result.referenceCount, 291);
});

test('entrypoints and contracted modules declare ownership boundaries', () => {
    assert.equal(architecture.schemaVersion, 2);
    assert.equal(architecture.entrypointContracts.length, 9);
    assert.equal(architecture.moduleContracts.length, 51);
    assert.equal(architecture.serverModuleContracts.length, 29);
    const allowedConsumers = new Set(architecture.consumerScopes);
    for (const contract of [...architecture.entrypointContracts, ...architecture.moduleContracts, ...architecture.serverModuleContracts]) {
        assert.ok(contract.file, 'boundary contract must name its file');
        assert.ok(contract.stateModel, `${contract.file} must declare its state model`);
        assert.ok(Array.isArray(contract.consumers) && contract.consumers.length > 0, `${contract.file} must declare consumers`);
        assert.ok(contract.consumers.every((consumer) => allowedConsumers.has(consumer)), `${contract.file} has an unknown consumer`);
        assert.ok(Array.isArray(contract.dependsOn), `${contract.file} must declare dependencies`);
        assert.ok(Array.isArray(contract.compatibilityGlobals), `${contract.file} must declare compatibility globals`);
        assert.ok(fs.existsSync(path.join(pluginRoot, contract.file)), `${contract.file} must exist`);
    }
});

test('PHP facades have contracted Phase 6 domain boundaries', () => {
    const contracts = new Map(architecture.serverModuleContracts.map((contract) => [contract.file, contract]));
    const coreContract = architecture.entrypointContracts.find((contract) => contract.file === 'server/lib.php');
    const diagnosticsContract = architecture.entrypointContracts.find((contract) => contract.file === 'server/lib.diagnostics.php');
    const iconContract = architecture.entrypointContracts.find((contract) => contract.file === 'server/upload_custom_icon.php');
    assert.deepEqual(architecture.budgets.fileLineBudgets['server/lib.php'].history, [7556, 2649]);
    assert.deepEqual(architecture.budgets.fileLineBudgets['server/lib.diagnostics.php'].history, [2923, 257]);
    assert.deepEqual(architecture.budgets.fileLineBudgets['server/upload_custom_icon.php'].history, [1481, 37]);
    for (const contract of architecture.serverModuleContracts) {
        assert.ok(contract.owner, `${contract.file} must declare one owner`);
        assert.ok(contract.loadedBy, `${contract.file} must declare its compatibility loader`);
        assert.ok(Number.isInteger(contract.functionInventory?.count) && contract.functionInventory.count > 0);
        assert.match(contract.functionInventory.sha256, /^[0-9a-f]{64}$/);
        assert.ok(architecture.budgets.fileLineBudgets[contract.file], `${contract.file} must have a ratcheting line budget`);
    }
    for (const file of [...contracts.keys()].filter((file) => contracts.get(file).loadedBy === 'server/lib.php')) {
        assert.ok(coreContract?.dependsOn.includes(file), `${file} must be required by the core facade`);
    }
    for (const file of [...contracts.keys()].filter((file) => contracts.get(file).loadedBy === 'server/lib.diagnostics.php')) {
        assert.ok(diagnosticsContract?.dependsOn.includes(file), `${file} must be required by the diagnostics facade`);
    }
    for (const file of [...contracts.keys()].filter((file) => contracts.get(file).loadedBy === 'server/upload_custom_icon.php')) {
        assert.ok(iconContract?.dependsOn.includes(file), `${file} must be required by the custom-icon endpoint`);
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

test('foundational utilities and transport have contracted child-module boundaries', () => {
    const contracts = new Map(architecture.moduleContracts.map((contract) => [contract.file, contract]));
    assert.deepEqual(contracts.get('scripts/folderviewplus.utils.js')?.dependsOn, [
        'scripts/folderviewplus.utils-foundation.js',
        'scripts/folderviewplus.utils-normalization.js',
        'scripts/folderviewplus.utils-prefs.js',
        'scripts/folderviewplus.utils-ordering.js',
        'scripts/folderviewplus.utils-transfer.js',
        'scripts/folderviewplus.utils-rules.js'
    ]);
    assert.deepEqual(contracts.get('scripts/runtime.transport.js')?.dependsOn, [
        'scripts/runtime.transport.core.js',
        'scripts/runtime.transport.subscription.js',
        'scripts/runtime.transport.docker-actions.js'
    ]);
    assert.equal(architecture.budgets.fileLineBudgets['scripts/folderviewplus.utils.js'].limit, 88);
    assert.equal(architecture.budgets.fileLineBudgets['scripts/runtime.transport.js'].limit, 499);
    assert.deepEqual(architecture.budgets.fileLineBudgets['scripts/runtime.transport.js'].history, [1060, 499]);
    for (const file of [
        'scripts/folderviewplus.utils-foundation.js',
        'scripts/runtime.transport.core.js',
        'scripts/runtime.transport.subscription.js',
        'scripts/runtime.transport.docker-actions.js'
    ]) {
        assert.equal(contracts.get(file)?.global, 'FolderViewPlusFoundationModules');
        assert.ok(contracts.get(file)?.globalMember, `${file} must own one internal namespace member`);
    }
});

test('folder editor stateful subsystems have contracted lifecycle boundaries', () => {
    const contracts = new Map(architecture.moduleContracts.map((contract) => [contract.file, contract]));
    const editorContract = architecture.entrypointContracts.find((contract) => contract.file === 'scripts/folder.js');
    for (const file of [
        'scripts/folder.editor.hierarchy.js',
        'scripts/folder.editor.regex-selection.js',
        'scripts/folder.editor.member-list.js'
    ]) {
        assert.ok(editorContract?.dependsOn.includes(file), `${file} must be required by the folder editor entrypoint`);
    }
    for (const file of ['scripts/folder.editor.regex-selection.js', 'scripts/folder.editor.member-list.js']) {
        assert.equal(contracts.get(file)?.global, 'FolderViewPlusFoundationModules');
        assert.ok(contracts.get(file)?.globalMember);
        assert.equal(contracts.get(file)?.stateModel, 'factory-owned');
    }
    assert.deepEqual(architecture.budgets.fileLineBudgets['scripts/folder.js'].history, [5522, 4773]);
});

test('settings search and wizard state models have contracted Phase 5 boundaries', () => {
    const contracts = new Map(architecture.moduleContracts.map((contract) => [contract.file, contract]));
    const settingsContract = architecture.entrypointContracts.find((contract) => contract.file === 'scripts/folderviewplus.js');
    const wizardContract = architecture.entrypointContracts.find((contract) => contract.file === 'scripts/folderviewplus.wizard.js');
    assert.ok(settingsContract?.dependsOn.includes('scripts/folderviewplus.settings-search.js'));
    for (const file of [
        'scripts/folderviewplus.wizard-persistence.js',
        'scripts/folderviewplus.wizard-review.js'
    ]) {
        assert.ok(wizardContract?.dependsOn.includes(file), `${file} must be required by the wizard entrypoint`);
    }
    for (const file of [
        'scripts/folderviewplus.settings-search.js',
        'scripts/folderviewplus.wizard-persistence.js',
        'scripts/folderviewplus.wizard-review.js'
    ]) {
        assert.equal(contracts.get(file)?.global, 'FolderViewPlusFoundationModules');
        assert.ok(contracts.get(file)?.globalMember);
        assert.equal(contracts.get(file)?.stateModel, 'factory-owned');
    }
    assert.deepEqual(architecture.budgets.fileLineBudgets['scripts/folderviewplus.js'].history, [12092, 11793]);
    assert.deepEqual(architecture.budgets.fileLineBudgets['scripts/folderviewplus.wizard.js'].history, [4849, 4165]);
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
        count: 96,
        sha256: '4975b2b3196fbade0722248292307f24effa2c8499d4cd403f38ef11e1bb6643'
    });
    assert.deepEqual(architecture.modulePolicy.legacyUncontractedServerPhp, {
        count: 40,
        sha256: 'e80f4fe5203d2e284d1dc08baf271e990352fa09991420b3da7c4b197aa3100e'
    });
});
