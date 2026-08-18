import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

export const createFixtureBrowserServer = ({ rootDir, pluginDir, fixtureDir }) => {
const unraidApiFixtureDir = path.join(rootDir, 'tests', 'fixtures', 'unraid-api');
const mimeTypes = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml'
};

const safeResolve = (base, relativePath) => {
    const resolvedBase = path.resolve(base);
    const resolved = path.resolve(resolvedBase, String(relativePath || '').replace(/^[/\\]+/, ''));
    return resolved === resolvedBase || resolved.startsWith(`${resolvedBase}${path.sep}`) ? resolved : '';
};

const readRequestBody = (request) => new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', (chunk) => {
        size += chunk.length;
        if (size > 1024 * 1024) {
            reject(new Error('Fixture request body exceeded 1 MiB.'));
            request.destroy();
            return;
        }
        chunks.push(chunk);
    });
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
});

const fixtureProfileFromRequest = (request) => {
    try {
        const referer = new URL(String(request.headers.referer || ''), 'http://127.0.0.1');
        return String(referer.searchParams.get('profile') || 'current-full-api').trim();
    } catch (_error) {
        return 'current-full-api';
    }
};

const graphqlFixtureResponse = (profile, document) => {
    if (profile.introspectionError === true && document.includes('FVPlusDockerCapabilities')) {
        return { errors: [{ message: 'Fixture introspection is unavailable.' }] };
    }
    if (document.includes('FVPlusDockerCapabilities')) return { data: profile.capabilities || {} };
    if (document.includes('FVPlusApiVersion')) return { data: profile.version || {} };
    if (document.includes('FVPlusDockerShape')) {
        return { data: { docker: { containers: [{ __typename: 'DockerContainer' }] } } };
    }
    if (document.includes('FVPlusLegacyDockerShape')) {
        return { data: { dockerContainers: [{ __typename: 'DockerContainer' }] } };
    }
    if (document.includes('FVPlusDockerContainer(')) {
        return { data: { docker: { container: profile.container || profile.containers?.[0] || null } } };
    }
    if (document.includes('FVPlusDockerContainers')) {
        if (profile.listErrors) return { data: profile.partialData || null, errors: profile.listErrors };
        return { data: { docker: { containers: profile.containers || [] } } };
    }
    return { data: { __typename: 'Query' } };
};

const fixtureServer = http.createServer(async (request, response) => {
    try {
        const requestUrl = new URL(request.url || '/', 'http://127.0.0.1');
        if (requestUrl.pathname === '/graphql') {
            const profileName = fixtureProfileFromRequest(request);
            const profilePath = safeResolve(unraidApiFixtureDir, `${profileName}.json`);
            if (!profilePath || !fs.existsSync(profilePath)) {
                response.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
                response.end(JSON.stringify({ errors: [{ message: 'Unknown fixture API profile.' }] }));
                return;
            }
            const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
            const status = Math.max(200, Math.min(599, Number(profile.httpStatus) || 200));
            if (status !== 200) {
                response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
                response.end(JSON.stringify({ errors: [{ message: 'Fixture API request rejected.' }] }));
                return;
            }
            const rawBody = await readRequestBody(request);
            const body = JSON.parse(rawBody || '{}');
            response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
            response.end(JSON.stringify(graphqlFixtureResponse(profile, String(body.query || ''))));
            return;
        }
        if (requestUrl.pathname === '/plugins/folderview.plus/server/security.php') {
            const rawBody = await readRequestBody(request);
            const body = Object.fromEntries(new URLSearchParams(rawBody));
            assert.equal(request.method, 'POST');
            assert.equal(body.action, 'issue_nonce');
            assert.equal(body.endpoint, 'echo.php');
            response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
            response.end(JSON.stringify({
                ok: true,
                nonce: 'a'.repeat(64)
            }));
            return;
        }

        if (requestUrl.pathname === '/api/echo.php') {
            const rawBody = await readRequestBody(request);
            const body = Object.fromEntries(new URLSearchParams(rawBody));
            response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
            response.end(JSON.stringify({
                ok: true,
                body,
                headers: {
                    request: request.headers['x-fv-request'] || '',
                    token: request.headers['x-fv-token'] || '',
                    trace: request.headers['x-fv-trace'] || '',
                    nonce: request.headers['x-fv-nonce'] || ''
                }
            }));
            return;
        }

        let filePath = '';
        if (requestUrl.pathname === '/' || requestUrl.pathname === '/runtime') {
            filePath = path.join(fixtureDir, 'runtime.html');
        } else if (requestUrl.pathname === '/settings') {
            filePath = path.join(fixtureDir, 'settings.html');
        } else if (requestUrl.pathname === '/folder-editor') {
            filePath = path.join(fixtureDir, 'folder-editor.html');
        } else if (requestUrl.pathname === '/import') {
            filePath = path.join(fixtureDir, 'import.html');
        } else if (requestUrl.pathname === '/localization') {
            filePath = path.join(fixtureDir, 'localization.html');
        } else if (requestUrl.pathname === '/ui-primitives') {
            filePath = path.join(fixtureDir, 'ui-primitives.html');
        } else if (requestUrl.pathname === '/dashboard-layout') {
            filePath = path.join(fixtureDir, 'dashboard-layout.html');
        } else if (requestUrl.pathname === '/dashboard-lifecycle') {
            filePath = path.join(fixtureDir, 'dashboard-lifecycle.html');
        } else if (requestUrl.pathname === '/vm-lifecycle') {
            filePath = path.join(fixtureDir, 'vm-lifecycle.html');
        } else if (requestUrl.pathname === '/future-docker-host') {
            filePath = path.join(fixtureDir, 'future-docker-host.html');
        } else if (requestUrl.pathname === '/docker-api-legacy') {
            filePath = path.join(fixtureDir, 'docker-api-legacy.html');
        } else if (requestUrl.pathname === '/docker-layout-stability') {
            filePath = path.join(fixtureDir, 'docker-layout-stability.html');
        } else if (requestUrl.pathname === '/csp-hardening') {
            filePath = path.join(fixtureDir, 'csp-hardening.html');
        } else if (requestUrl.pathname.startsWith('/security-fixtures/')) {
            filePath = safeResolve(path.join(rootDir, 'tests', 'fixtures', 'security'), requestUrl.pathname.slice('/security-fixtures/'.length));
        } else if (requestUrl.pathname.startsWith('/plugin/')) {
            filePath = safeResolve(pluginDir, requestUrl.pathname.slice('/plugin/'.length));
        } else if (requestUrl.pathname.startsWith('/fixtures/')) {
            filePath = safeResolve(fixtureDir, requestUrl.pathname.slice('/fixtures/'.length));
        } else if (requestUrl.pathname === '/vendor/jquery.js') {
            filePath = path.join(rootDir, 'node_modules', 'jquery', 'dist', 'jquery.min.js');
        }

        if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
            response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            response.end('Not found');
            return;
        }
        const extension = path.extname(filePath).toLowerCase();
        response.writeHead(200, {
            'Content-Type': mimeTypes[extension] || 'application/octet-stream',
            'Cache-Control': 'no-store'
        });
        fs.createReadStream(filePath).pipe(response);
    } catch (error) {
        console.error('Fixture server request failed:', error);
        response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('Internal fixture server error');
    }
});
    return fixtureServer;
};
