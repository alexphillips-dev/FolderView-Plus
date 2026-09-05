import assert from 'node:assert/strict';

export const registerDiagnosticsOrphanFixtureCases = ({ test, baseUrl }) => {
    test('German orphan findings wrap host button styles and show both Docker and VM details', async ({ page }) => {
        await page.goto(`${baseUrl}/settings`, { waitUntil: 'load' });
        await page.emulateMedia({ reducedMotion: 'reduce' });
        // Reproduce the host's typography that the ordinary Settings fixture does not supply.
        await page.addStyleTag({ content: `
            html { font-size: 10px; }
            button[type="button"] { white-space: nowrap; letter-spacing: 1.8px; text-transform: uppercase; }
        ` });
        await page.evaluate(async () => {
            const catalog = await fetch('/plugin/langs/namespaces/de/diagnostics.json').then((response) => response.json());
            const t = (key, fallback, ...params) => (catalog[key] || fallback)
                .replace(/\$(\d+)/g, (token, index) => String(params[Number(index) - 1] ?? token));
            const report = { privacyMode: 'full', types: {} };
            for (const type of ['docker', 'vm']) {
                report.types[type] = {
                    integrityChecks: { issuesCount: type === 'docker' ? 4 : 1, orphanedMembers: {
                        count: type === 'docker' ? 4 : 1,
                        folders: [{ folderId: 'fixture-folder', count: type === 'docker' ? 4 : 1, items: ['missing-fixture-item'] }]
                    } },
                    stateSnapshot: { folders: { 'fixture-folder': { folderName: 'FolderWithAnExtremelyLongUnbrokenName'.repeat(3) } } }
                };
            }
            const view = window.FolderViewPlusDiagnosticsView.createApi({
                window, document, t,
                escapeHtml: window.FolderViewPlusUI.escapeHtml,
                svgIcon: window.FolderViewPlusUI.svgIcon
            });
            const cards = view.decorateCardsWithRecommendedActions([
                { key: 'docker', status: 'error' }, { key: 'vm', status: 'error' },
                { key: 'storage', status: 'healthy' }, { key: 'custom_icons', status: 'healthy' },
                { key: 'update', status: 'healthy' }, { key: 'theme', status: 'healthy' }
            ].map((card) => ({ ...card, label: card.key, freshness: t('diagnostics.cards.checked', 'Checked $1', '5.9.2026, 16:59:55') })), report, {
                recommendedActions: [{ action: 'repair_orphaned_members' }]
            });
            const model = window.FolderViewPlusDiagnosticsViewModel.buildDiagnosticsViewModel({ hasResults: true, coreCards: cards });
            const host = document.getElementById('fv-diagnostics-summary');
            view.bindActions();
            view.render(host, model);
            view.render(host, model);
        });
        await page.locator('[data-fv-ui-action="diagnostics-focus-card"][aria-controls="fv-diagnostics-card-vm"]').focus();
        await page.keyboard.press('Enter');
        await page.waitForFunction(() => document.querySelector('#fv-diagnostics-card-vm details').open);
        assert.equal(await page.locator('#fv-diagnostics-card-vm details').evaluate((node) => node.open), true);
        assert.equal(await page.locator('#fv-diagnostics-card-vm').evaluate((node) => node === document.activeElement), true);
        await page.locator('#fv-diagnostics-card-docker details').evaluate((node) => { node.open = true; });
        assert.equal(await page.locator('[data-fv-ui-action="diagnostics-repair"]').count(), 2);
        for (const width of [1670, 1400, 1180, 700, 375]) {
            await page.setViewportSize({ width, height: 1000 });
            const cards = await page.locator('#fv-diagnostics-card-docker, #fv-diagnostics-card-vm').evaluateAll((nodes) => nodes.map((card) => {
                const rect = card.getBoundingClientRect();
                const title = card.querySelector('strong');
                const button = card.querySelector('.fv-diagnostics-context-action');
                const label = button.querySelector('span');
                return {
                    titleFits: title.scrollWidth <= title.clientWidth + 1,
                    labelFits: label.scrollWidth <= label.clientWidth + 1,
                    contentsFit: card.scrollWidth <= card.clientWidth + 1,
                    buttonFits: button.getBoundingClientRect().right <= rect.right,
                    buttonHeight: button.getBoundingClientRect().height,
                    text: card.textContent,
                    whiteSpace: getComputedStyle(button).whiteSpace
                };
            }));
            for (const card of cards) {
                assert.equal(card.titleFits && card.labelFits && card.contentsFit && card.buttonFits, true, `${width}px card overflow: ${JSON.stringify(card)}`);
                assert.equal(card.whiteSpace, 'normal');
                assert.ok(card.buttonHeight >= 36);
                assert.match(card.text, /missing-fixture-item/);
                assert.match(card.text, /Docker- und VM-Ordnern/);
                assert.doesNotMatch(card.text, /Missing references|Checked|Remove missing/);
            }
        }
    });
};
