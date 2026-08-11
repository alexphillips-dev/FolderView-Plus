// @ts-check
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    const modules = root.FolderViewPlusFoundationModules || {};
    modules.folderEditorRegexSelection = factory();
    root.FolderViewPlusFoundationModules = modules;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    'use strict';

    const createApi = (deps = {}) => {
        const runtimeWindow = deps.window || (typeof globalThis !== 'undefined' ? globalThis : null);
        const getRegexField = typeof deps.getRegexField === 'function' ? deps.getRegexField : (() => null);
        const getFolderName = typeof deps.getFolderName === 'function' ? deps.getFolderName : (() => '');
        const getMemberCollections = typeof deps.getMemberCollections === 'function'
            ? deps.getMemberCollections
            : (() => ({ selected: [], choose: [], selectedRegex: [] }));
        const setMemberCollections = typeof deps.setMemberCollections === 'function' ? deps.setMemberCollections : (() => {});
        const syncMemberArraysFromTable = typeof deps.syncMemberArraysFromTable === 'function' ? deps.syncMemberArraysFromTable : (() => {});
        const updateList = typeof deps.updateList === 'function' ? deps.updateList : (() => {});
        const updateRegexSimulator = typeof deps.updateRegexSimulator === 'function' ? deps.updateRegexSimulator : (() => {});
        const isFormInitialized = typeof deps.isFormInitialized === 'function' ? deps.isFormInitialized : (() => false);
        const workerMinItems = Math.max(1, Number(deps.workerMinItems) || 180);
        const debounceMs = Math.max(0, Number(deps.debounceMs) || 120);
        const setTimer = typeof runtimeWindow?.setTimeout === 'function'
            ? runtimeWindow.setTimeout.bind(runtimeWindow)
            : setTimeout;
        const clearTimer = typeof runtimeWindow?.clearTimeout === 'function'
            ? runtimeWindow.clearTimeout.bind(runtimeWindow)
            : clearTimeout;

        let regexInputSyncTimer = null;
        let regexWorker = null;
        let regexWorkerRequestId = 0;
        let latestRegexEvaluationRequestId = 0;
        const pendingRegexWorkerJobs = new Map();

        const runSynchronousMatch = (pattern, names) => {
            const regex = new RegExp(pattern);
            const matches = [];
            for (const name of names) {
                if (!name) {
                    continue;
                }
                if (regex.test(name)) {
                    matches.push(name);
                }
                regex.lastIndex = 0;
            }
            return matches;
        };

        const releaseWorker = () => {
            if (regexWorker) {
                try {
                    regexWorker.terminate();
                } catch (_error) {
                    // no-op
                }
            }
            regexWorker = null;
        };

        const settlePendingWorkerJobs = (error = null) => {
            const pendingEntries = Array.from(pendingRegexWorkerJobs.values());
            pendingRegexWorkerJobs.clear();
            pendingEntries.forEach((entry) => {
                if (error) {
                    entry.reject(error);
                    return;
                }
                entry.resolve([]);
            });
        };

        const getRegexWorker = () => {
            if (regexWorker) {
                return regexWorker;
            }
            const WorkerConstructor = runtimeWindow?.Worker;
            const BlobConstructor = runtimeWindow?.Blob;
            const urlApi = runtimeWindow?.URL;
            if (typeof WorkerConstructor !== 'function' || typeof BlobConstructor !== 'function'
                || !urlApi || typeof urlApi.createObjectURL !== 'function') {
                return null;
            }
            try {
                const source = 'self.onmessage=function(e){var p=e&&e.data?e.data:{},id=+p.id||0,pt=String(p.pattern||""),n=Array.isArray(p.names)?p.names:[],r;try{r=new RegExp(pt)}catch(err){self.postMessage({id:id,error:String(err&&err.message?err.message:"Invalid regex")});return}var m=[];for(var i=0;i<n.length;i++){var s=String(n[i]||"");if(!s)continue;if(r.test(s))m.push(s);r.lastIndex=0}self.postMessage({id:id,matches:m})};';
                const blob = new BlobConstructor([source], { type: 'application/javascript' });
                const url = urlApi.createObjectURL(blob);
                regexWorker = new WorkerConstructor(url);
                if (typeof urlApi.revokeObjectURL === 'function') {
                    urlApi.revokeObjectURL(url);
                }
                regexWorker.onmessage = (event) => {
                    const data = event?.data || {};
                    const id = Number(data.id || 0);
                    const pending = pendingRegexWorkerJobs.get(id);
                    if (!pending) {
                        return;
                    }
                    pendingRegexWorkerJobs.delete(id);
                    if (data.error) {
                        pending.reject(new Error(String(data.error)));
                        return;
                    }
                    pending.resolve(Array.isArray(data.matches) ? data.matches : []);
                };
                regexWorker.onerror = () => {
                    settlePendingWorkerJobs(new Error('Regex worker failed.'));
                    releaseWorker();
                };
                return regexWorker;
            } catch (_error) {
                releaseWorker();
                return null;
            }
        };

        const runRegexMatch = async (pattern, names) => {
            const safePattern = String(pattern || '');
            const safeNames = Array.isArray(names) ? names.map((name) => String(name || '')) : [];
            if (!safePattern || safeNames.length < workerMinItems) {
                return runSynchronousMatch(safePattern, safeNames);
            }
            const worker = getRegexWorker();
            if (!worker) {
                return runSynchronousMatch(safePattern, safeNames);
            }
            const requestId = ++regexWorkerRequestId;
            const job = new Promise((resolve, reject) => {
                pendingRegexWorkerJobs.set(requestId, { resolve, reject });
            });
            worker.postMessage({ id: requestId, pattern: safePattern, names: safeNames });
            return job;
        };

        const mergeMembersByName = (baseMembers, candidateMembers) => {
            const map = new Map();
            const ordered = [];
            for (const member of [...(Array.isArray(baseMembers) ? baseMembers : []), ...(Array.isArray(candidateMembers) ? candidateMembers : [])]) {
                const key = String(member?.Name || '').trim();
                if (!key || map.has(key)) {
                    continue;
                }
                map.set(key, member);
                ordered.push(member);
            }
            return ordered;
        };

        const commitRegexCollections = (choose, selectedRegex) => {
            const current = getMemberCollections() || {};
            setMemberCollections({
                selected: Array.isArray(current.selected) ? current.selected : [],
                choose: Array.isArray(choose) ? choose : [],
                selectedRegex: Array.isArray(selectedRegex) ? selectedRegex : []
            });
        };

        const evaluateRegexSelection = (field = null) => {
            regexInputSyncTimer = null;
            const regexField = field || getRegexField();
            if (!regexField) {
                return false;
            }
            const requestId = ++latestRegexEvaluationRequestId;
            syncMemberArraysFromTable();
            const collections = getMemberCollections() || {};
            let choose = (Array.isArray(collections.choose) ? collections.choose : [])
                .concat(Array.isArray(collections.selectedRegex) ? collections.selectedRegex : []);
            let selectedRegex = [];
            const folderName = String(getFolderName() || '').trim();
            if (folderName) {
                selectedRegex = choose.filter((member) => member?.Label === folderName);
                choose = choose.filter((member) => member?.Label !== folderName);
            }
            commitRegexCollections(choose, selectedRegex);

            const regexSource = String(regexField.value || '').trim();
            if (!regexSource) {
                updateList();
                updateRegexSimulator();
                return true;
            }
            try {
                new RegExp(regexSource);
            } catch (_error) {
                updateList();
                return false;
            }

            const baseChoose = choose.slice();
            const applyMatchResult = (matchNames) => {
                if (requestId !== latestRegexEvaluationRequestId) {
                    return;
                }
                const matched = new Set(Array.isArray(matchNames) ? matchNames : []);
                const regexMatches = [];
                const nextChoose = [];
                baseChoose.forEach((member) => {
                    if (matched.has(String(member?.Name || ''))) {
                        regexMatches.push(member);
                    } else {
                        nextChoose.push(member);
                    }
                });
                commitRegexCollections(nextChoose, mergeMembersByName(selectedRegex, regexMatches));
                updateList();
                updateRegexSimulator();
            };

            if (baseChoose.length < workerMinItems) {
                applyMatchResult(runSynchronousMatch(regexSource, baseChoose.map((member) => member?.Name)));
                return true;
            }

            runRegexMatch(regexSource, baseChoose.map((member) => member?.Name))
                .then(applyMatchResult)
                .catch(() => {
                    if (requestId !== latestRegexEvaluationRequestId) {
                        return;
                    }
                    applyMatchResult(runSynchronousMatch(regexSource, baseChoose.map((member) => member?.Name)));
                });
            updateRegexSimulator();
            return true;
        };

        const updateRegex = (field, options = {}) => {
            const immediate = options && typeof options === 'object' && options.immediate === true;
            if (regexInputSyncTimer) {
                clearTimer(regexInputSyncTimer);
                regexInputSyncTimer = null;
            }
            latestRegexEvaluationRequestId += 1;
            if (immediate || !isFormInitialized()) {
                return evaluateRegexSelection(field);
            }
            regexInputSyncTimer = setTimer(() => evaluateRegexSelection(field), debounceMs);
            return true;
        };

        const snapshot = () => Object.freeze({
            workerActive: Boolean(regexWorker),
            pendingWorkerJobs: pendingRegexWorkerJobs.size,
            evaluationRevision: latestRegexEvaluationRequestId,
            debouncePending: Boolean(regexInputSyncTimer)
        });

        const dispose = () => {
            latestRegexEvaluationRequestId += 1;
            if (regexInputSyncTimer) {
                clearTimer(regexInputSyncTimer);
                regexInputSyncTimer = null;
            }
            settlePendingWorkerJobs();
            releaseWorker();
        };

        return Object.freeze({
            evaluateRegexSelection,
            updateRegex,
            runRegexMatch,
            snapshot,
            dispose
        });
    };

    return Object.freeze({ createApi });
}));
