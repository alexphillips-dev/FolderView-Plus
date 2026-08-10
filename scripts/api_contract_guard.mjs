#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serverDirArgIndex = process.argv.indexOf('--server-dir');
const serverDir = serverDirArgIndex >= 0 && process.argv[serverDirArgIndex + 1]
  ? path.resolve(process.argv[serverDirArgIndex + 1])
  : path.join(repoRoot, 'src', 'folderview.plus', 'usr', 'local', 'emhttp', 'plugins', 'folderview.plus', 'server');
const manifestPath = path.join(serverDir, 'api-endpoints.json');
const allowedMethods = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
const allowedAccess = new Set(['read-only', 'mutation', 'mixed']);
const allowedTokens = new Set(['none', 'mutation', 'bootstrap']);
const allowedResponses = new Set(['json', 'text', 'binary', 'mixed']);

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exitCode = 1;
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`Unable to read ${path.relative(repoRoot, file)}: ${error.message}`);
  }
}

function effective(defaults, definition) {
  return { ...defaults, ...definition };
}

function validateStringList(value, label, { nonEmpty = false } = {}) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || item.trim() === '')) {
    fail(`${label} must be an array of non-empty strings.`);
    return;
  }
  if (nonEmpty && value.length === 0) {
    fail(`${label} must not be empty.`);
  }
}

function validateContract(contract, label, { allowMixed = false } = {}) {
  validateStringList(contract.methods, `${label}.methods`, { nonEmpty: true });
  for (const method of contract.methods ?? []) {
    if (!allowedMethods.has(method)) fail(`${label}.methods contains unsupported method ${method}.`);
  }
  if (!allowedAccess.has(contract.access) || (!allowMixed && contract.access === 'mixed')) {
    fail(`${label}.access must be ${allowMixed ? 'read-only, mutation, or mixed' : 'read-only or mutation'}.`);
  }
  if (!allowedTokens.has(contract.requestToken)) fail(`${label}.requestToken is invalid.`);
  if (contract.access === 'mutation' && !['mutation', 'bootstrap'].includes(contract.requestToken)) {
    fail(`${label} is mutating but does not require an approved request guard.`);
  }
  if (contract.access === 'read-only' && contract.requestToken !== 'none') {
    fail(`${label} is read-only but declares a mutation token requirement.`);
  }
  if (typeof contract.replayProtection !== 'boolean') {
    fail(`${label}.replayProtection must be a boolean.`);
  }
  if (contract.access === 'mutation' && contract.replayProtection === false
      && (typeof contract.replayExemptReason !== 'string' || contract.replayExemptReason.trim() === '')) {
    fail(`${label} disables replay protection without documenting replayExemptReason.`);
  }
  const rateLimit = contract.rateLimit;
  if (!rateLimit || typeof rateLimit !== 'object'
      || !Number.isInteger(rateLimit.windowSeconds) || rateLimit.windowSeconds < 1 || rateLimit.windowSeconds > 3600
      || !Number.isInteger(rateLimit.maxRequests) || rateLimit.maxRequests < 1 || rateLimit.maxRequests > 10000) {
    fail(`${label}.rateLimit must define bounded windowSeconds and maxRequests.`);
  }
  validateStringList(contract.requestContentTypes, `${label}.requestContentTypes`);
  validateStringList(contract.responseContentTypes, `${label}.responseContentTypes`, { nonEmpty: true });
  if (!Number.isInteger(contract.maxRequestBytes) || contract.maxRequestBytes < 0) {
    fail(`${label}.maxRequestBytes must be a non-negative integer.`);
  }
  if (!allowedResponses.has(contract.responseType)) fail(`${label}.responseType is invalid.`);
  if (typeof contract.auditCategory !== 'string' || contract.auditCategory.trim() === '') {
    fail(`${label}.auditCategory must be a non-empty string.`);
  }
  const required = contract.requiredParameters;
  if (Array.isArray(required)) {
    validateStringList(required, `${label}.requiredParameters`);
  } else if (required && typeof required === 'object') {
    for (const [method, names] of Object.entries(required)) {
      if (!allowedMethods.has(method)) fail(`${label}.requiredParameters has unsupported method ${method}.`);
      validateStringList(names, `${label}.requiredParameters.${method}`);
    }
  } else {
    fail(`${label}.requiredParameters must be an array or method map.`);
  }
}

