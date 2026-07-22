import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(process.cwd());
const scriptRoot = path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts');
const page = fs.readFileSync(path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/FolderViewPlus.page'), 'utf8');
const settingsJs = fs.readFileSync(path.join(scriptRoot, 'folderviewplus.js'), 'utf8');
const dockerJs = fs.readFileSync(path.join(scriptRoot, 'docker.js'), 'utf8');
const vmJs = fs.readFileSync(path.join(scriptRoot, 'vm.js'), 'utf8');
const settingsHealth = require(path.join(scriptRoot, 'folderviewplus.settings-health.js'));
const utils = require(path.join(scriptRoot, 'folderviewplus.utils.js'));

test('Docker health scoring presets apply every advertised policy value', () => {
    const preserved = {
        cardsEnabled: false,
        runtimeBadgeEnabled: true,
        vmResourceWarnVcpus: 20
    };

    assert.deepEqual(settingsHealth.applyHealthProfilePreset(preserved, 'strict'), {
        ...preserved,
        profile: 'strict',
        warnStoppedPercent: 45,
        criticalStoppedPercent: 75,
        updatesMode: 'warn',
        allStoppedMode: 'critical'
    });
    assert.deepEqual(settingsHealth.applyHealthProfilePreset(preserved, 'balanced'), {
        ...preserved,
        profile: 'balanced',
        warnStoppedPercent: 60,
        criticalStoppedPercent: 90,
        updatesMode: 'maintenance',
        allStoppedMode: 'critical'
    });
    assert.deepEqual(settingsHealth.applyHealthProfilePreset(preserved, 'lenient'), {
        ...preserved,
        profile: 'lenient',
        warnStoppedPercent: 75,
        criticalStoppedPercent: 95,
        updatesMode: 'maintenance',
        allStoppedMode: 'warn'
    });
});

test('health summary visibility controls the current summary host and clears hidden cards', () => {
    const attributes = new Map();
    let clearCount = 0;
    const host = {
        hidden: false,
        setAttribute: (name, value) => attributes.set(name, value),
        replaceChildren: () => { clearCount += 1; }
    };

    assert.equal(settingsHealth.syncHealthSummaryVisibility(host, false), false);
    assert.equal(host.hidden, true);
    assert.equal(attributes.get('aria-hidden'), 'true');
    assert.equal(clearCount, 1);

    assert.equal(settingsHealth.syncHealthSummaryVisibility(host, true), true);
    assert.equal(host.hidden, false);
    assert.equal(attributes.get('aria-hidden'), 'false');
    assert.equal(clearCount, 1);
});

test('Docker health classification honors thresholds, update handling, and all-stopped mode', () => {
    const classify = (overrides = {}) => settingsHealth.classifyDockerFolderHealth({
        members: 10,
        started: 6,
        paused: 0,
        stopped: 4,
        updateCount: 0,
        policy: {
            warnThreshold: 60,
            criticalThreshold: 90,
            updatesMode: 'ignore',
            allStoppedMode: 'critical'
        },
        ...overrides
    });

    assert.equal(classify().severity, 'good');
    assert.equal(classify({ policy: { warnThreshold: 0, criticalThreshold: 90, updatesMode: 'ignore', allStoppedMode: 'critical' } }).severity, 'warn');
    assert.equal(classify({ policy: { warnThreshold: 40, criticalThreshold: 90, updatesMode: 'ignore', allStoppedMode: 'critical' } }).severity, 'warn');
    assert.equal(classify({ policy: { warnThreshold: 30, criticalThreshold: 40, updatesMode: 'ignore', allStoppedMode: 'critical' } }).severity, 'critical');

    const maintenance = classify({ stopped: 0, started: 10, updateCount: 1, policy: { warnThreshold: 60, criticalThreshold: 90, updatesMode: 'maintenance', allStoppedMode: 'critical' } });
    assert.equal(maintenance.severity, 'warn');
    assert.equal(maintenance.filterSeverity, 'maintenance');
    assert.equal(classify({ stopped: 0, started: 10, updateCount: 1, policy: { warnThreshold: 60, criticalThreshold: 90, updatesMode: 'warn', allStoppedMode: 'critical' } }).filterSeverity, 'warn');
    assert.equal(classify({ stopped: 0, started: 10, updateCount: 10, policy: { warnThreshold: 60, criticalThreshold: 90, updatesMode: 'warn', allStoppedMode: 'critical' } }).severity, 'critical');
    assert.equal(classify({ stopped: 0, started: 10, updateCount: 10, policy: { warnThreshold: 60, criticalThreshold: 90, updatesMode: 'ignore', allStoppedMode: 'critical' } }).severity, 'good');

    const allStoppedBase = { members: 4, started: 0, paused: 0, stopped: 4, updateCount: 0 };
    assert.equal(classify({ ...allStoppedBase, policy: { warnThreshold: 100, criticalThreshold: 100, updatesMode: 'ignore', allStoppedMode: 'critical' } }).severity, 'critical');
    assert.equal(classify({ ...allStoppedBase, policy: { warnThreshold: 100, criticalThreshold: 100, updatesMode: 'ignore', allStoppedMode: 'warn' } }).severity, 'warn');
});

test('retired compact health-card preference and misleading VM Docker policy controls stay removed', () => {
    const normalized = utils.normalizePrefs({ health: { compact: true } });
    assert.equal(Object.prototype.hasOwnProperty.call(normalized.health, 'compact'), false);
    assert.doesNotMatch(page, /health-compact|Compact card layout/);
    assert.doesNotMatch(settingsJs, /compact:\s*incoming\.compact/);
    assert.doesNotMatch(page, /id="vm-health-(?:warn-threshold|critical-threshold|profile|updates-mode|all-stopped-mode)"/);
    assert.match(page, /Health summary &amp; Docker scoring/);
    assert.match(page, /Health summary &amp; VM resources/);
});

test('VM resource threshold normalization preserves an ordered pair at maximum bounds', () => {
    const prefs = utils.normalizePrefs({
        health: {
            vmResourceWarnVcpus: 512,
            vmResourceCriticalVcpus: 512,
            vmResourceWarnGiB: 1024,
            vmResourceCriticalGiB: 1024
        }
    });

    assert.equal(prefs.health.vmResourceWarnVcpus, 511);
    assert.equal(prefs.health.vmResourceCriticalVcpus, 512);
    assert.equal(prefs.health.vmResourceWarnGiB, 1023);
    assert.equal(prefs.health.vmResourceCriticalGiB, 1024);
});

test('settings rerender summary cards and runtime pages apply badge preference broadcasts live', () => {
    assert.match(settingsJs, /syncHealthSummaryVisibility\(host, normalizeHealthPrefs\(resolvedType\)\.cardsEnabled === true\)/);
    assert.match(settingsJs, /Object\.assign\(nextHealth, applyHealthProfilePreset\(nextHealth, change\.value\)\)/);
    assert.match(dockerJs, /const applyRuntimePrefs = \(prefs\) => \{[\s\S]*renderRuntimeHealthBadge\(globalFolders, normalized\);[\s\S]*scheduleLiveRefresh\(normalized\);/);
    assert.match(vmJs, /const applyRuntimePrefs = \(prefs\) => \{[\s\S]*renderRuntimeHealthBadge\(globalFolders, normalized\);[\s\S]*scheduleLiveRefresh\(normalized\);/);
});
