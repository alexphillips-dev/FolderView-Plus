#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const SCHEDULED_WORKFLOW_TARGETS = Object.freeze([
    Object.freeze({
        workflowFile: 'unraid-docker-upstream-monitor.yml',
        label: 'Unraid Docker Upstream Monitor',
        maximumSuccessAgeHours: 204
    }),
    Object.freeze({
        workflowFile: 'scheduled-validation.yml',
        label: 'Scheduled Cross-Browser Validation',
        maximumSuccessAgeHours: 204
    }),
    Object.freeze({
        workflowFile: 'clone-traffic-badge.yml',
        label: 'Rolling Clone Traffic Badge',
        maximumSuccessAgeHours: 72
    })
]);

const parseTimestamp = (value) => {
    const parsed = Date.parse(String(value || ''));
    return Number.isFinite(parsed) ? parsed : 0;
};

const newestFirst = (left, right) => parseTimestamp(right?.created_at) - parseTimestamp(left?.created_at);

export const evaluateWorkflowRuns = ({ target, runs, nowMs = Date.now() }) => {
    const candidates = (Array.isArray(runs) ? runs : [])
        .filter((run) => ['schedule', 'workflow_dispatch'].includes(String(run?.event || '')))
        .sort(newestFirst);
    const latestAttempt = candidates[0] || null;
    const latestSuccess = candidates.find((run) => (
        String(run?.status || '') === 'completed'
        && String(run?.conclusion || '') === 'success'
    )) || null;
    const maximumAgeMs = Math.max(1, Number(target?.maximumSuccessAgeHours) || 0) * 60 * 60 * 1000;
    const successTimestamp = parseTimestamp(latestSuccess?.updated_at || latestSuccess?.created_at);
    const successAgeMs = successTimestamp > 0 ? Math.max(0, nowMs - successTimestamp) : Number.POSITIVE_INFINITY;
    const healthy = Boolean(latestSuccess) && successAgeMs <= maximumAgeMs;
    let reason = 'healthy';
    if (!latestSuccess) {
        reason = 'no-successful-run';
    } else if (successAgeMs > maximumAgeMs) {
        reason = 'successful-run-stale';
    }
    return {
        workflowFile: String(target?.workflowFile || ''),
        label: String(target?.label || target?.workflowFile || 'Scheduled workflow'),
        maximumSuccessAgeHours: Math.round(maximumAgeMs / (60 * 60 * 1000)),
        healthy,
        reason,
        latestAttempt: latestAttempt ? {
            event: String(latestAttempt.event || ''),
            status: String(latestAttempt.status || ''),
            conclusion: String(latestAttempt.conclusion || ''),
            createdAt: String(latestAttempt.created_at || ''),
            url: String(latestAttempt.html_url || '')
        } : null,
        latestSuccess: latestSuccess ? {
            event: String(latestSuccess.event || ''),
            createdAt: String(latestSuccess.created_at || ''),
            updatedAt: String(latestSuccess.updated_at || ''),
            ageHours: Math.round((successAgeMs / (60 * 60 * 1000)) * 10) / 10,
            url: String(latestSuccess.html_url || '')
        } : null
    };
};

const parseArgs = (argv) => {
    const options = {
        runsDir: '',
        githubOutput: '',
        report: '',
        nowMs: Date.now()
    };
    for (let index = 0; index < argv.length; index += 1) {
        const value = argv[index];
        if (value === '--runs-dir') options.runsDir = String(argv[++index] || '');
        else if (value === '--github-output') options.githubOutput = String(argv[++index] || '');
        else if (value === '--report') options.report = String(argv[++index] || '');
        else if (value === '--now') options.nowMs = parseTimestamp(argv[++index]) || Number.NaN;
        else throw new Error(`Unknown argument: ${value}`);
    }
    if (!Number.isFinite(options.nowMs)) {
        throw new Error('--now must be an ISO-8601 timestamp.');
    }
    return options;
};

