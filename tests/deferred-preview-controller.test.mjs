import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

class FakeElement {
    constructor(tagName = 'div') {
        this.tagName = tagName.toUpperCase();
        this.childNodes = [];
        this.parentNode = null;
        this.attributes = new Map();
        this.listeners = new Map();
        const classes = new Set();
        this.classList = {
            add: (name) => classes.add(name),
            remove: (name) => classes.delete(name),
            contains: (name) => classes.has(name)
        };
    }
    get firstChild() { return this.childNodes[0] || null; }
    appendChild(node) {
        if (node?.isFragment) {
            [...node.childNodes].forEach((child) => this.appendChild(child));
            return node;
        }
        node?.remove?.();
        this.childNodes.push(node);
        node.parentNode = this;
        return node;
    }
    remove() {
        if (!this.parentNode) return;
        const index = this.parentNode.childNodes.indexOf(this);
        if (index >= 0) this.parentNode.childNodes.splice(index, 1);
        this.parentNode = null;
    }
    addEventListener(type, listener) {
        if (!this.listeners.has(type)) this.listeners.set(type, new Set());
        this.listeners.get(type).add(listener);
    }
    removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
    dispatch(type) { [...(this.listeners.get(type) || [])].forEach((listener) => listener()); }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    getBoundingClientRect() { return { top: 5000, bottom: 5050 }; }
}

class FakeFragment {
    constructor() { this.isFragment = true; this.childNodes = []; }
    appendChild(node) {
        node?.remove?.();
        this.childNodes.push(node);
        node.parentNode = this;
        return node;
    }
}

class FakeIntersectionObserver {
    static latest = null;
    constructor(callback) {
        this.callback = callback;
        this.observed = new Set();
        this.disconnected = false;
        FakeIntersectionObserver.latest = this;
    }
    observe(target) { this.observed.add(target); }
    unobserve(target) { this.observed.delete(target); }
    disconnect() { this.observed.clear(); this.disconnected = true; }
}

const loadSharedRuntime = () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.shared.js'), 'utf8');
    const document = {
        documentElement: { clientHeight: 800 },
        createDocumentFragment: () => new FakeFragment(),
        createElement: (tagName) => new FakeElement(tagName)
    };
    const window = { document, innerHeight: 800, IntersectionObserver: FakeIntersectionObserver, setTimeout };
    window.window = window;
    vm.runInNewContext(source, { window, document, Element: FakeElement, console, Map, Set, WeakMap, Object, Array, String, Number, Boolean, Date, Math, JSON, Promise, performance, setTimeout, clearTimeout });
    return window.FolderViewDockerRuntimeShared;
};

test('deferred preview controller hydrates on interaction and removes owned listeners', () => {
    const shared = loadSharedRuntime();
    const controller = shared.createDeferredPreviewController();
    const target = new FakeElement();
    target.appendChild(new FakeElement('img'));
    assert.equal(controller.defer(target), true);
    assert.equal(controller.snapshot().pending, 1);
    assert.equal(target.listeners.get('pointerenter').size, 1);
    target.dispatch('pointerenter');
    assert.equal(controller.snapshot().pending, 0);
    assert.equal(target.getAttribute('data-fv-preview-hydrated'), '1');
    assert.equal(target.listeners.get('pointerenter').size, 0);
});

test('deferred preview destroy restores content, disconnects observation, and disables deferral', () => {
    const shared = loadSharedRuntime();
    const controller = shared.createDeferredPreviewController();
    const target = new FakeElement();
    target.appendChild(new FakeElement('img'));
    assert.equal(controller.defer(target), true);
    controller.destroy();
    const snapshot = controller.snapshot();
    assert.equal(snapshot.active, false);
    assert.equal(snapshot.pending, 0);
    assert.equal(snapshot.rootMargin, '480px 0px');
    assert.equal(FakeIntersectionObserver.latest.disconnected, true);
    const nextTarget = new FakeElement();
    nextTarget.appendChild(new FakeElement('img'));
    assert.equal(controller.defer(nextTarget), false);
});
