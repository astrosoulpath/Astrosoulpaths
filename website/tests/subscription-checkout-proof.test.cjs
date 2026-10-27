const {test}=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'), vm=require('node:vm'), ts=require('typescript');
const code=ts.transpileModule(fs.readFileSync('src/services/subscriptionService.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function service(reply={success:true,status:'SUCCESS'}) {
  let token='synthetic-session', calls=[];
  const context={exports:{},window:{},AbortSignal,process:{env:{NEXT_PUBLIC_API_BASE_URL:'https://example.invalid'}},
    localStorage:{getItem:k=>k==='asp_user'?'{"portal":"customer"}':k==='asp_customer_access_token'?token:null},
    fetch:async(url,options)=>{calls.push({url,options});return {ok:true,status:200,json:async()=>typeof reply==='function'?reply():reply};}};
  vm.runInNewContext(code,context); return {api:context.exports,calls,change:()=>{token='other-session';}};
}
const proof={razorpay_order_id:'order_owned',razorpay_payment_id:'pay_owned',razorpay_signature:'a'.repeat(64)};
test('subscription checkout forwards HMAC proof only to authenticated backend verification',async()=>{
  const app=service(); await app.api.verifySubscriptionCheckout('order_owned',proof);
  assert.equal(app.calls.length,1); assert.match(app.calls[0].url,/\/payments\/verify-checkout$/);
  assert.equal(app.calls[0].options.headers.Authorization,'Bearer synthetic-session');
  assert.deepEqual(JSON.parse(app.calls[0].options.body),{orderId:'order_owned',paymentId:'pay_owned',signature:'a'.repeat(64)});
});
for(const changed of [{razorpay_order_id:'order_foreign'},{razorpay_payment_id:''},{razorpay_signature:''},{razorpay_signature:'invalid'}])
  test('invalid subscription callback proof is rejected without reconciliation '+JSON.stringify(changed),async()=>{
    const app=service(); await assert.rejects(app.api.verifySubscriptionCheckout('order_owned',{...proof,...changed}),/Invalid checkout proof/); assert.equal(app.calls.length,0);
  });
test('account switch while verification is pending cannot return previous account success',async()=>{
  let app; app=service(()=>{app.change();return {success:true,status:'SUCCESS'};});
  await assert.rejects(app.api.verifySubscriptionCheckout('order_owned',proof),/Account changed/);
});
test('checkout config validates server key and mode agreement',async()=>{
  await assert.rejects(service({keyId:'rzp_live_synthetic',mode:'TEST'}).api.getSubscriptionCheckoutConfig(),/environment/);
  assert.equal((await service({keyId:'rzp_test_synthetic',mode:'TEST'}).api.getSubscriptionCheckoutConfig()).mode,'TEST');
});
