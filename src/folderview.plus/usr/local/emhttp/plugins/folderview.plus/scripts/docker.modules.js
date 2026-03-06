(() => {
    const createDebugLogger = (enabled = false) => {
        const on = Boolean(enabled);
        return {
            log: (...args) => { if (on) console.log(...args); },
            warn: (...args) => { if (on) console.warn(...args); },
            error: (...args) => { if (on) console.error(...args); }
        };
    };

    const createPerfTracker = (namespace = 'fv.docker', enabled = false) => {
        const marks = new Map();
        const on = Boolean(enabled && typeof performance !== 'undefined');
        const stamp = (label, data = {}) => {
            if (!on) {
                return;
            }
            const time = performance.now().toFixed(2);
            console.debug(`[FV_PERF][${namespace}] ${label} @${time}ms`, data);
        };
        return {
            enabled: on,
            stamp,
            begin: (key) => {
                if (!on) {
                    return;
                }
                marks.set(String(key || ''), performance.now());
            },
            end: (key, data = {}) => {
                if (!on) {
                    return 0;
                }
                const id = String(key || '');
                const started = marks.get(id);
                if (typeof started !== 'number') {
                    return 0;
                }
                const elapsed = performance.now() - started;
                marks.delete(id);
                console.debug(`[FV_PERF][${namespace}] ${id}: ${elapsed.toFixed(2)}ms`, data);
                return elapsed;
            }
        };
    };

    const summarizeRuntimeState = (containersByName) => {
        const source = containersByName && typeof containersByName === 'object' ? containersByName : {};
        const counts = { started: 0, paused: 0, stopped: 0, total: 0 };
        Object.values(source).forEach((entry) => {
            counts.total += 1;
            if (entry?.pause) {
                counts.paused += 1;
            } else if (entry?.state) {
                counts.started += 1;
            } else {
                counts.stopped += 1;
            }
        });
        return counts;
    };

    const escapeClassToken = (value) => {
        const input = String(value);
        if (window.CSS && typeof window.CSS.escape === 'function') {
            return window.CSS.escape(input);
        }
        return input.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
    };

    const getFolderNameCell = (row) => {
        if (!row || !row.querySelector) {
            return null;
        }
        const direct = row.querySelector('td.ct-name.folder-name');
        if (direct) {
            return direct;
        }
        const sub = row.querySelector('.folder-name-sub');
        return sub && sub.closest ? sub.closest('td') : null;
    };

    const getFolderRows = () => {
        const rows = [];
        const seen = new Set();
        document.querySelectorAll('tr').forEach((row) => {
            const cell = getFolderNameCell(row);
            if (!cell || seen.has(row)) {
                return;
            }
            seen.add(row);
            rows.push(row);
        });
        return rows;
    };

    const getFolderIdFromRow = (row) => {
        if (!row) {
            return '';
        }
        if (row.classList) {
            for (const cls of row.classList) {
                if (typeof cls === 'string' && cls.startsWith('folder-id-')) {
                    return cls.substring('folder-id-'.length);
                }
            }
        }
        const label = row.querySelector && row.querySelector('span.appname a');
        if (label && typeof label.textContent === 'string') {
            const text = label.textContent.trim();
            if (text.startsWith('folder-') && text.length > 7) {
                return text.substring(7);
            }
        }
        return '';
    };

    const getFolderNameFromRow = (row) => {
        if (!row || !row.querySelector) {
            return '';
        }
        const label = row.querySelector('a.exec.folder-appname');
        if (!label || typeof label.textContent !== 'string') {
            return '';
        }
        return label.textContent.trim();
    };

    const getRenderedRowHeight = (row) => {
        if (!row) {
            return 0;
        }
        const rect = row.getBoundingClientRect ? row.getBoundingClientRect() : null;
        const rectHeight = rect && Number.isFinite(rect.height) ? rect.height : 0;
        const offsetHeight = Number.isFinite(row.offsetHeight) ? row.offsetHeight : 0;
        return Math.max(Math.round(rectHeight), Math.round(offsetHeight), 0);
    };

    const rowHasFolderPreview = (row) => {
        return !!(row && row.querySelector && row.querySelector('div.folder-preview'));
    };

    const applyRowHeight = (row, height = 0) => {
        if (!row || row.tagName !== 'TR') {
            return;
        }
        const targetHeight = Number.isFinite(height) && height > 0 ? Math.round(height) : 0;
        if (targetHeight > 0) {
            row.style.setProperty('height', `${targetHeight}px`, 'important');
        } else {
            row.style.removeProperty('height');
        }
        Array.from(row.children || []).forEach((td) => {
            if (td && td.tagName === 'TD') {
                if (targetHeight > 0) {
                    td.style.setProperty('height', `${targetHeight}px`, 'important');
                } else {
                    td.style.removeProperty('height');
                }
                td.style.setProperty('vertical-align', 'middle', 'important');
            }
        });
    };

    const buildMainFolderHeightLookup = (mainRows = []) => {
        const byId = new Map();
        const byName = new Map();
        const ordered = [];

        const rows = Array.isArray(mainRows) && mainRows.length
            ? mainRows
            : getFolderRows().filter((row) => rowHasFolderPreview(row));

        rows.forEach((row) => {
            const height = getRenderedRowHeight(row);
            if (height <= 0) {
                return;
            }

            ordered.push(height);

            const folderId = getFolderIdFromRow(row);
            if (folderId && !byId.has(folderId)) {
                byId.set(folderId, height);
            }

            const folderName = getFolderNameFromRow(row);
            if (folderName && !byName.has(folderName)) {
                byName.set(folderName, height);
            }
        });

        return { byId, byName, ordered };
    };

    const applyFolderCellCentering = (cell, rowHeight = 0) => {
        if (!cell) {
            return false;
        }

        let sub = null;
        Array.from(cell.children || []).forEach((child) => {
            if (!sub && child && child.classList && child.classList.contains('folder-name-sub')) {
                sub = child;
            }
        });
        if (!sub) {
            sub = cell.querySelector('.folder-name-sub');
        }
        if (!sub) {
            return false;
        }

        const height = Number.isFinite(rowHeight) && rowHeight > 0 ? Math.round(rowHeight) : 0;
        cell.style.setProperty('vertical-align', 'middle', 'important');
        cell.style.setProperty('position', 'relative', 'important');
        cell.style.setProperty('display', 'table-cell', 'important');
        cell.style.setProperty('padding-top', '0px', 'important');
        cell.style.setProperty('padding-bottom', '0px', 'important');
        if (height > 0) {
            cell.style.setProperty('height', `${height}px`, 'important');
        } else {
            cell.style.removeProperty('height');
        }

        sub.style.setProperty('position', 'absolute', 'important');
        sub.style.setProperty('top', '50%', 'important');
        sub.style.setProperty('left', '8px', 'important');
        sub.style.setProperty('right', '8px', 'important');
        sub.style.setProperty('transform', 'translateY(-50%)', 'important');
        sub.style.setProperty('display', 'flex', 'important');
        sub.style.setProperty('align-items', 'center', 'important');
        sub.style.setProperty('min-height', '0', 'important');
        sub.style.setProperty('width', '100%', 'important');
        if (height > 0) {
            sub.style.setProperty('height', `${Math.max(0, height - 2)}px`, 'important');
        } else {
            sub.style.removeProperty('height');
        }

        return true;
    };

    const createRowCenteringTools = () => {
        let folderRowCenterObserver = null;
        let folderRowCenterRaf = 0;

        const forceAllFolderRowsVerticalCenter = () => {
            const rows = getFolderRows();
            const sourceRows = rows.filter((row) => rowHasFolderPreview(row));
            const cloneRows = rows.filter((row) => !rowHasFolderPreview(row));
            const lookup = buildMainFolderHeightLookup(sourceRows);

            cloneRows.forEach((row, index) => {
                const folderId = getFolderIdFromRow(row);
                const folderName = getFolderNameFromRow(row);
                let targetHeight = 0;

                if (folderId && lookup.byId.has(folderId)) {
                    targetHeight = lookup.byId.get(folderId);
                } else if (folderName && lookup.byName.has(folderName)) {
                    targetHeight = lookup.byName.get(folderName);
                } else if (lookup.ordered.length > 0) {
                    targetHeight = lookup.ordered[Math.min(index, lookup.ordered.length - 1)];
                }

                applyRowHeight(row, targetHeight);
                const cell = getFolderNameCell(row);
                if (cell) {
                    applyFolderCellCentering(cell, targetHeight);
                }
            });

            sourceRows.forEach((row) => {
                applyRowHeight(row, 0);
                const cell = getFolderNameCell(row);
                if (cell) {
                    applyFolderCellCentering(cell, 0);
                }
            });
        };

        const queueForceAllFolderRowsVerticalCenter = () => {
            if (folderRowCenterRaf || typeof window.requestAnimationFrame !== 'function') {
                return;
            }
            folderRowCenterRaf = window.requestAnimationFrame(() => {
                folderRowCenterRaf = 0;
                forceAllFolderRowsVerticalCenter();
            });
        };

        const startFolderRowCenterObserver = () => {
            if (folderRowCenterObserver || !document.body || typeof MutationObserver !== 'function') {
                return;
            }

            folderRowCenterObserver = new MutationObserver((mutations) => {
                for (const mutation of mutations) {
                    if (!mutation || !mutation.addedNodes || mutation.addedNodes.length === 0) {
                        continue;
                    }
                    for (const node of mutation.addedNodes) {
                        if (!node || node.nodeType !== 1) {
                            continue;
                        }
                        const element = node;
                        if (
                            (element.matches && element.matches('td.ct-name.folder-name, tr[class*="folder-id-"], .folder-name-sub, .folder-appname'))
                            || (element.querySelector && element.querySelector('td.ct-name.folder-name, tr[class*="folder-id-"], .folder-name-sub, .folder-appname'))
                        ) {
                            queueForceAllFolderRowsVerticalCenter();
                            return;
                        }
                    }
                }
            });

            folderRowCenterObserver.observe(document.body, { childList: true, subtree: true });
            queueForceAllFolderRowsVerticalCenter();
            setTimeout(queueForceAllFolderRowsVerticalCenter, 50);
            setTimeout(queueForceAllFolderRowsVerticalCenter, 250);
            setTimeout(queueForceAllFolderRowsVerticalCenter, 1000);
        };

        const forceFolderRowVerticalCenter = (id) => {
            const escapedId = escapeClassToken(id);
            if (!escapedId) {
                return;
            }
            forceAllFolderRowsVerticalCenter();
        };

        return {
            forceFolderRowVerticalCenter,
            queueForceAllFolderRowsVerticalCenter,
            startFolderRowCenterObserver,
            forceAllFolderRowsVerticalCenter
        };
    };

    window.FolderViewDockerModules = {
        createDebugLogger,
        createPerfTracker,
        summarizeRuntimeState,
        createRowCenteringTools
    };
})();
