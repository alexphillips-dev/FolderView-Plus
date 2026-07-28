import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const plgPath = path.join(repoRoot, 'folderview.plus.plg');
const pkgBuildPath = path.join(repoRoot, 'pkg_build.sh');
const buildScriptPath = path.join(repoRoot, 'scripts/build_icon_asset_pack.sh');
const guardScriptPath = path.join(repoRoot, 'scripts/icon_asset_pack_guard.sh');
const releaseGuardPath = path.join(repoRoot, 'scripts/release_guard.sh');
const installerPath = path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/install_icon_asset_pack.sh');
const endpointPath = path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/third_party_icons.php');
const diagnosticsPath = path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.diagnostics.php');

const plg = fs.readFileSync(plgPath, 'utf8');
const pkgBuild = fs.readFileSync(pkgBuildPath, 'utf8');
const buildScript = fs.readFileSync(buildScriptPath, 'utf8');
const guardScript = fs.readFileSync(guardScriptPath, 'utf8');
const releaseGuard = fs.readFileSync(releaseGuardPath, 'utf8');
const installer = fs.readFileSync(installerPath, 'utf8');
const endpoint = fs.readFileSync(endpointPath, 'utf8');
const diagnostics = fs.readFileSync(diagnosticsPath, 'utf8');
const iconSourceRoot = path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/images/third-party-icons');
const supportedIconPattern = /\.(?:png|jpe?g|gif|webp|svg|bmp|ico|avif)$/i;

const countSourceIcons = (directory) => fs.readdirSync(directory, { withFileTypes: true })
    .reduce((count, entry) => {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) return count + countSourceIcons(entryPath);
        return count + (entry.isFile() && supportedIconPattern.test(entry.name) ? 1 : 0);
    }, 0);

const entity = (name) => {
    const match = plg.match(new RegExp(`<!ENTITY ${name} "([^"]+)">`));
    return match ? match[1] : '';
};
const version = entity('iconPackVersion');
const md5 = entity('iconPackMd5');
const sha256 = entity('iconPackSha256');
const archivePath = path.join(repoRoot, 'asset-packs', `folderview.plus-icons-${version}.txz`);

const toBashPath = (value) => {
    const normalized = path.resolve(value).replace(/\\/g, '/');
    const match = normalized.match(/^([A-Za-z]):\/(.*)$/);
    return match ? `/mnt/${match[1].toLowerCase()}/${match[2]}` : normalized;
};
const installerInvocation = (pluginDir, configDir, cacheDir, checksum) => {
    const environment = {
        FVPLUS_PLUGIN_DIR: toBashPath(pluginDir),
        FVPLUS_CONFIG_DIR: toBashPath(configDir),
        FVPLUS_ICON_PACK_CACHE_BASE: toBashPath(cacheDir),
        FVPLUS_ICON_PACK_ARCHIVE: toBashPath(archivePath)
    };
    const script = toBashPath(installerPath);
    if (process.platform === 'win32') {
        return {
            command: 'wsl.exe',
            args: [
                '--exec',
                'env',
                ...Object.entries(environment).map(([key, value]) => `${key}=${value}`),
                '/bin/bash',
                script,
                version,
                checksum
            ],
            env: process.env
        };
    }
    return {
        command: 'bash',
        args: [script, version, checksum],
        env: { ...process.env, ...environment }
    };
};
const runInstaller = (pluginDir, configDir, cacheDir, checksum, useSpawn = false) => {
    const invocation = installerInvocation(pluginDir, configDir, cacheDir, checksum);
    const options = { cwd: repoRoot, encoding: 'utf8', timeout: 120000, env: invocation.env };
    return useSpawn
        ? spawnSync(invocation.command, invocation.args, options)
        : execFileSync(invocation.command, invocation.args, options);
};
const assertSymbolicLink = (targetPath) => {
    const resolved = toBashPath(targetPath);
    if (process.platform === 'win32') {
        execFileSync('wsl.exe', ['--exec', 'test', '-L', resolved], { cwd: repoRoot, encoding: 'utf8' });
        return;
    }
    execFileSync('test', ['-L', resolved], { cwd: repoRoot, encoding: 'utf8' });
};

