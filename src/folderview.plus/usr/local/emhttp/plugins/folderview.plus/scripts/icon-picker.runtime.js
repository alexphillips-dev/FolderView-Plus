(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewIconPickerRuntime = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const normalizeQuery = (value) => String(value || '').trim().toLowerCase();

    const paginateItems = (items, page, pageSize) => {
        const source = Array.isArray(items) ? items : [];
        const safePageSize = Math.max(1, Number(pageSize) || 1);
        const totalPages = Math.max(1, Math.ceil(source.length / safePageSize));
        const safePage = Math.min(Math.max(1, Number(page) || 1), totalPages);
        const startIndex = (safePage - 1) * safePageSize;
        const endIndex = Math.min(source.length, startIndex + safePageSize);
        return {
            page: safePage,
            totalPages,
            startIndex,
            endIndex,
            totalItems: source.length,
            items: source.slice(startIndex, endIndex)
        };
    };

    const filterIconsByQuery = (icons, query) => {
        const source = Array.isArray(icons) ? icons : [];
        const needle = normalizeQuery(query);
        if (!needle) {
            return [...source];
        }
        return source.filter((icon) => {
            const name = normalizeQuery(icon?.name);
            if (name.includes(needle)) {
                return true;
            }
            const tags = Array.isArray(icon?.tags) ? icon.tags : [];
            return tags.some((tag) => normalizeQuery(tag).includes(needle));
        });
    };

    const createPickerFlow = (initialItems = [], pageSize = 120) => {
        let items = Array.isArray(initialItems) ? [...initialItems] : [];
        let query = '';
        let page = 1;
        const size = Math.max(1, Number(pageSize) || 120);

        const getView = () => {
            const filtered = filterIconsByQuery(items, query);
            return {
                query,
                ...paginateItems(filtered, page, size)
            };
        };

        return {
            replaceItems(nextItems) {
                items = Array.isArray(nextItems) ? [...nextItems] : [];
                page = 1;
                return getView();
            },
            setQuery(nextQuery) {
                query = String(nextQuery || '');
                page = 1;
                return getView();
            },
            setPage(nextPage) {
                page = Math.max(1, Number(nextPage) || 1);
                return getView();
            },
            nextPage() {
                const view = getView();
                page = Math.min(view.totalPages, view.page + 1);
                return getView();
            },
            prevPage() {
                const view = getView();
                page = Math.max(1, view.page - 1);
                return getView();
            },
            getView
        };
    };

    return {
        normalizeQuery,
        paginateItems,
        filterIconsByQuery,
        createPickerFlow
    };
}));
