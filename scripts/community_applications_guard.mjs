#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const readText = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const normalizeText = (value) => String(value || '').replace(/\s+/g, ' ').trim();
const extractTag = (source, tag) => {
    const match = String(source || '').match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i'));
    return match ? normalizeText(match[1]) : '';
};

export const parsePluginMetadata = (source) => {
    const fields = {};
    for (const tag of [
        'Plugin', 'PluginURL', 'PluginAuthor', 'Beta', 'Category', 'Name', 'CA', 'Description',
        'Date', 'MinVer', 'ExtraSearchTerms', 'Support', 'Icon', 'Project'
    ]) {
        fields[tag] = extractTag(source, tag);
    }
    return fields;
};

export const findCatalogEntry = (payload, expectedName) => {
    const target = String(expectedName || '').toLowerCase();
    const seen = new Set();
    let match = null;
    const visit = (value) => {
        if (match || !value || typeof value !== 'object' || seen.has(value)) return;
        seen.add(value);
        if (Array.isArray(value)) {
            value.forEach(visit);
            return;
        }
        if (String(value.Name || value.name || '').toLowerCase() === target && (value.PluginURL || value.pluginUrl)) {
            match = value;
            return;
        }
        Object.values(value).forEach(visit);
    };
    visit(payload);
    return match;
};

const manifestVersion = (source) => String(source || '').match(/<!ENTITY\s+version\s+"([^"]+)"/)?.[1] || '';
const isHttps = (value) => /^https:\/\//i.test(String(value || ''));
const rawGitHubBranch = (value) => {
    try {
        const url = new URL(String(value || ''));
        if (url.hostname !== 'raw.githubusercontent.com') return '';
        return url.pathname.split('/').filter(Boolean)[2] || '';
    } catch {
        return '';
    }
};
const pushMismatch = (signals, reason, expected, actual, pathValue = '') => signals.push({
    category: 'community-applications',
    reason,
    path: pathValue,
    expected: String(expected || ''),
    actual: String(actual || '')
});

export const evaluateCommunityApplications = ({
    metadataSource,
    manifestSource,
    catalogTemplateSource,
    feedPayload,
    portalHelpSource,
    starterPluginSource,
    expectedBranch
}) => {
    const reviewSignals = [];
    const unknownSignals = [];
    const metadata = parsePluginMetadata(metadataSource);
    const catalogTemplate = parsePluginMetadata(catalogTemplateSource);
    const requiredFields = ['PluginURL', 'Name', 'Description', 'Category', 'Support', 'Project', 'Icon', 'MinVer'];
    requiredFields.forEach((field) => {
        if (!metadata[field]) pushMismatch(reviewSignals, 'required-metadata-missing', field, 'missing', field);
    });
    for (const field of ['PluginURL', 'Support', 'Project', 'Icon']) {
        if (metadata[field] && !isHttps(metadata[field])) pushMismatch(reviewSignals, 'metadata-url-not-https', 'https URL', metadata[field], field);
    }
    if (String(metadata.Plugin).toLowerCase() !== 'true') {
        pushMismatch(reviewSignals, 'plugin-marker-invalid', 'True', metadata.Plugin || 'missing', 'Plugin');
    }
    if (String(metadata.Beta).toLowerCase() !== 'false') {
        pushMismatch(reviewSignals, 'stable-listing-marked-beta', 'False', metadata.Beta || 'missing', 'Beta');
    }
    if (expectedBranch && metadata.PluginURL && rawGitHubBranch(metadata.PluginURL) !== expectedBranch) {
        pushMismatch(reviewSignals, 'plugin-url-branch-mismatch', expectedBranch, metadata.PluginURL, 'PluginURL');
    }

    for (const field of ['PluginURL', 'Name', 'Description', 'Category', 'Support', 'Project', 'Icon', 'MinVer', 'ExtraSearchTerms']) {
        if (metadata[field] !== catalogTemplate[field]) {
            pushMismatch(reviewSignals, 'catalog-template-drift', metadata[field], catalogTemplate[field], field);
        }
    }

    const version = manifestVersion(manifestSource);
    if (!version) pushMismatch(unknownSignals, 'manifest-version-unavailable', 'version entity', 'missing', 'folderview.plus.plg');
    const entry = findCatalogEntry(feedPayload, metadata.Name || 'FolderView Plus');
    if (!entry) {
        pushMismatch(unknownSignals, 'catalog-entry-not-found', metadata.Name || 'FolderView Plus', 'missing', 'applicationFeed.json');
    } else {
        const feedFields = {
            PluginURL: entry.PluginURL,
            Name: entry.Name,
            Support: entry.Support,
            Project: entry.Project,
            Icon: entry.Icon,
            MinVer: entry.MinVer,
            Description: entry.Overview
        };
        for (const [field, actual] of Object.entries(feedFields)) {
            if (normalizeText(actual) !== normalizeText(metadata[field])) {
                pushMismatch(reviewSignals, 'published-feed-drift', metadata[field], actual, field);
            }
        }
        if (version && String(entry.pluginVersion || '') !== version) {
            pushMismatch(reviewSignals, 'published-version-drift', version, entry.pluginVersion || 'missing', 'pluginVersion');
        }
    }

    const helpRequirements = ['PluginURL', 'Support', 'Project', 'Validate', 'Scan'];
    helpRequirements.forEach((token) => {
        if (!String(portalHelpSource || '').includes(token)) {
            pushMismatch(unknownSignals, 'portal-help-contract-unavailable', token, 'missing', 'repository-xml');
        }
    });
    for (const token of ['PluginURL', 'Support', 'Project', 'Overview', 'Category']) {
        if (!String(starterPluginSource || '').includes(`<${token}>`)) {
            pushMismatch(unknownSignals, 'starter-plugin-contract-unavailable', token, 'missing', 'plugins/example-plugin.xml');
        }
    }

    const status = unknownSignals.length > 0 ? 'unknown' : (reviewSignals.length > 0 ? 'review' : 'matched');
    const reason = unknownSignals[0]?.reason || reviewSignals[0]?.reason || 'canonical-published-listing-matches';
    return { status, reason, version, metadata, reviewSignals, unknownSignals };
};

