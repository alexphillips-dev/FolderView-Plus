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
    new vm.Script(`
${smartDetectSnippet}
globalThis.__smartDetect = {
    normalizeSetupAssistantMatchText,
    collectSetupAssistantItemMatchProfile,
    scoreSetupAssistantTemplateMatch,
    buildSetupAssistantTemplateAssignmentPreview
};
`).runInContext(context);
    return context.__smartDetect;
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
