import assert from 'node:assert/strict';

const preparePreviewNameFixture = async (page, baseUrl) => {
    await page.goto(`${baseUrl}/docker-layout-stability`, { waitUntil: 'load' });
    await page.evaluate(() => {
        const $ = window.jQuery;
        const shared = window.FolderViewDockerRuntimeShared;
        let nextId = 0;
        window.fixturePreviewNameEdits = [];
        window.fixturePreviewMenus = [];
        window.fixturePreviewQuickActions = 0;
        const api = window.FolderViewPlusDockerPreviewActions.createApi({
            window, $, document,
            grouping: window.FolderViewPlusFoundationModules.dockerFolderGrouping,
            isCompactMultiRowPreview: shared.isCompactMultiRowPreview,
            applyFolderPreviewLayout: shared.applyFolderPreviewLayout,
            layoutFolderPreviewRows: ($preview, settings) => {
                const wrappers = shared.flattenPreviewWrappers($preview);
                shared.finalizePreviewRows($preview, wrappers.map((wrapper) => [wrapper]), settings);
            }
        });
        const mount = (settings, { editable = true, nested = false, single = false, quickActions = true } = {}) => {
            const id = `name-edit-${++nextId}`;
            const name = `fixture-${id}`;
            const $host = $(`<table><tbody><tr class="folder-id-${id}"><td><div class="folder-storage"></div><div class="folder-preview"></div></td></tr></tbody></table>`).appendTo(document.body);
            const $storage = $host.find('.folder-storage');
            const $preview = $host.find('.folder-preview').attr('id', `preview-${id}`);
            const createSource = (version = 'original', canEdit = editable) => {
                const $row = $(`<tr class="sortable" id="ct-${name}"><td class="ct-name"><span class="outer"><span class="hand" id="native-${id}" onclick="window.fixturePreviewMenus.push(this.dataset.version)"><img class="img" alt="Container icon"></span><span class="inner"><span class="appname"></span><br><i class="fa fa-play started"></i><span class="state">started</span></span></span></td></tr>`);
                const $appname = $row.find('.appname');
                if (canEdit) {
                    $('<a class="exec" onclick="event.preventDefault();window.fixturePreviewNameEdits.push(this.dataset.version)"></a>').text(name).attr('data-version', version).appendTo($appname);
                } else $appname.text(name);
                $row.find('.hand').attr('data-version', version);
                return $row;
            };
            let $source = createSource().appendTo($storage);
            $storage.hide();
            let $item;
            if (single) {
                api.renderDockerSingleRowPreview({
                    $sourceRow: $source, $preview, selector: 'td.ct-name > span.outer',
                    previewMode: 1, context: 1, ctid: id, containerName: name
                });
                $item = $preview.children().first();
            } else {
                $item = $source.find('td.ct-name > span.outer').clone();
                // Model-based nested previews have a name anchor even when the native row does not.
                if (!editable) $item.find('.appname').empty().append($('<a class="exec"></a>').text(name));
                if (settings.preview === 2) $item.children('.inner').remove();
                if (settings.preview === 3 || settings.preview === 4) $item.children('.hand').remove();
                $item.attr('data-fv-container-id', id).attr('data-fv-container-name', name);
                $preview.append($item);
            }
            $item.addClass('fv-docker-preview-card');
            if (settings.preview_status === 'none') $item.find('i.fa, span.state, br').remove();
            const $quick = $('<span class="folder-element-custom-btn"><button type="button">Quick action</button></span>');
            $quick.on('click', (event) => {
                event.preventDefault(); event.stopPropagation(); window.fixturePreviewQuickActions += 1;
            });
            if (quickActions) $item.append($('<span class="fv-preview-actions-compact"></span>').append($quick));
            const bind = () => nested
                ? api.bindDockerNestedPreviewContext({ $item, entry: { name, id }, settings })
                : api.bindDockerPreviewDefaultContextBridge($item, $source, settings);
            if (!single) bind();
            $item.wrap('<div class="folder-preview-wrapper"></div>');
            const reflow = () => {
                shared.applyFolderPreviewLayout($preview, settings);
                const wrappers = shared.flattenPreviewWrappers($preview);
                shared.finalizePreviewRows($preview, wrappers.map((wrapper) => [wrapper]), settings);
            };
            reflow();
            return {
                api, id, name, $item, $preview, bind, reflow,
                replaceSource(version, canEdit = editable) {
                    const $replacement = createSource(version, canEdit);
                    $source.replaceWith($replacement);
                    $source = $replacement;
                },
                removeSource() { $source.remove(); },
                dispose() { $host.remove(); }
            };
        };
        window.fixturePreviewNameEdit = { api, mount };
    });
};

