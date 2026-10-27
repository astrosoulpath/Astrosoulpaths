export type ReportValue = string | number | boolean | ReportValue[] | { [key:string]:ReportValue };
export type ReportSection = { key:string; title:string; value:ReportValue; truncated:boolean };
const object=(value:unknown):Record<string,unknown>=>value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:{};
const privateKey=/^(?:__proto__|prototype|constructor|input|metadata|providerPayload|userId|customerUserId|astrologerId|email|token|credentials|profile)$/i;
export function projectReportSections(raw:unknown):ReportSection[]{const report=object(raw),analysis=object(report.analysis),extended=object(report.extended),kp=object(report.kp),charts=object(report.charts);
 const definitions:[string,string,unknown][]=[
 ["positions","Supplied planetary positions",report.planetaryPositions],["ascendant","Supplied ascendant and Nakshatra",report.ascendant],
 ["d1-source","D1 source placements",report.birthChart??charts.birthChart],["d9-source","D9 source placements",report.navamsaChart??charts.navamsaChart],
 ["divisional","Additional supplied charts",charts.divisionalCharts],
 ["dasha","Dasha and Antardasha hierarchy",report.dasha],["panchang","Panchang",report.panchang],["yogas","Planetary yogas",report.yogas],
 ["dosha","Supplied Dosha details",report.dosha],["kp-houses","KP houses",kp.houses],["kp-planets","KP planets",kp.planets],
 ["shadbala","Shadbala",report.shadbala],["ashtakavarga","Ashtakavarga",report.ashtakavarga],
 ["houses","House analysis",analysis.houses??report.houses],["transit","Transits",report.transit??analysis.transit],
 ["sade-sati","Sade Sati",extended.sadeSati],["gems","Recorded gemstone guidance",extended.gemSuggestion],
 ...["d1Explanation","d9Explanation","character","career","marriage","finance","health","remedies"].map(key=>["analysis-"+key,key.replace(/([A-Z])/g," $1"),analysis[key]??report[key]] as [string,string,unknown]),
 ];
 // No provider input/metadata or arbitrary root payload is projected. Bounds
 // prevent enormous technical trees blocking a private report's rendering.
 return definitions.flatMap(([key,title,value])=>{let nodes=0,truncated=false;const seen=new WeakSet<object>();function clean(v:unknown,depth=0):ReportValue|undefined{
 if(v===null||v===undefined)return undefined;if(++nodes>3000||depth>12){truncated=true;return undefined;}
 if(typeof v==="string"){if(!v.trim())return undefined;if(v.length>20000){truncated=true;return v.slice(0,20000);}return v;}
 if(typeof v==="number")return Number.isFinite(v)?v:undefined;if(typeof v==="boolean")return v;
 if(typeof v!=="object")return undefined;if(seen.has(v)){truncated=true;return undefined;}seen.add(v);
 if(Array.isArray(v)){if(v.length>120)truncated=true;const result=v.slice(0,120).map(x=>clean(x,depth+1)).filter((x):x is ReportValue=>x!==undefined);return result.length?result:undefined;}
 const entries=Object.entries(v).filter(([name])=>!privateKey.test(name));if(entries.length>80)truncated=true;const result=Object.fromEntries(entries.slice(0,80).flatMap(([name,x])=>{const result=clean(x,depth+1);return result===undefined?[]:[[name,result]];}));return Object.keys(result).length?result:undefined;
 }const projected=clean(value);return projected===undefined?[]:[{key,title,value:projected,truncated}];});
}
