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
    inlineStyleAttributes: /\sstyle\s*=\s*['"]/gi,
    evalCalls: /\beval\s*\(/g,
    functionConstructors: /\bnew\s+Function\s*\(/g,
    dynamicScriptCreation: /createElement\s*\(\s*['"]script['"]\s*\)/g,
    htmlStringSinks: /\.(?:innerHTML|outerHTML)\s*=|insertAdjacentHTML\s*\(/g
};
const lineNumberAt = (source, index) => source.slice(0, index).split('\n').length;
const explicitHtmlSinkReviews = new Map([
    ['src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js:1286', 'Port endpoints and protocols are escaped by buildDockerPortEndpoint before the markup builder returns.'],
    ['src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js:3465', 'The loading overlay contains plugin-authored static markup only.'],
    ['src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js:5252', 'The assignment trims an already-rendered host status clone and does not interpolate new data.'],
    ['src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js:5284', 'The assignment trims an already-rendered host status clone and does not interpolate new data.'],
    ['src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.action-bar.js:274', 'Action, label, icon, title, and menu values are escaped by the local markup builders.'],
    ['src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.command-view.js:504', 'Names, identifiers, states, actions, and error text are escaped; counts are normalized numbers and image sources are sanitized.'],
    ['src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/runtime.shared-controls.js:221', 'The stable-toggle controller accepts only plugin-owned markup builders and validates the expected input after mounting.'],
    ['src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.editor.chrome.js:471', 'buildTopChrome returns plugin-authored editor chrome with no persisted-value interpolation.'],
    ['src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.editor.chrome.js:485', 'The action bar shell contains plugin-authored static markup only.'],
    ['src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.editor.chrome.js:604', 'Panel titles and descriptions come from the frozen plugin-authored section metadata table.'],
    ['src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.editor.chrome.js:680', 'Section keys and labels come from the plugin-authored editor metadata tables.'],
    ['src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.editor.chrome.js:832', 'The preview image source is a fixed plugin asset path.'],
    ['src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.editor.rules.js:563', 'Rule, template, status, and folder values are contextually escaped by the owning markup builders before the panel is mounted.'],
    ['src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.bulk-assignment.js:691', 'The empty-filter state contains plugin-authored static markup only.'],
    ['src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.folder-editor.js:343', 'Folder identity and path values are escaped, status values are normalized counts, and action groups use guarded builders.'],
    ['src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.folderview3-migration.js:184', 'FolderView3 report text is escaped at every interpolation boundary; counts and selected states are normalized before markup is mounted.'],
    ['src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.settings-search.js:281', 'The settings search empty state contains plugin-authored static markup only.'],
    ['src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.js:6363', 'Summary-card values pass through buildBasicSummaryCardHtml, which escapes every interpolated value.'],
    ['src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.theme-workspace.js:150', 'The appearance profile toolbar uses plugin-authored markup and escapes localized catalog values before mounting.'],
    ['src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.theme-workspace.js:155', 'Appearance profile identifiers and names are escaped before option markup is mounted.'],
    ['src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.theme-workspace.js:269', 'Theme names, source metadata, warnings, identifiers, and statuses are escaped at their interpolation boundaries.'],
    ['src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.wizard.js:137', 'The only dynamic value is a normalized numeric hidden-item count.']
]);
const usedExplicitHtmlSinkReviews = new Set();
const inspectHtmlSinkControl = (relativePath, source, index, line) => {
    const reviewKey = `${relativePath}:${line}`;
    if (explicitHtmlSinkReviews.has(reviewKey)) {
        usedExplicitHtmlSinkReviews.add(reviewKey);
        return { controlStatus: 'controlled', controlEvidence: explicitHtmlSinkReviews.get(reviewKey) };
    }
    const statement = source.slice(index, Math.min(source.length, index + 220));
    const nearby = source.slice(Math.max(0, index - 500), Math.min(source.length, index + 700));
    if (/\.innerHTML\s*=\s*(['"])\1/.test(statement)) {
        return { controlStatus: 'controlled', controlEvidence: 'The sink only clears existing plugin-owned markup.' };
    }
    if (/FolderViewPlusSafeDom|\bsafeDom\b|\.textContent\s*=|createTextNode\s*\(/.test(nearby)) {
        return { controlStatus: 'controlled', controlEvidence: 'Safe DOM or text-only construction is visible at the sink boundary.' };
    }
    if (/escapeHtml\s*\(|escapeAttr\s*\(|sanitize(?:Html|Text|Value)?\s*\(/i.test(nearby)) {
        return { controlStatus: 'controlled', controlEvidence: 'Contextual escaping or sanitization is visible at the interpolation boundary.' };
    }
    return { controlStatus: 'review-required', controlEvidence: 'No local safe-DOM or contextual-escaping marker was detected automatically.' };
};
const classifyHtmlSink = (relativePath, source, index) => {
    const nearby = source.slice(Math.max(0, index - 320), Math.min(source.length, index + 420));
    const persistedOrRuntimePath = /(?:docker|folder|import|template|diagnostic|theme|bulk-assignment)/i.test(relativePath);
    const dataBearingContext = /(?:name|metadata|template|diagnostic|message|summary|detail|issue|folder|container|translation)/i.test(nearby);
    return persistedOrRuntimePath && dataBearingContext
        ? {
            risk: 'high',
            dataClass: 'persisted-or-runtime-data',
            requiredControl: 'Safe DOM construction or contextual escaping at every interpolation boundary.'
        }
        : {
            risk: 'reviewed',
            dataClass: 'static-or-controlled-ui-template',
            requiredControl: 'Keep the sink limited to plugin-authored markup and escaped dynamic values.'
        };
};
const totals = Object.fromEntries(Object.keys(patterns).map((key) => [key, 0]));
const perFile = [];
const htmlStringSinkInventory = [];
for (const absolute of files) {
    const source = fs.readFileSync(absolute, 'utf8');
    const relativePath = normalize(path.relative(repoRoot, absolute));
    const metrics = {};
    let hasDebt = false;
    for (const [key, pattern] of Object.entries(patterns)) {
        pattern.lastIndex = 0;
        const count = [...source.matchAll(pattern)].length;
        metrics[key] = count;
        totals[key] += count;
        if (count > 0) hasDebt = true;
    }
    patterns.htmlStringSinks.lastIndex = 0;
    for (const match of source.matchAll(patterns.htmlStringSinks)) {
        const line = lineNumberAt(source, match.index);
        htmlStringSinkInventory.push({
            path: relativePath,
            line,
            sink: match[0].trim(),
            ...classifyHtmlSink(relativePath, source, match.index),
            ...inspectHtmlSinkControl(relativePath, source, match.index, line)
        });
    }
    if (hasDebt) {
        perFile.push({
            path: relativePath,
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
const sinkControlSummary = Object.fromEntries(
    ['controlled', 'review-required'].map((status) => [
        status,
        htmlStringSinkInventory.filter((entry) => entry.controlStatus === status).length
    ])
);
const staleExplicitHtmlSinkReviews = [...explicitHtmlSinkReviews.keys()]
    .filter((key) => !usedExplicitHtmlSinkReviews.has(key));
const report = {
    schemaVersion: 2,
    mode: 'report-only-shared-unraid-document',
    scope: {
        scannedRoot: normalize(path.relative(repoRoot, sourceRoot)),
        scannedFiles: files.length,
        exclusions: [
            'third-party icon asset pack',
            'vendored scripts',
            'minified scripts'
        ]
    },
    enforcement: {
        inlineEventAttributes: 0,
        inlineScriptBlocks: 0,
        inlineStyleBlocks: 0,
        evalCalls: 0,
        functionConstructors: 0,
        reason: 'FolderView Plus shares Unraid host documents, so a plugin-scoped enforced CSP header could break host or peer-plugin code.'
    },
    totals,
    sinkControlSummary,
    readiness: {
        pluginOwnedSourceReady: blockers.length === 0,
        enforceableNow: false,
        sourceBlockers: blockers,
        hostEnforcementBlockers: [
            'FolderView Plus shares the document policy with Unraid and peer plugins.',
            'A host-level report-only observation period is required before enforcement.'
        ],
        completed: [
            'Plugin-owned event attributes use an allowlisted declarative event bridge.',
            'Plugin-owned bootstrap scripts are external versioned assets.',
            'No eval() or Function constructor is permitted in first-party runtime source.',
            'Managed theme CSS rejects executable rules, imports, and external network URLs.'
        ],
        next: [
            'Keep runtime styling limited to scoped classes or validated CSS custom properties.',
            'Continue migrating high-risk HTML string sinks to safe DOM construction.',
            'Capture a report-only policy at the Unraid host layer before considering enforcement.'
        ]
    },
    recommendedReportOnlyPolicy: [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "connect-src 'self' https://api.github.com https://raw.githubusercontent.com",
        "object-src 'none'",
        "base-uri 'self'",
        "frame-ancestors 'self'"
    ],
    trustedTypesEvaluation: {
        productionRequirement: false,
        mode: 'fixtures-and-report-only',
        candidateDirective: "require-trusted-types-for 'script'",
        reason: 'FolderView Plus shares its document with the Unraid webGUI and peer plugins, so production enforcement must remain host-coordinated.'
    },
    htmlStringSinkInventory,
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
if (sinkControlSummary['review-required'] > 0 || staleExplicitHtmlSinkReviews.length > 0) {
    console.error(
        `ERROR: HTML sink review inventory has ${sinkControlSummary['review-required']} unreviewed sink(s) `
        + `and ${staleExplicitHtmlSinkReviews.length} stale review record(s).`
    );
    process.exit(1);
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
