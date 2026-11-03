const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{test}=require('node:test');
const ts=require('typescript');
const file=path.join(__dirname,'../src/features/admin/auth/admin-request-origin.ts');
const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const mod={exports:{}};new Function('exports','module',js)(mod.exports,mod);const allow=mod.exports.adminRequestOriginAllowed;
const local={origin:'http://127.0.0.1:13310',internalOrigin:'http://localhost:13310',host:'127.0.0.1:13310',mode:'development'};
test('loopback development proxy with exact Host',()=>assert.equal(allow(local),true));
for(const [label,change]of [['production',{mode:'production'}],['test mode',{mode:'test'}],['host mismatch',{host:'attacker.invalid'}],['remote origin',{origin:'http://attacker.invalid:13310'}],['remote internal',{internalOrigin:'http://attacker.invalid:13310'}],['missing origin',{origin:null}],['wrong port',{internalOrigin:'http://localhost:9999'}],['credential URL',{origin:'http://user:password@127.0.0.1:13310'}]])test('rejects '+label,()=>assert.equal(allow({...local,...change}),false));
test('production exact origin remains accepted',()=>assert.equal(allow({origin:'https://astrosoulpath.com',internalOrigin:'https://astrosoulpath.com',host:'astrosoulpath.com',mode:'production'}),true));
