<?php
require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");

fvplus_json_try(function (): array {
    $action = (string)($_REQUEST['action'] ?? 'list');
    $type = ensureType((string)($action === 'list' ? ($_GET['type'] ?? $_REQUEST['type'] ?? '') : ($_POST['type'] ?? '')));

    if ($action === 'list') {
        return [
            'templates' => readFolderTemplates($type)
        ];
    }

    requireMutationRequestGuard();

    if ($action === 'create') {
        $folderId = (string)($_POST['folderId'] ?? '');
        $name = (string)($_POST['name'] ?? '');
        $result = createFolderTemplateFromFolder($type, $folderId, $name);
        return [
            'template' => $result['template'],
            'templates' => $result['templates']
        ];
    }

    if ($action === 'delete') {
        $templateId = (string)($_POST['templateId'] ?? '');
        return [
            'templates' => deleteFolderTemplate($type, $templateId)
        ];
    }

    if ($action === 'apply') {
        $templateId = (string)($_POST['templateId'] ?? '');
        $folderId = (string)($_POST['folderId'] ?? '');
        $apply = applyFolderTemplateToFolder($type, $templateId, $folderId);
        return [
            'apply' => $apply
        ];
    }

    throw new RuntimeException('Unsupported action.');
});
