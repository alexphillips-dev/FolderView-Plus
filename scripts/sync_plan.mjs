import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export function synchronizationPlan(root = process.cwd()) {
    const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
    if (git('status', '--porcelain')) throw new Error('Synchronization plan requires a clean committed tree');
    git('merge-base', '--is-ancestor', 'origin/main', 'HEAD');
    const unchanged = git('rev-parse', 'HEAD^{tree}') === git('rev-parse', 'origin/dev^{tree}');
    return { schema: 1, mainCommit: git('rev-parse', 'origin/main'), devBaseCommit: git('rev-parse', 'origin/dev'),
        mergedCommit: git('rev-parse', 'HEAD'), mergedTree: git('rev-parse', 'HEAD^{tree}'), unchanged,
        validationRequired: !unchanged,
        changedFileCount: git('diff', '--name-only', 'origin/dev', 'HEAD').split(/\r?\n/).filter(Boolean).length };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const plan = synchronizationPlan();
    const output = process.argv[2] || 'tmp/synchronization-plan.json';
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(plan, null, 2) + '\n');
    console.log(`Synchronization plan: ${plan.unchanged ? 'unchanged files; ancestry-only fast path' : 'changed files; fresh qualification required'}`);
}
