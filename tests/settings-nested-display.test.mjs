import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.js', import.meta.url), 'utf8');
const helper = source.match(/const buildNameCellTreeGuides = \(visibleIds, hierarchyMeta\) => \{[\s\S]*?\n\};/)[0];
const guides = Function(`${helper}\nreturn buildNameCellTreeGuides;`)();
const hierarchy = { parentById: { root: '', a: 'root', leaf: 'a', b: 'root', c: 'root', other: '' } };

test('Basic tree guides curve into each visible child and stop at the final sibling', () => {
    const result = guides(['root', 'a', 'leaf', 'b', 'c', 'other'], hierarchy);
    assert.equal(result[0], '');
    assert.match(result[1], /depth-0 is-branch is-continuing/);
    assert.match(result[2], /depth-0 is-continuing/);
    assert.match(result[2], /depth-1 is-branch"/);
    assert.match(result[3], /depth-0 is-branch is-continuing/);
    assert.match(result[4], /depth-0 is-branch"/);
    assert.equal(result[5], '');
});

test('Basic tree guides reconcile with filtered, hidden and collapsed rows', () => {
    assert.equal(guides(['root'], hierarchy)[0], '');
    const filtered = guides(['root', 'a', 'leaf'], hierarchy);
    assert.match(filtered[1], /depth-0 is-branch"/);
    assert.doesNotMatch(filtered[2], /depth-0/);
    assert.match(filtered[2], /depth-1 is-branch"/);
    assert.doesNotMatch(guides(['root', 'c'], hierarchy)[1], /is-continuing/);
    assert.match(guides(['leaf'], hierarchy)[0], /depth-1 is-branch/);
});

test('Basic tree guides tolerate malformed cycles and cap supported depth', () => {
    assert.ok(guides(['a'], { parentById: { a: 'b', b: 'a' } })[0].length < 200);
    const parents = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [String(i), String(i + 1)]));
    assert.doesNotMatch(guides(['0'], { parentById: parents })[0], /depth-[6-9]/);
});
