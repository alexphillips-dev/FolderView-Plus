const REDACTED_URL = '[redacted-url]';
const REDACTED_HOST = '[redacted-host]';
const REDACTED_VALUE = '[redacted]';

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const normalizeLiveSmokeDiagnosticLabel = (value, fallback = 'configured-target') => {
    const candidate = String(value || '').trim().toLowerCase();
    if (/^(?:target|theme)-[1-9][0-9]*$/.test(candidate)) {
        return candidate;
    }
    return String(fallback || 'configured-target').trim().toLowerCase() || 'configured-target';
};

export const redactLiveSmokeDiagnostic = (value, sensitiveValues = []) => {
    let output = String(value?.message || value || 'Live smoke validation failed.');
    const candidates = [...new Set(sensitiveValues
        .map((candidate) => String(candidate || '').trim())
        .filter((candidate) => candidate.length >= 3))]
        .sort((left, right) => right.length - left.length);

    for (const candidate of candidates) {
        output = output.replace(new RegExp(escapeRegExp(candidate), 'gu'), REDACTED_URL);
    }

    return output
        .replace(/\b(?:https?|wss?):\/\/[^\s"'`<>]+/giu, REDACTED_URL)
        .replace(/\b[^@\s/:]+:[^@\s]+@(?:\[[0-9a-f:]+\]|[^\s/:]+)(?::[0-9]{1,5})?/giu, REDACTED_HOST)
        .replace(/\[[0-9a-f:]+\](?::[0-9]{1,5})?/giu, REDACTED_HOST)
        .replace(/\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}(?::[0-9]{1,5})?\b/gu, REDACTED_HOST)
        .replace(/\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:local|lan|internal)(?::[0-9]{1,5})?\b/giu, REDACTED_HOST)
        .replace(/\b(authorization|api[_-]?key|password|passwd|secret|token)\s*[:=]\s*(?:bearer\s+)?[^\s,;]+/giu,
            (_match, key) => `${key}=${REDACTED_VALUE}`)
        .trim();
};
