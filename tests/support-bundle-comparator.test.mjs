import test from 'node:test';
import assert from 'node:assert/strict';
import {
    compareSanitizedSupportBundles,
    renderSupportBundleComparisonMarkdown
} from '../scripts/lib/support_bundle_compare.mjs';

const bundle = (overrides = {}) => ({
    bundleMeta: { privacyMode: 'sanitized', schemaVersion: 2, pluginVersion: '2026.07.25.01' },
    system: { unraidVersion: '7.3.2', userAgent: 'private' },
    pluginState: { folderCount: 4, folderName: 'ui-aabbcc' },
    runtimeState: { docker: { status: 'healthy', renderedWidth: 900 } },
    redactionManifest: { mode: 'sanitized', hashedCount: 12 },
    ...overrides
});

test('comparator reports bounded privacy-safe structural differences', () => {
    const report = compareSanitizedSupportBundles(
        bundle(),
        bundle({
            system: { unraidVersion: '7.2.0', userAgent: 'different-private' },
            pluginState: { folderCount: 5, folderName: 'ui-ddeeff' },
            runtimeState: { docker: { status: 'degraded', renderedWidth: 700 } }
        })
    );
    assert.ok(report.differences.some((row) => row.path === 'system.unraidVersion'));
    assert.ok(report.differences.some((row) => row.path === 'pluginState.folderCount'));
    assert.equal(report.differences.some((row) => /userAgent|folderName/.test(row.path)), false);
    const markdown = renderSupportBundleComparisonMarkdown(report);
    assert.match(markdown, /Support Bundle Comparison/);
    assert.doesNotMatch(markdown, /different-private|ui-ddeeff/);
});

test('comparator refuses full or unmanifested bundles', () => {
    assert.throws(
        () => compareSanitizedSupportBundles({ bundleMeta: { privacyMode: 'full' }, redactionManifest: { mode: 'full' } }, bundle()),
        /not a sanitized support bundle/
    );
    assert.throws(
        () => compareSanitizedSupportBundles({ bundleMeta: { privacyMode: 'sanitized' } }, bundle()),
        /redaction manifest/
    );
});
