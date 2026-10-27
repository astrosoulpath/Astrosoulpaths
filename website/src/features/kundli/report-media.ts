export function safeKundliMedia(value:unknown):string|null {
 if(typeof value!=="string"||/[\\\u0000-\u001f]/.test(value))return null;
 if(value.startsWith("/")&&!value.startsWith("//"))return value;
 try{const url=new URL(value);return !url.username&&!url.password&&(url.protocol==="https:"||(url.protocol==="http:"&&["localhost","127.0.0.1","[::1]"].includes(url.hostname)))?url.toString():null;}catch{return null;}
}
export function chartSvgImage(value:unknown):string|null {return typeof value==="string"&&value.length<=1000000&&/<svg\b/i.test(value)?"data:image/svg+xml;charset=utf-8,"+encodeURIComponent(value):null;}
