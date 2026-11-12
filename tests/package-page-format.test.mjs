import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { normalizePackagePageFiles, assertPageFormat } from '../scripts/package_page_format.mjs';

const page = 'Title="Folder"\nType="xmenu"\nMarkdown="false"\n---\n<?php $example = "fixture"; ?>\n<form id="fixture-editor">Café</form>\n';
// Unraid PageBuilder splits metadata/body using this literal LF delimiter.
// A regex accepting CRLF would conceal the failure that shipped in .08.
const hostBody = contents => contents.split('\n---\n')[1] || '';
const withRoot = callback => {
    const base = fs.realpathSync(os.tmpdir());
    const root = fs.mkdtempSync(path.join(base, 'fvplus-package-pages-'));
    try { return callback(root); }
    finally {
        assert.equal(path.dirname(fs.realpathSync(root)), base);
        fs.rmSync(root, { recursive: true, force: true });
    }
};

test('CRLF page metadata loses its body under the actual host delimiter and staged normalization restores it', () => {
    const windowsPage = page.replaceAll('\n', '\r\n');
    assert.equal(hostBody(windowsPage), '');
    assert.throws(() => assertPageFormat(windowsPage, 'Folder.page'));
    withRoot(root => {
        const target = path.join(root, 'Folder.page');
        fs.writeFileSync(target, windowsPage);
        normalizePackagePageFiles(root);
        const packaged = fs.readFileSync(target, 'utf8');
        assert.equal(packaged, page);
        assert.equal(hostBody(packaged), '<?php $example = "fixture"; ?>\n<form id="fixture-editor">Café</form>\n');
        assert.doesNotThrow(() => assertPageFormat(packaged, 'Folder.page'));
    });
});

test('normalization preserves LF pages and leaves JavaScript, documentation and binary assets byte-identical', () => {
    withRoot(root => {
        const files = new Map([
            ['Folder.page', Buffer.from(page.replaceAll('\n', '\r\n'))],
            ['FolderViewPlus.page', Buffer.from(page.replace('Folder', 'Settings'))],
            ['folderview.plus.Docker.page', Buffer.from(page.replace('Folder', 'Docker').replaceAll('\n', '\r\n'))],
            ['nested/Child.page', Buffer.from(page.replace('Folder', 'Child').replaceAll('\n', '\r\n'))],
            ['runtime.js', Buffer.from('const value = "fixture";\r\n')],
            ['README.md', Buffer.from('# Fixture\r\n')],
            ['image.png', Buffer.from([0, 13, 10, 255, 1])]
        ]);
        for (const [name, contents] of files) {
            fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
            fs.writeFileSync(path.join(root, name), contents);
        }
        normalizePackagePageFiles(root);
        for (const [name, contents] of files) {
            const actual = fs.readFileSync(path.join(root, name));
            assert.deepEqual(actual, name.endsWith('.page') ? Buffer.from(contents.toString('utf8').replaceAll('\r\n', '\n')) : contents, name);
            if (name.endsWith('.page')) assert.doesNotThrow(() => assertPageFormat(actual.toString('utf8'), name));
        }
        const once = [...files.keys()].map(name => fs.readFileSync(path.join(root, name)));
        normalizePackagePageFiles(root);
        assert.deepEqual([...files.keys()].map(name => fs.readFileSync(path.join(root, name))), once);
    });
});

test('page validation rejects missing delimiters, empty bodies and carriage returns', () => {
    for (const invalid of ['Title="Folder"\n<form>fixture</form>\n', 'Title="Folder"\n---\n', 'Title="Folder"\n---\n \n', page.replace('Café', 'Café\r')]) {
        assert.throws(() => assertPageFormat(invalid, 'fixture.page'));
    }
    assert.doesNotThrow(() => assertPageFormat(page, 'fixture.page'));
});

test('normalization refuses a staged root with no Unraid pages', () => {
    withRoot(root => assert.throws(() => normalizePackagePageFiles(root), /No Unraid pages/));
});

test('format checker validates exact archive-member stdin bytes without newline conversion', () => {
    for (const [contents, expectedStatus] of [[page, 0], [page.replaceAll('\n', '\r\n'), 1], ['Title="Folder"\n---\n', 1]]) {
        const result = spawnSync(process.execPath, ['scripts/package_page_format.mjs', '--check-stdin', 'archive/Folder.page'], {
            input: Buffer.from(contents), encoding: 'utf8'
        });
        assert.equal(result.status, expectedStatus, result.stderr || result.stdout);
    }
});

test('packaging normalizes page bytes before channel messaging and source identity while release validation checks archive bytes', () => {
    const build = fs.readFileSync('pkg_build.sh', 'utf8');
    const normalization = build.indexOf('--normalize');
    assert.ok(normalization > 0);
    assert.ok(normalization < build.indexOf('apply_branch_channel_messaging "$tmpdir" "$branch"'));
    assert.ok(normalization < build.indexOf('build_source_content_sha256='));
    const guard = fs.readFileSync('scripts/release_guard.sh', 'utf8');
    assert.match(guard, /package_page_format\.mjs/);
    assert.match(guard, /--check-stdin/);
});

test('retained .08 archive characterizes the reported CRLF editor regression', context => {
    const archive = path.resolve('archive/folderview.plus-2026.11.12.08.txz');
    // Historical archives are intentionally pruned. The synthetic tests above
    // remain mandatory when this original affected package ages out.
    if (!fs.existsSync(archive)) { context.skip('Original .08 archive has aged out of package retention.'); return; }
    const archiveArgument = path.relative(process.cwd(), archive).split(path.sep).join('/');
    const contents = execFileSync('tar', ['-xOf', archiveArgument, './usr/local/emhttp/plugins/folderview.plus/Folder.page']).toString('utf8');
    assert.ok(contents.includes('\r\n'));
    assert.equal(hostBody(contents), '');
    assert.throws(() => assertPageFormat(contents, '2026.11.12.08/Folder.page'));
});
