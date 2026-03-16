#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLUGIN_DIR="${ROOT_DIR}/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus"
BASELINE_FILE="${FVPLUS_PERF_BASELINE_FILE:-${ROOT_DIR}/scripts/perf_baseline.json}"
MAX_GROWTH_PCT="${FVPLUS_MAX_BUDGET_GROWTH_PCT:-8}"
REQUIRE_BASELINE="${FVPLUS_REQUIRE_PERF_BASELINE:-0}"
# shellcheck source=scripts/lib.sh
source "${ROOT_DIR}/scripts/lib.sh"

fvplus::require_commands node

node - "${PLUGIN_DIR}" "${BASELINE_FILE}" "${MAX_GROWTH_PCT}" "${REQUIRE_BASELINE}" <<'NODE'
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const pluginDir = process.argv[2];
const baselineFile = process.argv[3];
const maxGrowthPct = Number.parseFloat(process.argv[4] || '');
const requireBaseline = /^(1|true|yes|on)$/i.test(String(process.argv[5] || '').trim());

if (!Number.isFinite(maxGrowthPct) || maxGrowthPct < 0) {
  console.error(`ERROR: Invalid FVPLUS_MAX_BUDGET_GROWTH_PCT value: ${process.argv[4]}`);
  process.exit(1);
}

const growthFactor = 1 + maxGrowthPct / 100;

const envInt = (name, fallback) => {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.error(`ERROR: Invalid numeric value for ${name}: ${raw}`);
    process.exit(1);
  }
  return parsed;
};

const budgets = [
  {
    path: 'scripts/folderviewplus.js',
    maxBytesEnv: 'FVPLUS_MAX_FOLDERVIEWPLUS_JS_BYTES',
    maxGzipBytesEnv: 'FVPLUS_MAX_FOLDERVIEWPLUS_JS_GZIP_BYTES',
    // Keep an absolute ceiling while relying on the baseline ratchet for tight growth control.
    // These caps are intentionally above current baseline to avoid false failures from stale limits.
    maxBytes: envInt('FVPLUS_MAX_FOLDERVIEWPLUS_JS_BYTES', 580000),
    maxGzipBytes: envInt('FVPLUS_MAX_FOLDERVIEWPLUS_JS_GZIP_BYTES', 110000),
  },
  {
    path: 'scripts/folderviewplus.wizard.js',
    maxBytesEnv: 'FVPLUS_MAX_FOLDERVIEWPLUS_WIZARD_JS_BYTES',
    maxGzipBytesEnv: 'FVPLUS_MAX_FOLDERVIEWPLUS_WIZARD_JS_GZIP_BYTES',
    maxBytes: envInt('FVPLUS_MAX_FOLDERVIEWPLUS_WIZARD_JS_BYTES', 260000),
    maxGzipBytes: envInt('FVPLUS_MAX_FOLDERVIEWPLUS_WIZARD_JS_GZIP_BYTES', 52000),
  },
  {
    path: 'scripts/folderviewplus.import.js',
    maxBytesEnv: 'FVPLUS_MAX_FOLDERVIEWPLUS_IMPORT_JS_BYTES',
    maxGzipBytesEnv: 'FVPLUS_MAX_FOLDERVIEWPLUS_IMPORT_JS_GZIP_BYTES',
    maxBytes: envInt('FVPLUS_MAX_FOLDERVIEWPLUS_IMPORT_JS_BYTES', 200000),
    maxGzipBytes: envInt('FVPLUS_MAX_FOLDERVIEWPLUS_IMPORT_JS_GZIP_BYTES', 40000),
  },
  {
    path: 'styles/folderviewplus.css',
    maxBytesEnv: 'FVPLUS_MAX_FOLDERVIEWPLUS_CSS_BYTES',
    maxGzipBytesEnv: 'FVPLUS_MAX_FOLDERVIEWPLUS_CSS_GZIP_BYTES',
    maxBytes: envInt('FVPLUS_MAX_FOLDERVIEWPLUS_CSS_BYTES', 120000),
    maxGzipBytes: envInt('FVPLUS_MAX_FOLDERVIEWPLUS_CSS_GZIP_BYTES', 20000),
  },
  {
    path: 'scripts/docker.js',
    maxBytesEnv: 'FVPLUS_MAX_DOCKER_JS_BYTES',
    maxGzipBytesEnv: 'FVPLUS_MAX_DOCKER_JS_GZIP_BYTES',
    maxBytes: envInt('FVPLUS_MAX_DOCKER_JS_BYTES', 220000),
    maxGzipBytes: envInt('FVPLUS_MAX_DOCKER_JS_GZIP_BYTES', 45000),
  },
  {
    path: 'scripts/vm.js',
    maxBytesEnv: 'FVPLUS_MAX_VM_JS_BYTES',
    maxGzipBytesEnv: 'FVPLUS_MAX_VM_JS_GZIP_BYTES',
    maxBytes: envInt('FVPLUS_MAX_VM_JS_BYTES', 100000),
    maxGzipBytes: envInt('FVPLUS_MAX_VM_JS_GZIP_BYTES', 25000),
  },
  {
    path: 'scripts/folder.js',
    maxBytesEnv: 'FVPLUS_MAX_FOLDER_JS_BYTES',
    maxGzipBytesEnv: 'FVPLUS_MAX_FOLDER_JS_GZIP_BYTES',
    maxBytes: envInt('FVPLUS_MAX_FOLDER_JS_BYTES', 130000),
    maxGzipBytes: envInt('FVPLUS_MAX_FOLDER_JS_GZIP_BYTES', 28000),
  },
];

