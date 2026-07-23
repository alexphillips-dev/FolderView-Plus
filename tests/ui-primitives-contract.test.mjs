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
        'toast', 'progress', 'registerAction', 'dispatchAction', 'installDelegation'
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
        '.fv-ui-select', '.fv-ui-popover', '.fv-ui-modal-backdrop', '.fv-ui-toast-region', '.fv-ui-progress-state',
        '.fv-ui-empty-state', '.fv-ui-loading-state'
    ]) assert.ok(css.includes(selector), `${selector} must be styled`);
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
        restorePreviousGlobalRollbackCheckpointApi: async () => ({ targetName: 'checkpoint-1' }),
        refreshAll: async () => calls.push(['refresh']),
        setRollbackStatus: (status) => calls.push(['status', status]),
        showError: (title, error) => calls.push(['error', title, error])
    });
    await actions.rollbackLatestCheckpoint();
    assert.equal(calls[0][0], 'confirm');
    assert.deepEqual(calls.filter(([kind]) => kind === 'refresh'), [['refresh']]);
    assert.deepEqual(calls.filter(([kind]) => kind === 'status'), [['status', 'Restored checkpoint-1']]);
    assert.equal(calls.at(-1)[0], 'alert');
    assert.equal(calls.at(-1)[1].tone, 'success');
});
