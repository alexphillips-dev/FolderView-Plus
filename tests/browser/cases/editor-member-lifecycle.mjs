import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const scripts = path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts');
const source = fs.readFileSync(path.join(scripts, 'folder.js'), 'utf8');
const teardownStart = source.indexOf('const registerFolderEditorModuleTeardown =');
const teardown = source.slice(teardownStart, source.indexOf('const resetStatusColorDefaults =', teardownStart));

export const registerEditorMemberLifecycleCases = ({ test }) => {
    test('Folder editor retains live member controls across cached navigation and disposes on final exit', async ({ page }) => {
        await page.setContent('<!doctype html><html lang="en"><head><title>Folder editor lifecycle fixture</title></head><body><table class="sortable"><tbody></tbody></table></body></html>');
        await page.addScriptTag({ path: path.resolve('node_modules/jquery/dist/jquery.js') });
        await page.addScriptTag({ path: path.join(scripts, 'folder.editor.member-list.js') });
        const result = await page.evaluate(teardown => {
            $.fn.switchButton = function () { return this; };
            const collections = { selected: [{ Name: 'available' }], choose: [], selectedRegex: [], hiddenPreviewMembers: new Set() };
            const list = FolderViewPlusFoundationModules.folderEditorMemberList.createApi({ window, $, getMemberCollections: () => collections });
            list.updateList();
            const calls = [];
            const dependencies = {
                folderThemeSurfaceBinding: { disconnect: () => calls.push('theme') },
                folderEditorRegexSelectionApi: { dispose: () => calls.push('regex') },
                folderEditorMemberListApi: list,
                folderEditorMembersApi: { disposeAssignmentDetails: () => calls.push('assignment') },
                folderWebuiProfilesApi: { dispose: () => calls.push('profiles') }
            };
            new Function(...Object.keys(dependencies), `${teardown}\nregisterFolderEditorModuleTeardown();`)(...Object.values(dependencies));
            const changePreview = checked => $('tr[data-name="available"] .member-preview-switch').prop('checked', checked).trigger('change');
            for (let visit = 0; visit < 2; visit++) {
                dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
                dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
            }
            changePreview(false);
            const afterRestore = collections.hiddenPreviewMembers.has('available');
            dispatchEvent(new PageTransitionEvent('pagehide'));
            dispatchEvent(new PageTransitionEvent('pagehide'));
            changePreview(true);
            return { afterRestore, afterExit: collections.hiddenPreviewMembers.has('available'), calls };
        }, teardown);
        assert.deepEqual(result, { afterRestore: true, afterExit: true, calls: ['theme', 'regex', 'assignment', 'profiles'] });
    });
};
