import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { extractFileCandidates } = require('../scripts/lib/i18n_surface_tools.cjs');
const phrases = (source) => extractFileCandidates(source).map((entry) => entry.value);

test('catalog extraction includes labels after icons and direct text writers', () => {
    assert.deepEqual(phrases('<button><i class="fa fa-history"></i> History</button>'), ['History']);
    assert.deepEqual(phrases('<a><svg><path d="M0 0"></path></svg> Download</a>'), ['Download']);
    assert.deepEqual(phrases("badge.textContent = 'all good'; status.innerText = \"Ready\";"), ['all good', 'Ready']);
});

test('icon label extraction respects explicit bindings and closing control boundaries', () => {
    assert.deepEqual(phrases('<button data-i18n="common.history"><i></i> History</button>'), []);
    assert.deepEqual(phrases('<button data-i18n-ignore><i></i> Private label</button>'), []);
    assert.deepEqual(phrases('<button><i></i></button><div><span></span> Unrelated tail</div>'), []);
});
