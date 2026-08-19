// @ts-check
(function dockerRefreshDiagnosticsModule(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewPlusFoundationModules = root.FolderViewPlusFoundationModules || {};
    root.FolderViewPlusFoundationModules.dockerRefreshDiagnostics = factory();
}(typeof window !== 'undefined' ? window : {}, function dockerRefreshDiagnosticsFactory() {
    'use strict';

    const STORAGE_KEY = 'fv.support.bundle.docker.refreshDiagnostics.v1';
    const SESSION_LIMIT = 5;
    const STORAGE_MAX_BYTES = 24576;
    const SOURCE_VALUES = Object.freeze([
        'initial-bootstrap',
        'manual-host-refresh',
        'plugin-config-revision',
        'plugin-action-followup',
        'unraid-native-busy-poll',
        'host-dialog-callback',
        'unknown-host-caller'
    ]);
    const SOURCE_SET = new Set(SOURCE_VALUES);
    const countTemplate = () => ({ loadlist: 0, listview: 0, renders: 0, requests: 0, busyPasses: 0, foldersRestored: 0 });
    const sourceTemplate = () => Object.fromEntries(SOURCE_VALUES.map((source) => [source, 0]));
    const safeNumber = (value) => Math.max(0, Number.isFinite(Number(value)) ? Number(value) : 0);
    const normalizeSource = (value) => SOURCE_SET.has(String(value || '').trim())
        ? String(value || '').trim()
        : 'unknown-host-caller';
    const iso = (value) => new Date(value).toISOString();
    const buildOrderFingerprint = (order) => {
        const input = (Array.isArray(order) ? order : []).map((entry) => String(entry || '')).join('\u001f');
        let hashA = 0x811c9dc5;
        let hashB = 0x9e3779b9;
        for (let index = 0; index < input.length; index++) {
            const code = input.charCodeAt(index);
            hashA ^= code;
            hashA = Math.imul(hashA, 0x01000193) >>> 0;
            hashB ^= code + index + 1;
            hashB = Math.imul(hashB, 0x85ebca6b) >>> 0;
        }
        return `${hashA.toString(16).padStart(8, '0')}${hashB.toString(16).padStart(8, '0')}`;
    };
    const summarizeCadence = (timestamps = []) => {
        const gaps = timestamps.slice(1).map((value, index) => Math.max(0, value - timestamps[index]));
        if (gaps.length === 0) return { sampleCount: 0, averageMs: null, minimumMs: null, maximumMs: null };
        return {
            sampleCount: gaps.length,
            averageMs: Math.round(gaps.reduce((sum, value) => sum + value, 0) / gaps.length),
            minimumMs: Math.min(...gaps),
            maximumMs: Math.max(...gaps)
        };
    };
    const dominantSource = (events) => {
        const counts = sourceTemplate();
        events.forEach((event) => { counts[normalizeSource(event.source)] += 1; });
        return SOURCE_VALUES.reduce((winner, source) => counts[source] > counts[winner] ? source : winner, 'unknown-host-caller');
    };
    const buildVerdict = (reloadEvents = [], nowMs = Date.now()) => {
        const unattended = reloadEvents.filter((event) => !['manual-host-refresh', 'host-dialog-callback'].includes(event.source));
        const within90 = unattended.filter((event) => nowMs - event.atMs <= 90000);
        const within60 = within90.filter((event) => nowMs - event.atMs <= 60000);
        const status = within90.length >= 6 ? 'confirmed' : (within60.length >= 3 ? 'suspected' : 'healthy');
        const evidence = status === 'confirmed' ? within90 : within60;
        return {
            status,
            source: evidence.length > 0 ? dominantSource(evidence) : null,
            fullReloads: evidence.length,
            renders: 0,
            cadence: summarizeCadence(evidence.map((event) => event.atMs)),
            reference: 'FVPLUS-DKR-REFRESH-001'
        };
    };
    const createSession = (nowMs) => ({
        startedAt: iso(nowMs),
        lastEventAt: iso(nowMs),
        counts: countTemplate(),
        reloadSources: sourceTemplate(),
        reloadEvents: [],
        lastRenderGeneration: null,
        lastFolderCount: null,
        nativeBusy: { cycleCount: 0, passCount: 0, firstSeenAt: null, lastSeenAt: null, durationMs: 0, cleared: false, foldersRestored: false, active: false }
    });
    const sessionSummary = (session, nowMs, exitReason = null) => {
        if (!session) return null;
        const startedMs = Date.parse(session.startedAt);
        const endedAt = exitReason ? iso(nowMs) : null;
        const endMs = nowMs;
        const verdict = buildVerdict(session.reloadEvents || [], nowMs);
        verdict.renders = safeNumber(session.counts?.renders);
        return {
            startedAt: session.startedAt,
            endedAt,
            durationMs: Math.max(0, endMs - startedMs),
            exitReason,
            counts: { ...countTemplate(), ...(session.counts || {}) },
            reloadSources: { ...sourceTemplate(), ...(session.reloadSources || {}) },
            cadence: summarizeCadence((session.reloadEvents || []).map((event) => event.atMs)),
            lastFolderCount: Number.isFinite(Number(session.lastFolderCount)) ? Number(session.lastFolderCount) : null,
            nativeBusy: { ...createSession(nowMs).nativeBusy, ...(session.nativeBusy || {}) },
            verdict
        };
    };
    const createTracker = (deps = {}) => {
        const win = deps.window || null;
        const storage = deps.storage || win?.localStorage || null;
        const now = typeof deps.now === 'function' ? deps.now : Date.now;
        const readStored = () => {
            try {
                const parsed = JSON.parse(String(storage?.getItem(STORAGE_KEY) || '{}'));
                return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
            } catch (_error) {
                return {};
            }
        };
        const stored = readStored();
        let completedSessions = Array.isArray(stored.completedSessions) ? stored.completedSessions.slice(-SESSION_LIMIT) : [];
        if (stored.currentSession && typeof stored.currentSession === 'object') {
            completedSessions.push({ ...stored.currentSession, endedAt: iso(now()), exitReason: 'superseded-by-new-session' });
            completedSessions = completedSessions.slice(-SESSION_LIMIT);
        }
        let session = createSession(now());
        let pendingSource = null;
        let pendingSourceUntil = 0;
        let disposed = false;
        const apiMismatch = {
            observedCount: safeNumber(stored.apiMismatch?.observedCount),
            providerOnlyCount: safeNumber(stored.apiMismatch?.providerOnlyCount),
            runtimeOnlyCount: safeNumber(stored.apiMismatch?.runtimeOnlyCount),
            firstSeenAt: stored.apiMismatch?.firstSeenAt || null,
            lastSeenAt: stored.apiMismatch?.lastSeenAt || null,
            policy: 'native-structure-authoritative',
            hostReloadRequested: false
        };
        const aggregate = () => {
            const sessions = [...completedSessions, sessionSummary(session, now())].filter(Boolean);
            const totals = countTemplate();
            const reloadSources = sourceTemplate();
            sessions.forEach((entry) => {
                Object.keys(totals).forEach((key) => { totals[key] += safeNumber(entry.counts?.[key]); });
                SOURCE_VALUES.forEach((source) => { reloadSources[source] += safeNumber(entry.reloadSources?.[source]); });
            });
            const currentSession = sessionSummary(session, now());
            return {
                schemaVersion: 1,
                updatedAt: iso(now()),
                policy: { structureAuthority: 'native-config-revision', completedSessionLimit: SESSION_LIMIT },
                verdict: currentSession?.verdict || completedSessions.at(-1)?.verdict || buildVerdict([], now()),
                totals,
                reloadSources,
                apiMismatch,
                nativeBusy: currentSession?.nativeBusy || completedSessions.at(-1)?.nativeBusy || createSession(now()).nativeBusy,
                completedSessionCount: completedSessions.length,
                completedSessions,
                currentSession
            };
        };
        const write = () => {
            try {
                const payload = aggregate();
                const serialized = JSON.stringify(payload);
                storage?.setItem(STORAGE_KEY, serialized.length <= STORAGE_MAX_BYTES ? serialized : JSON.stringify({
                    ...payload,
                    completedSessions: payload.completedSessions.slice(-2),
                    completedSessionCount: payload.completedSessions.length,
                    storageTrimmed: true
                }));
                return true;
            } catch (_error) {
                return false;
            }
        };
        const touch = () => { session.lastEventAt = iso(now()); };
        const recordBusy = () => {
            const busy = session.nativeBusy;
            const nowMs = now();
            if (!busy.active) {
                busy.active = true;
                busy.cycleCount += 1;
                busy.firstSeenAt = iso(nowMs);
                busy.cleared = false;
                busy.foldersRestored = false;
            }
            busy.passCount += 1;
            busy.lastSeenAt = iso(nowMs);
            busy.durationMs = Math.max(0, nowMs - Date.parse(busy.firstSeenAt));
            session.counts.busyPasses += 1;
        };
        const record = (eventType, details = {}) => {
            if (disposed || !session) return false;
            const type = String(eventType || '').trim();
            const safeDetails = details && typeof details === 'object' && !Array.isArray(details) ? details : {};
            const nowMs = now();
            touch();
            if (type === 'loadlist') {
                const busy = safeDetails.nativeBusyActive === true;
                const source = busy
                    ? 'unraid-native-busy-poll'
                    : (pendingSource && nowMs <= pendingSourceUntil
                        ? pendingSource
                        : (session.counts.loadlist === 0 ? 'initial-bootstrap' : normalizeSource(safeDetails.reloadSource)));
                pendingSource = null;
                session.counts.loadlist += 1;
                session.reloadSources[source] += 1;
                session.reloadEvents.push({ atMs: nowMs, source });
                session.reloadEvents = session.reloadEvents.slice(-20);
                if (busy) recordBusy();
                else if (session.nativeBusy.active) {
                    session.nativeBusy.active = false;
                    session.nativeBusy.cleared = true;
                    session.nativeBusy.durationMs = Math.max(0, nowMs - Date.parse(session.nativeBusy.firstSeenAt));
                }
            } else if (type === 'listview') session.counts.listview += 1;
            else if (type === 'buildDockerFolderReq') session.counts.requests += 1;
            else if (type === 'host-list-restored') session.counts.foldersRestored += 1;
            return write();
        };
        const recordPageSnapshot = (snapshot = {}) => {
            if (disposed || !session || String(snapshot?.reason || '') !== 'render-complete') return false;
            const generation = safeNumber(snapshot?.correlation?.renderGeneration);
            if (generation > 0 && generation === session.lastRenderGeneration) return false;
            session.lastRenderGeneration = generation || session.lastRenderGeneration;
            session.counts.renders += 1;
            session.lastFolderCount = safeNumber(snapshot?.folderRows?.count);
            if (session.nativeBusy.cleared && !session.nativeBusy.foldersRestored) {
                session.nativeBusy.foldersRestored = true;
                session.counts.foldersRestored += 1;
            }
            touch();
            return write();
        };
        const recordApiMismatch = (details = {}) => {
            const at = iso(now());
            apiMismatch.observedCount += 1;
            apiMismatch.providerOnlyCount += safeNumber(details.providerOnlyCount);
            apiMismatch.runtimeOnlyCount += safeNumber(details.runtimeOnlyCount ?? (details.targeted === true ? 1 : 0));
            apiMismatch.firstSeenAt = apiMismatch.firstSeenAt || at;
            apiMismatch.lastSeenAt = at;
            return write();
        };
        const markReloadSource = (source) => {
            pendingSource = normalizeSource(source);
            pendingSourceUntil = now() + 15000;
        };
        const dispose = (exitReason = 'pagehide') => {
            if (disposed) return;
            disposed = true;
            completedSessions.push(sessionSummary(session, now(), String(exitReason || 'pagehide')));
            completedSessions = completedSessions.slice(-SESSION_LIMIT);
            session = null;
            write();
            win?.removeEventListener?.('pagehide', onPageHide);
        };
        const onPageHide = () => dispose('pagehide');
        win?.addEventListener?.('pagehide', onPageHide, { once: true });
        write();
        return Object.freeze({ record, recordPageSnapshot, recordApiMismatch, markReloadSource, snapshot: aggregate, dispose });
    };

    return Object.freeze({ STORAGE_KEY, SESSION_LIMIT, SOURCE_VALUES, buildOrderFingerprint, buildVerdict, createTracker });
}));
