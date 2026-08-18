import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const repoRoot = path.resolve(process.cwd());
const releaseNotesLib = path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.release-notes.php');
const updateChannelLib = path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.update-channel.php');
const phpQuote = (value) => `'${String(value).replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;

const resolveChannel = (manifest = '') => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-update-channel-'));
    const configDir = path.join(tempDir, 'config');
    const sourceDir = path.join(tempDir, 'source');
    fs.mkdirSync(configDir, { recursive: true });
    fs.mkdirSync(sourceDir, { recursive: true });
    if (manifest) {
        fs.writeFileSync(path.join(configDir, 'folderview.plus.plg'), manifest, 'utf8');
    }
    const php = [
        `$configDir = ${phpQuote(configDir)};`,
        `$sourceDir = ${phpQuote(sourceDir)};`,
        `require_once(${phpQuote(releaseNotesLib)});`,
        `require_once(${phpQuote(updateChannelLib)});`,
        `echo json_encode(['channel' => resolveInstalledPluginChannel(), 'url' => resolveInstalledPluginUpdateManifestUrl()], JSON_UNESCAPED_SLASHES);`
    ].join('');
    try {
        return JSON.parse(execFileSync('php', ['-r', php], { encoding: 'utf8' }));
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
};

test('update checks follow the installed dev manifest channel', () => {
    const resolved = resolveChannel('<!ENTITY pluginURL "https://raw.githubusercontent.com/&github;/dev/folderview.plus.plg">');
    assert.deepEqual(resolved, {
        channel: 'dev',
        url: 'https://raw.githubusercontent.com/alexphillips-dev/FolderView-Plus/dev/folderview.plus.plg'
    });
});

test('update checks follow the installed stable manifest channel', () => {
    const resolved = resolveChannel('<PluginURL>https://raw.githubusercontent.com/alexphillips-dev/FolderView-Plus/main/folderview.plus.plg</PluginURL>');
    assert.deepEqual(resolved, {
        channel: 'main',
        url: 'https://raw.githubusercontent.com/alexphillips-dev/FolderView-Plus/main/folderview.plus.plg'
    });
});

test('update checks fail closed to stable for missing or unrecognized manifests', () => {
    for (const manifest of ['', '<!ENTITY pluginURL "https://example.invalid/feature/folderview.plus.plg">']) {
        assert.deepEqual(resolveChannel(manifest), {
            channel: 'main',
            url: 'https://raw.githubusercontent.com/alexphillips-dev/FolderView-Plus/main/folderview.plus.plg'
        });
    }
});
