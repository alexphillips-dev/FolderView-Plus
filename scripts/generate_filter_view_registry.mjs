#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pluginRoot = path.join(repoRoot, 'src', 'folderview.plus', 'usr', 'local', 'emhttp', 'plugins', 'folderview.plus');
const schemaPath = path.join(pluginRoot, 'schemas', 'filter-view-settings.schema.json');
const targetPath = path.join(pluginRoot, 'scripts', 'folderviewplus.settings-registry.js');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const serialized = JSON.stringify(schema);

const output = `// @ts-check
// Generated from schemas/filter-view-settings.schema.json. Run scripts/generate_filter_view_registry.mjs after editing the schema.
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewPlusSettingsRegistry = factory();
    root.FolderViewPlusSettingsRegistryModuleLoaded = true;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    'use strict';

    const SCHEMA = ${serialized};
    const definitions = [];
    Object.entries(SCHEMA.groups || {}).forEach(([group, groupDefinition]) => {
        Object.entries(groupDefinition.settings || {}).forEach(([key, setting]) => {
            definitions.push(Object.freeze({
                ...setting,
                group,
                handler: groupDefinition.handler,
                key,
                path: groupDefinition.path || '',
                storageKey: setting.storageKey || key,
                types: Object.freeze([...(setting.types || [])]),
                values: setting.values ? Object.freeze([...setting.values]) : undefined,
                consumerFiles: Object.freeze([...(groupDefinition.consumerFiles || [])])
            }));
        });
    });
    const DEFINITIONS = Object.freeze(definitions);
    const DEFINITION_MAP = new Map(DEFINITIONS.map((definition) => [
        \`\${definition.handler}:\${definition.key}\`,
        definition
    ]));

    const normalizeType = (value) => String(value || '').trim().toLowerCase() === 'vm' ? 'vm' : 'docker';
    const getDefinition = (handler, key, type) => {
        const definition = DEFINITION_MAP.get(\`\${String(handler || '')}:\${String(key || '')}\`) || null;
        if (!definition || !definition.types.includes(normalizeType(type))) return null;
        return definition;
    };
    const coerceValue = (definition, value, fallback) => {
        if (!definition) return fallback;
        if (definition.kind === 'boolean') return value === true;
        if (definition.kind === 'integer') {
            const parsed = Number(value);
            if (!Number.isFinite(parsed)) return fallback ?? definition.default;
            return Math.min(Number(definition.max), Math.max(Number(definition.min), Math.round(parsed)));
        }
        if (definition.kind === 'enum') {
            const normalized = String(value ?? '').trim().toLowerCase();
            return definition.values.includes(normalized) ? normalized : (fallback ?? definition.default);
        }
        return value;
    };
    const resolveChange = (handler, type, key, value, fallback) => {
        const definition = getDefinition(handler, key, type);
        if (!definition) return null;
        return Object.freeze({
            definition,
            group: definition.group,
            handler: definition.handler,
            key: definition.key,
            path: definition.path,
            storageKey: definition.storageKey,
            type: normalizeType(type),
            value: coerceValue(definition, value, fallback)
        });
    };

    return Object.freeze({
        schemaVersion: Number(SCHEMA.schemaVersion || 0),
        definitions: DEFINITIONS,
        normalizeType,
        getDefinition,
        coerceValue,
        resolveChange
    });
}));
`;

if (process.argv.includes('--check')) {
    const current = fs.existsSync(targetPath) ? fs.readFileSync(targetPath, 'utf8').replace(/\r\n/g, '\n') : '';
    if (current !== output) {
        console.error('Filter/View settings registry is stale. Run: node scripts/generate_filter_view_registry.mjs');
        process.exit(1);
    }
    console.log('Filter/View settings schema and generated runtime match.');
    process.exit(0);
}

fs.writeFileSync(targetPath, output, 'utf8');
console.log(`Generated ${path.relative(repoRoot, targetPath)}`);
