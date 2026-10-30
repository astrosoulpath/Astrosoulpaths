/* eslint-disable @typescript-eslint/no-require-imports */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const root=path.resolve(__dirname,'..');
function load(file,extra={}) {const exports={};const source=fs.readFileSync(path.join(root,file),'utf8');vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,process:{env:{NODE_ENV:'test',NEXT_PUBLIC_API_BASE_URL:'http://localhost:4000'}},URL,Headers,Response,FormData,AbortSignal,...extra});return exports;}
test('Home launch approval is server-only, default-off in production and unknown environments',()=>{
  const {publicHomepageAllowed}=load('src/features/home/public-launch.ts');
  for(const env of ['production','staging','']) {assert.equal(publicHomepageAllowed(env,''),false);assert.equal(publicHomepageAllowed(env,'TRUE'),false);assert.equal(publicHomepageAllowed(env,'true'),true);}
  assert.equal(publicHomepageAllowed('development',''),true);
  const home=fs.readFileSync(path.join(root,'src/app/page.tsx'),'utf8');assert.match(home,/if \(!publicHomepageAllowed\(\)\) notFound\(\)/);assert.match(home,/force-dynamic/);assert.match(home,/index: false/);
});
for(const value of ['', 'http://external.invalid','https://user:secret@example.invalid','https://example.invalid/?q=key']) test('rejects unsafe marketplace configuration '+value.replace(/secret|key/g,'redacted'),()=>{assert.throws(()=>load('src/features/marketplace/marketplace-api.ts').marketplaceBase(value));});
test('transport uses only selected Customer token and rejects late account-switch body',async()=>{
  const store=new Map([['asp_user',JSON.stringify({id:'synthetic-customer',portal:'customer',role:'CUSTOMER'})],['asp_access_token','synthetic-customer'],['asp_admin_access_token','synthetic-admin']]);let calls=0;
  const api=load('src/features/marketplace/marketplace-api.ts',{localStorage:{getItem:k=>store.get(k)},fetch:async(_url,init)=>{calls++;assert.equal(init.headers.get('Authorization'),'Bearer synthetic-customer');assert.equal(init.credentials,'omit');return {status:200,ok:true,json:async()=>{store.set('asp_access_token','other-synthetic');return {success:true,data:{private:'synthetic'}};}};}});
  await assert.rejects(api.marketplaceRequest('/marketplace/customer/orders','customer'),/Account changed/);assert.equal(calls,1);
});
test('missing Seller session never falls back to Customer/Admin',async()=>{
  let calls=0;const api=load('src/features/marketplace/marketplace-api.ts',{localStorage:{getItem:k=>k==='asp_admin_access_token'?'synthetic-admin':null},fetch:async()=>{calls++;}});
  await assert.rejects(api.marketplaceRequest('/marketplace/seller/products','seller'),/Sign in/);assert.equal(calls,0);
});
for(const status of [401,403,500]) test('transport rejects HTTP '+status+' with no automatic write retry',async()=>{
  let calls=0;const api=load('src/features/marketplace/marketplace-api.ts',{localStorage:{getItem:key=>key==='asp_user'?JSON.stringify({id:'synthetic-customer',portal:'customer',role:'CUSTOMER'}):key==='asp_customer_access_token'?'synthetic-customer':null},fetch:async()=>{calls++;return new Response(JSON.stringify({success:false,message:'secret provider message'}),{status});}});
  await assert.rejects(api.marketplaceRequest('/marketplace/customer/cart/items','customer',{method:'POST',body:'{}'}),e=>!e.message.includes('secret'));assert.equal(calls,1);
});
test('public catalogue request strips caller Authorization',async()=>{
  const api=load('src/features/marketplace/marketplace-api.ts',{fetch:async(_url,init)=>{assert.equal(init.headers.has('Authorization'),false);return new Response(JSON.stringify({success:true,data:[]}));}});
  assert.equal((await api.marketplaceRequest('/marketplace/products',undefined,{headers:{Authorization:'untrusted'}})).success,true);
});
test('traversal destinations never dispatch',async()=>{
  let calls=0;const api=load('src/features/marketplace/marketplace-api.ts',{fetch:()=>{calls++;}});
  for(const destination of ['/admin/users','/marketplace/../admin','/marketplace/%2e%2e/admin','/marketplace/products#private']) await assert.rejects(api.marketplaceRequest(destination));assert.equal(calls,0);
});
test('currency formatting never invents a default or combines currencies',()=>{
  const {marketplaceMoney}=load('src/features/marketplace/marketplace-api.ts');assert.equal(marketplaceMoney(10,undefined),'Price unavailable');assert.equal(marketplaceMoney(null,'INR'),'Price unavailable');assert.match(marketplaceMoney('10','INR'),/10/);assert.match(marketplaceMoney('10','USD'),/10/);
});
test('16 real Admin destinations and all new routes render without API calls',()=>{
  const {harness}=require('./admin-ui-harness.cjs');const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
  const modules=harness().load('src/features/admin/ui/admin-navigation.ts').adminModules;assert.equal(modules.length,16);
  for(const destination of modules){const h=harness(destination.href);assert.ok(renderToStaticMarkup(React.createElement(h.load(`src/app${destination.href}/page.tsx`).default)).length>0);}
  for(const file of ['src/features/marketplace/MarketplaceCatalogue.tsx','src/features/marketplace/MarketplaceAccount.tsx','src/features/marketplace/MarketplaceProductDetail.tsx']){const h=harness('/marketplace');const component=Object.values(h.load(file))[0];assert.ok(renderToStaticMarkup(React.createElement(component,{portal:'customer',id:'synthetic'})).length>0);}
});
test('new customer UI uses database pagination, renewed proof and reviewed gated moderation',()=>{
  const source=fs.readFileSync(path.join(root,'src/app/admin/customers/page.tsx'),'utf8');assert.match(source,/adminFetch\('\/admin\/customers\?/);assert.match(source,/aria-label="Customer pagination"/);assert.match(source,/ModerationDialog/);assert.match(source,/Review audited status change/);assert.equal(source.includes('stats.walletBalance'),false);assert.equal(source.includes('localStorage.getItem("access_token")'),false);
});
test('orbital art has eight planets, real motion and reduced-motion override',()=>{
  const source=fs.readFileSync(path.join(root,'src/features/home/SolarSystem.tsx'),'utf8');for(const name of ['Mercury','Venus','Earth','Mars','Jupiter','Saturn','Uranus','Neptune'])assert.ok(source.includes(name));const css=fs.readFileSync(path.join(root,'src/features/home/solar-system.module.css'),'utf8');assert.match(css,/prefers-reduced-motion/);assert.match(css,/@keyframes asp-orbit/);
});
for(const portal of ['customer','seller']) test('synthetic '+portal+' workspace exposes owned records and guarded non-payment controls',()=>{
  const {harness}=require('./admin-ui-harness.cjs'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
  const h=harness('/marketplace',{seeds:{'src/features/marketplace/MarketplaceAccount.tsx':[
    [{id:'synthetic-order',orderNumber:'SYNTHETIC',status:'CONFIRMED',currency:'INR',grandTotal:'100'}],
    [{id:'synthetic-product',name:'Synthetic product',stock:2,status:'DRAFT'}],
    {items:[{id:'synthetic-item',quantity:1,product:{name:'Synthetic product'}}]},
    [{id:'synthetic-address',fullName:'Synthetic test',city:'Synthetic city',postalCode:'100001'}],
    [{id:'synthetic-earning',currency:'INR',grossAmount:'100',netAmount:'70',platformFeeAmount:'30',status:'PENDING'}],
    '',false,false,true,'',
  ]}});
  const html=renderToStaticMarkup(React.createElement(h.load('src/features/marketplace/MarketplaceAccount.tsx').MarketplaceAccount,{portal}));
  assert.ok(html.includes('SYNTHETIC'));assert.ok(html.includes('Synthetic product'));
  if(portal==='seller'){assert.ok(html.includes('Edit product details'));assert.ok(html.includes('Upload product image'));assert.ok(html.includes('Update inventory'));assert.ok(html.includes('70% seller / 30% platform'));}
  else{assert.ok(html.includes('Select explicitly'));assert.ok(html.includes('Checkout unavailable'));assert.ok(html.includes('Add an India delivery address'));}
});
