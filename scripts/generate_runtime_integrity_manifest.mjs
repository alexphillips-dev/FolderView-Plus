#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const valueAfter = (flag) => {
    const index = process.argv.indexOf(flag);
    return index >= 0 ? String(process.argv[index + 1] || '').trim() : '';
};

const root = path.resolve(valueAfter('--root'));
const output = path.resolve(valueAfter('--output'));
if (!valueAfter('--root') || !valueAfter('--output')) {
    console.error('Usage: node scripts/generate_runtime_integrity_manifest.mjs --root <plugin-root> --output <manifest>');
    process.exit(1);
}
if (!fs.statSync(root, { throwIfNoEntry: false })?.isDirectory()) {
    console.error(`Runtime integrity root is unavailable: ${root}`);
    process.exit(1);
}
if (path.dirname(output) !== root || path.basename(output) !== 'runtime-integrity.json') {
    console.error('Runtime integrity output must be runtime-integrity.json in the plugin root.');
    process.exit(1);
}

const normalize = (absolute) => path.relative(root, absolute).replaceAll('\\', '/');
const shouldTrack = (relative) => {
    if (!relative || relative === 'runtime-integrity.json') {
        return false;
    }
    if (/^[^/]+\.(?:page|php|json)$/i.test(relative)) {
        return true;
    }
    if (!/^(?:server|scripts|styles)\//.test(relative)) {
        return false;
    }
    return /\.(?:php|js|sh|css|json)$/i.test(relative);
};
const walk = (directory) => {
    const files = [];
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const absolute = path.join(directory, entry.name);
        if (entry.isSymbolicLink()) {
            continue;
        }
        if (entry.isDirectory()) {
            files.push(...walk(absolute));
        } else if (entry.isFile()) {
            files.push(absolute);
        }
    }
    return files;
};

const files = walk(root)
    .map((absolute) => ({ absolute, relative: normalize(absolute) }))
    .filter(({ relative }) => shouldTrack(relative))
    .sort((left, right) => left.relative.localeCompare(right.relative))
    .map(({ absolute, relative }) => {
        const contents = fs.readFileSync(absolute);
        return {
            path: relative,
            sha256: crypto.createHash('sha256').update(contents).digest('hex'),
            size: contents.length,
            mode: '0755'
        };
    });

const manifest = {
    schemaVersion: 1,
    algorithm: 'sha256',
    policy: 'folderview-plus-runtime-v1',
    files
};
fs.writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o755 });
console.log(`Runtime integrity manifest generated for ${files.length} files.`);
