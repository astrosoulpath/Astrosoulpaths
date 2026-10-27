/* eslint-disable @typescript-eslint/no-require-imports */
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const {harness,root}=require('./admin-ui-harness.cjs');
const catalog=harness().load('src/features/admin/ui/admin-navigation.ts');
const snapshot=JSON.parse(fs.readFileSync(path.join(root,'review/admin-premium-preservation.json'),'utf8'));
for(const item of snapshot.files)test(`security/legacy source preserved: ${item.file}`,()=>{
  if(item.file==='src/proxy.ts') {
    // Later approved authentication hardening supersedes the UI-only snapshot.
    // Behavioral session/RBAC coverage lives in admin-auth.test.cjs.
    const source=fs.readFileSync(path.join(root,item.file),'utf8');
    assert.match(source,/checkAdminToken/);
    assert.match(source,/ADMIN_SESSION_COOKIE/);
    assert.match(source,/NextResponse\.redirect/);
    return;
  }
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,item.file))).digest('hex'),item.sha256);
});
test('all sixteen module destinations are unique existing App Router pages',()=>{
  assert.equal(catalog.adminModules.length,16);assert.equal(new Set(catalog.adminModules.map(m=>m.href)).size,16);
  for(const item of catalog.adminModules)assert(fs.existsSync(path.join(root,'src/app',item.href,'page.tsx')));
  assert.equal(catalog.adminModules.find(m=>m.title==='Platform Analytics').href,'/admin/analytics');
});
for(const item of catalog.adminModules)test(`shared shell/back-navigation and module render: ${item.href}`,()=>{
  const h=harness(item.href);
  const Page=h.load(`src/app${item.href}/page.tsx`).default;
  const Shell=h.load('src/features/admin/ui/AdminShell.tsx').AdminShell;
  const html=renderToStaticMarkup(React.createElement(Shell,null,React.createElement(Page)));
  assert.match(html,/aria-label="Admin navigation"/);assert.match(html,/Platform workspace/);
  assert.match(html,/href="\/admin"[^>]*>[\s\S]*?Back to Dashboard/);
  assert.match(html,/aria-current="page"/);assert(!html.includes('undefined'));
});
test('nested astrologer and marketplace pages inherit the same shell',()=>{
  for(const route of ['/admin/astrologers/synthetic','/admin/marketplace/products','/admin/marketplace/categories','/admin/articles']){
    const h=harness(route),Shell=h.load('src/features/admin/ui/AdminShell.tsx').AdminShell;
    const file=route==='/admin/astrologers/synthetic'?'src/app/admin/astrologers/[id]/page.tsx':`src/app${route}/page.tsx`;
    const Page=h.load(file).default;
    const html=renderToStaticMarkup(React.createElement(Shell,null,React.createElement(Page)));
    assert.match(html,/Back to Dashboard/);assert.match(html,/Admin sidebar/);
    if(route==='/admin/astrologers/synthetic')assert.match(html,/<h2[^>]*>Synthetic detail profile<\/h2>/);
    if(route==='/admin/marketplace/products')assert.match(html,/<h1>Marketplace Products<\/h1>/);
  }
});
test('login stays outside the management shell',()=>{
  const h=harness('/admin/login');
  const Shell=h.load('src/features/admin/ui/AdminShell.tsx').AdminShell;
  assert.equal(renderToStaticMarkup(React.createElement(Shell,null,'existing login')),'existing login');
});
test('public chrome is preserved outside Admin and isolated inside it',()=>{
  for(const route of ['/','/astrologers','/admin','/admin/customers','/admin/login','/administrator']){
    const h=harness(route),Chrome=h.load('src/components/layouts/PublicChrome.tsx').PublicChrome;
    for(const kind of ['navigation','promotion','footer']){
      const html=renderToStaticMarkup(React.createElement(Chrome,{kind},'public content'));
      const expected=!catalog.isAdminRoute(route)||(kind==='navigation'&&catalog.isAdminAuthRoute(route));
      assert.equal(html,expected?'public content':'');
    }
  }
});
test('dashboard renders eight real-data cards and sixteen destinations without invented trends',()=>{
  const h=harness(),Dashboard=h.load('src/features/admin/AdminDashboard.tsx').AdminDashboard;
  const html=renderToStaticMarkup(React.createElement(Dashboard));
  assert.equal((html.match(/class="admin-stat"/g)||[]).length,8);
  assert.equal((html.match(/class="admin-module-card"/g)||[]).length,16);
  assert.match(html,/Welcome to AstroSoulPath/);assert.match(html,/INR/);assert.doesNotMatch(html,/\+\d+%|growth|compared to yesterday/i);
});
test('missing statistics stay unavailable while actual zero remains zero',()=>{
  const missing=harness('/admin',{seeds:{'src/features/admin/AdminDashboard.tsx':[{},false,null]}});
  const Missing=missing.load('src/features/admin/AdminDashboard.tsx').AdminDashboard;
  const html=renderToStaticMarkup(React.createElement(Missing));
  assert.match(html,/Unavailable/);assert.doesNotMatch(html,/admin-stat-number">0</);
  const zero=harness('/admin',{seeds:{'src/features/admin/AdminDashboard.tsx':[{users:{total:0}},false,null]}});
  const Zero=zero.load('src/features/admin/AdminDashboard.tsx').AdminDashboard;
  assert.match(renderToStaticMarkup(React.createElement(Zero)),/admin-stat-number">0</);
});
test('missing astrologer experience and pricing do not become invented zero values',()=>{
  const h=harness('/admin',{seeds:{'src/features/admin/components/AstrologerTable.tsx':[[{id:'synthetic',languages:[],isApproved:false,isVerified:false}],false,'']}});
  const Table=h.load('src/features/admin/components/AstrologerTable.tsx').AstrologerTable;
  const html=renderToStaticMarkup(React.createElement(Table));
  assert.equal((html.match(/Unavailable/g)||[]).length,2);assert.doesNotMatch(html,/0 years|₹0/);
});
