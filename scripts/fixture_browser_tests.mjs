import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { chromium, firefox, webkit } from 'playwright';
import { createFixtureBrowserServer } from './lib/fixture-browser-server.mjs';
import { runFixtureBrowserSuite } from './lib/fixture-browser-runner.mjs';
import { registerFoundationFixtureCases } from '../tests/browser/cases/foundation.mjs';
import { registerDockerFixtureCases } from '../tests/browser/cases/docker.mjs';
import { registerDashboardLifecycleFixtureCases } from '../tests/browser/cases/dashboard-lifecycle.mjs';
import { registerRuntimeInteractionsFixtureCases } from '../tests/browser/cases/runtime-interactions.mjs';
import { registerSettingsFixtureCases } from '../tests/browser/cases/settings.mjs';
import { registerFolderEditorFixtureCases } from '../tests/browser/cases/folder-editor.mjs';
import { registerImportFixtureCases } from '../tests/browser/cases/import.mjs';

const scriptPath = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(scriptPath), '..');
const pluginDir = path.join(rootDir, 'src', 'folderview.plus', 'usr', 'local', 'emhttp', 'plugins', 'folderview.plus');
const fixtureDir = path.join(rootDir, 'tests', 'browser', 'fixtures');
const artifactDir = path.resolve(process.env.FVPLUS_FIXTURE_BROWSER_ARTIFACT_DIR || path.join(rootDir, 'tmp', 'fixture-browser-artifacts'));
const timeoutMs = Math.max(5000, Number(process.env.FVPLUS_FIXTURE_BROWSER_TIMEOUT_MS) || 20000);
const requestedBrowsers = String(process.env.FVPLUS_FIXTURE_BROWSERS || 'chromium')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
const browserTypes = { chromium, firefox, webkit };
const axeScriptPath = path.join(rootDir, 'node_modules', 'axe-core', 'axe.min.js');
const accessibilityEnabled = !/^(0|false|no|off)$/i.test(String(process.env.FVPLUS_FIXTURE_ACCESSIBILITY || '1'));
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const englishSurfaceCatalog = readJson(path.join(pluginDir, 'langs', 'namespaces', 'en', 'legacy-surface.json'));
const germanSurfaceCatalog = readJson(path.join(pluginDir, 'langs', 'namespaces', 'de', 'legacy-surface.json'));
const surfaceKeyFor = (phrase) => Object.keys(englishSurfaceCatalog).find((key) => englishSurfaceCatalog[key] === phrase);

fs.mkdirSync(artifactDir, { recursive: true });

const fixtureServer = createFixtureBrowserServer({ rootDir, pluginDir, fixtureDir });
await new Promise((resolve, reject) => {
    fixtureServer.once('error', reject);
    fixtureServer.listen(0, '127.0.0.1', resolve);
});
const address = fixtureServer.address();
const baseUrl = `http://127.0.0.1:${address.port}`;

const tests = [];
const test = (name, handler, { skipAccessibility = false } = {}) => tests.push({ name, handler, skipAccessibility });

const caseContext = { test, baseUrl, surfaceKeyFor, germanSurfaceCatalog };
registerFoundationFixtureCases(caseContext);
registerDockerFixtureCases(caseContext);
registerDashboardLifecycleFixtureCases(caseContext);
registerRuntimeInteractionsFixtureCases(caseContext);
registerSettingsFixtureCases(caseContext);
registerFolderEditorFixtureCases(caseContext);
registerImportFixtureCases(caseContext);

await runFixtureBrowserSuite({
    fixtureServer, tests, requestedBrowsers, browserTypes, timeoutMs, accessibilityEnabled,
    axeScriptPath, artifactDir, rootDir
});