export const exerciseDockerPreviewNameEdit = async ({ page, baseUrl }) => {
    await preparePreviewNameFixture(page, baseUrl);
    const results = await page.evaluate(() => {
        const { mount } = window.fixturePreviewNameEdit;
        const rows = [2, 3, 4, 0].map((preview_rows) => ({ preview_rows, preview_overflow: 'default' }));
        rows.push({ preview_rows: 1, preview_overflow: 'expand_row' }, { preview_rows: 1, preview_overflow: 'scroll' });
        const results = [];
        for (const layout of rows) {
            for (const preview of [1, 2, 3, 4]) {
                const fixture = mount({ ...layout, preview, context: 1 });
                const editBefore = window.fixturePreviewNameEdits.length;
                const menuBefore = window.fixturePreviewMenus.length;
                const name = fixture.$item.find('.appname')[0];
                const link = fixture.$item.find('[data-fv-preview-edit="native"]')[0];
                if (name) {
                    name.click();
                    link?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
                    link?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
                }
                const edited = window.fixturePreviewNameEdits.length - editBefore;
                const menuAfterNames = window.fixturePreviewMenus.length - menuBefore;
                const menuTarget = fixture.$item.find('[data-fv-preview-context="native"]')[0]
                    || fixture.$item.filter('[data-fv-preview-context="native"]')[0];
                menuTarget?.click();
                menuTarget?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
                fixture.$item.find('button')[0].click();
                results.push({
                    layout, preview, edited, menuAfterNames,
                    menus: window.fixturePreviewMenus.length - menuBefore,
                    role: link?.getAttribute('role') || null,
                    tabIndex: link?.getAttribute('tabindex') || null,
                    copiedHandlers: fixture.$item.find('[onclick], [oncontextmenu]').length
                });
                fixture.dispose();
            }
        }
        return { results, quickActions: window.fixturePreviewQuickActions };
    });
    for (const result of results.results) {
        const label = JSON.stringify({ ...result.layout, preview: result.preview });
        assert.equal(result.edited, result.preview === 2 ? 0 : 2, `${label}: name click and Enter must Edit exactly once each`);
        assert.equal(result.menuAfterNames, 0, `${label}: name activation must not open a context menu`);
        assert.equal(result.menus, 2, `${label}: icon/status click and Space must each open the menu`);
        assert.equal(result.role, result.preview === 2 ? null : 'link', `${label}: name must retain link semantics`);
        assert.equal(result.tabIndex, result.preview === 2 ? null : '0', `${label}: name must be keyboard reachable`);
        assert.equal(result.copiedHandlers, 0, `${label}: no native inline handlers may be copied`);
    }
    assert.equal(results.quickActions, 24, 'quick actions must bypass name and context-menu dispatch');

    const beforeInput = await page.evaluate(() => {
        window.fixturePreviewNameLive = window.fixturePreviewNameEdit.mount({ preview: 1, preview_rows: 2, context: 1 });
        return [window.fixturePreviewNameEdits.length, window.fixturePreviewMenus.length];
    });
    const preview = page.locator('[id^="preview-name-edit-"]').last();
    await preview.locator('[data-fv-preview-edit="native"]').click();
    await preview.locator('[data-fv-preview-edit="native"]').press('Enter');
    await preview.locator('[data-fv-preview-edit="native"]').press('Space');
    await preview.locator('[data-fv-preview-context="native"]').press('Enter');
    const counts = await page.evaluate(() => [window.fixturePreviewNameEdits.length, window.fixturePreviewMenus.length]);
    assert.deepEqual(counts.map((value, index) => value - beforeInput[index]), [2, 1], 'real pointer and keyboard input must separate Edit from the native menu');
};

