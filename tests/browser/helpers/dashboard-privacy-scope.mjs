import assert from 'node:assert/strict';

export const checkDashboardPrivacyScope = async (page, baseUrl) => {
    const url = baseUrl + '/dashboard-privacy-scope';
    await page.route(url, route => route.fulfill({ contentType: 'text/html', body: `
        <!doctype html><html lang="en"><head><title>Dashboard privacy fixture</title></head><body><main>
            <table>
                <tbody id="docker_view"><tr><td><a id="docker-url" href="https://docker.invalid/">Docker WebUI</a></td></tr></tbody>
                <tbody id="vm_view"><tr><td><a id="vm-url" href="https://vm.invalid/">VM WebUI</a></td></tr></tbody>
            </table>
            <div class="fv-dashboard-advanced-preview"><a id="preview-url" href="https://preview.invalid/">Preview WebUI</a></div>
        </main></body></html>` }));
    await page.goto(url);
    await page.addStyleTag({ url: baseUrl + '/plugin/styles/dashboard.css' });
    await page.addScriptTag({ url: baseUrl + '/plugin/scripts/runtime.privacy.js' });
    const states = async (docker, vm) => {
        await page.evaluate(([docker, vm]) => {
            window.FolderViewPlusRuntimePrivacy.apply('docker', docker, { privacyMaskExternalUrls: docker });
            window.FolderViewPlusRuntimePrivacy.apply('vm', vm, { privacyMaskExternalUrls: vm });
        }, [docker, vm]);
        await page.waitForFunction(() => document.querySelectorAll('.fvplus-sensitive-external-url').length === 3);
        return page.locator('main a').evaluateAll(links => links.map(link => getComputedStyle(link).pointerEvents));
    };
    assert.deepEqual(await states(false, true), ['auto', 'none', 'auto']);
    assert.deepEqual(await states(true, false), ['none', 'auto', 'none']);
    assert.deepEqual(await states(true, true), ['none', 'none', 'none']);
};
