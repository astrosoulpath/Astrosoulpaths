/* eslint-disable @typescript-eslint/no-require-imports */
const {test} = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript'), crypto = require('node:crypto');
const compile = file => ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022}}).outputText;
const customer = () => new Map([['asp_user', JSON.stringify({id: 'synthetic-owner', portal: 'customer'})], ['asp_customer_access_token', 'synthetic-customer-token']]);
const response = (value, status = 200) => new Response(JSON.stringify(value), {status});
function app(file, name, fetcher, store = customer()) {
  const states = [], refs = [], effects = [], callbacks = [], cache = new Map(), intervals = new Set(), events = new Map();
  let index = 0, pending = [];
  const same = (a, b) => a && b && a.length === b.length && a.every((value, n) => value === b[n]);
  const hooks = {
    useState(initial) {const i = index++; if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial; return [states[i], value => {states[i] = typeof value === 'function' ? value(states[i]) : value;}];},
    useRef(value) {const i = index++; return refs[i] ?? (refs[i] = {current: value});},
    useCallback(fn, deps) {const i = index++; if (!callbacks[i] || !same(deps, callbacks[i].deps)) callbacks[i] = {fn, deps}; return callbacks[i].fn;},
    useEffect(fn, deps) {const i = index++; if (!effects[i] || !same(deps, effects[i].deps)) pending.push(() => {effects[i]?.cleanup?.(); effects[i] = {deps, cleanup: fn()};});},
  };
  const window = {confirm: () => false, setInterval: fn => {intervals.add(fn); return fn;}, addEventListener: (name, fn) => {if (!events.has(name)) events.set(name, new Set()); events.get(name).add(fn);}, removeEventListener: (name, fn) => events.get(name)?.delete(fn)};
  const navigator = {onLine: true};
  function load(file) {
    if (!fs.existsSync(file)) file += fs.existsSync(file + '.ts') ? '.ts' : '.tsx';
    file = path.resolve(file); if (cache.has(file)) return cache.get(file);
    const exports = {}; cache.set(file, exports);
    vm.runInNewContext(compile(file), {exports, require: name => name === 'react' ? hooks : name === 'next/link' ? {default: 'a'} : name.endsWith('.css') ? {default: new Proxy({}, {get: (_, key) => key})} : name.startsWith('.') ? load(path.resolve(path.dirname(file), name)) : require(name), process: {env: {NEXT_PUBLIC_API_BASE_URL: 'http://localhost:4000'}}, window, navigator, document: {visibilityState: 'visible', getElementById: () => ({scrollIntoView() {}})}, localStorage: {getItem: key => store.get(key) ?? null}, fetch: fetcher, Headers, Response, URL, URLSearchParams, FormData, File, AbortSignal, AbortController, Intl, Date, Error, crypto, structuredClone, clearInterval: fn => intervals.delete(fn), console});
    return exports;
  }
  const api = load('src/features/support/customer-support-api.ts'), exports = load(file);
  return {api, store, window, navigator, intervals, get owner() {return api.supportSession();}, render(props = {}) {index = 0; pending = []; return exports[name](props);}, async flush() {for (const fn of pending) fn(); await new Promise(resolve => setImmediate(resolve)); await new Promise(resolve => setImmediate(resolve));}, emit(name) {for (const fn of events.get(name) ?? []) fn();}, dispose() {for (const effect of effects) effect?.cleanup?.();}};
}
const apiApp = (fetcher, store) => app('src/features/support/customer-support-api.ts', 'supportBase', fetcher, store);
function nodes(node, predicate, found = []) {if (Array.isArray(node)) {node.forEach(value => nodes(value, predicate, found)); return found;} if (!node || typeof node !== 'object') return found; if (typeof node.type === 'function' && ['SupportState', 'SupportArt'].includes(node.type.name)) return nodes(node.type(node.props), predicate, found); if (predicate(node)) found.push(node); nodes(node.props?.children, predicate, found); return found;}
function content(node) {if (typeof node === 'string' || typeof node === 'number') return String(node); if (Array.isArray(node)) return node.map(content).join(' '); if (node && typeof node === 'object') return typeof node.type === 'function' && node.type.name === 'SupportState' ? content(node.type(node.props)) : content(node.props?.children); return '';}
const submit = tree => nodes(tree, node => node.type === 'form')[0].props.onSubmit({preventDefault() {}});
const button = (tree, text) => nodes(tree, node => node.type === 'button' && content(node) === text)[0];

