// @ts-check
(function dockerRuntimeContainerModelModule(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewPlusDockerContainerModel = factory();
}(typeof window !== 'undefined' ? window : {}, function dockerRuntimeContainerModelFactory() {
    'use strict';

    const clone = (value, fallback = null) => {
        try {
            return JSON.parse(JSON.stringify(value));
        } catch (_error) {
            return fallback;
        }
    };
    const deepFreeze = (value) => {
        if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
        Object.values(value).forEach(deepFreeze);
        return Object.freeze(value);
    };
    const asObject = (value) => (
        value && typeof value === 'object' && !Array.isArray(value) ? value : {}
    );
    const normalizeName = (value) => String(value || '').trim().replace(/^\/+/, '');
    const normalizeOptionalString = (value) => (
        value === null || typeof value === 'undefined' ? null : String(value).trim()
    );
    const normalizeInteger = (value) => {
        if (value === null || typeof value === 'undefined' || value === '') return null;
        const numeric = Number(value);
        return Number.isFinite(numeric) ? Math.trunc(numeric) : null;
    };
    const normalizeBigInteger = (value) => {
        if (value === null || typeof value === 'undefined' || value === '') return null;
        if (typeof value === 'number' && Number.isSafeInteger(value)) return value;
        const text = String(value).trim();
        return /^-?\d+$/.test(text) ? text : null;
    };
    const normalizeBoolean = (value, fallback = false) => (
        typeof value === 'boolean' ? value : fallback
    );
    const normalizeContainerState = (entry = {}, info = {}, state = {}) => {
        const raw = String(entry.state || state.Status || '').trim().toLowerCase();
        if (state.Paused === true || raw === 'paused') return 'paused';
        if (state.Running === true || raw === 'running') return 'running';
        if (raw === 'exited' || state.Running === false) return 'exited';
        return raw;
    };
    const normalizePort = (entry = {}) => Object.freeze({
        ip: normalizeOptionalString(entry.ip ?? entry.IP ?? entry.PrivateIP),
        privatePort: normalizeInteger(entry.privatePort ?? entry.PrivatePort),
        publicPort: normalizeInteger(entry.publicPort ?? entry.PublicPort),
        type: String(entry.type ?? entry.Type ?? '').trim().toLowerCase()
    });
    const normalizeMount = (entry = {}) => Object.freeze({
        type: String(entry.type ?? entry.Type ?? '').trim().toLowerCase(),
        source: normalizeOptionalString(entry.source ?? entry.Source),
        destination: normalizeOptionalString(entry.destination ?? entry.Destination),
        mode: normalizeOptionalString(entry.mode ?? entry.Mode),
        rw: normalizeBoolean(entry.rw ?? entry.RW, true),
        propagation: normalizeOptionalString(entry.propagation ?? entry.Propagation)
    });
    const freezeArray = (items) => Object.freeze(items);

    const normalizeContainer = (entry = {}, options = {}) => {
        const source = String(options.source || entry.source || 'unknown').trim() || 'unknown';
        const info = asObject(entry.info);
        const config = asObject(info.Config);
        const runtimeState = asObject(info.State);
        const names = (
            Array.isArray(entry.names)
                ? entry.names
                : [entry.name, info.Name]
        ).map(normalizeName).filter(Boolean);
        const id = String(entry.id || info.Id || '').trim();
        const shortId = String(entry.shortId || id.split(':').pop() || id).trim();
        const labels = asObject(entry.labels || entry.Labels || config.Labels);
        const hostConfig = asObject(entry.hostConfig || info.HostConfig);
        const ports = (
            Array.isArray(entry.ports)
                ? entry.ports
                : (Array.isArray(info.Ports) ? info.Ports : [])
        ).map(normalizePort);
        const templatePorts = (
            Array.isArray(entry.templatePorts) ? entry.templatePorts : []
        ).map(normalizePort);
        const mounts = (
            Array.isArray(entry.mounts)
                ? entry.mounts
                : (Array.isArray(entry.Mounts) ? entry.Mounts : [])
        ).map(normalizeMount);
        const autoStart = typeof entry.autoStart === 'boolean'
            ? entry.autoStart
            : (typeof runtimeState.Autostart === 'boolean' ? runtimeState.Autostart : false);
        const image = String(entry.image || config.Image || '').trim();
        const normalized = {
            schemaVersion: 1,
            source,
            id,
            shortId,
            names: freezeArray(names),
            name: names[0] || '',
            image,
            imageId: String(entry.imageId || info.Image || '').trim(),
            command: String(entry.command || info.Command || '').trim(),
            created: normalizeInteger(entry.created ?? info.Created),
            state: normalizeContainerState(entry, info, runtimeState),
            status: String(entry.status || runtimeState.Status || '').trim(),
            autoStart,
            autoStartOrder: normalizeInteger(entry.autoStartOrder),
            autoStartWait: normalizeInteger(entry.autoStartWait),
            ports: freezeArray(ports),
            templatePorts: freezeArray(templatePorts),
            lanIpPorts: freezeArray(
                (Array.isArray(entry.lanIpPorts) ? entry.lanIpPorts : [])
                    .map((value) => String(value || '').trim())
                    .filter(Boolean)
            ),
            mounts: freezeArray(mounts),
            labels: deepFreeze(clone(labels, {})),
            hostConfig: Object.freeze({
                networkMode: String(hostConfig.networkMode || hostConfig.NetworkMode || '').trim()
            }),
            networkSettings: deepFreeze(clone(
                asObject(entry.networkSettings || info.NetworkSettings),
                {}
            )),
            templatePath: normalizeOptionalString(entry.templatePath),
            projectUrl: normalizeOptionalString(entry.projectUrl),
            registryUrl: normalizeOptionalString(entry.registryUrl),
            supportUrl: normalizeOptionalString(entry.supportUrl),
            iconUrl: normalizeOptionalString(entry.iconUrl || labels['net.unraid.docker.icon']),
            webUiUrl: normalizeOptionalString(entry.webUiUrl || runtimeState.WebUi || runtimeState.TSWebUi),
            shell: normalizeOptionalString(entry.shell || info.Shell),
            isOrphaned: normalizeBoolean(entry.isOrphaned, false),
            isUpdateAvailable: typeof entry.isUpdateAvailable === 'boolean'
                ? entry.isUpdateAvailable
                : (runtimeState.Updated === false),
            isRebuildReady: typeof entry.isRebuildReady === 'boolean'
                ? entry.isRebuildReady
                : null,
            tailscaleEnabled: normalizeBoolean(entry.tailscaleEnabled, false),
            sizeRootFs: normalizeBigInteger(entry.sizeRootFs),
            sizeRw: normalizeBigInteger(entry.sizeRw),
            sizeLog: normalizeBigInteger(entry.sizeLog)
        };
        return Object.freeze(normalized);
    };

    const identityTokens = (entry = {}) => {
        const normalized = entry?.schemaVersion === 1 ? entry : normalizeContainer(entry);
        const tokens = new Set();
        [normalized.id, normalized.shortId, normalized.name, ...(normalized.names || [])]
            .map(normalizeName)
            .filter(Boolean)
            .forEach((value) => {
                tokens.add(value);
                const unprefixed = value.split(':').pop();
                if (unprefixed) tokens.add(unprefixed);
            });
        return tokens;
    };
    const resolveContainerIdentity = (value, containers = []) => {
        const needle = normalizeName(value);
        if (!needle) return null;
        const exact = containers.filter((entry) => identityTokens(entry).has(needle));
        if (exact.length === 1) return exact[0];
        const suffix = containers.filter((entry) => {
            const id = String(entry?.id || '').split(':').pop() || '';
            return needle.length >= 8 && id.startsWith(needle);
        });
        return suffix.length === 1 ? suffix[0] : null;
    };
    const mergeContainers = (primary = [], fallback = []) => {
        const normalizedPrimary = primary.map((entry) => (
            entry?.schemaVersion === 1 ? entry : normalizeContainer(entry)
        ));
        const merged = normalizedPrimary.slice();
        fallback.forEach((entry) => {
            const normalized = entry?.schemaVersion === 1
                ? entry
                : normalizeContainer(entry, { source: 'fallback' });
            if (!resolveContainerIdentity(normalized.id || normalized.name, merged)) {
                merged.push(normalized);
            }
        });
        return Object.freeze(merged);
    };

    return Object.freeze({
        normalizeName,
        deepFreeze,
        normalizePort,
        normalizeMount,
        normalizeContainer,
        identityTokens,
        resolveContainerIdentity,
        mergeContainers
    });
}));
