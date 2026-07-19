import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(process.cwd());
const plugin = path.join(root, 'src', 'folderview.plus', 'usr', 'local', 'emhttp', 'plugins', 'folderview.plus');
const baseline = JSON.parse(fs.readFileSync(path.join(root, 'scripts', 'ui_debt_baseline.json'), 'utf8'));

const collect = (directory, extensions, results = []) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            if (entry.name !== 'include') collect(absolute, extensions, results);
        } else if (extensions.includes(path.extname(entry.name).toLowerCase())) {
            results.push(absolute);
        }
    }
    return results;
};

const count = (files, expression) => files.reduce((total, file) => (
    total + (fs.readFileSync(file, 'utf8').match(expression) || []).length
), 0);

const styleFiles = collect(path.join(plugin, 'styles'), ['.css', '.php']);
const scriptFiles = collect(path.join(plugin, 'scripts'), ['.js']);
const pageFiles = collect(plugin, ['.page']);
const actual = {
    importantDeclarations: count(styleFiles, /!important\b/g),
    sweetAlertReferences: count(scriptFiles, /\b(?:Swal|swal)\s*(?:\.|\()/g),
    inlineEventHandlers: count(pageFiles, /\son(?:click|change|input|submit|keydown|keyup|blur|focus)=/gi)
};

const failures = [];
for (const [metric, limit] of Object.entries(baseline)) {
    if (actual[metric] > limit) failures.push(`${metric}: ${actual[metric]} exceeds baseline ${limit}`);
}

const primitiveCssPath = path.join(plugin, 'styles', 'ui.primitives.css');
const primitiveCss = fs.readFileSync(primitiveCssPath, 'utf8');
if (/!important\b/.test(primitiveCss)) failures.push('ui.primitives.css must not contain !important declarations');

const expectedPages = ['FolderViewPlus.page', 'Folder.page', 'folderview.plus.Docker.page', 'folderview.plus.VMs.page', 'folderview.plus.Dashboard.page'];
for (const pageName of expectedPages) {
    const source = fs.readFileSync(path.join(plugin, pageName), 'utf8');
    if (!source.includes('styles/ui.primitives.css')) failures.push(`${pageName} does not load ui.primitives.css`);
    if (!source.includes('scripts/folderviewplus.ui.js')) failures.push(`${pageName} does not load folderviewplus.ui.js`);
}

if (failures.length) {
    console.error(`UI debt guard failed:\n- ${failures.join('\n- ')}`);
    process.exit(1);
}
console.log(`UI debt guard passed: ${JSON.stringify(actual)}`);
