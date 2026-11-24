import assert from 'node:assert/strict';
import fs from 'node:fs';
import { nativeSwitchCss, nativeSwitchSource } from '../helpers/docker-native-switch.mjs';
import { mountSettingsEditor } from '../helpers/folder-editor-settings-host.mjs';

const root = 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus';
const folderPage = fs.readFileSync(`${root}/Folder.page`, 'utf8');
const folderJs = fs.readFileSync(`${root}/scripts/folder.js`, 'utf8');
const getMembersApi = folderJs.match(/const getFolderEditorMembersApi = \(\) => \{[\s\S]*?\n\};/)[0];
const updateList = folderJs.match(/const updateList = \(afterRender = null\) => [\s\S]*?\n\}\);/)[0];
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
                        getAllMembers: () => names.map(member), isFormInitialized: false };
                    const makeFixture = new Function(...Object.keys(dependencies), `let folderEditorMembersApi;
                        ${getMembersApi}
                        ${updateList}
                        return { api: getFolderEditorMembersApi(), updateList };`);
                    window.assignmentFixture = makeFixture(...Object.values(dependencies));
                    assignmentFixture.api.setAssignmentInventory(facts, names.map(member));
                    assignmentFixture.updateList();
                    settingsFixture.switchSection('members');
                }, { type, getMembersApi, updateList });
                const disclosure = name => page.locator(`tr[data-name="${name}"] .fv-member-assignment`);
                const detailsMatch = (selector, phrase) => page.waitForFunction(({ selector, phrase }) =>
                    document.querySelector(selector)?.lastElementChild.textContent.includes(phrase), { selector, phrase });
                assert.equal(orderReads, 0);
                await disclosure('automatic').locator('summary').focus();
                await page.keyboard.press('Enter');
                await detailsMatch('tr[data-name="automatic"] details', 'Assigned to Fixture folder · Matched by regex');
                assert.equal(orderReads, 1, 'real client parsed the text/plain saved order lazily');
                await disclosure('overlap').locator('summary').click();
                await detailsMatch('tr[data-name="overlap"] details', 'Assigned to Outside <synthetic> · Matched by regex');
                const overlap = await disclosure('overlap').textContent();
                assert.equal(overlap.includes('Matches Fixture folder · Matched by label'), type === 'docker');
                const size = await disclosure('overlap').boundingBox();
                assert.ok(size.width > 45, `the member table leaves room for the explanation (${size.width}px)`);
                await page.locator('.fv-member-assignment-context > summary').click();
                await detailsMatch('.fv-member-assignment-context', 'foreign · Assigned to Outside <synthetic> · Manually assigned');
                assert.equal(await page.locator('.fv-member-assignment-context input, .fv-member-assignment-context synthetic').count(), 0);
                assert.deepEqual(await page.evaluate(() => assignmentFixture.api.collectBulkMoveScope().names.sort()), ['candidate', 'manual', 'overlap']);
                await disclosure('candidate').locator('summary').click();
                await detailsMatch('tr[data-name="candidate"] details', 'No folder assignment');
                await page.locator('tr[data-name="candidate"] .switch-button-background').click();
                await detailsMatch('tr[data-name="candidate"] details', 'Preview · Assigned to Fixture folder · Manually assigned');
                // The real editor calls the same render wrapper after regex evaluation replaces the rows.
                await page.evaluate(() => assignmentFixture.updateList());
                assert.equal(await disclosure('candidate').getAttribute('open'), '');
                await detailsMatch('tr[data-name="candidate"] details', 'No folder assignment');
                assert.equal(orderReads, 1);
                assert.doesNotMatch(await page.locator('.fv-member-assignment-context').textContent(), /sensitive-fixture-value|fixture-migration/);
            } finally {
                await page.unroute(orderRoute);
            }
        }
    });
};
