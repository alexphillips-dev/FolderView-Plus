import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const settingsJs = fs.readFileSync(path.join(
    process.cwd(),
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.js'
), 'utf8');

test('Filter/View state-store normalizers initialize before the store is constructed', () => {
    const storeIndex = settingsJs.indexOf('const viewSettingsUiStateStore =');
    assert.ok(storeIndex > 0, 'view settings state store must be constructed');
    for (const declaration of [
        'const normalizeAdvancedSearchMap =',
        'const normalizeQuickFolderFilterMode =',
        'const normalizedFilter =',
        'const normalizeHealthSeverityFilterMode ='
    ]) {
        const declarationIndex = settingsJs.indexOf(declaration);
        assert.ok(declarationIndex >= 0, `${declaration} must exist`);
        assert.ok(declarationIndex < storeIndex, `${declaration} must initialize before the state store`);
    }
});
