import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createDockerBadgeHost } from '../helpers/folder-badges-host.mjs';

const scripts = 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts';
const endpoint = '**/plugins/folderview.plus/server/docker_runtime_preview.php';
const id = 'a'.repeat(64);

function installTooltipsterFixture() {
    const $ = window.jQuery;
    $.fn.tabs ??= function () { return this; };
    if (typeof $.fn.tooltipster === 'function') return;
    const instances = new Map();
    $.fn.tooltipster = function (options) {
        if (typeof options === 'string') {
            const instance = instances.get(this[0]);
            return options === 'instance' ? instance : (instance?.[options]?.(), this);
        }
        return this.each(function () {
            const origin = this;
            let tooltip;
            let state = 'closed';
            let content = options.content;
            const listeners = new Set();
            const setState = next => {
                state = next;
                listeners.forEach(listener => listener({ state }));
            };
            const instance = {
                status: () => ({ state, open: state === 'stable' }),
                on: (_event, listener) => listeners.add(listener),
                off: (_event, listener) => listeners.delete(listener),
                content(next) {
                    content = next;
                    tooltip?.find('.tooltipster-content').empty().append(next);
                },
                open() {
                    if (state !== 'closed' || options.functionBefore?.(instance, { origin }) === false) return;
                    setState('appearing');
                    tooltip = $('<div class="tooltipster-docker-folder"><div class="tooltipster-box"><div class="tooltipster-content"></div></div></div>').appendTo(document.body);
                    tooltip.find('.tooltipster-content').append(content);
                    options.functionReady?.(instance, { origin, tooltip: tooltip[0] });
                    setState('stable');
                },
                close() {
                    if (state === 'closed') return;
                    const node = tooltip[0];
                    setState('disappearing');
                    tooltip.find('.tooltipster-content').children().detach();
                    tooltip.remove();
                    tooltip = null;
                    setState('closed');
                    options.functionAfter?.(instance, { origin, tooltip: node });
                },
                destroy() {
                    instance.close();
                    instances.delete(origin);
                    $(origin).removeClass('tooltipstered').off('.fixtureTooltip');
                }
            };
            instances.set(origin, instance);
            $(origin).addClass('tooltipstered').on('click.fixtureTooltip', () => instance.open());
        });
    };
    $.tooltipster = { instances: () => [...instances.values()] };
}

async function installDashboardEntry(page, baseUrl) {
    await page.route('**/plugins/dynamix.docker.manager/images/question.png',
        route => route.fulfill({ path: path.join(scripts, '../images/folder-icon.png') }));
    await page.goto(`${baseUrl}/dashboard-layout`, { waitUntil: 'load' });
    await page.evaluate(installTooltipsterFixture);
    await page.evaluate(() => {
        document.head.insertAdjacentHTML('beforeend', '<meta name="fv-request-token" content="fixture-dashboard-request-token">');
        document.body.insertAdjacentHTML('beforeend', '<span id="fixture-preview-member" data-fv-runtime-name="fixture"><span class="hand" tabindex="0">Synthetic Dashboard member</span></span>');
    });
    for (const name of [
        'folderviewplus.request-diagnostics.js', 'folderviewplus.request-transport.js', 'folderviewplus.request.js',
        'runtime.preview-summary.js', 'dashboard.advanced-preview.js'
    ]) await page.addScriptTag({ url: `${baseUrl}/plugin/scripts/${name}` });
    const source = fs.readFileSync(path.join(scripts, 'dashboard.js'), 'utf8');
    const start = source.indexOf('const attachDashboardAdvancedPreviewIfEnabled =');
    const end = source.indexOf('const appendDashboardDockerMemberQuickActions =', start);
    const normalizeStart = source.indexOf('const normalizeDashboardRuntimeInfoMap =');
    const normalizeEnd = source.indexOf('const getDashboardRuntimeStateMeta =', normalizeStart);
    assert.ok(start >= 0 && end > start && normalizeStart >= 0 && normalizeEnd > normalizeStart);
    await page.addScriptTag({ content: `(() => {
        const $ = window.jQuery;
        const dashboardAdvancedPreviewApi = window.FolderViewPlusDashboardAdvancedPreview.createApi({window, document, $});
        const getDashboardRuntimeStateMeta = () => ({active: true, paused: false});
        ${source.slice(normalizeStart, normalizeEnd)}
        const dashboardRuntimeInfoByType = {docker: normalizeDashboardRuntimeInfoMap('docker', {fixture: {
            id: '${id.slice(0, 12)}', fullContainerId: '${id}'
        }})};
        const dashboardDockerCpuCores = 1;
        const getDashboardAdvancedPreviewSettings = () => ({ previewContext: 'advanced', previewTrigger: 'click', previewGraph: 0 });
        const resolveDashboardPreviewActionPrefs = () => ({});
        ${source.slice(start, end)}
        const $member = $('#fixture-preview-member');
        attachDashboardAdvancedPreviewIfEnabled($member, dashboardRuntimeInfoByType.docker.fixture, {}, 'fixture');
        window.fixtureChangeRuntimeIdentity = () => {
            dashboardRuntimeInfoByType.docker.fixture = {fullContainerId: 'b'.repeat(64)};
            $member.attr('data-fv-runtime-state', 'replaced');
        };
    })();` });
    return page.locator('#fixture-preview-member > .hand');
}

