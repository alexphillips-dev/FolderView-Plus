import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const repoRoot = path.resolve(process.cwd());
const supportPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.setup-assistant.js'
);
const supportSource = fs.readFileSync(supportPath, 'utf8');
const wizardSource = fs.readFileSync(path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.wizard.js'
), 'utf8');

const loadSupport = () => {
    const context = { window: {}, Object, Set, String, Array };
    vm.createContext(context);
    new vm.Script(supportSource, { filename: supportPath }).runInContext(context);
    return context.window.FolderViewPlusSetupAssistantSupport;
};

test('migration flow can skip the optional import step when no plans are enabled', () => {
    const support = loadSupport();
    const result = support.validateSetupAssistantImportPlans({
        docker: { include: false, parsed: null, warnings: [] },
        vm: { include: false, parsed: null, warnings: [] }
    });

    assert.deepEqual(Array.from(result.blockers), []);
    assert.deepEqual(Array.from(result.warnings), []);
    assert.deepEqual(Array.from(result.includeTypes), []);
    assert.match(wizardSource, /validateSetupAssistantImportPlans\(setupAssistantState\.importPlans\)/);
    assert.doesNotMatch(wizardSource, /Migrate route requires at least one enabled import/);
});

test('an enabled import still requires a selected and parsed file', () => {
    const support = loadSupport();
    const result = support.validateSetupAssistantImportPlans({
        docker: { include: true, parsed: null, warnings: [] },
        vm: { include: false, parsed: null, warnings: [] }
    });

    assert.deepEqual(Array.from(result.blockers), ['DOCKER import is enabled but no file is selected.']);
    assert.deepEqual(Array.from(result.includeTypes), ['docker']);
});

test('enabled legacy imports preserve review warnings without blocking navigation', () => {
    const support = loadSupport();
    const result = support.validateSetupAssistantImportPlans({
        docker: {
            include: true,
            parsed: { legacy: true },
            warnings: ['One legacy field will use a default.']
        }
    });

    assert.deepEqual(Array.from(result.blockers), []);
    assert.deepEqual(Array.from(result.warnings), [
        'DOCKER import uses legacy format. Review diff before apply.',
        'DOCKER: One legacy field will use a default.'
    ]);
});