export const exerciseDockerPreviewNameEditLifecycle = async ({ page, baseUrl }) => {
    await preparePreviewNameFixture(page, baseUrl);
    const result = await page.evaluate(() => {
        const { mount, api } = window.fixturePreviewNameEdit;
        const snapshot = () => [window.fixturePreviewNameEdits.length, window.fixturePreviewMenus.length];
        const fixture = mount({ preview: 1, preview_rows: 2, context: 1 });
        for (let pass = 0; pass < 3; pass += 1) { fixture.bind(); fixture.reflow(); }
        fixture.$item.find('.appname')[0].click();
        fixture.$item.find('.hand')[0].click();
        const rebound = snapshot();
        fixture.replaceSource('replacement');
        fixture.$item.find('.appname')[0].click();
        fixture.$item.find('.hand')[0].click();
        const replaced = snapshot();
        const usedReplacement = window.fixturePreviewNameEdits.at(-1) === 'replacement' && window.fixturePreviewMenus.at(-1) === 'replacement';
        fixture.api.syncDockerLeafFolderPreviewActions(fixture.id, { settings: { preview: 1, preview_rows: 2, context: 1 } }, {
            [fixture.name]: { name: fixture.name, id: fixture.id, state: false, paused: false }
        });
        fixture.$item.find('.appname')[0].click();
        const hydrated = snapshot();
        const hydratedStatus = fixture.$item.find('.state').text().trim();
        fixture.removeSource();
        fixture.$item.find('.appname')[0].click();
        fixture.$item.find('.hand')[0].click();
        const removed = snapshot();
        fixture.dispose();
        const nested = mount({ preview: 3, preview_rows: 2, context: 1 }, { nested: true });
        nested.$item.find('.appname')[0].click();
        const nestedResult = snapshot();
        nested.dispose();
        const unavailable = mount({ preview: 3, preview_rows: 2, context: 1 }, { editable: false, nested: true });
        unavailable.$item.find('.appname')[0].click();
        const noneditable = {
            counts: snapshot(), links: unavailable.$item.find('.appname a').length,
            editTargets: unavailable.$item.find('[data-fv-preview-edit]').length
        };
        unavailable.dispose();
        const single = mount({ preview: 1, preview_rows: 1, context: 1 }, { single: true });
        single.$item.find('.appname a')[0].click();
        const singleResult = snapshot();
        single.dispose();
        const off = mount({ preview: 1, preview_rows: 2, context: 0 }, { single: true });
        const offBound = api.bindDockerNestedPreviewContext({ $item: off.$item, entry: { name: off.name, id: off.id }, settings: { context: 0 } });
        let advancedCalls = 0;
        const advancedBound = api.bindDockerNestedPreviewContext({
            $item: off.$item, $tooltipTrigger: off.$item, entry: { name: off.name, id: off.id }, settings: { context: 2 },
            bindAdvancedContext: () => { advancedCalls += 1; return true; }
        });
        const otherModes = { offBound, advancedBound, advancedCalls, nativeEditTargets: off.$item.find('[data-fv-preview-edit]').length };
        off.dispose();
        const hiddenStatus = [3, 4].map((preview) => {
            const hidden = mount({ preview, preview_rows: 2, context: 1, preview_status: 'none' }, { quickActions: false });
            const before = snapshot();
            const $name = hidden.$item.find('[data-fv-preview-edit="native"]');
            $name[0]?.click();
            $name[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
            $name[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
            const after = snapshot();
            const details = {
                actions: after.map((value, index) => value - before[index]),
                nestedInButton: $name.parents('[role="button"], button').length,
                visibleStatus: hidden.$item.find('.state').length
            };
            if (preview === 3) hidden.dispose();
            return details;
        });
        return { rebound, replaced, usedReplacement, hydrated, hydratedStatus, removed, nestedResult, noneditable, singleResult, otherModes, hiddenStatus };
    });
    assert.deepEqual(result.rebound, [1, 1], 'rebinding and reflow must preserve exactly one handler per action');
    assert.deepEqual(result.replaced, [2, 2], 'activation must resolve the replacement native source row');
    assert.equal(result.usedReplacement, true, 'both actions must reach current native handlers');
    assert.deepEqual(result.hydrated, [3, 2], 'status hydration must preserve the Edit action');
    assert.equal(result.hydratedStatus, 'stopped', 'the hydration control must actually update the rendered status');
    assert.deepEqual(result.removed, [3, 2], 'removed source rows must not dispatch stale Edit or menu actions');
    assert.deepEqual(result.nestedResult, [4, 2], 'nested aggregate member names must use the same Edit behavior');
    assert.deepEqual(result.noneditable, { counts: [4, 2], links: 0, editTargets: 0 }, 'Compose/no-template names must remain plain text');
    assert.deepEqual(result.singleResult, [5, 2], 'single-row native preview editing must remain unchanged');
    assert.deepEqual(result.otherModes, { offBound: false, advancedBound: true, advancedCalls: 1, nativeEditTargets: 0 });
    assert.deepEqual(result.hiddenStatus, [3, 4].map(() => ({ actions: [2, 0], nestedInButton: 0, visibleStatus: 0 })), 'name-only previews without status must retain independent accessible Edit links');
};
