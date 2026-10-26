export const DEFAULT_PERFORMANCE_RESOURCE_LIMIT = 500;

export function performanceScenarios(scenarios, rawLimit = process.env.FVPLUS_PERF_MAX_RESOURCES ?? DEFAULT_PERFORMANCE_RESOURCE_LIMIT) {
    const limit = Number(rawLimit);
    if (String(rawLimit).trim() === '' || !Number.isInteger(limit) || limit < 0) {
        throw new Error('FVPLUS_PERF_MAX_RESOURCES must be a non-negative integer; zero explicitly includes every scenario.');
    }
    const entries = Object.entries(scenarios || {});
    const selected = entries.filter(([, scenario]) => limit === 0 || scenario.members <= limit);
    if (entries.length && !selected.length) throw new Error('No performance scenario fits the configured resource cap.');
    const skipped = entries.filter(([, scenario]) => limit > 0 && scenario.members > limit)
        .map(([name, scenario]) => ({ name, members: scenario.members, reason: 'resource-limit' }));
    return { limit, selected, skipped };
}
