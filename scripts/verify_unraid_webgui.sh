#!/usr/bin/env bash
set -euo pipefail

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
webgui_commit=b135287c706a30da44f71cc7820615209e83e9a0
fixture_commit=09842a3f2c8938db005200168f8fd0186c88426e

if [[ ${1:-} != --isolated ]]; then
    [[ $# == 2 ]] || { echo 'Usage: bash scripts/verify_unraid_webgui.sh <pinned webGUI tar.gz> <pinned FolderView3 fixture tar.gz>' >&2; exit 2; }
    webgui=$(realpath -- "$1")
    fakes=$(realpath -- "$2")
    if ! printf '%s\n' \
        "18ad6811dada8f1e75323ba64fc02fbc3b27eb38538cb1af090aec71df9fc3c0  $webgui" \
        "a5ceddfb793931af637bf5f83df6afb08063f5cea69ac337fb36a2bac83c2388  $fakes" | sha256sum --check --strict; then
        echo 'The pinned fixture archives failed SHA-256 verification.' >&2
        exit 1
    fi
    work=$(mktemp -d /tmp/fvplus-webgui-test.XXXXXXXX)
    trap '[[ $work =~ ^/tmp/fvplus-webgui-test\.[A-Za-z0-9]{8}$ ]] && rm -rf -- "$work"' EXIT
    tar --extract --gzip --file "$webgui" --directory "$work" --no-same-owner "webgui-$webgui_commit/emhttp"
    tar --extract --gzip --file "$fakes" --directory "$work" --no-same-owner \
        "folder.view3-$fixture_commit/.github/unraid-compat/fake" \
        "folder.view3-$fixture_commit/.github/unraid-compat/fixtures"
    if ! unshare --user --map-root-user --mount --net --pid --fork --kill-child --mount-proc \
        bash "$0" --isolated "$work" "$(readlink /proc/self/ns/net)"; then
        for log in "$work/root/var/log/php-server.log" "$work/root/var/log/phplog"; do
            if [[ -f $log ]]; then
                tail -n 16 "$log" >&2
                grep -E 'PHP (Fatal|Parse)|plugins/folderview.plus' "$log" | tail -n 16 >&2 || true
            fi
        done
        if [[ -f $work/root/var/log/fv3-fakes.log ]]; then tail -n 16 "$work/root/var/log/fv3-fakes.log" >&2; fi
        exit 1
    fi
    exit 0
fi

work=${2:-}
[[ $work =~ ^/tmp/fvplus-webgui-test\.[A-Za-z0-9]{8}$ && ! -L $work && -d $work ]]
[[ $(id -u) == 0 && $(readlink /proc/self/ns/net) != "${3:-}" && $(ip -o link show | cut -d: -f2 | xargs) == lo ]]
mount --make-rprivate /
ip link set lo up
root="$work/root"
mkdir "$root"
mkdir -p "$root"/{usr,bin,proc,sys,dev,etc,run,tmp,boot/config/plugins,fixture,var/{local/emhttp,log/plugins,tmp,lib/{docker,php/sessions}}}
mount --rbind /usr "$root/usr"
usr_mounts=$(findmnt --list --noheadings --output TARGET --submounts "$root/usr" | tac)
while IFS= read -r mountpoint; do
    mount -o remount,bind,ro "$mountpoint"
done <<< "$usr_mounts"
mkdir "$work/local"
mount --bind "$work/local" "$root/usr/local"
mount -t proc proc "$root/proc"
mount -t sysfs -o ro sysfs "$root/sys"
for device in null zero random urandom; do
    touch "$root/dev/$device"
    mount --bind "/dev/$device" "$root/dev/$device"
done
for directory in lib lib64 sbin; do ln -s "usr/$directory" "$root/$directory"; done
for command in bash cat chmod cp grep ln ls mkdir mv readlink rm sed touch; do ln -s "/usr/bin/$command" "$root/bin/$command"; done
ln -s /usr/bin/bash "$root/bin/sh"
ln -s /run "$root/var/run"
cp -a --no-preserve=ownership /etc/alternatives /etc/php "$root/etc/"
find "$root/etc/php" -type l -name '*gettext.ini' -delete
ln -s /usr/share/zoneinfo/UTC "$root/etc/localtime"
if [[ -n ${FVPLUS_TEST_PHP_MODULE_DIR:-} ]]; then
    mkdir "$root/fixture/php"
    php_scan="$root/etc/php/$(php -r 'echo PHP_MAJOR_VERSION . "." . PHP_MINOR_VERSION;')/cli/conf.d"
    for module in mbstring curl sqlite3 pdo_sqlite; do
        if ! php -r "exit(extension_loaded('$module') ? 0 : 1);" && [[ -f $FVPLUS_TEST_PHP_MODULE_DIR/$module.so ]]; then
            cp -L "$FVPLUS_TEST_PHP_MODULE_DIR/$module.so" "$root/fixture/php/"
            printf 'extension=/fixture/php/%s.so\n' "$module" > "$php_scan/29-fvplus-$module.ini"
        fi
    done
    if [[ -f $FVPLUS_TEST_PHP_MODULE_DIR/libonig.so.5 ]]; then cp -L "$FVPLUS_TEST_PHP_MODULE_DIR/libonig.so.5" "$root/fixture/php/"; fi
fi
printf 'root:x:0:0:Fixture root:/tmp:/bin/bash\n' > "$root/etc/passwd"
printf 'root:x:0:\n' > "$root/etc/group"
printf '127.0.0.1 localhost\n' > "$root/etc/hosts"
printf 'version="7.4.0"\n' > "$root/etc/unraid-version"
touch "$root/.dockerenv" "$root/run/fv3-fake-unraid"

cp -a "$work/webgui-$webgui_commit/emhttp" "$root/usr/local/emhttp"
fixture="$work/folder.view3-$fixture_commit/.github/unraid-compat"
cp -a "$fixture/fake" "$fixture/fixtures" "$root/fixture/"
# The native VM page passes the explicit URI. Plus also uses the libvirt binding's default URI.
sed -i "/^function libvirt_connect(.*{/a\\    if (\$uri === 'null') return fv3l_handle('connection', 'qemu:///system');" "$root/fixture/fake/libvirt.php"
docroot="$root/usr/local/emhttp"
mkdir -p "$root/usr/local/"{bin,sbin} "$root/etc/rc.d" "$root/run/libvirt" \
    "$docroot/plugins/dynamix.my.servers/include" "$root/boot/config/plugins/"{dockerMan/templates-user,dynamix.vm.manager}
cp "$root/fixture/fake/connect_state.php" "$docroot/plugins/dynamix.my.servers/include/state.php"
touch "$docroot/plugins/dynamix.my.servers/include/"{myservers1.php,myservers2.php}
for command in ip dmidecode; do install -m 755 "$root/fixture/fake/$command.sh" "$root/usr/local/sbin/$command"; done
for service in docker libvirt; do install -m 755 "$root/fixture/fake/rc_service.sh" "$root/etc/rc.d/rc.$service"; done
ln -s /usr/bin/php "$root/usr/local/sbin/dockerd"
ln -s /usr/bin/sleep "$root/usr/local/sbin/libvirtd"
cat > "$root/usr/local/bin/docker" <<'SH'
#!/bin/sh
exec php /fixture/fake/docker.php cli "$@"
SH
chmod 755 "$root/usr/local/bin/docker"
cat > "$root/usr/local/sbin/removepkg" <<'SH'
#!/bin/sh
printf '%s\n' "$@" >> /var/log/fvplus-package-removal.log
SH
chmod 755 "$root/usr/local/sbin/removepkg"
printf '#!/bin/sh\nexit 0\n' > "$root/usr/local/sbin/update_cron"
chmod 755 "$root/usr/local/sbin/update_cron"

cat > "$root/var/local/emhttp/var.ini" <<'INI'
version="7.4.0"
csrf_token="fvplus-isolated-webgui-token"
NAME="Fixture Tower"
COMMENT=""
SYS_MODEL=""
fsState="Started"
mdState="STARTED"
deviceCount="0"
shareSMBEnabled="yes"
shareNFSEnabled="no"
configValid="yes"
flashGUID="0000-0000-0000-000000000000"
flashVendor="Synthetic"
flashProduct="Fixture"
regTy="Pro"
regTm="1735689600"
regExp=""
regBuildTime="1735689600"
INI
for ini in devs disks sec sec_nfs shares; do touch "$root/var/local/emhttp/$ini.ini"; done
printf '["root"]\nidx="0"\nname="root"\ndesc="Synthetic login"\npasswd="yes"\n' > "$root/var/local/emhttp/users.ini"
printf '[eth0]\nBONDING="no"\nBRIDGING="no"\nIPADDR:0="192.0.2.10"\nNETMASK:0="255.255.255.0"\nUSE_DHCP:0="no"\n' > "$root/var/local/emhttp/network.ini"
printf 'DOCKER_ENABLED="yes"\n' > "$root/boot/config/docker.cfg"
printf 'SERVICE="enable"\nDEBUG="yes"\n' > "$root/boot/config/domain.cfg"
printf '0="tool-c"\n1="app-d"\n2="app-a"\n3="app-b"\n' > "$root/boot/config/plugins/dockerMan/userprefs.cfg"
printf 'app-a\napp-d 10\n' > "$root/var/lib/docker/unraid-autostart"

box() { chroot "$root" /usr/bin/env -i PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin HOME=/tmp LD_LIBRARY_PATH=/fixture/php "$@"; }
box php -r 'if (!function_exists("mb_strlen")) { fwrite(STDERR, "The pinned webGUI fixture requires PHP mbstring.\n"); exit(1); }'
box php <<'PHP'
<?php
$path = '/fixture/fixtures/docker.json';
$fixture = json_decode(file_get_contents($path), true, flags: JSON_THROW_ON_ERROR);
$container = &$fixture['inspect']['app-a'];
$container['Config']['Labels']['com.docker.compose.project'] = 'fixture-project';
$container['Config']['Labels']['com.docker.compose.service'] = 'fixture-service';
$container['Config']['Env'][] = 'FIXTURE_MODE=synthetic-runtime-value';
$fixture['image_inspect'][$container['Image']]['Config']['Env'][] = 'FIXTURE_MODE=synthetic-image-value';
file_put_contents($path, json_encode($fixture, JSON_THROW_ON_ERROR));
PHP
for config in dynamix.docker.manager/scripts/dockerconfig dynamix.vm.manager/scripts/libvirtconfig; do
    box php -d short_open_tag=1 "/usr/local/emhttp/plugins/$config"
done
box /usr/local/sbin/dockerd /fixture/fake/docker.php serve > "$root/var/log/dockerd.log" 2>&1 &
box sh -c 'echo $$ > /run/libvirt/libvirtd.pid; exec /usr/local/sbin/libvirtd infinity' &
box env PHP_CLI_SERVER_WORKERS=4 php -d short_open_tag=1 -d display_errors=0 -d log_errors=1 -d error_log=/var/log/phplog \
    -S 127.0.0.1:18470 -t /usr/local/emhttp /fixture/fake/router.php > "$root/var/log/php-server.log" 2>&1 &
ready=0
for ((attempt=0; attempt<120; attempt++)); do
    if [[ -S $root/run/docker.sock ]] && curl --silent --fail --max-time 1 http://127.0.0.1:18470/robots.txt >/dev/null; then
        ready=1
        break
    fi
    sleep .1
done
[[ $ready == 1 ]]

node "$repo/tests/fixtures/unraid-webgui-browser.mjs" "$root"
