const SAFE_KEY = /(version|channel|schema|count|status|health|mode|layout|width|height|viewport|touch|theme|available|enabled|duration|timestamp|checked|source|provider|result|reason|errorcode|severity|category|included|fresh|age|render|reload|loadlist|listview|request|busy|cadence|mismatch|folder|mutation|record|resource|transfer|session|verdict|started|ended|exit|bootstrap|manual|revision|followup|poll|caller)/i;
const SENSITIVE_KEY = /(name|path|url|address|ip|mac|token|cookie|header|agent|identity|uuid|(?:^|_)id$)/i;
const MAX_DEPTH = 8;
const MAX_ROWS = 300;

const normalizeScalar = (value) => {
    if (typeof value === 'string') return value.slice(0, 160);
    if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value;
    return undefined;
};

const flattenSafe = (value, path = '', depth = 0, output = new Map()) => {
    if (depth > MAX_DEPTH || output.size >= MAX_ROWS) return output;
    if (Array.isArray(value)) {
        output.set(`${path}[]#count`, value.length);
        return output;
    }
    if (!value || typeof value !== 'object') return output;
    for (const [key, child] of Object.entries(value)) {
        if (output.size >= MAX_ROWS) break;
        const nextPath = path ? `${path}.${key}` : key;
        if (Array.isArray(child)) {
            output.set(`${nextPath}[]#count`, child.length);
            continue;
        }
        if (child && typeof child === 'object') {
            flattenSafe(child, nextPath, depth + 1, output);
            continue;
        }
        if (!SAFE_KEY.test(key) || SENSITIVE_KEY.test(key)) continue;
        const scalar = normalizeScalar(child);
        if (scalar !== undefined) output.set(nextPath, scalar);
    }
    return output;
};

const assertSanitizedBundle = (bundle, label) => {
    if (!bundle || typeof bundle !== 'object' || Array.isArray(bundle)) {
        throw new Error(`${label} is not a support-bundle object.`);
    }
    const mode = String(bundle.bundleMeta?.privacyMode || bundle.redactionManifest?.mode || '').toLowerCase();
    if (mode !== 'sanitized') {
        throw new Error(`${label} is not a sanitized support bundle.`);
    }
    if (!bundle.redactionManifest || typeof bundle.redactionManifest !== 'object') {
        throw new Error(`${label} does not include a redaction manifest.`);
    }
};

export const compareSanitizedSupportBundles = (left, right) => {
    assertSanitizedBundle(left, 'Left input');
    assertSanitizedBundle(right, 'Right input');
    const leftValues = flattenSafe(left);
    const rightValues = flattenSafe(right);
    const paths = [...new Set([...leftValues.keys(), ...rightValues.keys()])].sort();
    const differences = [];
    for (const path of paths) {
        const leftValue = leftValues.has(path) ? leftValues.get(path) : '(missing)';
        const rightValue = rightValues.has(path) ? rightValues.get(path) : '(missing)';
        if (JSON.stringify(leftValue) === JSON.stringify(rightValue)) continue;
        differences.push({ path, left: leftValue, right: rightValue });
    }
    return {
        schemaVersion: 1,
        comparedFieldCount: paths.length,
        differenceCount: differences.length,
        differences
    };
};

const escapeCell = (value) => String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');

export const renderSupportBundleComparisonMarkdown = (report) => {
    const lines = [
        '# FolderView Plus Support Bundle Comparison',
        '',
        `Compared ${report.comparedFieldCount} privacy-safe fields; found ${report.differenceCount} difference(s).`,
        ''
    ];
    if (report.differences.length === 0) {
        lines.push('No differences were found in the compared troubleshooting fields.', '');
        return `${lines.join('\n')}\n`;
    }
    lines.push('| Field | Left | Right |', '| --- | --- | --- |');
    for (const row of report.differences) {
        lines.push(`| ${escapeCell(row.path)} | ${escapeCell(row.left)} | ${escapeCell(row.right)} |`);
    }
    lines.push('');
    return `${lines.join('\n')}\n`;
};
