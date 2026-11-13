import { verifyFolderEditorStatusLayout } from '../helpers/folder-editor-status-layout.mjs';
import { verifyFolderEditorHealthHydration } from '../helpers/folder-editor-health-hydration.mjs';

export const registerFolderEditorStatusCases = ({ test, baseUrl }) => {
    test('Status tab aligns native accent and lock controls while retaining live draft values', async ({ page }) => {
        await verifyFolderEditorStatusLayout(page, baseUrl);
    });
    test('Late Docker editor startup restores Health fields and help while VM keeps them hidden', async ({ page }) => {
        await verifyFolderEditorHealthHydration(page, baseUrl);
    });
};
