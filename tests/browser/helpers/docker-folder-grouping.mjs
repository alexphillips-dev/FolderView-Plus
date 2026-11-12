import assert from 'node:assert/strict';

export const exerciseDockerFolderGrouping = async ({ page, baseUrl }) => {
    await page.goto(`${baseUrl}/docker-folder-grouping`, { waitUntil: 'load' });
    const result = await page.evaluate(() => window.fixtureDockerFolderGrouping.result);
    assert.equal(result.hidden.order.length, 18);
    assert.equal(result.hidden.folderBoxes, 6);
    assert.deepEqual(result.hidden.folderOrder, ['folder-3', 'folder-8', 'folder-21', 'folder-22', 'folder-23', 'folder-24']);
    assert.equal(result.hidden.groupedMembers, 17);
    assert.equal(result.hidden.standaloneMembers, 1);
    assert.equal(result.hidden.snapshot.hostRows.resolved, 18);
    assert.equal(result.hidden.snapshot.folders.total, 25);
    assert.equal(result.hidden.snapshot.folders.claimedRowCount, 17);
    assert.equal(result.hidden.snapshot.folders.missingRowCount, 0);
    assert.equal(result.hidden.snapshot.folders.insertedShellCount, 25);
    assert.equal(result.hidden.snapshot.folders.failedShellCount, 0);
    assert.equal(result.hidden.snapshot.folders.removedByHideEmptyCount, 19);
    assert.equal(result.shown.folderBoxes, 25);
    assert.equal(result.shown.groupedMembers, 17);
    assert.deepEqual(result.repeatedHidden.folderOrder, result.hidden.folderOrder);
    assert.equal(result.repeatedHidden.snapshot.folders.failedShellCount, 0);
    for (const scenario of [result.newContainer, result.nativeSavedMiddle]) {
        assert.notDeepEqual(scenario.before, scenario.expected, 'fixture reproduces the native row between folder shells');
        assert.deepEqual(scenario.after, scenario.expected);
        assert.deepEqual(scenario.repeated, scenario.expected);
        assert.equal(scenario.preserved, true);
        assert.equal(scenario.groupedMembers, 2);
    }
};
