'use strict';

// Keep the property-test dependency in a .js module so OpenSSF Scorecard can
// recognize the same fast-check harness that the Node test suite executes.
module.exports = require('fast-check');
