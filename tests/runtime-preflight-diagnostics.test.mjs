import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const libPhp = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.php');
const dockerPage = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/folderview.plus.Docker.page');
const vmPage = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/folderview.plus.VMs.page');
const dockerJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js');
const vmJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/vm.js');

test('server lib safely loads host dependencies and exposes runtime preflight helpers', () => {
    assert.match(libPhp, /function fvplus_safe_require_once\(string \$key, string \$path\): bool/);
    assert.match(libPhp, /function fvplus_get_host_dependency_status\(\): array/);
    assert.match(libPhp, /fvplus_safe_require_once\('helpers', "\$documentRoot\/webGui\/include\/Helpers\.php"\);/);
    assert.match(libPhp, /fvplus_safe_require_once\('docker', "\$documentRoot\/plugins\/dynamix\.docker\.manager\/include\/DockerClient\.php"\);/);
    assert.match(libPhp, /fvplus_safe_require_once\('libvirt', "\$documentRoot\/plugins\/dynamix\.vm\.manager\/include\/libvirt_helpers\.php"\);/);
    assert.match(libPhp, /if \(!function_exists\('autov'\)\) \{/);
    assert.match(libPhp, /function collectRuntimeOverrideEntries\(string \$type\): array/);
    assert.match(libPhp, /function collectRuntimePreflight\(string \$type\): array/);
    assert.match(libPhp, /function runtimePreflightHasFatal\(array \$preflight\): bool/);
    assert.match(libPhp, /function emitRuntimePreflightBannerBootstrap\(array \$preflight, string \$contextLabel = 'Runtime'\): void/);
    assert.match(libPhp, /FolderView Plus requires Unraid 7\.0\.0 or newer/);
    assert.match(libPhp, /Custom FolderView Plus overrides are active/);
    assert.match(libPhp, /Docker API probe failed/);
    assert.match(libPhp, /Libvirt connection failed/);
});

test('docker and vm pages seed runtime preflight into the fatal-banner context and stop on fatal preflight', () => {
    assert.match(dockerPage, /\$fvplusRuntimePreflight = collectRuntimePreflight\(\$type\);/);
    assert.match(dockerPage, /\$fvplusRuntimePreflightHasFatal = runtimePreflightHasFatal\(\$fvplusRuntimePreflight\);/);
    assert.match(dockerPage, /preflight:\s*<\?=json_encode\(\$fvplusRuntimePreflight,\s*JSON_UNESCAPED_SLASHES \| JSON_UNESCAPED_UNICODE\)\?>/);
    assert.match(dockerPage, /emitRuntimePreflightBannerBootstrap\(\$fvplusRuntimePreflight,\s*'Docker'\);/);
    assert.match(dockerPage, /if \(\$fvplusRuntimePreflightHasFatal\) \{ return; \}/);

    assert.match(vmPage, /\$fvplusRuntimePreflight = collectRuntimePreflight\(\$type\);/);
    assert.match(vmPage, /\$fvplusRuntimePreflightHasFatal = runtimePreflightHasFatal\(\$fvplusRuntimePreflight\);/);
    assert.match(vmPage, /preflight:\s*<\?=json_encode\(\$fvplusRuntimePreflight,\s*JSON_UNESCAPED_SLASHES \| JSON_UNESCAPED_UNICODE\)\?>/);
    assert.match(vmPage, /emitRuntimePreflightBannerBootstrap\(\$fvplusRuntimePreflight,\s*'VMs'\);/);
    assert.match(vmPage, /if \(\$fvplusRuntimePreflightHasFatal\) \{ return; \}/);
});

test('docker and vm runtimes report host-page structure drift explicitly', () => {
    assert.match(dockerJs, /const DOCKER_HOST_PAGE_REQUIRED_SELECTORS = Object\.freeze\(\[/);
    assert.match(dockerJs, /Docker table shell', selector: 'table#docker_containers'/);
    assert.match(dockerJs, /Docker table body', selector: 'tbody#docker_list'/);
    assert.match(dockerJs, /const ensureDockerHostPageStructure = \(\) =>/);
    assert.match(dockerJs, /code: 'FVPLUS-DKR-DOM-001'/);
    assert.match(dockerJs, /category: 'host-page-structure'/);
    assert.match(dockerJs, /markDockerFatalBannerStep\('Docker host page signature verified'\);/);

    assert.match(vmJs, /const VM_HOST_PAGE_REQUIRED_SELECTORS = Object\.freeze\(\[/);
    assert.match(vmJs, /VM table shell', selector: 'table#kvm_table'/);
    assert.match(vmJs, /VM table body', selector: 'tbody#kvm_list'/);
    assert.match(vmJs, /const ensureVmHostPageStructure = \(\) =>/);
    assert.match(vmJs, /code: 'FVPLUS-VM-DOM-001'/);
    assert.match(vmJs, /category: 'host-page-structure'/);
    assert.match(vmJs, /markVmFatalBannerStep\('VM host page signature verified'\);/);
});
