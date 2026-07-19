import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const state = JSON.parse(read('docs/current-state.json'));
const readme = read('README.md');
const edgeCases = read('docs/edge-cases-test-matrix.md');
const settingsPage = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/FolderViewPlus.page');
const settingsSections = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.settings-sections.js');
const runtimeShared = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.shared.js');
const docsGuard = read('scripts/docs_metadata_guard.sh');

test('current-state metadata records the retired saved indicator and current action surface', () => {
    assert.equal(state.schemaVersion, 1);
    assert.equal(state.settingsPersistence.visibleSavedIndicator, false);
    assert.match(readme, new RegExp(state.settingsPersistence.readmeStatement.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.doesNotMatch(readme, /saved indicator/i);

    const actionSurface = state.featureNames.folderActionSurface;
    assert.equal(actionSurface.label, 'folder action sheet');
    assert.doesNotMatch(edgeCases, /quick-actions modal/i);
    const mentions = edgeCases.toLowerCase().split(actionSurface.label.toLowerCase()).length - 1;
    assert.ok(mentions >= actionSurface.edgeCaseMinimumMentions);
});

test('performance profile metadata matches Settings, runtime, and architecture docs', () => {
    const expected = state.performanceProfiles.map(({ id, uiLabel }) => ({ id, label: uiLabel }));
    const optionsFor = (type) => {
        const select = settingsPage.match(new RegExp(`<select id="${type}-performance-profile"[\\s\\S]*?<\\/select>`));
        assert.ok(select, `${type} performance profile select should exist`);
        return Array.from(select[0].matchAll(/<option value="([^"]+)">([^<]+)<\/option>/g), (match) => ({
            id: match[1],
            label: match[2].trim()
        }));
    };
    assert.deepEqual(optionsFor('docker'), expected);
    assert.deepEqual(optionsFor('vm'), expected);
    for (const profile of state.performanceProfiles) {
        assert.match(runtimeShared, new RegExp(`['"]${profile.id}['"]`));
        for (const docPath of state.documentationContracts.performanceArchitectureDocs) {
            const source = read(docPath);
            assert.ok(source.includes(`**${profile.name}**`), `${docPath} should describe ${profile.name}`);
            assert.doesNotMatch(source, /strict performance profile/i);
        }
    }
});

test('Advanced workspace names come from one current-state registry and match runtime labels', () => {
    const block = settingsSections.match(/const ADVANCED_GROUP_LABELS\s*=\s*\{([\s\S]*?)\};/);
    assert.ok(block);
    const runtimeLabels = Array.from(block[1].matchAll(/([a-z][a-z0-9_-]*)\s*:\s*'([^']+)'/g), (match) => ({
        id: match[1],
        label: match[2]
    }));
    assert.deepEqual(runtimeLabels, state.featureNames.advancedWorkspaces);
    for (const workspace of runtimeLabels) {
        assert.ok(readme.includes(`| ${workspace.label} |`));
    }
});

test('documentation guard consumes behavior metadata and rejects retired terminology', () => {
    assert.match(docsGuard, /docs\/current-state\.json/);
    assert.match(docsGuard, /visibleSavedIndicator/);
    assert.match(docsGuard, /performance profiles do not match the runtime resolver/);
    assert.match(docsGuard, /still uses retired current-state terminology/);
});

