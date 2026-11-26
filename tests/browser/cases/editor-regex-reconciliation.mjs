import assert from 'node:assert/strict';
import path from 'node:path';

const scripts = path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts');

export const registerEditorRegexReconciliationCases = ({ test }) => {
    test('Folder editor keeps changes made while a regex worker is pending', async ({ page }) => {
        await page.setContent('<!doctype html><html lang="en"><head><title>Member edits</title></head><body><table class="sortable"><tbody></tbody></table></body></html>');
        await page.addScriptTag({ path: path.resolve('node_modules/jquery/dist/jquery.js') });
        for (const name of ['folder.editor.members', 'folder.editor.member-list', 'folder.editor.regex-selection']) {
            await page.addScriptTag({ path: path.join(scripts, `${name}.js`) });
        }
        const exercise = await page.evaluate(async () => {
            $.fn.switchButton = function () { return this; };
            const member = Name => ({ Name });
            let collections = {
                selected: ['first', 'second', 'matching-manual', 'released'].map(member),
                choose: Array.from({ length: 183 }, (_, index) => member(`app-${index}`)), selectedRegex: []
            };
            const jobs = [];
            class HeldWorker extends Worker {
                postMessage(payload) { jobs.push(() => super.postMessage(payload)); }
            }
            const setMemberCollections = next => { collections = next; };
            const members = FolderViewPlusFolderEditorMembers.createApi({
                $, getAllMembers: () => [...collections.selected, ...collections.choose, ...collections.selectedRegex], setMemberCollections
            });
            const { folderEditorMemberList, folderEditorRegexSelection } = FolderViewPlusFoundationModules;
            const list = folderEditorMemberList.createApi({ window, $, getMemberCollections: () => collections, moveMemberRow: members.moveMemberRow });
            const regex = folderEditorRegexSelection.createApi({
                window: { Worker: HeldWorker, Blob, URL }, getMemberCollections: () => collections, setMemberCollections,
                syncMemberArraysFromTable: members.syncMemberArraysFromTable, updateList: list.updateList
            });
            const read = () => [
                $('input.container-switch:checked:enabled').map((_, control) => control.value).get(),
                $('input.container-switch:checked:disabled').map((_, control) => control.value).get()
            ];
            list.updateList();
            await list.waitForRender();
            const pending = regex.evaluateRegexSelection({ value: '^(matching-manual|app-182)$' });
            $('tr[data-name="second"] button[data-direction="up"]').trigger('click');
            $('tr[data-name="app-0"] input.container-switch').prop('checked', true).trigger('change');
            $('tr[data-name="released"], tr[data-name="matching-manual"]').find('input.container-switch').prop('checked', false).trigger('change');
            jobs.shift()();
            await pending;
            await list.waitForRender();
            const afterEdit = read();
            const stale = regex.evaluateRegexSelection({ value: '^app-181$' });
            const latest = regex.evaluateRegexSelection({ value: '^app-180$' });
            jobs.pop()();
            await latest;
            await list.waitForRender();
            jobs.shift()();
            await stale;
            const afterStale = read();
            regex.dispose();
            list.dispose();
            return { afterEdit, afterStale };
        });
        assert.deepEqual(exercise.afterEdit, [['second', 'first', 'app-0'], ['matching-manual', 'app-182']]);
        assert.deepEqual(exercise.afterStale, [['second', 'first', 'app-0'], ['app-180']]);
    }, { skipAccessibility: true });
};
