import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const scripts = path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts');
const source = fs.readFileSync(path.join(scripts, 'folder.js'), 'utf8');
const selectionStart = source.indexOf('for (const ct of currentEditFolder.containers)');
const selection = source.slice(selectionStart, source.indexOf('// make the ui respond', selectionStart));
const serializerStart = source.indexOf('const buildFolderPayloadFromForm =');
const serializer = source.slice(serializerStart, source.indexOf('const buildFolderSettingsSummaryHtml =', serializerStart));

export const registerEditorMemberRoundtripCases = ({ test }) => {
    test('Folder editor retains unavailable explicit members and identity until deliberately removed', async ({ page }) => {
        await page.setContent('<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Folder member fixture</title></head><body><table class="sortable"><tbody></tbody></table></body></html>');
        await page.addStyleTag({ path: path.join(scripts, '../styles/csp.utilities.css') });
        await page.addScriptTag({ path: path.resolve('node_modules/jquery/dist/jquery.js') });
        for (const name of ['folderviewplus.folder-contract', 'folder.editor.shared', 'folder.editor.schema', 'folder.editor.member-list']) {
            await page.addScriptTag({ path: path.join(scripts, `${name}.js`) });
        }
        const results = await page.evaluate(({ selection, serializer }) => {
            $.fn.switchButton = function () { return this; };
            return ['docker', 'vm'].map(type => {
                const identity = type === 'vm' ? { kind: 'vm', uuid: 'fixture-uuid' } : { kind: 'docker', containerId: 'fixture-id' };
                const saved = { containers: ['present', 'unavailable'], memberIdentities: { unavailable: identity } };
                const hydrate = new Function('currentEditFolder', 'choose', 'ICON_FALLBACK_PATH', `const selected = []; ${selection} return {selected, choose};`);
                const collections = { ...hydrate(saved, [{ Name: 'present' }, { Name: 'unassigned' }], '/fixture-icon.png'), selectedRegex: [], hiddenPreviewMembers: new Set(['unavailable']) };
                const list = FolderViewPlusFoundationModules.folderEditorMemberList.createApi({ window, $, getMemberCollections: () => collections });
                list.updateList();
                const contract = FolderViewPlusFolderContract;
                const helpers = { ...contract, ...FolderViewPlusFolderEditorShared.createApi(), ...FolderViewPlusFolderEditorSchema,
                    $, type, hiddenPreviewMembers: collections.hiddenPreviewMembers, memberIdentityModule: null,
                    getMemberMapByName: () => new Map([...collections.selected, ...collections.choose].map(member => [member.Name, member])),
                    normalizeParentFolderId: value => value, getChildFolderOrderIds: () => [], getFolderWebuiProfilesApi: () => null,
                    normalizePreviewStatusMode: value => value, DEFAULT_BORDER_COLOR: contract.DEFAULT_PREVIEW_BORDER_COLOR };
                const serialize = new Function(...Object.keys(helpers), `${serializer} return buildFolderPayloadFromForm;`)(...Object.values(helpers));
                const form = new Proxy({}, { get: () => ({ value: '', checked: false }) });
                const before = serialize(form);
                $('tr[data-name="unavailable"] input.container-switch').prop('checked', false).trigger('change');
                const removed = serialize(form);
                list.dispose();
                return { type, before, removed, identity };
            });
        }, { selection, serializer });
        for (const { type, before, removed, identity } of results) {
            assert.deepEqual(before.containers, ['present', 'unavailable'], type);
            assert.deepEqual(before.memberIdentities.unavailable, identity, type);
            assert.deepEqual(before.hiddenPreviewMembers, ['unavailable'], type);
            assert.deepEqual(removed.containers, ['present'], type);
            assert.equal(removed.memberIdentities.unavailable, undefined, type);
            assert.deepEqual(removed.hiddenPreviewMembers, [], type);
        }
    });
};
