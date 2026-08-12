import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(process.cwd());
const plugin = 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus';
const previewSource = fs.readFileSync(path.join(root, plugin, 'scripts/folder.editor.preview.js'), 'utf8');
const editorSource = fs.readFileSync(path.join(root, plugin, 'scripts/folder.js'), 'utf8');

const createPreviewHarness = ({ previewNames, includedNames }) => {
    let renderedHtml = '';
    const canvas = {
        length: 1,
        html(value) {
            renderedHtml = String(value || '');
            return this;
        },
        find() {
            return { get: () => null, each: () => null };
        }
    };
    const $ = (selector) => selector === '#fvLivePreviewCanvas' ? canvas : { length: 0 };
    const window = {};
    vm.runInNewContext(previewSource, { window, console });
    const members = new Map([
        ['Visible app', { Name: 'Visible app', Icon: '/visible.png' }],
        ['Hidden app', { Name: 'Hidden app', Icon: '/hidden.png' }]
    ]);
    const form = {
        preview: { value: '1' },
        preview_status: { value: 'symbol' },
        preview_rows: { value: '1' },
        dropdown_style: { value: 'minimal' },
        preview_border: { checked: false },
        preview_border_glow: { checked: false },
        preview_vertical_bars: { checked: false },
        preview_grayscale: { checked: false },
        preview_hover_animation: { value: 'none' },
        folder_accent_enabled: { checked: false },
        icon: { value: '/folder.png' },
        name: { value: 'Media' },
        preview_hide_nested_items: { checked: false },
        parent_folder_id: { value: '' }
    };
    const api = window.FolderViewPlusFolderEditorPreview.createApi({
        $,
        getForm: () => form,
        getIncludedMemberNames: () => includedNames,
        getPreviewMemberNames: () => previewNames,
        getMemberMapByName: () => members,
        normalizePreviewRowLimit: () => 1,
        normalizeDropdownStyle: () => 'minimal',
        getDropdownStyleTokens: () => ({
            minWidth: '12px', height: '16px', padding: '0', radius: '0', border: 'transparent',
            hoverBorder: 'transparent', background: 'transparent', hoverBackground: 'transparent',
            shadow: 'none', hoverShadow: 'none'
        }),
        buildSampleMemberState: () => ({ label: 'Started', color: '#fff' }),
        previewModeLabels: { 1: 'Icon and label' },
        defaultFolderIconPath: '/folder.png',
        iconFallbackPath: '/fallback.png'
    });
    api.renderLivePreviewCanvas();
    return renderedHtml;
};

test('modern editor live preview renders only members whose preview toggle is enabled', () => {
    const html = createPreviewHarness({
        includedNames: ['Visible app', 'Hidden app'],
        previewNames: ['Visible app']
    });
    assert.match(html, /Visible app/);
    assert.doesNotMatch(html, /Hidden app/);
});

test('modern editor live preview explains when every included member is hidden', () => {
    const html = createPreviewHarness({
        includedNames: ['Hidden app'],
        previewNames: []
    });
    assert.match(html, /All included members are hidden from the collapsed preview\./);
});

test('preview visibility participates in editor dirty state and live-preview dependencies', () => {
    assert.match(editorSource, /previewVisible:\s*\$\(row\)\.find\('input\.member-preview-switch'\)\.prop\('checked'\) === true/);
    assert.match(editorSource, /const getPreviewMemberNames = \(\) =>[\s\S]*input\.container-switch[\s\S]*input\.member-preview-switch/);
    assert.match(editorSource, /getIncludedMemberNames,\s*getPreviewMemberNames,\s*getMemberMapByName/);
    assert.match(editorSource, /input\.member-preview-switch[\s\S]*updateLiveSummary\(\)/);
});
