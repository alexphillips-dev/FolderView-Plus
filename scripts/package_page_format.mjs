import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Unraid PageBuilder splits page headers from content on the literal LF delimiter.
// Normalize the staged copy before hashing; never rewrite the owner's worktree.
export function assertPageFormat(text, label = 'page') {
    if (text.includes('\r') || !text.includes('\n---\n') || !text.split('\n---\n').slice(1).join('\n---\n').trim()) {
        throw new Error(`Invalid packaged Unraid page format: ${label}. Expected LF line endings and a nonempty body after the LF --- delimiter.`);
    }
}

export function normalizePackagePageFiles(pluginRoot) {
    let count = 0;
    const visit = directory => {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            const file = path.join(directory, entry.name);
            if (entry.isDirectory()) visit(file);
            else if (entry.isFile() && entry.name.endsWith('.page')) {
                const original = fs.readFileSync(file, 'utf8');
                const normalized = original.replace(/\r\n?/g, '\n');
                assertPageFormat(normalized, path.relative(pluginRoot, file));
                if (original !== normalized) fs.writeFileSync(file, normalized);
                count++;
            }
        }
    };
    visit(pluginRoot);
    if (count === 0) throw new Error('No Unraid pages found in the staged plugin.');
    return count;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    if (process.argv[2] === '--normalize' && process.argv[3]) {
        console.log(`Packaged Unraid page format normalized: ${normalizePackagePageFiles(path.resolve(process.argv[3]))} pages.`);
    } else if (process.argv[2] === '--check-stdin' && process.argv[3]) {
        assertPageFormat(fs.readFileSync(0, 'utf8'), process.argv[3]);
    } else {
        throw new Error('Usage: package_page_format.mjs --normalize <plugin-root> | --check-stdin <archive-member>');
    }
}