let totalJsBudget = envInt('FVPLUS_MAX_TOTAL_JS_BYTES', 1115000);
let totalCssBudget = envInt('FVPLUS_MAX_TOTAL_CSS_BYTES', 250000);
let totalJsGzipBudget = envInt('FVPLUS_MAX_TOTAL_JS_GZIP_BYTES', 220000);
let totalCssGzipBudget = envInt('FVPLUS_MAX_TOTAL_CSS_GZIP_BYTES', 60000);
const settingsRuntimeBudget = {
  maxBytes: envInt('FVPLUS_MAX_SETTINGS_RUNTIME_JS_BYTES', 930000),
  maxGzipBytes: envInt('FVPLUS_MAX_SETTINGS_RUNTIME_JS_GZIP_BYTES', 180000),
};
const settingsRuntimePaths = [
  'scripts/folderviewplus.js',
  'scripts/folderviewplus.wizard.js',
  'scripts/folderviewplus.import.js',
];

let failed = false;
let totalJs = 0;
let totalCss = 0;
let totalJsGzip = 0;
let totalCssGzip = 0;
const metricsByPath = {};
const missingBaselineMetrics = [];

const walkFiles = (dir, out) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(pluginDir, full).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      // Exclude vendored third-party libraries from first-party performance budgets.
      if (rel === 'scripts/include' || rel.startsWith('scripts/include/')) {
        continue;
      }
      walkFiles(full, out);
      continue;
    }
    if (/\.(js|css)$/i.test(entry.name)) {
      out.push(full);
    }
  }
};

const allAssets = [];
walkFiles(pluginDir, allAssets);
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

