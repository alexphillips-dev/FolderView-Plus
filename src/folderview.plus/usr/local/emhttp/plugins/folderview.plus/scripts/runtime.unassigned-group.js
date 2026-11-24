(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewPlusFoundationModules = root.FolderViewPlusFoundationModules || {};
    root.FolderViewPlusFoundationModules.unassignedGroup = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    'use strict';

    const getNames = (snapshot) => snapshot?.primaryOwnerByName && Array.isArray(snapshot.names)
        ? snapshot.names.filter(name => !Object.hasOwn(snapshot.primaryOwnerByName, name))
        : [];

    const createApi = ({ window: win = globalThis } = {}) => {
        let current = null;
        let expanded = false;

        const clear = ({ resetExpansion = false } = {}) => {
            if (resetExpansion) expanded = false;
            if (!current) return;
            const { host, header, entries } = current;
            current = null;
            header.remove();
            for (const { anchor, nodes } of entries) {
                for (const row of nodes) {
                    row.removeAttribute('data-fv-unassigned-item');
                    row.removeAttribute('data-fv-unassigned-collapsed');
                }
                if (anchor.parentNode === host) anchor.replaceWith(...nodes.filter(row => row.parentNode === host));
            }
        };

        const applyExpansion = () => {
            current.button.setAttribute('aria-expanded', String(expanded));
            for (const { nodes } of current.entries) {
                nodes.forEach(row => row.toggleAttribute('data-fv-unassigned-collapsed', !expanded));
            }
            current.onToggle(expanded);
        };

        const render = (host, rows, { columnCount = 1, getRelatedRows, onToggle = () => {} } = {}) => {
            if (!host) {
                clear();
                return;
            }
            const inline = host.tagName === 'TD';
            const withinHost = row => row?.parentNode === host && row.tagName === (inline ? 'SPAN' : 'TR')
                && row !== current?.header;
            const nativeRows = [...new Set(rows)].filter(withinHost);
            const seen = new Set(nativeRows);
            const groups = nativeRows.map(row => [row, ...Array.from(getRelatedRows?.(row) || []).filter(other => {
                if (!withinHost(other) || seen.has(other)) return false;
                seen.add(other);
                return true;
            })]);
            const span = Math.max(1, columnCount);
            if (current?.host === host && current.header.parentNode === host && current.entries.length === groups.length
                && current.entries.every(({ anchor, nodes }, index) => anchor.parentNode === host
                    && nodes.length === groups[index].length && nodes.every((node, i) => node === groups[index][i]))) {
                current.onToggle = onToggle;
                if (!inline) current.header.firstElementChild.colSpan = span;
                return;
            }
            const doc = host.ownerDocument;
            const restoreFocus = current && current.button === doc.activeElement;
            clear();
            if (!groups.length) return;

            const header = doc.createElement(inline ? 'div' : 'tr');
            header.setAttribute('data-fv-unassigned-group', '');
            const parent = inline ? header : header.appendChild(doc.createElement('td'));
            if (!inline) parent.colSpan = span;
            const button = parent.appendChild(doc.createElement('button'));
            button.type = 'button';
            button.className = 'fv-unassigned-toggle';
            const i18nText = (key, fallback) => win.FolderViewPlusI18n?.t(key, fallback) ?? fallback;
            button.append(i18nText('common.unassigned-group.title', 'Unassigned items'), ' ');
            const count = button.appendChild(doc.createElement('span'));
            count.className = 'fv-unassigned-count';
            count.textContent = String(groups.length);
            const entries = groups.map(nodes => {
                const anchor = doc.createComment('FolderView Plus unassigned position');
                nodes[0].before(anchor);
                nodes.forEach(row => row.setAttribute('data-fv-unassigned-item', ''));
                return { anchor, nodes };
            });
            current = { host, header, button, entries, onToggle };
            button.addEventListener('click', () => {
                if (current?.button === button) setExpanded(!expanded);
            });
            host.append(header, ...groups.flat());
            applyExpansion();
            if (restoreFocus) button.focus({ preventScroll: true });
        };

        const isMember = row => Boolean(row?.hasAttribute?.('data-fv-unassigned-item') && row.parentNode === current?.host);
        const isHeader = row => Boolean(current && row === current.header);
        const setExpanded = (value) => {
            if (!current || expanded === (value === true)) return;
            expanded = value === true;
            applyExpansion();
        };
        const reveal = (row) => {
            if (!isMember(row)) return false;
            setExpanded(true);
            return true;
        };
        const getUngroupedRows = (host) => {
            const entries = current?.host === host ? current.entries.filter(({ anchor }) => anchor.parentNode === host) : [];
            const byAnchor = new Map(entries.map(({ anchor, nodes }) => [anchor, nodes]));
            const moved = new Set(entries.flatMap(({ nodes }) => nodes));
            return Array.from(host?.childNodes || []).flatMap(node => byAnchor.has(node)
                ? byAnchor.get(node).filter(row => row.parentNode === host)
                : node.nodeType === 1 && !moved.has(node) && !isHeader(node) ? [node] : []);
        };
        return Object.freeze({ render, clear, isMember, isHeader, reveal, setExpanded, getUngroupedRows });
    };

    return Object.freeze({ createApi, getNames });
}));
