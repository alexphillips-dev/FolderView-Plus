import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const fixturesDir = path.join(repoRoot, 'tests/fixtures/legacy-overrides');
const fixtureNames = fs.readdirSync(fixturesDir);

const selectLegacyOverrides = (type, extension) => {
    const regex = new RegExp(`\\..*${type}.*\\.${extension}$`);
    const disabled = /\.disabled$/;
    return fixtureNames
        .filter((name) => regex.test(name))
        .filter((name) => !disabled.test(name))
        .sort();
};

test('legacy fixture smoke: docker/vm/dashboard CSS naming remains compatible', () => {
    assert.deepEqual(selectLegacyOverrides('docker', 'css'), ['hernando.docker.css']);
    assert.deepEqual(selectLegacyOverrides('vm', 'css'), ['hernando.vm.css']);
    assert.deepEqual(selectLegacyOverrides('dashboard', 'css'), ['hernando.dashboard.css']);
});

test('legacy fixture smoke: docker/dashboard JS naming remains compatible', () => {
    assert.deepEqual(selectLegacyOverrides('docker', 'js'), ['hernando.docker.js']);
    assert.deepEqual(selectLegacyOverrides('dashboard', 'js'), ['hernando.dashboard.js']);
});

test('legacy fixture smoke: disabled files remain excluded from load list', () => {
    assert.ok(fixtureNames.includes('hernando.docker.css.disabled'));
    const dockerCssLoaded = selectLegacyOverrides('docker', 'css');
    assert.equal(dockerCssLoaded.includes('hernando.docker.css.disabled'), false);
});
