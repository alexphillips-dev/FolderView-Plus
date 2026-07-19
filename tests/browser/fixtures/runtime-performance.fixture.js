(() => {
    'use strict';

    const params = new URLSearchParams(window.location.search);
    const surface = String(document.body.dataset.fvPerfSurface || 'runtime');
    const folderCount = Math.max(1, Number(params.get('folders')) || 25);
    const memberCount = Math.max(folderCount, Number(params.get('members')) || 50);
    // performance.now() is relative to navigation start, so these measurements
    // include resource evaluation and fixture bootstrap rather than starting only
    // after the final script has downloaded.
    const startedAt = 0;
    const metrics = {
        surface,
        folderCount,
        memberCount,
        nativeRowsVisibleMs: 0,
        allFoldersGroupedMs: 0,
        settingsBootstrapMs: 0,
        folderEditorOpenMs: 0,
        incrementalStartStopMs: 0,
        updateAllReconciliationMs: 0,
        domNodeCount: 0,
        mutationObserverCallbacks: 0,
        mutationRecordCount: 0
    };
    const root = surface === 'runtime'
        ? document.querySelector('#docker_list')
        : document.querySelector(surface === 'settings' ? '#fv-settings-benchmark' : '#fv-folder-editor-benchmark');
    const observer = new MutationObserver((records) => {
        metrics.mutationObserverCallbacks += 1;
        metrics.mutationRecordCount += records.length;
    });
    observer.observe(root, { childList: true, subtree: true, attributes: true, characterData: true });

    const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
    const settle = async () => {
        await frame();
        await frame();
        await Promise.resolve();
    };
    const median = (values) => {
        const sorted = values.slice().sort((left, right) => left - right);
        const middle = Math.floor(sorted.length / 2);
        return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
    };
    const createCell = (text, className = '') => {
        const cell = document.createElement('td');
        if (className) cell.className = className;
        const value = document.createElement('span');
        value.textContent = text;
        cell.append(value);
        return cell;
    };
    const elementFromMarkup = (markup) => {
        const template = document.createElement('template');
        template.innerHTML = String(markup || '').trim();
        return template.content.firstElementChild;
    };
    const createMemberRow = (index) => {
        const row = document.createElement('tr');
        row.className = 'sortable benchmark-member';
        row.dataset.name = `container-${index}`;
        row.dataset.state = index % 5 === 0 ? 'stopped' : 'started';
        row.append(
            createCell(`Container ${index}`, 'ct-name'),
            createCell(row.dataset.state, 'benchmark-state'),
            createCell('bridge'),
            createCell(`172.17.${Math.floor(index / 250)}.${(index % 250) + 1}`),
            createCell(`${8000 + index}:TCP`),
            createCell(`10.0.0.10:${8000 + index}`),
            createCell(index % 3 ? 'on' : 'off'),
            createCell(`${index + 1} hours`)
        );
        return row;
    };
    const createFolderRow = (index, members) => {
        const row = document.createElement('tr');
        row.className = 'folder benchmark-folder';
        row.dataset.folderId = `folder-${index}`;
        row.dataset.view = 'folder';
        row.append(createCell(`Folder ${index}`, 'ct-name folder-name'));
        const summary = document.createElement('td');
        summary.colSpan = 7;
        summary.className = 'benchmark-folder-summary';
        summary.textContent = `${members.length} members`;
        row.append(summary);
        return row;
    };

    const bootstrapRuntime = async () => {
        const nativeFragment = document.createDocumentFragment();
        for (let index = 0; index < memberCount; index += 1) nativeFragment.append(createMemberRow(index));
        root.replaceChildren(nativeFragment);
        await frame();
        metrics.nativeRowsVisibleMs = performance.now() - startedAt;

        const groupingStartedAt = performance.now();
        const rows = Array.from(root.querySelectorAll('tr.benchmark-member'));
        const buckets = Array.from({ length: folderCount }, () => []);
        rows.forEach((row, index) => buckets[index % folderCount].push(row));
        const groupedFragment = document.createDocumentFragment();
        buckets.forEach((members, folderIndex) => {
            groupedFragment.append(createFolderRow(folderIndex, members));
            members.forEach((row) => {
                row.dataset.folderOwner = `folder-${folderIndex}`;
                row.classList.add('folder-element');
                groupedFragment.append(row);
            });
        });
        root.replaceChildren(groupedFragment);
        await settle();
        metrics.allFoldersGroupedMs = performance.now() - groupingStartedAt;
        metrics.domNodeCount = document.getElementsByTagName('*').length;
    };

    const bootstrapSettings = async () => {
        const fragment = document.createDocumentFragment();
        const topbar = document.createElement('nav');
        topbar.className = 'fv-settings-topbar';
        topbar.append(
            elementFromMarkup(window.FolderViewPlusUI.button({ label: 'Basic' })),
            elementFromMarkup(window.FolderViewPlusUI.button({ label: 'Advanced' })),
            elementFromMarkup(window.FolderViewPlusUI.button({ label: 'Wizard', tone: 'info' }))
        );
        fragment.append(topbar);
        for (let index = 0; index < folderCount; index += 1) {
            const section = document.createElement('section');
            section.className = 'fv-ui-disclosure';
            section.append(elementFromMarkup(window.FolderViewPlusUI.disclosure({
                title: `Folder ${index}`,
                summary: `${Math.ceil(memberCount / folderCount)} members`,
                body: `<label>Name <input value="Folder ${index}"></label><label><input type="checkbox" ${index % 2 ? 'checked' : ''}> Show preview</label>`
            })));
            fragment.append(section);
        }
        root.replaceChildren(fragment);
        await settle();
        metrics.settingsBootstrapMs = performance.now() - startedAt;
        metrics.domNodeCount = document.getElementsByTagName('*').length;
    };

    const bootstrapEditor = async () => {
        const fragment = document.createDocumentFragment();
        const header = document.createElement('header');
        header.append(
            elementFromMarkup(window.FolderViewPlusUI.badge({ label: 'Docker folder', tone: 'info' })),
            elementFromMarkup(window.FolderViewPlusUI.button({ label: 'Save', tone: 'primary' }))
        );
        fragment.append(header);
        const table = document.createElement('table');
        const body = document.createElement('tbody');
        for (let index = 0; index < memberCount; index += 1) {
            const row = document.createElement('tr');
            row.append(
                createCell(`Container ${index}`),
                createCell(index % 5 ? 'Started' : 'Stopped'),
                createCell(index % 2 ? 'Included' : 'Available')
            );
            body.append(row);
        }
        table.append(body);
        fragment.append(table);
        root.replaceChildren(fragment);
        await settle();
        metrics.folderEditorOpenMs = performance.now() - startedAt;
        metrics.domNodeCount = document.getElementsByTagName('*').length;
    };

    const runLifecycleBenchmarks = async () => {
        if (surface !== 'runtime') return { ...metrics };
        const memberRows = Array.from(root.querySelectorAll('tr.benchmark-member'));
        const folderRows = new Map(Array.from(root.querySelectorAll('tr.benchmark-folder')).map((row) => [row.dataset.folderId, row]));
        const iterations = Math.min(50, Math.max(20, memberRows.length));
        const cycles = 10;
        const incrementalStartedAt = performance.now();
        for (let cycle = 0; cycle < cycles; cycle += 1) {
            for (let index = 0; index < iterations; index += 1) {
                const row = memberRows[((cycle * iterations) + (index * 37)) % memberRows.length];
                row.dataset.state = row.dataset.state === 'started' ? 'stopped' : 'started';
                row.querySelector('.benchmark-state').textContent = row.dataset.state;
                const folderRow = folderRows.get(row.dataset.folderOwner);
                if (folderRow) folderRow.dataset.lastReconciledState = row.dataset.state;
            }
        }
        await settle();
        // Normalize the larger timing sample back to one 50-event reconciliation
        // workload so timer resolution does not turn fast paths into zeroes.
        metrics.incrementalStartStopMs = ((performance.now() - incrementalStartedAt) / cycles) * (50 / iterations);

        const updateStartedAt = performance.now();
        memberRows.forEach((row, index) => {
            const nextState = index % 7 ? 'started' : 'stopped';
            if (row.dataset.state !== nextState) {
                row.dataset.state = nextState;
                row.querySelector('.benchmark-state').textContent = nextState;
            }
            row.dataset.updateAvailable = 'false';
        });
        folderRows.forEach((row) => { row.dataset.updateCount = '0'; });
        await settle();
        metrics.updateAllReconciliationMs = performance.now() - updateStartedAt;
        metrics.domNodeCount = document.getElementsByTagName('*').length;
        return { ...metrics };
    };

    const switchViews = async (iterations = 30) => {
        if (surface !== 'runtime') return;
        const folders = Array.from(root.querySelectorAll('tr.benchmark-folder'));
        const members = Array.from(root.querySelectorAll('tr.benchmark-member'));
        for (let index = 0; index < iterations; index += 1) {
            const hostView = index % 2 === 0;
            folders.forEach((row) => row.classList.toggle('is-host-hidden', hostView));
            members.forEach((row) => row.classList.toggle('is-folder-hidden', !hostView));
            document.body.dataset.view = hostView ? 'host' : 'folder';
            await frame();
        }
        folders.forEach((row) => row.classList.remove('is-host-hidden'));
        members.forEach((row) => row.classList.remove('is-folder-hidden'));
        await settle();
    };

    const ready = (surface === 'runtime' ? bootstrapRuntime() : (surface === 'settings' ? bootstrapSettings() : bootstrapEditor()))
        .then(() => ({ ...metrics }));
    window.FolderViewPlusPerformanceFixture = {
        ready,
        runLifecycleBenchmarks,
        switchViews,
        snapshot: () => ({ ...metrics }),
        stopObserver: () => observer.disconnect()
    };
})();
