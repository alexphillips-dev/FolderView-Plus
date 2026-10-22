import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const themeHost = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.theme-host.js');

const source = fs.readFileSync(new URL('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.theme-resolver.js', import.meta.url), 'utf8');
const darkHost = {
    '--background-color': '#0a0c11', '--table-background-color': '#12151d',
    '--mild-background-color': '#161a23', '--text-color': '#e7eaf0',
    '--alt-text-color': '#8b93a5', '--link-text-color': '#4f8bff',
    '--border-color': '#232833', '--button-background': '#12151d',
    '--hover-button-background': '#161a23', '--input-bg-color': '#12151d'
};

const fixture = (host = {}, canvasContext = null) => {
    let writes = 0;
    const element = () => {
        const values = new Map(), attributes = new Map();
        return {
            nodeType: 1, classList: { contains: () => false },
            style: {
                getPropertyValue: name => values.get(name) || '',
                setProperty(name, value) { writes++; if (value) values.set(name, value); else values.delete(name); }
            },
            getAttribute: name => attributes.get(name) || '',
            setAttribute: (name, value) => attributes.set(name, value)
        };
    };
    const body = element(), html = element();
    const document = {
        body, documentElement: html,
        querySelector: selector => selector === 'body' ? body : selector === 'html' ? html : null,
        createElement: () => ({ getContext: () => canvasContext })
    };
    const window = {
        FolderViewPlusFoundationModules: { themeHost },
        document, matchMedia: () => ({ matches: false }),
        getComputedStyle: node => ({
            color: '#eeeeee', backgroundColor: '#171718',
            getPropertyValue: name => host[name] || node.style.getPropertyValue(name)
        }),
        CSS: { supports: (property, value) => property === 'border-radius' && value === '999px' }
    };
    vm.runInNewContext(source, { window, document });
    return { api: window.FolderViewPlusThemeResolver, window, body, html, host, writes: () => writes };
};

test('modern host palette wins over stale legacy colors and supplies shared component chrome', () => {
    const f = fixture({ ...darkHost, '--text': '#ffffff', '--orange': '#ff8000', '--tp-r-full': '999px' });
    const snapshot = f.api.applyResolvedThemeTokens();
    assert.equal(snapshot.hostPaletteApplied, true);
    assert.equal(snapshot.tokens.accent, 'rgb(79, 139, 255)');
    assert.equal(snapshot.tokens.textPrimary, 'rgb(231, 234, 240)');
    for (const node of [f.body, f.html]) {
        assert.equal(node.style.getPropertyValue('--fvplus-ui-page'), 'rgb(10, 12, 17)');
        assert.equal(node.style.getPropertyValue('--fvplus-settings-button-bg-top'), 'rgb(18, 21, 29)');
        assert.equal(node.style.getPropertyValue('--fvplus-runtime-menu-bg'), 'rgb(18, 21, 29)');
        assert.equal(node.style.getPropertyValue('--fvplus-dashboard-accent'), 'rgb(79, 139, 255)');
        assert.equal(node.style.getPropertyValue('--fvplus-ui-control-radius'), '999px');
    }
    assert.equal(snapshot.tokens.editorBg, 'rgb(10, 12, 17)');
    assert.equal(snapshot.tokens.editorPanel, 'rgb(18, 21, 29)');
    const writes = f.writes();
    f.api.applyResolvedThemeTokens();
    assert.equal(f.writes(), writes, 'an identical palette must not wake style observers again');
});

test('host palette switches to light and custom accents even if server theme metadata is stale', () => {
    const f = fixture({ ...darkHost });
    f.window.FolderViewPlusHostThemeName = 'black';
    f.api.applyResolvedThemeTokens();
    Object.assign(f.host, {
        '--background-color': '#f5f6f8', '--table-background-color': '#ffffff',
        '--text-color': '#14181f', '--alt-text-color': '#62697a', '--link-text-color': '#b91c1c'
    });
    const snapshot = f.api.applyResolvedThemeTokens();
    assert.equal(snapshot.classification, 'light');
    assert.equal(snapshot.hostPaletteApplied, true);
    assert.equal(f.body.style.getPropertyValue('--fvplus-ui-accent'), 'rgb(185, 28, 28)');
    assert.equal(f.body.style.getPropertyValue('--fvplus-runtime-menu-fg'), 'rgb(20, 24, 31)');
});

