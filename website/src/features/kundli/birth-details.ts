export const reportLanguages = { en:"English", hi:"Hindi", bn:"Bengali", ta:"Tamil", te:"Telugu", mr:"Marathi", gu:"Gujarati", kn:"Kannada", ml:"Malayalam", pa:"Punjabi", es:"Spanish", fr:"French", de:"German", pt:"Portuguese", it:"Italian", ja:"Japanese", ko:"Korean", zh:"Chinese", ar:"Arabic", ru:"Russian" };
export type BirthDetails = { name:string; gender:string; dob:string; tob:string; birthPlace:string; lat:string; lon:string; timezone:string; timezoneName:string; language:string };
export const emptyBirthDetails: BirthDetails = {name:"",gender:"",dob:"",tob:"",birthPlace:"",lat:"",lon:"",timezone:"",timezoneName:"",language:"en"};
export function validZone(value:string) { try { new Intl.DateTimeFormat("en",{timeZone:value}).format(0);return !!value.trim(); } catch { return false; } }
export function birthErrors(form:BirthDetails, today:string): Record<string,string> {
 const errors:Record<string,string>={};
 if(form.name.trim().length<2||form.name.length>120)errors.name="Enter a full name between 2 and 120 characters.";
 if(!["MALE","FEMALE","OTHER"].includes(form.gender))errors.gender="Select a supported gender value.";
 const date=new Date(form.dob+"T00:00:00Z");
 if(!/^\d{4}-\d{2}-\d{2}$/.test(form.dob)||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==form.dob||form.dob>today)errors.dob="Enter a real birth date that is not in the future.";
 if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(form.tob))errors.tob="Enter the exact birth time, in 24-hour HH:mm format.";
 if(form.birthPlace.trim().length<2||form.birthPlace.length>200)errors.birthPlace="Enter the birth city or place (up to 200 characters).";
 for(const [field,min,max] of [["lat",-90,90],["lon",-180,180]] as const)if(!form[field].trim()||!Number.isFinite(Number(form[field]))||Number(form[field])<min||Number(form[field])>max)errors[field]=`${field==="lat"?"Latitude":"Longitude"} must be between ${min} and ${max}.`;
 if(form.timezoneName.trim()){if(!validZone(form.timezoneName.trim()))errors.timezoneName="Enter a valid IANA zone, such as Europe/London.";}
 else if(!form.timezone.trim()||!Number.isFinite(Number(form.timezone))||Number(form.timezone)<-12||Number(form.timezone)>14)errors.timezone="Enter an IANA zone or a verified UTC offset at the birth date (-12 to +14).";
 if(!Object.prototype.hasOwnProperty.call(reportLanguages,form.language))errors.language="Select a supported report language.";
 return errors;
}
export type BirthPlace={fullname:string;latitude:number;longitude:number;timezoneName:string};
export function parsePlaces(value:unknown):BirthPlace[]{const body=value as {success?:boolean;data?:unknown};if(body?.success!==true||!Array.isArray(body.data))throw Error("City search is unavailable. Use manual coordinates and timezone.");return body.data.filter((p):p is BirthPlace=>!!p&&typeof p==="object"&&typeof p.fullname==="string"&&Number.isFinite(p.latitude)&&Math.abs(p.latitude)<=90&&Number.isFinite(p.longitude)&&Math.abs(p.longitude)<=180&&typeof p.timezoneName==="string"&&validZone(p.timezoneName)).slice(0,8).map(p=>({fullname:p.fullname,latitude:p.latitude,longitude:p.longitude,timezoneName:p.timezoneName}));}
