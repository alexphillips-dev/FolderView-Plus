import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Packaging only: catalogs remain in the chosen language and the README keeps
// its translation bootstrap. This helper never runs on an installed Unraid host.
export function applyChannelMessages(pluginRoot, branch) {
    if (branch !== 'dev') return;
    const langRoot = path.join(pluginRoot, 'langs');
    const updates = fs.readdirSync(langRoot).filter(name => /^[a-z]{2,3}(?:-[A-Za-z0-9]+)*\.json$/.test(name)).map(name => {
        const file = path.join(langRoot, name);
        const catalog = JSON.parse(fs.readFileSync(file, 'utf8'));
        for (const key of ['folderviewplus-dev-desc', 'folderviewplus-dev-quickstart']) {
            if (typeof catalog[key] !== 'string' || !catalog[key].trim()) throw new Error(`Missing packaged channel message: ${name}/${key}`);
        }
        return { file, catalog: { ...catalog, 'folderviewplus-desc': catalog['folderviewplus-dev-desc'], 'folderviewplus-quickstart': catalog['folderviewplus-dev-quickstart'] } };
    });
    const english = updates.find(row => path.basename(row.file) === 'en.json')?.catalog;
    if (!english) throw new Error('English channel catalog is unavailable.');
    const readmePath = path.join(pluginRoot, 'README.md');
    let readme = fs.readFileSync(readmePath, 'utf8');
    const escapeHtml = text => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    for (const id of ['folderviewplus-desc', 'folderviewplus-quickstart']) {
        const pattern = new RegExp(`(<span id="${id}">)[\\s\\S]*?(</span>)`);
        if (!pattern.test(readme)) throw new Error(`Missing README channel target: ${id}`);
        readme = readme.replace(pattern, (_match, open, close) => open + escapeHtml(english[id]) + close);
    }
    for (const { file, catalog } of updates) fs.writeFileSync(file, `${JSON.stringify(catalog, null, 4)}\n`);
    fs.writeFileSync(readmePath, readme);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    if (!process.argv[2] || !process.argv[3]) throw new Error('Usage: package_channel_messages.mjs <plugin-root> <branch>');
    applyChannelMessages(path.resolve(process.argv[2]), process.argv[3]);
}
