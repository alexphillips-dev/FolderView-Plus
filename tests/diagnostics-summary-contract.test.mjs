import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const libDiagnosticsPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.diagnostics.php'
);

const phpSingleQuote = (value) => `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

const buildSummaryHarnessPhp = ({ typesData, customIcons = {}, update = {} }) => `<?php
const FVPLUS_DIAGNOSTICS_DEFAULT_PRIVACY = 'sanitized';
const FVPLUS_DIAGNOSTICS_HISTORY_MAX = 80;
const FVPLUS_DIAGNOSTICS_SCHEMA_VERSION = 7;
const FVPLUS_API_ERROR_LOG = '';

require_once ${phpSingleQuote(libDiagnosticsPath)};

$typesData = json_decode(<<<'JSON'
${JSON.stringify(typesData)}
JSON, true);

$customIcons = json_decode(<<<'JSON'
${JSON.stringify(customIcons)}
JSON, true);

$update = json_decode(<<<'JSON'
${JSON.stringify(update)}
JSON, true);

echo json_encode(diagnosticsBuildOverviewSummary($typesData, $customIcons, $update), JSON_UNESCAPED_SLASHES);
`;

const runOverviewSummary = ({ typesData, customIcons = {}, update = {} }) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-diagnostics-summary-'));
    const harnessPath = path.join(tempDir, 'summary.php');
    fs.writeFileSync(harnessPath, buildSummaryHarnessPhp({ typesData, customIcons, update }), 'utf8');
    try {
        return JSON.parse(execFileSync('php', [harnessPath], {
            cwd: repoRoot,
            encoding: 'utf8',
            timeout: 120000
        }));
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
};

const buildIntegrityChecks = (overrides = {}) => ({
    issuesCount: 0,
    duplicateFolderNames: { count: 0, examples: [] },
    orphanedMembers: { count: 0, folders: [] },
    invalidFolderRegex: { count: 0, folderIds: [] },
    invalidFolderIconPaths: { count: 0, folderIds: [] },
    invalidAutoRules: { count: 0, rules: [] },
    missingManualOrderIds: { count: 0, ids: [] },
    missingPinnedFolderIds: { count: 0, ids: [] },
    duplicateAssignments: {
        explicit: { count: 0, examples: [] },
        regex: { count: 0, examples: [] },
        effective: { count: 0, examples: [] }
    },
    pathHealth: { issues: [] },
    ...overrides
});

const buildTypesData = (dockerIntegrity, vmIntegrity = buildIntegrityChecks()) => ({
    docker: {
        folderCount: 2,
        ruleCount: 2,
        backupCount: 10,
        integrityChecks: dockerIntegrity
    },
    vm: {
        folderCount: 1,
        ruleCount: 0,
        backupCount: 5,
        integrityChecks: vmIntegrity
    }
});

test('diagnostics summary names orphaned Docker members instead of generic counts', () => {
    const summary = runOverviewSummary({
        typesData: buildTypesData(
            buildIntegrityChecks({
                issuesCount: 1,
                orphanedMembers: {
                    count: 1,
                    folders: [{ folderId: 'docker-root', count: 1, items: ['GitLab Runner'] }]
                }
            })
        ),
        customIcons: { issues: [], orphanedIconCount: 0, fileCount: 0 },
        update: { ok: true, updateAvailable: false, currentVersion: '2026.04.06.00' }
    });

    const dockerCard = summary.cards.find((card) => card.key === 'docker');
    assert.ok(dockerCard, 'docker summary card is missing');
    assert.equal(dockerCard.headline, '1 issue(s) need attention.');
    assert.equal(dockerCard.detail, '1 orphaned member reference found in 1 folder.');
    assert.equal(dockerCard.count, 1);
});

test('diagnostics summary still surfaces concrete path issues first', () => {
    const summary = runOverviewSummary({
        typesData: buildTypesData(
            buildIntegrityChecks({
                issuesCount: 1,
                pathHealth: {
                    issues: ['Missing /boot/config/plugins/folderview.plus/docker.folder.json']
                }
            })
        ),
        customIcons: { issues: [], orphanedIconCount: 0, fileCount: 0 },
        update: { ok: true, updateAvailable: false, currentVersion: '2026.04.06.00' }
    });

    const dockerCard = summary.cards.find((card) => card.key === 'docker');
    assert.ok(dockerCard, 'docker summary card is missing');
    assert.equal(dockerCard.detail, 'Missing /boot/config/plugins/folderview.plus/docker.folder.json');
});
