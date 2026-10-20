import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createDockerHideEmptyHost } from './docker-hide-empty-host.mjs';
const scriptRoot = 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/';

export const createDockerBadgeHost = async (page, initialBadges = { running: false, stopped: false, updates: false }) => {
    const host = await createDockerHideEmptyHost(page, true);
    if (initialBadges) Object.assign(host.prefs(), { badges: initialBadges, runtimePrefsSchema: 5 });
    host.folders.direct.settings.update_column = true;
    const source = fs.readFileSync(scriptRoot + 'docker.js', 'utf8');
    const end = '})(window, window.jQuery || window.$);';
    assert.equal(source.split(end).length, 2, 'test hooks must stay inside the production Docker closure');
    const hook = `window.fixtureDockerBadges = {
        refresh: syncDockerVisibleFoldersFromRuntimeCache,
        save: async badges => { await dockerPrefsCoordinator.save('docker', { badges }, { currentPrefs: folderTypePrefs, immediate: true }); },
        state: state => {
            Object.values(dockerRuntimeInfoByName).forEach(entry => {
                entry.info.State.Running = state !== 'stopped'; entry.info.State.Paused = state === 'paused';
                entry.running = state !== 'stopped'; entry.state = state;
            });
            syncDockerVisibleFoldersFromRuntimeCache();
        }
    };`;
    await page.route('**/scripts/docker.js*', route => route.fulfill({ contentType: 'text/javascript', body: source.replace(end, hook + end) }));
    return host;
};

export const mountVmBadgeHost = async (page, baseUrl) => {
    await page.goto(`${baseUrl}/vm-lifecycle`, { waitUntil: 'load' });
    await page.addScriptTag({ url: `${baseUrl}/plugin/scripts/runtime.folder-badges.js` });
    const source = fs.readFileSync(scriptRoot + 'vm.js', 'utf8');
    const section = (start, end) => {
        const from = source.indexOf(start), to = source.indexOf(end, from);
        assert.ok(from >= 0 && to > from);
        return source.slice(from, to);
    };
    await page.addScriptTag({ content: `(() => {
        const $ = window.jQuery, folderBadgeApi = window.FolderViewPlusFolderBadges;
        let folderTypePrefs = {};
        const vmRuntimeInfoByName = { fixture: { name: 'fixture', uuid: 'fixture-id', state: 'running' } };
        const translateVmText = (_key, fallback, ...values) => fallback.replace(/\\$(\\d+)/g, (_match, index) => values[Number(index)-1]);
        ${section('const getVmRuntimeStateMeta =', 'const syncVmRuntimeStateSurface =')}
        ${section('const updateVmFolderRuntimeSummary =', 'const syncVmRuntimeRows =')}
        window.fixtureVmBadges = (badges, state) => {
            folderTypePrefs = { badges }; vmRuntimeInfoByName.fixture.state = state;
            updateVmFolderRuntimeSummary('media', { containers: { fixture: {} } });
        };
    })();` });
};