const fetchWorkflowRuns = async ({ repository, workflowFile, token }) => {
    const endpoint = `https://api.github.com/repos/${repository}/actions/workflows/${encodeURIComponent(workflowFile)}/runs?per_page=100`;
    const response = await fetch(endpoint, {
        headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${token}`,
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'folderview-plus-scheduled-workflow-health'
        }
    });
    if (!response.ok) {
        throw new Error(`GitHub Actions API returned HTTP ${response.status} for ${workflowFile}.`);
    }
    const payload = await response.json();
    return Array.isArray(payload?.workflow_runs) ? payload.workflow_runs : [];
};

const readFixtureRuns = (runsDir, workflowFile) => {
    const payload = JSON.parse(fs.readFileSync(path.join(runsDir, `${workflowFile}.json`), 'utf8'));
    return Array.isArray(payload) ? payload : (Array.isArray(payload?.workflow_runs) ? payload.workflow_runs : []);
};

const markdownLink = (label, url) => url ? `[${label}](${url})` : label;

const buildReport = (results, generatedAt) => {
    const unhealthy = results.filter((result) => !result.healthy);
    const lines = [
        '# Scheduled workflow health',
        '',
        `Generated: ${generatedAt}`,
        '',
        '| Workflow | Status | Latest successful run | Latest attempt |',
        '| --- | --- | --- | --- |'
    ];
    results.forEach((result) => {
        const success = result.latestSuccess
            ? `${result.latestSuccess.ageHours} hours ago (${result.latestSuccess.event})`
            : 'none';
        const attempt = result.latestAttempt
            ? markdownLink(`${result.latestAttempt.conclusion || result.latestAttempt.status || 'unknown'} (${result.latestAttempt.event})`, result.latestAttempt.url)
            : 'none';
        lines.push(`| ${result.label} | ${result.healthy ? 'healthy' : result.reason} | ${success} | ${attempt} |`);
    });
    lines.push('', unhealthy.length === 0
        ? 'All monitored workflows have a successful scheduled or manually dispatched run inside their configured freshness interval.'
        : `${unhealthy.length} monitored workflow(s) do not have a successful run inside the configured freshness interval.`);
    return `${lines.join('\n')}\n`;
};

const main = async () => {
    const options = parseArgs(process.argv.slice(2));
    const repository = String(process.env.GITHUB_REPOSITORY || '').trim();
    const token = String(process.env.GITHUB_TOKEN || '').trim();
    if (!options.runsDir && (!repository || !token)) {
        throw new Error('GITHUB_REPOSITORY and GITHUB_TOKEN are required when --runs-dir is not supplied.');
    }
    const results = [];
    for (const target of SCHEDULED_WORKFLOW_TARGETS) {
        const runs = options.runsDir
            ? readFixtureRuns(options.runsDir, target.workflowFile)
            : await fetchWorkflowRuns({ repository, workflowFile: target.workflowFile, token });
        results.push(evaluateWorkflowRuns({ target, runs, nowMs: options.nowMs }));
    }
    const unhealthyCount = results.filter((result) => !result.healthy).length;
    const report = buildReport(results, new Date(options.nowMs).toISOString());
    if (options.report) {
        fs.mkdirSync(path.dirname(path.resolve(options.report)), { recursive: true });
        fs.writeFileSync(options.report, report, 'utf8');
    }
    if (options.githubOutput) {
        fs.appendFileSync(options.githubOutput, `status=${unhealthyCount === 0 ? 'healthy' : 'unhealthy'}\nunhealthy_count=${unhealthyCount}\n`, 'utf8');
    }
    process.stdout.write(JSON.stringify({ status: unhealthyCount === 0 ? 'healthy' : 'unhealthy', results }) + '\n');
    process.exitCode = unhealthyCount === 0 ? 0 : 1;
};

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    main().catch((error) => {
        console.error(`Scheduled workflow health failed: ${error.message}`);
        process.exitCode = 2;
    });
}
