(function fvplusRuntimeTransportScope(window) {
    'use strict';

    const diagnostics = [];
    const record = (event, details = {}) => {
        diagnostics.push({ event, at: new Date().toISOString(), ...details });
        if (diagnostics.length > 100) diagnostics.splice(0, diagnostics.length - 100);
    };

    const query = async (document, variables = {}, options = {}) => {
        if (typeof window.fetch !== 'function') throw new Error('Fetch is unavailable');
        const endpoint = String(options.endpoint || '/graphql');
        const startedAt = Date.now();
        const response = await window.fetch(endpoint, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
            body: JSON.stringify({ query: String(document || ''), variables: variables || {} }),
            signal: options.signal
        });
        const payload = await response.json().catch(() => ({}));
        record('graphql', { ok: response.ok && !payload.errors?.length, status: response.status, durationMs: Date.now() - startedAt });
        if (!response.ok) throw new Error(`GraphQL HTTP ${response.status}`);
        if (Array.isArray(payload.errors) && payload.errors.length) throw new Error(String(payload.errors[0]?.message || 'GraphQL error'));
        return payload.data || {};
    };

    const subscribe = (options = {}) => {
        const onData = typeof options.onData === 'function' ? options.onData : () => {};
        const onError = typeof options.onError === 'function' ? options.onError : () => {};
        let close = () => {};
        if (options.webSocketUrl && typeof window.WebSocket === 'function') {
            const socket = new window.WebSocket(options.webSocketUrl, 'graphql-transport-ws');
            let acknowledged = false;
            socket.addEventListener('open', () => socket.send(JSON.stringify({ type: 'connection_init', payload: options.connectionParams || {} })));
            socket.addEventListener('message', (event) => {
                try {
                    const message = JSON.parse(event.data);
                    if (message.type === 'connection_ack' && !acknowledged) {
                        acknowledged = true;
                        socket.send(JSON.stringify({ id: 'fvplus-runtime', type: 'subscribe', payload: { query: options.document, variables: options.variables || {} } }));
                    } else if (message.type === 'next') onData(message.payload?.data || message.payload);
                    else if (message.type === 'error') onError(message.payload);
                } catch (error) { onError(error); }
            });
            socket.addEventListener('error', onError);
            close = () => { if (socket.readyState <= 1) socket.close(1000, 'FolderView Plus closed'); };
            record('subscription-open', { transport: 'websocket' });
        } else if (options.sseUrl && typeof window.EventSource === 'function') {
            const source = new window.EventSource(options.sseUrl, { withCredentials: true });
            source.onmessage = (event) => {
                try { onData(JSON.parse(event.data)); } catch (_error) { onData(event.data); }
            };
            source.onerror = onError;
            close = () => source.close();
            record('subscription-open', { transport: 'sse' });
        } else if (typeof options.poll === 'function') {
            let closed = false;
            const interval = Math.max(1000, Number(options.pollIntervalMs) || 5000);
            const tick = async () => {
                if (closed) return;
                try { onData(await options.poll()); } catch (error) { onError(error); }
            };
            tick();
            const timer = window.setInterval(tick, interval);
            close = () => { closed = true; window.clearInterval(timer); };
            record('subscription-open', { transport: 'poll' });
        } else {
            record('subscription-skipped', { reason: 'no-compatible-adapter' });
        }
        return () => { close(); record('subscription-close'); };
    };

    const runDockerAction = (request = {}, options = {}) => {
        const action = String(request.action || '').trim();
        const container = String(request.container || '').trim();
        if (!action || !container) return Promise.reject(new Error('Docker action and container are required'));
        if (typeof options.graphqlMutation === 'string' && options.graphqlMutation.trim()) {
            return query(options.graphqlMutation, { action, container }, options).then((data) => ({ transport: 'graphql', data }));
        }
        if (typeof window.eventControl === 'function') {
            window.eventControl({ action, container }, options.refreshTarget || 'loadlist');
            record('docker-action', { transport: 'host-event-control', action });
            return Promise.resolve({ transport: 'host-event-control' });
        }
        return Promise.reject(new Error('No compatible Docker action transport is available'));
    };

    const capabilities = () => Object.freeze({
        graphql: typeof window.fetch === 'function',
        websocket: typeof window.WebSocket === 'function',
        sse: typeof window.EventSource === 'function',
        hostEventControl: typeof window.eventControl === 'function'
    });

    window.FolderViewPlusRuntimeTransport = Object.freeze({ query, subscribe, runDockerAction, capabilities, diagnostics: () => diagnostics.slice() });
})(window);
