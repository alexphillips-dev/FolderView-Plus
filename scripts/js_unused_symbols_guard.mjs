import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const configPath = path.join(rootDir, 'scripts', 'eslint-unused.config.mjs');
const baselinePath = path.join(rootDir, 'scripts', 'js_unused_symbols_baseline.json');
const targetGlob = 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/**/*.js';
const MAX_PRINT = 40;

const truthy = (value) => /^(1|true|yes|on)$/i.test(String(value || '').trim());

const args = new Set(process.argv.slice(2));
const writeBaseline = args.has('--write-baseline');
const strictMode = args.has('--strict') || truthy(process.env.FVPLUS_JS_UNUSED_STRICT);

const fail = (message, details = '') => {
    console.error(`ERROR: ${message}`);
    if (details) {
        console.error(details.trimEnd());
    }
    process.exit(1);
};

const normalizeRelativePath = (absolutePath) => (
    path.relative(rootDir, absolutePath).replace(/\\/g, '/')
);

const parseSymbolName = (message) => {
    const quotedMatch = message.match(/["'`](.+?)["'`]/);
    return quotedMatch ? quotedMatch[1] : message;
};

const compareFinding = (left, right) => (
    left.file.localeCompare(right.file)
    || left.symbol.localeCompare(right.symbol)
    || left.line - right.line
    || left.column - right.column
);

const shellQuote = (value) => `'${String(value).replace(/'/g, `'\\''`)}'`;

const dedupeFindings = (findings) => {
    const byKey = new Map();
    for (const finding of findings) {
        const key = `${finding.file}::${finding.symbol}`;
        const existing = byKey.get(key);
        if (!existing || compareFinding(finding, existing) < 0) {
            byKey.set(key, finding);
        }
    }
    return [...byKey.values()].sort(compareFinding);
};

const readBaseline = () => {
    if (!fs.existsSync(baselinePath)) {
        return { version: 1, findings: [] };
    }
    const raw = fs.readFileSync(baselinePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.findings)) {
        fail(`Invalid JS unused-symbol baseline: ${normalizeRelativePath(baselinePath)}`);
    }
    return parsed;
};

const writeBaselineFile = (findings) => {
    const payload = {
        version: 1,
        tool: 'eslint@9',
        scope: targetGlob,
        generatedAt: new Date().toISOString(),
        findings
    };
    fs.writeFileSync(baselinePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
};

const collectFindings = () => {
    const commandLine = [
        'npx',
        '--yes',
        '--package',
        'eslint@9',
        'eslint',
        '--config',
        configPath,
        '--format',
        'json',
        targetGlob
    ].map(shellQuote).join(' ');
    const result = spawnSync(
        'bash',
        [
            '-lc',
            commandLine
        ],
        {
            cwd: rootDir,
            encoding: 'utf8',
            maxBuffer: 64 * 1024 * 1024
        }
    );

    if (result.error) {
        fail('Failed to launch ESLint for JS unused-symbol analysis.', String(result.error));
    }
    if (result.status !== 0 && result.status !== 1) {
        fail('ESLint exited unexpectedly during JS unused-symbol analysis.', `${result.stderr || ''}\n${result.stdout || ''}`);
    }

    let report = [];
    try {
        report = JSON.parse(result.stdout || '[]');
    } catch (error) {
        fail('Could not parse ESLint JSON output for JS unused-symbol analysis.', `${result.stderr || ''}\n${result.stdout || ''}\n${error}`);
    }

    const findings = [];
    const unexpectedMessages = [];
    for (const fileReport of report) {
        const relativeFile = normalizeRelativePath(fileReport.filePath);
        for (const message of fileReport.messages || []) {
            if (message.fatal) {
                unexpectedMessages.push(`${relativeFile}:${message.line || 1}:${message.column || 1} fatal ${message.message}`);
                continue;
            }
            if (message.ruleId !== 'no-unused-vars') {
                if (message.severity >= 2) {
                    unexpectedMessages.push(`${relativeFile}:${message.line || 1}:${message.column || 1} ${message.ruleId || 'unknown'} ${message.message}`);
                }
                continue;
            }
            findings.push({
                file: relativeFile,
                symbol: parseSymbolName(message.message),
                line: Number(message.line || 1),
                column: Number(message.column || 1),
                message: message.message
            });
        }
    }

    if (unexpectedMessages.length > 0) {
        fail(
            'JS unused-symbol analysis hit unexpected ESLint diagnostics.',
            unexpectedMessages.slice(0, MAX_PRINT).join('\n')
        );
    }

    return dedupeFindings(findings);
};

const findings = collectFindings();

if (writeBaseline) {
    writeBaselineFile(findings);
    console.log(`Wrote JS unused-symbol baseline with ${findings.length} finding(s): ${normalizeRelativePath(baselinePath)}`);
    process.exit(0);
}

if (strictMode && findings.length > 0) {
    fail(
        `JS unused-symbol guard failed in strict mode with ${findings.length} finding(s).`,
        findings.slice(0, MAX_PRINT).map((item) => ` - ${item.file}:${item.line}:${item.column} ${item.symbol}`).join('\n')
    );
}

const baseline = readBaseline();
const baselineMap = new Map(baseline.findings.map((item) => [`${item.file}::${item.symbol}`, item]));
const findingMap = new Map(findings.map((item) => [`${item.file}::${item.symbol}`, item]));

const unexpected = findings.filter((item) => !baselineMap.has(`${item.file}::${item.symbol}`));
const resolved = baseline.findings.filter((item) => !findingMap.has(`${item.file}::${item.symbol}`));

if (unexpected.length > 0) {
    fail(
        `JS unused-symbol guard found ${unexpected.length} new finding(s) beyond the baseline.`,
        unexpected.slice(0, MAX_PRINT).map((item) => ` - ${item.file}:${item.line}:${item.column} ${item.symbol}`).join('\n')
    );
}

if (findings.length === 0) {
    console.log('JS unused-symbol guard passed: no unused local JS symbols detected.');
    process.exit(0);
}

console.log(`JS unused-symbol guard passed: ${findings.length} baseline finding(s), 0 regressions.`);
if (resolved.length > 0) {
    console.log(`INFO: ${resolved.length} baseline finding(s) are gone; refresh ${normalizeRelativePath(baselinePath)} when convenient.`);
}
