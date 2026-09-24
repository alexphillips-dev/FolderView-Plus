import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(process.cwd(),
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.js'), 'utf8');
const signatureSource = source.match(/const getSettingsSectionRegistrySignature = \(\) =>[\s\S]*?\n    \.join\('\|'\);/)?.[0];
const buildSource = source.match(/const buildSettingsSections = \(options = \{\}\) => \{[\s\S]*?\n\};/)?.[0];
assert.ok(signatureSource && buildSource, 'Settings section builder must be present');

export const verifyAdvancedTitleBadges = async (page) => {
    await page.addScriptTag({ content: `(() => {
        const settingsUiState = { sections: [] };
        let settingsSectionRegistrySignature = '';
        const slugifySectionKey = (value) => String(value || '').toLowerCase().replace(/[^a-z]+/g, '-');
        const ADVANCED_SECTION_KEYS = new Set(['runtime-actions']);
        const ADVANCED_GROUP_BY_SECTION = {};
        const normalizeAdvancedGroup = (value) => value;
        const invalidateTrackedSettingsInputs = () => {};
        const invalidateSettingsSearchIndex = () => {};
        ${signatureSource}
        ${buildSource}
        const root = document.getElementById('fv-settings-root');
        root.insertAdjacentHTML('beforeend', '<h2 data-fv-section="docker">Docker</h2>');
        document.getElementById('fv-advanced-content').insertAdjacentHTML('beforeend',
            '<h2 data-fv-section="diagnostics" data-fv-advanced="1">Diagnostics<span class="fv-section-badge">all good</span><span class="fv-section-mode">-</span></h2>');
        buildSettingsSections({ force: true });
        const basicMode = settingsUiState.sections.find((section) => section.key === 'docker').modeBadge;
        basicMode.hidden = true;
        window.fixtureAdvancedTitleBadges = {
            advanced: settingsUiState.sections.filter((section) => section.advanced).map((section) => ({
                badge: section.badge, modeBadge: section.modeBadge,
                rendered: section.heading.querySelectorAll('.fv-section-badge, .fv-section-mode').length
            })),
            basic: settingsUiState.sections.find((section) => section.key === 'docker')?.heading
                .querySelectorAll('.fv-section-badge, .fv-section-mode').length,
            hiddenBasicMode: getComputedStyle(basicMode).display
        };
    })();` });
    const result = await page.evaluate(() => window.fixtureAdvancedTitleBadges);
    assert.deepEqual(result, {
        advanced: [{ badge: null, modeBadge: null, rendered: 0 }, { badge: null, modeBadge: null, rendered: 0 }],
        basic: 2,
        hiddenBasicMode: 'none'
    });
};
