/* eslint-disable @typescript-eslint/no-require-imports */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const root=path.resolve(__dirname,'..');
const exportsObject={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,'src/app/admin/notifications/storage-response.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:exportsObject,Error});
const {notificationStorageError,readNotificationResponse}=exportsObject;
for(const [status,code,pattern] of [[401,null,/expired/],[403,null,/not authorized/],[503,'SMART_SCHEMA_NOT_ACTIVATED',/SMART_NOTIFICATIONS_SCHEMA_READY/],[503,'SMART_CATEGORY_NOT_INSTALLED',/reviewed, disabled/],[400,null,/31 days/],[409,null,/revision/]]) {
 test(`sanitized actionable storage failure ${status} ${code??''}`,()=>assert.match(notificationStorageError(status,code),pattern));
}
test('raw error contents are never rendered',async()=>{
 await assert.rejects(readNotificationResponse({ok:false,status:500,json:async()=>({message:'synthetic-secret-database-url',code:'synthetic-secret-token'})}),error=>!error.message.includes('synthetic-secret'));
});
test('invalid JSON fails closed',async()=>{await assert.rejects(readNotificationResponse({ok:true,status:200,json:async()=>{throw Error('synthetic-private');}}),/could not be verified/);});
test('known legacy schema failure remains actionable without backend restart',async()=>{await assert.rejects(readNotificationResponse({ok:false,status:503,json:async()=>({message:'Smart notification schema is not activated'})}),/SMART_NOTIFICATIONS_SCHEMA_READY/);});
test('similar private exception text is not mistaken for an allowlisted diagnostic',async()=>{await assert.rejects(readNotificationResponse({ok:false,status:503,json:async()=>({message:'Smart notification schema is not activated synthetic-secret'})}),error=>!error.message.includes('synthetic-secret')&&!error.message.includes('SMART_NOTIFICATIONS_SCHEMA_READY'));});
test('requires successful response envelope',async()=>{await assert.rejects(readNotificationResponse({ok:true,status:200,json:async()=>({data:[]})}),/could not be verified/);});
test('returns durable API rows without synthetic success',async()=>{const rows=[{id:'synthetic-draft',state:'DRAFT'}];assert.equal(await readNotificationResponse({ok:true,status:200,json:async()=>({success:true,data:rows})}),rows);});
test('both panels use guarded response parser and explicit persistence states',()=>{
 for(const file of ['CampaignManager.tsx','PolicyManager.tsx']) {
  const source=fs.readFileSync(path.join(root,'src/app/admin/notifications',file),'utf8');
  assert.match(source,/readNotificationResponse/);assert.match(source,/role="status"/);assert.match(source,/role="alert"/);assert.match(source,/await load\(\);(?:setEditing\(null\);)?setSuccess/);
 }
});
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{harness}=require('./admin-ui-harness.cjs');
test('unavailable storage disables draft editing and displays recovery reason',()=>{
 const h=harness('/admin/notifications',{seeds:{'src/app/admin/notifications/CampaignManager.tsx':[[],false,false,'Operator schema approval required']}});
 const html=renderToStaticMarkup(React.createElement(h.load('src/app/admin/notifications/CampaignManager.tsx').default,{categories:[{id:'love',label:'Love'}]}));
 assert.match(html,/Operator schema approval required/);assert.match(html,/<fieldset disabled/);assert.match(html,/Reload campaigns/);
});
test('ready empty campaign storage has labelled full-width editor and save action',()=>{
 const h=harness('/admin/notifications',{seeds:{'src/app/admin/notifications/CampaignManager.tsx':[[],true,false,'']}});
 const html=renderToStaticMarkup(React.createElement(h.load('src/app/admin/notifications/CampaignManager.tsx').default,{categories:[{id:'love',label:'Love'}]}));
 assert.match(html,/No campaigns yet/);assert.match(html,/Editorial text/);assert.match(html,/rows="6"/);assert.match(html,/Save draft/);assert.doesNotMatch(html,/<fieldset disabled/);
});
test('empty policy storage explicitly requires reviewed installation',()=>{
 const h=harness('/admin/notifications',{seeds:{'src/app/admin/notifications/PolicyManager.tsx':[[],'',false,false,false,'']}});
 const html=renderToStaticMarkup(React.createElement(h.load('src/app/admin/notifications/PolicyManager.tsx').default));
 assert.match(html,/No category policies are installed/);assert.match(html,/reviewed, disabled policy/);
});
for(const state of ['DRAFT','APPROVED'])test(`draft edit availability respects ${state} state`,()=>{
 const rows=[{id:'synthetic-draft',state,revision:2,category:'love',locale:'en',title:'Synthetic editorial',body:'A thoughtful reflection.',expiresAt:'2030-01-01T10:00:00Z'}];
 const h=harness('/admin/notifications',{seeds:{'src/app/admin/notifications/CampaignManager.tsx':[rows,true,false,'']}});
 const html=renderToStaticMarkup(React.createElement(h.load('src/app/admin/notifications/CampaignManager.tsx').default,{categories:[{id:'love',label:'Love'}]}));
 if(state==='DRAFT')assert.match(html,/>Edit draft<\//);else assert.doesNotMatch(html,/>Edit draft<\//);
 assert.match(html,/Inspect storage prerequisites/);assert.match(html,/revision 2/);
});
