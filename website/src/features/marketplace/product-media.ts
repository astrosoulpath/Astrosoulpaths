import type {Product} from './marketplace-api';
export function productMediaUrl(product:Product){
 const images=[...(product.images??[])].sort((a,b)=>Number(!!b.isPrimary)-Number(!!a.isPrimary));
 for(const image of images){const raw=image.imageUrl??image.url;if(!raw||raw.includes('\\'))continue;
  if(raw.startsWith('/')&&!raw.startsWith('//'))return raw;
  try{const url=new URL(raw);if(!url.username&&!url.password&&(url.protocol==='https:'||(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname))))return url.href;}catch{}
 }return null;
}