test('manifest pins a content-addressed versioned icon asset pack', () => {
    assert.match(version, /^\d+\.\d+\.\d+$/);
    assert.match(md5, /^[a-f0-9]{32}$/);
    assert.match(sha256, /^[a-f0-9]{64}$/);
    assert.equal(fs.existsSync(archivePath), true);
    const archive = fs.readFileSync(archivePath);
    assert.equal(crypto.createHash('md5').update(archive).digest('hex'), md5);
    assert.equal(crypto.createHash('sha256').update(archive).digest('hex'), sha256);
    assert.match(plg, /<FILE Name="\/boot\/config\/plugins\/&name;\/folderview\.plus-icons-&iconPackVersion;\.txz">/);
    assert.match(plg, /<URL>&iconPackURL;<\/URL>/);
    assert.match(plg, /<MD5>&iconPackMd5;<\/MD5>/);
});

test('icon content hashing is deterministic across Linux and Windows Git Bash', () => {
    assert.match(buildScript, /sha256sum --text "\$\{icon_file\}"/);
    assert.match(guardScript, /sha256sum --text "\$\{icon_file\}"/);
});

test('manifest resolves and requires the installed asset-pack activation helper', () => {
    const pluginDir = entity('plugdir').replace('&name;', entity('name'));
    const activationPath = `${pluginDir}/scripts/install_icon_asset_pack.sh`;
    assert.equal(activationPath, '/usr/local/emhttp/plugins/folderview.plus/scripts/install_icon_asset_pack.sh');
    assert.match(plg, /<INLINE>\s*set -e/);
    assert.match(plg, /\/bin\/bash "&plugdir;\/scripts\/install_icon_asset_pack\.sh"/);
    assert.doesNotMatch(plg, /&plugdir;scripts\/install_icon_asset_pack\.sh/);
    assert.match(plg, /FVPLUS_ICON_PACK_STATUS_FILE="\$\{icon_status\}"/);
    assert.match(plg, /\/bin\/bash "\$\{install_report\}" complete/);
});

test('asset pack contains only its manifest and supported runtime icons', () => {
    const entries = execFileSync('tar', ['-tf', archivePath], { encoding: 'utf8' })
        .split(/\r?\n/)
        .filter(Boolean);
    assert.ok(entries.includes('asset-pack.json'));
    assert.ok(entries.some((entry) => entry.startsWith('third-party-icons/')));
    const invalid = entries.filter((entry) => {
        if (entry === 'asset-pack.json' || entry === 'third-party-icons' || entry.endsWith('/')) return false;
        return !/^third-party-icons\/.*\.(?:png|jpe?g|gif|webp|svg|bmp|ico|avif)$/i.test(entry);
    });
    assert.deepEqual(invalid, []);
    const embedded = JSON.parse(execFileSync('tar', ['-xOf', archivePath, 'asset-pack.json'], { encoding: 'utf8' }));
    assert.equal(embedded.id, 'folderview.plus-icons');
    assert.equal(embedded.version, version);
    assert.equal(embedded.fileCount, countSourceIcons(iconSourceRoot));
    assert.match(embedded.contentSha256, /^[a-f0-9]{64}$/);
});

