/* eslint-disable @typescript-eslint/no-require-imports */
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const {renderToStaticMarkup} = require('react-dom/server');

const compile = file => ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022}}).outputText;
const customer = () => new Map([['asp_user', JSON.stringify({id: 'synthetic-customer', portal: 'customer'})], ['asp_customer_access_token', 'synthetic-customer-token']]);
const response = (body, status = 200) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
const entitlement = () => ({planName: 'DAILY_HOROSCOPE_MONTHLY', status: 'ACTIVE', startDate: new Date(Date.now() - 1000).toISOString(), endDate: new Date(Date.now() + 60000).toISOString()});
function api(fetcher = async () => response({success: true}), store = customer()) {
  const exports = {};
  const localStorage = {getItem: key => store.get(key) ?? null};
  vm.runInNewContext(compile('src/features/horoscope/horoscope-api.ts'), {exports, localStorage, fetch: fetcher, process: {env: {NEXT_PUBLIC_API_BASE_URL: 'http://localhost:4000'}}, URL, URLSearchParams, Headers, AbortSignal, Intl, Date, console});
  return {exports, store, localStorage};
}
function screen(name, fetcher, store = customer()) {
  const loaded = api(fetcher, store), state = [], refs = [], effects = [], listeners = new Map(), intervals = new Set();
  let index = 0, pending = [];
  const hooks = {
    useState(initial) {const i = index++; if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial; return [state[i], value => {state[i] = typeof value === 'function' ? value(state[i]) : value;}];},
    useRef(value) {const i = index++; return refs[i] ?? (refs[i] = {current: value});},
    useEffect(callback, deps) {const i = index++; const previous = effects[i]; if (!previous || deps.some((value, n) => value !== previous.deps[n])) pending.push(() => {previous?.cleanup?.(); effects[i] = {deps, cleanup: callback()};});},
  };
  const window = {confirm: () => false, setInterval: fn => {intervals.add(fn); return fn;}, addEventListener: (name, fn) => {if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn);}, removeEventListener: (name, fn) => listeners.get(name)?.delete(fn)};
  const exports = {};
  vm.runInNewContext(compile('src/features/horoscope/HoroscopeExperience.tsx'), {exports, require: name => name === 'react' ? hooks : name === 'next/link' ? {default: 'a'} : name === './HoroscopeCheckout' ? {HoroscopeCheckout: () => null} : name.endsWith('.css') ? {default: new Proxy({}, {get: (_, key) => key})} : name === './horoscope-api' ? loaded.exports : require(name), window, clearInterval: fn => intervals.delete(fn), URLSearchParams, AbortController, Intl, Date, console});
  return {store, window, api: loaded.exports, intervals, render(props) {index = 0; pending = []; return exports[name](props ?? {});}, async flush() {for (const fn of pending) fn(); await new Promise(resolve => setImmediate(resolve));}, emit(name) {for (const fn of listeners.get(name) ?? []) fn();}, tick() {for (const fn of intervals) fn();}, dispose() {for (const effect of effects) effect?.cleanup?.();}, exports};
}
function nodes(node, predicate, found = []) {
  if (Array.isArray(node)) {node.forEach(item => nodes(item, predicate, found)); return found;}
  if (!node || typeof node !== 'object') return found;
  if (typeof node.type === 'function') return nodes(node.type(node.props), predicate, found);
  if (predicate(node)) found.push(node);
  nodes(node.props?.children, predicate, found); return found;
}
function content(node) {if (typeof node === 'string' || typeof node === 'number') return String(node); if (Array.isArray(node)) return node.map(content).join(' '); if (node && typeof node === 'object') return typeof node.type === 'function' ? content(node.type(node.props)) : content(node.props?.children); return '';}
const buttons = tree => nodes(tree, node => node.type === 'button');
const submit = tree => nodes(tree, node => node.type === 'form')[0].props.onSubmit({preventDefault() {}});

