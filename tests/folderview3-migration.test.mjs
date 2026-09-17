import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const pluginRoot = path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus');
const serverRoot = path.join(pluginRoot, 'server');
const endpointSource = fs.readFileSync(path.join(serverRoot, 'environment_snapshot.php'), 'utf8');
const pageSource = fs.readFileSync(path.join(pluginRoot, 'FolderViewPlus.page'), 'utf8');
const phpString = (value) => `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const browserModulePath = path.join(pluginRoot, 'scripts/folderviewplus.folderview3-migration.js');
const applyModulePath = path.join(pluginRoot, 'scripts/folderviewplus.folderview3-apply.js');

const fixture = {
    fv3_export_version: 1,
    plugin_version: '2026.08.01',
    unraid_version: '7.2.0',
    exported: '2026-08-10T12:00:00Z',
    docker: {
        dockerFolder: {
            name: 'Media',
            icon: '/tmp/media.png',
            containers: ['plex'],
            containerIds: ['abc123'],
            containerImages: ['plexinc/pms-docker'],
            regex: '^arr-',
            settings: { preview_hover: true }
        }
    },
    vm: {
        vmFolder: {
            name: 'Lab',
            containers: ['test-vm'],
            regex: '^lab-'
        }
    },
    settings: {
        dashboard_docker_layout: 'fullwidth',
        dashboard_vm_layout: 'accordion',
        dashboard_docker_greyscale: 'yes',
        default_preview: '2',
        default_preview_hover: 'yes'
    },
    autostart: { mode: 'custom', sequence: ['plex', 'arr-one'] },
    css_config: {
        global: { 'fv3-accent-color': '#f97316' },
        docker: { 'fv3-preview-icon-size': '40px' },
        custom_css_dashboard: '.folder { border-radius: 4px; }'
    },
    custom_styles: { 'custom.docker.css': '.folder { opacity: .99; }' },
    organizer_registry: { folders: ['Native Apps'] },
    native_autostart: ['plex 15', 'arr-one']
};

const runPhpPlan = (bundle) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-fv3-migration-'));
    const configDir = path.join(tempDir, 'config');
    const sourceDir = path.join(tempDir, 'source');
    const documentRoot = path.join(tempDir, 'document-root');
    const bundlePath = path.join(tempDir, 'bundle.json');
    fs.mkdirSync(configDir, { recursive: true });
    fs.mkdirSync(sourceDir, { recursive: true });
    fs.mkdirSync(documentRoot, { recursive: true });
    fs.writeFileSync(bundlePath, JSON.stringify(bundle));
    const code = [
        `require_once ${phpString(path.join(serverRoot, 'lib.php'))};`,
        `$bundle = decodeFolderView3BundlePayloadString(file_get_contents(${phpString(bundlePath)}));`,
        `$plan = buildFolderView3MigrationPlan($bundle, 'fixture.json');`,
        `echo json_encode(['plan' => $plan, 'report' => folderView3MigrationReport($plan)], JSON_UNESCAPED_SLASHES);`
    ].join(' ');
    try {
        return JSON.parse(execFileSync('php', ['-r', code], {
            cwd: repoRoot,
            encoding: 'utf8',
            env: {
                ...process.env,
                FVPLUS_TEST_CONFIG_DIR: configDir,
                FVPLUS_TEST_SOURCE_DIR: sourceDir,
                FVPLUS_TEST_DOCUMENT_ROOT: documentRoot
            }
        }));
    } catch (error) {
        throw new Error(String(error?.stderr || error?.message || error));
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
};

test('FolderView3 preview actions remain read-only endpoint contracts', () => {
    assert.match(endpointSource, /if \(\$action === 'detect_folderview3'\)/);
    assert.match(endpointSource, /if \(\$action === 'preview_folderview3'\)/);
    assert.match(endpointSource, /\$mutatingActions\s*=\s*\['apply', 'apply_folderview3'\]/);
    assert.match(pageSource, /data-fv-folderview3-action="detect"/);
    assert.match(pageSource, /data-fv-folderview3-action="preview-export"/);
});

test('FolderView3 conversion preserves folders, rules, defaults, start order, and inactive appearance', () => {
    const { plan, report } = runPhpPlan(fixture);
    assert.equal(plan.target.types.docker.folders.dockerFolder.name, 'Media');
    assert.equal(plan.target.types.docker.folders.dockerFolder.regex, '');
    assert.equal(plan.target.types.docker.folders.dockerFolder.memberIdentities.plex.containerId, 'abc123');
    assert.equal(plan.target.types.docker.prefs.autoRules.length, 1);
    assert.equal(plan.target.types.docker.prefs.autoRules[0].pattern, '^arr-');
    assert.equal(plan.target.types.vm.prefs.autoRules[0].pattern, '^lab-');
    assert.equal(plan.target.types.docker.prefs.dashboard.layout, 'fullwidth');
    assert.equal(plan.target.types.vm.prefs.dashboard.layout, 'accordion');
    assert.equal(plan.target.types.docker.prefs.folderDefaults.profile.settings.preview, 2);
    assert.equal(plan.target.types.docker.prefs.dockerStartOrder.mode, 'custom-batches');
    assert.deepEqual(
        plan.target.types.docker.prefs.dockerStartOrder.batches[0].items.map((entry) => entry.name),
        ['plex', 'arr-one']
    );
    assert.equal(report.summary.appearanceProfileActive, false);
    assert.equal(report.summary.nativeAutostartCount, 2);
    assert.equal(report.summary.organizerRegistryCount, 1);
    assert.equal(report.operations.find((entry) => entry.id === 'native-autostart').selected, false);
    assert.equal(report.operations.find((entry) => entry.id === 'organizer-registry').selected, false);
    assert.equal(Object.hasOwn(report, 'target'), false, 'downloadable report must not expose migrated names or raw target config');
});

test('FolderView3 conversion rejects unsupported exports and severe custom CSS', () => {
    assert.throws(
        () => runPhpPlan({ ...fixture, fv3_export_version: 2 }),
        /Unsupported FolderView3 export version|Command failed/
    );
    const { plan, report } = runPhpPlan({
        ...fixture,
        css_config: { custom_css: '@import url(https://example.invalid/theme.css);' }
    });
    const importedProfile = plan.target.themeWorkspace.profiles.find((entry) => entry.id === report.summary.appearanceProfileId);
    assert.ok(importedProfile);
    assert.doesNotMatch(importedProfile.layers.global.customCss, /@import|example\.invalid/);
    assert.match(importedProfile.layers.docker.customCss, /FolderView3 custom style: custom\.docker\.css/);
    assert.ok(report.warnings.some((warning) => warning.includes('Unsafe FolderView3 global custom CSS')));
});

test('FolderView3 migration preserves Docker and VM snapshots and includes order in source identity', () => {
    const bundle = {
        ...fixture,
        docker: { first: { name: 'First' }, second: { name: 'Second' }, added: { name: 'Added' } },
        vm: { first: { name: 'First VM' }, second: { name: 'Second VM' } },
        order_docker: { fv3_order_version: 1, entries: ['folder-second', 'outside', 'folder-first', 'folder-second', 'folder-missing'] },
        order_vm: { fv3_order_version: 1, entries: ['folder-second', 'folder-first'] }
    };
    const { plan, report } = runPhpPlan(bundle);
    assert.deepEqual(plan.target.types.docker.prefs.manualOrder, ['second', 'first', 'added']);
    assert.deepEqual(Object.keys(plan.target.types.docker.folders), ['second', 'first', 'added']);
    assert.deepEqual(plan.target.types.vm.prefs.manualOrder, ['second', 'first']);
    assert.equal(report.summary.dockerOrderStatus, 'imported');
    assert.ok(report.warnings.some((message) => message.includes('unassigned items')));
    assert.ok(report.warnings.some((message) => message.includes('Duplicate')));
    assert.ok(report.warnings.some((message) => message.includes('Unknown folder references')));
    assert.doesNotMatch(JSON.stringify(report.warnings), /outside|folder-missing/);
    const changed = runPhpPlan({ ...bundle, order_vm: { fv3_order_version: 1, entries: ['folder-first', 'folder-second'] } });
    assert.notEqual(changed.report.source.digest, report.source.digest);
});

test('FolderView3 missing, empty, and malformed snapshots preserve safe fallback order', () => {
    const invalid = [
        { fv3_order_version: 2, entries: ['folder-dockerFolder'] },
        { fv3_order_version: 1, entries: [] },
        { fv3_order_version: 1, entries: ['folder-dockerFolder', 'bad\nentry'] },
        { fv3_order_version: 1, entries: { 1: 'folder-dockerFolder' } },
        { fv3_order_version: 1, entries: Array(4097).fill('folder-dockerFolder') },
        'invalid'
    ];
    for (const snapshot of invalid) {
        const { plan, report } = runPhpPlan({ ...fixture, order_docker: snapshot });
        assert.deepEqual(plan.target.types.docker.prefs.manualOrder, ['dockerFolder']);
        assert.equal(report.summary.dockerOrderStatus, 'invalid');
        assert.ok(report.warnings.some((message) => message.includes('order snapshot is invalid')));
    }
    assert.equal(runPhpPlan(fixture).report.summary.dockerOrderStatus, 'missing');
    assert.equal(runPhpPlan({ ...fixture, order_docker: [] }).report.summary.dockerOrderStatus, 'empty');
});

test('FolderView3 CSS retains page scopes and separates disabled themes without exposing source metadata', () => {
    const { plan, report } = runPhpPlan({
        ...fixture,
        css_config: {},
        custom_styles: {
            'active/theme.docker.css': '.docker-only { color: red; }',
            'active/shared.docker.vm.css': '.shared { color: green; }',
            'asleep.Disabled/theme.dashboard.css': '.disabled-only { color: blue; }',
            'unscoped.css': '.unscoped { color: pink; }',
            '_fv3-generated.docker.css': '.generated { color: orange; }',
            'active/.fv3-source': '{"repo":"https://example.invalid/private-theme"}'
        }
    });
    const imported = plan.target.themeWorkspace.profiles.find((profile) => profile.id === report.summary.appearanceProfileId);
    const disabled = plan.target.themeWorkspace.profiles.find((profile) => profile.name === 'FolderView3 disabled appearance 1');
    assert.match(imported.layers.docker.customCss, /docker-only|shared/);
    assert.match(imported.layers.vm.customCss, /shared/);
    assert.doesNotMatch(imported.layers.vm.customCss, /docker-only/);
    assert.equal(imported.layers.global.customCss, '');
    assert.equal(imported.layers.dashboard.customCss, '');
    assert.match(disabled.layers.dashboard.customCss, /disabled-only/);
    assert.doesNotMatch(JSON.stringify(imported), /disabled-only|unscoped|generated|private-theme/);
    assert.notEqual(plan.target.themeWorkspace.activeProfileId, disabled.id);
    assert.equal(report.summary.appearanceProfileActive, false);
    assert.equal(report.summary.appearanceProfileCount, 2);
    assert.equal(report.summary.disabledAppearanceProfileCount, 1);
    assert.ok(report.warnings.some((message) => message.includes('recognized FolderView3 page scope')));
    assert.ok(report.warnings.some((message) => message.includes('source metadata')));
    assert.doesNotMatch(JSON.stringify(report), /private-theme|docker-only|disabled-only/);
});

test('installed FolderView3 discovery uses the bounded test configuration root', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-fv3-detect-'));
    const configDir = path.join(tempDir, 'plus');
    const fv3Dir = path.join(tempDir, 'folder.view3');
    fs.mkdirSync(configDir, { recursive: true });
    fs.mkdirSync(fv3Dir, { recursive: true });
    fs.writeFileSync(path.join(fv3Dir, 'version'), '2026.08.01');
    fs.writeFileSync(path.join(fv3Dir, 'docker.json'), JSON.stringify(fixture.docker));
    fs.writeFileSync(path.join(fv3Dir, 'vm.json'), JSON.stringify(fixture.vm));
    fs.writeFileSync(path.join(fv3Dir, 'order-docker.json'), JSON.stringify({ fv3_order_version: 1, entries: ['folder-dockerFolder'] }));
    fs.writeFileSync(path.join(fv3Dir, 'order-vm.json'), JSON.stringify({ fv3_order_version: 1, entries: ['folder-vmFolder'] }));
    const code = `require_once ${phpString(path.join(serverRoot, 'lib.php'))}; echo json_encode(['detection' => detectFolderView3Installation(), 'plan' => previewFolderView3Migration(fvplusFolderView3ReadInstalledBundle())]);`;
    try {
        const response = JSON.parse(execFileSync('php', ['-r', code], {
            cwd: repoRoot,
            encoding: 'utf8',
            env: {
                ...process.env,
                FVPLUS_TEST_CONFIG_DIR: configDir,
                FVPLUS_TEST_SOURCE_DIR: path.join(tempDir, 'source'),
                FVPLUS_TEST_DOCUMENT_ROOT: path.join(tempDir, 'document-root'),
                FVPLUS_TEST_FOLDER_VIEW3_CONFIG_DIR: fv3Dir
            }
        }));
        const result = response.detection;
        assert.equal(result.available, true);
        assert.equal(result.canPreview, true);
        assert.equal(result.dockerFolderCount, 1);
        assert.equal(result.vmFolderCount, 1);
        assert.equal(result.pluginVersion, '2026.08.01');
        assert.ok(result.components.includes('order-docker.json'));
        assert.ok(result.components.includes('order-vm.json'));
        assert.equal(response.plan.summary.dockerOrderStatus, 'imported');
        assert.equal(response.plan.summary.vmOrderStatus, 'imported');
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});

test('FolderView3 browser apply requires confirmation, reuses the preview digest, and defaults native autostart off', async () => {
    const require = createRequire(import.meta.url);
    delete require.cache[require.resolve(browserModulePath)];
    const moduleApi = require(browserModulePath);
    const applyModule = require(applyModulePath);
    const host = { innerHTML: '' };
    const posts = [];
    const report = {
        kind: 'folderview3_migration_plan',
        source: { kind: 'installed', digest: 'a'.repeat(64) },
        summary: { dockerFolderCount: 1, vmFolderCount: 1, nativeAutostartCount: 2 },
        operations: [{ id: 'native-autostart', label: 'Native autostart', selected: false, count: 2 }],
        warnings: []
    };
    const document = {
        querySelector: (selector) => selector === '#fv-recovery-folderview3-summary' ? host : null,
        contains: () => true
    };
    const api = moduleApi.createApi({
        window: { document, confirm: () => true, FolderViewPlusRequest: {} },
        document,
        applyModule,
        apiPostJson: async (_url, payload) => {
            posts.push(payload);
            return payload.action === 'preview_folderview3'
                ? { report }
                : { migration: { report, transaction: { verified: true } } };
        }
    });
    await api.previewInstalled();
    const result = await api.applyMigration();
    assert.equal(result.transaction.verified, true);
    assert.equal(posts.length, 2);
    assert.equal(posts[1].action, 'apply_folderview3');
    assert.equal(posts[1].expectedDigest, 'a'.repeat(64));
    assert.equal(posts[1].includeNativeAutostart, '0');
    assert.match(host.innerHTML, /Applied and verified/);
});
