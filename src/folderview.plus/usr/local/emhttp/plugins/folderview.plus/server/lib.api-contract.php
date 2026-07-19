<?php

final class FVPlusApiContractException extends RuntimeException
{
}

function fvplus_load_api_endpoint_manifest(): array
{
    static $manifest = null;
    if (is_array($manifest)) {
        return $manifest;
    }

    $path = __DIR__ . '/api-endpoints.json';
    $raw = @file_get_contents($path);
    if (!is_string($raw) || trim($raw) === '') {
        throw new FVPlusApiContractException('API endpoint manifest is unavailable.', 500);
    }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded) || !isset($decoded['endpoints']) || !is_array($decoded['endpoints'])) {
        throw new FVPlusApiContractException('API endpoint manifest is invalid.', 500);
    }
    $manifest = $decoded;
    return $manifest;
}

function fvplus_api_contract_request_value(string $name, string $method)
{
    if ($method === 'GET') {
        return $_GET[$name] ?? null;
    }
    if ($method === 'POST') {
        return $_POST[$name] ?? null;
    }
    return $_REQUEST[$name] ?? null;
}

function fvplus_api_contract_required_parameters(array $contract, string $method): array
{
    $required = $contract['requiredParameters'] ?? [];
    if (!is_array($required)) {
        return [];
    }
    if (array_is_list($required)) {
        return $required;
    }
    $methodRequired = $required[$method] ?? [];
    return is_array($methodRequired) ? $methodRequired : [];
}

function fvplus_resolve_api_endpoint_contract(string $endpoint, ?string $method = null): array
{
    $manifest = fvplus_load_api_endpoint_manifest();
    $definition = $manifest['endpoints'][$endpoint] ?? null;
    if (!is_array($definition)) {
        throw new FVPlusApiContractException('Endpoint is not registered in the API contract.', 500);
    }

    $defaults = is_array($manifest['defaults'] ?? null) ? $manifest['defaults'] : [];
    $definition = array_replace($defaults, $definition);

    $method = strtoupper(trim((string)($method ?? ($_SERVER['REQUEST_METHOD'] ?? 'GET'))));
    $effective = $definition;
    $effective['endpoint'] = $endpoint;
    $effective['method'] = $method;

    $methodContracts = $definition['methodContracts'] ?? null;
    if (is_array($methodContracts) && is_array($methodContracts[$method] ?? null)) {
        foreach ($methodContracts[$method] as $key => $value) {
            $effective[$key] = $value;
        }
    }

    $actions = $definition['actions'] ?? null;
    if (is_array($actions)) {
        $parameter = trim((string)($definition['actionParameter'] ?? 'action'));
        $action = trim((string)($_REQUEST[$parameter] ?? fvplus_api_contract_request_value($parameter, $method) ?? ($definition['defaultAction'] ?? '')));
        if ($action === '') {
            $action = (string)($definition['defaultAction'] ?? '');
        }
        $actionDefinition = $actions[$action] ?? null;
        if (!is_array($actionDefinition)) {
            throw new FVPlusApiContractException('Unsupported endpoint action.', 400);
        }
        foreach ($actionDefinition as $key => $value) {
            $effective[$key] = $value;
        }
        $effective['action'] = $action;
    }

    return $effective;
}

function fvplus_api_contract_has_body(string $method): bool
{
    if (!in_array($method, ['POST', 'PUT', 'PATCH'], true)) {
        return false;
    }
    $contentLength = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
    return $contentLength > 0 || count($_POST) > 0 || count($_FILES) > 0;
}

function fvplus_api_contract_assert_required(array $contract): void
{
    $method = (string)$contract['method'];
    foreach (fvplus_api_contract_required_parameters($contract, $method) as $name) {
        $name = trim((string)$name);
        if ($name === '') {
            continue;
        }
        $value = fvplus_api_contract_request_value($name, $method);
        $missing = $value === null
            || (is_string($value) && trim($value) === '')
            || (is_array($value) && count($value) === 0);
        if ($missing) {
            throw new FVPlusApiContractException("Missing required parameter: {$name}.", 400);
        }
    }
}

function fvplus_enforce_api_contract_for_endpoint(string $endpoint, ?callable $mutationGuard = null): array
{
    $contract = fvplus_resolve_api_endpoint_contract($endpoint);
    $method = (string)$contract['method'];
    $allowedMethods = array_map('strtoupper', is_array($contract['methods'] ?? null) ? $contract['methods'] : []);
    if (!in_array($method, $allowedMethods, true)) {
        throw new FVPlusApiContractException('Unsupported method.', 405);
    }

    $maxBytes = max(0, (int)($contract['maxRequestBytes'] ?? 0));
    $contentLength = max(0, (int)($_SERVER['CONTENT_LENGTH'] ?? 0));
    if ($maxBytes > 0 && $contentLength > $maxBytes) {
        throw new FVPlusApiContractException('Request payload is too large.', 413);
    }

    if (fvplus_api_contract_has_body($method)) {
        $acceptedTypes = is_array($contract['requestContentTypes'] ?? null) ? $contract['requestContentTypes'] : [];
        $providedType = strtolower(trim(explode(';', (string)($_SERVER['CONTENT_TYPE'] ?? ''))[0]));
        if ($providedType !== '' && count($acceptedTypes) > 0 && !in_array($providedType, $acceptedTypes, true)) {
            throw new FVPlusApiContractException('Unsupported request content type.', 415);
        }
    }

    fvplus_api_contract_assert_required($contract);

    if (($contract['requestToken'] ?? 'none') === 'mutation') {
        if ($mutationGuard !== null) {
            $mutationGuard();
        } elseif (function_exists('requireMutationRequestGuard')) {
            requireMutationRequestGuard();
        } else {
            throw new FVPlusApiContractException('Mutation request guard is unavailable.', 500);
        }
    }

    $GLOBALS['fvplusApiContractContext'] = $contract;
    if (!headers_sent()) {
        header('X-FV-API-Contract: v' . (string)(fvplus_load_api_endpoint_manifest()['schemaVersion'] ?? 1));
        header('X-FV-Audit-Category: ' . (string)($contract['auditCategory'] ?? 'uncategorized'));
    }
    return $contract;
}

function fvplus_current_api_endpoint_name(): string
{
    $script = (string)($_SERVER['SCRIPT_FILENAME'] ?? $_SERVER['SCRIPT_NAME'] ?? '');
    return $script !== '' ? basename(str_replace('\\', '/', $script)) : '';
}

function fvplus_enforce_current_api_contract(?callable $mutationGuard = null): array
{
    $endpoint = fvplus_current_api_endpoint_name();
    if ($endpoint === '' || !str_ends_with(strtolower($endpoint), '.php')) {
        return [];
    }
    $manifest = fvplus_load_api_endpoint_manifest();
    if (!isset($manifest['endpoints'][$endpoint])) {
        $script = str_replace('\\', '/', (string)($_SERVER['SCRIPT_FILENAME'] ?? ''));
        $serverDir = str_replace('\\', '/', __DIR__);
        if ($script !== '' && dirname($script) === $serverDir && !str_starts_with($endpoint, 'lib')) {
            throw new FVPlusApiContractException('Endpoint is not registered in the API contract.', 500);
        }
        return [];
    }
    return fvplus_enforce_api_contract_for_endpoint($endpoint, $mutationGuard);
}

function fvplus_get_current_api_audit_category(): string
{
    $context = $GLOBALS['fvplusApiContractContext'] ?? [];
    return is_array($context) ? (string)($context['auditCategory'] ?? '') : '';
}
