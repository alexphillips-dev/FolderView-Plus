#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLUGIN_DIR="${ROOT_DIR}/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus"
BASELINE_FILE="${FVPLUS_PERF_BASELINE_FILE:-${ROOT_DIR}/scripts/perf_baseline.json}"

# shellcheck source=scripts/lib.sh
source "${ROOT_DIR}/scripts/lib.sh"
fvplus::require_commands node

node - "${PLUGIN_DIR}" "${BASELINE_FILE}" <<'NODE'
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const pluginDir = process.argv[2];
const baselineFile = process.argv[3];

const trackedAssets = [
  'scripts/folderviewplus.js',
  'scripts/folderviewplus.wizard.js',
  'scripts/folderviewplus.import.js',
  'styles/folderviewplus.css',
  'scripts/docker.js',
  'scripts/vm.js',
  'scripts/folder.js',
];
const settingsRuntimePaths = [
  'scripts/folderviewplus.js',
  'scripts/folderviewplus.wizard.js',
  'scripts/folderviewplus.import.js',
];

const walkAssets = (dir, out) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(pluginDir, fullPath).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      if (relPath === 'scripts/include' || relPath.startsWith('scripts/include/')) {
        continue;
      }
      walkAssets(fullPath, out);
      continue;
    }
    if (/\.(js|css)$/i.test(entry.name)) {
      out.push(fullPath);
    }
  }
};

const metricsByPath = {};
let totalJs = 0;
let totalCss = 0;
let totalJsGzip = 0;
let totalCssGzip = 0;

const allAssets = [];
walkAssets(pluginDir, allAssets);
for (const fullPath of allAssets) {
  const relPath = path.relative(pluginDir, fullPath).replace(/\\/g, '/');
  const bytes = fs.statSync(fullPath).size;
  const gzipBytes = zlib.gzipSync(fs.readFileSync(fullPath), { level: 9 }).length;
  metricsByPath[relPath] = { bytes, gzipBytes };
  if (relPath.endsWith('.js')) {
    totalJs += bytes;
    totalJsGzip += gzipBytes;
  } else if (relPath.endsWith('.css')) {
    totalCss += bytes;
    totalCssGzip += gzipBytes;
  }
}

const existing = fs.existsSync(baselineFile) ? JSON.parse(fs.readFileSync(baselineFile, 'utf8')) : {};
const notes =
  typeof existing.notes === 'string' && existing.notes.trim().length > 0
    ? existing.notes
    : 'Baseline for perf ratchet guard. Update intentionally when expected growth is accepted.';

const assets = {};
for (const relPath of trackedAssets) {
  if (!metricsByPath[relPath]) {
    console.error(`ERROR: Missing tracked performance asset: ${relPath}`);
    process.exit(1);
  }
  assets[relPath] = metricsByPath[relPath];
}

const settingsRuntimeTotals = settingsRuntimePaths.reduce(
  (acc, relPath) => {
    const metric = metricsByPath[relPath];
    if (!metric) {
      console.error(`ERROR: Missing settings runtime asset: ${relPath}`);
      process.exit(1);
    }
    acc.bytes += metric.bytes;
    acc.gzipBytes += metric.gzipBytes;
    return acc;
  },
  { bytes: 0, gzipBytes: 0 }
);

const baseline = {
  version: 1,
  generatedAt: new Date().toISOString(),
  notes,
  assets,
  totals: {
    totalJs,
    totalCss,
    totalJsGzip,
    totalCssGzip,
    settingsRuntimeJs: settingsRuntimeTotals.bytes,
    settingsRuntimeJsGzip: settingsRuntimeTotals.gzipBytes,
  },
};

const comparable = (value) =>
  JSON.stringify(value, (key, inner) => (key === 'generatedAt' ? '__ts__' : inner), 2);

if (fs.existsSync(baselineFile)) {
  const before = JSON.parse(fs.readFileSync(baselineFile, 'utf8'));
  if (comparable(before) === comparable(baseline)) {
    console.log(`Performance baseline already current: ${path.basename(baselineFile)}.`);
    process.exit(0);
  }
}

fs.writeFileSync(baselineFile, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8');
console.log(`Updated performance baseline: ${path.basename(baselineFile)}.`);
NODE
