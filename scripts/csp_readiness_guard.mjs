import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const repoRoot = path.resolve(import.meta.dirname, '..');
const sourceRoot = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus'
);
const reportPath = path.join(repoRoot, 'docs/security/csp-readiness.json');
const writeMode = process.argv.includes('--write');

const normalize = (value) => value.replaceAll('\\', '/');
const excluded = (absolutePath) => {
    const relative = normalize(path.relative(sourceRoot, absolutePath));
    return relative.startsWith('images/third-party-icons/')
        || relative.startsWith('langs/')
        || relative.startsWith('scripts/include/')
        || relative.endsWith('.min.js');
};
const files = [];
const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const absolute = path.join(directory, entry.name);
        if (excluded(absolute)) continue;
        if (entry.isDirectory()) {
            walk(absolute);
        } else if (/\.(?:js|page|php)$/i.test(entry.name)) {
            files.push(absolute);
        }
    }
};
walk(sourceRoot);
files.sort();

const patterns = {
    inlineEventAttributes: /\son(?:click|change|input|keydown|submit|error)\s*=\s*['"]/gi,
    inlineScriptBlocks: /<script\b(?![^>]*\bsrc\s*=)[^>]*>/gi,
    externalScriptTags: /<script\b[^>]*\bsrc\s*=/gi,
    inlineStyleBlocks: /<style\b[^>]*>/gi,
    inlineStyleAttributes: /\sstyle\s*=/gi,
    evalCalls: /\beval\s*\(/g,
    functionConstructors: /\bnew\s+Function\s*\(/g,
    dynamicScriptCreation: /createElement\s*\(\s*['"]script['"]\s*\)/g,
    htmlStringSinks: /\.(?:innerHTML|outerHTML)\s*=|insertAdjacentHTML\s*\(/g
};
const totals = Object.fromEntries(Object.keys(patterns).map((key) => [key, 0]));
const perFile = [];
for (const absolute of files) {
    const source = fs.readFileSync(absolute, 'utf8');
    const metrics = {};
    let hasDebt = false;
    for (const [key, pattern] of Object.entries(patterns)) {
        pattern.lastIndex = 0;
        const count = [...source.matchAll(pattern)].length;
        metrics[key] = count;
        totals[key] += count;
        if (count > 0) hasDebt = true;
    }
    if (hasDebt) {
        perFile.push({
            path: normalize(path.relative(repoRoot, absolute)),
            ...metrics
        });
    }
}

const blockers = [
    totals.inlineEventAttributes > 0 ? `${totals.inlineEventAttributes} inline event attributes remain.` : '',
    totals.inlineScriptBlocks > 0 ? `${totals.inlineScriptBlocks} host-page inline script blocks remain.` : '',
    totals.inlineStyleBlocks > 0 ? `${totals.inlineStyleBlocks} inline style blocks remain.` : '',
    totals.inlineStyleAttributes > 0 ? `${totals.inlineStyleAttributes} inline style attributes remain.` : ''
].filter(Boolean);
const report = {
    schemaVersion: 1,
    mode: 'report-only-shared-unraid-document',
    scope: {
        scannedRoot: normalize(path.relative(repoRoot, sourceRoot)),
        scannedFiles: files.length,
        exclusions: [
            'third-party icon asset pack',
            'localization catalogs',
            'vendored scripts',
            'minified scripts'
        ]
    },
    enforcement: {
        inlineEventAttributes: 0,
        evalCalls: 0,
        functionConstructors: 0,
        reason: 'FolderView Plus shares Unraid host documents, so a plugin-scoped enforced CSP header could break host or peer-plugin code.'
    },
    totals,
    readiness: {
        enforceableNow: blockers.length === 0,
        blockers,
        completed: [
            'Plugin-owned event attributes use an allowlisted declarative event bridge.',
            'No eval() or Function constructor is permitted in first-party runtime source.',
            'Managed theme CSS rejects executable rules, imports, and external network URLs.'
        ],
        next: [
            'Move remaining page bootstrap blocks into external versioned assets.',
            'Replace remaining style attributes/blocks with scoped classes or nonce-compatible host primitives.',
            'Capture a report-only policy at the Unraid host layer before considering enforcement.'
        ]
    },
    recommendedReportOnlyPolicy: [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "connect-src 'self' https://api.github.com https://raw.githubusercontent.com",
        "object-src 'none'",
        "base-uri 'self'",
        "frame-ancestors 'self'"
    ],
    filesWithDebt: perFile
};
const serialized = `${JSON.stringify(report, null, 2)}\n`;

for (const [metric, expected] of Object.entries(report.enforcement)) {
    if (typeof expected !== 'number') continue;
    if (totals[metric] !== expected) {
        console.error(`ERROR: CSP readiness metric ${metric} is ${totals[metric]} (expected ${expected}).`);
        process.exit(1);
    }
}

if (writeMode) {
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, serialized, 'utf8');
    console.log(`Wrote ${normalize(path.relative(repoRoot, reportPath))}.`);
} else {
    if (!fs.existsSync(reportPath) || fs.readFileSync(reportPath, 'utf8') !== serialized) {
        console.error('ERROR: CSP readiness report is stale. Run: node scripts/csp_readiness_guard.mjs --write');
        process.exit(1);
    }
    console.log(
        `CSP readiness guard passed: ${files.length} files, ${totals.inlineEventAttributes} inline events, `
        + `${totals.inlineScriptBlocks} inline scripts, ${totals.inlineStyleAttributes} style attributes.`
    );
}
