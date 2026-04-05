import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const repoRoot = path.resolve(process.cwd());
const schemaPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.editor.schema.js'
);
const folderPagePath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/Folder.page'
);
const folderJsPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.js'
);
const folderStateJsPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.editor.state.js'
);

const schemaSource = fs.readFileSync(schemaPath, 'utf8');
const folderPage = fs.readFileSync(folderPagePath, 'utf8');
const folderJs = fs.readFileSync(folderJsPath, 'utf8');
const folderStateJs = fs.readFileSync(folderStateJsPath, 'utf8');

const schemaContext = { window: {} };
vm.createContext(schemaContext);
vm.runInContext(schemaSource, schemaContext);

const modernSchema = schemaContext.window.FolderViewPlusFolderEditorSchema.createModernSchema({});
const schemaFieldsBySection = modernSchema.SECTION_FIELD_NAMES;
const schemaFields = Object.values(schemaFieldsBySection).flat();
const pageFieldNames = new Set(Array.from(folderPage.matchAll(/name="([^"]+)"/g)).map((match) => match[1]));
const buildFolderPayloadBlock = folderJs.match(/const buildFolderPayloadFromForm = \(e\) => \{([\s\S]*?)\n\};/)?.[1] || '';

const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test('modern folder editor schema fields all exist in the page markup and metadata maps', () => {
    const missingPageFields = schemaFields.filter((fieldName) => !pageFieldNames.has(fieldName));
    assert.deepEqual(missingPageFields, []);

    const missingChangeLabels = schemaFields.filter(
        (fieldName) => !Object.prototype.hasOwnProperty.call(modernSchema.SECTION_CHANGE_LABELS, fieldName)
    );
    assert.deepEqual(missingChangeLabels, []);

    const inheritedFieldNames = Object.keys(modernSchema.INHERITED_FIELD_HINTS || {});
    const unknownInheritedFields = inheritedFieldNames.filter((fieldName) => !schemaFields.includes(fieldName));
    assert.deepEqual(unknownInheritedFields, []);

    const invalidDefaultFields = Object.entries(modernSchema.SECTION_DEFAULT_VALUES).flatMap(([sectionKey, defaults]) =>
        Object.keys(defaults || {}).filter((fieldName) => !(schemaFieldsBySection[sectionKey] || []).includes(fieldName))
    );
    assert.deepEqual(invalidDefaultFields, []);
});

test('modern folder editor load path covers every schema-backed field', () => {
    assert.match(folderJs, /populateParentFolderOptions\(/);

    const fieldsLoadedViaBinding = schemaFields.filter((fieldName) => fieldName !== 'parent_folder_id');
    fieldsLoadedViaBinding.forEach((fieldName) => {
        assert.match(
            folderJs,
            new RegExp(`setField(?:Value|Checked)\\('${escapeRegex(fieldName)}'`),
            `Expected modern folder editor loader to bind ${fieldName}.`
        );
    });

    assert.match(folderJs, /const getFolderEditorStateApi = \(\) =>/);
    assert.match(folderJs, /const restoreSectionSavedValues = \(sectionKey\) => \{\s*getFolderEditorStateApi\(\)\?\.restoreSectionSavedValues\(sectionKey\);\s*\};/);
    assert.match(folderJs, /const applySectionDefaults = \(sectionKey\) => \{\s*getFolderEditorStateApi\(\)\?\.applySectionDefaults\(sectionKey\);\s*\};/);
    assert.match(folderStateJs, /const fieldNames = sectionFieldNames\[sectionKey\] \|\| \[\];[\s\S]*setFormControlValue\(fieldName,\s*baselineSnapshot\.fields\[fieldName\]\);/);
    assert.match(folderStateJs, /const defaults = sectionDefaultValues\[sectionKey\];[\s\S]*Object\.entries\(defaults\)\.forEach\(\(\[fieldName,\s*value\]\) =>/);
});

test('modern folder editor save path references every schema-backed field', () => {
    assert.match(folderJs, /const folder = buildFolderPayloadFromForm\(e\);/);
    assert.match(buildFolderPayloadBlock, /parentId:\s*normalizeParentFolderId\(e\.parent_folder_id\?\.value \|\| ''\)/);

    const fieldsSavedDirectly = schemaFields.filter((fieldName) => fieldName !== 'parent_folder_id');
    const missingSavedFields = fieldsSavedDirectly.filter((fieldName) => !buildFolderPayloadBlock.includes(fieldName));
    assert.deepEqual(missingSavedFields, []);
});