test('safe and high contrast modes clear host overrides and automatic mode can restore them', () => {
    const f = fixture({ ...darkHost });
    for (const mode of ['safe', 'highcontrast']) {
        f.api.applyResolvedThemeTokens('host', { modeInput: 'auto' });
        const snapshot = f.api.applyResolvedThemeTokens(mode, { modeInput: mode });
        assert.equal(snapshot.hostPaletteApplied, false);
        assert.equal(f.body.style.getPropertyValue('--fvplus-ui-accent'), '');
        assert.equal(f.body.style.getPropertyValue('--fvplus-settings-button-bg-top'), '');
        assert.equal(f.body.getAttribute('data-fv-theme-source'), 'fallback');
    }
    f.api.applyResolvedThemeTokens('restore', { modeInput: 'auto' });
    assert.equal(f.body.getAttribute('data-fv-theme-source'), 'host');
});

test('removing a theme removes host chrome and does not sample its previous resolved accent', () => {
    const f = fixture({ ...darkHost });
    f.api.applyResolvedThemeTokens();
    for (const key of Object.keys(f.host)) delete f.host[key];
    const snapshot = f.api.applyResolvedThemeTokens();
    assert.equal(snapshot.hostPaletteApplied, false);
    assert.equal(snapshot.tokens.accent, 'rgb(255, 138, 31)');
    assert.equal(f.body.style.getPropertyValue('--fvplus-ui-control-radius'), '');
    assert.equal(f.body.style.getPropertyValue('--fvplus-runtime-menu-bg'), '');
    assert.equal(f.api.applyResolvedThemeTokens().tokens.accent, snapshot.tokens.accent);
});

test('incomplete, transparent and invalid host surfaces retain the fallback palette', () => {
    for (const page of ['', 'transparent', 'rgba(0,0,0,0)', 'var(--missing)', 'linear-gradient(red, blue)', 'rgb(. . .)', 'rgb(0 0 0 1 1)']) {
        const f = fixture({ ...darkHost, '--background-color': page });
        assert.equal(f.api.applyResolvedThemeTokens().hostPaletteApplied, false, page);
    }
    const f = fixture({ ...darkHost, '--link-text-color': 'var(--missing)', '--brand-orange': '#4f8bff' });
    assert.equal(f.api.applyResolvedThemeTokens().tokens.accent, 'rgb(79, 139, 255)');
});

test('low contrast host text uses the existing recovery mode instead of unsafe host chrome', () => {
    const f = fixture({ ...darkHost, '--text-color': '#0a0c11' });
    const snapshot = f.api.applyResolvedThemeTokens();
    assert.equal(snapshot.appliedMode, 'highcontrast');
    assert.equal(snapshot.hostPaletteApplied, false);
    assert.equal(snapshot.tokens.textPrimary, 'rgb(255, 255, 255)');
});

test('modern space separated and percentage RGB colors are normalized', () => {
    const f = fixture({ ...darkHost, '--link-text-color': 'rgb(0% 70% 100% / 100%)' });
    assert.equal(f.api.applyResolvedThemeTokens().tokens.accent, 'rgb(0, 179, 255)');
});

test('an accent with insufficient label contrast retains its border color and uses readable text', () => {
    const f = fixture({ ...darkHost, '--link-text-color': '#e11d48' });
    const snapshot = f.api.applyResolvedThemeTokens();
    assert.equal(snapshot.tokens.accent, 'rgb(225, 29, 72)');
    assert.equal(snapshot.tokens.controlAccentText, snapshot.tokens.textPrimary);
    assert.equal(f.body.style.getPropertyValue('--fvplus-control-accent-text'), snapshot.tokens.textPrimary);
});

test('canvas colors that retain modern syntax are read once and rejected colors do not become black', () => {
    let fill = '#000000', samples = 0;
    const canvas = {
        get fillStyle() { return fill; },
        set fillStyle(value) { if (/^#|^color\(/.test(value)) fill = value; },
        clearRect() {}, fillRect() {},
        getImageData() { samples++; return { data: [79, 139, 255, 255] }; }
    };
    const f = fixture({ ...darkHost, '--link-text-color': 'color(srgb 0.31 0.545 1)' }, canvas);
    assert.equal(f.api.applyResolvedThemeTokens().tokens.accent, 'rgb(79, 139, 255)');
    assert.equal(samples, 1);
    f.host['--link-text-color'] = 'not-a-color';
    f.host['--brand-orange'] = '#4f8bff';
    assert.equal(f.api.applyResolvedThemeTokens().tokens.accent, 'rgb(79, 139, 255)');
    assert.equal(samples, 1);
});
