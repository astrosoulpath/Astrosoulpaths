/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'), vm=require('node:vm'), ts=require('typescript');
function app(overrides={}) {
  let current='one', options, failed, created=0, verified=0, resumed=0, reconciled=0, opened=0, closed=0;
  const store=new Map(), listeners=new Map();
  const exports={};
  const order={id:'order_owned',amount:10000,currency:'INR'};
  const proof={razorpay_order_id:'order_owned',razorpay_payment_id:'pay_owned',razorpay_signature:'a'.repeat(64)};
  class Provider {constructor(value){options=value;} open(){opened++;} close(){closed++;} on(_event,fn){failed=fn;}}
  const candidate=()=>current?{portal:current==='astrologer'?'astrologer':'customer',token:'private-'+current,snapshot:current}:null;
  const localStorage={getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,value),removeItem:key=>store.delete(key)};
  const window={addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)};
  const fetch=async(url,init)=>{
    assert.equal(init.credentials,'omit');assert.equal(init.cache,'no-store');assert.equal(init.headers.Authorization,'Bearer private-'+current);
    let value;
    if(url.includes('/user/session')) value={portal:'customer',role:'CUSTOMER',user:{portal:'customer',id:'user-'+current}};
    else if(url.endsWith('checkout-config')) value=overrides.config||{keyId:'rzp_test_synthetic',mode:'TEST'};
    else if(url.endsWith('create-wallet-recharge-order')){created++;if(overrides.create) return overrides.create();value=overrides.order||order;}
    else if(url.includes('wallet-order')){resumed++;value=order;}
    else if(url.endsWith('verify-checkout')){verified++;assert.deepEqual(JSON.parse(init.body),{orderId:'order_owned',paymentId:'pay_owned',signature:proof.razorpay_signature});value=overrides.verify?await overrides.verify():{success:true,status:'SUCCESS'};}
    else if(url.includes('reconcile')){reconciled++;value=overrides.status||{success:true,status:'SUCCESS'};}
    else throw Error('Unexpected endpoint '+url);
    return {ok:true,status:200,json:async()=>value};
  };
  const source=ts.transpileModule(fs.readFileSync('src/features/wallet/wallet-payment.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(source,{exports,require:name=>name.includes('public-auth')?{publicAuthBase:()=> 'https://test.invalid',sessionCandidate:candidate}:{loadCheckout:async()=>Provider},fetch,localStorage,window,AbortSignal,Set,Error,encodeURIComponent});
  return {run:(action='checkout',amount=100,signal=new AbortController().signal)=>exports.walletPayment(action,amount,signal,async()=>Provider),
    ready:()=>new Promise(resolve=>setImmediate(resolve)),proof,store,get options(){return options;},failed:()=>failed(),
    change:(value='two')=>{current=value;listeners.get('asp-auth-changed')?.();},stats:()=>({created,verified,resumed,reconciled,opened,closed})};
}
test('page uses secure wallet checkout and exposes explicit recovery, never direct credits',()=>{
 const s=fs.readFileSync('src/app/wallet/recharge/page.tsx','utf8');assert.match(s,/walletPayment/);assert.match(s,/Check pending payment status/);assert.doesNotMatch(s,/rechargeWallet|added successfully|local testing flow/);
});
test('server-owned key/order opens checkout; callback alone never credits',async()=>{
 let resolve;const a=app({verify:()=>new Promise(r=>{resolve=r;})});let finished=false;const p=a.run().then(v=>{finished=true;return v;});await a.ready();
 assert.equal(a.options.key,'rzp_test_synthetic');assert.equal(a.options.amount,10000);assert.equal(finished,false);
 const cb=a.options.handler(a.proof);await a.ready();assert.equal(finished,false);resolve({success:true,status:'SUCCESS'});await cb;assert.equal(await p,'SUCCESS');assert.equal(a.store.size,0);
});
test('configured LIVE public key is used only when authenticated server config reports LIVE',async()=>{
 const a=app({config:{keyId:'rzp_live_synthetic',mode:'LIVE'}});const p=a.run();await a.ready();assert.equal(a.options.key,'rzp_live_synthetic');a.options.modal.ondismiss();assert.equal(await p,'CANCELLED');
});
test('key/mode mismatch fails before order creation',async()=>{
 const a=app({config:{keyId:'rzp_live_synthetic',mode:'TEST'}});await assert.rejects(a.run(),/environment/);assert.equal(a.stats().created,0);
});
test('concurrent clicks and duplicate callbacks verify only once',async()=>{
 let complete;const a=app({verify:()=>new Promise(r=>{complete=r;})});const p=a.run();await a.ready();await assert.rejects(a.run(),/already in progress/);
 const first=a.options.handler(a.proof);await a.ready();await a.options.handler(a.proof);complete({success:true,status:'SUCCESS'});await first;assert.equal(await p,'SUCCESS');assert.equal(a.stats().verified,1);assert.equal(a.stats().created,1);
});
for(const status of ['PENDING','FAILED'])test('server '+status+' is not payment success',async()=>{
 const a=app({verify:()=>({success:true,status})});const p=a.run();await a.ready();await a.options.handler(a.proof);assert.equal(await p,status);
});
for(const proof of [{razorpay_order_id:'order_foreign'},{razorpay_order_id:'order_owned',razorpay_payment_id:'pay_owned',razorpay_signature:'bad'}])test('forged/missing callback proof never falls back to reconciliation',async()=>{
 const a=app();const p=a.run();const denied=assert.rejects(p,/not confirmed/);await a.ready();await a.options.handler(proof);await denied;assert.equal(a.stats().verified,0);assert.equal(a.stats().reconciled,0);assert.equal(a.store.size,1);
});
test('dismissal retains pending reference; resume reuses backend-validated order',async()=>{
 const a=app();let p=a.run();await a.ready();a.options.modal.ondismiss();assert.equal(await p,'CANCELLED');p=a.run();await a.ready();assert.equal(a.stats().created,1);assert.equal(a.stats().resumed,1);a.failed();assert.equal(await p,'FAILED');
});
test('explicit recovery asks backend and does not open checkout/create order',async()=>{
 const a=app();const p=a.run();await a.ready();a.options.modal.ondismiss();await p;assert.equal(await a.run('status'),'SUCCESS');assert.equal(a.stats().created,1);assert.equal(a.stats().reconciled,1);assert.equal(a.store.size,0);
});
test('unknown creation result survives reload attempts and forbids another order',async()=>{
 const a=app({create:()=>{throw Error('offline');}});await assert.rejects(a.run());await assert.rejects(a.run(),/uncertain/);assert.equal(a.stats().created,1);
});
test('account switch closes checkout and does not expose previous pending reference',async()=>{
 const a=app();const p=a.run();const denied=assert.rejects(p,/closed/);await a.ready();a.change();await denied;assert.equal(a.stats().closed,1);await assert.rejects(a.run('status'),/No pending/);assert.equal(a.stats().verified,0);
});
test('disposal abort closes SDK without any fulfillment',async()=>{
 const a=app(), c=new AbortController();const p=a.run('checkout',100,c.signal);const denied=assert.rejects(p,/closed/);await a.ready();c.abort();await denied;assert.equal(a.stats().closed,1);assert.equal(a.stats().verified,0);
});
test('amount mismatch is retained for status review, never shown as success',async()=>{
 const a=app({order:{id:'order_owned',amount:9999,currency:'INR'}});await assert.rejects(a.run(),/mismatch/);assert.equal(a.stats().opened,0);assert.equal(a.store.size,1);
});
test('verification transport failure retains pending and never retries automatically',async()=>{
 const a=app({verify:()=>{throw Error('private provider detail');}});const p=a.run();const denied=assert.rejects(p,e=>/not confirmed/.test(e.message)&&!e.message.includes('private'));await a.ready();await a.options.handler(a.proof);await denied;assert.equal(a.stats().verified,1);assert.equal(a.stats().reconciled,0);
});
test('account change during verification cannot clear old pending state or announce success',async()=>{
 let complete;const a=app({verify:()=>new Promise(r=>{complete=r;})});const p=a.run();const denied=assert.rejects(p,/closed/);await a.ready();const callback=a.options.handler(a.proof);await a.ready();a.change();await denied;complete({success:true,status:'SUCCESS'});await callback;assert.equal(a.store.size,1);
});
test('an unsuccessful API envelope never confirms a fulfilled payment',async()=>{
 const a=app({verify:()=>({success:false,status:'SUCCESS'})});const p=a.run();await a.ready();await a.options.handler(a.proof);assert.equal(await p,'PENDING');assert.equal(a.store.size,1);
});
test('noncustomer and invalid amount cannot create orders',async()=>{
 const a=app();await assert.rejects(a.run('checkout',10));a.change('astrologer');await assert.rejects(a.run(),/Customer/);assert.equal(a.stats().created,0);
});
