(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(root);
        return;
    }
    const modules = root.FolderViewPlusFoundationModules = root.FolderViewPlusFoundationModules || {};
    modules.runtimeNativeActions = factory(root);
}(typeof window !== 'undefined' ? window : globalThis, function(window) {
    'use strict';

    const validateFolderAction = ({ type, action, modes }) => {
        const supported = type === 1 || (type === 0 && (
            action === 2 || (action === 0 && [0, 1].includes(modes)) || (action === 1 && [0, 1, 2, 3].includes(modes))
        ));
        if (!supported) window.console?.warn?.('folderview.plus: Unsupported custom action configuration.');
        return supported;
    };

    const nativeActionOutcome = (response, transportFailure = false) => {
        if (!transportFailure && response?.success === true) return { accepted: true, reason: '', code: 'accepted' };
        const detail = [response?.error, response?.success, response?.text]
            .find(value => typeof value === 'string' && value.trim() !== '');
        const reason = String(detail || '').replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, 240);
        return { accepted: false, reason, code: transportFailure && !reason ? 'request-failed' : 'refused' };
    };

    const settleNativeActionRequests = (requests, send) => Promise.all(requests.map(async request => {
        try {
            return { ...request, ...nativeActionOutcome(await send(request)) };
        } catch (error) {
            return { ...request, ...nativeActionOutcome(error?.responseJSON, true) };
        }
    }));

    const showNativeActionFailures = (results, { escapeHtml, privacy = false }) => {
        const failures = results.filter(result => !result.accepted);
        if (!failures.length) return;
        const $ = window.$;
        const accepted = results.length - failures.length;
        const summary = window.FolderViewPlusI18n?.t?.('runtime.action.requests-result', '$1 accepted · $2 failed', accepted, failures.length)
            || `${accepted} accepted · ${failures.length} failed`;
        const details = privacy ? [] : failures.map(({ name, reason }) =>
            [name, reason || $.i18n('exec-error')].filter(Boolean).join(' · '));
        window.swal?.({
            title: escapeHtml($.i18n('exec-error')),
            text: [summary, ...details].map(escapeHtml).join('<br>'),
            type: 'error',
            html: true
        });
    };

    const runUserScript = async (action, { openBox }) => {
        const $ = window.$;
        const path = `/boot/config/plugins/user.scripts/scripts/${action.script}/script`;
        const exec = (data) => $.post('/plugins/user.scripts/exec.php', data).promise();
        const validReply = (reply) => typeof reply === 'string' && reply.trim() !== '' && !/^\s*</.test(reply);
        try {
            if (action.script_sync) {
                const variables = await exec({ action: 'getScriptVariables', script: path });
                if (typeof variables !== 'string') throw new Error();
                if (/^directPHP=.+$/m.test(variables)) {
                    const destination = await exec({ action: 'directRunScript', path });
                    if (!validReply(destination)) throw new Error();
                    openBox(destination, action.name, 800, 1200, 'loadlist');
                    return;
                }
            }
            const command = await exec({ action: 'convertScript', path });
            if (!validReply(command)) throw new Error();
            const args = `&arg1=${encodeURIComponent(command)}&arg2=${encodeURIComponent(action.script_args ?? '')}`;
            if (action.script_sync) {
                openBox(`/plugins/user.scripts/startScript.sh${args}`, action.name, 800, 1200, true, 'loadlist');
            } else {
                const csrf = String(window.csrf_token || '');
                if (!csrf) throw new Error();
                await $.get(`/logging.htm?cmd=/plugins/user.scripts/backgroundScript.sh${args}&csrf_token=${encodeURIComponent(csrf)}&done=Done`).promise();
            }
        } catch (_error) {
            // Do not include the launch URL, script arguments, or the native CSRF token in action logs.
            throw new Error(window.FolderViewPlusI18n?.t?.('runtime.action.user-script-failed', 'User Scripts could not launch this action. Check that the plugin and script are available.')
                || 'User Scripts could not launch this action. Check that the plugin and script are available.');
        }
    };

    return Object.freeze({ validateFolderAction, nativeActionOutcome, settleNativeActionRequests, showNativeActionFailures, runUserScript });
}));