try {
  const manifest = readJson(manifestPath);
  if (manifest.schemaVersion !== 2) fail('api-endpoints.json schemaVersion must be 2.');
  if (!manifest.defaults || typeof manifest.defaults !== 'object') fail('api-endpoints.json must define defaults.');
  if (!manifest.endpoints || typeof manifest.endpoints !== 'object' || Array.isArray(manifest.endpoints)) {
    fail('api-endpoints.json must define an endpoints object.');
  }

  const endpointFiles = fs.readdirSync(serverDir)
    .filter((name) => name.endsWith('.php') && !name.startsWith('lib'))
    .sort();
  const registered = Object.keys(manifest.endpoints ?? {}).sort();
  for (const name of endpointFiles.filter((name) => !registered.includes(name))) fail(`Endpoint ${name} is missing from api-endpoints.json.`);
  for (const name of registered.filter((name) => !endpointFiles.includes(name))) fail(`Manifest entry ${name} has no PHP endpoint.`);

  for (const name of registered) {
    const definition = manifest.endpoints[name];
    if (!definition || typeof definition !== 'object' || Array.isArray(definition)) {
      fail(`endpoints.${name} must be an object.`);
      continue;
    }
    const base = effective(manifest.defaults, definition);
    validateContract(base, `endpoints.${name}`, { allowMixed: true });

    const variants = [];
    for (const [method, override] of Object.entries(definition.methodContracts ?? {})) {
      if (!allowedMethods.has(method)) fail(`endpoints.${name}.methodContracts contains unsupported method ${method}.`);
      variants.push([`methodContracts.${method}`, effective(base, override)]);
    }
    for (const [action, override] of Object.entries(definition.actions ?? {})) {
      variants.push([`actions.${action}`, effective(base, override)]);
    }
    if (base.access === 'mixed' && variants.length === 0) {
      fail(`endpoints.${name} is mixed but defines no action or method contracts.`);
    }
    for (const [variantName, variant] of variants) {
      validateContract(variant, `endpoints.${name}.${variantName}`);
      for (const method of variant.methods ?? []) {
        if (!(base.methods ?? []).includes(method)) fail(`endpoints.${name}.${variantName} method ${method} is not allowed by the endpoint.`);
      }
    }

    const source = fs.readFileSync(path.join(serverDir, name), 'utf8');
    const includesSharedLib = source.includes('server/lib.php');
    const includesContractLib = source.includes('lib.api-contract.php');
    if (!includesSharedLib && !includesContractLib) fail(`Endpoint ${name} does not load the shared API contract runtime.`);
    if (!source.includes('fvplus_json_try(') && !source.includes('fvplus_enforce_current_api_contract(')) {
      fail(`Endpoint ${name} does not enforce its registered API contract.`);
    }
    const responseTypes = new Set([base.responseType, ...variants.map(([, item]) => item.responseType)]);
    if (responseTypes.has('json') && !/fvplus_json_(?:try|ok|response)\s*\(|json_encode\s*\(/.test(source)) {
      fail(`Endpoint ${name} declares JSON responses without a JSON response implementation.`);
    }
  }

  const sharedLib = fs.readFileSync(path.join(serverDir, 'lib.php'), 'utf8');
  const contractLib = fs.readFileSync(path.join(serverDir, 'lib.api-contract.php'), 'utf8');
  if (!/function fvplus_json_try[\s\S]*?fvplus_enforce_current_api_contract\(\)/.test(sharedLib)) {
    fail('fvplus_json_try() must enforce the current endpoint contract before invoking its handler.');
  }
  if (!/requestToken[^\n]*mutation[\s\S]*?requireMutationRequestGuard\(\)/.test(contractLib)) {
    fail('The API contract runtime must route mutation declarations through requireMutationRequestGuard().');
  }
  if (!/requestToken[^\n]*bootstrap[\s\S]*?fvplus_require_nonce_bootstrap_guard\(\)/.test(contractLib)) {
    fail('The API contract runtime must route nonce bootstrap declarations through fvplus_require_nonce_bootstrap_guard().');
  }
} catch (error) {
  fail(error.message);
}

if (process.exitCode) process.exit(process.exitCode);
console.log('API endpoint manifest contract guard passed.');
