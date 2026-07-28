import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = path.resolve(process.cwd());
const serverDir = path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server');
const manifestPath = path.join(serverDir, 'api-endpoints.json');
const contractLibPath = path.join(serverDir, 'lib.api-contract.php');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

function phpString(value) {
    return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function runPhp(body) {
    const result = spawnSync('php', ['-r', `require_once(${phpString(contractLibPath)});${body}`], {
        cwd: repoRoot,
        encoding: 'utf8'
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    return result.stdout.trim();
}

test('endpoint manifest exactly covers every public PHP endpoint', () => {
    const publicEndpoints = fs.readdirSync(serverDir)
        .filter((name) => name.endsWith('.php') && !name.startsWith('lib'))
        .sort();
    assert.deepEqual(Object.keys(manifest.endpoints).sort(), publicEndpoints);
    assert.equal(manifest.schemaVersion, 2);
});

test('previously omitted mutation surfaces are explicitly classified', () => {
    assert.equal(manifest.endpoints['batch.php'].access, 'mutation');
    assert.equal(manifest.endpoints['batch.php'].requestToken, 'mutation');
    assert.equal(manifest.endpoints['migrate_legacy_regex.php'].requestToken, 'mutation');
    assert.equal(manifest.endpoints['reconcile_member_identities.php'].requestToken, 'mutation');
    assert.equal(manifest.endpoints['docker_start_order.php'].actions.sync.requestToken, 'mutation');
    assert.equal(manifest.endpoints['environment_snapshot.php'].actions.apply.requestToken, 'mutation');
    assert.equal(manifest.endpoints['theme_workspace.php'].actions.import_github.requestToken, 'mutation');
});

test('manifest enforcement invokes the mutation guard and exposes audit context', () => {
    const output = runPhp(`
        $_SERVER=['REQUEST_METHOD'=>'POST','CONTENT_TYPE'=>'application/x-www-form-urlencoded','CONTENT_LENGTH'=>'64'];
        $_GET=[];
        $_POST=['type'=>'docker','operations'=>'[]'];
        $_REQUEST=$_POST;
        $guardCalls=0;
        $contract=fvplus_enforce_api_contract_for_endpoint('batch.php', function() use (&$guardCalls) { $guardCalls++; });
        echo json_encode(['guardCalls'=>$guardCalls,'access'=>$contract['access'],'audit'=>fvplus_get_current_api_audit_category()]);
    `);
    assert.deepEqual(JSON.parse(output), {
        guardCalls: 1,
        access: 'mutation',
        audit: 'folder.batch'
    });
});

test('mixed endpoint actions resolve read and mutation contracts independently', () => {
    const output = runPhp(`
        $_SERVER=['REQUEST_METHOD'=>'POST','CONTENT_TYPE'=>'application/x-www-form-urlencoded','CONTENT_LENGTH'=>'64'];
        $_GET=[];
        $_POST=['action'=>'apply','payload'=>'{}'];
        $_REQUEST=$_POST;
        $guardCalls=0;
        $contract=fvplus_enforce_api_contract_for_endpoint('environment_snapshot.php', function() use (&$guardCalls) { $guardCalls++; });
        echo json_encode(['guardCalls'=>$guardCalls,'action'=>$contract['action'],'access'=>$contract['access'],'audit'=>$contract['auditCategory']]);
    `);
    assert.deepEqual(JSON.parse(output), {
        guardCalls: 1,
        action: 'apply',
        access: 'mutation',
        audit: 'environment.apply'
    });
});

test('manifest enforcement rejects method, content type, size, and parameter violations', () => {
    const output = runPhp(`
        $results=[];
        $cases=[
            ['server'=>['REQUEST_METHOD'=>'GET'], 'post'=>[], 'endpoint'=>'create.php'],
            ['server'=>['REQUEST_METHOD'=>'POST','CONTENT_TYPE'=>'application/json','CONTENT_LENGTH'=>'10'], 'post'=>['type'=>'docker','content'=>'{}'], 'endpoint'=>'create.php'],
            ['server'=>['REQUEST_METHOD'=>'POST','CONTENT_TYPE'=>'application/x-www-form-urlencoded','CONTENT_LENGTH'=>'40000000'], 'post'=>['type'=>'docker','operations'=>'[]'], 'endpoint'=>'batch.php'],
            ['server'=>['REQUEST_METHOD'=>'POST','CONTENT_TYPE'=>'application/x-www-form-urlencoded','CONTENT_LENGTH'=>'10'], 'post'=>['type'=>'docker'], 'endpoint'=>'create.php']
        ];
        foreach ($cases as $case) {
            $_SERVER=$case['server']; $_GET=[]; $_POST=$case['post']; $_REQUEST=$_POST;
            try { fvplus_enforce_api_contract_for_endpoint($case['endpoint'], function() {}); $results[]='none'; }
            catch (FVPlusApiContractException $e) { $results[]=(string)$e->getCode(); }
        }
        echo json_encode($results);
    `);
    assert.deepEqual(JSON.parse(output), ['405', '415', '413', '400']);
});
