<?php
require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");

const FVPLUS_THIRD_PARTY_ICON_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'];

function thirdPartyIconsBaseDir(): string {
    global $sourceDir;
    return "$sourceDir/images/third-party-icons";
}

function ensureThirdPartyIconsDirExists(): string {
    $baseDir = thirdPartyIconsBaseDir();
    if (!is_dir($baseDir)) {
        @mkdir($baseDir, 0770, true);
    }
    return $baseDir;
}

function sanitizeThirdPartySegment(string $value, string $label): string {
    $trimmed = trim($value);
    if ($trimmed === '' || strlen($trimmed) > 120) {
        throw new RuntimeException("$label is required.");
    }
    if (strpos($trimmed, '/') !== false || strpos($trimmed, '\\') !== false || strpos($trimmed, '..') !== false) {
        throw new RuntimeException("Invalid $label.");
    }
    if (!preg_match('/^[A-Za-z0-9 ._()+-]+$/', $trimmed)) {
        throw new RuntimeException("Invalid $label.");
    }
    return $trimmed;
}

function sanitizeThirdPartyFolderPath(string $value, string $label): string {
    $trimmed = trim(str_replace('\\', '/', $value));
    if ($trimmed === '' || strlen($trimmed) > 240) {
        throw new RuntimeException("$label is required.");
    }
    if (strpos($trimmed, '..') !== false) {
        throw new RuntimeException("Invalid $label.");
    }
    $parts = array_values(array_filter(explode('/', $trimmed), static function (string $segment): bool {
        return $segment !== '';
    }));
    if (count($parts) === 0 || count($parts) > 6) {
        throw new RuntimeException("Invalid $label.");
    }
    $safeParts = [];
    foreach ($parts as $part) {
        $safeParts[] = sanitizeThirdPartySegment($part, $label);
    }
    return implode('/', $safeParts);
}

function isAllowedThirdPartyIconFile(string $filename): bool {
    $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
    return $extension !== '' && in_array($extension, FVPLUS_THIRD_PARTY_ICON_EXTENSIONS, true);
}

function thirdPartyIconMimeType(string $filename): string {
    $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
    $map = [
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'gif' => 'image/gif',
        'webp' => 'image/webp',
        'svg' => 'image/svg+xml',
        'bmp' => 'image/bmp',
        'ico' => 'image/x-icon',
        'avif' => 'image/avif'
    ];
    return $map[$extension] ?? 'application/octet-stream';
}

function countSupportedIconsInDirectory(string $directory): int {
    if (!is_dir($directory)) {
        return 0;
    }
    $count = 0;
    $items = @scandir($directory) ?: [];
    foreach ($items as $name) {
        if ($name === '.' || $name === '..') {
            continue;
        }
        if ($name !== basename($name)) {
            continue;
        }
        $path = "$directory/$name";
        if (is_file($path) && isAllowedThirdPartyIconFile($name)) {
            $count += 1;
        }
    }
    return $count;
}

function listThirdPartyFolders(): array {
    $baseDir = ensureThirdPartyIconsDirExists();
    $folders = [];
    $items = @scandir($baseDir) ?: [];
    foreach ($items as $name) {
        if ($name === '.' || $name === '..') {
            continue;
        }
        if ($name !== basename($name)) {
            continue;
        }
        try {
            $safeName = sanitizeThirdPartySegment($name, 'Folder');
        } catch (Throwable $_error) {
            continue;
        }
        $folderPath = "$baseDir/$safeName";
        if (!is_dir($folderPath)) {
            continue;
        }
        $iconCount = countSupportedIconsInDirectory($folderPath);
        if ($iconCount > 0) {
            $folders[] = [
                'name' => $safeName,
                'iconCount' => $iconCount
            ];
        }
        $folderItems = @scandir($folderPath) ?: [];
        foreach ($folderItems as $subName) {
            if ($subName === '.' || $subName === '..') {
                continue;
            }
            if ($subName !== basename($subName)) {
                continue;
            }
            try {
                $safeSubName = sanitizeThirdPartySegment($subName, 'Folder');
            } catch (Throwable $_error) {
                continue;
            }
            $subPath = "$folderPath/$safeSubName";
            if (!is_dir($subPath)) {
                continue;
            }
            $subIconCount = countSupportedIconsInDirectory($subPath);
            $folders[] = [
                'name' => "$safeName/$safeSubName",
                'iconCount' => $subIconCount
            ];
        }
    }
    usort($folders, static function (array $a, array $b): int {
        return strcasecmp((string)$a['name'], (string)$b['name']);
    });
    return $folders;
}

