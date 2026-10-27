export function localAuthEmulator(input:{enabled?:string;project?:string;host?:string;api?:string;hostname?:string;mode?:string}){
 if(input.enabled!=='true')return null;
 if(input.mode==='production'||input.project!=='demo-asp-free-chat'||input.host!=='127.0.0.1:19099'||!['http://127.0.0.1:14100','http://127.0.0.1:14102'].includes(input.api||'')||!['localhost','127.0.0.1'].includes(input.hostname||''))throw Error('Isolated Firebase configuration rejected.');
 return 'http://127.0.0.1:19099';
}
