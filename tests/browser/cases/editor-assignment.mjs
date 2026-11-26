import assert from 'node:assert/strict';
import fs from 'node:fs';
import { nativeSwitchCss, nativeSwitchSource } from '../helpers/docker-native-switch.mjs';
import { mountSettingsEditor } from '../helpers/folder-editor-settings-host.mjs';

const root = 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus';
const folderPage = fs.readFileSync(`${root}/Folder.page`, 'utf8');
const folderJs = fs.readFileSync(`${root}/scripts/folder.js`, 'utf8');
const getMembersApi = folderJs.match(/const getFolderEditorMembersApi = \(\) => \{[\s\S]*?\n\};/)[0];
const updateList = folderJs.match(/const updateList = \(afterRender = null\) => \{[\s\S]*?\n\};/)[0];
const scripts = [...folderPage.matchAll(/\/scripts\/((?:folderviewplus\.(?:utils[\w-]*|folder-groups-model|membership|rules-engine|request[\w-]*)|folder\.member-identity|runtime\.folder-ordering)\.js)/g)]
    .map((match) => match[1]).concat(['folder.editor.member-list.js', 'folder.editor.members.js']);

export const registerEditorAssignmentCases = ({ test, baseUrl }) => {
    test('Folder editor assignment explanations follow saved and draft Docker and VM membership', async ({ page }) => {
        for (const type of ['docker', 'vm']) {
            await mountSettingsEditor(page, baseUrl, type);
            const orderRoute = '**/plugins/folderview.plus/server/read_order.php?**';
            let orderReads = 0;
            await page.route(orderRoute, async route => {
                assert.equal(new URL(route.request().url()).searchParams.get('type'), type);
                orderReads++;
                if (type === 'docker' && orderReads === 1) {
                    await route.fulfill({ status: 503, contentType: 'application/json', body: '{"ok":false,"error":"Synthetic order failure"}' });
                    return;
                }
                await route.fulfill({ contentType: 'text/plain', body: '["folder-other","folder-active"]' });
            });
            try {
                for (const name of scripts) await page.addScriptTag({ url: `${baseUrl}/plugin/scripts/${name}` });
                await page.addStyleTag({ content: nativeSwitchCss });
                await page.addScriptTag({ content: nativeSwitchSource });
                await page.evaluate(({ type, getMembersApi, updateList }) => {
                    const form = settingsFixture.form;
                    form.name.value = 'Fixture folder';
                    form.regex.value = type === 'docker' ? '^automatic$' : '';
                    const folders = {
                        active: { name: form.name.value, regex: form.regex.value, containers: ['manual'], membershipPolicy: type === 'vm' ? 'folderview3' : '' },
                        other: { name: 'Outside <synthetic>', containers: ['foreign'], regex: '^overlap$' }
                    };
                    const prefs = { autoRules: type === 'vm' ? [{ id: 'fixture-migration', kind: 'name_regex', pattern: '^automatic$', folderId: 'active' }] : [] };
                    const names = ['manual', 'automatic', 'overlap', 'candidate', 'foreign'];
                    const facts = Object.fromEntries(names.map(name => [name, { name, Labels: name === 'overlap'
                        ? { 'folder.view3': 'Fixture folder' } : { 'example.private': 'sensitive-fixture-value' } }]));
                    const member = Name => ({ Name, Icon: '/plugin/images/folder-icon.png' });
                    const collections = { selected: [member('manual')], choose: [member('overlap'), member('candidate')],
                        selectedRegex: [member('automatic')], hiddenPreviewMembers: new Set() };
                    const list = FolderViewPlusFoundationModules.folderEditorMemberList.createApi({
                        window, $, getMemberCollections: () => collections, iconFallbackPath: '/plugin/images/folder-icon.png'
                    });
                    const dependencies = { window, $, type, getForm: () => form, allFoldersById: folders, folderEditorTypePrefs: prefs,
                        utils: FolderViewPlusUtils, memberIdentityModule: FolderViewPlusMemberIdentity, requestClient: FolderViewPlusRequest,
                        surfaceT: (_key, fallback, ...params) => fallback.replace(/\$(\d+)/g, (_token, index) => params[Number(index) - 1]),
                        editingFolderDefaults: false, getActiveFolderIdForChildOrdering: () => 'active', getFolderEditorRulesApi: () => null,
                        getFolderEditorMemberListApi: () => list, folderEditorMembersModule: FolderViewPlusFolderEditorMembers,
                        getAllMembers: () => names.map(member), getExplicitMemberNames: settingsFixture.getExplicitMemberNames,
                        readLegacyRegexValidation: () => ({ status: 'valid' }), isFormInitialized: false, activeEditorSection: 'general' };
                    const makeFixture = new Function(...Object.keys(dependencies), `let folderEditorMembersApi;
                        ${getMembersApi}
                        ${updateList}
                        return { api: getFolderEditorMembersApi(), updateList, openMembers() {
                            activeEditorSection = 'members'; getFolderEditorMembersApi().refreshAssignmentDetails();
                        } };`);
                    window.assignmentFixture = makeFixture(...Object.values(dependencies));
                    assignmentFixture.api.setAssignmentInventory(facts, names.map(member));
                    assignmentFixture.updateList();
                }, { type, getMembersApi, updateList });
                assert.equal(orderReads, 0);
                await page.evaluate(() => { settingsFixture.switchSection('members'); assignmentFixture.openMembers(); });
                const reason = name => page.locator(`tr[data-name="${name}"] .name-col + .assignment-col`);
                const waitForReason = (name, phrase) => page.waitForFunction(({ name, phrase }) =>
                    document.querySelector(`tr[data-name="${name}"] .assignment-col`)?.textContent.includes(phrase), { name, phrase });
                const heading = page.getByRole('columnheader', { name: 'Assignment reason' });
                assert.ok(await heading.isVisible());
                await waitForReason('manual', 'Manually assigned');
                await waitForReason('automatic', 'Matched by regex');
                if (type === 'docker') {
                    assert.match(await reason('overlap').textContent(), /Matches Outside <synthetic> · Matched by regex/);
                    assert.doesNotMatch(await reason('overlap').textContent(), /Assigned to/);
                    await page.evaluate(() => settingsFixture.form.regex.dispatchEvent(new Event('input', { bubbles: true })));
                }
                await waitForReason('overlap', 'Assigned to Outside <synthetic> · Matched by regex');
                assert.equal(orderReads, type === 'docker' ? 2 : 1);
                const overlap = await reason('overlap').textContent();
                assert.equal(overlap.includes('Matches Fixture folder · Matched by label'), type === 'docker');
                assert.ok(await reason('overlap').isVisible());
                assert.equal(await reason('overlap').locator('details').count(), 0);
                assert.ok(await reason('overlap').evaluate(cell => cell.scrollWidth <= cell.clientWidth + 1));
                await page.locator('.fv-member-assignment-context > summary').click();
                await page.getByText('foreign · Assigned to Outside <synthetic> · Manually assigned', { exact: true }).waitFor();
                assert.equal(await page.locator('.fv-member-assignment-context input, .fv-member-assignment-context synthetic').count(), 0);
                assert.deepEqual(await page.evaluate(() => assignmentFixture.api.collectBulkMoveScope().names.sort()), ['candidate', 'manual', 'overlap']);
                await waitForReason('candidate', 'No folder assignment');
                await page.locator('tr[data-name="candidate"] .switch-button-background').click();
                await waitForReason('candidate', 'Preview · Manually assigned');
                // The real editor calls the same render wrapper after regex evaluation replaces the rows.
                await page.evaluate(() => assignmentFixture.updateList());
                await waitForReason('candidate', 'No folder assignment');
                assert.equal(orderReads, type === 'docker' ? 2 : 1);
                assert.doesNotMatch(await page.locator('.fv-member-assignment-context').textContent(), /sensitive-fixture-value|fixture-migration/);
            } finally {
                await page.unroute(orderRoute);
            }
        }
    }, { allowedConsoleErrors: [/^console: Failed to load resource: the server responded with a status of 503\b/] });
};
