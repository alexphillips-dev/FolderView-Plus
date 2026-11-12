import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const scriptsRoot = path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts');
const read = name => fs.readFileSync(path.join(scriptsRoot, name), 'utf8');
const dockerSource = read('docker.js'), vmSource = read('vm.js');
const legacySource = (source, end) => source.slice(source.indexOf('const restoreLinearPreviewLayout = '), source.indexOf(end));
const measurementSource = dockerSource.slice(dockerSource.indexOf('const layoutFolderPreviewRows = '), dockerSource.indexOf('const decorateDockerPreviewMemberTriggers = '));

export const registerRuntimePreviewColorSecurityCases = ({ test }) => {
    test('Docker and VM preview divider colors remain CSS data in every layout path', async ({ page }) => {
        await page.setContent('<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Preview color fixture</title></head><body><div id="preview" style="width:600px"></div></body></html>');
        await page.addScriptTag({ path: path.resolve('node_modules/jquery/dist/jquery.js') });
        await page.evaluate(() => {
            window.FolderViewPlusFoundationModules = { runtimeSharedPrimitives: {}, runtimeSharedDiagnostics: {}, runtimeSharedControls: {} };
        });
        await page.addScriptTag({ path: path.join(scriptsRoot, 'docker.runtime.shared.js') });
        await page.addScriptTag({ content: `(() => {
            const shared = window.FolderViewDockerRuntimeShared;
            const { flattenPreviewWrappers, isCompactMultiRowPreview, normalizeFolderPreviewOverflow, normalizeFolderPreviewRowLimit } = shared;
            const dockerRuntimeShared = {}, runtimeShared = {};
            window.previewColorApis = { shared };
            (() => { ${legacySource(dockerSource, 'const utils = ')}
                window.previewColorApis.dockerFallback = { restoreLinearPreviewLayout, finalizePreviewRows };
            })();
            (() => { ${legacySource(vmSource, 'const createRuntimeDebugLogger = ')}
                window.previewColorApis.vmFallback = { restoreLinearPreviewLayout, finalizePreviewRows };
            })();
            const { restoreLinearPreviewLayout, finalizePreviewRows } = shared;
            const getFolderPreviewItemsPerRow = () => 2;
            ${measurementSource}
            window.previewColorApis.measurement = { layoutFolderPreviewRows };
        })();` });
        const results = await page.evaluate(() => {
            const results = [];
            const colors = ['#abc', 'rgb(1, 2, 3)', '"><script data-color-injected>window.colorInjected += 1</script><div x="'];
            for (const [apiName, api] of Object.entries(window.previewColorApis)) {
                for (const method of Object.keys(api).filter(name => ['restoreLinearPreviewLayout', 'finalizePreviewRows', 'layoutFolderPreviewRows'].includes(name))) {
                    for (const field of ['preview_vertical_bars_color', 'preview_border_color']) {
                        for (const color of colors) {
                            window.colorInjected = 0;
                            const $preview = $('#preview').empty().append('<span class="folder-preview-wrapper">A</span><span class="folder-preview-wrapper">B</span>');
                            const wrappers = $preview.children().get();
                            const settings = { preview_vertical_bars: true, preview_rows: 2, [field]: color };
                            if (method === 'finalizePreviewRows') api[method]($preview, [wrappers], settings);
                            else api[method]($preview, settings);
                            const divider = $preview.find('.folder-preview-divider').get(0);
                            results.push({ apiName, method, field, malicious: color.startsWith('"'),
                                injected: document.querySelectorAll('[data-color-injected]').length,
                                executed: window.colorInjected,
                                dividers: $preview.find('.folder-preview-divider').length,
                                color: divider?.style.borderColor || '' });
                            document.querySelectorAll('[data-color-injected]').forEach(node => node.remove());
                        }
                    }
                }
            }
            return results;
        });
        assert.equal(results.length, 42);
        for (const result of results) {
            const label = `${result.apiName}/${result.method}/${result.field}`;
            assert.equal(result.executed, 0, `${label} must not execute a color as script`);
            assert.equal(result.injected, 0, `${label} must not interpret a color as markup`);
            assert.equal(result.dividers, 1, `${label} preserves divider layout`);
            if (result.malicious) assert.equal(result.color, '', label);
            if (!result.malicious) assert.ok(result.color, `${label} preserves valid CSS colors`);
        }
    });
};
