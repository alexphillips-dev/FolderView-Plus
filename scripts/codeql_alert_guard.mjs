#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const actionableAlertsForCommit = (alerts, commitSha, toolName = 'CodeQL') => (Array.isArray(alerts) ? alerts : [])
    .filter((alert) => String(alert?.state || '') === 'open')
    .filter((alert) => !toolName || String(alert?.tool?.name || '') === toolName)
    .filter((alert) => !commitSha || String(alert?.most_recent_instance?.commit_sha || '') === commitSha);

export const analysisAvailableForCommit = (analyses, commitSha, ref = '') => (Array.isArray(analyses) ? analyses : [])
    .some((analysis) => (
        String(analysis?.commit_sha || '') === commitSha
        && (!ref || String(analysis?.ref || '') === ref)
        && !String(analysis?.error || '')
    ));

const parseArgs = (argv) => {
    const options = { alertsFile: '', commitSha: '', ref: '', attempts: 12, intervalMs: 10000, stableReads: 2 };
    for (let index = 0; index < argv.length; index += 1) {
        const value = argv[index];
        if (value === '--alerts-file') options.alertsFile = String(argv[++index] || '');
        else if (value === '--commit-sha') options.commitSha = String(argv[++index] || '');
        else if (value === '--ref') options.ref = String(argv[++index] || '');
        else if (value === '--attempts') options.attempts = Math.max(1, Number(argv[++index]) || 1);
        else if (value === '--interval-ms') options.intervalMs = Math.max(0, Number(argv[++index]) || 0);
        else if (value === '--stable-reads') options.stableReads = Math.max(1, Number(argv[++index]) || 1);
        else throw new Error(`Unknown argument: ${value}`);
    }
    return options;
};

const fetchOpenAlerts = async ({ repository, token, ref }) => {
    const alerts = [];
    for (let page = 1; page <= 10; page += 1) {
        const query = new URLSearchParams({ state: 'open', tool_name: 'CodeQL', per_page: '100', page: String(page) });
        if (ref) query.set('ref', ref);
        const endpoint = `https://api.github.com/repos/${repository}/code-scanning/alerts?${query}`;
        const response = await fetch(endpoint, {
            headers: {
                Accept: 'application/vnd.github+json',
                Authorization: `Bearer ${token}`,
                'X-GitHub-Api-Version': '2022-11-28',
                'User-Agent': 'folderview-plus-codeql-alert-guard'
            }
        });
        if (!response.ok) {
            throw new Error(`GitHub code-scanning API returned HTTP ${response.status}.`);
        }
        const pageAlerts = await response.json();
        if (!Array.isArray(pageAlerts)) {
            throw new Error('GitHub code-scanning API returned an unexpected payload.');
        }
        alerts.push(...pageAlerts);
        if (pageAlerts.length < 100) break;
    }
    return alerts;
};

const fetchAnalyses = async ({ repository, token, ref }) => {
    const query = new URLSearchParams({ tool_name: 'CodeQL', per_page: '10' });
    if (ref) query.set('ref', ref);
    const endpoint = `https://api.github.com/repos/${repository}/code-scanning/analyses?${query}`;
    const response = await fetch(endpoint, {
        headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${token}`,
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'folderview-plus-codeql-alert-guard'
        }
    });
    if (!response.ok) {
        throw new Error(`GitHub code-scanning analyses API returned HTTP ${response.status}.`);
    }
    const analyses = await response.json();
    if (!Array.isArray(analyses)) {
        throw new Error('GitHub code-scanning analyses API returned an unexpected payload.');
    }
    return analyses;
};

const formatAlert = (alert) => {
    const location = alert?.most_recent_instance?.location || {};
    return `#${alert?.number || '?'} ${alert?.rule?.id || 'unknown-rule'} ${location.path || 'unknown-path'}:${location.start_line || '?'}`;
};

const delay = (durationMs) => new Promise((resolve) => setTimeout(resolve, durationMs));

const main = async () => {
    const options = parseArgs(process.argv.slice(2));
    const repository = String(process.env.GITHUB_REPOSITORY || '').trim();
    const token = String(process.env.GITHUB_TOKEN || '').trim();
    const commitSha = options.commitSha || String(process.env.GITHUB_SHA || '').trim();
    const ref = options.ref || String(process.env.GITHUB_REF || '').trim();
    if (!commitSha) throw new Error('A commit SHA is required.');

    if (options.alertsFile) {
        const alerts = JSON.parse(fs.readFileSync(options.alertsFile, 'utf8'));
        const actionable = actionableAlertsForCommit(alerts, commitSha);
        if (actionable.length > 0) {
            actionable.forEach((alert) => console.error(`Open CodeQL alert: ${formatAlert(alert)}`));
            process.exitCode = 1;
        } else {
            console.log(`CodeQL alert guard passed for ${commitSha}: no open alerts.`);
        }
        return;
    }

    if (!repository || !token) {
        throw new Error('GITHUB_REPOSITORY and GITHUB_TOKEN are required.');
    }
    let stableZeroReads = 0;
    for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
        const analyses = await fetchAnalyses({ repository, token, ref });
        if (!analysisAvailableForCommit(analyses, commitSha, ref)) {
            if (attempt === options.attempts) {
                console.error(`CodeQL analysis for ${commitSha} on ${ref || 'the requested ref'} was not visible before the guard timed out.`);
                process.exitCode = 1;
                return;
            }
            await delay(options.intervalMs);
            continue;
        }
        const alerts = await fetchOpenAlerts({ repository, token, ref });
        const actionable = actionableAlertsForCommit(alerts, commitSha);
        if (actionable.length > 0) {
            stableZeroReads = 0;
            if (attempt === options.attempts) {
                actionable.forEach((alert) => console.error(`Open CodeQL alert: ${formatAlert(alert)}`));
                process.exitCode = 1;
                return;
            }
            await delay(options.intervalMs);
            continue;
        }
        stableZeroReads += 1;
        if (stableZeroReads >= options.stableReads) {
            console.log(`CodeQL alert guard passed for ${commitSha}: no open alerts across ${stableZeroReads} stable reads.`);
            return;
        }
        await delay(options.intervalMs);
    }
};

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    main().catch((error) => {
        console.error(`CodeQL alert guard failed: ${error.message}`);
        process.exitCode = 2;
    });
}
