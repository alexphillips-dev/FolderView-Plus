#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const readText = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const readJson = (file) => JSON.parse(readText(file));

export const gitBlobSha = (content) => {
    const body = Buffer.isBuffer(content) ? content : Buffer.from(String(content), 'utf8');
    return crypto.createHash('sha1')
        .update(Buffer.from(`blob ${body.length}\0`, 'utf8'))
        .update(body)
        .digest('hex');
};

const releaseParts = (value) => {
    const match = String(value || '').trim().match(/^(\d+)\.(\d+)\.(\d+)(?:-(alpha|beta|rc)\.(\d+))?$/i);
    if (!match) return null;
    return {
        major: Number(match[1]),
        minor: Number(match[2]),
        patch: Number(match[3]),
        channel: String(match[4] || 'stable').toLowerCase(),
        iteration: Number(match[5] || 0)
    };
};

const compareReleases = (left, right) => {
    const a = releaseParts(left);
    const b = releaseParts(right);
    if (!a || !b) return String(left).localeCompare(String(right), 'en', { numeric: true });
    for (const key of ['major', 'minor', 'patch']) {
        if (a[key] !== b[key]) return a[key] - b[key];
    }
    const weight = { alpha: 0, beta: 1, rc: 2, stable: 3 };
    if (weight[a.channel] !== weight[b.channel]) return weight[a.channel] - weight[b.channel];
    return a.iteration - b.iteration;
};

const parsePhpVersion = (source) => {
    const lines = String(source || '').split('\n').filter((line) => /^\s*[-*]\s*php:\s*version\s+/i.test(line));
    if (lines.length === 0) return 'unknown';
    const versions = Array.from(lines.at(-1).matchAll(/\d+\.\d+\.\d+/g), (match) => match[0]);
    return versions.at(-1) || 'unknown';
};

