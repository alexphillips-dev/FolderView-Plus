import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const server = path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server');
const endpoint = path.join(server, 'docker_runtime_preview.php').replaceAll('\\', '/');
const id = 'a'.repeat(64);
const imageId = `sha256:${'b'.repeat(64)}`;
const token = 'fixture-runtime-preview-token';
const sensitive = 'SYNTHETIC_VALUE_DO_NOT_EXPOSE';
const pref = privacyMode => ({ runtimePrefsSchema: 3, dashboard: { privacyMode } });

const dockerFixture = `<?php
echo $GLOBALS['fixture']['sdkOutput'] ?? '';
$GLOBALS['dockerCalls'][] = ['bootstrap'];
class DockerClient {
    public function getContainerDetails($id) {
        $GLOBALS['dockerCalls'][] = ['container', $id];
        return $GLOBALS['fixture']['container'];
    }
    public function getDockerJSON($uri) {
        $GLOBALS['dockerCalls'][] = ['image', $uri];
        echo $GLOBALS['fixture']['sdkOutput'] ?? '';
        if (!empty($GLOBALS['fixture']['togglePrivacy'])) {
            file_put_contents(getTypePrefsPath('docker'), json_encode($GLOBALS['fixture']['togglePrivacy']));
        }
        if (!empty($GLOBALS['fixture']['imageError'])) throw new RuntimeException($GLOBALS['fixture']['imageError']);
        return $GLOBALS['fixture']['image'];
    }
}`;

const inspect = ({
    Id: id,
    Image: imageId,
    Name: '/private-container',
    Mounts: [{ Source: '/boot/host-only-path' }],
    NetworkSettings: { IPAddress: '192.0.2.77' },
    Config: {
        Labels: {
            'com.docker.compose.project': 'fixture-project',
            'com.docker.compose.service': 'fixture.service',
            'com.docker.compose.project.working_dir': '/mnt/private-compose'
        },
        Env: [
            `TOKEN=${sensitive}=1`, 'SAME=Original', 'ADDED=container-only', 'EMPTY=', 'DUP=one', 'DUP=two',
            'BAD NAME=malformed', '/mnt/private=malformed', 'NOVALUE', 'CASE=lower', 'IMAGE_DUP=one'
        ]
    },
    HostConfig: { RestartPolicy: { Name: 'on-failure', MaximumRetryCount: 3 }, NetworkMode: `container:${id}` }
});

const image = ({
    Id: imageId,
    Config: { Env: [
        'TOKEN=image-default', 'SAME=Original', 'EMPTY=nonempty', 'DUP=two', 'CASE=LOWER', 'IMAGE_ONLY=hidden',
        'IMAGE_DUP=image one', 'IMAGE_DUP=image two'
    ] }
});

function runPreview(overrides = {}) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-runtime-preview-'));
    const host = path.join(root, 'host');
    const config = path.join(root, 'config');
    const source = path.join(root, 'source');
    const dockerManager = path.join(host, 'plugins/dynamix.docker.manager/include');
    fs.mkdirSync(dockerManager, { recursive: true });
    fs.mkdirSync(config);
    fs.mkdirSync(source);
    fs.writeFileSync(path.join(dockerManager, 'DockerClient.php'), dockerFixture);
    fs.writeFileSync(path.join(config, 'request.token'), `${token}\n`, { mode: 0o640 });
    const base = {
        method: 'GET', surface: 'docker', marker: '1', token, id, referer: 'https://unraid.test/Docker',
        container: inspect, image, ...overrides
    };
    if (base.prefs !== undefined) fs.writeFileSync(path.join(config, 'docker.prefs.json'), base.prefs);
    if (base.lastGood !== undefined) {
        fs.writeFileSync(path.join(config, 'docker.prefs.json.lastgood'), base.lastGood);
    }
    const files = dir => fs.readdirSync(dir).map(name => ({
        name, mode: fs.statSync(path.join(dir, name)).mode,
        text: fs.statSync(path.join(dir, name)).isFile() ? fs.readFileSync(path.join(dir, name), 'utf8') : null
    }));
    const before = [files(config), files(source)];
    try {
        const output = execFileSync('php', ['-r', `
            $GLOBALS['fixture'] = json_decode(stream_get_contents(STDIN), true);
            $GLOBALS['dockerCalls'] = [];
            $_SERVER = array_merge($_SERVER, [
                'SCRIPT_FILENAME' => ${JSON.stringify(endpoint)},
                'DOCUMENT_ROOT' => getenv('FVPLUS_TEST_DOCUMENT_ROOT'),
                'REQUEST_METHOD' => $fixture['method'],
                'HTTPS' => 'on',
                'HTTP_HOST' => 'unraid.test',
                'HTTP_REFERER' => $fixture['referer'],
                'HTTP_X_FV_REQUEST' => $fixture['marker'],
                'HTTP_X_FV_TOKEN' => $fixture['token'],
                'HTTP_X_FV_CONTAINER' => $fixture['id'],
                'HTTP_X_FV_SURFACE' => $fixture['surface']
            ]);
            ob_start();
            require ${JSON.stringify(endpoint)};
            $payload = ob_get_clean();
            echo json_encode([http_response_code(), json_decode($payload, true), $GLOBALS['dockerCalls']]);
        `], {
            input: JSON.stringify(base), encoding: 'utf8',
            env: { ...process.env, FVPLUS_TEST_CONFIG_DIR: config, FVPLUS_TEST_SOURCE_DIR: source, FVPLUS_TEST_DOCUMENT_ROOT: host }
        });
        if (!base.togglePrivacy) assert.deepEqual([files(config), files(source)], before);
        return JSON.parse(output);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
}

