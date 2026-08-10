import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(process.cwd());
const pluginRoot = path.join(root, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus');
const libPath = path.join(pluginRoot, 'server/lib.php');
const generatorPath = path.join(root, 'scripts/generate_runtime_integrity_manifest.mjs');
const phpString = (value) => `'${String(value).replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;

function runPhp(source, env = {}) {
    const result = spawnSync('php', ['-r', source], {
        cwd: root,
        encoding: 'utf8',
        env: { ...process.env, ...env }
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    return JSON.parse(result.stdout);
}

test('mutation nonces are target-bound, single-use, and backed by transaction replay rejection', () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fv-security-nonce-'));
    try {
        const statePath = path.join(temp, 'security-state.json');
        const configDir = path.join(temp, 'config');
        const result = runPhp(`
            require_once(${phpString(libPath)});
            $first=fvplus_issue_mutation_nonce('create.php', '');
            $second=fvplus_issue_mutation_nonce('create.php', '');
            $mismatch=fvplus_issue_mutation_nonce('delete.php', '');
            $results=[];
            fvplus_security_with_state_lock(function(array &$state) use ($first) {
                fvplus_security_consume_nonce($state, $first['nonce'], 'create.php', '', time());
                fvplus_security_consume_transaction($state, 'tx-security-one', 'create.php', '', time());
            });
            try {
                fvplus_security_with_state_lock(function(array &$state) use ($first) {
                    fvplus_security_consume_nonce($state, $first['nonce'], 'create.php', '', time());
                });
                $results['nonceReplay']='accepted';
            } catch (FVPlusSecurityRequestException $error) {
                $results['nonceReplay']=$error->getCode();
            }
            try {
                fvplus_security_with_state_lock(function(array &$state) use ($mismatch) {
                    fvplus_security_consume_nonce($state, $mismatch['nonce'], 'create.php', '', time());
                });
                $results['targetMismatch']='accepted';
            } catch (FVPlusSecurityRequestException $error) {
                $results['targetMismatch']=$error->getCode();
            }
            try {
                fvplus_security_with_state_lock(function(array &$state) use ($second) {
                    fvplus_security_consume_nonce($state, $second['nonce'], 'create.php', '', time());
                    fvplus_security_consume_transaction($state, 'tx-security-one', 'create.php', '', time());
                });
                $results['transactionReplay']='accepted';
            } catch (FVPlusSecurityRequestException $error) {
                $results['transactionReplay']=$error->getCode();
            }
            try {
                fvplus_security_declared_target_contract('../delete.php', '');
                $results['pathTraversal']='accepted';
            } catch (FVPlusSecurityRequestException $error) {
                $results['pathTraversal']=$error->getCode();
            }
            echo json_encode($results);
        `, {
            FVPLUS_TEST_CONFIG_DIR: configDir,
            FVPLUS_TEST_SOURCE_DIR: pluginRoot,
            FVPLUS_TEST_SECURITY_STATE_PATH: statePath
        });
        assert.deepEqual(result, {
            nonceReplay: 409,
            targetMismatch: 409,
            transactionReplay: 409,
            pathTraversal: 400
        });
    } finally {
        fs.rmSync(temp, { recursive: true, force: true });
    }
});

test('mutation rate buckets fail closed with HTTP 429 semantics', () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fv-security-rate-'));
    try {
        const result = runPhp(`
            require_once(${phpString(libPath)});
            $contract=['auditCategory'=>'test.rate','rateLimit'=>['windowSeconds'=>60,'maxRequests'=>2]];
            $code=0;
            fvplus_security_with_state_lock(function(array &$state) use ($contract) {
                fvplus_security_enforce_rate_limit($state, $contract, time());
                fvplus_security_enforce_rate_limit($state, $contract, time());
            });
            try {
                fvplus_security_with_state_lock(function(array &$state) use ($contract) {
                    fvplus_security_enforce_rate_limit($state, $contract, time());
                });
            } catch (FVPlusSecurityRequestException $error) {
                $code=$error->getCode();
            }
            echo json_encode(['code'=>$code]);
        `, {
            FVPLUS_TEST_CONFIG_DIR: path.join(temp, 'config'),
            FVPLUS_TEST_SOURCE_DIR: pluginRoot,
            FVPLUS_TEST_SECURITY_STATE_PATH: path.join(temp, 'state.json')
        });
        assert.equal(result.code, 429);
    } finally {
        fs.rmSync(temp, { recursive: true, force: true });
    }
});

test('security audit records are HMAC chained and tampering is detected', () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fv-security-audit-'));
    try {
        const configDir = path.join(temp, 'config');
        const result = runPhp(`
            require_once(${phpString(libPath)});
            fvplus_append_security_audit_event('mutation_authorized','ok',[
                'endpoint'=>'create.php','action'=>'','auditCategory'=>'folder.create','replayProtected'=>true
            ]);
            fvplus_append_security_audit_event('mutation_authorized','ok',[
                'endpoint'=>'delete.php','action'=>'','auditCategory'=>'folder.delete','replayProtected'=>true
            ]);
            $before=fvplus_get_security_audit_snapshot();
            $path=fvplus_security_audit_path();
            $events=json_decode(file_get_contents($path),true);
            $events[0]['status']='tampered';
            file_put_contents($path,json_encode($events));
            $after=fvplus_get_security_audit_snapshot();
            echo json_encode(['before'=>$before,'after'=>$after,'events'=>$events]);
        `, {
            FVPLUS_TEST_CONFIG_DIR: configDir,
            FVPLUS_TEST_SOURCE_DIR: pluginRoot,
            FVPLUS_TEST_SECURITY_STATE_PATH: path.join(temp, 'state.json')
        });
        assert.equal(result.before.status, 'healthy');
        assert.equal(result.before.chainValid, true);
        assert.equal(result.after.status, 'critical');
        assert.equal(result.after.chainValid, false);
        assert.equal(result.events.length, 2);
        assert.deepEqual(
            Object.keys(result.events[0]).sort(),
            [
                'action', 'auditCategory', 'endpoint', 'event', 'eventHash', 'id',
                'previousHash', 'replayProtected', 'schemaVersion', 'status',
                'timestamp', 'traceId', 'transactionId'
            ].sort()
        );
    } finally {
        fs.rmSync(temp, { recursive: true, force: true });
    }
});

test('packaged runtime manifest excludes unrelated assets and detects modified executable code', () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fv-runtime-integrity-'));
    try {
        fs.mkdirSync(path.join(temp, 'server'), { recursive: true });
        fs.mkdirSync(path.join(temp, 'scripts'), { recursive: true });
        fs.mkdirSync(path.join(temp, 'images'), { recursive: true });
        fs.writeFileSync(path.join(temp, 'Folder.page'), '<?php echo "safe";');
        fs.writeFileSync(path.join(temp, 'server/test.php'), '<?php echo "safe";');
        fs.writeFileSync(path.join(temp, 'scripts/test.js'), 'window.safe = true;');
        fs.writeFileSync(path.join(temp, 'images/ignored.svg'), '<svg/>');
        const manifestPath = path.join(temp, 'runtime-integrity.json');
        const generated = spawnSync(process.execPath, [
            generatorPath, '--root', temp, '--output', manifestPath
        ], { cwd: root, encoding: 'utf8' });
        assert.equal(generated.status, 0, generated.stderr || generated.stdout);
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        assert.deepEqual(
            manifest.files.map((entry) => entry.path),
            ['Folder.page', 'scripts/test.js', 'server/test.php']
        );
        fs.writeFileSync(path.join(temp, 'icon-asset-pack.json'), '{"managed":true}');
        fs.writeFileSync(path.join(temp, 'scripts/obsolete.js'), 'window.obsolete = true;');
        fs.appendFileSync(path.join(temp, 'server/test.php'), '\n// modified');
        const snapshot = runPhp(`
            require_once(${phpString(libPath)});
            echo json_encode(fvplus_get_runtime_integrity_snapshot('full'));
        `, {
            FVPLUS_TEST_CONFIG_DIR: path.join(temp, 'config'),
            FVPLUS_TEST_SOURCE_DIR: temp,
            FVPLUS_TEST_SECURITY_STATE_PATH: path.join(temp, 'state.json')
        });
        assert.equal(snapshot.status, 'critical');
        assert.ok(snapshot.modifiedCount >= 1);
        assert.equal(snapshot.unexpectedCount, 1);
        assert.ok(snapshot.findings.some((finding) => finding.kind === 'modified' && finding.path === 'server/test.php'));
        assert.ok(snapshot.findings.some((finding) => finding.kind === 'unexpected' && finding.path === 'scripts/obsolete.js'));
        assert.ok(!snapshot.findings.some((finding) => finding.path === 'icon-asset-pack.json'));
    } finally {
        fs.rmSync(temp, { recursive: true, force: true });
    }
});