export const scanReleaseNotes = (releaseNotesDir) => {
    const releases = [];
    for (const entry of fs.readdirSync(releaseNotesDir, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
        const file = path.join(releaseNotesDir, entry.name);
        const source = readText(file);
        const match = source.match(/^#\s+Version\s+(\d+\.\d+\.\d+(?:-(?:alpha|beta|rc)\.\d+)?)/im);
        if (!match || !releaseParts(match[1])) continue;
        releases.push({
            version: match[1],
            file: entry.name,
            blobSha: gitBlobSha(Buffer.from(source, 'utf8')),
            phpVersion: parsePhpVersion(source)
        });
    }
    const stable = releases
        .filter((entry) => releaseParts(entry.version)?.channel === 'stable')
        .sort((left, right) => compareReleases(right.version, left.version))[0] || null;
    const prerelease = releases
        .filter((entry) => releaseParts(entry.version)?.channel !== 'stable')
        .sort((left, right) => compareReleases(right.version, left.version))[0] || null;
    return { stable, prerelease, count: releases.length };
};

const compareFileBaseline = ({ root, expectedFiles, category, reviewSignals, unknownSignals }) => {
    const actual = {};
    for (const [relativePath, expectedSha] of Object.entries(expectedFiles || {})) {
        const file = path.join(root, ...relativePath.split('/'));
        if (!fs.existsSync(file)) {
            unknownSignals.push({ category, reason: 'upstream-file-missing', path: relativePath, expected: expectedSha, actual: 'missing' });
            continue;
        }
        const actualSha = gitBlobSha(fs.readFileSync(file));
        actual[relativePath] = actualSha;
        if (actualSha !== expectedSha) {
            reviewSignals.push({ category, reason: 'upstream-file-changed', path: relativePath, expected: expectedSha, actual: actualSha });
        }
    }
    return actual;
};

const compareRelease = ({ label, actual, expected, reviewSignals, unknownSignals }) => {
    if (!actual) {
        unknownSignals.push({ category: 'unraid-os', reason: `${label}-release-not-found`, expected: expected?.version || 'configured', actual: 'missing' });
        return;
    }
    if (actual.version !== expected?.version) {
        reviewSignals.push({ category: 'unraid-os', reason: `new-${label}-release`, expected: expected?.version || 'none', actual: actual.version });
        return;
    }
    if (expected.releaseNoteBlobSha && actual.blobSha !== expected.releaseNoteBlobSha) {
        reviewSignals.push({ category: 'unraid-os', reason: `${label}-release-notes-changed`, path: actual.file, expected: expected.releaseNoteBlobSha, actual: actual.blobSha });
    }
    if (expected.phpVersion && actual.phpVersion !== expected.phpVersion) {
        reviewSignals.push({ category: 'php-runtime', reason: `${label}-php-version-changed`, expected: expected.phpVersion, actual: actual.phpVersion });
    }
};

const markdownTable = (signals) => {
    if (signals.length === 0) return 'None.';
    const lines = ['| Category | Reason | Path | Expected | Actual |', '| --- | --- | --- | --- | --- |'];
    signals.forEach((signal) => {
        const cell = (value) => String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');
        lines.push(`| ${cell(signal.category)} | ${cell(signal.reason)} | ${cell(signal.path || '—')} | \`${cell(signal.expected || '—')}\` | \`${cell(signal.actual || '—')}\` |`);
    });
    return lines.join('\n');
};

export const evaluateCompatibility = ({ baseline, releaseNotesDir, webguiDir, caStarterDir, dockerResult = {}, caResult = {} }) => {
    const reviewSignals = [];
    const unknownSignals = [];
    const releases = scanReleaseNotes(releaseNotesDir);
    compareRelease({ label: 'stable', actual: releases.stable, expected: baseline.unraidOs?.latestReviewedStable, reviewSignals, unknownSignals });
    compareRelease({ label: 'prerelease', actual: releases.prerelease, expected: baseline.unraidOs?.latestReviewedPrerelease, reviewSignals, unknownSignals });

    const webguiFiles = compareFileBaseline({
        root: webguiDir,
        expectedFiles: baseline.webgui?.files,
        category: 'unraid-webgui',
        reviewSignals,
        unknownSignals
    });
    const caStarterFiles = compareFileBaseline({
        root: caStarterDir,
        expectedFiles: baseline.communityApplications?.files,
        category: 'community-applications',
        reviewSignals,
        unknownSignals
    });

    if (!['dormant', 'matched'].includes(String(dockerResult.status || ''))) {
        const target = String(dockerResult.status || '') === 'unknown' ? unknownSignals : reviewSignals;
        target.push({
            category: 'unraid-api',
            reason: String(dockerResult.reason || 'docker-monitor-unavailable'),
            expected: 'reviewed Docker/API baseline',
            actual: String(dockerResult.latestApiRelease || dockerResult.status || 'unknown')
        });
    }
    if (String(caResult.status || '') !== 'matched') {
        const target = String(caResult.status || '') === 'unknown' ? unknownSignals : reviewSignals;
        target.push({
            category: 'community-applications',
            reason: String(caResult.reason || 'catalog-validation-unavailable'),
            expected: 'canonical published listing',
            actual: String(caResult.status || 'unknown')
        });
    }

    const status = unknownSignals.length > 0 ? 'unknown' : (reviewSignals.length > 0 ? 'review' : 'matched');
    const reason = unknownSignals[0]?.reason || reviewSignals[0]?.reason || 'all-reviewed-baselines-match';
    return {
        status,
        reason,
        reviewSignals,
        unknownSignals,
        releases,
        webguiFiles,
        caStarterFiles,
        dockerResult,
        caResult
    };
};

export const buildCompatibilityReport = (result, metadata = {}) => [
    '# Unraid compatibility monitor',
    '',
    `- Status: \`${result.status}\``,
    `- Reason: \`${result.reason}\``,
    `- Latest stable release: \`${result.releases.stable?.version || 'unknown'}\` (PHP \`${result.releases.stable?.phpVersion || 'unknown'}\`)`,
    `- Latest prerelease: \`${result.releases.prerelease?.version || 'unknown'}\` (PHP \`${result.releases.prerelease?.phpVersion || 'unknown'}\`)`,
    `- Unraid API release: \`${result.dockerResult.latestApiRelease || 'unknown'}\``,
    `- Native Docker gate: \`${result.dockerResult.sourceGate || 'unknown'}\``,
    `- Community Applications: \`${result.caResult.status || 'unknown'}\``,
    metadata.webguiCommit ? `- Upstream webGUI commit: \`${metadata.webguiCommit}\`` : null,
    metadata.caStarterCommit ? `- CA starter commit: \`${metadata.caStarterCommit}\`` : null,
    '',
    '## Review signals',
    '',
    markdownTable(result.reviewSignals),
    '',
    '## Unknown or unavailable signals',
    '',
    markdownTable(result.unknownSignals),
    '',
    '## Required response',
    '',
    result.status === 'matched'
        ? 'All official upstream inputs match the human-reviewed baselines. No compatibility action is required.'
        : 'Review the official upstream difference, update or add isolated fixtures, run the PHP and browser compatibility lanes, and update a baseline only after the change is understood. Do not add live-Unraid credentials to CI.',
    ''
].filter((line) => line !== null).join('\n') + '\n';

const parseArgs = (argv) => {
    const options = { json: false };
    const valueOptions = new Set([
        '--baseline', '--release-notes-dir', '--webgui-dir', '--webgui-commit', '--ca-starter-dir',
        '--ca-starter-commit', '--docker-result', '--ca-result', '--report', '--github-output'
    ]);
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === '--json') options.json = true;
        else if (valueOptions.has(arg)) options[arg.slice(2).replaceAll('-', '_')] = String(argv[++index] || '');
        else throw new Error(`Unknown argument: ${arg}`);
    }
    for (const required of ['baseline', 'release_notes_dir', 'webgui_dir', 'ca_starter_dir', 'docker_result', 'ca_result']) {
        if (!options[required]) throw new Error(`--${required.replaceAll('_', '-')} is required.`);
    }
    return options;
};

const main = () => {
    const options = parseArgs(process.argv.slice(2));
    const result = evaluateCompatibility({
        baseline: readJson(options.baseline),
        releaseNotesDir: options.release_notes_dir,
        webguiDir: options.webgui_dir,
        caStarterDir: options.ca_starter_dir,
        dockerResult: readJson(options.docker_result),
        caResult: readJson(options.ca_result)
    });
    const report = buildCompatibilityReport(result, {
        webguiCommit: options.webgui_commit,
        caStarterCommit: options.ca_starter_commit
    });
    if (options.report) fs.writeFileSync(options.report, report, 'utf8');
    if (options.github_output) {
        fs.appendFileSync(options.github_output, [
            `status=${result.status}`,
            `reason=${result.reason}`,
            `review_count=${result.reviewSignals.length}`,
            `unknown_count=${result.unknownSignals.length}`,
            `latest_stable=${result.releases.stable?.version || 'unknown'}`,
            `latest_prerelease=${result.releases.prerelease?.version || 'unknown'}`,
            `webgui_commit=${options.webgui_commit || 'unknown'}`,
            `ca_starter_commit=${options.ca_starter_commit || 'unknown'}`
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
        console.error(`Unraid compatibility monitor failed: ${error.message}`);
        process.exitCode = 21;
    }
}
