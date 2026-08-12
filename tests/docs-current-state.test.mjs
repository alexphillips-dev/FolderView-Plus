import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const state = JSON.parse(read('docs/current-state.json'));
const readme = read('README.md');
const edgeCases = read('docs/edge-cases-test-matrix.md');
const docsIndex = read('docs/README.md');
const userGuide = read('docs/USER_GUIDE.md');
const installationGuide = read('docs/INSTALLATION_AND_UPGRADES.md');
const privacyGuide = read('docs/PRIVACY.md');
const compatibilityGuide = read('docs/COMPATIBILITY.md');
const contributingGuide = read('.github/CONTRIBUTING.md');
const securityPolicy = read('.github/SECURITY.md');
const settingsPage = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/FolderViewPlus.page');
const settingsSections = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.settings-sections.js');
const runtimeSharedPrimitives = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/runtime.shared-primitives.js');
const dockerRuntime = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js');
const dockerActionBar = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.action-bar.js');
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
        assert.match(runtimeSharedPrimitives, new RegExp(`['"]${profile.id}['"]`));
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

test('public guide registry keeps every user guide discoverable from both indexes', () => {
    for (const guide of state.documentationContracts.publicGuides) {
        assert.ok(fs.existsSync(path.join(root, guide.path)), `${guide.path} should exist`);
        assert.ok(readme.includes(`[${guide.label}](${guide.path})`), `${guide.label} should be linked from README`);
        const relativePath = path.relative('docs', guide.path).split(path.sep).join('/');
        assert.ok(docsIndex.includes(`[${path.basename(guide.path)}](${relativePath})`), `${guide.path} should be indexed`);
    }
    for (const docPath of state.documentationContracts.requiredArchitectureDocs) {
        assert.ok(fs.existsSync(path.join(root, docPath)), `${docPath} should exist`);
        assert.ok(docsIndex.includes(`(${path.relative('docs', docPath).split(path.sep).join('/')})`));
    }
});

test('branch, platform, and uninstall guidance match the repository contract', () => {
    assert.ok(contributingGuide.includes(`branch from \`${state.branchModel.contributionBase}\``));
    assert.ok(contributingGuide.includes(`target \`${state.branchModel.development}\``));
    assert.ok(securityPolicy.includes(`\`${state.branchModel.stable}\` tracks the latest stable release`));
    assert.ok(securityPolicy.includes(`\`${state.branchModel.development}\` contains active development builds`));
    assert.ok(readme.includes(state.platform.minimumUnraidVersion));
    assert.ok(compatibilityGuide.includes(state.platform.minimumUnraidVersion));
    assert.ok(readme.includes('deletes `/boot/config/plugins/folderview.plus`'));
    assert.ok(installationGuide.includes('deletes `/boot/config/plugins/folderview.plus`'));
});

test('user and privacy guides track runtime-owned option registries', () => {
    const viewBlock = dockerActionBar.match(/const VIEW_OPTIONS\s*=\s*Object\.freeze\(\[([\s\S]*?)\]\);/);
    assert.ok(viewBlock);
    const runtimeViews = Array.from(viewBlock[1].matchAll(/value:\s*'([^']+)',\s*label:\s*'([^']+)'/g), (match) => ({
        id: match[1],
        label: match[2]
    }));
    assert.deepEqual(runtimeViews, state.featureNames.dockerRuntimeViews);
    for (const view of runtimeViews) assert.ok(userGuide.includes(`**${view.label}**`));

    const privacyBlock = dockerRuntime.match(/const DOCKER_RUNTIME_PRIVACY_OPTION_DEFINITIONS\s*=\s*Object\.freeze\(\[([\s\S]*?)\]\);/);
    assert.ok(privacyBlock);
    const runtimeOptions = Array.from(privacyBlock[1].matchAll(/key:\s*'([^']+)',\s*label:\s*'([^']+)'/g), (match) => ({
        key: match[1],
        label: match[2]
    }));
    assert.deepEqual(runtimeOptions, state.featureNames.dockerPrivacyOptions);
    for (const option of runtimeOptions) assert.ok(privacyGuide.includes(`| ${option.label} |`));
});

test('GitHub-facing documentation has no broken relative file links', () => {
    const files = [
        'README.md',
        'asset-packs/README.md',
        ...fs.readdirSync(path.join(root, 'docs'))
            .filter((name) => name.endsWith('.md'))
            .map((name) => `docs/${name}`),
        '.github/CONTRIBUTING.md',
        '.github/SECURITY.md',
        '.github/SUPPORT.md',
        '.github/pull_request_template.md'
    ];
    for (const relativePath of files) {
        const source = read(relativePath);
        for (const match of source.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
            const destination = match[1].trim();
            if (!destination || /^(?:https?:|mailto:|#)/i.test(destination)) continue;
            const filePart = decodeURIComponent(destination.split('#', 1)[0]);
            const resolved = path.resolve(root, path.dirname(relativePath), filePart);
            assert.ok(fs.existsSync(resolved), `${relativePath} links to missing ${destination}`);
        }
    }
});
