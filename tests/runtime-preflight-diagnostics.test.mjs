import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const libPhp = [
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.php',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.runtime-info.php'
].map(read).join('\n');
const dockerRuntimeLibPhp = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.docker-runtime.php');
const libPreflightPhp = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.preflight.php');
const dockerPage = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/folderview.plus.Docker.page');
const vmPage = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/folderview.plus.VMs.page');
const dockerJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js');
const vmJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/vm.js');
const hostAdapterJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/runtime.host-adapter.js');
const runtimePreflightBootstrap = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/runtime.preflight-bootstrap.js');

test('server lib safely loads host dependencies and exposes runtime preflight helpers', () => {
    assert.match(libPhp, /function fvplus_safe_require_once\(string \$key, string \$path\): bool/);
    assert.match(libPhp, /function fvplus_get_host_dependency_status\(\): array/);
    assert.match(libPhp, /fvplus_safe_require_once\('helpers', "\$documentRoot\/webGui\/include\/Helpers\.php"\);/);
    assert.match(libPhp, /fvplus_safe_require_once\('docker', "\$documentRoot\/plugins\/dynamix\.docker\.manager\/include\/DockerClient\.php"\);/);
    assert.match(libPhp, /fvplus_safe_require_once\('libvirt', "\$documentRoot\/plugins\/dynamix\.vm\.manager\/include\/libvirt_helpers\.php"\);/);
    assert.match(libPhp, /if \(!function_exists\('autov'\)\) \{/);
    assert.match(libPhp, /require_once\(__DIR__ \. '\/lib\.preflight\.php'\);/);
    assert.match(libPreflightPhp, /function collectRuntimeOverrideEntries\(string \$type\): array/);
    assert.match(libPreflightPhp, /function collectRuntimePreflight\(string \$type\): array/);
    assert.match(libPreflightPhp, /function runtimePreflightHasFatal\(array \$preflight\): bool/);
    assert.match(libPhp, /function emitRuntimePreflightBannerBootstrap\(array \$preflight, string \$contextLabel = 'Runtime'\): void/);
    assert.match(libPreflightPhp, /FolderView Plus requires Unraid 7\.0\.0 or newer/);
    assert.match(libPreflightPhp, /Custom FolderView Plus overrides are active/);
    assert.match(libPreflightPhp, /Docker API probe failed/);
    assert.match(libPreflightPhp, /Libvirt connection failed/);
});

test('docker and vm pages seed runtime preflight into the fatal-banner context and stop on fatal preflight', () => {
    assert.match(dockerPage, /\$fvplusRuntimePreflight = collectRuntimePreflight\(\$type\);/);
    assert.match(dockerPage, /\$fvplusRuntimePreflightHasFatal = runtimePreflightHasFatal\(\$fvplusRuntimePreflight\);/);
    assert.match(libPhp, /emitJsonBootstrapMeta\('fvplus-runtime-preflight'/);
    assert.match(libPhp, /scripts\/runtime\.preflight-bootstrap\.js/);
    assert.match(runtimePreflightBootstrap, /runtimeContext\.preflight = \{ issues \};/);
    assert.match(dockerPage, /emitRuntimePreflightBannerBootstrap\(\$fvplusRuntimePreflight,\s*'Docker'\);/);
    assert.match(dockerPage, /if \(\$fvplusRuntimePreflightHasFatal\) \{ return; \}/);

    assert.match(vmPage, /\$fvplusRuntimePreflight = collectRuntimePreflight\(\$type\);/);
    assert.match(vmPage, /\$fvplusRuntimePreflightHasFatal = runtimePreflightHasFatal\(\$fvplusRuntimePreflight\);/);
    assert.match(runtimePreflightBootstrap, /querySelector\?\.\('meta\[name="fvplus-runtime-preflight"\]'\)/);
    assert.match(vmPage, /emitRuntimePreflightBannerBootstrap\(\$fvplusRuntimePreflight,\s*'VMs'\);/);
    assert.match(vmPage, /if \(\$fvplusRuntimePreflightHasFatal\) \{ return; \}/);
});

test('docker and vm runtimes report host-page structure drift explicitly', () => {
    assert.match(hostAdapterJs, /Docker table shell', selector: 'table#docker_containers'/);
    assert.match(hostAdapterJs, /Docker table body', selector: 'tbody#docker_list'/);
    assert.match(hostAdapterJs, /VM table shell', selector: 'table#kvm_table'/);
    assert.match(hostAdapterJs, /VM table body', selector: 'tbody#kvm_list'/);
    assert.match(dockerPage, /scripts\/runtime\.host-adapter\.js/);
    assert.match(vmPage, /scripts\/runtime\.host-adapter\.js/);
    assert.match(dockerJs, /const dockerHostGuardsModule = window\.FolderViewPlusDockerHostGuards \|\| null;/);
    assert.match(dockerJs, /runtimeHostAdapters\?\.getOrCreate\?\.\('docker'/);
    assert.match(dockerJs, /const ensureDockerHostPageStructure = \(\) =>/);
    assert.match(dockerJs, /hostGuardsApi\.ensureHostPageStructure\(\);/);
    assert.match(dockerJs, /markDockerFatalBannerStep\('Docker host page signature verified'\);/);

    assert.match(vmJs, /runtimeHostAdapters\?\.getOrCreate\?\.\('vm'/);
    assert.match(vmJs, /const ensureVmHostPageStructure = \(\) =>/);
    assert.match(vmJs, /vmHostAdapter\.ensureStructure\(\{/);
    assert.match(vmJs, /code: 'FVPLUS-VM-DOM-001'/);
    assert.match(vmJs, /category: 'host-page-structure'/);
    assert.match(vmJs, /markVmFatalBannerStep\('VM host page signature verified'\);/);
});

test('read_info hardens Docker and VM data reads against missing host fields', () => {
    assert.match(libPhp, /\$cts = \$dockerClient->getDockerJSON\(\"\/containers\/json\?all=1\"\);[\s\S]*if \(!is_array\(\$cts\)\) \{/);
    assert.match(dockerRuntimeLibPhp, /function getDockerTemplateIndexCached\(DockerTemplates \$dockerTemplates\): array \{[\s\S]*try \{[\s\S]*\$templateFiles = \$dockerTemplates->getTemplates\('all'\);[\s\S]*\} catch \(Throwable \$error\) \{/);
    assert.match(dockerRuntimeLibPhp, /getDockerTemplateIndexCached: DockerTemplates->getTemplates\('all'\) failed:/);
    assert.match(dockerRuntimeLibPhp, /try \{[\s\S]*\$templates = buildDockerTemplateIndex\(\$templateFiles\);[\s\S]*\} catch \(Throwable \$error\) \{/);
    assert.match(libPhp, /\$containerLabels = is_array\(\$ct\['Labels'\] \?\? null\) \? \$ct\['Labels'\] : \[\];/);
    assert.match(libPhp, /\$configLabels = is_array\(\$ct\['info'\]\['Config'\]\['Labels'\] \?\? null\) \? \$ct\['info'\]\['Config'\]\['Labels'\] : \[\];/);
    assert.match(libPhp, /\$tailscaleFunnelEnabled = strtolower\(trim\(\(string\)\(\$containerLabels\['net\.unraid\.docker\.tailscale\.funnel'\] \?\? 'false'\)\)\) === 'true';/);
    assert.match(libPhp, /\$tsServeModeFromXml = \(string\)\(\$containerLabels\['net\.unraid\.docker\.tailscale\.servemode'\] \?\? \(\$tailscaleFunnelEnabled \? 'funnel' : 'no'\)\);/);
    assert.match(libPhp, /\$vms = \$lv->get_domains\(\);[\s\S]*\$vmCount = is_array\(\$vms\) \? count\(\$vms\) : 0;/);
    assert.match(libPhp, /if \(!is_array\(\$dom\)\) \{/);
    assert.match(libPhp, /'state' => \$lv->domain_state_translate\(\$dom\['state'\] \?\? ''\),/);
});
