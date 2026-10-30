"use client";
import Image from 'next/image';
import {useState} from 'react';
import type {Product} from './marketplace-api';
import {productMediaUrl} from './product-media';
import s from '../customer-workspace/workspace.module.css';
export function MarketplaceProductImage({product,large=false}:{product:Product;large?:boolean}){const src=productMediaUrl(product);return <ProductImage key={src??'missing'} src={src} name={product.name} large={large}/>;}
function ProductImage({src,name,large}:{src:string|null;name:string;large:boolean}){
 const [loaded,setLoaded]=useState(false),[failed,setFailed]=useState(!src);
 return <div className={large?s.productPhotoLarge:s.productPhoto}>
  {!failed&&src&&<Image unoptimized src={src} alt={name} width={large?480:80} height={large?480:80} onLoad={()=>setLoaded(true)} onError={()=>setFailed(true)} style={{opacity:loaded?1:0}}/>}
  {!loaded&&!failed&&<span className={s.photoPlaceholder} role="status" aria-label={'Loading image for '+name}>Loading image…</span>}
  {failed&&<span className={s.photoPlaceholder} role="img" aria-label={'Image unavailable for '+name}><svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true"><path d="M5 9l11-6 11 6v14l-11 6-11-6V9zm0 0l11 6 11-6M16 15v14" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg><span>Image unavailable</span></span>}
 </div>;
}
