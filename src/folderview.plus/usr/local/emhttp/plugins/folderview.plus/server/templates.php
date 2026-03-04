<?php
require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");

header('Content-Type: application/json');

try {
    $type = ensureType((string)($_REQUEST['type'] ?? ''));
    $action = (string)($_REQUEST['action'] ?? 'list');

    if ($action === 'list') {
        echo json_encode([
            'ok' => true,
            'templates' => readFolderTemplates($type)
        ]);
        exit;
    }

    if ($action === 'create') {
        $folderId = (string)($_REQUEST['folderId'] ?? '');
        $name = (string)($_REQUEST['name'] ?? '');
        $result = createFolderTemplateFromFolder($type, $folderId, $name);
        echo json_encode([
            'ok' => true,
            'template' => $result['template'],
            'templates' => $result['templates']
        ]);
        exit;
    }

    if ($action === 'delete') {
        $templateId = (string)($_REQUEST['templateId'] ?? '');
        echo json_encode([
            'ok' => true,
            'templates' => deleteFolderTemplate($type, $templateId)
        ]);
        exit;
    }

    if ($action === 'apply') {
        $templateId = (string)($_REQUEST['templateId'] ?? '');
        $folderId = (string)($_REQUEST['folderId'] ?? '');
        $apply = applyFolderTemplateToFolder($type, $templateId, $folderId);
        echo json_encode([
            'ok' => true,
            'apply' => $apply
        ]);
        exit;
    }

    throw new RuntimeException('Unsupported action.');
} catch (Throwable $e) {
    http_response_code(400);
    echo json_encode([
        'ok' => false,
        'error' => $e->getMessage()
    ]);
}
