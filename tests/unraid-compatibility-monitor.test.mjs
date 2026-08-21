import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
    buildCompatibilityReport,
    evaluateCompatibility,
    gitBlobSha,
    scanReleaseNotes
} from '../scripts/unraid_compatibility_monitor.mjs';

const makeFixture = () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-unraid-monitor-'));
    const releaseNotesDir = path.join(root, 'release-notes');
    const webguiDir = path.join(root, 'webgui');
    const caStarterDir = path.join(root, 'ca-starter');
    fs.mkdirSync(releaseNotesDir, { recursive: true });
    fs.mkdirSync(webguiDir, { recursive: true });
    fs.mkdirSync(caStarterDir, { recursive: true });

    const stableSource = '# Version 7.3.2 2026-07-08\n\n* php: version 8.4.21 -> 8.4.23\n';
    const prereleaseSource = '# Version 7.4.0-beta.1 2026-08-14\n\n* php: version 8.4.23 -> 8.4.24\n';
    fs.writeFileSync(path.join(releaseNotesDir, '7.3.2.md'), stableSource);
    fs.writeFileSync(path.join(releaseNotesDir, '7.4.0.md'), prereleaseSource);
    fs.writeFileSync(path.join(webguiDir, 'DockerContainers.page'), 'docker host contract\n');
    fs.writeFileSync(path.join(caStarterDir, 'example-plugin.xml'), '<Plugin><PluginURL>example</PluginURL></Plugin>\n');

    const baseline = {
        unraidOs: {
            latestReviewedStable: {
                version: '7.3.2',
                releaseNoteBlobSha: gitBlobSha(Buffer.from(stableSource)),
                phpVersion: '8.4.23'
            },
            latestReviewedPrerelease: {
                version: '7.4.0-beta.1',
                releaseNoteBlobSha: gitBlobSha(Buffer.from(prereleaseSource)),
                phpVersion: '8.4.24'
            }
        },
        webgui: {
            files: {
                'DockerContainers.page': gitBlobSha(Buffer.from('docker host contract\n'))
            }
        },
        communityApplications: {
            files: {
                'example-plugin.xml': gitBlobSha(Buffer.from('<Plugin><PluginURL>example</PluginURL></Plugin>\n'))
            }
        }
    };
    const evaluate = () => evaluateCompatibility({
        baseline,
        releaseNotesDir,
        webguiDir,
        caStarterDir,
        dockerResult: { status: 'dormant', reason: 'upstream-shouldApply-false', latestApiRelease: 'v4.37.2', sourceGate: 'false' },
        caResult: { status: 'matched', reason: 'canonical-published-listing-matches' }
    });
    return { root, releaseNotesDir, webguiDir, caStarterDir, baseline, evaluate };
};

test('general compatibility monitor accepts reviewed stable, prerelease, webGUI, API, and CA contracts', (t) => {
    const fixture = makeFixture();
    t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
    const result = fixture.evaluate();
    assert.equal(result.status, 'matched');
    assert.equal(result.reason, 'all-reviewed-baselines-match');
    assert.equal(result.releases.stable.version, '7.3.2');
    assert.equal(result.releases.prerelease.version, '7.4.0-beta.1');
    assert.equal(result.releases.prerelease.phpVersion, '8.4.24');
    assert.match(buildCompatibilityReport(result), /All official upstream inputs match/);
});

test('general compatibility monitor detects new releases and relevant webGUI drift', (t) => {
    const fixture = makeFixture();
    t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
    fs.writeFileSync(path.join(fixture.releaseNotesDir, '7.3.3.md'), '# Version 7.3.3 2026-08-21\n\n* php: version 8.4.25\n');
    fs.writeFileSync(path.join(fixture.webguiDir, 'DockerContainers.page'), 'changed contract\n');
    const result = fixture.evaluate();
    assert.equal(result.status, 'review');
    assert.ok(result.reviewSignals.some((signal) => signal.reason === 'new-stable-release'));
    assert.ok(result.reviewSignals.some((signal) => signal.reason === 'upstream-file-changed'));
});

test('general compatibility monitor fails closed when a tracked upstream file is unavailable', (t) => {
    const fixture = makeFixture();
    t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
    fs.rmSync(path.join(fixture.caStarterDir, 'example-plugin.xml'));
    const result = fixture.evaluate();
    assert.equal(result.status, 'unknown');
    assert.equal(result.reason, 'upstream-file-missing');
});

test('release scanner keeps stable and prerelease channels separate', (t) => {
    const fixture = makeFixture();
    t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
    fs.writeFileSync(path.join(fixture.releaseNotesDir, '7.5.0.md'), '# Version 7.5.0-rc.2 2026-09-01\n');
    const result = scanReleaseNotes(fixture.releaseNotesDir);
    assert.equal(result.stable.version, '7.3.2');
    assert.equal(result.prerelease.version, '7.5.0-rc.2');
});

test('reviewed webGUI baseline covers plugin installation and update contracts', () => {
    const baseline = JSON.parse(fs.readFileSync(new URL('../docs/unraid-compatibility-baseline.json', import.meta.url), 'utf8'));
    const files = Object.keys(baseline.webgui.files || {});
    const pluginManagerFiles = files.filter((file) => file.startsWith('emhttp/plugins/dynamix.plugin.manager/'));
    assert.ok(pluginManagerFiles.length >= 15);
    for (const required of [
        'emhttp/plugins/dynamix.plugin.manager/PluginInstall.page',
        'emhttp/plugins/dynamix.plugin.manager/Plugins.page',
        'emhttp/plugins/dynamix.plugin.manager/include/Downgrade.php',
        'emhttp/plugins/dynamix.plugin.manager/pre-hooks/pre_plugin_checks',
        'emhttp/plugins/dynamix.plugin.manager/post-hooks/post_plugin_checks',
        'emhttp/plugins/dynamix.plugin.manager/scripts/PluginAPI.php',
        'emhttp/plugins/dynamix.plugin.manager/scripts/plugin',
        'emhttp/plugins/dynamix.plugin.manager/scripts/plugincheck'
    ]) {
        assert.match(baseline.webgui.files[required] || '', /^[0-9a-f]{40}$/, `${required} must have a reviewed Git blob SHA`);
    }
});
