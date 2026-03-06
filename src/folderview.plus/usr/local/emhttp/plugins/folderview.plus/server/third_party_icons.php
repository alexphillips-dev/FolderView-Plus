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
        $folderPath = "$baseDir/$name";
        if (!is_dir($folderPath)) {
            continue;
        }
        $iconCount = 0;
        $folderItems = @scandir($folderPath) ?: [];
        foreach ($folderItems as $file) {
            if ($file === '.' || $file === '..') {
                continue;
            }
            if ($file !== basename($file)) {
                continue;
            }
            $filePath = "$folderPath/$file";
            if (is_file($filePath) && isAllowedThirdPartyIconFile($file)) {
                $iconCount += 1;
            }
        }
        $folders[] = [
            'name' => $name,
            'iconCount' => $iconCount
        ];
    }
    usort($folders, static function (array $a, array $b): int {
        return strcasecmp((string)$a['name'], (string)$b['name']);
    });
    return $folders;
}

function listThirdPartyIconsInFolder(string $folder): array {
    $baseDir = ensureThirdPartyIconsDirExists();
    $safeFolder = sanitizeThirdPartySegment($folder, 'Folder');
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
    $safeFolder = sanitizeThirdPartySegment($folder, 'Folder');
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

    header('Content-Type: application/json');

    if ($action === 'list_folders') {
        echo json_encode([
            'ok' => true,
            'baseDir' => thirdPartyIconsBaseDir(),
            'folders' => listThirdPartyFolders()
        ]);
        exit;
    }

    if ($action === 'list_icons') {
        $folder = (string)($_GET['folder'] ?? '');
        $result = listThirdPartyIconsInFolder($folder);
        echo json_encode([
            'ok' => true,
            'folder' => $result['folder'],
            'icons' => $result['icons']
        ]);
        exit;
    }

    throw new RuntimeException('Unsupported action.');
} catch (Throwable $e) {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode([
        'ok' => false,
        'error' => $e->getMessage()
    ]);
}
