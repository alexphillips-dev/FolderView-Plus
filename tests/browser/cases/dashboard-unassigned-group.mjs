import assert from 'node:assert/strict';
import { installDashboardLoadingFixture } from './dashboard-tile-loading.mjs';
import { membershipSnapshot, nativeMarkupFor, unassignedNames } from '../helpers/dashboard-membership-host.mjs';

const toggleFor = (widget) => widget.locator('[data-fv-unassigned-group]').getByRole('button');

export const registerDashboardUnassignedGroupCases = ({ test, baseUrl }) => {
    test('Dashboard lifecycle groups verified unassigned items independently after named folders', async ({ page }) => {
        const nativeRows = {
            docker: {
                'fixture-docker': 'abcdabcd0001',
                'leftover-docker': 'abcdabcd0002',
                'rule-docker': 'abcdabcd0003',
                'hidden-docker': 'abcdabcd0004',
                'unverified-docker': 'abcdabcd0005'
            },
            vm: { 'fixture-vm': 'fixture-uuid', 'leftover-vm': 'leftover-uuid' }
        };
        const fixture = await installDashboardLoadingFixture(page, baseUrl, {
            nativeMarkup: (type) => nativeMarkupFor(type, nativeRows[type])
        });
        const docker = fixture.widget('docker');
        const vm = fixture.widget('vm');
        const dockerToggle = toggleFor(docker);
        const vmToggle = toggleFor(vm);
        await fixture.load();
        assert.equal(await dockerToggle.count(), 0);
        assert.equal(await vmToggle.count(), 0);
        const nativeButton = docker.getByRole('button', { name: 'Native leftover-docker control' });
        await nativeButton.evaluate(node => node.addEventListener('click', () => node.setAttribute('aria-pressed', 'true')));
        const { 'unverified-docker': _unverified, ...dockerRuntimeRows } = nativeRows.docker;
        fixture.settle('docker', 0, 1, false, membershipSnapshot('docker', dockerRuntimeRows, {
            rules: [{ id: 'fixture-rule', enabled: true, folderId: 'docker-group', kind: 'name_regex', pattern: '^rule-docker$' }],
            extraFolders: {
                'hidden-group': { id: 'hidden-group', name: 'Hidden configured folder', containers: ['hidden-docker'], settings: {}, actions: [] }
            }
        }));
        await fixture.waitForState('docker', 'ready');
        assert.deepEqual(await unassignedNames(docker), ['leftover-docker']);
        assert.equal(await dockerToggle.getAttribute('aria-expanded'), 'false');
        assert.equal(await nativeButton.isVisible(), false);
        assert.equal(await docker.getByText('unverified-docker', { exact: true }).isVisible(), true);
        assert.equal(await docker.locator('.folder-showcase').getByText('rule-docker', { exact: true }).isVisible(), true);
        assert.equal(await vmToggle.count(), 0);
        assert.equal(await dockerToggle.evaluate(button => {
            const header = button.parentElement;
            const ordered = Array.from(header.parentElement.children);
            return header.parentElement.tagName === 'TD'
                && ordered.slice(ordered.indexOf(header) + 1).every(node => node.hasAttribute('data-fv-unassigned-item'));
        }), true);
        await dockerToggle.focus();
        await dockerToggle.press('Enter');
        assert.equal(await dockerToggle.getAttribute('aria-expanded'), 'true');
        await nativeButton.click();
        assert.equal(await nativeButton.getAttribute('aria-pressed'), 'true');
        await dockerToggle.focus();
        fixture.settle('vm', 0, 1, false, membershipSnapshot('vm', nativeRows.vm));
        await fixture.waitForState('vm', 'ready');
        assert.deepEqual(await unassignedNames(vm), ['leftover-vm']);
        assert.equal(await vmToggle.getAttribute('aria-expanded'), 'false');
        assert.equal(await dockerToggle.getAttribute('aria-expanded'), 'true');
        assert.equal(await dockerToggle.evaluate(node => document.activeElement === node), true);
    });

    test('Dashboard lifecycle retains only verified unassigned rows during stalled or failed refresh', async ({ page }) => {
        const initialDockerRows = {
            'fixture-docker': 'abcdabcd0001',
            'retained-docker': 'abcdabcd0002',
            'replaced-docker': 'abcdabcd0003',
            'removed-docker': 'abcdabcd0004'
        };
        const vmRows = { 'fixture-vm': 'fixture-uuid', 'leftover-vm': 'leftover-uuid' };
        let dockerRows = initialDockerRows;
        const fixture = await installDashboardLoadingFixture(page, baseUrl, {
            nativeMarkup: (type) => nativeMarkupFor(type, type === 'docker' ? dockerRows : vmRows)
        });
        const docker = fixture.widget('docker');
        const vm = fixture.widget('vm');
        await fixture.load();
        fixture.settle('docker', 0, 1, false, membershipSnapshot('docker', dockerRows));
        fixture.settle('vm', 0, 1, false, membershipSnapshot('vm', vmRows, { enabled: false }));
        await fixture.waitForState('docker', 'ready');
        await fixture.waitForState('vm', 'ready');
        assert.deepEqual(await unassignedNames(docker), ['retained-docker', 'replaced-docker', 'removed-docker']);
        assert.equal(await toggleFor(vm).count(), 0);
        await toggleFor(docker).click();

        await fixture.load();
        dockerRows = {
            'fixture-docker': 'abcdabcd0001',
            'retained-docker': 'abcdabcd0002',
            'replaced-docker': 'abcdabcd0005',
            'renamed-docker': 'abcdabcd0004'
        };
        await fixture.load();
        assert.deepEqual(await unassignedNames(docker), ['retained-docker']);
        assert.equal(await toggleFor(docker).getAttribute('aria-expanded'), 'true');
        assert.equal(await docker.getByText('replaced-docker', { exact: true }).isVisible(), true);
        assert.equal(await docker.getByText('renamed-docker', { exact: true }).isVisible(), true);

        fixture.settle('vm', 2, 3, false, membershipSnapshot('vm', vmRows, { enabled: false }));
        fixture.settle('docker', 2, 3, true);
        await fixture.waitForState('docker', 'failed');
        await fixture.waitForState('vm', 'ready');
        assert.deepEqual(await unassignedNames(docker), ['retained-docker']);
        const staleReplies = ['docker', 'vm'].map(type => page.waitForResponse(response => {
            const url = new URL(response.url());
            return url.pathname.endsWith('/runtime_snapshot.php') && url.searchParams.get('type') === type;
        }));
        fixture.settle('docker', 1, 2, false, membershipSnapshot('docker', initialDockerRows, { enabled: false }));
        fixture.settle('vm', 1, 2, false, membershipSnapshot('vm', vmRows));
        await Promise.all(staleReplies);
        assert.equal(await toggleFor(docker).count(), 1);
        assert.equal(await toggleFor(vm).count(), 0);
        assert.deepEqual(await unassignedNames(docker), ['retained-docker']);

        await fixture.load();
        await page.evaluate(() => window.FolderViewPlusPrefsStore.getDefaultCoordinator().reconcile('docker', {
            dashboard: { layout: 'fullwidth' }, groupUnassignedItems: false, _metadata: { prefsRevision: 4 }
        }));
        assert.equal(await toggleFor(docker).count(), 0);
        assert.equal(await docker.getByRole('button', { name: 'Native retained-docker control' }).isVisible(), true);
        fixture.settle('docker', 3, 4, false, membershipSnapshot('docker', dockerRows, { enabled: false }));
        fixture.settle('vm', 3, 4, false, membershipSnapshot('vm', vmRows));
        await fixture.waitForState('docker', 'ready');
        await fixture.waitForState('vm', 'ready');
        assert.equal(await toggleFor(docker).count(), 0);
        assert.equal(await docker.getByRole('button', { name: 'Native retained-docker control' }).isVisible(), true);
        assert.deepEqual(await unassignedNames(vm), ['leftover-vm']);
    });
};
