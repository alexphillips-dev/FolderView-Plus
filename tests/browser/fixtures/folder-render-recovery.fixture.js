(() => {
    const root = document.querySelector('#native');
    const row = document.querySelector('#one');
    const control = document.querySelector('#control');
    const state = { clicks: 0, cleaned: 0 };
    control.addEventListener('click', () => state.clicks++);
    const deferred = window.FolderViewPlusFoundationModules.runtimeSharedPrimitives.createDeferredPreviewController({ window, document });
    deferred.start();
    const recovery = window.FolderViewPlusFoundationModules.folderRenderRecovery.create({
        window, document, type: 'docker', getRoot: () => root,
        onRollback: () => deferred.discardDisconnected()
    });
    window.fixtureRecovery = {
        run() {
            recovery.begin();
            control.focus();
            const order = ['folder-broken', 'folder-healthy'];
            const folder = { name: '<script>private</script>' + 'Long name '.repeat(50), status: { expanded: true } };
            const before = JSON.stringify(folder);
            recovery.render(folder, 'broken & special', order, () => {
                const shell = document.createElement('tr');
                shell.className = 'partial';
                root.prepend(shell);
                const cell = shell.insertCell();
                const storage = document.createElement('table');
                cell.append(storage);
                storage.append(row);
                row.className = 'hidden member';
                row.style.display = 'none';
                row.querySelector('label').firstChild.data = 'Changed native label';
                folder.status.expanded = false;
                order.splice(0, 1);
                window.FolderViewPlusFoundationModules.folderRenderRecovery.registerCleanup(() => state.cleaned++);
                throw new Error('Private error with IP and path must never reach diagnostics');
            });
            recovery.render({ name: 'Healthy' }, 'healthy', order, () => {
                const shell = document.createElement('tr');
                shell.className = 'healthy';
                shell.insertCell().textContent = 'Healthy folder';
                root.append(shell);
                return 0;
            });
            recovery.finish();
            return {
                sameRow: row === document.querySelector('#one'),
                focus: document.activeElement === control, value: control.value,
                nativeClass: row.className, display: row.style.display,
                nativeLabel: row.querySelector('label').firstChild.data,
                originalSettings: JSON.stringify(folder) === before,
                snapshot: recovery.snapshot(), cleaned: state.cleaned
            };
        },
        retry() { recovery.begin(); recovery.render({}, 'broken & special', [], () => 0); recovery.finish(); },
        state
    };
})();
