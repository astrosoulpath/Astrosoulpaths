/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');
function harness(fetch, token = () => 'synthetic') {
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname,'../src/services/birthSharingService.ts'),'utf8');
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,fetch,URL,Error});
  return extra => exports.requestBirthSharing({base:'http://localhost:4000',consultationId:'synthetic',signal:new AbortController().signal,readToken:token,...extra});
}
test('owner profile preview uses no-store and no GET body',async()=>{
  const request=harness(async(url,options)=>{
    assert.equal(url.searchParams.get('profileRef'),'saved:family');
    assert.equal(options.cache,'no-store'); assert.equal(options.body,undefined);
    return {ok:true,json:async()=>({state:'NOT_SHARED',isCustomer:true,details:null})};
  });
  assert.equal((await request({profileRef:'saved:family'})).state,'NOT_SHARED');
});
test('explicit grant forwards reviewed scope and revision only',async()=>{
  const request=harness(async(url,options)=>{
    assert.equal(url.pathname,'/consultations/synthetic/birth-sharing/grant');
    assert.deepEqual(JSON.parse(options.body),{profileRef:'user:owner',birthVersion:'version',policyVersion:'v2',revision:2});
    return {ok:true,json:async()=>({state:'SHARED',isCustomer:true,details:null})};
  });
  await request({action:'grant',reviewed:{profileRef:'user:owner',birthVersion:'version',policyVersion:'v2',revision:2,untrustedRole:'ADMIN'}});
});
test('account switch discards in-flight response',async()=>{
  let token='synthetic';
  const request=harness(async()=>{token='other';return {ok:true,json:async()=>({state:'SHARED',isCustomer:false,details:{fullName:'Synthetic'}})};},()=>token);
  await assert.rejects(request({}),/BIRTH_SHARING_UNAVAILABLE/);
});
test('authorization failure is generic with no retry',async()=>{
  let calls=0; const request=harness(async()=>{calls++;return {ok:false,json:async()=>{throw Error('private');}};});
  await assert.rejects(request({}),/^Error: BIRTH_SHARING_UNAVAILABLE$/); assert.equal(calls,1);
});
test('missing token cannot call backend',async()=>{
  const request=harness(async()=>{assert.fail('must not fetch');},()=>null);
  await assert.rejects(request({}),/BIRTH_SHARING_UNAVAILABLE/);
});
test('aborted request cannot publish a late response',async()=>{
  const controller=new AbortController();
  const request=harness(async()=>{controller.abort();return {ok:true,json:async()=>({state:'SHARED',isCustomer:false,details:null})};});
  await assert.rejects(request({signal:controller.signal}),/BIRTH_SHARING_UNAVAILABLE/);
});
