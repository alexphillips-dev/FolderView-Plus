import { verifyFolderEditorAdvancedLayout } from '../helpers/folder-editor-advanced-layout.mjs';

export const registerFolderEditorAdvancedCases = ({ test, baseUrl }) => {
    test('Advanced editor toggles align inline and paired settings share responsive rows', async ({ page }) => {
        await verifyFolderEditorAdvancedLayout(page, baseUrl);
    });
};
