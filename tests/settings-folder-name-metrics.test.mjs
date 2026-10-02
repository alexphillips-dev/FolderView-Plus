import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.js', 'utf8');
const start = source.indexOf('const NAME_CELL_METRIC_ICONS =');
const end = source.indexOf('const buildRowsHtml =', start);
assert.ok(start >= 0 && end > start, 'Settings folder metric renderer must exist');
const renderMetrics = vm.runInNewContext(`${source.slice(start, end)}\nbuildNameCellMetricsHtml`, {
    surfaceT: (_key, fallback, ...params) => fallback.replace(/\$(\d+)/g, (_match, index) => String(params[Number(index) - 1])),
    escapeHtml: (value) => String(value).replace(/[&<>"']/g, (character) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character])
});

test('Settings folder names show direct Docker or VM members and only present sub-folders', () => {
    const docker = renderMetrics('docker', 2, 1, '2 direct members');
    const vm = renderMetrics('vm', 3, 0, '3 direct members');
    assert.match(docker, /Containers: 2/);
    assert.match(docker, /Sub-folders: 1/);
    assert.equal((docker.match(/<svg\b/g) || []).length, 2);
    assert.match(vm, /VMs: 3/);
    assert.doesNotMatch(vm, /Sub-folders:/);
    assert.equal((vm.match(/<svg\b/g) || []).length, 1);
    assert.equal((docker.match(/aria-hidden="true"/g) || []).length, 2);
    assert.match(source, /buildNameCellMetricsHtml\(type, directMemberCount, childFolderIds\.length, membersTitle\)/);
});

test('Settings folder metric tooltips escape text', () => {
    const html = renderMetrics('docker', 0, 0, '<unsafe>');
    assert.match(html, /title="&lt;unsafe&gt;"/);
    assert.doesNotMatch(html, /<unsafe>/);
});
