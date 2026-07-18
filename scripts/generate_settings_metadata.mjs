#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const schemaPath = path.join(repoRoot, 'src', 'folderview.plus', 'usr', 'local', 'emhttp', 'plugins', 'folderview.plus', 'schemas', 'settings-table.schema.json');
const targetPath = path.join(repoRoot, 'src', 'folderview.plus', 'usr', 'local', 'emhttp', 'plugins', 'folderview.plus', 'scripts', 'folderviewplus.settings-metadata.js');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const serialized = JSON.stringify(schema);
const widthPresetSource = Object.entries(schema.widthPresets || {})
    .map(([key, values]) => `        ${JSON.stringify(key)}: Object.freeze(${JSON.stringify(values)})`)
    .join(',\n');

const output = `// Generated from schemas/settings-table.schema.json. Run scripts/generate_settings_metadata.mjs after editing the schema.
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewPlusSettingsMetadata = factory();
    root.FolderViewPlusSettingsMetadataModuleLoaded = true;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const CANONICAL_SETTINGS_TABLE_SCHEMA = ${serialized};
    const freezeEntry = (entry) => Object.freeze({
        ...entry,
        ...(entry.presets ? { presets: Object.freeze({ ...entry.presets }) } : {})
    });
    const SETTINGS_TABLE_COLUMN_SCHEMA_BY_TYPE = Object.freeze(Object.fromEntries(
        Object.entries(CANONICAL_SETTINGS_TABLE_SCHEMA.types || {}).map(([type, entries]) => [
            type,
            Object.freeze((entries || []).map(freezeEntry))
        ])
    ));
    const SETTINGS_TABLE_COLUMN_SCHEMA_MAP_BY_TYPE = Object.freeze(Object.fromEntries(
        Object.entries(SETTINGS_TABLE_COLUMN_SCHEMA_BY_TYPE).map(([type, entries]) => [
            type,
            Object.freeze(Object.fromEntries(entries.map((entry) => [entry.key, entry])))
        ])
    ));
    const DEFAULT_COLUMN_VISIBILITY_BY_TYPE = Object.freeze(Object.fromEntries(
        Object.entries(SETTINGS_TABLE_COLUMN_SCHEMA_BY_TYPE).map(([type, entries]) => [
            type,
            Object.freeze(Object.fromEntries(
                entries.filter((entry) => entry.hideable === true).map((entry) => [entry.key, entry.presets?.balanced !== false])
            ))
        ])
    ));
    const SETTINGS_TABLE_WIDTH_PRESET_VALUES = Object.freeze({
${widthPresetSource}
    });
    const SETTINGS_TABLE_COLUMN_COUNT = ${Number(schema.columnCount || 0)};

    return Object.freeze({
        SETTINGS_METADATA_SCHEMA_VERSION: Number(CANONICAL_SETTINGS_TABLE_SCHEMA.schemaVersion || 0),
        SETTINGS_TABLE_COLUMN_SCHEMA_BY_TYPE,
        SETTINGS_TABLE_COLUMN_SCHEMA_MAP_BY_TYPE,
        DEFAULT_COLUMN_VISIBILITY_BY_TYPE,
        SETTINGS_TABLE_WIDTH_PRESET_VALUES,
        SETTINGS_TABLE_COLUMN_COUNT
    });
}));
`;

if (process.argv.includes('--check')) {
    const current = fs.existsSync(targetPath) ? fs.readFileSync(targetPath, 'utf8').replace(/\r\n/g, '\n') : '';
    if (current !== output) {
        console.error('Settings metadata runtime is stale. Run: node scripts/generate_settings_metadata.mjs');
        process.exit(1);
    }
    console.log('Settings metadata schema and generated runtime match.');
    process.exit(0);
}

fs.writeFileSync(targetPath, output, 'utf8');
console.log(`Generated ${path.relative(repoRoot, targetPath)}`);
