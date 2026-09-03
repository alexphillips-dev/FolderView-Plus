import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, firefox, webkit } from 'playwright';
import { readFixtureBrowserConfig } from './lib/fixture-browser-config.mjs';
import { createFixtureBrowserServer } from './lib/fixture-browser-server.mjs';
import { runFixtureBrowserSuite } from './lib/fixture-browser-runner.mjs';
import { registerFoundationFixtureCases } from '../tests/browser/cases/foundation.mjs';
import { registerDockerFixtureCases } from '../tests/browser/cases/docker.mjs';
import { registerDashboardLifecycleFixtureCases } from '../tests/browser/cases/dashboard-lifecycle.mjs'; import { registerStatusTextThemeFixtureCase } from '../tests/browser/cases/status-text-theme.mjs';
import { registerRuntimeInteractionsFixtureCases } from '../tests/browser/cases/runtime-interactions.mjs';
import { registerDockerHiddenFolderFixtureCases } from '../tests/browser/cases/docker-hidden-folders.mjs';
import { registerSettingsFixtureCases } from '../tests/browser/cases/settings.mjs';
import { registerSettingsStartOrderFixtureCases } from '../tests/browser/cases/settings-start-order.mjs';
import { registerFolderEditorFixtureCases } from '../tests/browser/cases/folder-editor.mjs';
import { registerFolderWebuiProfileFixtureCases } from '../tests/browser/cases/folder-webui-profiles.mjs'; import { registerFolderWebuiProfileThemeFixtureCase } from '../tests/browser/cases/folder-webui-profile-theme.mjs';
import { registerImportFixtureCases } from '../tests/browser/cases/import.mjs';
const scriptPath = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(scriptPath), '..');
const pluginDir = path.join(rootDir, 'src', 'folderview.plus', 'usr', 'local', 'emhttp', 'plugins', 'folderview.plus');
const fixtureDir = path.join(rootDir, 'tests', 'browser', 'fixtures');
const { artifactDir, timeoutMs, requestedBrowsers, colorSchemes, viewports, accessibilityEnabled } =
    readFixtureBrowserConfig(rootDir);
const browserTypes = { chromium, firefox, webkit };
const axeScriptPath = path.join(rootDir, 'node_modules', 'axe-core', 'axe.min.js');
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
const test = (name, handler, options = {}) => tests.push({ name, handler, ...options });

const caseContext = { test, baseUrl, surfaceKeyFor, germanSurfaceCatalog };
registerFoundationFixtureCases(caseContext);
registerDockerFixtureCases(caseContext);
registerDashboardLifecycleFixtureCases(caseContext); registerStatusTextThemeFixtureCase(caseContext);
registerRuntimeInteractionsFixtureCases(caseContext);
registerDockerHiddenFolderFixtureCases(caseContext);
registerSettingsFixtureCases(caseContext);
registerSettingsStartOrderFixtureCases(caseContext);
registerFolderEditorFixtureCases(caseContext); registerFolderWebuiProfileFixtureCases(caseContext); registerFolderWebuiProfileThemeFixtureCase(caseContext);
registerImportFixtureCases(caseContext);

await runFixtureBrowserSuite({
    fixtureServer, tests, requestedBrowsers, browserTypes, colorSchemes, viewports,
    timeoutMs, accessibilityEnabled,
    axeScriptPath, artifactDir, rootDir
});