const settingsRuntimeMetric = settingsRuntimePaths.reduce(
  (acc, relPath) => {
    const metric = metricsByPath[relPath];
    if (!metric) {
      acc.missing.push(relPath);
      return acc;
    }
    acc.bytes += metric.bytes;
    acc.gzipBytes += metric.gzipBytes;
    return acc;
  },
  { bytes: 0, gzipBytes: 0, missing: [] }
);
const runAbsoluteBudgetChecks = () => {
  if (settingsRuntimeMetric.missing.length > 0) {
    console.error(`ERROR: Missing settings runtime asset(s): ${settingsRuntimeMetric.missing.join(', ')}`);
    failed = true;
  } else {
    if (settingsRuntimeMetric.bytes > settingsRuntimeBudget.maxBytes) {
      console.error(
        `ERROR: Combined settings runtime JS exceeds byte budget (${settingsRuntimeMetric.bytes} > ${settingsRuntimeBudget.maxBytes}).`
      );
      failed = true;
    }
    if (settingsRuntimeMetric.gzipBytes > settingsRuntimeBudget.maxGzipBytes) {
      console.error(
        `ERROR: Combined settings runtime JS exceeds gzip budget (${settingsRuntimeMetric.gzipBytes} > ${settingsRuntimeBudget.maxGzipBytes}).`
      );
      failed = true;
    }
  }

  for (const budget of budgets) {
    const fullPath = path.join(pluginDir, budget.path);
    if (!fs.existsSync(fullPath)) {
      console.error(`ERROR: Missing asset for performance budget: ${budget.path}`);
      failed = true;
      continue;
    }
    const bytes = fs.statSync(fullPath).size;
    const gzipBytes = zlib.gzipSync(fs.readFileSync(fullPath), { level: 9 }).length;
    if (bytes > budget.maxBytes) {
      console.error(`ERROR: ${budget.path} exceeds byte budget (${bytes} > ${budget.maxBytes}).`);
      failed = true;
    }
    if (gzipBytes > budget.maxGzipBytes) {
      console.error(`ERROR: ${budget.path} exceeds gzip budget (${gzipBytes} > ${budget.maxGzipBytes}).`);
      failed = true;
    }
  }

  if (totalJs > totalJsBudget) {
    console.error(`ERROR: Total JS bytes exceed budget (${totalJs} > ${totalJsBudget}).`);
    failed = true;
  }
  if (totalCss > totalCssBudget) {
    console.error(`ERROR: Total CSS bytes exceed budget (${totalCss} > ${totalCssBudget}).`);
    failed = true;
  }
  if (totalJsGzip > totalJsGzipBudget) {
    console.error(`ERROR: Total JS gzip bytes exceed budget (${totalJsGzip} > ${totalJsGzipBudget}).`);
    failed = true;
  }
  if (totalCssGzip > totalCssGzipBudget) {
    console.error(`ERROR: Total CSS gzip bytes exceed budget (${totalCssGzip} > ${totalCssGzipBudget}).`);
    failed = true;
  }
};

let baseline = null;
if (fs.existsSync(baselineFile)) {
  try {
    baseline = JSON.parse(fs.readFileSync(baselineFile, 'utf8'));
  } catch (error) {
    console.error(`ERROR: Failed to parse baseline file ${baselineFile}: ${error.message}`);
    process.exit(1);
  }
  if (!baseline || typeof baseline !== 'object' || Array.isArray(baseline)) {
    console.error(`ERROR: Invalid baseline format in ${baselineFile}.`);
    process.exit(1);
  }
} else if (requireBaseline) {
  console.error(`ERROR: Required performance baseline file is missing: ${baselineFile}`);
  process.exit(1);
}

