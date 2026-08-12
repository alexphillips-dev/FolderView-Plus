import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const repoRoot = path.resolve(process.cwd());
const require = createRequire(import.meta.url);
const pluginRoot = path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus');
const scriptsRoot = path.join(pluginRoot, 'scripts');
const readScript = (name) => fs.readFileSync(path.join(scriptsRoot, name), 'utf8');

const foundation = require(path.join(scriptsRoot, 'folderviewplus.utils-foundation.js'));
const utils = require(path.join(scriptsRoot, 'folderviewplus.utils.js'));
const transportCore = require(path.join(scriptsRoot, 'runtime.transport.core.js'));
const transportSubscription = require(path.join(scriptsRoot, 'runtime.transport.subscription.js'));
const transportDockerActions = require(path.join(scriptsRoot, 'runtime.transport.docker-actions.js'));
const transport = require(path.join(scriptsRoot, 'runtime.transport.js'));

test('utility facade preserves public identity while foundation owns primitive implementations', () => {
    for (const name of [
        'bindEventOnce',
        'createBatchedStorageWriter',
        'createFrameScheduler',
        'createIdleTaskQueue',
        'createSecureRuntimeId',
        'escapeHtml',
        'normalizeFolderId',
        'sanitizeImageSrc',
        'sanitizeImageUrl'
    ]) {
        assert.equal(utils[name], foundation[name], `${name} must be forwarded without a compatibility wrapper`);
    }
    const facadeSource = readScript('folderviewplus.utils.js');
    assert.doesNotMatch(facadeSource, /const bindEventOnce =/);
    assert.doesNotMatch(facadeSource, /const createFrameScheduler =/);
    assert.doesNotMatch(facadeSource, /const createBatchedStorageWriter =/);
    assert.doesNotMatch(facadeSource, /const sanitizeImageUrl =/);
});

test('transport facade composes request, subscription, and Docker action child modules', () => {
    assert.equal(typeof transportCore.createClient, 'function');
    assert.equal(typeof transportSubscription.createRuntime, 'function');
    assert.equal(typeof transportDockerActions.createRuntime, 'function');
    for (const name of ['query', 'subscribe', 'runDockerAction', 'runDockerMutation', 'probeCapabilities']) {
        assert.equal(typeof transport[name], 'function', `${name} must remain available on the compatibility facade`);
    }
    const facadeSource = readScript('runtime.transport.js');
    assert.doesNotMatch(facadeSource, /class RuntimeTransportError/);
    assert.doesNotMatch(facadeSource, /const createAbortBoundary =/);
    assert.doesNotMatch(facadeSource, /const resolveWebSocketUrl =/);
    assert.doesNotMatch(facadeSource, /const runDockerAction =/);
    assert.doesNotMatch(facadeSource, /const runDockerMutation =/);
});

test('every browser surface loads foundational children before their compatibility facades', () => {
    const pages = [
        'FolderViewPlus.page',
        'folderview.plus.Docker.page',
        'folderview.plus.VMs.page',
        'folderview.plus.Dashboard.page',
        'Folder.page'
    ];
    for (const pageName of pages) {
        const page = fs.readFileSync(path.join(pluginRoot, pageName), 'utf8');
        const foundationIndex = page.indexOf('folderviewplus.utils-foundation.js');
        const facadeIndex = page.indexOf('folderviewplus.utils.js');
        assert.ok(foundationIndex >= 0 && foundationIndex < facadeIndex, `${pageName} utility load order is invalid`);
    }
    for (const pageName of pages.slice(0, 4)) {
        const page = fs.readFileSync(path.join(pluginRoot, pageName), 'utf8');
        const coreIndex = page.indexOf('runtime.transport.core.js');
        const subscriptionIndex = page.indexOf('runtime.transport.subscription.js');
        const dockerActionsIndex = page.indexOf('runtime.transport.docker-actions.js');
        const facadeIndex = page.indexOf('runtime.transport.js');
        assert.ok(coreIndex >= 0 && coreIndex < subscriptionIndex, `${pageName} transport core order is invalid`);
        assert.ok(subscriptionIndex < dockerActionsIndex, `${pageName} subscription order is invalid`);
        assert.ok(dockerActionsIndex < facadeIndex, `${pageName} transport facade order is invalid`);
    }
});
