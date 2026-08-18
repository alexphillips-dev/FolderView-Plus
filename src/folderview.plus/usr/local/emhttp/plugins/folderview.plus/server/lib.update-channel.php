<?php
function resolveInstalledPluginChannel(): string {
        foreach (readInstalledManifestPathCandidates() as $manifestPath) {
            $contents = (string)@file_get_contents($manifestPath);
            if ($contents === '') {
                continue;
            }
            if (preg_match('/<PLUGINURL>[^<]*\/(dev|main)\/folderview\.plus\.plg<\/PLUGINURL>/i', $contents, $match)) {
                return strtolower((string)$match[1]) === 'dev' ? 'dev' : 'main';
            }
            if (preg_match('/<!ENTITY\s+pluginURL\s+"[^"]*\/(dev|main)\/folderview\.plus\.plg"\s*>/i', $contents, $match)) {
                return strtolower((string)$match[1]) === 'dev' ? 'dev' : 'main';
            }
        }
        return 'main';
    }

    function resolveInstalledPluginUpdateManifestUrl(): string {
        $channel = resolveInstalledPluginChannel();
        return 'https://raw.githubusercontent.com/alexphillips-dev/FolderView-Plus/' . $channel . '/folderview.plus.plg';
    }
