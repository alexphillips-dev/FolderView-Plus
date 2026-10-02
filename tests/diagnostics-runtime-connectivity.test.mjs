import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const diagnosticsPath = path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.diagnostics.php');
const phpQuote = (value) => `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

test('read-only runtime probe distinguishes connected, disabled, failed, and unknown managers', () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-runtime-probe-'));
    const dockerConfig = path.join(temp, 'docker.cfg');
    const vmConfig = path.join(temp, 'domain.cfg');
    const harness = path.join(temp, 'probe.php');
    fs.writeFileSync(harness, `<?php
const FVPLUS_DIAGNOSTICS_DEFAULT_PRIVACY = 'sanitized';
const FVPLUS_DIAGNOSTICS_HISTORY_MAX = 80;
const FVPLUS_DIAGNOSTICS_SCHEMA_VERSION = 7;
class DockerClient {
    public function getDockerJSON($path) { return getenv('DOCKER_FAIL') ? false : []; }
}
class Libvirt {
    public function connect() { return !getenv('VM_FAIL'); }
    public function get_domains() { return []; }
}
require_once ${phpQuote(diagnosticsPath)};
echo json_encode(diagnosticsRuntimeConnectivity(['docker' => $argv[1], 'vm' => $argv[2]]));
`, 'utf8');
    const probe = (dockerSetting, vmSetting, failures = {}) => {
        fs.writeFileSync(dockerConfig, dockerSetting);
        fs.writeFileSync(vmConfig, vmSetting);
        return JSON.parse(execFileSync('php', [harness, dockerConfig, vmConfig], {
            encoding: 'utf8',
            env: { ...process.env, DOCKER_FAIL: failures.docker ? '1' : '', VM_FAIL: failures.vm ? '1' : '' }
        }));
    };
    try {
        assert.deepEqual(probe('DOCKER_ENABLED="yes"\n', 'SERVICE="enable"\n'), { docker: 'ready', vm: 'ready' });
        assert.deepEqual(probe('DOCKER_ENABLED="no"\n', 'SERVICE="disable"\n', { docker: true, vm: true }), { docker: 'disabled', vm: 'disabled' });
        assert.deepEqual(probe('DOCKER_ENABLED="yes"\n', 'SERVICE="enable"\n', { docker: true, vm: true }), { docker: 'unavailable', vm: 'unavailable' });
        assert.deepEqual(probe('DOCKER_ENABLED="maybe"\n', 'SERVICE="unknown"\n', { docker: true, vm: true }), { docker: 'unknown', vm: 'unknown' });
    } finally {
        fs.rmSync(temp, { recursive: true, force: true });
    }
});
