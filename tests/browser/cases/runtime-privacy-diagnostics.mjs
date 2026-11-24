import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

export const registerRuntimePrivacyDiagnosticsCases = ({ test, baseUrl }) => {
    test('Privacy classifier honors each secondary masking preference independently', async ({ page }) => {
        await page.goto(`${baseUrl}/runtime`, { waitUntil: 'load' });
        await page.evaluate(() => window.FolderViewPlusRuntimePrivacy.apply('docker', true, {
            privacyMaskVolumePaths: false,
            privacyMaskImageRegistry: true,
            privacyMaskPublicIps: true,
            privacyMaskInterfaces: true,
            privacyMaskExternalUrls: true
        }));
        await page.waitForFunction(() => document.querySelector('#fixture-public-ip')?.classList.contains('fvplus-sensitive-public-ip'));
        assert.equal(await page.locator('body.fvplus-privacy-docker-sensitive-publicIps').count(), 1);
        assert.equal(await page.locator('body.fvplus-privacy-docker-sensitive-volumePaths').count(), 0);
        assert.equal(await page.locator('#fixture-volume.fvplus-sensitive-volume-path').count(), 1);
        assert.equal(await page.locator('#fixture-public-ip.fvplus-sensitive-public-ip').count(), 1);
        assert.equal(await page.locator('#fixture-private-ip.fvplus-sensitive-public-ip').count(), 0);
        assert.equal(await page.locator('#fixture-interface.fvplus-sensitive-interface').count(), 1);
        assert.equal(await page.locator('#fixture-external-url.fvplus-sensitive-external-url').count(), 1);
        const maskedFilter = await page.locator('#fixture-public-ip').evaluate((node) => getComputedStyle(node).filter);
        const unmaskedFilter = await page.locator('#fixture-volume').evaluate((node) => getComputedStyle(node).filter);
        assert.notEqual(maskedFilter, 'none');
        assert.equal(unmaskedFilter, 'none');
        await page.evaluate(() => window.FolderViewPlusRuntimePrivacy.apply('docker', false, {}));
        assert.equal(await page.locator('body.fvplus-privacy-docker-sensitive').count(), 0);
    });

    test('Runtime privacy preserves the native Tailscale tooltip while masking sources and current content', async ({ page }) => {
        await page.goto(baseUrl + '/runtime', { waitUntil: 'load' });
        const originals = ['host-one 100.64.0.8 https://one.invalid/', 'host-two 100.64.0.9 https://two.invalid/', 'host-three 100.64.0.10'];
        await page.evaluate(([first]) => {
            const badge = document.createElement('span'), popup = document.createElement('div'), other = document.createElement('span');
            badge.id = 'fixture-tailscale'; badge.className = 'TS_tooltip tooltipstered'; badge.dataset.tstitle = first;
            popup.id = 'fixture-tailscale-popup';
            other.id = 'fixture-tailscale-control'; other.dataset.tstitle = 'native-control';
            document.body.append(badge, popup, other);

            let openBadge;
            window.jQuery.fn.tooltipster = function (command, content) {
                if (command === 'content' && this[0] === openBadge) popup.textContent = content;
                return this;
            };
            const open = source => {
                openBadge = source;
                window.jQuery(source).tooltipster('content', source.dataset.tstitle);
            };
            open(badge);
            window.fixtureTailscale = {
                current: () => document.getElementById('fixture-tailscale'),
                original: badge,
                open,
                replace: (text) => {
                    const next = document.createElement('span');
                    next.id = badge.id;
                    next.className = badge.className;
                    next.dataset.tstitle = text;
                    document.getElementById(badge.id).replaceWith(next);
                    open(next);
                }
            };
        }, originals);

        const badge = page.locator('#fixture-tailscale'), popup = page.locator('#fixture-tailscale-popup');
        const read = () => Promise.all([badge.getAttribute('data-tstitle'), popup.textContent()]);
        assert.deepEqual(await read(), [originals[0], originals[0]]);
        await page.evaluate(() => window.FolderViewPlusRuntimePrivacy.apply('docker', true, {}));
        assert.deepEqual(await read(), ['•••', '•••']);
        assert.equal(await page.evaluate(() => window.fixtureTailscale.current() === window.fixtureTailscale.original), true);
        assert.equal(await page.locator('#fixture-tailscale-control').getAttribute('data-tstitle'), 'native-control');

        await page.evaluate(value => { window.fixtureTailscale.current().dataset.tstitle = value; }, originals[1]);
        await page.waitForFunction(() => window.fixtureTailscale.current().dataset.tstitle === '•••');
        await page.evaluate(() => window.FolderViewPlusRuntimePrivacy.apply('docker', true, { privacyMaskPublicIps: false }));
        assert.deepEqual(await read(), [originals[1], originals[1]]);

        await page.evaluate(() => {
            window.FolderViewPlusRuntimePrivacy.apply('docker', true, { privacyMaskPublicIps: true });
        });
        await page.evaluate(value => window.fixtureTailscale.replace(value), originals[2]);
        await page.waitForFunction(() => window.fixtureTailscale.current().dataset.tstitle === '•••');
        assert.deepEqual(await read(), ['•••', '•••']);
        assert.equal(await page.evaluate(() => window.fixtureTailscale.original.dataset.tstitle), originals[1]);

        await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
        assert.deepEqual(await read(), [originals[2], originals[2]]);
        await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
        await page.evaluate(() => window.fixtureTailscale.open(window.fixtureTailscale.current()));
        assert.deepEqual(await read(), ['•••', '•••']);
        await page.evaluate(() => window.FolderViewPlusRuntimePrivacy.apply('docker', false, {}));
        assert.deepEqual(await read(), [originals[2], originals[2]]);
    });

    test('Runtime privacy keyboard diagnostics downloads contain allowlisted aggregates across Docker VM and Dashboard', async ({ page }) => {
        const privateValues = ['fixture-private-name', 'fixture-vm-id', '/mnt/user/fixture-private',
            'https://private.invalid/fixture', '100.64.0.11', 'fixture-private-token'];
        const filenames = {
            docker: ['debug-DOCKER.json'],
            vm: ['debug-VM.json'],
            dashboard: ['debug-DASHBOARD-DOCKER.json', 'debug-DASHBOARD-VM.json']
        };
        for (const [surface, expected] of Object.entries(filenames)) {
            await page.goto(baseUrl + '/runtime', { waitUntil: 'load' });
            for (const script of ['runtime.page-diagnostics.js', 'runtime.debug-download.js']) {
                await page.addScriptTag({ url: baseUrl + '/plugin/scripts/' + script });
            }
            await page.evaluate(({ surface, privateValues }) => {
                window.fixtureDebugReloads = 0;
                window.loadlist = () => { window.fixtureDebugReloads++; };
                const rootIds = surface === 'dashboard' ? ['docker_view', 'vm_view'] : (surface === 'vm' ? ['kvm_list'] : ['docker_list']);
                for (const id of rootIds) {
                    let root = document.getElementById(id);
                    if (!root) {
                        root = document.createElement('tbody');
                        root.id = id;
                        document.body.appendChild(document.createElement('table')).appendChild(root);
                    }
                    const row = root.insertRow(), cell = row.insertCell();
                    row.className = 'folder';
                    row.title = privateValues.join(' ');
                    cell.textContent = privateValues.join(' ');
                }
                const input = document.createElement('input');
                input.id = 'fixture-debug-input'; input.setAttribute('aria-label', 'Fixture control'); document.body.appendChild(input);
                window.FolderViewPlusFoundationModules.runtimeDebugDownload.bind(surface);
            }, { surface, privateValues });

            const received = [];
            const onDownload = item => received.push(item.suggestedFilename());
            page.on('download', onDownload);
            await page.locator('#fixture-debug-input').focus();
            await page.keyboard.type('debug');
            await page.locator('#fixture-debug-input').blur();
            const pending = expected.map(name => page.waitForEvent('download', { predicate: item => item.suggestedFilename() === name }));
            await page.keyboard.type('debug');
            for (const item of await Promise.all(pending)) {
                const payload = await fs.readFile(await item.path(), 'utf8');
                for (const value of privateValues) assert.equal(payload.includes(value), false);
                const snapshot = JSON.parse(payload);
                assert.equal(snapshot.surface, surface);
                assert.ok(snapshot.state.visibleRows >= 1);
                assert.ok(snapshot.state.folderRows >= 1);
                assert.deepEqual(Object.keys(snapshot), ['schemaVersion', 'surface', 'variant', 'trigger', 'capturedAt', 'viewport', 'appearance', 'state']);
            }
            assert.deepEqual(received.sort(), [...expected].sort());
            assert.equal(await page.evaluate(() => window.fixtureDebugReloads), 0);
            page.off('download', onDownload);
        }
    });
};
