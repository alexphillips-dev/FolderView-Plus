import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn, spawnSync } from 'node:child_process';

const available = spawnSync('php-cgi', ['-v'], { encoding: 'utf8' }).status === 0;
const record = (type, data) => {
    const header = Buffer.alloc(8); header[0] = 1; header[1] = type;
    header.writeUInt16BE(1, 2); header.writeUInt16BE(data.length, 4);
    return Buffer.concat([header, data]);
};
const length = value => {
    if (value < 128) return Buffer.from([value]);
    const buffer = Buffer.alloc(4); buffer.writeUInt32BE(value + 0x80000000); return buffer;
};
const fastcgi = (port, params, input) => new Promise((resolve, reject) => {
    const socket = net.connect(port, '127.0.0.1'); let pending = Buffer.alloc(0), output = '';
    socket.setTimeout(15000, () => socket.destroy(new Error('FastCGI fixture timed out.')));
    socket.on('error', reject);
    socket.on('connect', () => {
        socket.write(record(1, Buffer.from([0, 1, 0, 0, 0, 0, 0, 0])));
        const fields = Object.entries(params).map(([name, value]) => {
            const key = Buffer.from(name), data = Buffer.from(value);
            return Buffer.concat([length(key.length), length(data.length), key, data]);
        });
        socket.write(record(4, Buffer.concat(fields))); socket.write(record(4, Buffer.alloc(0)));
        const data = Buffer.from(input);
        for (let offset = 0; offset < data.length; offset += 65535) socket.write(record(5, data.subarray(offset, offset + 65535)));
        socket.write(record(5, Buffer.alloc(0)));
    });
    socket.on('data', chunk => {
        pending = Buffer.concat([pending, chunk]);
        while (pending.length >= 8) {
            const size = pending.readUInt16BE(4), total = 8 + size + pending[6];
            if (pending.length < total) break;
            const type = pending[1];
            if (type === 6 || type === 7) output += pending.subarray(8, 8 + size).toString();
            pending = pending.subarray(total);
            if (type === 3) { socket.destroy(); resolve(output); return; }
        }
    });
});

test('PHP FastCGI parses each icon part within the default 8 MiB POST limit', { skip: !available }, async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-icon-cgi-'));
    let process;
    try {
        const script = path.join(directory, 'probe.php');
        fs.writeFileSync(script, '<?php echo json_encode(["postMax"=>ini_get("post_max_size"),"uploadMax"=>ini_get("upload_max_filesize"),"length"=>strlen(base64_decode(strtr($_POST["icon_inline_data"]??"","-_","+/"),true)),"csrf"=>($_POST["csrf_token"]??"") === "fixture-csrf"]);');
        const fileBytes = 524286;
        const input = new URLSearchParams({ icon_inline_data: Buffer.alloc(fileBytes, 255).toString('base64url'), csrf_token: 'fixture-csrf' }).toString();
        assert.ok(Buffer.byteLength(input) < 1024 * 1024);
        const listener = net.createServer();
        await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve));
        const port = listener.address().port;
        await new Promise(resolve => listener.close(resolve));
        process = spawn('php-cgi', ['-d', 'cgi.force_redirect=0', '-d', 'memory_limit=256M', '-d', 'post_max_size=8M', '-b', `127.0.0.1:${port}`], { windowsHide: true, stdio: 'ignore' });
        let output;
        for (let attempt = 0; attempt < 40; attempt++) {
            try {
                output = await fastcgi(port, { REQUEST_METHOD: 'POST', CONTENT_TYPE: 'application/x-www-form-urlencoded',
                    CONTENT_LENGTH: String(Buffer.byteLength(input)), SCRIPT_FILENAME: script,
                    SCRIPT_NAME: '/probe.php', DOCUMENT_ROOT: directory, SERVER_PROTOCOL: 'HTTP/1.1' }, input);
                break;
            } catch (error) {
                if (error.code !== 'ECONNREFUSED' || attempt === 39) throw error;
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }
        const result = JSON.parse(output.slice(output.indexOf('{')));
        assert.equal(result.postMax, '8M');
        assert.equal(result.length, fileBytes);
        assert.equal(result.csrf, true);
    } finally {
        if (process && process.exitCode === null) {
            const stopped = new Promise(resolve => process.once('exit', resolve)); process.kill(); await stopped;
        }
        fs.rmSync(directory, { recursive: true, force: true });
    }
});
