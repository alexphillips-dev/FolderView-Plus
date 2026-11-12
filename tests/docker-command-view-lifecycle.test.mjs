import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.command-view.js', import.meta.url), 'utf8');

function fixture(display = '') {
    class Element {
        constructor() { this.style = { display }; this.dataset = {}; this.attributes = new Map(); this.children = []; }
        setAttribute(key, value) { this.attributes.set(key, value); }
        removeAttribute(key) { this.attributes.delete(key); }
        querySelectorAll() { return []; }
        insertBefore(child) { this.children.push(child); child.parentNode = this; }
        removeChild(child) { this.children = this.children.filter(node => node !== child); child.parentNode = null; }
        addEventListener() {}
        removeEventListener() {}
    }
    const parent = new Element(), table = new Element(), body = new Element();
    parent.insertBefore(table);
    const document = { body, querySelector: () => table, createElement: () => new Element(),
        getElementById: id => parent.children.find(node => node.id === id) };
    const window = { document };
    // The module attaches its browser API to the global object in this realm.
    const context = { document, HTMLElement: Element, Element };
    vm.runInNewContext(source, context);
    const api = context.FolderViewPlusDockerCommandView.createApi({ window, document,
        resolveRequestBundle: () => ({ render: [{}, {}, {}, {}] }) });
    return { api, table };
}

for (const display of ['', 'table', 'none']) {
    test(`command view restores original ${JSON.stringify(display)} display after repeated mounts`, async () => {
        const f = fixture(display);
        assert.equal((await f.api.mount()).ok, true);
        assert.equal(f.table.style.display, 'none');
        assert.equal((await f.api.mount()).ok, true);
        f.api.unmount();
        assert.equal(f.table.style.display, display);
        assert.equal(f.table.dataset.fvplusCommandPrevDisplay, undefined);
        f.api.unmount();
        assert.equal(f.table.style.display, display);
        await f.api.mount();
        f.api.unmount();
        assert.equal(f.table.style.display, display);
    });
}