test('public help uses no bearer, cookies or cache', async () => {
  const a = apiApp(async (url, init) => {assert.match(url, /support\/public\/help$/); assert.equal(init.headers.has('Authorization'), false); assert.equal(init.cache, 'no-store'); assert.equal(init.credentials, 'omit'); return response({success: true});}, new Map()); await a.api.customerSupportRequest('/support/public/help');
});
test('Customer support cannot fall back to Admin or Astrologer', async () => {
  let calls = 0; const a = apiApp(async () => {calls++;}, new Map([['asp_user', '{"portal":"admin"}'], ['asp_admin_access_token', 'synthetic-admin']])); await assert.rejects(a.api.customerSupportRequest('/support/tickets'), /Customer/); assert.equal(calls, 0);
});
test('private response is discarded if account changes during JSON decode', async () => {
  const a = apiApp(async () => ({ok: true, status: 200, json: async () => {a.store.set('asp_customer_access_token', 'other-synthetic-owner'); return {success: true, tickets: [{subject: 'Old private issue'}]};}})); await assert.rejects(a.api.customerSupportRequest('/support/tickets'), /account changed/);
});
for (const status of [401, 403, 429, 503]) test('support denial ' + status + ' is actionable and never automatically retries', async () => {
  let calls = 0; const a = apiApp(async () => {calls++; return response({message: 'Synthetic private provider details'}, status);}); await assert.rejects(a.api.customerSupportRequest('/support/tickets'), error => !error.message.includes('provider details')); assert.equal(calls, 1);
});
test('path validation blocks Admin, traversal, provider sending and injected headers', async () => {
  let calls = 0; const a = apiApp(async () => {calls++;});
  for (const route of ['/admin/support/tickets', '/support/tickets/../admin', '/notifications/test-push', '/support/tickets/x\\y']) await assert.rejects(a.api.customerSupportRequest(route));
  await assert.rejects(a.api.customerSupportRequest('/support/assistant/health', {method: 'POST'})); assert.equal(calls, 0);
});
test('backend-compatible attachments are bounded, typed multipart without forged header', async () => {
  const a = apiApp(async (_url, init) => {assert.equal(init.headers.has('Content-Type'), false); assert.equal(init.body.get('file').type, 'application/pdf'); return response({success: true});});
  const body = a.api.supportAttachment(new File(['%PDF-synthetic'], 'evidence.pdf', {type: 'application/pdf'})); await a.api.customerSupportRequest('/support/tickets/synthetic-ticket/attachments', {method: 'POST', body});
  for (const file of [new File([], 'empty.pdf'), new File(['x'], 'file.exe'), new File(['x'], 'file.pdf', {type: 'image/png'})]) assert.throws(() => a.api.supportAttachment(file));
});
test('attachment links reject executable protocols and embedded credentials', () => {
  const a = apiApp(); for (const url of ['javascript:alert(1)', 'data:text/html,unsafe', 'https://user:pass@example.invalid/file', 'http://external.invalid/file']) assert.equal(a.api.attachmentLink(url), null); assert.ok(a.api.attachmentLink('https://example.invalid/signed?synthetic=yes'));
});
test('guest public FAQ renders published backend answer and real config only', async () => {
  const calls = []; const a = app('src/features/support/ContactSupport.tsx', 'default', async url => {calls.push(url); return response({success: true, published: true, categories: ['ACCOUNT', '__proto__'], contact: {email: 'help@example.invalid', hours: 'Synthetic configured hours'}, faqs: [{id: 'one', question: 'Synthetic FAQ', answer: 'Approved synthetic answer'}]});}, new Map()); a.render(); await a.flush(); const tree = a.render(); assert.match(content(tree), /Approved synthetic answer/); assert.match(content(tree), /Synthetic configured hours/); assert.equal(calls.length, 1); assert.match(content(tree), /Customer sign-in/); assert.equal(nodes(tree, node => node.type?.name === 'CustomerWorkspace').length, 0); a.dispose(); assert.equal(a.intervals.size, 0);
});
test('unpublished contact and FAQ data are not displayed even if extra fields arrive', async () => {
  const a = app('src/features/support/ContactSupport.tsx', 'default', async () => response({success: true, published: false, contact: {email: 'private@example.invalid'}, faqs: [{question: 'Private draft', answer: 'Do not publish'}]}), new Map()); a.render(); await a.flush(); assert.doesNotMatch(content(a.render()), /private@example|Do not publish/); a.dispose();
});
test('owner-approved public email is accessible to guests without publishing draft FAQs or hours', async () => {
  const a = app('src/features/support/ContactSupport.tsx', 'default', async () => response({success: true, published: false, contactSource: 'approved-official-default', contact: {email: 'support@astrosoulpath.com', hours: '', responseTime: ''}, faqs: []}), new Map());
  a.render(); await a.flush(); const tree = a.render();
  assert.equal(nodes(tree, n => n.type === 'a' && n.props.href === 'mailto:support@astrosoulpath.com').length, 1);
  assert.match(content(tree), /support@astrosoulpath.com/);
  assert.doesNotMatch(content(tree), /Verified support email has not been published|No verified support hours|No response-time promise/);
  a.dispose();
});
test('FAQ search filters approved answers and has an explicit empty state', async () => {
  const a = app('src/features/support/ContactSupport.tsx', 'default', async () => response({success: true, published: true, faqs: [{id: 'one', question: 'Account access', answer: 'Synthetic answer'}]}), new Map()); a.render(); await a.flush(); let tree = a.render(); nodes(tree, node => node.type === 'input' && node.props.type === 'search')[0].props.onChange({target: {value: 'unmatched'}}); tree = a.render(); assert.match(content(tree), /No published answers match/); assert.doesNotMatch(content(tree), /Synthetic answer/); a.dispose();
});
test('ticket creation locks duplicate submissions and displays only confirmed ticket number', async () => {
  let posts = 0, finish; const a = app('src/features/support/CustomerWorkspace.tsx', 'CustomerWorkspace', async (url, init) => {if (init.method === 'POST') {posts++; return new Promise(resolve => {finish = resolve;});} return response(url.includes('/tickets?') ? {success: true, tickets: [], pagination: {total: 0}} : {success: true});});
  let tree = a.render({owner: a.owner, category: 'ACCOUNT', online: true}); await a.flush(); nodes(tree, node => node.type === 'input' && node.props.minLength === 3)[0].props.onChange({target: {value: 'Synthetic issue'}}); nodes(tree, node => node.type === 'textarea')[0].props.onChange({target: {value: 'Synthetic description'}}); tree = a.render({owner: a.owner, category: 'ACCOUNT', online: true}); submit(tree); submit(tree); assert.equal(posts, 1); finish(response({success: true, ticket: {id: 'synthetic-ticket', ticketNumber: 'SYNTHETIC-ONE'}})); await a.flush(); tree = a.render({owner: a.owner, category: 'ACCOUNT', online: true}); assert.match(content(tree), /Ticket saved:.*SYNTHETIC-ONE/); a.dispose();
});
test('unconfirmed create blocks resubmission until explicit history review', async () => {
  const a = app('src/features/support/CustomerWorkspace.tsx', 'CustomerWorkspace', async (_url, init) => response(init.method === 'POST' ? {} : {success: true, tickets: []}, init.method === 'POST' ? 503 : 200));
  let tree = a.render({owner: a.owner, category: 'GENERAL', online: true}); await a.flush(); nodes(tree, node => node.type === 'input' && node.props.minLength === 3)[0].props.onChange({target: {value: 'Synthetic'}}); nodes(tree, node => node.type === 'textarea')[0].props.onChange({target: {value: 'Description'}}); tree = a.render({owner: a.owner, category: 'GENERAL', online: true}); submit(tree); await a.flush(); tree = a.render({owner: a.owner, category: 'GENERAL', online: true}); assert.equal(button(tree, 'Create support ticket').props.disabled, true); assert.match(content(tree), /Review and refresh/); assert.doesNotMatch(content(tree), /Ticket saved:/); a.dispose();
});
test('ticket listing uses backend search/status/pagination and keeps Human Support when AI disabled', async () => {
  const calls = []; const a = app('src/features/support/CustomerWorkspace.tsx', 'CustomerWorkspace', async url => {calls.push(url); return response(url.includes('/tickets?') ? {success: true, tickets: [], pagination: {total: 20}} : {visible: false, provider: {available: true}});});
  a.render({owner: a.owner, category: 'GENERAL', online: true}); await a.flush(); let tree = a.render({owner: a.owner, category: 'GENERAL', online: true}); assert.equal(button(tree, 'Open AI support'), undefined); assert.ok(button(tree, 'Create support ticket')); button(tree, 'Next').props.onClick(); a.render({owner: a.owner, category: 'GENERAL', online: true}); await a.flush(); assert.match(calls.filter(url => url.includes('/tickets?')).at(-1), /page=2/); a.dispose();
});
test('closed ticket disables reply/upload and never displays private notes', async () => {
  const a = app('src/features/support/TicketDetail.tsx', 'TicketDetail', async () => response({success: true, ticket: {ticketNumber: 'SYNTHETIC', status: 'CLOSED', privateNotes: 'Synthetic private note', messages: [{id: 'one', senderType: 'ADMIN', content: 'Synthetic public reply'}, {id: 'two', senderType: 'PRIVATE', content: 'Internal only'}]}})); a.render({owner: a.owner, id: 'synthetic-ticket', online: true, onRefresh() {}}); await a.flush(); const tree = a.render({owner: a.owner, id: 'synthetic-ticket', online: true, onRefresh() {}}); assert.equal(button(tree, 'Send reply').props.disabled, true); assert.equal(button(tree, 'Upload evidence').props.disabled, true); assert.match(content(tree), /Synthetic public reply/); assert.doesNotMatch(content(tree), /Internal only|Synthetic private note/); a.dispose();
});
test('customer reply uses stable server idempotency key and existing message endpoint', async () => {
  const sent = []; const a = app('src/features/support/TicketDetail.tsx', 'TicketDetail', async (url, init) => {if (init.method === 'POST') {sent.push(JSON.parse(init.body)); return response({}, 503);} return response({success: true, ticket: {status: 'OPEN'}});});
  const props = {owner: a.owner, id: 'synthetic-ticket', online: true, onRefresh() {}}; a.render(props); await a.flush(); let tree = a.render(props); nodes(tree, node => node.type === 'textarea')[0].props.onChange({target: {value: 'Synthetic reply'}}); tree = a.render(props); submit(tree); await a.flush(); tree = a.render(props); submit(tree); await a.flush(); assert.equal(sent.length, 2); assert.equal(sent[0].clientMessageId, sent[1].clientMessageId); assert.equal(sent[0].content, 'Synthetic reply'); a.dispose();
});
test('AI consent is required and opening panel performs no conversation writes', async () => {
  let posts = 0; const a = app('src/features/support/AiSupport.tsx', 'AiSupport', async (_url, init) => {if (init.method === 'POST') posts++; return response({success: true, conversations: []});}); const props = {owner: a.owner, online: true, config: {}, onTicket() {}}; let tree = a.render(props); await a.flush(); nodes(tree, node => node.type === 'textarea')[0].props.onChange({target: {value: 'Synthetic AI question'}}); tree = a.render(props); submit(tree); assert.equal(posts, 0); assert.equal(button(tree, 'Send to AI Support').props.disabled, true); a.dispose();
});
test('AI send uses genuine existing backend conversation then message API with immutable draft', async () => {
  const sent = []; let finishStart; const a = app('src/features/support/AiSupport.tsx', 'AiSupport', async (url, init) => {if (init.method === 'POST' && url.endsWith('/conversations')) return new Promise(resolve => {finishStart = resolve;}); if (init.method === 'POST') {sent.push(JSON.parse(init.body)); return response({success: true});} return response({success: true, conversations: []});}); const props = {owner: a.owner, online: true, config: {}, onTicket() {}};
  let tree = a.render(props); await a.flush(); nodes(tree, node => node.type === 'textarea')[0].props.onChange({target: {value: 'Original synthetic question'}}); nodes(tree, node => node.type === 'input' && node.props.type === 'checkbox')[0].props.onChange({target: {checked: true}}); tree = a.render(props); submit(tree); nodes(tree, node => node.type === 'textarea')[0].props.onChange({target: {value: 'New unsent question'}}); finishStart(response({success: true, conversation: {id: 'synthetic-conversation'}})); await a.flush(); assert.equal(sent[0].content, 'Original synthetic question'); tree = a.render(props); assert.equal(nodes(tree, node => node.type === 'textarea')[0].props.value, 'New unsent question'); a.dispose();
});
test('logout immediately masks previously fetched private ticket data', async () => {
  const a = app('src/features/support/TicketDetail.tsx', 'TicketDetail', async () => response({success: true, ticket: {ticketNumber: 'PRIVATE-SYNTHETIC', status: 'OPEN'}})); const props = {owner: a.owner, id: 'synthetic', online: true, onRefresh() {}}; a.render(props); await a.flush(); assert.match(content(a.render(props)), /PRIVATE-SYNTHETIC/); a.store.clear(); assert.doesNotMatch(content(a.render(props)), /PRIVATE-SYNTHETIC/); a.dispose(); assert.equal(a.intervals.size, 0);
});
test('contact CSS and metadata preserve reduced motion, responsiveness and no fake SLA', () => {
  const css = fs.readFileSync('src/features/support/contact.module.css', 'utf8'); assert.match(css, /prefers-reduced-motion/); assert.match(css, /max-width: 700px/); assert.match(css, /min-height: 44px/);
  assert.doesNotMatch(fs.readFileSync('src/app/contact/page.tsx', 'utf8'), /24.?48|10:00|support@/);
});
test('Admin public-help editor adds an unpublished empty draft without sending requests', () => {
  let saved; const a = app('src/features/admin/support/PublicHelpEditor.tsx', 'PublicHelpEditor', async () => {throw Error('Unexpected write');}); const tree = a.render({onChange: value => {saved = value;}}); button(tree, 'Add unpublished FAQ').props.onClick(); assert.equal(saved.published, false); assert.equal(saved.faqs[0].enabled, false); assert.equal(saved.faqs[0].answer, ''); a.dispose();
});
test('ticket refresh reflects Admin status changes without exposing internal notes', async () => {
  let status = 'WAITING_FOR_CUSTOMER'; const a = app('src/features/support/TicketDetail.tsx', 'TicketDetail', async () => response({success: true, ticket: {status, privateNotes: 'Not public'}})); const props = {owner: a.owner, id: 'synthetic', online: true, onRefresh() {}}; a.render(props); await a.flush(); let tree = a.render(props); assert.equal(button(tree, 'Send reply').props.disabled, true); status = 'CLOSED'; button(tree, 'Refresh ticket details').props.onClick(); a.render(props); await a.flush(); tree = a.render(props); assert.match(content(tree), /This ticket is closed/); assert.doesNotMatch(content(tree), /Not public/); a.dispose();
});
test('AI escalation uses the existing endpoint only after confirmation, transcript default excluded', async () => {
  const posts = []; let ticket;
  const a = app('src/features/support/AiSupport.tsx', 'AiSupport', async (url, init) => {if (init.method === 'POST') {posts.push({url, body: JSON.parse(init.body)}); return response({success: true, ticket: {id: 'synthetic-ticket', ticketNumber: 'SYNTHETIC'}});} return response({success: true, conversation: {status: 'ACTIVE'}, conversations: [{id: 'synthetic-conversation', status: 'ACTIVE'}]});});
  const props = {owner: a.owner, online: true, config: {}, onTicket: value => {ticket = value;}}; a.render(props); await a.flush(); let tree = a.render(props); nodes(tree, node => node.type === 'select')[0].props.onChange({target: {value: 'synthetic-conversation'}}); a.render(props); await a.flush(); tree = a.render(props); button(tree, 'Request Human Support').props.onClick(); assert.equal(posts.length, 0); a.window.confirm = () => true; button(tree, 'Request Human Support').props.onClick(); await a.flush(); assert.equal(posts.length, 1); assert.match(posts[0].url, /\/conversations\/synthetic-conversation\/escalate$/); assert.equal(posts[0].body.includeConversation, false); assert.equal(ticket.ticket.id, 'synthetic-ticket'); a.dispose();
});
