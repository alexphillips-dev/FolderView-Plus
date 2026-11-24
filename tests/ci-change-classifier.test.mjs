import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
    classifyPaths,
    matchesPattern,
    resolveChangedPaths
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
        no_changes: false,
        docs_only: true,
        workflow_only: false,
        needs_browser: false,
        needs_theme: false,
        needs_performance: false,
        production_surfaces: '',
        preview_changed: false
    });
});

test('workflow-only changes use focused workflow validation', () => {
    const result = classifyPaths([
        '.github/workflows/ci.yml',
        'scripts/classify_ci_changes.mjs'
    ]);
    assert.deepEqual(result.outputs, {
        no_changes: false,
        docs_only: false,
        workflow_only: true,
        needs_browser: false,
        needs_theme: false,
        needs_performance: false,
        production_surfaces: '',
        preview_changed: false
    });
});

test('dependency updates with a generated SBOM retain tests and browser validation', () => {
    const result = classifyPaths([
        'package.json',
        'package-lock.json',
        'docs/sbom.cdx.json'
    ]);
    assert.equal(result.outputs.docs_only, false);
    assert.equal(result.outputs.workflow_only, false);
    assert.equal(result.outputs.needs_browser, true);
});

test('unclassified tooling changes with documentation retain broad validation', () => {
    const result = classifyPaths(['scripts/new-tool.mjs', 'docs/architecture.md']);
    assert.equal(result.outputs.docs_only, false);
    assert.equal(result.outputs.workflow_only, false);
});

test('workflow changes allow the generated SBOM as a focused validation companion', () => {
    const result = classifyPaths([
        '.github/workflows/dependency-vulnerability-scan.yml',
        'docs/sbom.cdx.json'
    ]);
    assert.deepEqual(result.outputs, {
        no_changes: false,
        docs_only: false,
        workflow_only: true,
        needs_browser: false,
        needs_theme: false,
        needs_performance: false,
        production_surfaces: '',
        preview_changed: false
    });
});

test('a standalone generated SBOM change selects lint and its freshness guard', () => {
    const result = classifyPaths(['docs/sbom.cdx.json']);
    assert.equal(result.outputs.no_changes, false);
    assert.equal(result.outputs.docs_only, false);
    assert.equal(result.outputs.workflow_only, false);
    assert.equal(result.outputs.needs_browser, false);
    assert.equal(result.outputs.needs_performance, false);
});

test('Git comparisons classify deletions from runtime paths even when Git detects a rename', t => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-ci-rename-'));
    t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
    const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: 'pipe' }).trim();
    git('init', '-q');
    git('config', 'user.name', 'Fixture');
    git('config', 'user.email', 'fixture@example.invalid');
    git('config', 'diff.renames', 'true');
    fs.mkdirSync(path.join(cwd, 'src'));
    fs.mkdirSync(path.join(cwd, 'docs'));
    fs.writeFileSync(path.join(cwd, 'src', 'fixture.js'), 'const fixture = true;\n');
    git('add', 'src/fixture.js');
    git('commit', '--no-verify', '-qm', 'Add runtime fixture');
    const base = git('rev-parse', 'HEAD');
    git('mv', 'src/fixture.js', 'docs/fixture.js');
    git('commit', '--no-verify', '-qm', 'Archive runtime fixture');
    assert.equal(git('diff', '--name-only', base, 'HEAD'), 'docs/fixture.js');

    const script = fileURLToPath(new URL('../scripts/classify_ci_changes.mjs', import.meta.url));
    for (const eventName of ['push', 'pull_request', 'workflow_dispatch', '']) {
        const output = execFileSync(process.execPath, [script], {
            cwd, encoding: 'utf8', env: { ...process.env, FVPLUS_CI_EVENT_NAME: eventName,
                FVPLUS_CI_BEFORE_SHA: base, FVPLUS_CI_BASE_SHA: base, FVPLUS_CI_HEAD_SHA: 'HEAD',
                GITHUB_OUTPUT: '', GITHUB_STEP_SUMMARY: '' }
        });
        assert.match(output, /^docs_only=false$/m);
        assert.match(output, /^needs_browser=true$/m);
        assert.match(output, /^needs_theme=true$/m);
        assert.match(output, /^preview_changed=true$/m);
    }
});

