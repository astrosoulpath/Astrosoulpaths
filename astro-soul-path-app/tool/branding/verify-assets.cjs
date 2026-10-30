'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),sharp=require(path.resolve(root,'../website/node_modules/sharp'));
const checks=[];const check=(condition,name)=>{if(!condition)throw Error(name);checks.push(name);};
async function image(p){return sharp(path.join(root,p));}
(async()=>{
 for(const [density,size] of Object.entries({mdpi:48,hdpi:72,xhdpi:96,xxhdpi:144,xxxhdpi:192})){
   const m=await (await image(`android/app/src/main/res/mipmap-${density}/ic_launcher.png`)).metadata();check(m.width===size&&m.height===size,'legacy '+density+' dimensions');
 }
 const catalog=JSON.parse(fs.readFileSync(path.join(root,'ios/Runner/Assets.xcassets/AppIcon.appiconset/Contents.json'),'utf8'));
 for(const item of catalog.images){if(!item.filename)continue;const m=await(await image('ios/Runner/Assets.xcassets/AppIcon.appiconset/'+item.filename)).metadata(),size=Number(item.size.split('x')[0])*Number(item.scale.replace('x',''));check(m.width===size&&m.height===size&&m.channels===3,'iOS opaque RGB '+item.filename);}
 for(const [name,safe] of [['ic_launcher_foreground',66/108],['ic_launcher_monochrome',66/108],['brand_splash',192/288]]){
   const {data,info}=await(await image('android/app/src/main/res/drawable-nodpi/'+name+'.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true});let count=0,outside=0,colored=0;
   for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){const n=(y*info.width+x)*4;if(data[n+3]>0){count++;if(Math.hypot(x+.5-info.width/2,y+.5-info.height/2)>info.width*safe/2)outside++;if(data[n]!==255||data[n+1]!==255||data[n+2]!==255)colored++;}}
   check(outside===0&&count>1000,name+' content entirely inside platform safe circle');
   if(name==='ic_launcher_monochrome')check(colored===0,'themed icon is white alpha mask');
 }
 for(const version of ['v26','v33']){const s=fs.readFileSync(path.join(root,'android/app/src/main/res/mipmap-anydpi-'+version+'/ic_launcher.xml'),'utf8');check(s.includes('<adaptive-icon')&&s.includes('ic_launcher_foreground')&&s.includes('brand_navy'),'adaptive '+version+' layers');if(version==='v33')check(s.includes('<monochrome'),'Android13 monochrome reference');}
 const source='assets/branding/astro_soul_path_icon_1024.png';const m=await(await image(source)).metadata();check(m.width===1024&&m.height===1024&&m.channels===3,'1024 opaque store artwork');
 const result={status:'PASS',checks,sourceSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,source))).digest('hex'),deviceVisualVerification:'UNVERIFIED',iosBuild:'UNVERIFIED_WINDOWS'};
 fs.writeFileSync(path.join(root,'review/branding/native-asset-checks.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:result.status,checks:checks.length}));
})().catch(e=>{console.error('Native asset verification FAILED: '+e.message);process.exitCode=1;});
