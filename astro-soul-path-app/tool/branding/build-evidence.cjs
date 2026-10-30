'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),report=path.join(root,'review/branding/android-build.json');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function walk(dir,filter){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name),filter):filter(e.name)?[path.join(dir,e.name)]:[]);}
const files=[...walk(path.join(root,'lib'),n=>n.endsWith('.dart')),...walk(path.join(root,'android/app/src/main/res'),()=>true),...walk(path.join(root,'ios/Runner/Assets.xcassets'),()=>true),...walk(path.join(root,'assets/branding'),()=>true),'pubspec.yaml','pubspec.lock','android/app/src/main/AndroidManifest.xml','ios/Runner/Base.lproj/LaunchScreen.storyboard'].map(p=>path.isAbsolute(p)?p:path.join(root,p)).sort();
const current=Object.fromEntries(files.map(p=>[path.relative(root,p).replaceAll('\\','/'),hash(p)]));
if(process.argv[2]==='before'){
 fs.mkdirSync(path.dirname(report),{recursive:true});fs.writeFileSync(report,JSON.stringify({status:'RUNNING',startedAt:new Date().toISOString(),source:current},null,2)+'\n');console.log('Frozen '+files.length+' Flutter/native/asset hashes.');
}else{
 const result=JSON.parse(fs.readFileSync(report,'utf8'));result.sourceUnchanged=JSON.stringify(current)===JSON.stringify(result.source);result.exitCode=Number(process.argv[2]);result.status=result.exitCode===0&&result.sourceUnchanged?'PASS':'FAIL';result.completedAt=new Date().toISOString();
 const apk=path.join(root,'build/app/outputs/flutter-apk/app-debug.apk');if(result.status==='PASS'){result.artifact=path.relative(root,apk).replaceAll('\\','/');result.sha256=hash(apk);result.bytes=fs.statSync(apk).size;}
 fs.writeFileSync(report,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:result.status,sourceUnchanged:result.sourceUnchanged,sha256:result.sha256}));if(result.status!=='PASS')process.exitCode=1;
}