test('manual compatibility review scripts and baseline use focused workflow validation', () => {
    const result = classifyPaths([
        'scripts/unraid_compatibility_monitor.mjs',
        'scripts/community_applications_guard.mjs',
        'scripts/php_runtime_compatibility.sh',
        'docs/unraid-compatibility-baseline.json'
    ]);
    assert.equal(result.outputs.workflow_only, true);
    assert.equal(result.outputs.needs_browser, false);
    assert.equal(result.outputs.needs_theme, false);
});

test('workflow changes mixed with ordinary documentation still use broad validation', () => {
    const result = classifyPaths([
        '.github/workflows/codeql.yml',
        'docs/architecture.md'
    ]);
    assert.equal(result.outputs.workflow_only, false);
});

test('runtime changes request browser, theme, and release-preview coverage', () => {
    const result = classifyPaths([
        'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js'
    ]);
    assert.deepEqual(result.outputs, {
        no_changes: false,
        docs_only: false,
        workflow_only: false,
        needs_browser: true,
        needs_theme: true,
        needs_performance: true,
        production_surfaces: 'docker',
        preview_changed: true
    });
});

test('metadata changes are not mistaken for documentation-only changes', () => {
    const result = classifyPaths(['folderview.plus.plg']);
    assert.equal(result.outputs.docs_only, false);
    assert.equal(result.outputs.preview_changed, true);
});

test('shared runtime changes select both production surfaces while page modules select affected startup coverage', () => {
    const prefix = 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/';
    for (const name of ['runtime.shared-primitives.js', 'folder.runtime.state-observers.js', 'folder.js',
        'folderviewplus.utils.js', 'folderviewplus.utils-ordering.js', 'folderviewplus.i18n.js', 'folderviewplus.js']) {
        const result = classifyPaths([prefix + name]).outputs;
        assert.equal(result.needs_performance, true, name);
        assert.equal(result.production_surfaces, 'settings,docker', name);
    }
    for (const [name, surface] of [['docker.js', 'docker'], ['folderviewplus.settings-loader.js', 'settings'],
        ['vm.js', 'none'], ['dashboard.js', 'none']]) {
        const result = classifyPaths([prefix + name]).outputs;
        assert.equal(result.needs_performance, true, name);
        assert.equal(result.production_surfaces, surface, name);
    }
    assert.equal(classifyPaths(['scripts/lib/production-perf-metrics.mjs']).outputs.production_surfaces, 'settings,docker');
    assert.equal(classifyPaths([prefix + 'docker.js', prefix + 'folderviewplus.settings-loader.js']).outputs.production_surfaces, 'settings,docker');
    const dockerPage = fs.readFileSync('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/folderview.plus.Docker.page', 'utf8');
    for (const [, module] of dockerPage.matchAll(/scripts\/(folderviewplus\.[^']+\.js)/g)) {
        assert.equal(classifyPaths([prefix + module]).outputs.production_surfaces, 'settings,docker', module);
    }
});

test('ancestry-only synchronization skips repeated work and unknown paths retain layout validation', () => {
    assert.equal(classifyPaths([]).outputs.no_changes, true);
    const unknown = classifyPaths(['scripts/new-tool.mjs']);
    assert.equal(unknown.outputs.needs_browser, true);
    assert.equal(unknown.outputs.needs_theme, true);
    assert.equal(unknown.outputs.needs_performance, false);
    assert.equal(classifyPaths(['scripts/lib/production-perf-metrics.mjs']).outputs.needs_performance, true);
    assert.equal(classifyPaths(['src/app/styles/layout.css']).outputs.needs_performance, false);
});

test('manual validation covers the full revision instead of its last commit', () => {
    const paths = resolveChangedPaths({ eventName: 'workflow_dispatch', headSha: 'HEAD' });
    assert.ok(paths.includes('package.json'));
    assert.ok(paths.includes('pkg_build.sh'));
    const result = classifyPaths(paths);
    assert.equal(result.outputs.docs_only, false);
    assert.equal(result.outputs.workflow_only, false);
    assert.equal(result.outputs.needs_browser, true);
    assert.equal(result.outputs.needs_theme, true);
});
