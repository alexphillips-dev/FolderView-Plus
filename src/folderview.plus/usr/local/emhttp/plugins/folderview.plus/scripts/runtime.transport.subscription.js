// @ts-check
(function runtimeTransportSubscriptionModule(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    const modules = root.FolderViewPlusFoundationModules || {};
    modules.transportSubscription = factory();
    root.FolderViewPlusFoundationModules = modules;
}(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function runtimeTransportSubscriptionFactory() {
    'use strict';

    const createRuntime = (deps = {}) => {
        const fallbackWindow = deps.fallbackWindow || {};
        const GRAPHQL_ENDPOINT = String(deps.graphqlEndpoint || '/graphql');
        const RuntimeTransportError = deps.RuntimeTransportError;
        const csrfToken = typeof deps.csrfToken === 'function' ? deps.csrfToken : (() => '');
        const record = typeof deps.record === 'function' ? deps.record : (() => {});
        if (typeof RuntimeTransportError !== 'function') {
            throw new Error('FolderView Plus subscription error contract is unavailable.');
        }
        const resolveWebSocketUrl = (options = {}, win = fallbackWindow) => {
            if (options.webSocketUrl) return String(options.webSocketUrl);
            if (options.autoWebSocket !== true || !win?.location?.href) return '';
            try {
                const url = new URL(String(options.endpoint || GRAPHQL_ENDPOINT), win.location.href);
                url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
                return url.toString();
            } catch (_error) {
                return '';
            }
        };
        const subscribe = (options = {}) => {
            const win = options.window || fallbackWindow;
            const onData = typeof options.onData === 'function' ? options.onData : () => {};
            const onError = typeof options.onError === 'function' ? options.onError : () => {};
            const onStatus = typeof options.onStatus === 'function' ? options.onStatus : () => {};
            const requestedMaxReconnects = Number(options.maxReconnects);
            const maxReconnects = Math.max(
                0,
                Math.min(10, Number.isFinite(requestedMaxReconnects) ? requestedMaxReconnects : 4)
            );
            const webSocketUrl = resolveWebSocketUrl(options, win);
            const subscriptionId = String(options.subscriptionId || 'fvplus-runtime');
            let disposed = false;
            let socket = null;
            let socketAckTimer = null;
            let eventSource = null;
            let reconnectTimer = null;
            let reconnectCount = 0;
            let pollTimer = null;
            let pollActive = false;
            let transport = 'none';
            let status = 'idle';

            const setStatus = (nextStatus, details = {}) => {
                status = nextStatus;
                onStatus({ status, transport, reconnectCount, ...details });
            };
            const scheduleReconnect = () => {
                if (disposed || reconnectCount >= maxReconnects) {
                    setStatus(disposed ? 'closed' : 'failed');
                    return;
                }
                const delayMs = Math.min(30000, Math.max(250, Number(options.reconnectBaseMs) || 500) * (2 ** reconnectCount));
                reconnectCount += 1;
                setStatus('reconnecting', { delayMs });
                reconnectTimer = win.setTimeout(openWebSocket, delayMs);
            };
            const openWebSocket = () => {
                if (disposed || !webSocketUrl || typeof win?.WebSocket !== 'function') return;
                transport = 'websocket';
                setStatus(reconnectCount > 0 ? 'reconnecting' : 'connecting');
                try {
                    socket = new win.WebSocket(webSocketUrl, 'graphql-transport-ws');
                } catch (_error) {
                    onError(new RuntimeTransportError('The GraphQL subscription could not be opened.', {
                        category: 'subscription-open-failed',
                        retryable: true
                    }));
                    scheduleReconnect();
                    return;
                }
                socket.addEventListener('open', () => {
                    const params = { ...(options.connectionParams || {}) };
                    const token = String(options.csrfToken || csrfToken(win)).trim();
                    if (token) params['x-csrf-token'] = token;
                    socket.send(JSON.stringify({ type: 'connection_init', payload: params }));
                    setStatus('authenticating');
                    socketAckTimer = win.setTimeout(() => {
                        socketAckTimer = null;
                        if (socket?.readyState <= 1 && status === 'authenticating') {
                            socket.close(4408, 'GraphQL connection acknowledgement timed out');
                        }
                    }, Math.max(1000, Number(options.connectionAckTimeoutMs) || 6000));
                });
                socket.addEventListener('message', (event) => {
                    try {
                        const message = JSON.parse(event.data);
                        if (message.type === 'connection_ack') {
                            if (socketAckTimer !== null) win.clearTimeout(socketAckTimer);
                            socketAckTimer = null;
                            reconnectCount = 0;
                            socket.send(JSON.stringify({
                                id: subscriptionId,
                                type: 'subscribe',
                                payload: {
                                    query: String(options.document || ''),
                                    variables: options.variables || {}
                                }
                            }));
                            setStatus('active');
                        } else if (message.type === 'next') {
                            onData(message.payload?.data || message.payload);
                        } else if (message.type === 'error') {
                            onError(new RuntimeTransportError('The GraphQL subscription reported an error.', {
                                category: 'subscription-error',
                                retryable: false
                            }));
                        } else if (message.type === 'complete') {
                            setStatus('complete');
                        } else if (message.type === 'ping') {
                            socket.send(JSON.stringify({ type: 'pong', payload: message.payload }));
                        }
                    } catch (_error) {
                        onError(new RuntimeTransportError('The GraphQL subscription returned invalid data.', {
                            category: 'invalid-subscription-response',
                            retryable: true
                        }));
                    }
                });
                socket.addEventListener('error', () => {
                    onError(new RuntimeTransportError('The GraphQL subscription connection failed.', {
                        category: 'subscription-offline',
                        retryable: true
                    }));
                });
                socket.addEventListener('close', (event) => {
                    if (socketAckTimer !== null) win.clearTimeout(socketAckTimer);
                    socketAckTimer = null;
                    socket = null;
                    if (disposed || event?.code === 1000) {
                        setStatus('closed');
                        return;
                    }
                    scheduleReconnect();
                });
                record('subscription-open', { transport });
            };
            const startEventSource = () => {
                transport = 'sse';
                setStatus('connecting');
                eventSource = new win.EventSource(String(options.sseUrl), { withCredentials: true });
                eventSource.onopen = () => setStatus('active');
                eventSource.onmessage = (event) => {
                    try {
                        onData(JSON.parse(event.data));
                    } catch (_error) {
                        onData(event.data);
                    }
                };
                eventSource.onerror = () => {
                    onError(new RuntimeTransportError('The event stream connection failed.', {
                        category: 'subscription-offline',
                        retryable: true
                    }));
                    setStatus('degraded');
                };
                record('subscription-open', { transport });
            };
            const startPoll = () => {
                transport = 'poll';
                const interval = Math.max(1000, Number(options.pollIntervalMs) || 5000);
                const tick = async () => {
                    if (disposed || pollActive) return;
                    pollActive = true;
                    try {
                        const data = await options.poll();
                        if (disposed) return;
                        onData(data);
                        setStatus('active');
                    } catch (_error) {
                        if (disposed) return;
                        onError(new RuntimeTransportError('The Docker polling request failed.', {
                            category: 'poll-failed',
                            retryable: true
                        }));
                        setStatus('degraded');
                    } finally {
                        pollActive = false;
                    }
                };
                setStatus('connecting');
                tick();
                pollTimer = win.setInterval(tick, interval);
                record('subscription-open', { transport });
            };

            if (webSocketUrl && typeof win?.WebSocket === 'function') openWebSocket();
            else if (options.sseUrl && typeof win?.EventSource === 'function') startEventSource();
            else if (typeof options.poll === 'function') startPoll();
            else {
                setStatus('unavailable');
                record('subscription-skipped', { reason: 'no-compatible-adapter' });
            }
            const dispose = () => {
                if (disposed) return;
                disposed = true;
                if (reconnectTimer !== null) win.clearTimeout(reconnectTimer);
                if (pollTimer !== null) win.clearInterval(pollTimer);
                if (socketAckTimer !== null) win.clearTimeout(socketAckTimer);
                eventSource?.close?.();
                eventSource = null;
                if (socket?.readyState === 1) {
                    try {
                        socket.send(JSON.stringify({ id: subscriptionId, type: 'complete' }));
                    } catch (_error) {
                        // The socket is closing; completion is best effort.
                    }
                }
                if (socket?.readyState <= 1) socket.close(1000, 'FolderView Plus closed');
                socket = null;
                setStatus('closed');
                record('subscription-close', { transport });
            };
            options.signal?.addEventListener?.('abort', dispose, { once: true });
            dispose.snapshot = () => ({
                transport,
                status,
                reconnectCount,
                disposed
            });
            return dispose;
        };

        return Object.freeze({ resolveWebSocketUrl, subscribe });
    };

    return Object.freeze({ createRuntime });
}));
