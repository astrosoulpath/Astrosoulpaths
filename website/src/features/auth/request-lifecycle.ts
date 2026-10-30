/** Caller cancellation also bounds non-cooperative SDK/JSON promises. */
export async function withAbort<T>(work:Promise<T>,signal:AbortSignal):Promise<T>{
 if(signal.aborted)throw new DOMException('Request cancelled','AbortError');
 let cancel:()=>void=()=>{};
 try{return await Promise.race([work,new Promise<never>((_,reject)=>{cancel=()=>reject(new DOMException('Request cancelled','AbortError'));signal.addEventListener('abort',cancel,{once:true});})]);}
 finally{signal.removeEventListener('abort',cancel);}
}
