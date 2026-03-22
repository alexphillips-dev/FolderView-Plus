import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const repoRoot = path.resolve(process.cwd());
const wizardJsPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.wizard.js'
);
const settingsJsPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.js'
);

const wizardJs = fs.readFileSync(wizardJsPath, 'utf8');
const settingsJs = fs.readFileSync(settingsJsPath, 'utf8');

const startMarker = 'const normalizeSetupAssistantMatchText =';
const endMarker = 'const buildSetupAssistantTemplatePlanForType =';
const snippetStart = wizardJs.indexOf(startMarker);
const snippetEnd = wizardJs.indexOf(endMarker);
assert.ok(snippetStart >= 0 && snippetEnd > snippetStart, 'Expected smart-detect helper block in wizard script.');
const smartDetectSnippet = wizardJs.slice(snippetStart, snippetEnd);

const settingsStartMarker = 'const STARTER_TEMPLATE_CATEGORY_META =';
const settingsEndMarker = 'const buildStarterFolderPayload =';
const settingsSnippetStart = settingsJs.indexOf(settingsStartMarker);
const settingsSnippetEnd = settingsJs.indexOf(settingsEndMarker);
assert.ok(settingsSnippetStart >= 0 && settingsSnippetEnd > settingsSnippetStart, 'Expected smart starter selection block in settings script.');
const settingsSmartSnippet = settingsJs.slice(settingsSnippetStart, settingsSnippetEnd);

const loadSmartDetectHelpers = (infoByType) => {
    const context = {
        infoByType,
        normalizeManagedType: (value) => String(value || '').trim().toLowerCase(),
        getBulkAssignableNames: (type) => Object.keys(infoByType[String(type || '').trim().toLowerCase()] || {}),
        utils: {
            getComposeProjectFromLabels(labels = {}) {
                const direct = String(labels['com.docker.compose.project'] || '').trim();
                if (direct) {
                    return direct;
                }
                const workingDir = String(labels['com.docker.compose.project.working_dir'] || '').trim();
                if (workingDir) {
                    const parts = workingDir.split(/[\\/]+/).filter(Boolean);
                    return parts[parts.length - 1] || '';
                }
                const configFiles = String(labels['com.docker.compose.project.config_files'] || '').trim();
                if (configFiles) {
                    const normalized = configFiles.replace(/\\/g, '/');
                    const match = normalized.match(/\/([^/]+)\/docker-compose[^/]*\.ya?ml$/i);
                    if (match) {
                        return match[1];
                    }
                }
                return '';
            }
        },
        Set,
        Object,
        String,
        Number,
        Array,
        JSON
    };
    context.globalThis = context;
    vm.createContext(context);
    new vm.Script([
        smartDetectSnippet,
        'globalThis.__smartDetect = {',
        '    normalizeSetupAssistantMatchText,',
        '    collectSetupAssistantItemMatchProfile,',
        '    scoreSetupAssistantTemplateMatch,',
        '    buildSetupAssistantTemplateAssignmentPreview',
        '};'
    ].join('\n')).runInContext(context);
    return context.__smartDetect;
};

