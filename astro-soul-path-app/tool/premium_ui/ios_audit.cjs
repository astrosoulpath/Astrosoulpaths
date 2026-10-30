const fs=require('fs'),path=require('path'),crypto=require('crypto');
const sharp=require('../../../website/node_modules/sharp');
const app=path.resolve(__dirname,'../..'),out=path.resolve(app,'../review/flutter-premium-ui/ios-static.json');
async function main(){
 const dir=path.join(app,'ios/Runner/Assets.xcassets/AppIcon.appiconset');
 const content=JSON.parse(fs.readFileSync(path.join(dir,'Contents.json'),'utf8'));
 const icons=[];
 for(const i of content.images){
  if(!i.filename)throw Error('MISSING_ICON_REFERENCE');
  const meta=await sharp(path.join(dir,i.filename)).metadata();
  const size=i.size.split('x').map(Number),scale=parseFloat(i.scale);
  if(meta.width!==size[0]*scale||meta.height!==size[1]*scale||meta.hasAlpha)throw Error('INVALID_ICON_DIMENSION_OR_ALPHA');
  icons.push({filename:i.filename,width:meta.width,height:meta.height,alpha:meta.hasAlpha});
 }
 const project=fs.readFileSync(path.join(app,'ios/Runner.xcodeproj/project.pbxproj'),'utf8');
 const targets=[...project.matchAll(/IPHONEOS_DEPLOYMENT_TARGET = ([\d.]+)/g)].map(m=>m[1]);
 if(!targets.length||targets.some(t=>t!=='15.0'))throw Error('TARGET_DRIFT');
 const plist=fs.readFileSync(path.join(app,'ios/Runner/Info.plist'),'utf8');
 if(!/<key>CFBundleDisplayName<\/key>\s*<string>Astro Soul Path<\/string>/.test(plist))throw Error('DISPLAY_NAME');
 const storyboard=fs.readFileSync(path.join(app,'ios/Runner/Base.lproj/LaunchScreen.storyboard'),'utf8');
 const launchAssets=[...storyboard.matchAll(/<image name="([^"]+)"/g)].map(m=>m[1]);
 for(const name of launchAssets){
  const folder=path.join(app,'ios/Runner/Assets.xcassets',name+'.imageset');
  const data=JSON.parse(fs.readFileSync(path.join(folder,'Contents.json'),'utf8'));
  for(const item of data.images){if(item.filename&&!fs.existsSync(path.join(folder,item.filename)))throw Error('LAUNCH_REFERENCE');}
 }
 const files=['ios/Runner/Info.plist','ios/Runner.xcodeproj/project.pbxproj','ios/Podfile','ios/Runner/Base.lproj/LaunchScreen.storyboard'];
 fs.writeFileSync(out,JSON.stringify({status:'STATIC_PASS',icons,targets,displayName:'PASS',launchAssets,configurationHashes:Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(app,f))).digest('hex')])),build:'UNVERIFIED_NO_MACOS_XCODE',device:'UNVERIFIED'},null,2)+'\n');
 console.log(JSON.stringify({static:'PASS',icons:icons.length,targets,build:'UNVERIFIED',device:'UNVERIFIED'}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