const signalTable = (signals) => {
    if (signals.length === 0) return 'None.';
    return [
        '| Reason | Field | Expected | Actual |',
        '| --- | --- | --- | --- |',
        ...signals.map((signal) => `| ${signal.reason} | ${signal.path || '—'} | \`${String(signal.expected).replaceAll('|', '\\|')}\` | \`${String(signal.actual).replaceAll('|', '\\|')}\` |`)
    ].join('\n');
};

export const buildCommunityApplicationsReport = (result) => [
    '# Community Applications validation',
    '',
    `- Status: \`${result.status}\``,
    `- Reason: \`${result.reason}\``,
    `- Published plugin version: \`${result.version || 'unknown'}\``,
    '',
    '## Review signals',
    '',
    signalTable(result.reviewSignals),
    '',
    '## Unknown or unavailable signals',
    '',
    signalTable(result.unknownSignals),
    ''
].join('\n');

const parseArgs = (argv) => {
    const options = { json: false };
    const values = new Set([
        '--metadata', '--manifest', '--catalog-template', '--feed', '--portal-help', '--starter-plugin',
        '--expected-branch', '--report', '--github-output'
    ]);
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === '--json') options.json = true;
        else if (values.has(arg)) options[arg.slice(2).replaceAll('-', '_')] = String(argv[++index] || '');
        else throw new Error(`Unknown argument: ${arg}`);
    }
    for (const required of ['metadata', 'manifest', 'catalog_template', 'feed', 'portal_help', 'starter_plugin']) {
        if (!options[required]) throw new Error(`--${required.replaceAll('_', '-')} is required.`);
    }
    return options;
};

const main = () => {
    const options = parseArgs(process.argv.slice(2));
    const result = evaluateCommunityApplications({
        metadataSource: readText(options.metadata),
        manifestSource: readText(options.manifest),
        catalogTemplateSource: readText(options.catalog_template),
        feedPayload: JSON.parse(readText(options.feed)),
        portalHelpSource: readText(options.portal_help),
        starterPluginSource: readText(options.starter_plugin),
        expectedBranch: options.expected_branch
    });
    const report = buildCommunityApplicationsReport(result);
    if (options.report) fs.writeFileSync(options.report, report, 'utf8');
    if (options.github_output) {
        fs.appendFileSync(options.github_output, [
            `status=${result.status}`,
            `reason=${result.reason}`,
            `version=${result.version || 'unknown'}`,
            `review_count=${result.reviewSignals.length}`,
            `unknown_count=${result.unknownSignals.length}`
        ].join('\n') + '\n');
    }
    if (options.json) process.stdout.write(`${JSON.stringify(result)}\n`);
    else process.stdout.write(report);
    process.exitCode = result.status === 'matched' ? 0 : (result.status === 'review' ? 20 : 21);
};

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    try {
        main();
    } catch (error) {
        console.error(`Community Applications validation failed: ${error.message}`);
        process.exitCode = 21;
    }
}
