import assert from 'node:assert/strict';
import path from 'node:path';

const memberList = path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.editor.member-list.js');

export const registerEditorMemberRenderReadinessCases = ({ test }) => {
    test('Editor waits for the latest complete member table before capturing selection', async ({ page }) => {
        await page.setContent('<!doctype html><table class="sortable"><tbody></tbody></table>');
        await page.addScriptTag({ path: path.resolve('node_modules/jquery/dist/jquery.js') });
        await page.addScriptTag({ path: memberList });
        const result = await page.evaluate(async () => {
            $.fn.switchButton = function () { return this; };
            const frames = [], renders = [];
            let selected = Array.from({ length: 141 }, (_, index) => ({ Name: 'app-' + index }));
            const list = FolderViewPlusFoundationModules.folderEditorMemberList.createApi({
                window: { requestAnimationFrame: callback => frames.push(callback) }, $,
                getMemberCollections: () => ({ selected })
            });
            list.updateList(() => renders.push('superseded'));
            const ready = list.waitForRender();
            const checkedMembers = () => $('input.container-switch:checked');
            const pending = list.isRendering() && $('tbody').prop('inert') && checkedMembers().length === 140;
            selected = selected.map(member => ({ Name: 'latest-' + member.Name }));
            list.updateList(() => renders.push('latest'));
            frames.shift()();
            const supersededStillPending = list.isRendering();
            frames.shift()();
            return { pending, supersededStillPending, ready: await ready, renders, count: checkedMembers().length,
                last: checkedMembers().last().val(), inert: $('tbody').prop('inert') };
        });
        assert.deepEqual(result, { pending: true, supersededStillPending: true, ready: true, renders: ['latest'],
            count: 141, last: 'latest-app-140', inert: false });
    }, { skipAccessibility: true });
};
