const fs=require('fs'),path=require('path'),crypto=require('crypto');
const sharp=require('../../../website/node_modules/sharp');
const app=path.resolve(__dirname,'../..'),report=path.resolve(app,'../review/flutter-premium-ui');
async function main(){
 const sources=['kundli_ai','horoscope','ai_astro','predictions','career','marriage','stock_market','today','business'];
 const assets=[];
 for(const name of sources){
  const source=path.join(app,'assets/stickers/home_astrology',name+'.png');
  const target=path.join(app,'assets/stickers/home_astrology',name+'-premium.webp');
  await sharp(source).resize(512,512,{fit:'inside',withoutEnlargement:true}).webp({quality:88,effort:6}).toFile(target);
  assets.push({source:path.relative(app,source),target:path.relative(app,target),sourceBytes:fs.statSync(source).size,bytes:fs.statSync(target).size,sourceSHA256:crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex')});
 }
 for(const [source,name] of [['kundli_ai_bg','ai-section'],['astrologer_profile_background','real-section']]){
  const target=path.join(app,'assets/stickers/home_astrology',name+'-premium.webp');
  await sharp(path.join(app,'assets/stickers',source+'.png')).resize({width:720,withoutEnlargement:true}).webp({quality:83,effort:6}).toFile(target);
  assets.push({source:'assets/stickers/'+source+'.png',target:path.relative(app,target),bytes:fs.statSync(target).size});
 }
 fs.writeFileSync(path.join(report,'asset-optimization.json'),JSON.stringify(assets,null,2)+'\n');
 console.log(JSON.stringify({optimized:assets.length,totalBytes:assets.reduce((n,a)=>n+a.bytes,0),originalImagesOverwritten:false}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
