<?php
require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");

header('Content-Type: application/json');

try {
    $action = (string)($_REQUEST['action'] ?? 'list');
    $type = ensureType((string)($action === 'list' ? ($_GET['type'] ?? $_REQUEST['type'] ?? '') : ($_POST['type'] ?? '')));

    if ($action === 'list') {
        echo json_encode([
            'ok' => true,
            'templates' => readFolderTemplates($type)
        ]);
        exit;
    }

    requireMutationRequestGuard();

    if ($action === 'create') {
        $folderId = (string)($_POST['folderId'] ?? '');
        $name = (string)($_POST['name'] ?? '');
        $result = createFolderTemplateFromFolder($type, $folderId, $name);
        echo json_encode([
            'ok' => true,
            'template' => $result['template'],
            'templates' => $result['templates']
        ]);
        exit;
    }

    if ($action === 'delete') {
        $templateId = (string)($_POST['templateId'] ?? '');
        echo json_encode([
            'ok' => true,
            'templates' => deleteFolderTemplate($type, $templateId)
        ]);
        exit;
    }

    if ($action === 'apply') {
        $templateId = (string)($_POST['templateId'] ?? '');
        $folderId = (string)($_POST['folderId'] ?? '');
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