const loadStarterSelectionHelpers = (infoByType) => {
    const context = {
        infoByType,
        normalizeManagedType: (value) => String(value || '').trim().toLowerCase(),
        normalizeStarterTemplateCategory: (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-'),
        Set,
        Object,
        String,
        Number,
        Array,
        JSON
    };
    context.globalThis = context;
    vm.createContext(context);
    new vm.Script([
        settingsSmartSnippet,
        'globalThis.__starterSelection = {',
        '    STARTER_TEMPLATE_BLUEPRINTS,',
        '    resolveStarterTemplateSmartIndexes',
        '};'
    ].join('\n')).runInContext(context);
    return context.__starterSelection;
};

test('wizard smart detect uses compose metadata and template metadata for docker assignment', () => {
    const infoByType = {
        docker: {
            'tdarr-node': {
                Labels: {
                    'com.docker.compose.project.working_dir': '/mnt/user/appdata/media'
                },
                info: {
                    Config: {
                        Image: 'ghcr.io/haveagitgat/tdarr_node:latest'
                    }
                }
            },
            overseerr: {
                info: {
                    Config: {
                        Image: 'sctx/overseerr:latest'
                    },
                    Project: 'https://github.com/sct/overseerr'
                }
            },
            'photos-app': {
                info: {
                    Config: {
                        Image: 'ghcr.io/custom/stack-base:latest'
                    },
                    template: {
                        path: '/boot/config/plugins/dockerMan/templates-user/immich-server.xml'
                    }
                }
            },
            'adguard-home': {
                info: {
                    Config: {
                        Image: 'adguard/adguardhome:latest'
                    }
                }
            }
        }
    };
    const runtime = loadSmartDetectHelpers(infoByType);
    const preview = runtime.buildSetupAssistantTemplateAssignmentPreview('docker', [
        { name: 'Media', detect: ['plex', 'overseerr', 'immich', 'tdarr'] },
        { name: 'Network', detect: ['pihole', 'adguardhome', 'dns'] }
    ]);

    assert.equal(preview.matched, 4);
    assert.equal(preview.unmatched, 0);
    assert.deepEqual(Array.from(preview.assignedByTemplate.Media || []).sort(), ['overseerr', 'photos-app', 'tdarr-node']);
    assert.deepEqual(Array.from(preview.assignedByTemplate.Network || []), ['adguard-home']);
});

test('starter template blueprints include broader docker smart-detect coverage for common stacks', () => {
    const mediaBlock = (settingsJs.match(/name:\s*'Media'[\s\S]*?detect:\s*Object\.freeze\(\[[\s\S]*?\]\)/) || [''])[0];
    const downloadsBlock = (settingsJs.match(/name:\s*'Downloads'[\s\S]*?detect:\s*Object\.freeze\(\[[\s\S]*?\]\)/) || [''])[0];
    const monitoringBlock = (settingsJs.match(/name:\s*'Monitoring'[\s\S]*?detect:\s*Object\.freeze\(\[[\s\S]*?\]\)/) || [''])[0];
    const networkBlock = (settingsJs.match(/name:\s*'Network'[\s\S]*?detect:\s*Object\.freeze\(\[[\s\S]*?\]\)/) || [''])[0];

    assert.ok(mediaBlock.includes("'overseerr'") && mediaBlock.includes("'immich'") && mediaBlock.includes("'tdarr'"));
    assert.ok(downloadsBlock.includes("'nzbget'") && downloadsBlock.includes("'cross-seed'") && downloadsBlock.includes("'slskd'"));
    assert.ok(monitoringBlock.includes("'beszel'") && monitoringBlock.includes("'scrutiny'") && monitoringBlock.includes("'healthchecks'"));
    assert.ok(networkBlock.includes("'adguardhome'") && networkBlock.includes("'zerotier'") && networkBlock.includes("'cloudflared'"));
});

test('wizard smart detect covers mixed real-world docker families without misses', () => {
    const infoByType = {
        docker: {
            listenarr: {
                info: {
                    Config: { Image: 'ghcr.io/listenarr/listenarr:latest' },
                    HostConfig: { Binds: ['/mnt/user/Plex-Data/Audiobooks:/data'] }
                }
            },
            Cleanuparr: {
                info: {
                    Config: { Image: 'ghcr.io/cleanuparr/cleanuparr:latest' },
                    HostConfig: { Binds: ['/mnt/user/downloads:/downloads'] }
                }
            },
            vm_custom_icons: {
                info: {
                    Config: { Image: 'ghcr.io/custom/vm_custom_icons:latest' }
                }
            },
            'satisfactory-server': {
                info: {
                    Config: { Image: 'wolveix/satisfactory-server:latest' }
                }
            },
            ClamAV: {
                info: {
                    Config: { Image: 'clamav/clamav:latest' }
                }
            },
            DiskSpeed: {
                info: {
                    Config: { Image: 'ghcr.io/dockur/diskspeed:latest' }
                }
            },
            QDirStat: {
                info: {
                    Config: { Image: 'ghcr.io/linuxserver/qdirstat:latest' }
                }
            },
            Seerr: {
                info: {
                    Config: { Image: 'ghcr.io/fallenbagel/jellyseerr:latest' }
                }
            },
            Wizarr: {
                info: {
                    Config: { Image: 'ghcr.io/wizarrrr/wizarr:latest' }
                }
            },
            agregarr: {
                info: {
                    Config: { Image: 'ghcr.io/agregarr/agregarr:latest' }
                }
            },
            SeekAndWatch: {
                info: {
                    Config: { Image: 'ghcr.io/seekandwatch/seekandwatch:latest' }
                }
            },
            'Crafty-4': {
                info: {
                    Config: { Image: 'registry.gitlab.com/crafty-controller/crafty-4:latest' }
                }
            },
            MySpeed: {
                info: {
                    Config: { Image: 'germannewsmaker/myspeed:latest' }
                }
            },
            nextcloud: {
                info: {
                    Config: { Image: 'nextcloud:latest' }
                }
            },
            Notify: {
                info: {
                    Config: { Image: 'ghcr.io/notifiarr/notify:latest' }
                }
            }
        }
    };
    const runtime = loadSmartDetectHelpers(infoByType);
    const preview = runtime.buildSetupAssistantTemplateAssignmentPreview('docker', [
        { name: 'Media', detect: ['overseerr', 'seerr', 'wizarr', 'listenarr', 'cleanuparr', 'agregarr', 'seekandwatch'] },
        { name: 'Security', detect: ['vaultwarden', 'clamav'] },
        { name: 'Utilities', detect: ['qdirstat', 'diskspeed', 'vm_custom_icons'] },
        { name: 'Game Servers', detect: ['crafty', 'satisfactory-server'] },
        { name: 'Monitoring', detect: ['myspeed'] },
        { name: 'Cloud & Sync', detect: ['nextcloud'] },
        { name: 'Notifications', detect: ['notify', 'notifiarr'] }
    ]);

    assert.equal(preview.totalItems, 15);
    assert.equal(preview.unmatched, 0);
    assert.deepEqual(Array.from(preview.assignedByTemplate.Media || []).sort(), ['Cleanuparr', 'SeekAndWatch', 'Seerr', 'Wizarr', 'agregarr', 'listenarr']);
    assert.deepEqual(Array.from(preview.assignedByTemplate.Security || []), ['ClamAV']);
    assert.deepEqual(Array.from(preview.assignedByTemplate.Utilities || []).sort(), ['DiskSpeed', 'QDirStat', 'vm_custom_icons']);
    assert.deepEqual(Array.from(preview.assignedByTemplate['Game Servers'] || []).sort(), ['Crafty-4', 'satisfactory-server']);
    assert.deepEqual(Array.from(preview.assignedByTemplate.Monitoring || []), ['MySpeed']);
    assert.deepEqual(Array.from(preview.assignedByTemplate['Cloud & Sync'] || []), ['nextcloud']);
    assert.deepEqual(Array.from(preview.assignedByTemplate.Notifications || []), ['Notify']);
});

test('smart starter selection surfaces the needed folders for mixed docker workloads', () => {
    const infoByType = {
        docker: {
            listenarr: { info: { Config: { Image: 'ghcr.io/listenarr/listenarr:latest' } } },
            ClamAV: { info: { Config: { Image: 'clamav/clamav:latest' } } },
            'satisfactory-server': { info: { Config: { Image: 'wolveix/satisfactory-server:latest' } } },
            nextcloud: { info: { Config: { Image: 'nextcloud:latest' } } },
            Notify: { info: { Config: { Image: 'ghcr.io/notifiarr/notify:latest' } } },
            QDirStat: { info: { Config: { Image: 'ghcr.io/linuxserver/qdirstat:latest' } } }
        }
    };
    const runtime = loadStarterSelectionHelpers(infoByType);
    const indexes = runtime.resolveStarterTemplateSmartIndexes('docker', runtime.STARTER_TEMPLATE_BLUEPRINTS.docker);
    const names = Array.from(indexes).map((index) => runtime.STARTER_TEMPLATE_BLUEPRINTS.docker[index]?.name).filter(Boolean);

    assert.ok(names.includes('Media'));
    assert.ok(names.includes('Security'));
    assert.ok(names.includes('Game Servers') || names.includes('Gaming'));
    assert.ok(names.includes('Cloud & Sync'));
    assert.ok(names.includes('Notifications'));
    assert.ok(names.includes('Utilities'));
});
