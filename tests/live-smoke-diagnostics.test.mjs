import test from 'node:test';
import assert from 'node:assert/strict';
import {
    normalizeLiveSmokeDiagnosticLabel,
    redactLiveSmokeDiagnostic
} from '../scripts/lib/live-smoke-diagnostics.mjs';

test('live smoke diagnostics redact credential-bearing URLs and configured targets', () => {
    const target = 'https://admin:correct-horse@tower.private.local/Settings/FolderViewPlus?token=secret-value';
    const message = `page.goto failed at ${target} while connecting to 192.0.2.44:443`;
    const redacted = redactLiveSmokeDiagnostic(new Error(message), [target]);

    assert.match(redacted, /\[redacted-url\]/);
    assert.match(redacted, /\[redacted-host\]/);
    for (const sensitive of ['admin', 'correct-horse', 'tower.private.local', '192.0.2.44', 'secret-value']) {
        assert.doesNotMatch(redacted, new RegExp(sensitive.replace('.', '\\.')));
    }
});

test('live smoke diagnostics redact standalone credentials and local hostnames', () => {
    const redacted = redactLiveSmokeDiagnostic(
        'authorization: Bearer abc123 password=hunter2 host=tower.lab.local:8443'
    );

    assert.equal(redacted, 'authorization=[redacted] password=[redacted] host=[redacted-host]');
});

test('live smoke diagnostic labels accept generated identifiers only', () => {
    assert.equal(normalizeLiveSmokeDiagnosticLabel('target-12'), 'target-12');
    assert.equal(normalizeLiveSmokeDiagnosticLabel('theme-2'), 'theme-2');
    assert.equal(normalizeLiveSmokeDiagnosticLabel('tower.private.local'), 'configured-target');
    assert.equal(normalizeLiveSmokeDiagnosticLabel('admin:secret'), 'configured-target');
});