function listThirdPartyIconsInFolder(string $folder): array {
    $baseDir = ensureThirdPartyIconsDirExists();
    $safeFolder = sanitizeThirdPartyFolderPath($folder, 'Folder');
    $folderPath = "$baseDir/$safeFolder";
    if (!is_dir($folderPath)) {
        throw new RuntimeException('Folder does not exist.');
    }

    $icons = [];
    $items = @scandir($folderPath) ?: [];
    foreach ($items as $file) {
        if ($file === '.' || $file === '..') {
            continue;
        }
        if ($file !== basename($file)) {
            continue;
        }
        if (!isAllowedThirdPartyIconFile($file)) {
            continue;
        }
        $filePath = "$folderPath/$file";
        if (!is_file($filePath)) {
            continue;
        }
        $icons[] = [
            'name' => $file,
            'url' => '/plugins/folderview.plus/server/third_party_icons.php?action=file&folder='
                . rawurlencode($safeFolder)
                . '&file='
                . rawurlencode($file)
        ];
    }
    usort($icons, static function (array $a, array $b): int {
        return strcasecmp((string)$a['name'], (string)$b['name']);
    });
    return [
        'folder' => $safeFolder,
        'icons' => $icons
    ];
}

function resolveThirdPartyIconFilePath(string $folder, string $file): string {
    $baseDir = ensureThirdPartyIconsDirExists();
    $safeFolder = sanitizeThirdPartyFolderPath($folder, 'Folder');
    $safeFile = sanitizeThirdPartySegment($file, 'File');
    if (!isAllowedThirdPartyIconFile($safeFile)) {
        throw new RuntimeException('Unsupported icon file type.');
    }
    $folderPath = "$baseDir/$safeFolder";
    if (!is_dir($folderPath)) {
        throw new RuntimeException('Folder does not exist.');
    }
    $resolvedFolder = @realpath($folderPath);
    $resolvedBase = @realpath($baseDir);
    if (!is_string($resolvedFolder) || !is_string($resolvedBase) || strpos($resolvedFolder, $resolvedBase) !== 0) {
        throw new RuntimeException('Invalid folder path.');
    }
    $filePath = "$resolvedFolder/$safeFile";
    if (!is_file($filePath) || !is_readable($filePath)) {
        throw new RuntimeException('Icon file not found.');
    }
    $resolvedFile = @realpath($filePath);
    if (!is_string($resolvedFile) || strpos($resolvedFile, $resolvedFolder) !== 0) {
        throw new RuntimeException('Invalid icon file path.');
    }
    return $resolvedFile;
}

try {
    $action = (string)($_GET['action'] ?? 'list_folders');

    if ($action === 'file') {
        $folder = (string)($_GET['folder'] ?? '');
        $file = (string)($_GET['file'] ?? '');
        $path = resolveThirdPartyIconFilePath($folder, $file);
        $mime = thirdPartyIconMimeType($path);
        header('Content-Type: ' . $mime);
        header('Cache-Control: public, max-age=600');
        readfile($path);
        exit;
    }

    if ($action === 'list_folders') {
        fvplus_json_ok([
            'baseDir' => thirdPartyIconsBaseDir(),
            'folders' => listThirdPartyFolders()
        ]);
        exit;
    }

    if ($action === 'list_icons') {
        $folder = (string)($_GET['folder'] ?? '');
        $result = listThirdPartyIconsInFolder($folder);
        fvplus_json_ok([
            'folder' => $result['folder'],
            'icons' => $result['icons']
        ]);
        exit;
    }

    throw new RuntimeException('Unsupported action.');
} catch (Throwable $e) {
    fvplus_json_error($e->getMessage(), 400);
}