const payload = value => ({ ok: true, summary: {
    composeProject: value,
    composeService: 'service-name',
    restartPolicy: 'always',
    networkMode: 'container',
    environment: [
        { name: 'PUBLIC_NAME', overridden: true, value: 'never-render-value' },
        { name: 'OTHER_NAME', overridden: null },
        { name: '<i>forbidden</i>', overridden: false }
    ]
} });

async function captureRequests(page) {
    const pending = [];
    const record = [];
    await page.route(endpoint, route => {
        const item = { request: route.request(), respond: project => route.fulfill({ json: payload(project) }) };
        const index = pending.push(item) - 1;
        record[index]?.(item);
    });
    return {
        count: () => pending.length,
        at: index => pending[index] || new Promise(resolve => { record[index] = resolve; })
    };
}

export const registerRuntimePreviewSummaryCases = ({ test, baseUrl }) => {
    test('Runtime preview summary loads lazily through the Docker folder tooltip', async ({ page }) => {
        const host = await createDockerBadgeHost(page);
        Object.assign(host.folders.direct.settings, { preview: 1, context: 2, context_trigger: 0 });
        const member = host.runtime[host.folders.direct.containers[0]];
        member.fullContainerId = member.id;
        member.id = member.id.slice(0, 12);
        delete member.info;
        // Supply the synthetic native widget hooks before Plus takes ownership.
        await page.addInitScript({ content: `document.addEventListener('DOMContentLoaded', () => {
            if (!window.jQuery) return;
            (${installTooltipsterFixture.toString()})();
            const load = window.loadlist;
            window.loadlist = (...args) => {
                const result = load(...args);
                document.querySelectorAll('#docker_list > tr > td.ct-name > span.outer > img').forEach(img => {
                    const hand = document.createElement('span');
                    hand.className = 'hand';
                    img.before(hand);
                    hand.append(img);
                });
                return result;
            };
        });` });
        const pending = await captureRequests(page);
        try {
            await page.goto(host.url, { waitUntil: 'load' });
            const trigger = page.locator(`#folder-preview-${member.id}`).first();
            await trigger.click();
            const details = page.locator('.fv-runtime-preview-summary');
            await details.waitFor();
            assert.equal(await details.evaluate(node => node.open), false);
            assert.equal(pending.count(), 0);
            const outgoing = page.waitForRequest(endpoint);
            await details.locator('summary').click();
            await outgoing;
            const { request, respond } = await pending.at(0);
            assert.equal(request.method(), 'GET');
            assert.equal(request.headers()['x-fv-container'], member.fullContainerId);
            assert.equal(request.headers()['x-fv-surface'], 'docker');
            assert.equal(request.headers()['x-fv-request'], '1');
            assert.ok(request.headers()['x-fv-token']);
            await respond('docker-project');
            await details.getByText('docker-project', { exact: true }).waitFor();
            assert.ok(await details.getByText('Overridden', { exact: true }).count());
            assert.doesNotMatch(await details.innerText(), /never-render-value|forbidden/);
            await page.evaluate(name => window.fixtureDockerBadges.refresh([name]), host.folders.direct.containers[0]);
            await page.waitForFunction(() => document.querySelector('.fv-runtime-preview-summary')?.open === false);
            assert.doesNotMatch(await details.textContent(), /docker-project|PUBLIC_NAME/);
            assert.equal(pending.count(), 1);
            await trigger.evaluate(node => window.jQuery(node).tooltipster('close'));
            await details.waitFor({ state: 'detached' });
            await trigger.click();
            assert.equal(await details.evaluate(node => node.open), false);
            assert.equal(pending.count(), 1);
        } finally {
            await page.unrouteAll({ behavior: 'ignoreErrors' });
            await page.goto('about:blank');
            await host.close();
        }
    }, { skipAccessibility: true });

    test('Runtime preview summary drops stale Dashboard data on close, privacy and identity replacement', async ({ page }) => {
        const trigger = await installDashboardEntry(page, baseUrl);
        const pending = await captureRequests(page);
        const details = page.locator('.fv-runtime-preview-summary');
        const toggle = () => details.locator('summary').press('Enter');
        const expectRequest = async index => {
            const request = page.waitForRequest(endpoint);
            await toggle();
            await request;
            return pending.at(index);
        };
        await trigger.click();
        assert.equal(await details.evaluate(node => node.open), false);
        assert.equal(pending.count(), 0);
        const initial = await expectRequest(0);
        const { request } = initial;
        assert.equal(request.headers()['x-fv-container'], id);
        assert.equal(request.headers()['x-fv-surface'], 'dashboard');
        assert.equal(request.postData(), null);
        assert.equal(new URL(request.url()).search, '');
        const aborted = page.waitForEvent('requestfailed', failed => failed === request);
        await trigger.evaluate(node => window.jQuery(node).tooltipster('close'));
        await details.waitFor({ state: 'detached' });
        await aborted;
        await trigger.click();
        await (await expectRequest(1)).respond('current-project');
        await details.getByText('current-project', { exact: true }).waitFor();
        await initial.respond('stale-project').catch(() => {});
        assert.doesNotMatch(await details.innerText(), /stale-project/);
        await page.evaluate(() => document.body.classList.add('fvplus-privacy-docker-dashboard'));
        await details.waitFor({ state: 'hidden' });
        assert.doesNotMatch(await details.textContent(), /current-project|PUBLIC_NAME/);
        assert.equal(await details.evaluate(node => node.open), false);
        await page.evaluate(() => document.body.classList.remove('fvplus-privacy-docker-dashboard'));
        await details.waitFor();
        await (await expectRequest(2)).respond('restored-project');
        await details.getByText('restored-project', { exact: true }).waitFor();
        await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
        await details.waitFor();
        assert.equal(await details.evaluate(node => node.open), false);
        await (await expectRequest(3)).respond('after-restore');
        await details.getByText('after-restore', { exact: true }).waitFor();
        await page.evaluate(() => window.fixtureChangeRuntimeIdentity());
        await page.waitForFunction(() => !document.querySelector('.fv-runtime-preview-summary')?.open);
        await toggle();
        await details.getByText('Runtime details unavailable.', { exact: true }).waitFor();
        assert.equal(pending.count(), 4);
        const diagnostics = await page.evaluate(() => JSON.stringify([
            window.FolderViewPlusRequest.diagnostics(), window.FolderViewPlusRequest.failureDiagnostics()
        ]));
        assert.doesNotMatch(diagnostics, /PUBLIC_NAME|current-project|fixture-dashboard-request-token/);
        assert.ok(!diagnostics.includes(id));
    }, { skipAccessibility: true });
};
