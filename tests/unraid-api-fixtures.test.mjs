import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const fixtureRoot = path.join(root, 'tests', 'fixtures', 'unraid-api');
const expectedProfiles = [
    'current-full-api',
    'current-introspection-denied',
    'current-limited-shape',
    'current-partial-data',
    'current-permission-denied',
    'current-rate-limited',
    'current-schema-drift',
    'current-service-unavailable',
    'current-targeted-read-missing',
    'future-native-host',
    'legacy-no-api'
];

const readProfile = (name) => JSON.parse(fs.readFileSync(path.join(fixtureRoot, `${name}.json`), 'utf8'));

test('isolated Unraid API profile inventory covers compatibility and failure boundaries', () => {
    const actual = fs.readdirSync(fixtureRoot)
        .filter((file) => file.endsWith('.json'))
        .map((file) => file.replace(/\.json$/, ''))
        .sort();
    assert.deepEqual(actual, [...expectedProfiles].sort());
    for (const name of actual) {
        const profile = readProfile(name);
        assert.equal(profile.profile, name);
        assert.ok(Number.isInteger(profile.httpStatus));
        assert.ok(profile.httpStatus >= 100 && profile.httpStatus <= 599);
        assert.doesNotMatch(JSON.stringify(profile), /github_pat_|authorization|cookie|csrf_token/i);
    }
});

test('full profile exposes list, targeted read, lifecycle capability, and optional field shapes', () => {
    const profile = readProfile('current-full-api');
    const queryFields = profile.capabilities.dockerType.fields.map(({ name }) => name);
    const mutationFields = profile.capabilities.dockerMutationsType.fields.map(({ name }) => name);
    const containerFields = profile.capabilities.dockerContainerType.fields.map(({ name }) => name);
    assert.ok(queryFields.includes('containers'));
    assert.ok(queryFields.includes('container'));
    assert.deepEqual(mutationFields, ['start', 'stop', 'restart', 'pause', 'unpause']);
    assert.ok(containerFields.includes('isUpdateAvailable'));
    assert.ok(containerFields.includes('webUiUrl'));
    assert.equal(profile.containers.length, 1);
    assert.equal(profile.container.names[0], profile.containers[0].names[0]);
});

test('profiles encode permanent, transient, partial, schema-drift, and native-host outcomes', () => {
    assert.equal(readProfile('legacy-no-api').httpStatus, 404);
    assert.equal(readProfile('current-permission-denied').httpStatus, 403);
    assert.equal(readProfile('current-rate-limited').httpStatus, 429);
    assert.equal(readProfile('current-service-unavailable').httpStatus, 503);
    assert.ok(Array.isArray(readProfile('current-partial-data').listErrors));
    assert.ok(readProfile('current-schema-drift').capabilities);
    assert.equal(
        readProfile('current-targeted-read-missing').capabilities.dockerType.fields
            .some(({ name }) => name === 'container'),
        false
    );
    assert.equal(readProfile('future-native-host').organizationPolicy, 'detect-only');
});

test('fixture browser server routes GraphQL requests by isolated profile without external hosts', () => {
    const server = fs.readFileSync(path.join(root, 'scripts', 'lib', 'fixture-browser-server.mjs'), 'utf8');
    assert.match(server, /requestUrl\.pathname === '\/graphql'/);
    assert.match(server, /tests', 'fixtures', 'unraid-api'/);
    assert.match(server, /searchParams\.get\('profile'\)/);
    assert.doesNotMatch(server, /https?:\/\/(?!127\.0\.0\.1)/);
});
