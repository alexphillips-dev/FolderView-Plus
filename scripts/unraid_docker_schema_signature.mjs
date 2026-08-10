#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';

const [schemaPath = '', baselinePath = '', releasePath = ''] = process.argv.slice(2);
if (!schemaPath || !baselinePath) {
    console.error('Usage: unraid_docker_schema_signature.mjs <schema> <baseline> [release-json]');
    process.exit(2);
}

const readText = (file) => fs.readFileSync(file, 'utf8');
const schema = (
    schemaPath === '-'
        ? fs.readFileSync(0, 'utf8')
        : readText(schemaPath)
).replace(/\r\n/g, '\n');
const baseline = JSON.parse(readText(baselinePath));
const lines = schema.split('\n');
const trackedTypes = new Set([
    'Docker',
    'DockerContainer',
    'DockerMutations',
    'DockerAutostartEntryInput',
    'DockerContainerStats',
    'DockerPortConflicts',
    'DockerContainerPortConflict',
    'DockerLanPortConflict',
    'DockerContainerLogs',
    'DockerContainerLogLine'
]);
const rootFields = Object.freeze({
    Mutation: new Set(['docker', 'refreshDockerDigests']),
    Query: new Set(['docker', 'dockerContainers']),
    Subscription: new Set(['dockerContainerStats'])
});

const extractBlock = (startIndex) => {
    const block = [];
    let depth = 0;
    let started = false;
    for (let index = startIndex; index < lines.length; index += 1) {
        const line = lines[index];
        const opens = (line.match(/{/g) || []).length;
        const closes = (line.match(/}/g) || []).length;
        if (opens > 0) started = true;
        if (started) block.push(line);
        depth += opens - closes;
        if (started && depth === 0) break;
    }
    return block;
};
const normalizeLine = (line) => String(line || '')
    .replace(/\s+/g, ' ')
    .trim();
const fieldName = (line) => {
    const match = normalizeLine(line).match(/^([A-Za-z_][A-Za-z0-9_]*)\s*(?:\(|:)/);
    return match ? match[1] : '';
};
const signatureLines = [];

for (let index = 0; index < lines.length; index += 1) {
    const header = normalizeLine(lines[index]).match(/^(?:type|input)\s+([A-Za-z_][A-Za-z0-9_]*)\b.*\{$/);
    if (!header) continue;
    const typeName = header[1];
    if (!trackedTypes.has(typeName) && !rootFields[typeName]) continue;
    const block = extractBlock(index);
    if (trackedTypes.has(typeName)) {
        block
            .map(normalizeLine)
            .filter((line) => line && line !== '}' && !line.startsWith('"""'))
            .forEach((line) => signatureLines.push(`${typeName}|${line}`));
    } else {
        block
            .map(normalizeLine)
            .filter((line) => rootFields[typeName].has(fieldName(line)))
            .forEach((line) => signatureLines.push(`${typeName}|${line}`));
    }
}

signatureLines.sort();
const signature = crypto
    .createHash('sha256')
    .update(`${signatureLines.join('\n')}\n`, 'utf8')
    .digest('hex');
const expectedSignature = String(baseline.schemaSignature || '').trim();
let latestApiRelease = 'not-scanned';
if (releasePath && fs.existsSync(releasePath)) {
    try {
        const release = JSON.parse(readText(releasePath));
        latestApiRelease = String(release.tag_name || release.name || 'unknown').trim() || 'unknown';
    } catch {
        latestApiRelease = 'unavailable';
    }
}
const expectedRelease = String(baseline.latestReviewedApiRelease || '').trim();
const requiredTokens = Array.isArray(baseline.requiredTokens) ? baseline.requiredTokens : [];
const missingTokens = requiredTokens.filter((token) => !schema.includes(String(token)));
const schemaStatus = missingTokens.length > 0
    ? 'required-capability-missing'
    : (!expectedSignature
        ? 'baseline-missing'
        : (signature === expectedSignature ? 'matched' : 'changed'));
const releaseStatus = latestApiRelease === 'not-scanned'
    ? 'not-scanned'
    : (
        latestApiRelease === 'unavailable'
            ? 'unavailable'
            : (latestApiRelease === expectedRelease ? 'matched' : 'changed')
    );

process.stdout.write(`${JSON.stringify({
    schemaStatus,
    schemaSignature: signature,
    expectedSchemaSignature: expectedSignature || null,
    trackedLineCount: signatureLines.length,
    missingTokenCount: missingTokens.length,
    latestApiRelease,
    expectedApiRelease: expectedRelease || null,
    releaseStatus
})}\n`);
