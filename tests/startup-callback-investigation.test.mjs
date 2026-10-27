import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { combineRulesResponse, requireHostedInvestigation } from '../scripts/diagnose_startup_callbacks.mjs';

test('callback investigation refuses workspace execution without launching a browser', () => {
    for (const env of [{}, { GITHUB_ACTIONS: 'false' }]) assert.throws(() => requireHostedInvestigation(env), /workspace execution is disabled/);
    assert.doesNotThrow(() => requireHostedInvestigation({ GITHUB_ACTIONS: 'true' }));
});

test('paired control preserves engine and consumer bytes and removes exactly their separate tag', () => {
    const transform = combineRulesResponse('engine();', 'consumer();');
    const engine = '<script src="/plugins/folderview.plus/scripts/folderviewplus.rules-engine.js?v=benchmark"></script>';
    const consumer = '<script src="/plugins/folderview.plus/scripts/folderviewplus.utils-rules.js?v=benchmark"></script>';
    assert.equal(transform('/docker', engine + consumer), consumer);
    assert.equal(transform('/plugins/folderview.plus/scripts/folderviewplus.utils-rules.js', ''), 'engine();\n;\nconsumer();');
    assert.throws(() => transform('/docker', consumer), /exactly one/);
    assert.throws(() => transform('/docker', engine + engine + consumer), /exactly one/);
    assert.throws(() => transform('/docker', engine), /rules consumer/);
    const binary = Buffer.from([0, 1, 255]);
    assert.equal(transform('/other.png', binary), binary);
});

test('manual callback profile cannot run qualification, quality, or release evidence', () => {
    const workflow = fs.readFileSync('.github/workflows/ci.yml', 'utf8');
    assert.match(workflow, /detect-changes:\s*\n\s+if: inputs\.profile != 'callback-investigation'/);
    assert.match(workflow, /quality:\s*\n\s+if: always\(\) && inputs\.profile != 'callback-investigation'/);
    const diagnostic = workflow.split('  callback-investigation:')[1].split('  detect-changes:')[0];
    assert.match(diagnostic, /github\.event_name == 'workflow_dispatch'/);
    assert.match(diagnostic, /node scripts\/diagnose_startup_callbacks\.mjs/);
    assert.doesNotMatch(diagnostic, /release_validation|release_prepare|profile=release/);
});
