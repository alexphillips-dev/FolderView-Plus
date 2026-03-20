#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLUGIN_DIR="${ROOT_DIR}/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus"
STRICT_MODE="${FVPLUS_DEAD_CODE_STRICT:-0}"
# shellcheck source=scripts/lib.sh
source "${ROOT_DIR}/scripts/lib.sh"

fvplus::require_commands node

node - "${PLUGIN_DIR}" "${STRICT_MODE}" <<'NODE'
const fs = require('fs');
const path = require('path');

const pluginDir = process.argv[2];
const strict = /^(1|true|yes|on)$/i.test(String(process.argv[3] || '').trim());

const walk = (dir, out = []) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(pluginDir, full).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      if (rel === 'scripts/include' || rel.startsWith('scripts/include/')) {
        continue;
      }
      walk(full, out);
      continue;
    }
    out.push(full);
  }
  return out;
};

const allFiles = walk(pluginDir, []);
const cssFiles = allFiles.filter((file) => file.endsWith('.css'));
const nonCssFiles = allFiles.filter((file) => (
  file.endsWith('.js')
  || file.endsWith('.php')
  || file.endsWith('.page')
  || file.endsWith('.html')
));

const selectorUsage = new Map();
const registerSelector = (selector, relFile) => {
  if (!selector) return;
  if (!selector.startsWith('.fv') && !selector.startsWith('#fv')) {
    return;
  }
  const bucket = selectorUsage.get(selector) || { cssRefs: new Set(), nonCssRefs: new Set() };
  bucket.cssRefs.add(relFile);
  selectorUsage.set(selector, bucket);
};

for (const cssFile of cssFiles) {
  const rel = path.relative(pluginDir, cssFile).replace(/\\/g, '/');
  const source = fs.readFileSync(cssFile, 'utf8');
  const matches = source.match(/(?:\.|#)fv[a-zA-Z0-9_-]*/g) || [];
  for (const selector of matches) {
    registerSelector(selector, rel);
  }
}

for (const file of nonCssFiles) {
  const rel = path.relative(pluginDir, file).replace(/\\/g, '/');
  const source = fs.readFileSync(file, 'utf8');
  for (const [selector, usage] of selectorUsage.entries()) {
    if (source.includes(selector.slice(1)) || source.includes(selector)) {
      usage.nonCssRefs.add(rel);
    }
  }
}

const suspects = [];
for (const [selector, usage] of selectorUsage.entries()) {
  if (usage.nonCssRefs.size === 0 && usage.cssRefs.size <= 1) {
    suspects.push({
      selector,
      cssRefs: Array.from(usage.cssRefs).sort(),
      nonCssRefs: []
    });
  }
}

if (suspects.length === 0) {
  console.log('Dead-code guard passed: no likely unused fv selectors detected.');
  process.exit(0);
}

const maxPrint = 40;
console.log(`Dead-code guard found ${suspects.length} likely-unused fv selector(s):`);
for (const item of suspects.slice(0, maxPrint)) {
  console.log(` - ${item.selector} (css: ${item.cssRefs.join(', ') || 'n/a'})`);
}
if (suspects.length > maxPrint) {
  console.log(` ... and ${suspects.length - maxPrint} more`);
}

if (strict) {
  console.error('ERROR: Dead-code selector guard failed in strict mode.');
  process.exit(1);
}
console.log('WARN: Dead-code selector guard is non-blocking (set FVPLUS_DEAD_CODE_STRICT=1 to enforce).');
NODE
