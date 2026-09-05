import assert from 'node:assert/strict';
import { registerDiagnosticsOrphanFixtureCases } from './diagnostics-orphans.mjs';
export const registerSettingsFixtureCases = ({ test, baseUrl }) => {
registerDiagnosticsOrphanFixtureCases({ test, baseUrl });
test('Settings chrome keeps search and mode controls aligned without clipping', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 720 });
    await page.goto(`${baseUrl}/settings`, { waitUntil: 'load' });
    const metrics = await page.evaluate(() => {
        const rect = (selector) => document.querySelector(selector).getBoundingClientRect();
        const search = rect('.fv-settings-search-wrap');
        const basic = rect('[data-mode="basic"]');
        const advanced = rect('[data-mode="advanced"]');
        const wizard = rect('#fv-run-wizard');
        return {
            searchRight: search.right,
            basicLeft: basic.left,
            tops: [basic.top, advanced.top, wizard.top],
            heights: [basic.height, advanced.height, wizard.height],
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth
        };
    });
    assert.ok(metrics.searchRight <= metrics.basicLeft + 1, 'search must not overlap the Basic button');
    assert.ok(Math.max(...metrics.tops) - Math.min(...metrics.tops) <= 2, 'mode and Wizard buttons must share a row');
    assert.ok(Math.max(...metrics.heights) - Math.min(...metrics.heights) <= 4, 'mode and Wizard buttons should have compatible heights');
    assert.ok(metrics.scrollWidth <= metrics.clientWidth + 1, 'Settings chrome must not cause horizontal overflow');
    assert.equal(await page.locator('#fv-settings-clear-search').isHidden(), true);
    await page.locator('#fv-settings-clear-search').evaluate((button) => { button.hidden = false; });
    const clearBox = await page.locator('#fv-settings-clear-search').boundingBox();
    assert.ok(clearBox.width <= 40 && clearBox.height <= 40, 'clear search control must stay compact');
});
test('Filters and view settings uses the responsive card workspace without clipping', async ({ page }) => {
    const readLayout = async () => page.evaluate(async () => {
        await window.fixtureSettings.viewSettingsReady;
        const panel = document.getElementById('docker-view-settings');
        const grid = panel.querySelector('.fv-view-settings-grid');
        const cards = [...grid.children];
        const panelRect = panel.getBoundingClientRect();
        const gridColumns = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length;
        return {
            cardCount: cards.length,
            gridColumns,
            panelWidth: panelRect.width,
            cardsInsidePanel: cards.every((card) => {
                const rect = card.getBoundingClientRect();
                return rect.left >= panelRect.left - 1 && rect.right <= panelRect.right + 1;
            }),
            privacyIsCard: document.getElementById('docker-dashboard-privacy-options')?.closest('.fv-settings-card-privacy') !== null,
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth
        };
    });

    await page.setViewportSize({ width: 1700, height: 980 });
    await page.goto(`${baseUrl}/settings`, { waitUntil: 'load' });
    let layout = await readLayout();
    assert.equal(layout.cardCount, 8);
    assert.equal(layout.gridColumns, 4);
    assert.equal(layout.cardsInsidePanel, true);
    assert.equal(layout.privacyIsCard, true);
    assert.ok(layout.scrollWidth <= layout.clientWidth + 1, 'desktop panel must not cause horizontal overflow');

    await page.setViewportSize({ width: 1200, height: 900 });
    layout = await readLayout();
    assert.equal(layout.gridColumns, 2);
    assert.equal(layout.cardsInsidePanel, true);
    assert.ok(layout.scrollWidth <= layout.clientWidth + 1, 'tablet panel must not cause horizontal overflow');

    await page.setViewportSize({ width: 700, height: 900 });
    layout = await readLayout();
    assert.equal(layout.gridColumns, 1);
    assert.equal(layout.cardsInsidePanel, true);
    assert.ok(layout.scrollWidth <= layout.clientWidth + 1, 'mobile panel must not cause horizontal overflow');
});

