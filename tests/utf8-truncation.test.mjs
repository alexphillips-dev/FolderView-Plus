import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { isUtf8 } from 'node:buffer';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const pluginRoot = path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus');
const quote = value => `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const require = createRequire(import.meta.url);
const utils = require(path.join(pluginRoot, 'scripts/folderviewplus.utils.js'));

const runPhp = (input, code, options = []) => {
    const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-utf8-'));
    for (const dir of ['config', 'source', 'document-root']) fs.mkdirSync(path.join(sandbox, dir));
    fs.writeFileSync(path.join(sandbox, 'input.json'), JSON.stringify(input));
    const script = `<?php
        require_once ${quote(path.join(pluginRoot, 'server/lib.php'))};
        $input = json_decode(file_get_contents(${quote(path.join(sandbox, 'input.json'))}), true, 512, JSON_THROW_ON_ERROR);
        ${code}
    `;
    const scriptPath = path.join(sandbox, 'probe.php');
    fs.writeFileSync(scriptPath, script);
    try {
        return JSON.parse(execFileSync('php', [...options, scriptPath], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, env: {
            ...process.env,
            FVPLUS_TEST_CONFIG_DIR: path.join(sandbox, 'config'),
            FVPLUS_TEST_SOURCE_DIR: path.join(sandbox, 'source'),
            FVPLUS_TEST_DOCUMENT_ROOT: path.join(sandbox, 'document-root')
        } }));
    } finally {
        fs.rmSync(sandbox, { recursive: true, force: true });
    }
};

// Independent oracle: accumulate complete Unicode code points within a byte budget.
const prefixWithinBytes = (value, limit) => {
    let prefix = '';
    let bytes = 0;
    for (const character of value) {
        bytes += Buffer.byteLength(character);
        if (bytes > limit) break;
        prefix += character;
    }
    return prefix;
};

test('UTF-8 byte limits preserve complete characters, ASCII parity and idempotence without mbstring', () => {
    const cases = [];
    for (const value of ['', 'ASCII', 'é', '界', '😀', 'e\u0301', 'aé界😀e\u0301z', '\0é😀']) {
        for (let limit = -1; limit <= Buffer.byteLength(value) + 1; limit++) cases.push({ value, limit });
    }
    for (const limit of [16, 32, 64, 96, 128, 160, 255, 256, 280, 512, 1024, 2048, 65536]) {
        for (const character of ['a', 'é', '界', '😀', '\u0301']) {
            cases.push({ value: 'a'.repeat(limit - 1) + character + 'z', limit });
            cases.push({ value: 'a'.repeat(limit - Buffer.byteLength(character)) + character, limit });
        }
    }
    const result = runPhp(cases, `
        $results = [];
        foreach ($input as $case) {
            $value = truncateUtf8String($case['value'], $case['limit']);
            $results[] = ['base64' => base64_encode($value), 'valid' => preg_match('//u', $value) === 1,
                'stable' => truncateUtf8String($value, $case['limit']) === $value,
                'json' => json_encode($value, JSON_THROW_ON_ERROR)];
        }
        echo json_encode(['mbstring' => extension_loaded('mbstring'), 'results' => $results], JSON_THROW_ON_ERROR);
    `, ['-n']);
    assert.equal(result.mbstring, false);
    result.results.forEach((actual, index) => {
        const { value, limit } = cases[index];
        const expected = limit <= 0 ? '' : prefixWithinBytes(value, limit);
        assert.equal(actual.base64, Buffer.from(expected).toString('base64'), `case ${index}: limit ${limit}`);
        assert.equal(actual.valid, true);
        assert.equal(actual.stable, true);
        assert.equal(JSON.parse(actual.json), expected);
        assert.ok(Buffer.byteLength(expected) <= Math.max(0, limit));
    });
});

test('already-invalid UTF-8 retains the existing byte-prefix and JSON rejection contract', () => {
    const invalid = [Buffer.from([0x80, 0x61]), Buffer.from([0xc0, 0xaf]), Buffer.from([0xed, 0xa0, 0x80]),
        Buffer.from([0xf4, 0x90, 0x80, 0x80]), Buffer.from([0xe2, 0x82]), Buffer.from([0x61, 0x80])];
    const cases = invalid.flatMap(value => [0, 1, 2, value.length, value.length + 1].map(limit => ({
        base64: value.toString('base64'), limit
    })));
    const result = runPhp(cases, `
        $results = [];
        foreach ($input as $case) {
            $value = truncateUtf8String(base64_decode($case['base64']), $case['limit']);
            $results[] = ['base64' => base64_encode($value), 'jsonRejected' => json_encode($value) === false];
        }
        echo json_encode($results, JSON_THROW_ON_ERROR);
    `);
    result.forEach((actual, index) => {
        const { base64, limit } = cases[index];
        const expected = Buffer.from(base64, 'base64').subarray(0, Math.max(0, limit));
        assert.equal(actual.base64, expected.toString('base64'));
        assert.equal(actual.jsonRejected, !isUtf8(expected));
    });
});

test('Docker and VM Unicode folder/preferences writes survive reload without byte or revision churn', () => {
    const namePrefix = '界😀'.repeat(22) + 'abcde';
    const name = namePrefix + 'é';
    const groupNamePrefix = '界'.repeat(21);
    const groupName = groupNamePrefix + '😀';
    const nestedKey = 'k'.repeat(63) + '😀';
    const result = runPhp({ name, groupName, nestedKey, text: 't'.repeat(2047) + '😀', regex: 'r'.repeat(1023) + '界',
        identity: 'i'.repeat(511) + 'é', uuid: 'u'.repeat(127) + '😀' }, `
        $results = [];
        foreach (['docker', 'vm'] as $type) {
            $identity = $type === 'docker' ? ['kind' => 'docker', 'image' => $input['identity']]
                : ['kind' => 'vm', 'uuid' => $input['uuid']];
            writeRawFolderMap($type, ['fixture' => ['name' => $input['name'], 'containers' => ['fixture-member'],
                'regex' => $input['regex'], 'memberIdentities' => ['fixture-member' => $identity],
                'settings' => [$input['nestedKey'] => $input['text']]]]);
            writeTypePrefs($type, ['backupSchedule' => ['enabled' => false],
                'folderDefaults' => ['sourceId' => 'fixture', 'sourceName' => $input['name'], 'profile' => ['settings' => []]],
                'importPresets' => ['custom' => [['id' => 'fixture-preset', 'name' => $input['groupName']]]],
                'folderGroups' => [['id' => 'custom:fixture', 'name' => $input['groupName'],
                    'folders' => [['name' => $input['name']]]]]]);
            $paths = [getFolderFilePath($type), getTypePrefsPath($type), getConfigMetadataPath($type)];
            $paths = array_merge($paths, array_map('getLastGoodJsonPath', $paths));
            $before = array_map('file_get_contents', $paths);
            $folders = readRawFolderMap($type);
            $prefs = readTypePrefs($type);
            $metadata = readConfigMetadata($type);
            readRawFolderMap($type); readTypePrefs($type); readConfigMetadata($type);
            $stable = $before === array_map('file_get_contents', $paths);
            $rejected = false;
            try { writeRawFolderMap($type, ['fixture' => ['name' => "bad\\x80"]]); }
            catch (RuntimeException $error) { $rejected = true; }
            $results[$type] = ['folders' => $folders, 'prefs' => $prefs, 'metadata' => $metadata, 'stable' => $stable,
                'rejected' => $rejected, 'unchangedAfterRejection' => $before === array_map('file_get_contents', $paths),
                'folderHash' => hash_file('sha256', getFolderFilePath($type)),
                'prefsHash' => hash_file('sha256', getTypePrefsPath($type))];
        }
        echo json_encode($results, JSON_THROW_ON_ERROR);
    `);
    for (const type of ['docker', 'vm']) {
        const actual = result[type];
        const folder = actual.folders.fixture;
        assert.equal(folder.name, namePrefix);
        assert.equal(folder.regex, 'r'.repeat(1023));
        assert.equal(folder.settings['k'.repeat(63)], 't'.repeat(2047));
        assert.equal(folder.memberIdentities['fixture-member'][type === 'docker' ? 'image' : 'uuid'],
            (type === 'docker' ? 'i'.repeat(511) : 'u'.repeat(127)));
        assert.equal(actual.prefs.folderDefaults.sourceName, folder.name);
        assert.equal(actual.prefs.importPresets.custom[0].name, groupNamePrefix);
        assert.equal(actual.prefs.folderGroups[0].name, groupNamePrefix);
        assert.equal(actual.prefs.folderGroups[0].folders[0].name, folder.name);
        assert.equal(actual.stable, true);
        assert.equal(actual.rejected, true);
        assert.equal(actual.unchangedAfterRejection, true);
        assert.equal(actual.metadata.folderSha256, actual.folderHash);
        assert.equal(actual.metadata.prefsSha256, actual.prefsHash);
        const exported = utils.buildFullExportPayload({ type, folders: actual.folders, pluginVersion: 'fixture' });
        const imported = utils.parseImportPayload(JSON.parse(JSON.stringify(exported)), type);
        assert.equal(imported.ok, true);
        assert.equal(imported.folders.fixture.name, folder.name);
        const browserPrefs = utils.normalizePrefs(JSON.parse(JSON.stringify(actual.prefs)));
        assert.equal(browserPrefs.folderDefaults.sourceName, folder.name);
    }
});

test('theme Unicode metadata and CSS preserve byte ceilings through persistence and generated assets', () => {
    const rule = '.fixture::before { content: "界😀"; }';
    const cssPrefix = rule + ' '.repeat(65535 - Buffer.byteLength(rule));
    const css = cssPrefix + '界';
    const result = runPhp({ css }, `
        $workspace = defaultThemeWorkspace();
        $workspace['profiles'][0]['name'] = str_repeat('p', 95) . '😀';
        $workspace['profiles'][0]['layers']['global']['customCss'] = $input['css'];
        $workspace['themes'] = [['id' => 'fixture-theme', 'name' => str_repeat('n', 159) . 'é',
            'source' => ['path' => str_repeat('s', 511) . '界'],
            'files' => [['path' => 'fixture.docker.css', 'name' => str_repeat('f', 159) . '😀',
                'content' => '.fixture { opacity: .9; }', 'tabs' => ['docker']]]]];
        $workspace['activeThemeId'] = 'fixture-theme';
        writeThemeWorkspace($workspace);
        $paths = [getThemeWorkspacePath(), getLastGoodJsonPath(getThemeWorkspacePath()),
            fvplusThemeWorkspaceGeneratedCssPath('docker')];
        $before = array_map('file_get_contents', $paths);
        $saved = readThemeWorkspace(); readThemeWorkspace();
        echo json_encode(['workspace' => $saved, 'stable' => $before === array_map('file_get_contents', $paths),
            'asset' => file_get_contents(fvplusThemeWorkspaceGeneratedCssPath('docker'))], JSON_THROW_ON_ERROR);
    `);
    assert.equal(result.workspace.profiles[0].name, 'p'.repeat(95));
    assert.equal(result.workspace.profiles[0].layers.global.customCss, cssPrefix);
    assert.equal(result.workspace.themes[0].name, 'n'.repeat(159));
    assert.equal(result.workspace.themes[0].source.path, 's'.repeat(511));
    assert.equal(result.workspace.themes[0].files[0].name, 'f'.repeat(159));
    assert.match(result.asset, /\.fixture \{ opacity: \.9; \}/);
    assert.ok(result.asset.includes(rule));
    assert.ok(!result.asset.includes('\ufffd'));
    assert.equal(result.stable, true);
});
