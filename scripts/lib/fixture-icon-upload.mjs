import assert from 'node:assert/strict';

export const createFixtureIconUploadHandler = () => {
    const staged = new Map();
    return (request, response, rawBody) => {
        const fields = new URLSearchParams(rawBody), decoded = Buffer.from(fields.get('icon_inline_data') || '', 'base64url');
        assert.equal(request.method, 'POST');
        assert.match(request.headers['content-type'], /^application\/x-www-form-urlencoded/);
        assert.equal(request.headers['x-csrf-token'], 'fixture-unraid-token');
        assert.equal(request.headers['x-fv-token'], 'fixture-plugin-token');
        assert.equal(request.headers['x-fv-nonce'], 'a'.repeat(64));
        assert.equal(fields.get('csrf_token'), 'fixture-unraid-token');
        let file = decoded, bodyBytes = Buffer.byteLength(rawBody);
        const id = fields.get('icon_upload_id');
        if (id) {
            const index = Number(fields.get('icon_chunk_index')), count = Number(fields.get('icon_chunk_count'));
            const upload = staged.get(id) || { parts: [], bodyBytes: 0 };
            assert.equal(index, upload.parts.length);
            upload.parts.push(decoded); upload.bodyBytes = Math.max(upload.bodyBytes, bodyBytes); staged.set(id, upload);
            if (index < count - 1) {
                response.writeHead(200, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ ok: true, chunkAccepted: true, nextChunk: index + 1 })); return;
            }
            file = Buffer.concat(upload.parts); bodyBytes = upload.bodyBytes; staged.delete(id);
            assert.equal(file.length, Number(fields.get('icon_total_bytes')));
        }
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ ok: true, url: '/fixture.png', name: 'fixture.png', evidence: {
            contentType: request.headers['content-type'], file: file.length > 0 && file.every(byte => byte === 255),
            bytes: file.length, bodyBytes, filename: fields.get('icon_inline_name') === 'fixture.png',
            nonce: fields.get('_fv_nonce') === 'a'.repeat(64), csrf: fields.get('csrf_token') === 'fixture-unraid-token',
            corrupted: rawBody.includes('[object FormData]')
        } }));
    };
};
