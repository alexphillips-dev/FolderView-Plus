#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {
    compareSanitizedSupportBundles,
    renderSupportBundleComparisonMarkdown
} from './lib/support_bundle_compare.mjs';

const args = process.argv.slice(2);
const jsonModeIndex = args.indexOf('--json');
const jsonMode = jsonModeIndex >= 0;
if (jsonMode) args.splice(jsonModeIndex, 1);
if (args.length !== 2) {
    console.error('Usage: node scripts/compare_support_bundles.mjs [--json] <left.json> <right.json>');
    process.exit(2);
}

const readBundle = (input) => {
    const file = path.resolve(input);
    return JSON.parse(fs.readFileSync(file, 'utf8'));
};

try {
    const report = compareSanitizedSupportBundles(readBundle(args[0]), readBundle(args[1]));
    process.stdout.write(jsonMode
        ? `${JSON.stringify(report, null, 2)}\n`
        : renderSupportBundleComparisonMarkdown(report));
} catch (error) {
    console.error(`Support bundle comparison failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
}