for (const [period, endpoint, day] of [['today', 'daily', '2026-10-23'], ['tomorrow', 'daily', '2026-10-24'], ['yesterday', 'daily', '2026-10-22'], ['weekly', 'weekly', '2026-10-23'], ['monthly', 'monthly', '2026-10-23'], ['yearly', 'yearly', '2026-10-23']]) test('general request contract: ' + period, () => {
  const path = api().exports.generalPath('aries', period, 'hi', new Date(2026, 9, 23, 12));
  const url = new URL(path, 'http://synthetic.invalid'); assert.equal(url.pathname, '/general-horoscope/' + endpoint); assert.equal(url.searchParams.get('date'), day); assert.equal(url.searchParams.get('moonSign'), 'Aries'); assert.equal(url.searchParams.get('lang'), 'hi');
});
test('date selection crosses year boundary without astronomical frontend calculations', () => {
  assert.match(api().exports.generalPath('pisces', 'tomorrow', 'en', new Date(2026, 11, 31, 12)), /2027-01-01/);
});
test('all 12 original signs and 20 backend locales configured; unknown selections rejected', () => {
  const a = api().exports; assert.equal(a.SIGNS.length, 12); assert.equal(a.LOCALES.length, 20);
  for (const values of [['wrong', 'today', 'en'], ['aries', 'decade', 'en'], ['aries', 'today', 'xx']]) assert.throws(() => a.generalPath(...values), /Unsupported/);
});
test('unsafe API configurations rejected', () => {
  const a = api().exports; for (const url of ['http://production.invalid', 'https://name:secret@example.invalid', 'https://example.invalid?key=secret', 'file:///tmp/test']) assert.throws(() => a.horoscopeBase(url));
  assert.equal(a.horoscopeBase('https://example.invalid/api/'), 'https://example.invalid/api');
});
test('free reading has no credentials, authorization or browser cache', async () => {
  const a = api(async (url, init) => {assert.match(url, /general-horoscope\/daily/); assert.equal(init.headers.has('Authorization'), false); assert.equal(init.cache, 'no-store'); assert.equal(init.credentials, 'omit'); return response({access: 'free', interpretation: {summary: 'Synthetic guidance'}});});
  assert.equal((await a.exports.horoscopeRequest('/general-horoscope/daily')).access, 'free');
});
for (const status of [401, 403, 500]) test('private HTTP ' + status + ' is fail-closed and attempted once', async () => {
  let calls = 0; const a = api(async () => {calls++; return response({message: 'Private raw error'}, status);});
  await assert.rejects(a.exports.horoscopeRequest('/dailyinsight', true), error => error.status === status && !error.message.includes('Private raw error')); assert.equal(calls, 1);
});
test('Customer token selected; no Admin/Astrologer token fallback', async () => {
  let calls = 0; const a = api(async (_url, init) => {calls++; assert.equal(init.headers.get('Authorization'), 'Bearer synthetic-customer-token'); return response({success: true});});
  a.store.set('asp_admin_access_token', 'synthetic-admin'); await a.exports.horoscopeRequest('/subscription/current', true);
  a.store.set('asp_user', JSON.stringify({portal: 'admin'})); await assert.rejects(a.exports.horoscopeRequest('/subscription/current', true), /Customer/); assert.equal(calls, 1);
});
test('missing session and malformed metadata deny requests before network', async () => {
  let calls = 0; const a = api(async () => {calls++;}, new Map());
  await assert.rejects(a.exports.horoscopeRequest('/subscription/current', true)); a.store.set('asp_user', '{broken'); await assert.rejects(a.exports.horoscopeRequest('/subscription/current', true)); assert.equal(calls, 0);
});
test('late private response after account switch is discarded', async () => {
  let finish; const a = api(() => new Promise(resolve => {finish = resolve;})); const pending = a.exports.horoscopeRequest('/subscription/current', true); a.store.set('asp_customer_access_token', 'other-synthetic-token'); finish(response({success: true, data: {private: 'old account'}})); await assert.rejects(pending, /Account changed/);
});
test('expired and failed entitlement never returns paid reading', async () => {
  for (const status of ['PENDING', 'FAILED', 'EXPIRED', 'TRIAL']) {
    const a = api(async () => response({success: true, entitlement: {...entitlement(), status}, data: {ai: {shortReading: 'Must not leak'}}})); await assert.rejects(a.exports.horoscopeRequest('/dailyinsight', true), /active/);
  }
  assert.equal(api().exports.isActiveEntitlement({...entitlement(), endDate: new Date(0).toISOString()}), false);
});
test('authorized reading preserves Unicode without fallback or interpretation calculations', async () => {
  const a = api(async () => response({success: true, entitlement: entitlement(), data: {generation: {language: {code: 'hi'}}, ai: {shortReading: 'आज · العربية · Français'}}})); assert.equal((await a.exports.horoscopeRequest('/dailyinsight?language=hi', true)).data.ai.shortReading, 'आज · العربية · Français');
});
test('only approved one-dollar 30-day offer is selectable', () => {
  const a = api().exports, plan = {name: 'DAILY_HOROSCOPE_MONTHLY', price: 1, currency: 'USD', durationDays: 30, isActive: true}; assert.equal(a.isDailyOffer(plan), true); assert.match(a.planLabel(plan), /1\.00.*30 days/);
  for (const patch of [{price: 99}, {currency: 'INR'}, {durationDays: 31}, {isActive: false}]) assert.equal(a.isDailyOffer({...plan, ...patch}), false);
  assert.equal(a.isDailyOffer({...plan, price: '1.00'}), true); assert.match(a.planLabel({...plan, price: '1.00'}), /1\.00.*30 days/);
  for (const price of [null, true, '', '0x1', '1e0', ' 1']) assert.equal(a.isDailyOffer({...plan, price}), false);
});
test('request cannot call Admin, payment, sending or unknown endpoints', async () => {
  let calls = 0; const a = api(async () => {calls++;});
  for (const path of ['/admin/horoscope/monitoring', '/notifications/test-push', '/payments/create-subscription-order', '/dailyinsight/../admin']) await assert.rejects(a.exports.horoscopeRequest(path, true));
  await assert.rejects(a.exports.horoscopeRequest('/subscription/current', true, {method: 'POST'})); assert.equal(calls, 0);
});
test('reminder opt-out uses explicit boolean and existing authenticated PATCH only', async () => {
  const a = api(async (url, init) => {assert.match(url, /notifications\/horoscope-preference$/); assert.equal(init.method, 'PATCH'); assert.equal(init.body, '{"enabled":false}'); return response({success: true, data: {enabled: false}});});
  assert.equal((await a.exports.horoscopeRequest('/notifications/horoscope-preference', true, {method: 'PATCH', body: JSON.stringify({enabled: false})})).data.enabled, false);
});
test('free UI renders six periods and waits for explicit generation', async () => {
  const calls = []; const app = screen('FreeHoroscope', async (url) => {calls.push(url); return response({language: 'en', moonSign: {name: 'Aries'}, interpretation: {summary: 'Synthetic reading', advice: 'Synthetic advice'}});});
  let tree = app.render(); await app.flush(); assert.equal(calls.length, 0); assert.equal(nodes(tree, node => node.type === 'select')[1].props.children.length, 6);
  submit(tree); app.render(); await app.flush(); tree = app.render(); assert.equal(calls.length, 1); assert.match(content(tree), /Synthetic reading/); app.dispose();
});
test('free UI failure offers retry and no fabricated predictions', async () => {
  let calls = 0; const app = screen('FreeHoroscope', async () => {calls++; return response({}, 503);}); submit(app.render()); app.render(); await app.flush(); let tree = app.render(); assert.equal(nodes(tree, node => node.props?.role === 'alert').length, 1); buttons(tree).find(node => content(node) === 'Retry').props.onClick(); app.render(); await app.flush(); assert.equal(calls, 2); app.dispose();
});
test('personalized page does not generate automatically or after account switching', async () => {
  let calls = 0; const app = screen('PersonalizedHoroscope', async () => {calls++; return response({success: true, entitlement: entitlement(), data: {generation: {language: {code: 'en'}}, ai: {shortReading: 'Private synthetic reading'}}});});
  let tree = app.render(); await app.flush(); assert.equal(calls, 0); submit(tree); app.render(); await app.flush(); tree = app.render(); assert.match(content(tree), /Private synthetic reading/);
  app.store.set('asp_customer_access_token', 'switched-synthetic-token'); app.emit('asp-auth-changed'); tree = app.render(); await app.flush(); tree = app.render(); assert.doesNotMatch(content(tree), /Private synthetic reading/); assert.equal(calls, 1); app.dispose(); assert.equal(app.intervals.size, 0);
});
test('personalized unauthorized response shows paywall guidance without paid content', async () => {
  const app = screen('PersonalizedHoroscope', async () => response({data: {ai: {shortReading: 'Do not show'}}}, 403)); submit(app.render()); app.render(); await app.flush(); const tree = app.render(); assert.doesNotMatch(content(tree), /Do not show/); assert.match(content(tree), /active subscription/); app.dispose();
});
test('Arabic personalized content uses RTL and no unsupported time periods', async () => {
  const app = screen('PersonalizedHoroscope', async () => response({success: true, entitlement: entitlement(), data: {generation: {language: {code: 'ar'}}, ai: {shortReading: 'العربية'}}}));
  let tree = app.render(); nodes(tree, node => node.type === 'select')[1].props.onChange({target: {value: 'ar'}}); tree = app.render(); assert.equal(nodes(tree, node => node.type === 'select')[0].props.children.length, 3); submit(tree); app.render(); await app.flush(); tree = app.render(); assert.equal(nodes(tree, node => node.props?.dir === 'rtl').length, 1); assert.match(content(tree), /العربية/); app.dispose();
});
test('rollout unavailable explains server blocker and disables consent mutation', async () => {
  const app = screen('HoroscopeSubscription', async url => response(url.includes('/plans') ? {success: true, data: []} : url.includes('preference') ? {success: true, data: {enabled: false, status: 'NOT_ACTIVATED', eligible: false}} : {success: true, data: null})); app.render(); await app.flush(); const tree = app.render(); assert.match(content(tree), /server has not activated/); assert.equal(buttons(tree).find(node => content(node) === 'I consent to daily reminders').props.disabled, true); app.dispose();
});
test('eligible consent is explicit; existing enabled consent can opt out when expired', async () => {
  let writes = 0; const app = screen('HoroscopeSubscription', async (url, init) => {if (init.method === 'PATCH') {writes++; assert.equal(init.body, '{"enabled":false}'); return response({success: true});} return response(url.includes('/plans') ? {success: true, data: []} : url.includes('preference') ? {success: true, data: {enabled: true, eligible: false, status: 'RECORDED', subscriptionStatus: 'EXPIRED'}} : {success: true, data: null});}); app.render(); await app.flush(); let tree = app.render(); const button = buttons(tree).find(node => content(node) === 'Turn reminders off'); assert.equal(button.props.disabled, false); await button.props.onClick(); await new Promise(resolve => setImmediate(resolve)); assert.equal(writes, 1); app.dispose();
});
test('public zodiac grid SSR has all 12 correct accessible destinations', () => {
  const app = screen('ZodiacGrid', async () => {throw Error('Unexpected fetch');}); const html = renderToStaticMarkup(React.createElement(app.exports.ZodiacGrid)); for (const [slug, name] of app.api.SIGNS) {assert.match(html, new RegExp('/horoscope/' + slug)); assert.ok(html.includes(name));} app.dispose();
});
test('private routes are noindex, public pages have individual canonical metadata', () => {
  for (const route of ['personalized', 'subscription']) assert.match(fs.readFileSync(`src/app/horoscope/${route}/page.tsx`, 'utf8'), /index: false, follow: false/);
  assert.match(fs.readFileSync('src/app/horoscope/[sign]/page.tsx', 'utf8'), /notFound\(\)/); assert.match(fs.readFileSync('src/app/horoscope/free/page.tsx', 'utf8'), /canonical: '\/horoscope\/free'/);
});
test('responsive layout and reduced motion are scoped, home no longer advertises INR 99', () => {
  const css = fs.readFileSync('src/features/horoscope/horoscope.module.css', 'utf8'); assert.match(css, /prefers-reduced-motion/); assert.match(css, /max-width: 400px/); assert.match(css, /minmax\(min\(100%/); assert.match(css, /focus-visible/);
  const home = fs.readFileSync('src/features/home/HoroscopeSubscriptionSection.tsx', 'utf8'); assert.doesNotMatch(home, /₹99/); assert.match(home, /HoroscopePlanPrice/);
});
test('wrong-language response is rejected, never silently shown as the requested locale', async () => {
  const a = api(async () => response({language: 'en', interpretation: {summary: 'Wrong language'}})); await assert.rejects(a.exports.horoscopeRequest('/general-horoscope/daily?lang=fr'), /No fallback/);
});
test('idle entitlement expiry clears a private reading without automatic generation retry', async () => {
  let calls = 0; const app = screen('PersonalizedHoroscope', async () => {calls++; return response({success: true, entitlement: {...entitlement(), endDate: new Date(Date.now() + 200).toISOString()}, data: {generation: {language: {code: 'en'}}, ai: {shortReading: 'Ephemeral synthetic reading'}}});});
  submit(app.render()); app.render(); await app.flush(); assert.match(content(app.render()), /Ephemeral synthetic reading/); await new Promise(resolve => setTimeout(resolve, 220)); app.tick(); const tree = app.render(); assert.doesNotMatch(content(tree), /Ephemeral synthetic reading/); assert.match(content(tree), /entitlement expired/); assert.equal(calls, 1); app.dispose();
});
test('personalized loading masks previous day data immediately on period change', async () => {
  const app = screen('PersonalizedHoroscope', async () => response({success: true, entitlement: entitlement(), data: {generation: {language: {code: 'en'}}, ai: {shortReading: 'Old day private reading'}}})); submit(app.render()); app.render(); await app.flush(); let tree = app.render(); assert.match(content(tree), /Old day private reading/); nodes(tree, node => node.type === 'select')[0].props.onChange({target: {value: 'tomorrow'}}); tree = app.render(); assert.doesNotMatch(content(tree), /Old day private reading/); app.dispose();
});
test('period-end cancellation requires advertised capability and explicit confirmation', async () => {
  let posts = 0;
  const app = screen('HoroscopeSubscription', async (url, init) => {
    if (init.method === 'POST') {posts++; assert.equal(init.body, '{"cancelAtPeriodEnd":true}'); return response({success: true});}
    return response(url.endsWith('/subscription/current') ? {success: true, data: {subscriptionPlan: {name: 'DAILY_HOROSCOPE_MONTHLY'}, subscriptionStatus: 'ACTIVE'}, billing: {periodEndCancellationSupported: true, cancelAtPeriodEnd: false}} : {success: true, data: []});
  });
  app.render(); await app.flush(); let tree = app.render(); const button = buttons(tree).find(node => content(node) === 'Request period-end cancellation'); assert.ok(button);
  await button.props.onClick(); assert.equal(posts, 0); app.window.confirm = () => true; await button.props.onClick(); await new Promise(resolve => setImmediate(resolve)); assert.equal(posts, 1); tree = app.render(); assert.match(content(tree), /Period-end cancellation request saved/); app.dispose();
});
test('subscription history is explicitly loaded, empty state is not a fabricated payment history', async () => {
  const calls = []; const app = screen('HoroscopeSubscription', async url => {calls.push(url); return response({success: true, data: []});}); app.render(); await app.flush(); let tree = app.render(); assert.equal(calls.some(url => url.includes('dailyinsight/history')), false);
  buttons(tree).find(node => content(node) === 'Load my reading dates').props.onClick(); app.render(); await app.flush(); tree = app.render(); assert.match(content(tree), /No saved reading history/); assert.match(content(tree), /payment history\/refund tracking is unavailable/); app.dispose();
});
test('valid subscriber sees reading access instead of another checkout prompt', async () => {
  const app = screen('HoroscopeSubscription', async url => response(url.includes('/plans') ? {success: true, data: [{name: 'DAILY_HOROSCOPE_MONTHLY', price: '1.00', currency: 'USD', durationDays: 30, isActive: true}]} : url.endsWith('/subscription/current') ? {success: true, data: {subscriptionPlan: {name: 'DAILY_HOROSCOPE_MONTHLY'}, subscriptionStatus: 'ACTIVE', endDate: new Date(Date.now() + 60000).toISOString()}} : {success: true, data: {status: 'NOT_ACTIVATED'}}));
  app.render(); await app.flush(); const tree = app.render(); assert.match(content(tree), /no new payment needed/); assert.match(content(tree), /does not need to pay again/); app.dispose();
});
test('free life-area indices display only backend scores and never invent lucky values', async () => {
  const app = screen('FreeHoroscope', async () => response({language: 'en', todayRating: {scale: 5, ratings: {health: 4, wealth: 2, loveMatters: 3, occupation: 9}}, interpretation: {summary: 'Synthetic transit summary'}}));
  submit(app.render()); app.render(); await app.flush(); const result = content(app.render()); assert.match(result, /4 \/ 5/); assert.match(result, /2 \/ 5/); assert.doesNotMatch(result, /9 \/ 5/); assert.match(result, /not a probability/); app.dispose();
});
