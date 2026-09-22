import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

const prefix = '/plugins/folderview.plus/';
const meta = (name, value) => `<meta name="${name}" content='${JSON.stringify(value).replaceAll("'", '&#39;')}'>`;
const script = file => `<script src="${file}?v=benchmark"></script>`;
export const createProductionPerfFixture = (rootDir, scenario, locale = 'en') => {
    const plugin = path.join(rootDir, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus');
    const read = file => fs.readFileSync(path.join(plugin, file), 'utf8');
    const folders = {}, runtime = {}, names = [];
    for (let i = 0; i < scenario.members; i++) {
        const name = `fixture-app-${i}`; names.push(name);
        runtime[name] = { id: (i + 1).toString(16).padStart(12, '0').padEnd(64, '0'), Name: name, name,
            State: { Running: i % 3 !== 0, Paused: false }, state: i % 3 ? 'started' : 'stopped',
            running: i % 3 !== 0, icon: prefix + 'images/folder-icon.png', autostart: false,
            info: { Name: '/' + name, State: { Running: i % 3 !== 0 }, Config: { Labels: {} }, HostConfig: {} } };
    }
    for (let i = 0; i < scenario.folders; i++) folders[`fixture-folder-${i}`] = {
        name: `Fixture folder ${i}`, icon: prefix + 'images/folder-icon.png',
        containers: names.filter((_name, index) => index % scenario.folders === i),
        settings: { preview: 1, preview_hover: false, expand_tab: false }, actions: []
    };
    const prefs = { performanceProfile: 'standard', lazyPreviewEnabled: false, setupWizardCompleted: true, autoRules: [] };
    const snapshot = type => ({ ok: true, kind: 'runtime_snapshot', schemaVersion: 1, type,
        folders: type === 'docker' ? folders : {}, runtime: type === 'docker' ? runtime : {},
        order: type === 'docker' ? Object.keys(folders).map(id => 'folder-' + id).concat(names) : [],
        prefs, metadata: {}, revision: 'a'.repeat(64) });
    const scriptsFrom = source => [...source.matchAll(/<script[^>]*src="[^"\n]*?fvplus_asset\('([^']+)'\)[^"\n]*"[^>]*><\/script>/g)].map(m => m[1]);
    const settingsSource = read('FolderViewPlus.page');
    const stage = name => [...settingsSource.split(`$fvplusSettings${name}Assets = [`)[1].split('];')[0].matchAll(/'([^']+\.js)'/g)].map(m => m[1] + '?v=benchmark');
    const manifest = { foundation: stage('Foundation'), workspace: stage('Workspace'), moduleTimeoutMs: 12000 };
    const catalogs = surface => {
        const namespaces = ['common', 'legacy-surface', ...(surface === 'settings' ? ['settings', 'wizard', 'import', 'diagnostics'] : ['docker', 'diagnostics'])];
        return { requestedLocale: locale, resolvedLocale: locale, direction: locale === 'ar' ? 'rtl' : 'ltr',
            namespaces, assets: [...new Set(['en', locale])].flatMap(lang => [
                { locale: lang, namespace: 'legacy', url: prefix + `langs/${lang}.json?v=benchmark` },
                ...namespaces.map(namespace => ({ locale: lang, namespace, url: prefix + `langs/namespaces/${lang}/${namespace}.json?v=benchmark` }))
            ]) };
    };
    const nativeRows = names.map((name, index) => `<tr class="sortable" id="ct-${runtime[name].id.slice(0, 12)}" data-name="${name}"><td class="ct-name"><span class="outer"><img class="img" src="${prefix}images/folder-icon.png"><span class="inner"><span class="appname"><a>${name}</a></span><br><i id="load-${index}" class="fa fa-play started"></i><span class="state">started</span></span></span></td><td class="updatecolumn">up-to-date</td><td>bridge</td><td></td><td></td><td></td><td><input type="checkbox"></td><td></td></tr>`).join('');
    const host = `<div class="canvas"><table id="docker_containers"><thead><tr>${['Application','Version','Network','IP','Port','LAN','Autostart','Uptime'].map(t=>`<th>${t}</th>`).join('')}</tr></thead><tbody id="docker_list">${nativeRows}</tbody></table></div>`;
    const page = surface => {
        let source = surface === 'settings' ? settingsSource : read('folderview.plus.Docker.page');
        source = source.slice(source.indexOf('---') + 3).replace(/<\?(?:php|=)[\s\S]*?\?>/g, php => {
            const asset = php.match(/fvplus_asset\('([^']+)'\)/);
            return asset ? asset[1] + '?v=benchmark' : '';
        });
        const localization = scriptsFrom(read('langs/script.php')).map(script).join('');
        return '<!doctype html><html><head><meta charset="utf-8"><meta name="fv-request-token" content="fixture-request-token-1234567890">'
            + meta('fvplus-i18n-config', catalogs(surface)) + meta('fvplus-page-i18n', { mode: surface })
            + meta('fvplus-runtime-context', { page: surface === 'settings' ? 'Settings' : 'Docker', pluginVersion: 'benchmark', unraidVersion: '7.2.0' })
            + meta('fvplus-settings-loader-manifest', manifest) + meta('fvplus-docker-bootstrap', { runtimeAssetUrl: prefix + 'scripts/docker.js?v=benchmark' })
            + '<style>body{font:14px Arial;background:#1d1d1f;color:#eee;margin:16px}table{width:100%}.img{width:32px}td{padding:4px}</style></head><body>'
            + (surface === 'docker' ? host : '') + script('/vendor/jquery.js') + script('/fixture-host.js')
            + localization + (surface === 'docker' ? ['runtime.image-fallbacks','folderviewplus.csp-events','folderviewplus.safe-dom'].map(f=>script(prefix+'scripts/'+f+'.js')).join('') : '')
            + source + '</body></html>';
    };
    const requests = [];
    const server = http.createServer(async (req, res) => {
        const url = new URL(req.url, 'http://127.0.0.1');
        requests.push({ path: url.pathname, method: req.method });
        const send = (body, type = 'application/json', cache = false) => {
            res.writeHead(200, { 'Content-Type': type, 'Cache-Control': cache ? 'public, max-age=3600' : 'no-store',
                'Content-Security-Policy': "connect-src 'self'; img-src 'self' data:; frame-src 'none'; form-action 'none'" });
            res.end(type === 'application/json' ? JSON.stringify(body) : body);
        };
        if (url.pathname === '/settings' || url.pathname === '/docker') return send(page(url.pathname.slice(1)), 'text/html');
        if (url.pathname === '/graphql') return send({ errors: [{ message: 'Synthetic legacy host has no GraphQL service.' }] });
        if (url.pathname === '/fixture-host.js') return send(fs.readFileSync(path.join(rootDir, 'tests/browser/fixtures/production-performance-host.js')), 'text/javascript', true);
        if (url.pathname === '/vendor/jquery.js') return send(fs.readFileSync(path.join(rootDir, 'node_modules/jquery/dist/jquery.js')), 'text/javascript', true);
        if (url.pathname.startsWith(prefix + 'server/')) {
            const endpoint = path.basename(url.pathname), type = url.searchParams.get('type') || 'docker';
            if (endpoint === 'runtime_snapshot.php') return send(type === 'all'
                ? { ok: true, kind: 'runtime_config_bootstrap', schemaVersion: 1, snapshots: { docker: snapshot('docker'), vm: snapshot('vm') } } : snapshot(type));
            if (endpoint === 'read.php') return send(snapshot(type).folders);
            if (endpoint === 'read_info.php') return send(snapshot(type).runtime);
            if (endpoint === 'read_order.php') return send(snapshot(type).order);
            if (endpoint === 'prefs.php') return send({ ok: true, prefs, metadata: {} });
            if (endpoint === 'version.php') return send('benchmark', 'text/plain');
            if (endpoint === 'cpu.php') return send('8', 'text/plain');
            if (endpoint === 'update_check.php') return send({ ok: true, updateAvailable: false, currentVersion: 'benchmark' });
            if (endpoint === 'update_notes.php') return send({ version: 'benchmark', sourceVersion: 'benchmark', usedFallback: false,
                category: 'bugfix', categoryLabel: 'Bug Fix Update', categoryTags: [], headline: '', lines: [] });
            if (endpoint === 'theme_workspace.php') return send({ ok: true, themes: [], settings: {}, activeThemeId: '' });
            if (endpoint === 'security.php') return send({ ok: true, nonce: 'a'.repeat(64) });
        }
        if (url.pathname.startsWith(prefix)) {
            const file = path.resolve(plugin, url.pathname.slice(prefix.length));
            if (file.startsWith(plugin + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile()) {
                const types = { '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png' };
                const type = types[path.extname(file)];
                if (type) {
                    const bytes = fs.readFileSync(file); return send(type === 'application/json' ? JSON.parse(bytes) : bytes, type, true);
                }
            }
        }
        res.writeHead(404); res.end('Unmodeled fixture request');
    });
    return { server, requests, manifest, folders, names };
};
