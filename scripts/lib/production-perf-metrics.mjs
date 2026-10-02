export const median = values => {
    if (!values.length || values.some(value => !Number.isFinite(value) || value < 0)) throw new Error('Missing or invalid performance samples');
    const sorted = [...values].sort((a,b) => a-b), middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle-1]+sorted[middle])/2;
};
export const checkMetric = (value, budget, previous, policy) => {
    if (!Number.isFinite(value) || !Number.isFinite(budget) || value < 0) throw new Error('Missing performance metric or budget');
    const limit = Number.isFinite(previous) ? Math.min(budget, previous + Math.max(previous * policy.percent / 100, policy.floor)) : budget;
    return { value, baseline: previous ?? null, limit, passed: value <= limit };
};
export const dockerStartupStages = ['providerPreparation', 'customScripts', 'runtimeAsset', 'renderDataWait',
    'renderPreparation', 'folderRows', 'folderFinalization', 'folderGrouping', 'postRenderPolish', 'detailHydration'];
export const dockerStartupMetrics = snapshot => Object.fromEntries(dockerStartupStages.map(stage => {
    const duration = snapshot?.operations?.[stage]?.lastMs;
    if (!Number.isFinite(duration) || duration < 0) throw new Error(`Missing Docker startup stage: ${stage}`);
    return [stage + 'Ms', duration];
}));

export const checkDockerMembership = (rows, folders, names) => {
    if (rows.length !== names.length || new Set(rows.map(row => row.name)).size !== names.length) return false;
    const expected = new Map(Object.entries(folders).flatMap(([id, folder]) => folder.containers.map(name => [name, id])));
    return rows.every(row => expected.has(row.name) && expected.get(row.name) === row.folderId);
};
// Runs before any host or plugin scripts. Navigation timing includes asset startup.
export function observeProductionStartup() {
    const state = { longTasks: [], frameGaps: [], mutationCallbacks: 0, mutationRecords: 0, stopped: false };
    const observer = new PerformanceObserver(list => state.longTasks.push(...list.getEntries().map(e => ({ start: e.startTime, duration: e.duration }))));
    observer.observe({ type: 'longtask', buffered: true });
    const mutations = new MutationObserver(records => { state.mutationCallbacks++; state.mutationRecords += records.length; });
    mutations.observe(document, { childList: true, subtree: true });
    let last;
    const frame = now => { if (last !== undefined) state.frameGaps.push(now-last); last=now; if (!state.stopped) requestAnimationFrame(frame); };
    requestAnimationFrame(frame);
    window.productionPerf = { state, finish() {
        state.stopped = true; observer.disconnect(); mutations.disconnect();
        const resources = performance.getEntriesByType('resource');
        const scripts = resources.filter(e => e.initiatorType === 'script');
        return { readyMs: state.readyMs, settledMs: performance.now(),
            longTaskCount: state.longTasks.length, longTaskTotalMs: state.longTasks.reduce((sum,e)=>sum+e.duration,0),
            longestTaskMs: Math.max(0,...state.longTasks.map(e=>e.duration)),
            longestFrameGapMs: Math.max(0,...state.frameGaps), mutationCallbacks: state.mutationCallbacks,
            mutationRecords: state.mutationRecords, domNodes: document.querySelectorAll('*').length,
            requests: resources.length, scriptRequests: scripts.length,
            transferBytes: resources.reduce((sum,e)=>sum+e.transferSize,0),
            cachedScriptRequests: scripts.filter(e=>e.transferSize===0 && e.decodedBodySize>0).length,
            scripts: scripts.map(e=>new URL(e.name).pathname) };
    } };
}
