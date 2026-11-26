import assert from 'node:assert/strict';
import path from 'node:path';

const scripts = path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts');

export const registerEditorMemberTransitionCase = ({ test }) => {
    test('Folder editor keeps automatic membership and hidden preview when releasing an explicit member', async ({ page }) => {
        await page.setContent('<!doctype html><html lang="en"><head><title>Member edits</title></head><body><form><input name="regex" value="^eligible$"><select id="fvMemberFilter"><option value="all">All</option><option value="manual">Manual only</option></select><table class="sortable"><tbody></tbody></table></form></body></html>');
        await page.addScriptTag({ path: path.resolve('node_modules/jquery/dist/jquery.js') });
        for (const name of ['folder.editor.members', 'folder.editor.member-list', 'folder.editor.regex-selection', 'folderviewplus.rule-predicate-validation']) {
            await page.addScriptTag({ path: path.join(scripts, `${name}.js`) });
        }
        const result = await page.evaluate(async () => {
            $.fn.switchButton = function () { return this; };
            const getRegexField = () => document.querySelector('input[name="regex"]');
            const collections = { selected: [{ Name: 'eligible' }, { Name: 'unavailable', Unavailable: true }],
                choose: [{ Name: 'different' }], selectedRegex: [], hiddenPreviewMembers: new Set(['eligible', 'unavailable']) };
            const getAllMembers = () => [...collections.selected, ...collections.choose, ...collections.selectedRegex];
            const setMemberCollections = next => Object.assign(collections, next);
            const { folderEditorMemberList, folderEditorRegexSelection, rulePredicateValidation } = FolderViewPlusFoundationModules;
            const checks = [];
            const validator = rulePredicateValidation.create({ request: async ({ data }) => {
                checks.push(data.pattern);
                return { valid: data.pattern !== '(?<=diff.*)erent' };
            } });
            const members = FolderViewPlusFolderEditorMembers.createApi({
                $, getAllMembers, setMemberCollections,
                getMembershipForm: () => document.querySelector('form'),
                validateMembershipPattern: pattern => validator.check({ type: 'docker', pattern, regexMode: 'legacy-folder' }),
                reconcileAutomaticMembership: () => regex.updateRegex(getRegexField(), { immediate: true })
            });
            const list = folderEditorMemberList.createApi({ window, $, getMemberCollections: () => collections,
                applyMemberFilters: members.applyMemberFilters, reconcileMembershipChange: members.reconcileMembershipChange });
            const regex = folderEditorRegexSelection.createApi({ window, getRegexField, getMemberCollections: () => collections,
                setMemberCollections, syncMemberArraysFromTable: members.syncMemberArraysFromTable, updateList: list.updateList,
                validatePattern: pattern => validator.check({ type: 'docker', pattern, regexMode: 'legacy-folder' }) });
            const checkbox = name => document.querySelector(`[data-name="${name}"] .container-switch`);
            await regex.evaluateRegexSelection();
            checkbox('eligible').click();
            checkbox('unavailable').click();
            const released = [checkbox('eligible').checked, checkbox('eligible').disabled,
                ...collections.hiddenPreviewMembers];
            checkbox('different').click();
            $('#fvMemberFilter').val('manual');
            members.applyMemberFilters();
            const manual = $(checkbox('different')).closest('tr').is(':visible');
            checkbox('different').click();
            $('#fvMemberFilter').val('all');
            getRegexField().value = ' ^different$';
            await regex.evaluateRegexSelection();
            const whitespace = checkbox('different').checked;
            getRegexField().value = '(?<=diff.*)erent';
            const rejected = await regex.evaluateRegexSelection();
            const lockedByRejectedPattern = checkbox('different').disabled;
            regex.dispose();
            list.dispose();
            return { released, manual, whitespace, rejected, lockedByRejectedPattern, checks };
        });
        assert.deepEqual(result, { released: [true, true, 'eligible'], manual: true, whitespace: false,
            rejected: false, lockedByRejectedPattern: false, checks: ['^eligible$', ' ^different$', '(?<=diff.*)erent'] });
    }, { skipAccessibility: true });
};
