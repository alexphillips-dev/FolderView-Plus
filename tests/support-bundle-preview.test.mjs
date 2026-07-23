import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const previewModule = require(path.resolve(
    process.cwd(),
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.support-bundle-preview.js'
));
const api = previewModule.createApi({
    escapeHtml(value) {
        return String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;');
    },
    t(_key, fallback, ...params) {
        return params.reduce(
            (value, param, index) => value.replaceAll(`$${index + 1}`, String(param)),
            fallback
        );
    }
});

test('support bundle preview explains how to obtain missing Dashboard visual evidence', () => {
    const html = api.buildDashboardCaptureStatusHtml({ uiTelemetry: { dashboardVisual: {} } });
    assert.match(html, /No recent Dashboard visual capture is available/);
    assert.match(html, /expand the affected folder/);
    assert.match(html, /is-missing/);
});

test('support bundle preview flags stale or mismatched Dashboard captures', () => {
    const html = api.buildDashboardCaptureStatusHtml({
        uiTelemetry: {
            dashboardVisual: {
                docker: {
                    available: true,
                    freshness: 'stale',
                    ageMs: 35 * 60 * 1000,
                    capturedOnTouchCapableDevice: true,
                    environmentComparison: { differs: true },
                    latest: {
                        environment: { viewport: { width: 390, height: 844 } },
                        verdict: { status: 'warning' }
                    }
                }
            }
        }
    });
    assert.match(html, /Docker Dashboard/);
    assert.match(html, /stale/);
    assert.match(html, /390 x 844/);
    assert.match(html, /touch-capable/);
    assert.match(html, /export environment differs/);
    assert.match(html, /is-attention/);
});

test('support bundle preview keeps troubleshooting domains separate', () => {
    const html = api.buildDiagnosticDomainsHtml({
        healthAndHistory: {
            diagnosticDomains: {
                domains: {
                    layoutRendering: { status: 'error', issueCount: 2 },
                    configurationIntegrity: { status: 'healthy', issueCount: 0 }
                }
            }
        }
    });
    assert.match(html, /Layout and rendering/);
    assert.match(html, /is-error/);
    assert.match(html, /2 issue\(s\)/);
    assert.match(html, /Configuration integrity/);
    assert.match(html, /is-healthy/);
    assert.doesNotMatch(html, /unavailable/);
    assert.match(html, /Run health check to inspect the plugin state/);
    assert.match(html, /fv-support-bundle-domain-pending/);
});

test('support bundle preview removes the health-check prompt when every domain is assessed', () => {
    const assessedDomain = { status: 'healthy', issueCount: 0 };
    const html = api.buildDiagnosticDomainsHtml({
        healthAndHistory: {
            diagnosticDomains: {
                domains: {
                    layoutRendering: assessedDomain,
                    configurationIntegrity: assessedDomain,
                    runtimeRequests: assessedDomain,
                    storage: assessedDomain,
                    customIcons: assessedDomain,
                    theme: assessedDomain,
                    localization: assessedDomain,
                    update: assessedDomain
                }
            }
        }
    });

    assert.doesNotMatch(html, /Run health check/);
    assert.doesNotMatch(html, /fv-support-bundle-domain-pending/);
});

test('support bundle preview enriches browser telemetry before its first render', async () => {
    let enrichmentCalls = 0;
    const lifecycleApi = previewModule.createApi({
        getSupportBundlePreview: async () => ({
            bundleMeta: {
                generatedAt: '2026-07-23T15:08:13Z',
                privacyMode: 'sanitized'
            },
            uiTelemetry: {}
        }),
        enrichSupportBundlePreview(bundle) {
            enrichmentCalls += 1;
            return {
                ...bundle,
                uiTelemetry: {
                    ...bundle.uiTelemetry,
                    dashboardVisual: {
                        docker: {
                            available: true,
                            freshness: 'fresh'
                        }
                    }
                }
            };
        }
    });

    const preview = await lifecycleApi.refreshSupportBundlePreview();

    assert.equal(enrichmentCalls, 1);
    assert.equal(preview.uiTelemetry.dashboardVisual.docker.available, true);
    assert.equal(lifecycleApi.getLastSupportBundlePreview(), preview);
});