test('core packaging excludes icon files and carries asset identity metadata', () => {
    assert.match(pkgBuild, /images\/third-party-icons\/\*\)\s*return 1/);
    assert.match(pkgBuild, /"iconAssetPackVersion": "\$\{build_icon_pack_version\}"/);
    assert.match(pkgBuild, /"iconAssetPackSha256": "\$\{build_icon_pack_sha256\}"/);
    assert.match(pkgBuild, /rewrite_manifest_branch_metadata[\s\S]*iconPackURL/);
    assert.match(buildScript, /--sort=name/);
    assert.match(buildScript, /--mtime='UTC 1970-01-01'/);
    assert.match(guardScript, /Icon source changed without rebuilding or versioning the asset pack/);
    assert.match(releaseGuard, /grep -Fvx 'usr\/local\/emhttp\/plugins\/folderview\.plus\/scripts\/install_icon_asset_pack\.sh'/);
    assert.doesNotMatch(releaseGuard, /ALLOWED_ARCHIVE_EXTENSIONS='[^']*\bsh\b/);
    assert.match(pkgBuild, /FVPLUS_ICON_ASSET_PACK_GUARDED=1 FVPLUS_ARCHIVE_DIR/);
    assert.match(releaseGuard, /FVPLUS_ICON_ASSET_PACK_GUARDED:-0/);
});

test('installer verifies, stages, activates, reuses, and links the pack', () => {
    assert.match(installer, /sha256sum "\$\{ICON_PACK_ARCHIVE\}"/);
    assert.match(installer, /ICON_PACK_STAGE=/);
    assert.match(installer, /ICON_PACK_PREVIOUS=/);
    assert.match(installer, /\.folderview-plus-asset-pack/);
    assert.match(installer, /ln -s "\$\{ICON_PACK_CACHE_ROOT\}\/third-party-icons"/);
    assert.match(installer, /mv -Tf "\$\{RUNTIME_LINK_STAGE\}"/);
    assert.match(installer, /write_status "\$\{ICON_PACK_INSTALL_STATE\}"/);

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-icon-pack-install-'));
    const pluginDir = path.join(tempDir, 'plugin');
    const configDir = path.join(tempDir, 'config');
    const cacheDir = path.join(tempDir, 'cache');
    fs.mkdirSync(path.join(pluginDir, 'images'), { recursive: true });
    fs.mkdirSync(configDir, { recursive: true });
    try {
        runInstaller(pluginDir, configDir, cacheDir, sha256);
        const markerPath = path.join(cacheDir, `icons-${version}`, '.folderview-plus-asset-pack');
        assert.equal(fs.readFileSync(markerPath, 'utf8').trim(), `${version}:${sha256}`);
        assert.equal(fs.existsSync(path.join(pluginDir, 'icon-asset-pack.json')), true);
        assertSymbolicLink(path.join(pluginDir, 'images', 'third-party-icons'));

        const sentinel = path.join(cacheDir, `icons-${version}`, 'reuse-sentinel');
        fs.writeFileSync(sentinel, 'keep', 'utf8');
        runInstaller(pluginDir, configDir, cacheDir, sha256);
        assert.equal(fs.readFileSync(sentinel, 'utf8'), 'keep', 'a valid cached pack must be reused without extraction');
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});

test('installer rejects a bad checksum before creating an active cache', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-icon-pack-reject-'));
    const pluginDir = path.join(tempDir, 'plugin');
    const configDir = path.join(tempDir, 'config');
    const cacheDir = path.join(tempDir, 'cache');
    fs.mkdirSync(path.join(pluginDir, 'images'), { recursive: true });
    fs.mkdirSync(configDir, { recursive: true });
    try {
        const result = runInstaller(pluginDir, configDir, cacheDir, '0'.repeat(64), true);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /checksum verification failed/);
        assert.equal(fs.existsSync(path.join(cacheDir, `icons-${version}`)), false);
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});

test('runtime and support diagnostics expose asset-pack identity', () => {
    assert.match(endpoint, /function thirdPartyIconAssetPackStatus\(\): array/);
    assert.match(endpoint, /'assetPack' => thirdPartyIconAssetPackStatus\(\)/);
    assert.match(diagnostics, /'iconAssetPackVersion'/);
    assert.match(diagnostics, /'iconAssetPackSha256'/);
    assert.match(diagnostics, /'iconAssetPackUrl'/);
});
