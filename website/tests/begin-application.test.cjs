const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{test}=require('node:test');
const ts=require('typescript');
const file=path.join(__dirname,'../src/features/astrologers/begin-application.ts');
function harness(options={}){let current=true,committed=0,request;
 const user={uid:'synthetic-uid',getIdTokenResult:async()=>({token:'synthetic-proof',signInProvider:options.provider||'password'})};
 const auth={currentUser:user,authStateReady:async()=>{}};
 const api={beginPublicAuthAttempt:()=>()=>current,commitPortalSession:(result,portal)=>{assert.equal(result.user.id,'synthetic-canonical');assert.equal(portal,'astrologer');committed++;},publicAuthRequest:async(p,b)=>{request={p,b};if(options.switchAccount)current=false;return {authContext:options.context||'astrologer',user:{id:options.otherOwner?'other':'synthetic-canonical'}};}};
 const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const mod={exports:{}};new Function('require','exports','module','localStorage',js)(name=>name.includes('firebaseClient')?{firebaseAuth:auth}:api,mod.exports,mod,{getItem:()=>JSON.stringify({id:'synthetic-canonical',portal:'customer'})});
 return {run:mod.exports.beginApplicationForCurrentCustomer,result:()=>({committed,request})};
}
test('explicit Email join uses backend applicant intent, same canonical account',async()=>{const h=harness();await h.run();assert.equal(h.result().committed,1);assert.equal(h.result().request.b.portal,'joinAstrologer');assert.equal(h.result().request.p,'/auth/firebase/email');});
test('explicit Google join uses Google proof endpoint',async()=>{const h=harness({provider:'google.com'});await h.run();assert.equal(h.result().request.p,'/auth/firebase/google');});
for(const [label,options]of [['unsupported provider',{provider:'phone'}],['account switch',{switchAccount:true}],['foreign canonical account',{otherOwner:true}],['wrong context',{context:'admin'}]])test('rejects '+label,async()=>{const h=harness(options);await assert.rejects(h.run());assert.equal(h.result().committed,0);});
