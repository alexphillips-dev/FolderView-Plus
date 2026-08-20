import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const pluginRoot = path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus');
const serverRoot = path.join(pluginRoot, 'server');
const architecture = JSON.parse(fs.readFileSync(path.join(pluginRoot, 'schemas/architecture-contracts.schema.json'), 'utf8'));
const manifestPath = path.join(serverRoot, 'api-endpoints.json');
const manifestSource = fs.readFileSync(manifestPath, 'utf8');
const coreFacade = fs.readFileSync(path.join(serverRoot, 'lib.php'), 'utf8');
const diagnosticsFacade = fs.readFileSync(path.join(serverRoot, 'lib.diagnostics.php'), 'utf8');
const iconEndpoint = fs.readFileSync(path.join(serverRoot, 'upload_custom_icon.php'), 'utf8');

const phpString = (value) => `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

test('Phase 6 preserves the complete public endpoint manifest', () => {
    const expectedEndpoints = [
        'apply_folder_settings.php', 'backup.php', 'batch.php', 'bulk_assign.php', 'bulk_folder_action.php',
        'cpu.php', 'create.php', 'delete.php', 'diagnostics.php', 'docker_start_order.php',
        'environment_snapshot.php', 'migrate_legacy_regex.php', 'prefs.php', 'read.php', 'read_info.php',
        'read_order.php', 'read_unraid_order.php', 'reconcile_member_identities.php', 'reorder.php',
        'runtime_snapshot.php', 'security.php', 'sync_order.php', 'templates.php', 'theme_workspace.php',
        'third_party_icons.php', 'update.php', 'update_check.php', 'update_notes.php', 'upload_custom_icon.php',
        'version.php'
    ].sort();
    const publicEndpoints = fs.readdirSync(serverRoot)
        .filter((name) => name.endsWith('.php') && !name.startsWith('lib.'))
        .sort();
    assert.deepEqual(publicEndpoints, expectedEndpoints);
    assert.deepEqual(Object.keys(JSON.parse(manifestSource).endpoints).sort(), expectedEndpoints);
    assert.equal(
        crypto.createHash('sha256').update(manifestSource).digest('hex'),
        'f1d94e849a07d0f5bbceab16dd3b053550f101f77dff2f1953c1e9c6a29049e3'
    );
});

test('facades load every contracted PHP module without retaining extracted implementations', () => {
    assert.equal(architecture.serverModuleContracts.length, 29);
    for (const contract of architecture.serverModuleContracts) {
        const loader = contract.loadedBy === 'server/lib.php'
            ? coreFacade
            : contract.loadedBy === 'server/lib.diagnostics.php'
                ? diagnosticsFacade
                : iconEndpoint;
        assert.match(loader, new RegExp(contract.file.replace('server/', '').replaceAll('.', '\\.')));
    }
    assert.doesNotMatch(coreFacade, /function (?:readInstalledVersion|writeDurableFileAtomic|getThemeWorkspacePath|createBackupSnapshot|bulkAssignItemsToFolders|syncContainerOrder|updateFolder|fvplusCustomIconDirPath|readInfo)\s*\(/);
    assert.doesNotMatch(diagnosticsFacade, /function (?:diagnosticsHashShort|diagnosticsBuildIntegrityChecks|diagnosticsBuildOverviewSummary|getSupportBundleV2Snapshot)\s*\(/);
    assert.doesNotMatch(iconEndpoint, /^function\s+[A-Za-z_][A-Za-z0-9_]*\s*\(/m);
});

test('decomposition preserves every historical public PHP function name', () => {
    const expected = {
        'server/lib.php': { count: 332, sha256: '3402a8afdb4a90878b5a5cc26284075606051f35819e2859df9bc23a2b8612c3' },
        'server/lib.diagnostics.php': { count: 74, sha256: 'a1d008eb74affc973be697a63837347f992ff932591d6aa630b2a4d022a24b1a' },
        'server/upload_custom_icon.php': { count: 56, sha256: '825b3fbb5288c76f83a4976a55967e8a9a205e5496581f3a0c842789083f530e' }
    };
    for (const [facade, baseline] of Object.entries(expected)) {
        const graphFiles = [
            facade,
            ...architecture.serverModuleContracts
                .filter((contract) => contract.loadedBy === facade)
                .map((contract) => contract.file)
        ];
        const functions = graphFiles.flatMap((file) => {
            const source = fs.readFileSync(path.join(pluginRoot, file), 'utf8');
            return [...source.matchAll(/^\s*function\s+([A-Za-z_][A-Za-z0-9_]*)/gm)].map((match) => match[1]);
        }).sort();
        assert.equal(functions.length, baseline.count, `${facade} public function count changed`);
        assert.equal(
            crypto.createHash('sha256').update(functions.join('\n')).digest('hex'),
            baseline.sha256,
            `${facade} public function names changed`
        );
    }
});

test('requiring the compatibility facade publishes representative functions from every domain', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-phase6-'));
    const documentRoot = path.join(tempDir, 'document-root');
    const configDir = path.join(tempDir, 'config');
    const sourceDir = path.join(tempDir, 'runtime');
    fs.mkdirSync(documentRoot, { recursive: true });
    fs.mkdirSync(configDir, { recursive: true });
    fs.mkdirSync(sourceDir, { recursive: true });
    const functions = [
        'readInstalledVersion', 'writeDurableFileAtomic', 'getThemeWorkspacePath',
        'normalizeEnvironmentSnapshotPayload', 'scanThemeWorkspaceGithub', 'getTypeBackupSchedule',
        'createBackupSnapshot', 'bulkAssignItemsToFolders', 'syncContainerOrder', 'updateFolder',
        'fvplusCustomIconDirPath', 'readInfo', 'diagnosticsHashShort', 'diagnosticsBuildIntegrityChecks',
        'diagnosticsBuildOverviewSummary', 'getSupportBundleV2Snapshot'
    ];
    const body = `require_once ${phpString(path.join(serverRoot, 'lib.php'))}; echo json_encode(array_map('function_exists', ${JSON.stringify(functions)}));`;
    try {
        const output = execFileSync('php', ['-r', body], {
            cwd: repoRoot,
            encoding: 'utf8',
            env: {
                ...process.env,
                FVPLUS_TEST_CONFIG_DIR: configDir,
                FVPLUS_TEST_SOURCE_DIR: sourceDir,
                FVPLUS_TEST_DOCUMENT_ROOT: documentRoot
            }
        });
        assert.deepEqual(JSON.parse(output), functions.map(() => true));
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});

test('the custom icon public endpoint remains a thin compatibility dispatcher', () => {
    assert.match(iconEndpoint, /\$action = strtolower\(trim\(\(string\)\(\$_REQUEST\['action'\] \?\? 'upload'\)\)\);/);
    assert.match(iconEndpoint, /if \(\$action === 'list'\)/);
    assert.match(iconEndpoint, /if \(\$action === 'stats'\)/);
    assert.match(iconEndpoint, /if \(\$action === 'usage'\)/);
    assert.match(iconEndpoint, /if \(\$action === 'delete'\) \{\s*requireMutationRequestGuard\(\);/);
    assert.match(iconEndpoint, /if \(\$action === 'rename'\) \{\s*requireMutationRequestGuard\(\);/);
    assert.match(iconEndpoint, /if \(\$action === 'upload' \|\| \$action === ''\) \{\s*requireMutationRequestGuard\(\);/);
    assert.match(iconEndpoint, /throw new RuntimeException\('Unsupported action\.'\);/);
    assert.match(iconEndpoint, /\$GLOBALS\['fvplus_custom_icon_response_sent'\] = true;/);
});
