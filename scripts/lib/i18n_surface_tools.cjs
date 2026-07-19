'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const AUTO_KEY_PREFIX = 'legacy.surface.';
const TRANSLATABLE_ATTRIBUTES = Object.freeze(['placeholder', 'aria-label', 'title']);
const EXCLUDED_TAGS = new Set(['script', 'style', 'code', 'pre', 'svg', 'path']);

const decodeEntities = (value) => String(value || '')
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");

const normalizePhrase = (value) => decodeEntities(value).replace(/\s+/g, ' ').trim();

const decodeJavascriptText = (value) => String(value || '')
    .replace(/\\r\\n|\\n|\\r|\\t/g, ' ')
    .replace(/\\(['"\\])/g, '$1');

const normalizeTemplatePhrase = (value) => {
    let parameter = 0;
    return normalizePhrase(decodeJavascriptText(value).replace(/\$\{[^{}]*\}/g, () => `$${++parameter}`));
};

const isUserFacingPhrase = (value) => {
    const phrase = normalizePhrase(value);
    if (phrase.length < 2 || phrase.length > 600 || !/[A-Za-z]/.test(phrase)) return false;
    if (/^(?:a|an|and|but|for|in|of|on|or|the|to|with)$/i.test(phrase)) return false;
    if (/^(?:https?:|mailto:|data:|\/|#[A-Fa-f0-9]{3,8}$)/.test(phrase)) return false;
    if (/^(?:true|false|null|undefined|GET|POST|JSON|HTML|CSS|JS)$/i.test(phrase)) return false;
    if (/[{}<>`]/.test(phrase) || /\$\{|<\?|\?>|=>|===|!==|&&|\|\||\b(?:const|let|var|function|return)\b/.test(phrase)) return false;
    if (/^[A-Z0-9_.:/-]+$/.test(phrase)) return false;
    return true;
};

const parseOpeningTag = (source, index) => {
    const start = source.lastIndexOf('<', index);
    if (start < 0) return null;
    const end = source[index] === '>' ? index : source.indexOf('>', index);
    if (end < index) return null;
    const fragment = source.slice(start, end + 1);
    const match = fragment.match(/^<([A-Za-z][A-Za-z0-9:-]*)(?:\s[^<>]*)?>$/s);
    if (!match) return null;
    return { source: fragment, tag: match[1].toLowerCase(), start };
};

const lineNumberAt = (source, index) => source.slice(0, index).split('\n').length;

const extractFileCandidates = (source, relativePath = '') => {
    const rows = [];
    const add = (value, kind, index, attribute = '') => {
        const phrase = kind === 'template' ? normalizeTemplatePhrase(value) : normalizePhrase(value);
        if (!isUserFacingPhrase(phrase)) return;
        rows.push({ value: phrase, kind, attribute, file: relativePath, line: lineNumberAt(source, index) });
    };

    const attributeRegex = /\b(placeholder|aria-label|title)\s*=\s*["']([^"'<>]*[A-Za-z][^"'<>]*)["']/gi;
    let match;
    while ((match = attributeRegex.exec(source)) !== null) {
        const tag = parseOpeningTag(source, match.index);
        if (!tag || EXCLUDED_TAGS.has(tag.tag) || /\b(?:data-i18n|data-i18n-ignore)\b/.test(tag.source)) continue;
        add(match[2], 'attribute', match.index, match[1].toLowerCase());
    }

    const textRegex = />([^<>{}`$]*[A-Za-z][^<>{}`$]*)</g;
    while ((match = textRegex.exec(source)) !== null) {
        const tag = parseOpeningTag(source, match.index);
        if (!tag || EXCLUDED_TAGS.has(tag.tag) || /\b(?:data-i18n|data-i18n-ignore)\b/.test(tag.source)) continue;
        add(match[1], 'text', match.index);
    }

    const writerPatterns = [
        /\.(?:text|html)\(\s*'((?:\\.|[^'\\])*)'\s*\)/g,
        /\.(?:text|html)\(\s*"((?:\\.|[^"\\])*)"\s*\)/g
    ];
    for (const regex of writerPatterns) {
        while ((match = regex.exec(source)) !== null) {
            if (!/[<>]/.test(match[1])) add(decodeJavascriptText(match[1]), 'writer', match.index);
        }
    }
    const writerTemplateRegex = /\.(?:text|html)\(\s*`([^`]*)`\s*\)/g;
    while ((match = writerTemplateRegex.exec(source)) !== null) {
        if (!/[<>]/.test(match[1])) add(match[1], 'template', match.index);
    }

    const propertyPatterns = [
        /\b(?:title|text|label|description|message|placeholder|ariaLabel|confirmButtonText|cancelButtonText)\s*:\s*'((?:\\.|[^'\\])*)'/g,
        /\b(?:title|text|label|description|message|placeholder|ariaLabel|confirmButtonText|cancelButtonText)\s*:\s*"((?:\\.|[^"\\])*)"/g
    ];
    for (const regex of propertyPatterns) {
        while ((match = regex.exec(source)) !== null) add(decodeJavascriptText(match[1]), 'property', match.index);
    }
    const propertyTemplateRegex = /\b(?:title|text|label|description|message|placeholder|ariaLabel|confirmButtonText|cancelButtonText)\s*:\s*`([^`]*)`/g;
    while ((match = propertyTemplateRegex.exec(source)) !== null) add(match[1], 'template', match.index);
    return rows;
};

const collectSourceFiles = (pluginDir) => {
    const files = [];
    const queue = [pluginDir];
    while (queue.length > 0) {
        const current = queue.pop();
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
            const fullPath = path.join(current, entry.name);
            const relativePath = path.relative(pluginDir, fullPath).replace(/\\/g, '/');
            if (entry.isDirectory()) {
                if (!relativePath.startsWith('scripts/include') && !relativePath.startsWith('langs')) queue.push(fullPath);
                continue;
            }
            if (/\.(?:page|js)$/i.test(entry.name)) files.push(fullPath);
        }
    }
    return files.sort();
};

const collectSurfaceCandidates = (pluginDir) => {
    const byPhrase = new Map();
    const fileCounts = {};
    for (const fullPath of collectSourceFiles(pluginDir)) {
        const relativePath = path.relative(pluginDir, fullPath).replace(/\\/g, '/');
        const rows = extractFileCandidates(fs.readFileSync(fullPath, 'utf8'), relativePath);
        if (rows.length > 0) fileCounts[relativePath] = rows.length;
        for (const row of rows) {
            if (!byPhrase.has(row.value)) byPhrase.set(row.value, []);
            byPhrase.get(row.value).push(row);
        }
    }
    return { byPhrase, fileCounts };
};

const keyForPhrase = (phrase) => `${AUTO_KEY_PREFIX}${crypto.createHash('sha256').update(normalizePhrase(phrase)).digest('hex').slice(0, 16)}`;

module.exports = Object.freeze({
    AUTO_KEY_PREFIX,
    TRANSLATABLE_ATTRIBUTES,
    normalizePhrase,
    normalizeTemplatePhrase,
    isUserFacingPhrase,
    extractFileCandidates,
    collectSourceFiles,
    collectSurfaceCandidates,
    keyForPhrase
});
