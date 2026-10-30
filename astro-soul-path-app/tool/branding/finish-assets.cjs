'use strict';
// Existing locally installed raster tooling only; no downloads or website edits.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),sharp=require(path.resolve(root,'../website/node_modules/sharp'));
async function opaque(file){const data=await sharp(file).removeAlpha().png().toBuffer();fs.writeFileSync(file,data);const m=await sharp(data).metadata();if(m.channels!==3)throw Error('iOS RGB export failed');return{file:path.relative(root,file).replaceAll('\\','/'),width:m.width,height:m.height,channels:m.channels};}
(async()=>{
 const dir=path.join(root,'ios/Runner/Assets.xcassets/AppIcon.appiconset');const catalog=JSON.parse(fs.readFileSync(path.join(dir,'Contents.json'),'utf8')),results=[];
 for(const i of catalog.images){if(i.filename)results.push(await opaque(path.join(dir,i.filename)));}
 results.push(await opaque(path.join(root,'assets/branding/astro_soul_path_icon_1024.png')));
 fs.writeFileSync(path.join(root,'review/branding/asset-verification.json'),JSON.stringify({status:'PASS',iosOpaqueRgb:results},null,2)+'\n');console.log('Verified '+results.length+' opaque RGB icon exports.');
})().catch(()=>{console.error('Asset conversion failed');process.exitCode=1;});
