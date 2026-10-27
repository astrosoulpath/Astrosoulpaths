/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS synthetic test loader. */
/* Synthetic rendering only: no authentication, API request or mutation executes. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require('typescript'),React=require('react');
const root=path.resolve(__dirname,'..');
const stats={users:{total:24},astrologers:{total:8,pending:2,approved:6,verified:6,online:3},consultations:{totalCallSessions:42},payments:{totalOrders:9,successfulOrders:7,successfulAmountByCurrency:[{currency:'INR',amount:3500}],refundedOrders:1,refundedAmountByCurrency:[{currency:'INR',amount:100}]},wallets:{totalWallets:24,totalBalanceByCurrency:[{currency:'INR',amount:1200}]},reviews:{total:0}};
const finance={wallets:[],earnings:[],payouts:[],collections:[],settlement:{status:'UNVERIFIED',reason:'Synthetic fixture: no bank settlement evidence.'},warning:'Synthetic preview only — no real financial records.',audit:{status:'RECORDED',rows:[]}};
function harness(route='/admin',options={}){
  let current='',hook=0;const cache=new Map();
  const seeds={
    'src/features/admin/AdminDashboard.tsx':[stats,false,null],
    'src/features/admin/components/AstrologerTable.tsx':[[{id:'synthetic-astrologer',userId:'synthetic-user',user:{name:'Synthetic test profile'},languages:['English'],experience:5,pricePerMin:10,isApproved:true,isVerified:true,expertise:[{expertise:{name:'Synthetic specialty'}}]}],false,''],
    'src/app/admin/finance/page.tsx':[finance,''],
    'src/app/admin/astrologers/[id]/page.tsx':[{id:'synthetic',user:{name:'Synthetic detail profile'},languages:[],expertise:[],isApproved:false,isVerified:false},null,false,null,null],
    'src/app/admin/customers/page.tsx':[[],'','ALL',false,false,null,null,null],
    'src/app/admin/astrologers/page.tsx':[[],'','ALL',false,false,null,null,null],
    'src/app/admin/consultations/page.tsx':[[],'','ALL',false,false,null,null,null],
    'src/app/admin/payments/page.tsx':[[],'','ALL',false,false,null],
    'src/app/admin/subscriptions/page.tsx':[[],'','ALL',false,false,null],
    'src/app/admin/wallet/page.tsx':[[],false,false,'',''],
    ...options.seeds,
  };
  const hooks={...React,useState(initial){const values=seeds[current];const value=values&&hook<values.length?values[hook]:initial;hook++;return React.useState(value);}};
  function load(file){
    let full=path.resolve(root,file);if(!fs.existsSync(full)&&full.endsWith('.ts'))full+='x';
    if(cache.has(full))return cache.get(full).exports;
    const mod={exports:{}};cache.set(full,mod);
    const relative=path.relative(root,full).replaceAll('\\','/');
    const js=ts.transpileModule(fs.readFileSync(full,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
    const resolve=name=>{
      if(name==='react')return hooks;
      if(name==='next/link')return {default:({children,...props})=>React.createElement('a',props,children)};
      if(name==='next/navigation')return {usePathname:()=>route,useParams:()=>({id:'synthetic'}),useRouter:()=>({replace(){},refresh(){},push(){}})};
      if(name.endsWith('.module.css'))return {default:new Proxy({},{get:(_,key)=>String(key)})};
      if(name.includes('auth/admin-session'))return {adminFetch(){throw Error('Unexpected API request');},refreshAdminSession(){throw Error('Unexpected auth request');},logoutAdmin(){throw Error('Unexpected logout');}};
      if(name.includes('auth/admin-contract'))return {getAdminApiBase:()=> 'https://synthetic.invalid'};
      if(name.startsWith('@/'))return load(`src/${name.slice(2)}.ts`);
      if(name.startsWith('.'))return load(path.relative(root,path.resolve(path.dirname(full),name))+'.ts');
      return require(name);
    };
    vm.runInThisContext(`(function(require,module,exports){${js}\n})`,{filename:full})(resolve,mod,mod.exports);
    for(const key of Object.keys(mod.exports))if(typeof mod.exports[key]==='function'&&/^(?:[A-Z]|default)/.test(key)){
      const original=mod.exports[key];
      mod.exports[key]=function PreviewComponent(props){const previous=current,previousHook=hook;current=relative;hook=0;try{return original(props);}finally{current=previous;hook=previousHook;}};
    }
    return mod.exports;
  }
  return {load,stats};
}
module.exports={harness,root,stats};
