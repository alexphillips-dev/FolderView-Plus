import assert from 'node:assert/strict';
import test from 'node:test';

import {
    buildCommunityApplicationsReport,
    evaluateCommunityApplications,
    findCatalogEntry,
    parsePluginMetadata
} from '../scripts/community_applications_guard.mjs';

const metadata = `<?xml version="1.0"?>
<Containers>
<Plugin>True</Plugin>
<PluginURL>https://raw.githubusercontent.com/example/plugin/main/plugin.plg</PluginURL>
<PluginAuthor>example</PluginAuthor>
<Beta>False</Beta>
<Category>Tools:System</Category>
<Name>FolderView Plus</Name>
<Description>Organizes Docker, VM, and Dashboard views.</Description>
<MinVer>7.0.0</MinVer>
<ExtraSearchTerms>folders docker vm</ExtraSearchTerms>
<Support>https://forums.example.test/support</Support>
<Icon>https://raw.githubusercontent.com/example/plugin/main/icon.png</Icon>
<Project>https://github.com/example/plugin</Project>
</Containers>`;

const feedEntry = {
    Name: 'FolderView Plus',
    PluginURL: 'https://raw.githubusercontent.com/example/plugin/main/plugin.plg',
    Support: 'https://forums.example.test/support',
    Project: 'https://github.com/example/plugin',
    Icon: 'https://raw.githubusercontent.com/example/plugin/main/icon.png',
    MinVer: '7.0.0',
    Overview: 'Organizes Docker, VM, and Dashboard views.',
    pluginVersion: '2026.08.21.01'
};

const evaluate = (overrides = {}) => evaluateCommunityApplications({
    metadataSource: metadata,
    manifestSource: '<!ENTITY version "2026.08.21.01">',
    catalogTemplateSource: metadata,
    feedPayload: { apps: [feedEntry] },
    portalHelpSource: 'PluginURL Support Project Validate Scan',
    starterPluginSource: '<Plugin><PluginURL>x</PluginURL><Support>x</Support><Project>x</Project><Overview>x</Overview><Category>x</Category></Plugin>',
    expectedBranch: 'main',
    ...overrides
});

test('Community Applications guard validates metadata, catalog template, public feed, and portal contracts', () => {
    const result = evaluate();
    assert.equal(result.status, 'matched');
    assert.equal(result.reason, 'canonical-published-listing-matches');
    assert.equal(parsePluginMetadata(metadata).MinVer, '7.0.0');
    assert.equal(findCatalogEntry({ nested: [feedEntry] }, 'FolderView Plus'), feedEntry);
    assert.match(buildCommunityApplicationsReport(result), /Status: `matched`/);
});

test('Community Applications guard reports stale published versions without exposing feed internals', () => {
    const result = evaluate({ feedPayload: { apps: [{ ...feedEntry, pluginVersion: '2026.08.20.01' }] } });
    assert.equal(result.status, 'review');
    assert.ok(result.reviewSignals.some((signal) => signal.reason === 'published-version-drift'));
});

test('Community Applications guard fails closed when official portal requirements are unavailable', () => {
    const result = evaluate({ portalHelpSource: 'temporarily unavailable' });
    assert.equal(result.status, 'unknown');
    assert.ok(result.unknownSignals.some((signal) => signal.reason === 'portal-help-contract-unavailable'));
});
