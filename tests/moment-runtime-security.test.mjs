import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(process.cwd());
const includeDir = path.join(root, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/include');
const read = (name) => fs.readFileSync(path.join(includeDir, name), 'utf8');
const quietConsole = { warn() {}, error() {}, log() {} };

const loadCommonJsMoment = () => {
    const moduleLoads = [];
    const context = {
        module: { exports: {} },
        exports: {},
        console: quietConsole,
        require(name) {
            moduleLoads.push(name);
            throw new Error('Synthetic locale module is unavailable');
        }
    };
    vm.runInNewContext(read('moment.min.js'), context);
    return { moment: context.module.exports, moduleLoads };
};

test('bundled Moment never loads a path supplied by a crafted non-string locale', () => {
    const { moment, moduleLoads } = loadCommonJsMoment();
    const craftedLocale = {
        toLowerCase() { return this; },
        replace() { return this; },
        split() { return ['en']; },
        match() { return ['synthetic-match']; },
        toString() { return '../../synthetic-locale'; }
    };
    moment.locale(craftedLocale);
    assert.deepEqual(moduleLoads, []);
    assert.equal(moment.locale(), 'en');
    assert.equal(moment.utc('2026-10-02T12:00:00Z').format('YYYY-MM-DD'), '2026-10-02');
});

test('prototype property names cannot replace the active Moment locale', () => {
    const { moment } = loadCommonJsMoment();
    for (const locale of ['__proto__', 'constructor', 'prototype']) {
        moment.locale(locale);
        assert.equal(moment.locale(), 'en');
        assert.equal(moment.utc('2026-10-02T12:00:00Z').format('YYYY-MM-DD'), '2026-10-02');
    }
});

test('the actual browser Chart.js adapter preserves date parsing and timestamp arithmetic', () => {
    const context = vm.createContext({ console: quietConsole });
    for (const file of ['chart.min.js', 'moment.min.js', 'chartjs-adapter-moment.min.js']) {
        vm.runInContext(read(file), context);
    }
    const adapter = new context.Chart._adapters._date();
    const timestamp = Date.parse('2026-10-02T12:34:56Z');
    assert.equal(adapter.parse('2026-10-02T12:34:56Z'), timestamp);
    assert.equal(adapter.parse('invalid date'), null);
    assert.equal(adapter.format(timestamp, 'YYYY'), '2026');
    assert.equal(adapter.add(timestamp, 30, 'second'), timestamp + 30000);
    assert.equal(adapter.diff(timestamp + 30000, timestamp, 'second'), 30);
    assert.equal(adapter.startOf(timestamp + 456, 'second'), timestamp);
    assert.equal(adapter.endOf(timestamp, 'second'), timestamp + 999);
    const inventory = JSON.parse(fs.readFileSync(path.join(root, 'scripts/runtime_components.json'), 'utf8'));
    const component = inventory.components.find((entry) => entry.name === 'moment');
    assert.equal(context.moment.version, component.version);
    assert.equal(component.purl, `pkg:npm/moment@${context.moment.version}`);
});
