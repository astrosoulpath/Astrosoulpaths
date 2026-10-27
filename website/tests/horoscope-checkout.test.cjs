/* eslint-disable @typescript-eslint/no-require-imports */
const {test} = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
const plan = {name: 'DAILY_HOROSCOPE_MONTHLY', isActive: true, price: 1, currency: 'USD', durationDays: 30};
const compile = file => ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText;
function checkout(overrides = {}) {
  let owner = 'synthetic-owner', options, failure, created = 0, reconciled = 0, opened = 0, closed = 0;
  const events = [];
  class Provider {constructor(value) {options = value;} open() {opened++;} close() {closed++;} on(_event, fn) {failure = fn;}}
  const exports = {};
  vm.runInNewContext(compile('src/features/horoscope/horoscope-payment.ts'), {exports, require: name => name.includes('subscriptionService') ? {
    getSubscriptionCheckoutConfig: async () => {if (overrides.config) return overrides.config(); return {keyId: 'rzp_test_synthetic', mode: 'TEST'};},
    createSubscriptionPaymentOrder: async name => {created++; assert.equal(name, 'DAILY_HOROSCOPE_MONTHLY'); return overrides.order ? overrides.order() : {id: 'synthetic-order', amount: 100, currency: 'USD'};},
    verifySubscriptionCheckout: async order => {reconciled++; assert.equal(order, 'synthetic-order'); return overrides.verify ? overrides.verify() : {success: true, status: 'SUCCESS'};},
  } : {customerSession: () => owner, isDailyOffer: value => value.name === plan.name && value.price === 1 && value.durationDays === 30 && value.currency === 'USD' && value.isActive === true}, setTimeout, clearTimeout, window: {}, document: {}});
  return {run: (key = 'rzp_test_synthetic', signal) => exports.horoscopeCheckout(plan, key, async () => Provider, signal), ready: () => new Promise(resolve => setImmediate(resolve)), change: () => {owner = 'different-synthetic-owner';}, get options() {return options;}, failed() {failure();}, stats: () => ({created, reconciled, opened, closed}), events};
}
test('untrusted frontend key cannot override server-owned checkout configuration', async () => {
  const app = checkout(); await assert.rejects(app.run('rzp_live_synthetic'), /environment changed/); assert.equal(app.stats().created, 0);
});

test('backend configuration rejection stops checkout before creating an order', async () => {
  const app = checkout({config: () => {throw Error('LIVE gate disabled');}});
  await assert.rejects(app.run(''), /gate disabled/); assert.equal(app.stats().created, 0);
});
test('mock Razorpay success requires backend reconciliation, not browser success alone', async () => {
  const app = checkout(); let settled = false; const pending = app.run().then(value => {settled = true; return value;}); await app.ready(); assert.equal(settled, false); assert.equal(app.stats().reconciled, 0);
  await app.options.handler({razorpay_order_id: 'synthetic-order'}); assert.equal(await pending, 'VERIFIED'); assert.deepEqual(app.stats(), {created: 1, reconciled: 1, opened: 1, closed: 0});
});
test('duplicate checkout callback reconciles once', async () => {
  let complete; const app = checkout({verify: () => new Promise(resolve => {complete = resolve;})}); const pending = app.run(); await app.ready(); const first = app.options.handler({razorpay_order_id: 'synthetic-order'}); const second = app.options.handler({razorpay_order_id: 'synthetic-order'}); complete({success: true, status: 'SUCCESS'}); await Promise.all([first, second]); assert.equal(await pending, 'VERIFIED'); assert.equal(app.stats().reconciled, 1);
});
for (const status of ['FAILED', 'PENDING']) test('server payment ' + status + ' never verifies access', async () => {
  const app = checkout({verify: () => ({success: true, status})}); const pending = app.run(); await app.ready(); await app.options.handler({razorpay_order_id: 'synthetic-order'}); assert.equal(await pending, status); assert.equal(app.stats().created, 1);
});
test('provider failure and dismissal produce no activation or automatic retry', async () => {
  for (const outcome of ['failure', 'dismiss']) {const app = checkout(); const pending = app.run(); await app.ready(); if (outcome === 'failure') app.failed(); else app.options.modal.ondismiss(); assert.equal(await pending, outcome === 'failure' ? 'FAILED' : 'CANCELLED'); assert.equal(app.stats().reconciled, 0); assert.equal(app.stats().created, 1);}
});
test('mismatched amount or currency fails before opening SDK', async () => {
  for (const order of [{id: 'synthetic-order', amount: 99, currency: 'USD'}, {id: 'synthetic-order', amount: 100, currency: 'INR'}]) {const app = checkout({order: () => order}); await assert.rejects(app.run(), /authoritative offer/); assert.equal(app.stats().opened, 0);}
});
test('forged callback order cannot trigger reconciliation', async () => {
  const app = checkout(); const pending = app.run(); const denial = assert.rejects(pending, /not confirmed/); await app.ready(); await app.options.handler({razorpay_order_id: 'foreign-order'}); await denial; assert.equal(app.stats().reconciled, 0);
});
test('account switching before success callback rejects without verifying another user', async () => {
  const app = checkout(); const pending = app.run(); const denial = assert.rejects(pending, /not confirmed/); await app.ready(); app.change(); await app.options.handler({razorpay_order_id: 'synthetic-order'}); await denial; assert.equal(app.stats().reconciled, 0);
});
test('logout/disposal cancellation closes only owned checkout and never retries', async () => {
  const app = checkout(), controller = new AbortController(); const pending = app.run('rzp_test_synthetic', controller.signal); const denial = assert.rejects(pending, /Checkout closed/); await app.ready(); controller.abort(); await denial; assert.equal(app.stats().closed, 1); assert.equal(app.stats().reconciled, 0);
});
test('failed network verification is actionable and attempted only once', async () => {
  const app = checkout({verify: () => {throw Error('Synthetic private provider error');}}); const pending = app.run(); const denial = assert.rejects(pending, error => /not confirmed/.test(error.message) && !error.message.includes('private provider')); await app.ready(); await app.options.handler({razorpay_order_id: 'synthetic-order'}); await denial; assert.equal(app.stats().reconciled, 1);
});
