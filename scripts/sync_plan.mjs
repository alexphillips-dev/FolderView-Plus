import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export function synchronizationPlan(root = process.cwd(), { mainRef = 'origin/main', devRef = 'origin/dev' } = {}) {
    const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
    if (git('status', '--porcelain')) throw new Error('Synchronization plan requires a clean committed tree');
    const mainCommit = git('rev-parse', mainRef);
    const devBaseCommit = git('rev-parse', devRef);
    git('merge-base', '--is-ancestor', mainCommit, 'HEAD');
    git('merge-base', '--is-ancestor', devBaseCommit, 'HEAD');
    const unchanged = git('rev-parse', 'HEAD^{tree}') === git('rev-parse', `${devBaseCommit}^{tree}`);
    return { schema: 1, mainCommit, devBaseCommit,
        mergedCommit: git('rev-parse', 'HEAD'), mergedTree: git('rev-parse', 'HEAD^{tree}'), unchanged,
        validationRequired: !unchanged,
        changedFileCount: git('diff', '--name-only', devBaseCommit, 'HEAD').split(/\r?\n/).filter(Boolean).length };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const plan = synchronizationPlan(undefined, {
        mainRef: process.env.FVPLUS_BACKMERGE_MAIN_COMMIT,
        devRef: process.env.FVPLUS_BACKMERGE_DEV_COMMIT
    });
    const output = process.argv[2] || 'tmp/synchronization-plan.json';
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(plan, null, 2) + '\n');
    console.log(`Synchronization plan: ${plan.unchanged ? 'unchanged files; ancestry-only fast path' : 'changed files; fresh qualification required'}`);
}
