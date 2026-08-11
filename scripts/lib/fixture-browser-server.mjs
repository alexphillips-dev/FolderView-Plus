import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

export const createFixtureBrowserServer = ({ rootDir, pluginDir, fixtureDir }) => {
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

const fixtureServer = http.createServer(async (request, response) => {
    try {
        const requestUrl = new URL(request.url || '/', 'http://127.0.0.1');
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
