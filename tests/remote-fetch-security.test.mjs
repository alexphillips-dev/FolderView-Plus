import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const remoteLib = path.join(
    process.cwd(),
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.remote.php'
);

const runPhp = (code) => spawnSync('php', ['-r', code], { encoding: 'utf8' });

test('bounded remote fetch rejects non-HTTPS, nonstandard-port, and non-allowlisted endpoints before I/O', () => {
    for (const url of [
        'http://github.com/example/theme.css',
        'https://github.com:444/private-service',
        'https://127.0.0.1/theme.css',
        'file:///etc/passwd'
    ]) {
        const result = runPhp(
            `require ${JSON.stringify(remoteLib)}; echo json_encode(fvplusFetchRemoteTextBounded(${JSON.stringify(url)}, ['github.com'], 32));`
        );
        assert.equal(result.status, 0, result.stderr);
        const payload = JSON.parse(result.stdout);
        assert.equal(payload.ok, false);
        assert.match(payload.error, /allowed HTTPS endpoint/);
    }
});

test('redirect resolver preserves HTTPS origin rules and rejects unsupported bases', () => {
    const result = runPhp(
        `require ${JSON.stringify(remoteLib)}; echo json_encode([fvplusResolveRedirectUrl('https://github.com/a/b', '/c'), fvplusResolveRedirectUrl('http://github.com/a/b', '/c')]);`
    );
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), ['https://github.com/c', '']);
});
