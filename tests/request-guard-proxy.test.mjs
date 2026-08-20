import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const libPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.php'
);

const phpSingleQuote = (value) => `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

const evaluateRequest = (server) => {
    const sandboxRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-request-guard-'));
    const configDir = path.join(sandboxRoot, 'config');
    const sourceDir = path.join(sandboxRoot, 'source');
    fs.mkdirSync(configDir, { recursive: true });
    fs.mkdirSync(sourceDir, { recursive: true });
    const encodedServer = Buffer.from(JSON.stringify(server), 'utf8').toString('base64');
    const php = `
$_SERVER = json_decode(base64_decode(${phpSingleQuote(encodedServer)}), true);
require_once ${phpSingleQuote(libPath)};
echo json_encode([
    'trusted' => isTrustedMutationContext(),
    'diagnostics' => getMutationRequestSecurityDiagnostics()
], JSON_UNESCAPED_SLASHES);
`;
    try {
        const output = execFileSync('php', ['-r', php], {
            cwd: repoRoot,
            encoding: 'utf8',
            env: {
                ...process.env,
                FVPLUS_TEST_CONFIG_DIR: configDir,
                FVPLUS_TEST_SOURCE_DIR: sourceDir
            }
        });
        return JSON.parse(output);
    } finally {
        fs.rmSync(sandboxRoot, { recursive: true, force: true });
    }
};

const standardProxyHeaders = {
    HTTP_HOST: 'unraid.example.test',
    HTTPS: 'off',
    SERVER_PORT: '80',
    HTTP_X_FORWARDED_HOST: 'unraid.example.test',
    HTTP_X_FORWARDED_PROTO: 'https',
    HTTP_X_FORWARDED_PORT: '443',
    HTTP_ORIGIN: 'https://unraid.example.test',
    HTTP_REFERER: 'https://unraid.example.test/Settings/FolderViewPlus'
};

test('direct HTTP and HTTPS request authorities remain trusted', () => {
    const httpResult = evaluateRequest({
        HTTP_HOST: 'tower.local',
        HTTPS: 'off',
        SERVER_PORT: '80',
        HTTP_ORIGIN: 'http://tower.local',
        HTTP_REFERER: 'http://tower.local/Docker'
    });
    assert.equal(httpResult.trusted, true);
    assert.equal(httpResult.diagnostics.authoritySource, 'direct');
    assert.equal(httpResult.diagnostics.forwardedAuthorityStatus, 'absent');

    const httpsResult = evaluateRequest({
        HTTP_HOST: 'tower.local:8443',
        HTTPS: 'on',
        SERVER_PORT: '8443',
        HTTP_ORIGIN: 'https://tower.local:8443'
    });
    assert.equal(httpsResult.trusted, true);
    assert.equal(httpsResult.diagnostics.originStatus, 'direct');
});

test('a coherent standard reverse-proxy authority is trusted', () => {
    const result = evaluateRequest(standardProxyHeaders);
    assert.equal(result.trusted, true);
    assert.deepEqual(result.diagnostics, {
        schemaVersion: 1,
        enforcementMode: 'strict',
        trustedContext: true,
        authoritySource: 'forwarded',
        forwardedAuthorityStatus: 'valid',
        originStatus: 'forwarded',
        refererStatus: 'forwarded'
    });
});

test('a coherent forwarded authority supports nonstandard ports and IPv6', () => {
    const nonstandardPort = evaluateRequest({
        ...standardProxyHeaders,
        HTTP_X_FORWARDED_PORT: '4443',
        HTTP_ORIGIN: 'https://unraid.example.test:4443',
        HTTP_REFERER: 'https://unraid.example.test:4443/Docker'
    });
    assert.equal(nonstandardPort.trusted, true);
    assert.equal(nonstandardPort.diagnostics.forwardedAuthorityStatus, 'valid');

    const ipv6 = evaluateRequest({
        HTTP_HOST: '[fd00::10]',
        HTTPS: 'off',
        SERVER_PORT: '80',
        HTTP_X_FORWARDED_HOST: '[fd00::10]',
        HTTP_X_FORWARDED_PROTO: 'https',
        HTTP_X_FORWARDED_PORT: '4443',
        HTTP_ORIGIN: 'https://[fd00::10]:4443',
        HTTP_REFERER: 'https://[fd00::10]:4443/Docker'
    });
    assert.equal(ipv6.trusted, true);
    assert.equal(ipv6.diagnostics.authoritySource, 'forwarded');
});

test('forwarded authority fails closed for spoofed, partial, repeated, and conflicting headers', () => {
    const cases = [
        {
            expectedStatus: 'host-mismatch',
            server: { ...standardProxyHeaders, HTTP_X_FORWARDED_HOST: 'attacker.example.test' }
        },
        {
            expectedStatus: 'partial',
            server: { ...standardProxyHeaders, HTTP_X_FORWARDED_PORT: '' }
        },
        {
            expectedStatus: 'invalid',
            server: { ...standardProxyHeaders, HTTP_X_FORWARDED_HOST: 'unraid.example.test, attacker.example.test' }
        },
        {
            expectedStatus: 'port-mismatch',
            server: { ...standardProxyHeaders, HTTP_X_FORWARDED_HOST: 'unraid.example.test:4443' }
        },
        {
            expectedStatus: 'invalid-proto',
            server: { ...standardProxyHeaders, HTTP_X_FORWARDED_PROTO: 'javascript' }
        },
        {
            expectedStatus: 'invalid-port',
            server: { ...standardProxyHeaders, HTTP_X_FORWARDED_PORT: '70000' }
        }
    ];

    for (const fixture of cases) {
        const result = evaluateRequest(fixture.server);
        assert.equal(result.trusted, false, fixture.expectedStatus);
        assert.equal(result.diagnostics.forwardedAuthorityStatus, fixture.expectedStatus);
        assert.equal(result.diagnostics.trustedContext, false);
    }
});

test('Origin and Referer must each agree with a trusted authority', () => {
    const result = evaluateRequest({
        ...standardProxyHeaders,
        HTTP_REFERER: 'https://attacker.example.test/Docker'
    });
    assert.equal(result.trusted, false);
    assert.equal(result.diagnostics.originStatus, 'forwarded');
    assert.equal(result.diagnostics.refererStatus, 'mismatch');

    const nullOrigin = evaluateRequest({
        ...standardProxyHeaders,
        HTTP_ORIGIN: 'null',
        HTTP_REFERER: ''
    });
    assert.equal(nullOrigin.trusted, false);
    assert.equal(nullOrigin.diagnostics.originStatus, 'invalid');
});

test('request security diagnostics expose reason codes without authority values', () => {
    const result = evaluateRequest(standardProxyHeaders);
    const serialized = JSON.stringify(result.diagnostics);
    assert.doesNotMatch(serialized, /unraid\.example\.test|tower\.local|fd00/i);
    assert.deepEqual(Object.keys(result.diagnostics).sort(), [
        'authoritySource',
        'enforcementMode',
        'forwardedAuthorityStatus',
        'originStatus',
        'refererStatus',
        'schemaVersion',
        'trustedContext'
    ]);
});