test('Runtime preview GET projects named fields and compares image defaults without values', () => {
    const [status, payload, calls] = runPreview({ sdkOutput: sensitive });
    assert.equal(status, 200);
    assert.deepEqual(calls, [['bootstrap'], ['container', id], ['image', `/images/${imageId}/json`]]);
    assert.deepEqual(payload.summary, {
        composeProject: 'fixture-project',
        composeService: 'fixture.service',
        restartPolicy: 'on-failure',
        networkMode: 'container',
        environment: [
            ['ADDED', false], ['CASE', true], ['DUP', null], ['EMPTY', true], ['IMAGE_DUP', null],
            ['NOVALUE', null], ['SAME', false], ['TOKEN', true]
        ].map(([name, overridden]) => ({ name, overridden }))
    });
    for (const value of [sensitive, id, imageId, 'private-container', '/mnt', '192.0.2.77', 'Original', 'IMAGE_ONLY']) {
        assert.ok(!JSON.stringify(payload).includes(value), value);
    }
});

test('Runtime preview supports missing image data, strict identity and safe aliases', () => {
    const [status, payload, calls] = runPreview({
        surface: 'dashboard',
        referer: 'https://unraid.test/Dashboard',
        imageError: sensitive,
        container: {
            ...inspect,
            Config: { ...inspect.Config, Labels: { 'com.docker.compose.project': '/mnt/private', 'com.docker.compose.service': 'good' } },
            HostConfig: { NetworkMode: 'some-private-name', RestartPolicy: { Name: `bad-${sensitive}` } }
        }
    });
    assert.equal(status, 200);
    assert.equal(payload.summary.networkMode, 'custom');
    assert.equal(payload.summary.restartPolicy, null);
    assert.equal(payload.summary.composeProject, null);
    assert.equal(payload.summary.composeService, 'good');
    assert.ok(payload.summary.environment.every(row => row.overridden === null));
    assert.ok(!JSON.stringify(payload).includes(sensitive));
    assert.deepEqual(calls, [['bootstrap'], ['container', id], ['image', `/images/${imageId}/json`]]);

    const [missing, missingPayload, missingCalls] = runPreview({ container: { ...inspect, Id: 'f'.repeat(64) } });
    assert.equal(missing, 404);
    assert.equal(missingPayload.summary, undefined);
    assert.deepEqual(missingCalls, [['bootstrap'], ['container', id]]);
});

test('Runtime preview rejects untrusted, malformed and private requests before loading Docker', () => {
    const cases = [
        [{ method: 'POST' }, 405],
        [{ token: 'wrong-token' }, 403],
        [{ marker: '' }, 403],
        [{ referer: 'https://wrong.test/Docker' }, 403],
        [{ surface: 'vm' }, 403],
        [{ id: id.slice(0, 12) }, 400],
        [{ id: 'a-name' }, 400],
        [{ id: `${id}/json` }, 400],
        [{ prefs: JSON.stringify(pref(true)) }, 403],
        [{ surface: 'dashboard', prefs: JSON.stringify(pref(true)) }, 403],
        [{ prefs: '{corrupt' }, 403],
        [{ prefs: '{corrupt', lastGood: JSON.stringify(pref(true)) }, 403]
    ];
    for (const [input, expected] of cases) {
        const [status, payload, calls] = runPreview(input);
        assert.equal(status, expected, JSON.stringify(input));
        assert.equal(payload.summary, undefined);
        assert.deepEqual(calls, []);
    }
    const [status, payload] = runPreview({ togglePrivacy: pref(true) });
    assert.equal(status, 403);
    assert.equal(payload.summary, undefined);
});
