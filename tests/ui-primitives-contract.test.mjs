import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const root = path.resolve(process.cwd());
const require = createRequire(import.meta.url);
const ui = require(path.join(root, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.ui.js'));
const actionSupport = require(path.join(root, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.actions-support.js'));
const css = fs.readFileSync(path.join(root, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/ui.primitives.css'), 'utf8');

test('shared UI renderer exposes every required primitive with escaped output', () => {
    for (const method of [
        'svgIcon', 'button', 'iconButton', 'badge', 'disclosure', 'field', 'dropdown', 'multiselect',
        'emptyState', 'loadingState', 'openPopover', 'openModal', 'openActionSheet', 'confirm', 'alert',
        'announce', 'progress', 'registerAction', 'dispatchAction', 'installDelegation'
    ]) assert.equal(typeof ui[method], 'function', `${method} must be public`);

    assert.match(ui.button({ label: '<Save>', action: 'save' }), /&lt;Save&gt;/);
    assert.match(ui.button({ label: '<Save>', action: 'save' }), /data-fv-ui-action="save"/);
    assert.match(ui.iconButton({ label: 'Close', icon: 'fa-times' }), /aria-label="Close"/);
    assert.match(ui.badge({ label: 'Healthy', tone: 'success' }), /fv-ui-badge is-success/);
    assert.match(ui.disclosure({ title: 'Details', body: '<p>Body</p>' }), /<details class="fv-ui-disclosure/);
    assert.match(ui.field({ id: 'name', label: 'Name', control: '<input id="name">', error: 'Required' }), /role="alert"/);
    assert.match(ui.multiselect({ options: ['One', 'Two'], value: ['Two'] }), /multiple/);
    assert.match(ui.emptyState({ title: 'Nothing here' }), /fv-ui-empty-state/);
    assert.match(ui.loadingState({ label: 'Loading rows' }), /role="status"/);
    assert.match(ui.svgIcon('shield'), /<svg[^>]+data-fv-icon="shield"/);
    assert.match(ui.svgIcon('shield'), /stroke="currentColor"/);
    assert.match(ui.svgIcon('unknown-icon'), /data-fv-icon="info-circle"/);
});

test('shared primitive stylesheet is tokenized, responsive, and specificity-safe', () => {
    for (const selector of [
        '.fv-ui-svg-icon', '.fv-ui-button', '.fv-ui-icon-button', '.fv-ui-badge', '.fv-ui-disclosure', '.fv-ui-field',
        '.fv-ui-select', '.fv-ui-popover', '.fv-ui-modal-backdrop', '.fv-ui-announcer', '.fv-ui-progress-state',
        '.fv-ui-empty-state', '.fv-ui-loading-state'
    ]) assert.ok(css.includes(selector), `${selector} must be styled`);
    assert.doesNotMatch(css, /\.fv-ui-toast/);
    assert.match(css, /@media \(max-width: 620px\)/);
    assert.match(css, /prefers-reduced-motion/);
    assert.doesNotMatch(css, /!important\b/);
});

test('legacy UI debt cannot increase while migrations proceed', () => {
    const output = execFileSync(process.execPath, ['scripts/ui_debt_guard.mjs'], { cwd: root, encoding: 'utf8' });
    assert.match(output, /UI debt guard passed/);
});

test('settings support actions use shared confirmation and alert primitives', async () => {
    const calls = [];
    const actions = actionSupport.createSupportActions({
        ui: {
            confirm: async (options) => {
                calls.push(['confirm', options]);
                return true;
            },
            alert: async (options) => calls.push(['alert', options])
        },
        globalRollbackApi: async (action, fields) => {
            if (action === 'rollback_list') return { name: 'checkpoint-1' };
            calls.push([action, fields.expectedName]);
            return { targetName: fields.expectedName };
        },
        refreshAll: async () => calls.push(['refresh']),
        setRollbackStatus: (status) => calls.push(['status', status]),
        showError: (title, error) => calls.push(['error', title, error])
    });
    await actions.rollbackLatestCheckpoint();
    assert.equal(calls[0][0], 'confirm');
    assert.match(calls[0][1].message, /checkpoint-1/);
    assert.deepEqual(calls[1], ['rollback_restore_previous', 'checkpoint-1']);
    assert.deepEqual(calls.filter(([kind]) => kind === 'refresh'), [['refresh']]);
    assert.deepEqual(calls.filter(([kind]) => kind === 'status'), [['status', 'Restored checkpoint-1']]);
    assert.equal(calls.at(-1)[0], 'alert');
    assert.equal(calls.at(-1)[1].tone, 'success');
});

test('manual global rollback requires a reviewed checkpoint and confirmation', async () => {
    let checkpoint = null;
    const calls = [];
    const actions = actionSupport.createSupportActions({
        globalRollbackApi: async (action) => action === 'rollback_list' ? checkpoint : calls.push('restore'),
        ui: { confirm: async () => { calls.push('confirm'); return false; } },
        showError: (_title, error) => calls.push(error.message)
    });
    await actions.rollbackLatestCheckpoint();
    checkpoint = { name: 'fixture-rollback.json' };
    await actions.rollbackLatestCheckpoint();
    assert.deepEqual(calls, ['No previous rollback snapshot available.', 'confirm']);
});

test('manual global rollback reports a committed restore with deferred native startup', async () => {
    const calls = [];
    const actions = actionSupport.createSupportActions({
        globalRollbackApi: async action => action === 'rollback_list' ? { name: 'checkpoint' }
            : { targetName: 'checkpoint', verified: true, dockerOrderSync: 'queued' },
        ui: { confirm: async () => true, alert: async () => calls.push('unexpected success') },
        refreshAll: async () => calls.push('refreshed'),
        offerRecoveryDockerOrderRetry: async (status, context) => calls.push([status, context.text])
    });
    await actions.rollbackLatestCheckpoint();
    assert.deepEqual(calls, ['refreshed', ['queued', 'Restored checkpoint']]);
});

test('global rollback API selects a restorable previous row and sends the reviewed or named checkpoint', async () => {
    const source = fs.readFileSync(path.join(root, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.activity-diagnostics.js'), 'utf8');
    const calls = [];
    const bind = new Function('apiGetJson', 'apiPostJson', 'assertRuntimeConflictActionAllowed', `
        ${source.slice(source.indexOf('const globalRollbackApi ='), source.indexOf('const restoreLatest ='))}
        return globalRollbackApi;
    `);
    const api = bind(async (_url, options) => {
        assert.equal(options.cache, false);
        return { ok: true, snapshots: [
            { name: 'unreadable-newest', restorable: false },
            { name: 'unreadable-previous', restorable: false },
            { name: 'reviewed-checkpoint', restorable: true }
        ] };
    }, async (_url, fields) => {
        calls.push(fields);
        return { ok: true, restore: { verified: true } };
    }, () => {});
    const previous = await api('rollback_list');
    assert.equal(previous.name, 'reviewed-checkpoint');
    await api('rollback_restore_previous', { expectedName: previous.name });
    await api('rollback_restore_named', { name: 'setup-checkpoint' });
    assert.deepEqual(calls, [
        { action: 'rollback_restore_previous', expectedName: 'reviewed-checkpoint' },
        { action: 'rollback_restore_named', name: 'setup-checkpoint' }
    ]);
});

test('settings support actions register through the declarative registry without broad window assignment', () => {
    const calls = [];
    const target = {
        FolderViewPlusCspEvents: {
            registerActions(actions, options) {
                calls.push({ actions, options });
                return Object.keys(actions);
            }
        }
    };
    const handler = () => {};
    assert.deepEqual(actionSupport.registerActions(target, { save: handler }, { owner: 'settings-test' }), ['save']);
    assert.deepEqual(calls, [{ actions: { save: handler }, options: { owner: 'settings-test' } }]);
    assert.equal(target.save, undefined);
    assert.throws(() => actionSupport.registerActions({}, { save: handler }), /registry is unavailable/);
});
