import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const modulePath = path.resolve(
    process.cwd(),
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.runtime.row-actions.js'
);
const rowActions = require(modulePath);

const createTarget = () => {
    const attributes = new Map([['data-fv-onclick', 'legacyHandler()']]);
    const target = {
        length: 1,
        first: () => target,
        removeAttr(name) {
            attributes.delete(name);
            return target;
        },
        attr(nameOrValues, value) {
            if (typeof nameOrValues === 'string' && value === undefined) {
                return attributes.get(nameOrValues);
            }
            const values = typeof nameOrValues === 'string'
                ? { [nameOrValues]: value }
                : nameOrValues;
            Object.entries(values).forEach(([name, nextValue]) => attributes.set(name, String(nextValue)));
            return target;
        },
        attributes
    };
    return target;
};

test('folder row actions replace declarative handlers and dispatch each action once', () => {
    const document = {};
    const delegated = new Map();
    const eventRoot = {
        off(eventName, selector) {
            delegated.delete(`${eventName}|${selector}`);
            return eventRoot;
        },
        on(eventName, selector, handler) {
            delegated.set(`${eventName}|${selector}`, handler);
            return eventRoot;
        }
    };
    const $ = (value) => {
        assert.equal(value, document);
        return eventRoot;
    };
    const targets = {
        '.folder-hand': createTarget(),
        '.folder-appname': createTarget(),
        '.folder-dropdown': createTarget()
    };
    const rowAttributes = new Map();
    const row = {
        length: 1,
        attr(name, value) {
            if (value === undefined) {
                return rowAttributes.get(name);
            }
            rowAttributes.set(name, String(value));
            return row;
        },
        find(selector) {
            return targets[selector];
        }
    };
    const calls = [];
    const controller = rowActions.createController({
        document,
        $,
        namespace: 'fvTestFolderRowAction',
        actionAttribute: 'data-fv-test-folder-action',
        handlers: {
            context: (id) => calls.push(`context:${id}`),
            edit: (id) => calls.push(`edit:${id}`),
            toggle: (id) => calls.push(`toggle:${id}`)
        }
    });

    controller.decorate(row, 'folder-1');
    for (const [selector, action] of Object.entries({
        '.folder-hand': 'context',
        '.folder-appname': 'edit',
        '.folder-dropdown': 'toggle'
    })) {
        assert.equal(targets[selector].attributes.has('data-fv-onclick'), false);
        assert.equal(targets[selector].attr('data-fv-test-folder-action'), action);
        assert.equal(targets[selector].attr('data-fv-folder-id'), 'folder-1');
    }
    assert.equal(targets['.folder-dropdown'].attr('type'), 'button');

    controller.bind();
    const delegatedHandler = delegated.get('click.fvTestFolderRowAction|[data-fv-test-folder-action]');
    assert.equal(typeof delegatedHandler, 'function');
    let prevented = 0;
    for (const selector of Object.keys(targets)) {
        delegatedHandler.call({
            getAttribute(name) {
                return targets[selector].attr(name) || '';
            }
        }, {
            preventDefault() {
                prevented += 1;
            }
        });
    }
    assert.deepEqual(calls, ['context:folder-1', 'edit:folder-1', 'toggle:folder-1']);
    assert.equal(prevented, 3);

    controller.destroy();
    assert.equal(delegated.size, 0);
});
