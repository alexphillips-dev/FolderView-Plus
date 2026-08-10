import assert from 'node:assert/strict';
import test from 'node:test';

import {
    classifyPaths,
    matchesPattern
} from '../scripts/classify_ci_changes.mjs';

test('path matching supports exact, subtree, and wildcard workflow patterns', () => {
    assert.equal(matchesPattern('README.md', 'README.md'), true);
    assert.equal(matchesPattern('docs/releases/2026.07.27.01.md', 'docs/**'), true);
    assert.equal(matchesPattern('.github/SUPPORT.en.md', '.github/SUPPORT*.md'), true);
    assert.equal(matchesPattern('src/runtime.js', 'docs/**'), false);
});

test('documentation-only changes skip runtime browser and theme lanes', () => {
    const result = classifyPaths(['README.md', 'docs/architecture.md']);
    assert.deepEqual(result.outputs, {
        docs_only: true,
        workflow_only: false,
        needs_browser: false,
        needs_theme: false,
        preview_changed: false
    });
});

test('workflow-only changes use focused workflow validation', () => {
    const result = classifyPaths([
        '.github/workflows/ci.yml',
        'scripts/classify_ci_changes.mjs'
    ]);
    assert.deepEqual(result.outputs, {
        docs_only: false,
        workflow_only: true,
        needs_browser: false,
        needs_theme: false,
        preview_changed: false
    });
});

test('runtime changes request browser, theme, and release-preview coverage', () => {
    const result = classifyPaths([
        'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js'
    ]);
    assert.deepEqual(result.outputs, {
        docs_only: false,
        workflow_only: false,
        needs_browser: true,
        needs_theme: true,
        preview_changed: true
    });
});

test('metadata changes are not mistaken for documentation-only changes', () => {
    const result = classifyPaths(['folderview.plus.plg']);
    assert.equal(result.outputs.docs_only, false);
    assert.equal(result.outputs.preview_changed, true);
});
