import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const pluginRoot = path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus');
const serverRoot = path.join(pluginRoot, 'server');
const endpointSource = fs.readFileSync(path.join(serverRoot, 'environment_snapshot.php'), 'utf8');
const pageSource = fs.readFileSync(path.join(pluginRoot, 'FolderViewPlus.page'), 'utf8');
const phpString = (value) => `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

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
    custom_styles: { 'custom.css': '.folder { opacity: .99; }' },
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
    assert.doesNotMatch(endpointSource, /\$mutatingActions\s*=\s*\[[^\]]*folderview3/);
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
    assert.throws(() => runPhpPlan({ ...fixture, fv3_export_version: 2 }), /Command failed/);
    const { plan, report } = runPhpPlan({
        ...fixture,
        css_config: { custom_css: '@import url(https://example.invalid/theme.css);' }
    });
    const importedProfile = plan.target.themeWorkspace.profiles.find((entry) => entry.id === report.summary.appearanceProfileId);
    assert.ok(importedProfile);
    assert.doesNotMatch(importedProfile.layers.global.customCss, /@import|example\.invalid/);
    assert.match(importedProfile.layers.global.customCss, /FolderView3 custom style: custom\.css/);
    assert.ok(report.warnings.some((warning) => warning.includes('Unsafe FolderView3 global custom CSS')));
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
    const code = `require_once ${phpString(path.join(serverRoot, 'lib.php'))}; echo json_encode(detectFolderView3Installation());`;
    try {
        const result = JSON.parse(execFileSync('php', ['-r', code], {
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
        assert.equal(result.available, true);
        assert.equal(result.canPreview, true);
        assert.equal(result.dockerFolderCount, 1);
        assert.equal(result.vmFolderCount, 1);
        assert.equal(result.pluginVersion, '2026.08.01');
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});
