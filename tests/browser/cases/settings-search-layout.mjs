import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const settingsPageSource = fs.readFileSync(path.join(process.cwd(),
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/FolderViewPlus.page'), 'utf8');
const basicToolbarMarkup = (type) => {
    const sectionName = type === 'docker' ? 'docker' : 'vms';
    const section = settingsPageSource.indexOf(`<h2 data-i18n="${sectionName}" data-fv-section="${sectionName}">`);
    const start = settingsPageSource.indexOf('<div class="folder-toolbar"', section);
    const end = settingsPageSource.indexOf(`<div id="${type}-basic-summary"`, start);
    assert.ok(section >= 0 && start > section && end > start, `${type} Basic toolbar markup must exist`);
    return settingsPageSource.slice(start, end);
};

export const verifySettingsSearchAlignment = async (page) => {
    const desktop = await page.evaluate(() => {
        const rect = (selector) => document.querySelector(selector).getBoundingClientRect();
        const search = rect('.fv-settings-search-wrap');
        const icon = rect('.fv-settings-search-icon');
        const input = rect('#fv-settings-search');
        const buttons = ['[data-mode="basic"]', '[data-mode="advanced"]', '#fv-run-wizard'].map(rect);
        return {
            searchCenter: (search.top + search.bottom) / 2,
            buttonCenters: buttons.map((box) => (box.top + box.bottom) / 2),
            iconInputGap: input.left - icon.right
        };
    });
    assert.ok(Math.max(...desktop.buttonCenters.map((center) => Math.abs(desktop.searchCenter - center))) <= 1.5,
        `search must be vertically centered with the buttons: ${JSON.stringify(desktop)}`);
    assert.ok(desktop.iconInputGap >= 6, 'search icon needs breathing room before the text');

    await page.locator('#fv-settings-search').click();
    await page.waitForFunction(() => {
        const input = document.querySelector('#fv-settings-search');
        const wrapper = input.closest('.fv-settings-search-wrap');
        const accent = document.createElement('span');
        accent.style.color = 'var(--fvplus-settings-accent)';
        wrapper.append(accent);
        const borderHasAccent = getComputedStyle(wrapper).borderTopColor === getComputedStyle(accent).color;
        accent.remove();
        return wrapper.matches(':focus-within') && borderHasAccent;
    });
    const focus = await page.evaluate(() => {
        const input = document.querySelector('#fv-settings-search');
        const wrapper = input.closest('.fv-settings-search-wrap');
        const accent = document.createElement('span');
        accent.style.color = 'var(--fvplus-settings-accent)';
        wrapper.append(accent);
        const colors = {
            outlineStyle: getComputedStyle(input).outlineStyle,
            wrapperBorder: getComputedStyle(wrapper).borderTopColor,
            accent: getComputedStyle(accent).color
        };
        accent.remove();
        return colors;
    });
    assert.equal(focus.outlineStyle, 'none', 'search input must not draw a second focus outline');
    assert.equal(focus.wrapperBorder, focus.accent, 'focused search box must retain its accent border');

    await page.setViewportSize({ width: 390, height: 720 });
    const mobile = await page.evaluate(() => {
        const icon = document.querySelector('.fv-settings-search-icon').getBoundingClientRect();
        const input = document.querySelector('#fv-settings-search').getBoundingClientRect();
        const search = document.querySelector('.fv-settings-search-wrap').getBoundingClientRect();
        return {
            iconInputGap: input.left - icon.right,
            searchWidth: search.width,
            searchLeft: search.left,
            searchRight: search.right,
            viewportWidth: window.innerWidth
        };
    });
    assert.ok(mobile.iconInputGap >= 6, 'mobile search icon needs breathing room before the text');
    assert.ok(mobile.searchWidth > 0 && mobile.searchLeft >= -1 && mobile.searchRight <= mobile.viewportWidth + 1,
        `mobile search field must fit within the viewport: ${JSON.stringify(mobile)}`);
};

export const verifyBasicToolbarLayout = async (page) => {
    await page.evaluate(({ docker, vm }) => {
        const host = document.createElement('div');
        host.innerHTML = `<section class="folder-table" data-toolbar-type="docker">${docker}</section>`
            + `<section class="folder-table" data-toolbar-type="vm">${vm}</section>`;
        const settingsRoot = document.querySelector('#fv-settings-root');
        if (matchMedia('(prefers-color-scheme: light)').matches) settingsRoot.dataset.fvThemeClass = 'light';
        settingsRoot.append(host);
    }, { docker: basicToolbarMarkup('docker'), vm: basicToolbarMarkup('vm') });
    for (const width of [1700, 1180, 390]) {
        await page.setViewportSize({ width, height: 720 });
        const layouts = await page.evaluate(() => ['docker', 'vm'].map((type) => {
            const toolbar = document.querySelector(`[data-toolbar-type="${type}"] .folder-toolbar`);
            const bounds = toolbar.getBoundingClientRect();
            const headerSearch = document.querySelector('.fv-settings-search-wrap').getBoundingClientRect();
            const controls = [...toolbar.querySelectorAll(
                '.fv-basic-search, .fv-basic-sort, .fv-basic-add-btn, .toolbar-actions > button'
            )].map((element) => {
                const rect = element.getBoundingClientRect();
                return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, height: rect.height };
            });
            const exportButton = toolbar.querySelector('.fv-basic-export-btn');
            const importButton = toolbar.querySelector('.fv-basic-import-btn');
            return {
                type, bounds: { left: bounds.left, right: bounds.right }, controls,
                headerHeight: headerSearch.height,
                toolbarGap: getComputedStyle(toolbar).columnGap,
                headerGap: getComputedStyle(document.querySelector('.fv-settings-right')).columnGap,
                exportColor: getComputedStyle(exportButton).color,
                importColor: getComputedStyle(importButton).color,
                exportBackground: getComputedStyle(exportButton).backgroundColor,
                importBackground: getComputedStyle(importButton).backgroundColor,
                restoreBackground: getComputedStyle(toolbar.querySelector('[data-fv-onclick^="restoreLatestBackup"]')).backgroundColor,
                filtersButton: [...toolbar.querySelectorAll('button')].some((button) => button.textContent.trim() === 'Filters')
            };
        }));
        for (const layout of layouts) {
            assert.equal(layout.controls.length, 7, `${layout.type} toolbar must contain search, sort, add, and four actions`);
            assert.equal(layout.filtersButton, false, `${layout.type} toolbar must not include a Filters button`);
            assert.equal(layout.toolbarGap, layout.headerGap, `${layout.type} toolbar spacing must match the Settings header`);
            assert.notEqual(layout.exportColor, layout.importColor, `${layout.type} Export and Import must have distinct colors`);
            assert.notEqual(layout.exportBackground, layout.restoreBackground, `${layout.type} Export must have a colored background`);
            assert.notEqual(layout.importBackground, layout.restoreBackground, `${layout.type} Import must have a colored background`);
            if (width >= 1180) {
                const tops = layout.controls.map((box) => box.top);
                assert.ok(Math.max(...tops) - Math.min(...tops) <= 2,
                    `${layout.type} controls must share one desktop row: ${JSON.stringify(layout)}`);
            }
            for (const [index, box] of layout.controls.entries()) {
                assert.ok(Math.abs(box.height - layout.headerHeight) <= 2,
                    `${layout.type} toolbar control height must match the Settings header at ${width}px: ${JSON.stringify(layout)}`);
                assert.ok(box.left >= layout.bounds.left - 1 && box.right <= layout.bounds.right + 1,
                    `${layout.type} toolbar control must fit at ${width}px: ${JSON.stringify(layout)}`);
                for (const other of layout.controls.slice(index + 1)) {
                    const overlapX = Math.min(box.right, other.right) - Math.max(box.left, other.left);
                    const overlapY = Math.min(box.bottom, other.bottom) - Math.max(box.top, other.top);
                    assert.ok(overlapX <= 1 || overlapY <= 1,
                        `${layout.type} toolbar controls must not overlap at ${width}px: ${JSON.stringify(layout)}`);
                }
            }
        }
    }
};
