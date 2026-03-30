import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const dashboardJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/dashboard.js');
const vmJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/vm.js');

test('dashboard docker folder action keeps restart distinct from resume', () => {
    assert.match(dashboardJs, /actionFolderDocker\(id,\s*"restart"\)/);
    assert.match(dashboardJs, /case "resume":\s*pass = ct\.state && ct\.pause;\s*break;\s*case "restart":\s*pass = true;\s*break;/s);
    assert.equal((dashboardJs.match(/case "resume":/g) || []).length, 1);
});

test('dashboard folder action errors do not trigger an immediate second reload', () => {
    const singleReloadBlocks = dashboardJs.match(/if\(errors\.length > 0\) \{\s*swal\(\{[\s\S]*?\}, loadlist\);\s*\} else \{\s*loadlist\(\);\s*\}\s*\$\('div\.spinner\.fixed'\)\.hide\('slow'\);/g) || [];
    assert.equal(singleReloadBlocks.length, 2);
    assert.doesNotMatch(dashboardJs, /}, loadlist\);\s*}\s*loadlist\(\);\s*\$\('div\.spinner\.fixed'\)\.hide\('slow'\);/s);
});

test('vm pin persistence and folder action error handling avoid stale reloads', () => {
    assert.match(vmJs, /applyVmPinnedFolderIds\(Array\.isArray\(response\?\.prefs\?\.pinnedFolderIds\) \? response\.prefs\.pinnedFolderIds : nextPinned\);\s*refreshVmFolderQuickActionStates\(\);/s);
    assert.doesNotMatch(vmJs, /applyVmPinnedFolderIds\(Array\.isArray\(response\?\.prefs\?\.pinnedFolderIds\) \? response\.prefs\.pinnedFolderIds : nextPinned\);\s*refreshVmFolderQuickActionStates\(\);\s*queueLoadlistRefresh\(/s);
    assert.match(vmJs, /const cacheBust = Date\.now\(\);\s*const safePrefsReq = createVmRuntimeRequest\(`\/plugins\/folderview\.plus\/server\/prefs\.php\?type=vm&_=\$\{cacheBust\}`/s);
    assert.match(vmJs, /if \(errors\.length > 0\) \{\s*swal\(\{[\s\S]*?\}, loadlist\);\s*\} else \{\s*loadlist\(\);\s*\}\s*\} finally \{/s);
    assert.doesNotMatch(vmJs, /}, loadlist\);\s*}\s*loadlist\(\);\s*} finally \{/s);
});
