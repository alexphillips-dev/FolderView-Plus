export const waitForDockerExpansionSave = async page => {
    const expanded = await page.evaluate(() => {
        const map = Object.fromEntries([...document.querySelectorAll('button.folder-dropdown')].flatMap(node => {
            const id = node.className.match(/(?:^|\s)dropDown-([A-Za-z0-9_.:-]+)(?:\s|$)/)?.[1];
            return id ? [[id, node.getAttribute('active') === 'true']] : [];
        }));
        window.dispatchEvent(new Event('pagehide')); return map;
    });
    await page.waitForFunction(map => {
        const snapshot = window.FolderViewPlusPrefsStore?.getDefaultCoordinator().getSnapshot('docker');
        return snapshot && !snapshot.pending && Object.entries(map).every(([id, value]) => (snapshot.prefs.expandedFolderState?.[id] ?? false) === value);
    }, expanded);
};