if (baseline) {
  const baselineAssets =
    baseline.assets && typeof baseline.assets === 'object' && !Array.isArray(baseline.assets)
      ? baseline.assets
      : {};
  const baselineTotals =
    baseline.totals && typeof baseline.totals === 'object' && !Array.isArray(baseline.totals)
      ? baseline.totals
      : {};

  const hasEnvOverride = (name) => (
    Object.prototype.hasOwnProperty.call(process.env, name)
    && String(process.env[name] || '').trim() !== ''
  );
  const applyBaselineAbsoluteFloor = (currentValue, baselineValue) => {
    if (!Number.isFinite(baselineValue) || baselineValue <= 0) {
      return currentValue;
    }
    return Math.max(currentValue, Math.ceil(baselineValue * growthFactor));
  };

  for (const budget of budgets) {
    const baseMetric = baselineAssets[budget.path] || {};
    if (!hasEnvOverride(String(budget.maxBytesEnv || ''))) {
      budget.maxBytes = applyBaselineAbsoluteFloor(budget.maxBytes, Number(baseMetric.bytes));
    }
    if (!hasEnvOverride(String(budget.maxGzipBytesEnv || ''))) {
      budget.maxGzipBytes = applyBaselineAbsoluteFloor(budget.maxGzipBytes, Number(baseMetric.gzipBytes));
    }
  }
  if (!hasEnvOverride('FVPLUS_MAX_TOTAL_JS_BYTES')) {
    totalJsBudget = applyBaselineAbsoluteFloor(totalJsBudget, Number(baselineTotals.totalJs));
  }
  if (!hasEnvOverride('FVPLUS_MAX_TOTAL_CSS_BYTES')) {
    totalCssBudget = applyBaselineAbsoluteFloor(totalCssBudget, Number(baselineTotals.totalCss));
  }
  if (!hasEnvOverride('FVPLUS_MAX_TOTAL_JS_GZIP_BYTES')) {
    totalJsGzipBudget = applyBaselineAbsoluteFloor(totalJsGzipBudget, Number(baselineTotals.totalJsGzip));
  }
  if (!hasEnvOverride('FVPLUS_MAX_TOTAL_CSS_GZIP_BYTES')) {
    totalCssGzipBudget = applyBaselineAbsoluteFloor(totalCssGzipBudget, Number(baselineTotals.totalCssGzip));
  }
  if (!hasEnvOverride('FVPLUS_MAX_SETTINGS_RUNTIME_JS_BYTES')) {
    settingsRuntimeBudget.maxBytes = applyBaselineAbsoluteFloor(settingsRuntimeBudget.maxBytes, Number(baselineTotals.settingsRuntimeJs));
  }
  if (!hasEnvOverride('FVPLUS_MAX_SETTINGS_RUNTIME_JS_GZIP_BYTES')) {
    settingsRuntimeBudget.maxGzipBytes = applyBaselineAbsoluteFloor(settingsRuntimeBudget.maxGzipBytes, Number(baselineTotals.settingsRuntimeJsGzip));
  }

  const checkRatchet = (label, currentValue, baselineValue) => {
    if (!Number.isFinite(baselineValue) || baselineValue <= 0) {
      missingBaselineMetrics.push(label);
      return;
    }
    const allowed = Math.ceil(baselineValue * growthFactor);
    if (currentValue > allowed) {
      console.error(
        `ERROR: ${label} exceeds ratchet budget (${currentValue} > ${allowed}, baseline ${baselineValue}, max growth ${maxGrowthPct}%).`
      );
      failed = true;
    }
  };

  for (const budget of budgets) {
    const metric = metricsByPath[budget.path];
    const baseMetric = baselineAssets[budget.path] || {};
    if (!metric) {
      continue;
    }
    checkRatchet(`${budget.path} bytes`, metric.bytes, Number(baseMetric.bytes));
    checkRatchet(`${budget.path} gzip`, metric.gzipBytes, Number(baseMetric.gzipBytes));
  }

  checkRatchet('totalJs bytes', totalJs, Number(baselineTotals.totalJs));
  checkRatchet('totalCss bytes', totalCss, Number(baselineTotals.totalCss));
  checkRatchet('totalJs gzip', totalJsGzip, Number(baselineTotals.totalJsGzip));
  checkRatchet('totalCss gzip', totalCssGzip, Number(baselineTotals.totalCssGzip));
  checkRatchet(
    'settingsRuntimeJs bytes',
    settingsRuntimeMetric.bytes,
    Number(baselineTotals.settingsRuntimeJs)
  );
  checkRatchet(
    'settingsRuntimeJs gzip',
    settingsRuntimeMetric.gzipBytes,
    Number(baselineTotals.settingsRuntimeJsGzip)
  );
}

runAbsoluteBudgetChecks();

if (missingBaselineMetrics.length > 0) {
  const uniqueMissing = [...new Set(missingBaselineMetrics)].sort();
  const message = `Missing baseline metric(s): ${uniqueMissing.join(', ')}`;
  if (requireBaseline) {
    console.error(`ERROR: ${message}`);
    failed = true;
  } else {
    console.log(`WARN: ${message}`);
  }
}

if (failed) {
  process.exit(1);
}

const baselineStatus = baseline ? path.basename(baselineFile) : 'not configured';
console.log(
  `Performance budget guard passed: JS ${totalJs}B (${totalJsGzip}B gzip), CSS ${totalCss}B (${totalCssGzip}B gzip), ratchet baseline ${baselineStatus}.`
);
NODE