test('Diagnostics workspace renders stable health states without desktop or mobile overflow', async ({ page }) => {
    const readDiagnosticsLayout = async () => page.evaluate(async () => {
        await window.fixtureSettings.diagnosticsReady;
        const workspace = document.getElementById('fv-diagnostics-workspace');
        const coreGrid = workspace.querySelector('.fv-diagnostics-card-section.is-system .fv-diagnostics-health-grid');
        const additionalSection = workspace.querySelector('.fv-diagnostics-card-section.is-additional');
        const workspaceRect = workspace.getBoundingClientRect();
        const cards = [...workspace.querySelectorAll('.fv-diagnostics-health-card')];
        const systemCards = [...coreGrid.querySelectorAll('.fv-diagnostics-health-card')];
        const systemFooters = systemCards.map((card) => card.querySelector('.fv-diagnostics-health-card-foot'));
        const themeFooter = coreGrid.querySelector('[data-fv-diagnostics-card="theme"] .fv-diagnostics-health-card-foot');
        const toolbarButtons = [...workspace.querySelectorAll('.fv-diagnostics-toolbar > .fv-ui-button')];
        const hero = workspace.querySelector('.fv-diagnostics-hero');
        const metricsGrid = workspace.querySelector('.fv-diagnostics-metrics');
        const coreProgress = workspace.querySelector('.fv-diagnostics-core-progress');
        const coreProgressFill = coreProgress?.firstElementChild;
        const coreMetric = coreProgress?.closest('.fv-diagnostics-metric');
        const systemIcons = [...workspace.querySelectorAll('.fv-diagnostics-health-card-icon .fv-ui-svg-icon')];
        const storageUpdateIcons = [...workspace.querySelectorAll(
            '.fv-diagnostics-health-card-icon:is(.is-storage, .is-update) .fv-ui-svg-icon'
        )];
        const metricIcons = [...workspace.querySelectorAll('.fv-diagnostics-metric.has-icon > .fv-ui-svg-icon')];
        const metricTitles = [...workspace.querySelectorAll('.fv-diagnostics-metrics dt')];
        const metrics = [...workspace.querySelectorAll('.fv-diagnostics-metrics > div')];
        const supportCards = [...workspace.querySelectorAll('.fv-support-bundle-section-card')];
        const supportIcons = [...workspace.querySelectorAll('.fv-support-bundle-section-icon .fv-ui-svg-icon')];
        const supportIconTiles = [...workspace.querySelectorAll('.fv-support-bundle-section-icon')];
        const supportOverview = workspace.querySelector('.fv-support-bundle-overview');
        const supportSectionGrid = workspace.querySelector('.fv-support-bundle-section-grid');
        const supportOverviewDescription = workspace.querySelector('.fv-support-bundle-overview > p');
        const supportOverviewMeta = [...workspace.querySelectorAll('.fv-support-bundle-preview-meta > span')];
        const supportHeaderIcons = [...workspace.querySelectorAll(
            '.fv-diagnostics-support-card-head > div > .fv-ui-svg-icon'
        )];
        const privacyBadges = [...workspace.querySelectorAll('.fv-support-bundle-privacy-item > strong')];
        const privacyCard = workspace.querySelector('.fv-support-bundle-redaction-card');
        const privacySummary = workspace.querySelector('.fv-support-bundle-privacy-summary');
        const privacyItems = workspace.querySelector('.fv-support-bundle-privacy-items');
        const privacyStatusBadge = workspace.querySelector('.fv-support-bundle-privacy-summary .fv-diagnostics-status-badge');
        const privacyLink = workspace.querySelector('.fv-support-bundle-privacy-disclosure');
        const privacyOmittedBadge = workspace.querySelector('.fv-support-bundle-privacy-item.is-omitted > strong');
        const readableText = [...workspace.querySelectorAll(
            '.fv-diagnostics-health-card-foot, .fv-diagnostics-health-card-detail, .fv-diagnostics-metrics small, .fv-support-bundle-preview-meta'
        )];
        const primaryButton = workspace.querySelector('.fv-diagnostics-toolbar .fv-ui-button.is-primary');
        const neutralButton = workspace.querySelector('.fv-diagnostics-toolbar .fv-ui-button:not(.is-primary):not(.is-export)');
        const exportButton = workspace.querySelector('.fv-diagnostics-toolbar .fv-ui-button.is-export');
        const exportIcon = exportButton?.querySelector('i, .fv-ui-svg-icon');
        const primaryStyle = getComputedStyle(primaryButton);
        const neutralStyle = getComputedStyle(neutralButton);
        const exportStyle = getComputedStyle(exportButton);
        const accentProbe = document.createElement('span');
        accentProbe.style.color = 'var(--fvplus-settings-accent)';
        workspace.append(accentProbe);
        const accent = getComputedStyle(accentProbe).color;
        accentProbe.remove();
        const accentStrongProbe = document.createElement('span');
        accentStrongProbe.style.color = 'var(--fvplus-settings-accent-strong)';
        workspace.append(accentStrongProbe);
        const accentStrong = getComputedStyle(accentStrongProbe).color;
        accentStrongProbe.remove();
        const privacyContentBounds = privacySummary
            ? [...privacySummary.children].reduce((bounds, child) => {
                const rect = child.getBoundingClientRect();
                return {
                    left: Math.min(bounds.left, rect.left),
                    right: Math.max(bounds.right, rect.right)
                };
            }, { left: Number.POSITIVE_INFINITY, right: Number.NEGATIVE_INFINITY })
            : null;
        const privacyCardRect = privacyCard?.getBoundingClientRect();
        const privacySummaryRect = privacySummary?.getBoundingClientRect();
        const privacyItemsRect = privacyItems?.getBoundingClientRect();
        const privacyStatusBadgeRect = privacyStatusBadge?.getBoundingClientRect();
        const privacyLinkRect = privacyLink?.getBoundingClientRect();
        const privacyOmittedStyle = privacyOmittedBadge ? getComputedStyle(privacyOmittedBadge) : null;
        return {
            accentColor: accent,
            coreCards: coreGrid?.children.length || 0,
            additionalSectionVisible: additionalSection !== null,
            secondaryHealthCardsVisible: [...workspace.querySelectorAll('.fv-diagnostics-health-card-head > strong')]
                .some((label) => ['Performance advisories', 'Localization'].includes(label.textContent.trim())),
            technicalDetailsCount: workspace.querySelectorAll('.fv-diagnostics-card-details').length,
            coreColumns: getComputedStyle(coreGrid).gridTemplateColumns.split(' ').filter(Boolean).length,
            hasHealthySummary: workspace.querySelector('.fv-diagnostics-hero.is-healthy') !== null,
            hasClearFindings: workspace.querySelector('.fv-diagnostics-findings.is-clear') !== null,
            metricSvgIcons: metricIcons.length,
            metricIconWidths: metricIcons.map((icon) => icon.getBoundingClientRect().width),
            metricIconColors: metricIcons.map((icon) => getComputedStyle(icon).color),
            metricTitleSizes: metricTitles.map((title) => parseFloat(getComputedStyle(title).fontSize)),
            metricIconsAreTopLeft: metricIcons.every((icon) => {
                const metricRect = icon.closest('.fv-diagnostics-metric').getBoundingClientRect();
                const iconRect = icon.getBoundingClientRect();
                const leftOffset = iconRect.left - metricRect.left;
                const topOffset = iconRect.top - metricRect.top;
                return leftOffset >= 8 && leftOffset <= 16 && topOffset >= 8 && topOffset <= 16;
            }),
            metricCopyIsHorizontallyCentered: metrics
                .filter((metric) => metric.classList.contains('has-icon'))
                .every((metric) => {
                    const metricRect = metric.getBoundingClientRect();
                    const center = metricRect.left + (metricRect.width / 2);
                    return [...metric.querySelectorAll('dt, dd, small')].every((element) => {
                        const rect = element.getBoundingClientRect();
                        return Math.abs((rect.left + (rect.width / 2)) - center) <= 1;
                    });
                }),
            metricCopyIsVerticallyCentered: metrics
                .filter((metric) => metric.classList.contains('has-icon'))
                .every((metric) => {
                    const metricRect = metric.getBoundingClientRect();
                    const copy = [...metric.querySelectorAll('dt, dd, small')];
                    const copyTop = Math.min(...copy.map((element) => element.getBoundingClientRect().top));
                    const copyBottom = Math.max(...copy.map((element) => element.getBoundingClientRect().bottom));
                    return Math.abs(
                        ((copyTop + copyBottom) / 2)
                        - (metricRect.top + (metricRect.height / 2))
                    ) <= 2;
                }),
            metricTextIsCentered: metrics.every((metric) => {
                const metricRect = metric.getBoundingClientRect();
                const center = metricRect.left + (metricRect.width / 2);
                return [...metric.querySelectorAll('dt, dd, small')].every((element) => {
                    const rect = element.getBoundingClientRect();
                    return Math.abs((rect.left + (rect.width / 2)) - center) <= 1;
                });
            }),
            systemSvgIcons: systemIcons.length,
            systemIconWidths: systemIcons.map((icon) => icon.getBoundingClientRect().width),
            systemIconColors: systemIcons.map((icon) => getComputedStyle(icon).color),
            systemFooterBottomInsets: systemCards.map((card, index) => (
                card.getBoundingClientRect().bottom - systemFooters[index].getBoundingClientRect().bottom
            )),
            systemFooterLeftInsets: systemCards.map((card, index) => (
                systemFooters[index].getBoundingClientRect().left - card.getBoundingClientRect().left
            )),
            themeFooterLabel: themeFooter?.textContent.trim() || '',
            storageUpdateIconColors: storageUpdateIcons.map((icon) => getComputedStyle(icon).color),
            supportHeaderIconColors: supportHeaderIcons.map((icon) => getComputedStyle(icon).color),
            toolbarButtonCount: toolbarButtons.length,
            toolbarButtonLabels: toolbarButtons.map((button) => button.textContent.trim()),
            toolbarButtonHeights: toolbarButtons.map((button) => button.getBoundingClientRect().height),
            metricsGridVerticallyCentered: Boolean(hero && metricsGrid)
                && Math.abs(
                    (metricsGrid.getBoundingClientRect().top + (metricsGrid.getBoundingClientRect().height / 2))
                    - (hero.getBoundingClientRect().top + (hero.getBoundingClientRect().height / 2))
                ) <= 1,
            coreProgressRatio: coreProgress && coreProgressFill
                ? coreProgressFill.getBoundingClientRect().width / coreProgress.getBoundingClientRect().width
                : 0,
            coreProgressTrackRatio: coreProgress && coreMetric
                ? (() => {
                    const metricStyle = getComputedStyle(coreMetric);
                    const metricContentWidth = coreMetric.clientWidth
                        - parseFloat(metricStyle.paddingLeft)
                        - parseFloat(metricStyle.paddingRight);
                    return coreProgress.getBoundingClientRect().width / metricContentWidth;
                })()
                : 0,
            supportSvgIcons: supportIcons.length,
            supportIconWidths: supportIcons.map((icon) => icon.getBoundingClientRect().width),
            supportIconColors: supportIcons.map((icon) => getComputedStyle(icon).color),
            supportIconBackgrounds: supportIconTiles.map((icon) => getComputedStyle(icon).backgroundColor),
            supportCardHeights: supportCards.map((card) => card.getBoundingClientRect().height),
            supportCardsShareHeight: supportCards.length > 0
                && Math.max(...supportCards.map((card) => card.getBoundingClientRect().height))
                    - Math.min(...supportCards.map((card) => card.getBoundingClientRect().height)) <= 1,
            supportCardContentStartsAtTop: supportCards.every((card) => {
                const cardRect = card.getBoundingClientRect();
                const iconRect = card.querySelector('.fv-support-bundle-section-icon')?.getBoundingClientRect();
                const copyRect = card.querySelector('.fv-support-bundle-section-copy')?.getBoundingClientRect();
                return iconRect
                    && copyRect
                    && iconRect.top - cardRect.top <= 9
                    && copyRect.top - cardRect.top <= 9
                    && Math.abs(iconRect.top - copyRect.top) <= 1;
            }),
            supportBadgesCenteredAndLower: supportCards.every((card) => {
                const cardRect = card.getBoundingClientRect();
                const badgeRect = card.querySelector('.fv-support-bundle-section-badge')?.getBoundingClientRect();
                const copyRect = card.querySelector('.fv-support-bundle-section-copy')?.getBoundingClientRect();
                return badgeRect
                    && copyRect
                    && Math.abs(
                        (badgeRect.left + (badgeRect.width / 2))
                        - (cardRect.left + (cardRect.width / 2))
                    ) <= 1
                    && badgeRect.top >= copyRect.bottom + 4;
            }),
            supportCardsReachOverviewBottom: Boolean(supportOverview && supportSectionGrid)
                && supportOverview.getBoundingClientRect().bottom
                    - supportSectionGrid.getBoundingClientRect().bottom <= 14,
            supportOverviewDescription: supportOverviewDescription?.textContent.trim() || '',
            supportOverviewMeta: supportOverviewMeta.map((item) => item.textContent.trim()),
            supportIconsAreLeft: supportCards.every((card) => {
                const icon = card.querySelector('.fv-support-bundle-section-icon')?.getBoundingClientRect();
                const copy = card.querySelector('.fv-support-bundle-section-copy')?.getBoundingClientRect();
                return icon && copy && icon.left < copy.left;
            }),
            privacyBadgeCount: privacyBadges.length,
            privacyBadgesAreColored: privacyBadges.every((badge) => {
                const style = getComputedStyle(badge);
                return style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.borderTopColor !== 'rgba(0, 0, 0, 0)';
            }),
            privacyBadgeRadii: privacyBadges.map((badge) => parseFloat(getComputedStyle(badge).borderTopLeftRadius)),
            privacyContentLeftAligned: Boolean(privacyContentBounds && privacyCardRect)
                && privacyContentBounds.left - privacyCardRect.left <= 18,
            privacyContentVerticallyCentered: Boolean(privacySummaryRect && privacyCardRect)
                && Math.abs(
                    (privacySummaryRect.top + (privacySummaryRect.height / 2))
                    - (privacyCardRect.top + (privacyCardRect.height / 2))
                ) <= 2,
            privacyBadgesMatchStatusHeight: Boolean(privacyStatusBadgeRect)
                && privacyBadges.every((badge) => (
                    Math.abs(badge.getBoundingClientRect().height - privacyStatusBadgeRect.height) <= 1
                )),
            privacyBadgesCentered: Boolean(privacyItemsRect && privacyCardRect)
                && Math.abs(
                    (privacyItemsRect.left + (privacyItemsRect.width / 2))
                    - (privacyCardRect.left + (privacyCardRect.width / 2))
                ) <= 2,
            privacyOmittedBorderVisible: Boolean(privacyOmittedStyle)
                && parseFloat(privacyOmittedStyle.borderTopWidth) >= 1
                && privacyOmittedStyle.borderTopColor !== 'rgba(0, 0, 0, 0)'
                && privacyOmittedStyle.borderTopColor !== privacyOmittedStyle.backgroundColor,
            privacyCardHeight: privacyCardRect?.height || 0,
            privacyLinkUsesAccent: getComputedStyle(privacyLink).color === accentStrong,
            privacyLinkVisible: Boolean(privacyLinkRect)
                && privacyLinkRect.width > 0
                && privacyLinkRect.height > 0
                && getComputedStyle(privacyLink).opacity === '1',
            smallestSupportingTextPx: Math.min(...readableText.map((element) => parseFloat(getComputedStyle(element).fontSize))),
            primaryRestMatchesNeutral: primaryStyle.backgroundImage === 'none'
                && primaryStyle.backgroundColor === neutralStyle.backgroundColor
                && primaryStyle.borderTopColor === neutralStyle.borderTopColor
                && primaryStyle.color === neutralStyle.color,
            exportUsesSemanticColor: Boolean(exportIcon)
                && exportStyle.color === getComputedStyle(exportIcon).color
                && exportStyle.color !== neutralStyle.color
                && exportStyle.borderTopColor !== neutralStyle.borderTopColor,
            neutralAvoidsAccentTreatment: neutralStyle.color !== accent && neutralStyle.borderTopColor !== accent,
            cardsInsideWorkspace: cards.every((card) => {
                const rect = card.getBoundingClientRect();
                return rect.left >= workspaceRect.left - 1 && rect.right <= workspaceRect.right + 1;
            }),
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth
        };
    });

    await page.setViewportSize({ width: 1700, height: 1100 });
    await page.goto(`${baseUrl}/settings`, { waitUntil: 'load' });
    let layout = await readDiagnosticsLayout();
    assert.equal(layout.coreCards, 6);
    assert.equal(layout.additionalSectionVisible, false);
    assert.equal(layout.secondaryHealthCardsVisible, false);
    assert.equal(layout.technicalDetailsCount, 0);
    assert.ok(layout.coreColumns >= 4 && layout.coreColumns <= 6, 'desktop health cards must adapt to the available width');
    assert.equal(layout.hasHealthySummary, true);
    assert.equal(layout.hasClearFindings, true);
    assert.equal(layout.metricSvgIcons, 3);
    assert.equal(layout.metricIconWidths.every((width) => width >= 41), true);
    assert.equal(layout.metricIconColors.some((color) => color === 'rgb(0, 0, 0)'), false);
    assert.equal(layout.metricTitleSizes.every((size) => size >= 20.7), true);
    assert.equal(layout.metricIconsAreTopLeft, true);
    assert.equal(layout.metricCopyIsHorizontallyCentered, true);
    assert.equal(layout.metricCopyIsVerticallyCentered, true);
    assert.equal(layout.metricTextIsCentered, true);
    assert.equal(layout.systemSvgIcons, 6);
    assert.equal(layout.systemIconWidths.every((width) => width >= 32), true);
    assert.equal(layout.systemIconColors.some((color) => color === 'rgb(0, 0, 0)'), false);
    assert.ok(
        Math.max(...layout.systemFooterBottomInsets) - Math.min(...layout.systemFooterBottomInsets) <= 1,
        'System health timestamps should share one bottom inset'
    );
    assert.ok(
        Math.max(...layout.systemFooterLeftInsets) - Math.min(...layout.systemFooterLeftInsets) <= 1,
        'System health timestamps should share one left inset'
    );
    assert.match(layout.themeFooterLabel, /^Checked\s/);
    assert.doesNotMatch(layout.themeFooterLabel, /^Theme checked\s/);
    assert.equal(layout.storageUpdateIconColors.length, 2);
    assert.equal(layout.storageUpdateIconColors.every((color) => color !== 'rgb(0, 0, 0)' && color !== layout.accentColor), true);
    assert.equal(layout.supportHeaderIconColors.length, 2);
    assert.equal(layout.supportHeaderIconColors.every((color) => color !== 'rgb(0, 0, 0)' && color !== layout.accentColor), true);
    assert.equal(new Set(layout.supportHeaderIconColors).size, 2);
    assert.equal(layout.toolbarButtonCount, 3);
    assert.equal(layout.toolbarButtonLabels.some((label) => label === 'Copy issue report'), false);
    assert.equal(layout.toolbarButtonHeights.every((height) => height >= 35 && height <= 37), true);
    assert.ok(
        Math.max(...layout.toolbarButtonHeights) - Math.min(...layout.toolbarButtonHeights) <= 1,
        'diagnostics toolbar buttons should share one compact height'
    );
    assert.equal(layout.metricsGridVerticallyCentered, true);
    assert.ok(layout.coreProgressRatio > 0.98, 'healthy core progress bar should span the metric');
    assert.ok(
        layout.coreProgressTrackRatio >= 0.49 && layout.coreProgressTrackRatio <= 0.51,
        'core progress track should use half of the metric width'
    );
    assert.equal(layout.supportSvgIcons, 7);
    assert.equal(layout.supportIconWidths.every((width) => width >= 28), true);
    assert.equal(new Set(layout.supportIconColors).size, 7);
    assert.equal(new Set(layout.supportIconBackgrounds).size, 7);
    assert.equal(layout.supportIconsAreLeft, true);
    assert.equal(layout.supportCardContentStartsAtTop, true);
    assert.equal(layout.supportBadgesCenteredAndLower, true);
    assert.equal(layout.supportCardsReachOverviewBottom, true);
    assert.equal(layout.supportCardsShareHeight, true);
    assert.equal(layout.supportCardHeights.every((height) => height >= 70), true);
    assert.match(layout.supportOverviewDescription, /diagnostic data prepared for support/);
    assert.match(layout.supportOverviewDescription, /sanitized privacy profile before download/);
    assert.deepEqual(layout.supportOverviewMeta, [
        'Bundle schema: v2',
        'Section coverage: 7 of 7 included',
        'Preview generated: 2026-07-24T22:05:24Z'
    ]);
    assert.equal(layout.privacyBadgeCount, 4);
    assert.equal(layout.privacyBadgesAreColored, true);
    assert.equal(layout.privacyBadgeRadii.every((radius) => radius >= 5.9 && radius <= 6.1), true);
    assert.equal(layout.privacyContentLeftAligned, true);
    assert.equal(layout.privacyContentVerticallyCentered, true);
    assert.equal(layout.privacyBadgesMatchStatusHeight, true);
    assert.equal(layout.privacyBadgesCentered, true);
    assert.equal(layout.privacyOmittedBorderVisible, true);
    assert.ok(layout.privacyCardHeight < 60, 'privacy row should remain compact');
    assert.equal(layout.privacyLinkUsesAccent, true);
    assert.equal(layout.privacyLinkVisible, true);
    assert.ok(layout.smallestSupportingTextPx >= 17, 'supporting diagnostics text must remain readable');
    assert.equal(layout.primaryRestMatchesNeutral, true);
    assert.equal(layout.exportUsesSemanticColor, true);
    assert.equal(layout.neutralAvoidsAccentTreatment, true);
    assert.equal(layout.cardsInsideWorkspace, true);
    assert.ok(layout.scrollWidth <= layout.clientWidth + 1, 'desktop diagnostics must not overflow');

    const collapsedPrivacyDisclosure = await page.locator('.fv-support-bundle-privacy-disclosure').boundingBox();
    const collapsedPrivacyCard = await page.locator('.fv-support-bundle-redaction-card').boundingBox();
    await page.locator('.fv-support-bundle-privacy-header').click();
    const expandedPrivacy = await page.evaluate(() => {
        const details = document.querySelector('.fv-support-bundle-privacy-details');
        const card = document.querySelector('.fv-support-bundle-redaction-card');
        const disclosure = document.querySelector('.fv-support-bundle-privacy-disclosure');
        const arrow = disclosure?.querySelector('i');
        const explanation = document.querySelector('.fv-support-bundle-privacy-explanation');
        const definitionCards = [...(explanation?.querySelectorAll('dl > div') || [])];
        const longestDescription = definitionCards[0]?.querySelector('dd');
        if (longestDescription) {
            longestDescription.append(` ${'Additional verified privacy-handling context. '.repeat(6)}`);
        }
        const cardRect = card?.getBoundingClientRect();
        const disclosureRect = disclosure?.getBoundingClientRect();
        return {
            open: details?.open === true,
            cardRect: cardRect ? {
                left: cardRect.left,
                top: cardRect.top,
                right: cardRect.right,
                bottom: cardRect.bottom
            } : null,
            disclosureRect: disclosureRect ? {
                left: disclosureRect.left,
                top: disclosureRect.top,
                width: disclosureRect.width,
                height: disclosureRect.height
            } : null,
            arrowTransform: arrow ? getComputedStyle(arrow).transform : 'none',
            definitionCount: explanation?.querySelectorAll('dt').length || 0,
            descriptionCount: explanation?.querySelectorAll('dd').length || 0,
            definitionCardHeights: definitionCards.map((definition) => definition.getBoundingClientRect().height),
            definitionCardWidths: definitionCards.map((definition) => definition.getBoundingClientRect().width),
            definitionTitlesLeftAligned: definitionCards.every((definition) => {
                const title = definition.querySelector('dt');
                const definitionRect = definition.getBoundingClientRect();
                const titleRect = title?.getBoundingClientRect();
                return title
                    && titleRect
                    && getComputedStyle(title).textAlign === 'left'
                    && titleRect.left > definitionRect.left
                    && titleRect.left - definitionRect.left <= 14;
            }),
            text: explanation?.textContent || ''
        };
    });
    assert.equal(expandedPrivacy.open, true);
    assert.ok(collapsedPrivacyDisclosure && collapsedPrivacyCard && expandedPrivacy.disclosureRect && expandedPrivacy.cardRect);
    assert.ok(
        Math.abs(
            (collapsedPrivacyCard.x + collapsedPrivacyCard.width)
            - (collapsedPrivacyDisclosure.x + collapsedPrivacyDisclosure.width)
            - (expandedPrivacy.cardRect.right - (expandedPrivacy.disclosureRect.left + expandedPrivacy.disclosureRect.width))
        ) <= 1
            && Math.abs(
                (collapsedPrivacyDisclosure.y - collapsedPrivacyCard.y)
                - (expandedPrivacy.disclosureRect.top - expandedPrivacy.cardRect.top)
            ) <= 1,
        'privacy disclosure should remain anchored when expanded'
    );
    assert.notEqual(expandedPrivacy.arrowTransform, 'none', 'expanded privacy arrow should point down');
    assert.equal(expandedPrivacy.definitionCount, 4);
    assert.equal(expandedPrivacy.descriptionCount, 4);
    assert.equal(expandedPrivacy.definitionTitlesLeftAligned, true);
    assert.ok(
        Math.max(...expandedPrivacy.definitionCardHeights) - Math.min(...expandedPrivacy.definitionCardHeights) <= 1,
        'privacy definition cards should have equal heights'
    );
    assert.ok(
        Math.max(...expandedPrivacy.definitionCardWidths) - Math.min(...expandedPrivacy.definitionCardWidths) <= 1,
        'privacy definition cards should have equal widths'
    );
    assert.match(expandedPrivacy.text, /One-way identifiers link matching values/);
    assert.match(expandedPrivacy.text, /Partial context remains/);
    assert.match(expandedPrivacy.text, /Unneeded diagnostic fields are removed/);
    assert.match(expandedPrivacy.text, /Long values or lists are shortened and marked incomplete/);
    assert.match(expandedPrivacy.text, /fresh salt changes identifiers between bundles/);
    await page.locator('.fv-support-bundle-privacy-header').click();

    await page.locator('.fv-diagnostics-toolbar .fv-ui-button.is-primary').hover();
    await page.waitForTimeout(250);
    const healthHoverUsesAccent = await page.evaluate(() => {
        const workspace = document.getElementById('fv-diagnostics-workspace');
        const button = workspace.querySelector('.fv-diagnostics-toolbar .fv-ui-button.is-primary');
        const neutral = workspace.querySelector('.fv-diagnostics-toolbar .fv-ui-button:not(.is-primary):not(.is-export)');
        const accentProbe = document.createElement('span');
        accentProbe.style.color = 'var(--fvplus-settings-accent-strong)';
        workspace.append(accentProbe);
        const accentStrong = getComputedStyle(accentProbe).color;
        accentProbe.remove();
        return getComputedStyle(button).color === accentStrong
            && getComputedStyle(button).borderTopColor !== getComputedStyle(neutral).borderTopColor;
    });
    assert.equal(healthHoverUsesAccent, true);
    await page.mouse.move(0, 0);
    await page.waitForTimeout(250);

    await page.evaluate(() => document.body.setAttribute('data-fvplus-host-theme', 'white'));
    await page.waitForTimeout(250);
    layout = await readDiagnosticsLayout();
    assert.equal(layout.metricIconColors.some((color) => color === 'rgb(0, 0, 0)'), false);
    assert.equal(layout.systemIconColors.some((color) => color === 'rgb(0, 0, 0)'), false);
    assert.equal(layout.storageUpdateIconColors.some((color) => color === 'rgb(0, 0, 0)'), false);
    assert.equal(layout.supportHeaderIconColors.some((color) => color === 'rgb(0, 0, 0)'), false);
    assert.equal(layout.supportIconColors.some((color) => color === 'rgb(0, 0, 0)'), false);
    assert.equal(new Set(layout.supportIconColors).size, 7);
    assert.equal(new Set(layout.supportIconBackgrounds).size, 7);
    assert.equal(layout.privacyBadgesAreColored, true);
    assert.equal(layout.privacyLinkUsesAccent, true);
    assert.equal(layout.privacyLinkVisible, true);
    assert.equal(layout.primaryRestMatchesNeutral, true);
    assert.equal(layout.exportUsesSemanticColor, true);
    assert.equal(layout.neutralAvoidsAccentTreatment, true);

    await page.setViewportSize({ width: 1000, height: 1100 });
    layout = await readDiagnosticsLayout();
    assert.equal(layout.coreColumns, 3);
    assert.equal(layout.additionalSectionVisible, false);
    assert.equal(layout.metricIconsAreTopLeft, true);
    assert.equal(layout.metricCopyIsHorizontallyCentered, true);
    assert.equal(layout.metricCopyIsVerticallyCentered, true);
    assert.equal(layout.metricTextIsCentered, true);
    assert.ok(Math.max(...layout.systemFooterBottomInsets) - Math.min(...layout.systemFooterBottomInsets) <= 1);
    assert.ok(Math.max(...layout.systemFooterLeftInsets) - Math.min(...layout.systemFooterLeftInsets) <= 1);
    assert.equal(layout.cardsInsideWorkspace, true);
    assert.ok(layout.scrollWidth <= layout.clientWidth + 1, 'tablet diagnostics must not overflow');

    await page.setViewportSize({ width: 700, height: 1000 });
    layout = await readDiagnosticsLayout();
    assert.equal(layout.coreColumns, 1);
    assert.equal(layout.additionalSectionVisible, false);
    assert.ok(Math.max(...layout.systemFooterBottomInsets) - Math.min(...layout.systemFooterBottomInsets) <= 1);
    assert.ok(Math.max(...layout.systemFooterLeftInsets) - Math.min(...layout.systemFooterLeftInsets) <= 1);
    assert.equal(layout.cardsInsideWorkspace, true);
    assert.ok(layout.scrollWidth <= layout.clientWidth + 1, 'mobile diagnostics must not overflow');
});

