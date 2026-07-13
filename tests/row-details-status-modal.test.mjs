import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const repoRoot = path.resolve(process.cwd());
const require = createRequire(import.meta.url);
const rowDetailsModule = require(path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.row-details.js'
));
const cssPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/folderviewplus.css'
);

const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const deriveStatus = (counts, total) => {
    if (total <= 0) return 'empty';
    const active = ['started', 'paused', 'stopped'].filter((key) => counts[key] > 0);
    return active.length === 1 ? active[0] : 'mixed';
};

const statusLabel = (value) => `${String(value).charAt(0).toUpperCase()}${String(value).slice(1)}`;

test('status breakdown renders actionable, escaped runtime details and filters the dominant state', () => {
    const swalCalls = [];
    const filterCalls = [];
    const api = rowDetailsModule.createApi({
        swal: (options, callback) => swalCalls.push({ options, callback }),
        document: { querySelector: () => null },
        setTimeout: (callback) => callback(),
        escapeHtml,
        getFolderMap: () => ({ media: { name: 'Audiobooks <script>' } }),
        getEffectiveMemberSnapshot: () => ({
            media: { members: ['audiobookshelf <img>', 'listenarr & one'] }
        }),
        getInfoByType: () => ({
            'audiobookshelf <img>': { state: 'started', update: false },
            'listenarr & one': { state: 'stopped', update: true }
        }),
        getItemRuntimeStateKind: (_type, item) => item.state,
        deriveFolderStatusKey: deriveStatus,
        isDockerUpdateAvailable: (item) => item.update === true,
        statusLabelForKey: statusLabel,
        normalizeStatusPrefs: () => ({ warnStoppedPercent: 60 }),
        toggleStatusFilter: (...args) => filterCalls.push(args)
    });

    api.showFolderStatusBreakdown('docker', 'media');

    assert.equal(swalCalls.length, 1);
    const [{ options, callback }] = swalCalls;
    assert.equal(options.html, true);
    assert.equal(options.customClass, 'fv-status-breakdown-modal');
    assert.equal(options.confirmButtonText, 'Show mixed folders');
    assert.match(options.text, /fv-status-modal-metrics/);
    assert.match(options.text, />1<\/div>[\s\S]*50% of members/);
    assert.match(options.text, /50% remains below your 60% warning threshold/);
    assert.match(options.text, /Stopped members/);
    assert.match(options.text, /Updates[\s\S]*>1<\/div>/);
    assert.match(options.text, /Audiobooks &lt;script&gt;/);
    assert.match(options.text, /audiobookshelf &lt;img&gt;/);
    assert.match(options.text, /listenarr &amp; one/);
    assert.doesNotMatch(options.text, /<script>|<img>/);

    callback(true);
    assert.deepEqual(filterCalls, [['docker', 'mixed']]);
});

test('status refresh reloads runtime data and rerenders the breakdown', async () => {
    const swalCalls = [];
    const refreshState = { textContent: '' };
    let clickHandler = null;
    const refreshButton = {
        dataset: {},
        disabled: false,
        attributes: {},
        addEventListener: (event, callback) => {
            assert.equal(event, 'click');
            clickHandler = callback;
        },
        setAttribute(name, value) {
            this.attributes[name] = value;
        }
    };
    const document = {
        querySelector: (selector) => {
            if (selector === '.sweet-alert.fv-status-breakdown-modal [data-fv-status-refresh]') return refreshButton;
            if (selector === '#fv-status-modal-refresh-state') return refreshState;
            return null;
        }
    };
    const runtimeInfo = { app: { state: 'stopped' } };
    let refreshCount = 0;
    const api = rowDetailsModule.createApi({
        swal: (options, callback) => swalCalls.push({ options, callback }),
        document,
        setTimeout: (callback) => callback(),
        getFolderMap: () => ({ apps: { name: 'Apps' } }),
        getEffectiveMemberSnapshot: () => ({ apps: { members: ['app'] } }),
        getInfoByType: () => runtimeInfo,
        getItemRuntimeStateKind: (_type, item) => item.state,
        deriveFolderStatusKey: deriveStatus,
        statusLabelForKey: statusLabel,
        normalizeStatusPrefs: () => ({ warnStoppedPercent: 0 }),
        refreshType: async () => {
            refreshCount += 1;
            runtimeInfo.app.state = 'started';
        }
    });

    api.showFolderStatusBreakdown('docker', 'apps');
    assert.equal(typeof clickHandler, 'function');

    await clickHandler();

    assert.equal(refreshCount, 1);
    assert.equal(refreshButton.disabled, true);
    assert.equal(refreshButton.attributes['aria-busy'], 'true');
    assert.equal(refreshState.textContent, 'Refreshing runtime status…');
    assert.equal(swalCalls.length, 2);
    assert.match(swalCalls[0].options.text, /All members are stopped/);
    assert.match(swalCalls[0].options.text, /meeting your 0% warning threshold/);
    assert.match(swalCalls[1].options.text, /All members are running/);
    assert.equal(swalCalls[1].options.confirmButtonText, 'Show started folders');
});

test('empty folders render a zeroed distribution and responsive modal styles remain present', () => {
    let modalOptions = null;
    const api = rowDetailsModule.createApi({
        swal: (options) => { modalOptions = options; },
        document: { querySelector: () => null },
        setTimeout: (callback) => callback(),
        getFolderMap: () => ({ empty: { name: 'Empty folder' } }),
        getEffectiveMemberSnapshot: () => ({ empty: { members: [] } }),
        deriveFolderStatusKey: deriveStatus,
        statusLabelForKey: statusLabel,
        normalizeStatusPrefs: () => ({ warnStoppedPercent: 60 })
    });

    api.showFolderStatusBreakdown('vm', 'empty');

    assert.match(modalOptions.text, /aria-label="0% started, 0% paused, 0% stopped"/);
    assert.match(modalOptions.text, /No members yet/);
    assert.doesNotMatch(modalOptions.text, />Updates</);

    const css = fs.readFileSync(cssPath, 'utf8');
    assert.match(css, /\.sweet-alert\.fv-status-breakdown-modal\s*\{/);
    assert.match(css, /\.sweet-alert\.fv-status-breakdown-modal\s*\{[\s\S]*?height:\s*auto\s*!important/);
    assert.match(css, /\.fv-status-modal\s*\{[\s\S]*?grid-auto-rows:\s*max-content[\s\S]*?align-content:\s*start\s*!important/);
    assert.match(css, /\.fv-status-modal-metrics\s*\{[\s\S]*grid-template-columns:\s*repeat\(4/);
    assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.sweet-alert\.fv-status-breakdown-modal[\s\S]*safe-area-inset-left/);
    assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.sweet-alert\.fv-status-breakdown-modal[\s\S]*bottom:\s*auto\s*!important/);
    assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.fv-status-modal-member-groups\s*\{[\s\S]*grid-template-columns:\s*1fr/);
});
