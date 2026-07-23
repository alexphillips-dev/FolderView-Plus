(function(root, factory) {
    const api = factory(root);
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
        return;
    }
    root.FolderViewPlusDashboardVisualDiagnostics = api;
    root.FolderViewPlusDashboardVisualDiagnosticsModuleLoaded = true;
}(typeof globalThis !== 'undefined' ? globalThis : this, function(root) {
    const SCHEMA_VERSION = 1;
    const HISTORY_LIMIT = 12;
    const PROBLEM_SAMPLE_LIMIT = 8;
    const STALE_AFTER_MS = 30 * 60 * 1000;
    const STORAGE_KEYS = Object.freeze({
        docker: 'fv.support.bundle.dashboard.visual.docker.v1',
        vm: 'fv.support.bundle.dashboard.visual.vm.v1'
    });
    const TYPE_META = Object.freeze({
        docker: Object.freeze({
            tbodySelector: 'tbody#docker_view',
            memberSelector: 'span.folder-element-docker',
            folderLabelSelector: '.folder-appname-docker'
        }),
        vm: Object.freeze({
            tbodySelector: 'tbody#vm_view',
            memberSelector: 'span.folder-element-vm',
            folderLabelSelector: '.folder-appname-vm'
        })
    });

    const normalizeType = (value) => (String(value || '').trim().toLowerCase() === 'vm' ? 'vm' : 'docker');
    const finiteNumber = (value, fallback = 0) => {
        const numeric = Number(value);
        return Number.isFinite(numeric) ? numeric : fallback;
    };
    const rounded = (value, digits = 1) => {
        const scale = 10 ** Math.max(0, Number(digits) || 0);
        return Math.round(finiteNumber(value, 0) * scale) / scale;
    };
    const nonNegativeInteger = (value, fallback = 0) => Math.max(0, Math.floor(finiteNumber(value, fallback)));
    const isoTimestamp = (value = Date.now()) => {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
    };
    const safeRect = (node) => {
        const rect = node && typeof node.getBoundingClientRect === 'function'
            ? node.getBoundingClientRect()
            : null;
        return {
            left: rounded(rect?.left),
            top: rounded(rect?.top),
            right: rounded(rect?.right),
            bottom: rounded(rect?.bottom),
            width: rounded(rect?.width),
            height: rounded(rect?.height)
        };
    };
    const isVisible = (node, win = root) => {
        if (!node || node.hidden === true) return false;
        const style = typeof win?.getComputedStyle === 'function' ? win.getComputedStyle(node) : null;
        if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
        if (typeof node.getClientRects === 'function' && node.getClientRects().length === 0) return false;
        const rect = safeRect(node);
        return rect.width > 0 && rect.height > 0;
    };
    const countGridTracks = (value) => {
        const raw = String(value || '').trim();
        if (!raw || raw === 'none') return 0;
        const repeatMatch = raw.match(/^repeat\(\s*(\d+)\s*,/i);
        if (repeatMatch) return nonNegativeInteger(repeatMatch[1], 0);
        let depth = 0;
        let tracks = 0;
        let tokenOpen = false;
        for (const char of raw) {
            if (char === '(') depth += 1;
            if (char === ')') depth = Math.max(0, depth - 1);
            const separator = /\s/.test(char) && depth === 0;
            if (separator) {
                if (tokenOpen) tracks += 1;
                tokenOpen = false;
            } else {
                tokenOpen = true;
            }
        }
        return tracks + (tokenOpen ? 1 : 0);
    };
    const summarizeWidths = (values) => {
        const sorted = (Array.isArray(values) ? values : [])
            .map((value) => finiteNumber(value, NaN))
            .filter(Number.isFinite)
            .sort((left, right) => left - right);
        if (!sorted.length) {
            return { count: 0, minimumPx: null, medianPx: null, maximumPx: null };
        }
        const middle = Math.floor(sorted.length / 2);
        const median = sorted.length % 2 === 0
            ? (sorted[middle - 1] + sorted[middle]) / 2
            : sorted[middle];
        return {
            count: sorted.length,
            minimumPx: rounded(sorted[0]),
            medianPx: rounded(median),
            maximumPx: rounded(sorted[sorted.length - 1])
        };
    };
    const labelLengthBucket = (value) => {
        const length = String(value || '').length;
        if (length === 0) return '0';
        if (length <= 12) return '1-12';
        if (length <= 24) return '13-24';
        if (length <= 40) return '25-40';
        return '41+';
    };
    const createSessionSalt = (win = root) => {
        try {
            const values = new Uint32Array(2);
            win?.crypto?.getRandomValues?.(values);
            if (values.some((value) => value > 0)) {
                return Array.from(values).map((value) => value.toString(16).padStart(8, '0')).join('');
            }
        } catch (_error) {
            // Fall through to a non-identifying per-page salt.
        }
        return `${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`;
    };
    const fingerprintValue = (value, salt = '') => {
        const input = `${String(salt || '')}|${String(value || '')}`;
        let hashA = 0x811c9dc5;
        let hashB = 0x9e3779b9;
        for (let index = 0; index < input.length; index += 1) {
            const code = input.charCodeAt(index);
            hashA ^= code;
            hashA = Math.imul(hashA, 0x01000193) >>> 0;
            hashB ^= code + index + 1;
            hashB = Math.imul(hashB, 0x85ebca6b) >>> 0;
        }
        return `${hashA.toString(16).padStart(8, '0')}${hashB.toString(16).padStart(8, '0')}`;
    };
    const rectExceeds = (rect, bounds, tolerance = 1.5) => (
        rect.left < bounds.left - tolerance
        || rect.right > bounds.right + tolerance
        || rect.top < bounds.top - tolerance
        || rect.bottom > bounds.bottom + tolerance
    );
    const overlapArea = (left, right) => {
        const width = Math.max(0, Math.min(left.right, right.right) - Math.max(left.left, right.left));
        const height = Math.max(0, Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top));
        return width * height;
    };
    const countOverlaps = (nodes) => {
        const rects = (Array.isArray(nodes) ? nodes : []).map(safeRect).filter((rect) => rect.width > 0 && rect.height > 0);
        let count = 0;
        for (let index = 0; index < rects.length; index += 1) {
            for (let compareIndex = index + 1; compareIndex < rects.length; compareIndex += 1) {
                if (overlapArea(rects[index], rects[compareIndex]) > 1) count += 1;
            }
        }
        return count;
    };
    const readCssVariable = (style, name) => String(style?.getPropertyValue?.(name) || '').trim();
    const parseColumnValue = (value) => {
        const numeric = Number.parseInt(String(value || '').trim(), 10);
        return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
    };
    const resolveAssetVersion = (doc) => {
        const scripts = Array.from(doc?.querySelectorAll?.('script[src*="dashboard.visual-diagnostics.js"]') || []);
        const src = String(scripts.at(-1)?.src || '');
        try {
            const queryVersion = String(
                new URL(src, root?.location?.origin || 'http://fvplus.local').searchParams.get('v') || ''
            ).trim();
            if (queryVersion && queryVersion !== '0') return queryVersion;
        } catch (_error) {
            // Fall through to the server-rendered installed version.
        }
        return String(root?.FolderViewPlusDashboardPluginVersion || '').trim() || null;
    };
    const collectEnvironment = (win = root, doc = win?.document) => {
        const visualViewport = win?.visualViewport || null;
        const orientation = win?.screen?.orientation || null;
        const mediaMatches = (query) => {
            try {
                return win?.matchMedia?.(query)?.matches === true;
            } catch (_error) {
                return false;
            }
        };
        const viewportWidth = nonNegativeInteger(win?.innerWidth, 0);
        return {
            route: String(win?.location?.pathname || ''),
            viewport: {
                width: viewportWidth,
                height: nonNegativeInteger(win?.innerHeight, 0),
                devicePixelRatio: rounded(win?.devicePixelRatio || 1, 2)
            },
            visualViewport: visualViewport ? {
                width: rounded(visualViewport.width),
                height: rounded(visualViewport.height),
                scale: rounded(visualViewport.scale || 1, 2),
                offsetLeft: rounded(visualViewport.offsetLeft),
                offsetTop: rounded(visualViewport.offsetTop)
            } : null,
            screen: {
                width: nonNegativeInteger(win?.screen?.width, 0),
                height: nonNegativeInteger(win?.screen?.height, 0),
                availableWidth: nonNegativeInteger(win?.screen?.availWidth, 0),
                availableHeight: nonNegativeInteger(win?.screen?.availHeight, 0)
            },
            orientation: {
                type: String(orientation?.type || ''),
                angle: finiteNumber(orientation?.angle, 0)
            },
            input: {
                touchPoints: nonNegativeInteger(win?.navigator?.maxTouchPoints, 0),
                coarsePointer: mediaMatches('(pointer: coarse)'),
                hover: mediaMatches('(hover: hover)'),
                mobileHint: win?.navigator?.userAgentData?.mobile === true
            },
            displayMode: mediaMatches('(display-mode: standalone)')
                ? 'standalone'
                : (mediaMatches('(display-mode: fullscreen)') ? 'fullscreen' : 'browser'),
            viewportClass: viewportWidth <= 600 ? 'phone-size' : (viewportWidth <= 1024 ? 'tablet-size' : 'desktop-size'),
            rootFontSizePx: rounded(Number.parseFloat(win?.getComputedStyle?.(doc?.documentElement)?.fontSize || '0')),
            bodyZoom: String(win?.getComputedStyle?.(doc?.body)?.zoom || 'normal')
        };
    };
    const collectLabelDiagnostics = ({
        labels = [],
        kind = 'member',
        boundsForLabel = () => null,
        win = root,
        sessionSalt = ''
    } = {}) => {
        const samples = [];
        let overflowCount = 0;
        let intentionalEllipsisCount = 0;
        let unexpectedClipCount = 0;
        let maximumOverflowPx = 0;
        for (const label of labels) {
            if (!isVisible(label, win)) continue;
            const labelRect = safeRect(label);
            const bounds = boundsForLabel(label);
            const clientWidth = rounded(label.clientWidth || labelRect.width);
            const scrollWidth = rounded(label.scrollWidth || clientWidth);
            const boundaryOverflowPx = bounds
                ? Math.max(0, labelRect.right - bounds.right, bounds.left - labelRect.left)
                : 0;
            const overflowPx = rounded(Math.max(0, scrollWidth - clientWidth, boundaryOverflowPx));
            if (overflowPx <= 1) continue;
            overflowCount += 1;
            maximumOverflowPx = Math.max(maximumOverflowPx, overflowPx);
            const style = win?.getComputedStyle?.(label) || null;
            const parentStyle = win?.getComputedStyle?.(label.parentElement) || null;
            const intentionalEllipsis = [style, parentStyle].some((candidate) => (
                String(candidate?.textOverflow || '').toLowerCase() === 'ellipsis'
                && ['hidden', 'clip'].includes(String(candidate?.overflowX || candidate?.overflow || '').toLowerCase())
            ));
            if (intentionalEllipsis) intentionalEllipsisCount += 1;
            else unexpectedClipCount += 1;
            if (samples.length < PROBLEM_SAMPLE_LIMIT) {
                const text = String(label.textContent || '').trim();
                samples.push({
                    kind,
                    labelFingerprint: fingerprintValue(text, sessionSalt),
                    labelLengthBucket: labelLengthBucket(text),
                    clientWidthPx: clientWidth,
                    scrollWidthPx: scrollWidth,
                    overflowPx,
                    intentionalEllipsis,
                    exceedsTileBounds: bounds ? rectExceeds(labelRect, bounds) : false
                });
            }
        }
        return {
            testedCount: labels.filter((label) => isVisible(label, win)).length,
            overflowCount,
            intentionalEllipsisCount,
            unexpectedClipCount,
            maximumOverflowPx: rounded(maximumOverflowPx),
            samples
        };
    };
    const buildVisualVerdict = (input = {}) => {
        const codes = [];
        const compactMatrix = input.layout === 'compactmatrix';
        const compareIfRendered = (expected, applied, rendered, code) => {
            if (!compactMatrix || expected <= 0) return;
            if ((applied > 0 && applied !== expected) || (rendered > 0 && rendered !== expected)) codes.push(code);
        };
        compareIfRendered(
            nonNegativeInteger(input.expectedFolderColumns, 0),
            nonNegativeInteger(input.appliedFolderColumns, 0),
            nonNegativeInteger(input.renderedFolderColumns, 0),
            'folder-column-mismatch'
        );
        compareIfRendered(
            nonNegativeInteger(input.expectedMemberColumns, 0),
            nonNegativeInteger(input.appliedMemberColumns, 0),
            nonNegativeInteger(input.renderedMemberColumns, 0),
            'member-column-mismatch'
        );
        if (nonNegativeInteger(input.unexpectedClipCount, 0) > 0) codes.push('unexpected-label-clipping');
        if (nonNegativeInteger(input.tileBoundaryOverflowCount, 0) > 0) codes.push('tile-boundary-overflow');
        if (nonNegativeInteger(input.controlOverflowCount, 0) > 0) codes.push('control-overflow');
        if (nonNegativeInteger(input.iconOverflowCount, 0) > 0) codes.push('icon-overflow');
        if (finiteNumber(input.widgetHorizontalOverflowPx, 0) > 1) codes.push('widget-horizontal-overflow');
        if (finiteNumber(input.pageHorizontalOverflowPx, 0) > 1) codes.push('page-horizontal-overflow');
        if (nonNegativeInteger(input.overlapCount, 0) > 0) codes.push('tile-overlap');
        if (nonNegativeInteger(input.belowMinimumMemberWidthCount, 0) > 0) codes.push('member-width-below-minimum');
        if (!codes.length && nonNegativeInteger(input.intentionalEllipsisCount, 0) > 0) codes.push('intentional-ellipsis-only');
        if (!codes.length) codes.push('layout-consistent');
        const errorCodes = new Set([
            'folder-column-mismatch',
            'member-column-mismatch',
            'unexpected-label-clipping',
            'tile-boundary-overflow',
            'control-overflow',
            'icon-overflow',
            'tile-overlap'
        ]);
        const warningCodes = new Set([
            'widget-horizontal-overflow',
            'page-horizontal-overflow',
            'member-width-below-minimum'
        ]);
        const status = codes.some((code) => errorCodes.has(code))
            ? 'error'
            : (codes.some((code) => warningCodes.has(code)) ? 'warning' : 'healthy');
        return {
            status,
            codes,
            columnsAgree: !codes.includes('folder-column-mismatch') && !codes.includes('member-column-mismatch'),
            noUnexpectedClipping: !codes.some((code) => [
                'unexpected-label-clipping',
                'tile-boundary-overflow',
                'control-overflow',
                'icon-overflow',
                'tile-overlap'
            ].includes(code))
        };
    };

    const createController = (options = {}) => {
        const win = options.window || root;
        const doc = options.document || win?.document || null;
        const storage = options.storage || (() => {
            try {
                return win?.localStorage || null;
            } catch (_error) {
                return null;
            }
        })();
        const deriveCompactMatrixLayout = typeof options.deriveCompactMatrixLayout === 'function'
            ? options.deriveCompactMatrixLayout
            : (() => ({
                folderColumns: 0,
                memberColumns: 0,
                estimatedFolderWidth: 0,
                estimatedMemberWidth: 0
            }));
        const now = typeof options.now === 'function' ? options.now : Date.now;
        const historyLimit = Math.max(4, nonNegativeInteger(options.historyLimit, HISTORY_LIMIT));
        const sessionSalt = createSessionSalt(win);
        const rafByType = { docker: 0, vm: 0 };
        const triggerByType = { docker: 'render', vm: 'render' };

        const emptyRecord = (type) => ({
            schemaVersion: SCHEMA_VERSION,
            type: normalizeType(type),
            latest: null,
            snapshots: []
        });
        const read = (type) => {
            const resolvedType = normalizeType(type);
            if (!storage || typeof storage.getItem !== 'function') return emptyRecord(resolvedType);
            try {
                const value = JSON.parse(String(storage.getItem(STORAGE_KEYS[resolvedType]) || 'null'));
                if (!value || typeof value !== 'object' || Array.isArray(value)) return emptyRecord(resolvedType);
                const snapshots = (Array.isArray(value.snapshots) ? value.snapshots : [])
                    .filter((entry) => entry && typeof entry === 'object' && !Array.isArray(entry))
                    .slice(-historyLimit);
                return {
                    schemaVersion: SCHEMA_VERSION,
                    type: resolvedType,
                    latest: value.latest && typeof value.latest === 'object' ? value.latest : (snapshots.at(-1) || null),
                    snapshots
                };
            } catch (_error) {
                return emptyRecord(resolvedType);
            }
        };
        const snapshotSignature = (snapshot) => JSON.stringify({
            environment: snapshot.environment,
            layout: snapshot.layout,
            content: snapshot.content,
            overflow: {
                labels: snapshot.overflow?.labels,
                tileBoundaryOverflowCount: snapshot.overflow?.tileBoundaryOverflowCount,
                controlOverflowCount: snapshot.overflow?.controlOverflowCount,
                iconOverflowCount: snapshot.overflow?.iconOverflowCount,
                widgetHorizontalOverflowPx: snapshot.overflow?.widgetHorizontalOverflowPx,
                pageHorizontalOverflowPx: snapshot.overflow?.pageHorizontalOverflowPx,
                overlapCount: snapshot.overflow?.overlapCount
            },
            verdict: snapshot.verdict
        });
        const persist = (type, snapshot) => {
            const resolvedType = normalizeType(type);
            const record = read(resolvedType);
            const snapshots = record.snapshots.slice();
            if (snapshots.length && snapshotSignature(snapshots.at(-1)) === snapshotSignature(snapshot)) {
                snapshots[snapshots.length - 1] = snapshot;
            } else {
                snapshots.push(snapshot);
            }
            const next = {
                schemaVersion: SCHEMA_VERSION,
                type: resolvedType,
                latest: snapshot,
                snapshots: snapshots.slice(-historyLimit)
            };
            if (storage && typeof storage.setItem === 'function') {
                try {
                    storage.setItem(STORAGE_KEYS[resolvedType], JSON.stringify(next));
                } catch (_error) {
                    // Visual diagnostics must never interfere with Dashboard rendering.
                }
            }
            return next;
        };
        const capture = (type, captureOptions = {}) => {
            const resolvedType = normalizeType(type);
            const meta = TYPE_META[resolvedType];
            const tbody = doc?.querySelector?.(meta.tbodySelector) || null;
            const host = tbody?.querySelector?.(':scope > tr.updated > td') || tbody;
            if (!tbody || !host) return null;
            const layout = String(tbody.getAttribute('data-fv-dashboard-layout') || '').trim().toLowerCase() || 'classic';
            const hostStyle = win?.getComputedStyle?.(host) || null;
            const directFolderCards = Array.from(host.children || [])
                .filter((node) => node?.classList?.contains('folder-showcase-outer') && isVisible(node, win));
            const allFolderCards = Array.from(tbody.querySelectorAll('.folder-showcase-outer')).filter((node) => isVisible(node, win));
            const expandedFolders = allFolderCards.filter((node) => node.getAttribute('expanded') === 'true');
            const memberTiles = Array.from(tbody.querySelectorAll(`.folder-showcase > ${meta.memberSelector}`))
                .filter((node) => isVisible(node, win));
            const showcases = Array.from(tbody.querySelectorAll('.folder-showcase-outer[expanded="true"] > .folder-showcase'))
                .filter((node) => isVisible(node, win));
            const folderLabels = Array.from(tbody.querySelectorAll(meta.folderLabelSelector));
            const memberLabels = memberTiles.map((node) => (
                node.querySelector('.appname') || node.querySelector('span.inner > a:first-child') || null
            )).filter(Boolean);
            const hostRect = safeRect(host);
            const hostPadding = hostStyle
                ? finiteNumber(Number.parseFloat(hostStyle.paddingLeft), 0) + finiteNumber(Number.parseFloat(hostStyle.paddingRight), 0)
                : 0;
            const widgetContentWidth = Math.max(0, Math.floor(hostRect.width - hostPadding));
            const expected = layout === 'compactmatrix'
                ? deriveCompactMatrixLayout({
                    containerWidth: widgetContentWidth,
                    folderCount: directFolderCards.length
                })
                : null;
            const renderedMemberColumnValues = Array.from(new Set(showcases
                .map((node) => countGridTracks(win?.getComputedStyle?.(node)?.gridTemplateColumns))
                .filter((value) => value > 0)));
            const renderedFolderColumns = countGridTracks(hostStyle?.gridTemplateColumns);
            const renderedMemberColumns = renderedMemberColumnValues[0] || 0;
            const appliedFolderColumns = parseColumnValue(
                host.getAttribute('data-fv-compactmatrix-folder-columns')
                || readCssVariable(hostStyle, '--fv-dashboard-compactmatrix-columns')
            );
            const appliedMemberColumns = parseColumnValue(
                host.getAttribute('data-fv-compactmatrix-member-columns')
                || readCssVariable(hostStyle, '--fv-dashboard-compactmatrix-member-columns')
            );
            const boundsForLabel = (label) => safeRect(label.closest(meta.memberSelector) || label.parentElement);
            const memberLabelDiagnostics = collectLabelDiagnostics({
                labels: memberLabels,
                kind: 'member',
                boundsForLabel,
                win,
                sessionSalt
            });
            const folderLabelDiagnostics = collectLabelDiagnostics({
                labels: folderLabels,
                kind: 'folder',
                boundsForLabel: (label) => safeRect(label.closest('.folder-showcase-outer > span.outer') || label.parentElement),
                win,
                sessionSalt
            });
            const tileWidths = memberTiles.map((node) => safeRect(node).width).filter((value) => value > 0);
            const tileBoundaryOverflowCount = memberTiles.filter((node) => {
                const parent = node.parentElement;
                return parent && rectExceeds(safeRect(node), safeRect(parent));
            }).length;
            const elementsExceedingTile = (selector) => memberTiles.reduce((count, tile) => {
                const bounds = safeRect(tile);
                return count + Array.from(tile.querySelectorAll(selector))
                    .filter((node) => isVisible(node, win) && rectExceeds(safeRect(node), bounds))
                    .length;
            }, 0);
            const controlOverflowCount = elementsExceedingTile('button, [role="button"], .fa-bars, [data-fv-dashboard-action]');
            const iconOverflowCount = elementsExceedingTile('img, svg, .img');
            const widgetHorizontalOverflowPx = rounded(Math.max(0, finiteNumber(host.scrollWidth) - finiteNumber(host.clientWidth)));
            const documentElement = doc?.documentElement || null;
            const pageHorizontalOverflowPx = rounded(Math.max(
                0,
                finiteNumber(documentElement?.scrollWidth) - finiteNumber(documentElement?.clientWidth)
            ));
            const overlapCount = showcases.reduce((count, showcase) => (
                count + countOverlaps(Array.from(showcase.children || []).filter((node) => isVisible(node, win)))
            ), 0);
            const minimumMemberWidthPx = nonNegativeInteger(
                captureOptions.minimumMemberWidthPx ?? options.minimumMemberWidthPx,
                220
            );
            const belowMinimumMemberWidthCount = tileWidths.filter((width) => width + 1 < minimumMemberWidthPx).length;
            const unexpectedClipCount = memberLabelDiagnostics.unexpectedClipCount + folderLabelDiagnostics.unexpectedClipCount;
            const intentionalEllipsisCount = memberLabelDiagnostics.intentionalEllipsisCount + folderLabelDiagnostics.intentionalEllipsisCount;
            const verdict = buildVisualVerdict({
                layout,
                expectedFolderColumns: expected?.folderColumns || 0,
                appliedFolderColumns,
                renderedFolderColumns,
                expectedMemberColumns: expected?.memberColumns || 0,
                appliedMemberColumns,
                renderedMemberColumns,
                unexpectedClipCount,
                intentionalEllipsisCount,
                tileBoundaryOverflowCount,
                controlOverflowCount,
                iconOverflowCount,
                widgetHorizontalOverflowPx,
                pageHorizontalOverflowPx,
                overlapCount,
                belowMinimumMemberWidthCount
            });
            const capturedAt = isoTimestamp(now());
            const snapshot = {
                schemaVersion: SCHEMA_VERSION,
                type: resolvedType,
                capturedAt,
                trigger: String(captureOptions.trigger || 'render').trim().slice(0, 40) || 'render',
                pluginVersion: resolveAssetVersion(doc),
                origin: {
                    route: String(win?.location?.pathname || ''),
                    surface: 'dashboard'
                },
                environment: collectEnvironment(win, doc),
                layout: {
                    preference: layout,
                    widget: {
                        borderBoxWidthPx: hostRect.width,
                        contentWidthPx: widgetContentWidth,
                        clientWidthPx: nonNegativeInteger(host.clientWidth, 0),
                        scrollWidthPx: nonNegativeInteger(host.scrollWidth, 0)
                    },
                    folderGrid: {
                        expectedColumns: expected?.folderColumns || null,
                        appliedColumns: appliedFolderColumns || null,
                        renderedColumns: renderedFolderColumns || null,
                        expectedCardWidthPx: expected?.estimatedFolderWidth || null,
                        actualCardWidths: summarizeWidths(directFolderCards.map((node) => safeRect(node).width))
                    },
                    memberGrid: {
                        expectedColumns: expected?.memberColumns || null,
                        appliedColumns: appliedMemberColumns || null,
                        renderedColumns: renderedMemberColumns || null,
                        renderedColumnValues: renderedMemberColumnValues,
                        expectedTileWidthPx: expected?.estimatedMemberWidth || null,
                        minimumReadableWidthPx: minimumMemberWidthPx,
                        actualTileWidths: summarizeWidths(tileWidths),
                        belowMinimumWidthCount: belowMinimumMemberWidthCount
                    },
                    computed: {
                        hostGridTemplateColumns: String(hostStyle?.gridTemplateColumns || ''),
                        folderColumnVariable: readCssVariable(hostStyle, '--fv-dashboard-compactmatrix-columns'),
                        memberColumnVariable: readCssVariable(hostStyle, '--fv-dashboard-compactmatrix-member-columns')
                    }
                },
                content: {
                    folderCount: allFolderCards.length,
                    directFolderCount: directFolderCards.length,
                    expandedFolderCount: expandedFolders.length,
                    visibleMemberCount: memberTiles.length,
                    memberLabelCount: memberLabels.length,
                    folderLabelCount: folderLabels.length
                },
                overflow: {
                    labels: {
                        member: memberLabelDiagnostics,
                        folder: folderLabelDiagnostics,
                        totalOverflowCount: memberLabelDiagnostics.overflowCount + folderLabelDiagnostics.overflowCount,
                        intentionalEllipsisCount,
                        unexpectedClipCount,
                        maximumOverflowPx: Math.max(
                            memberLabelDiagnostics.maximumOverflowPx,
                            folderLabelDiagnostics.maximumOverflowPx
                        )
                    },
                    tileBoundaryOverflowCount,
                    controlOverflowCount,
                    iconOverflowCount,
                    widgetHorizontalOverflowPx,
                    pageHorizontalOverflowPx,
                    overlapCount
                },
                verdict
            };
            persist(resolvedType, snapshot);
            return snapshot;
        };
        const scheduleCapture = (type, captureOptions = {}) => {
            const resolvedType = normalizeType(type);
            triggerByType[resolvedType] = String(captureOptions.trigger || triggerByType[resolvedType] || 'render');
            if (rafByType[resolvedType]) return;
            const run = () => {
                rafByType[resolvedType] = 0;
                capture(resolvedType, {
                    ...captureOptions,
                    trigger: triggerByType[resolvedType]
                });
            };
            rafByType[resolvedType] = typeof win?.requestAnimationFrame === 'function'
                ? win.requestAnimationFrame(() => win.requestAnimationFrame(run))
                : win?.setTimeout?.(run, 32);
        };
        return Object.freeze({
            capture,
            scheduleCapture,
            read,
            persist
        });
    };

    return Object.freeze({
        SCHEMA_VERSION,
        HISTORY_LIMIT,
        PROBLEM_SAMPLE_LIMIT,
        STALE_AFTER_MS,
        STORAGE_KEYS,
        countGridTracks,
        summarizeWidths,
        labelLengthBucket,
        fingerprintValue,
        collectEnvironment,
        collectLabelDiagnostics,
        buildVisualVerdict,
        createController
    });
}));