test('Mobile reorder persists click state and isolates Docker and VM controls', async ({ page }) => {
    await page.setViewportSize({ width: 1700, height: 900 });
    await page.goto(`${baseUrl}/settings`, { waitUntil: 'load' });
    await page.evaluate(() => window.fixtureSettings.viewSettingsReady);
    assert.equal(await page.locator('#docker-tree-reorder-toggle').isHidden(), true, 'mobile-only control should be hidden on desktop');

    await page.evaluate(() => {
        const root = document.getElementById('fv-settings-root');
        root.classList.add('fv-mobile-compact');
        document.body.classList.add('fv-mobile-compact');
        root.insertAdjacentHTML('beforeend', `
            <button id="vm-tree-reorder-toggle" type="button" data-fv-onclick="toggleMobileTreeReorderMode('vm')" aria-pressed="false">Mobile reorder</button>
            <div class="folder-table"><table><tbody id="docker"><tr><td class="order-cell"><span class="row-order-actions"><button type="button">Docker move</button></span></td><td>Docker</td><td class="actions-cell">Actions</td></tr></tbody></table></div>
            <div class="folder-table"><table><tbody id="vms"><tr><td class="order-cell"><span class="row-order-actions"><button type="button">VM move</button></span></td><td>VM</td><td class="actions-cell">Actions</td></tr></tbody></table></div>
        `);
        const state = { docker: false, vm: false };
        const calls = { persists: 0, renders: [] };
        const api = window.FolderViewPlusMobileReorder.createApi({
            document,
            readMode: (type) => state[type] === true,
            writeMode: (type, enabled) => { state[type] = enabled === true; },
            persist: () => { calls.persists += 1; },
            render: (type) => calls.renders.push(type)
        });
        window.__mobileReorderFixture = { state, calls, api };
        window.toggleMobileTreeReorderMode = (type) => api.toggle(type);
        api.refresh();
    });

    const readState = async () => page.evaluate(() => {
        const display = (selector) => getComputedStyle(document.querySelector(selector)).display;
        return {
            state: { ...window.__mobileReorderFixture.state },
            calls: {
                persists: window.__mobileReorderFixture.calls.persists,
                renders: [...window.__mobileReorderFixture.calls.renders]
            },
            dockerPressed: document.getElementById('docker-tree-reorder-toggle').getAttribute('aria-pressed'),
            vmPressed: document.getElementById('vm-tree-reorder-toggle').getAttribute('aria-pressed'),
            dockerCell: display('tbody#docker td.order-cell'),
            vmCell: display('tbody#vms td.order-cell')
        };
    });

    await page.locator('#docker-tree-reorder-toggle').click();
    let state = await readState();
    assert.deepEqual(state.state, { docker: true, vm: false });
    assert.equal(state.dockerPressed, 'true');
    assert.equal(state.vmPressed, 'false');
    assert.equal(state.dockerCell, 'table-cell');
    assert.equal(state.vmCell, 'none');
    assert.deepEqual(state.calls, { persists: 1, renders: ['docker'] });

    await page.locator('#vm-tree-reorder-toggle').click();
    await page.locator('#docker-tree-reorder-toggle').click();
    state = await readState();
    assert.deepEqual(state.state, { docker: false, vm: true });
    assert.equal(state.dockerCell, 'none');
    assert.equal(state.vmCell, 'table-cell');
    assert.deepEqual(state.calls, { persists: 3, renders: ['docker', 'vm', 'docker'] });
});
};
