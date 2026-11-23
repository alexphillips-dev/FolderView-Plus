import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const lib = fileURLToPath(new URL('../../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.php', import.meta.url));

export const phpOrder = (input) => {
    const fixture = `
        define('FVPLUS_CONFIG_ONLY_BOOTSTRAP', true);
        $_SERVER['DOCUMENT_ROOT'] = '';
        require $argv[1];
        $input = json_decode(stream_get_contents(STDIN), true, 512, JSON_THROW_ON_ERROR);
        $folders = normalizeFolderMapPayload($input['folders']);
        $prefs = $input['prefs'];
        $orderedFolders = reorderFolderMapByPrefs('docker', $folders, $prefs);
        if (!isset($input['names'])) { echo json_encode(array_keys($orderedFolders)); return; }
        $page = buildDockerPageOrderModel($input['native'], $orderedFolders, $prefs, $input['names']);
        $info = array_fill_keys($input['names'], []);
        $snapshot = fvplusBuildMembershipSnapshot('docker', $orderedFolders, [], $info, $page['names'], $page['displayFolderIds']);
        $members = [];
        foreach ($snapshot['byFolder'] as $id => $entry) $members['folder-' . $id] = $entry['displayMembers'];
        $context = [
            'pageFolderIds' => $page['pageFolderIds'], 'pageContainerNames' => $page['names'],
            'folderContainers' => $members, 'assignedContainers' => array_keys($snapshot['primaryOwnerByName']),
            'allContainerNames' => $input['names'], 'autoStartMap' => array_combine($input['names'], $input['names']),
            'prefs' => array_merge($prefs, ['dockerStartOrder' => ['mode' => 'docker-page']])
        ];
        $plan = buildDockerStartOrderPlan($context);
        $plan['savedOrder'] = composeDockerSavedOrder($input['native'], $orderedFolders, $prefs);
        $plan['folders'] = $orderedFolders;
        echo json_encode($plan, JSON_THROW_ON_ERROR);
    `;
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-docker-order-'));
    const env = {
        ...process.env,
        FVPLUS_TEST_CONFIG_DIR: path.join(root, 'config'),
        FVPLUS_TEST_SOURCE_DIR: path.join(root, 'runtime')
    };
    try {
        const result = spawnSync('php', ['-r', fixture, lib], { env, input: JSON.stringify(input), encoding: 'utf8', timeout: 15000 });
        assert.equal(result.status, 0, result.stderr || String(result.error || ''));
        return JSON.parse(result.stdout);
    } finally {
        assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
        assert.ok(path.basename(root).startsWith('fvplus-docker-order-'));
        fs.rmSync(root, { recursive: true, force: true });
    }
};
