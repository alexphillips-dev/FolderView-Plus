#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLUGIN_DIR="${ROOT_DIR}/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus"
# shellcheck source=scripts/lib.sh
source "${ROOT_DIR}/scripts/lib.sh"

fvplus::require_commands node

node - "${PLUGIN_DIR}" <<'NODE'
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const pluginDir = process.argv[2];

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
    // Raised after UX and safety feature expansion; still bounded and overrideable via env.
    maxBytes: envInt('FVPLUS_MAX_FOLDERVIEWPLUS_JS_BYTES', 470000),
    maxGzipBytes: envInt('FVPLUS_MAX_FOLDERVIEWPLUS_JS_GZIP_BYTES', 90000),
  },
  {
    path: 'styles/folderviewplus.css',
    maxBytes: envInt('FVPLUS_MAX_FOLDERVIEWPLUS_CSS_BYTES', 120000),
    maxGzipBytes: envInt('FVPLUS_MAX_FOLDERVIEWPLUS_CSS_GZIP_BYTES', 20000),
  },
  {
    path: 'scripts/docker.js',
    maxBytes: envInt('FVPLUS_MAX_DOCKER_JS_BYTES', 220000),
    maxGzipBytes: envInt('FVPLUS_MAX_DOCKER_JS_GZIP_BYTES', 45000),
  },
  {
    path: 'scripts/vm.js',
    maxBytes: envInt('FVPLUS_MAX_VM_JS_BYTES', 100000),
    maxGzipBytes: envInt('FVPLUS_MAX_VM_JS_GZIP_BYTES', 25000),
  },
  {
    path: 'scripts/folder.js',
    maxBytes: envInt('FVPLUS_MAX_FOLDER_JS_BYTES', 120000),
    maxGzipBytes: envInt('FVPLUS_MAX_FOLDER_JS_GZIP_BYTES', 28000),
  },
];

const totalJsBudget = envInt('FVPLUS_MAX_TOTAL_JS_BYTES', 950000);
const totalCssBudget = envInt('FVPLUS_MAX_TOTAL_CSS_BYTES', 250000);
const totalJsGzipBudget = envInt('FVPLUS_MAX_TOTAL_JS_GZIP_BYTES', 220000);
const totalCssGzipBudget = envInt('FVPLUS_MAX_TOTAL_CSS_GZIP_BYTES', 60000);

let failed = false;
let totalJs = 0;
let totalCss = 0;
let totalJsGzip = 0;
let totalCssGzip = 0;

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
  if (relPath.endsWith('.js')) {
    totalJs += bytes;
    totalJsGzip += gzipBytes;
  } else if (relPath.endsWith('.css')) {
    totalCss += bytes;
    totalCssGzip += gzipBytes;
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

if (failed) {
  process.exit(1);
}

console.log(
  `Performance budget guard passed: JS ${totalJs}B (${totalJsGzip}B gzip), CSS ${totalCss}B (${totalCssGzip}B gzip).`
);
NODE
