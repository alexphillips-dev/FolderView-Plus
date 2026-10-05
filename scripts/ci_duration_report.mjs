import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { githubApi } from './lib/github-release-validation.mjs';

export function durationReport(jobs, results) {
    const rows = jobs.map(job => {
        const elapsed = (Date.parse(job.completed_at) - Date.parse(job.started_at)) / 1000;
        return `| ${String(job.name).replaceAll('|', '\\|')} | ${job.conclusion || job.status} | ${Number.isFinite(elapsed) && elapsed >= 0 ? elapsed.toFixed(1) : 'Pending'} |`;
    });
    return ['## CI job duration', '', '| Job | Result | Elapsed seconds |', '| --- | --- | ---: |', ...rows,
        '', '### Lane results', '', ...Object.entries(results).map(([name, job]) => `- ${name}: ${job.result}`), ''].join('\n');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    let jobs = [];
    let available = true;
    try {
        jobs = githubApi(`repos/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}/jobs?filter=latest&per_page=100`).jobs;
    } catch { available = false; }
    const report = durationReport(jobs, JSON.parse(process.env.RESULTS || '{}'))
        + (available ? '' : '\nTiming API unavailable; consult job logs for elapsed times.\n');
    fs.mkdirSync('tmp', { recursive: true });
    fs.writeFileSync('tmp/ci-duration-report.md', report);
    if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, report);
}
