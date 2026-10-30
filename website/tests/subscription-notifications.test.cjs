const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const source=fs.readFileSync(path.join(__dirname,'../src/features/notifications/subscription-api.ts'),'utf8');
function fixture(overrides={}){
 let snapshot='customer-owner',posts=0;
 const auth={publicAuthBase:()=> 'http://127.0.0.1:1',sessionCandidate:()=>({token:'synthetic',snapshot}),verifyNavigationSession:async()=>({id:'owner',portal:'customer'})};
 const data={ownerId:'owner',roleContext:'CUSTOMER',serverNow:'2026-10-30T12:00:00Z',unreadCount:0,reminders:[],subscription:{startDate:'2026-10-07T12:00:00Z',expiresAt:'2026-11-06T12:00:00Z'},...overrides};
 const exports={};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:()=>auth,AbortSignal,Date,Number,Math,Error,fetch:async()=>{posts++;return new Response(JSON.stringify({success:true,data}));}});
 return {api:exports,auth,data,count:()=>posts,switchOwner:()=>snapshot='different'};
}
test('all eight countdown milestones are backend-clock based',()=>{
 const {api,data}=fixture();for(let days=0;days<=7;days++){const now=Date.parse(data.subscription.expiresAt)-days*86400000;assert.equal(api.subscriptionProgress(data,now).days,days);}
});
test('missing timestamps never fabricate countdown',()=>{const {api,data}=fixture({subscription:null});assert.equal(api.subscriptionProgress(data),null);});
test('role-specific route selection',()=>{const {api}=fixture();assert.equal(api.subscriptionPath('CUSTOMER'),'/notifications');assert.equal(api.subscriptionPath('ASTROLOGER'),'/astrologer/notifications');});
test('authorized read checks canonical owner and role',async()=>{const f=fixture();assert.equal((await f.api.subscriptionRequest('CUSTOMER',new AbortController().signal)).ownerId,'owner');assert.equal(f.count(),1);});
for(const override of [{ownerId:'other'},{roleContext:'ASTROLOGER'},{reminders:null},{unreadCount:'8'}])test('rejects untrusted response '+JSON.stringify(override),async()=>{const f=fixture(override);await assert.rejects(f.api.subscriptionRequest('CUSTOMER',new AbortController().signal),/could not be verified/);});
test('wrong selected portal prevents API request',async()=>{const f=fixture();await assert.rejects(f.api.subscriptionRequest('ASTROLOGER',new AbortController().signal),/correct account/);assert.equal(f.count(),0);});
test('expired progress is clamped, never negative',()=>{const {api,data}=fixture();assert.equal(api.subscriptionProgress(data,Date.parse(data.subscription.expiresAt)+86400000).progress,0);});
