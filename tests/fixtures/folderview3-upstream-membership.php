<?php
/*
 * Test-only upstream evaluator snapshot, chodeus/folder.view3
 * commit c111a74aba4ee62b1b64b2cfc0a14ab66fcc50ef.
 * Both functions below are unchanged; synthetic inputs are supplied by the test.
 *
 * MIT License
 *
 * Copyright (c) 2026 chodeus
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
function fv3_normalize_folders(array $folders): array {
        $out = [];
        foreach ($folders as $id => $f) {
            if (!is_array($f)) { continue; }
            $f['name'] = is_scalar($f['name'] ?? null) ? (string)$f['name'] : (string)$id;
            $f['icon'] = is_string($f['icon'] ?? null) ? $f['icon'] : '';
            $f['regex'] = is_string($f['regex'] ?? null) ? $f['regex'] : '';
            $f['containers'] = is_array($f['containers'] ?? null) ? array_values($f['containers']) : [];
            $f['hidden_preview'] = is_array($f['hidden_preview'] ?? null) ? array_values($f['hidden_preview']) : [];
            $f['actions'] = is_array($f['actions'] ?? null) ? array_values(array_filter($f['actions'], 'is_array')) : [];
            $f['settings'] = (object)(is_array($f['settings'] ?? null) ? $f['settings'] : []);
            foreach (['containerImages', 'containerIds'] as $k) {
                if (array_key_exists($k, $f)) { $f[$k] = (object)(is_array($f[$k]) ? $f[$k] : []); }
            }
            $out[$id] = $f;
        }
        return $out;
    }

function fv3_compute_folder_membership(array $folders, array $allContainerNames, array $ctLabels): array {
        // One malformed entry is dropped or filled in, not allowed to abort every folder's sync
        $folders = fv3_normalize_folders($folders);
        $folderNameSet = [];
        foreach ($folders as $folder) {
            if (isset($folder['name'])) { $folderNameSet[$folder['name']] = true; }
        }
        $folderContainers = [];
        $folderNames = [];
        $assignedContainers = [];
        $explicitMembers = [];
        foreach ($folders as $folder) {
            $explicitMembers = array_merge($explicitMembers, $folder['containers'] ?? []);
        }
        $explicitAssigned = $explicitMembers;
        foreach ($ctLabels as $ctName => $ctLabel) {
            if (isset($folderNameSet[$ctLabel])) { $explicitAssigned[] = $ctName; }
        }
        foreach ($folders as $folderId => $folder) {
            $members = $folder['containers'] ?? [];
            // is_string + trim, not empty(): empty("0") is true in PHP, so a regex of "0" was
            // silently dropped while docker.js applied it. The type check mirrors docker.js and
            // keeps a non-string regex from fataling trim() (TypeError on PHP 8).
            if (is_string($folder['regex'] ?? null) && trim($folder['regex']) !== '') {
                $regex = '/' . str_replace('/', '\/', $folder['regex']) . '/';
                foreach ($allContainerNames as $name) {
                    if (@preg_match($regex, $name) && !in_array($name, $members) && !in_array($name, $explicitAssigned)) {
                        $members[] = $name;
                    }
                }
            }
            // Explicit containers[] entries anywhere win over a label claim (issue #55)
            foreach ($ctLabels as $ctName => $ctLabel) {
                if ($ctLabel === ($folder['name'] ?? null) && !in_array($ctName, $members) && !in_array($ctName, $explicitMembers)) {
                    $members[] = $ctName;
                }
            }
            $members = array_values(array_filter($members, function($m) use ($allContainerNames, $assignedContainers) {
                return in_array($m, $allContainerNames) && !in_array($m, $assignedContainers);
            }));
            $folderContainers["folder-$folderId"] = $members;
            $folderNames["folder-$folderId"] = $folder['name'] ?? "folder-$folderId";
            $assignedContainers = array_merge($assignedContainers, $members);
        }
        return ['containers' => $folderContainers, 'names' => $folderNames, 'assigned' => $assignedContainers];
    }
