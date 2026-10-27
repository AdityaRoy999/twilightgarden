import React,{useState} from 'react';
import {motion} from 'framer-motion';
import {AppIcon} from '../ui/Icons';
import {useAppMotion} from '../../hooks/useAppMotion';
import {springs,motionTransition} from '../../lib/motion';
import type {Product} from '../../lib/wellnessAI';
export function ShoppingCard({product,index}:{product:Product;index:number}){
 const [failed,setFailed]=useState(false),[saved,setSaved]=useState(false);const {reduced}=useAppMotion();
 const image=product.image&&/^https:\/\//i.test(product.image)?product.image:'';
 return <motion.article className="gift-product" initial={reduced?false:{y:8}} animate={{y:0}} transition={motionTransition(springs.section,reduced)}><div className="gift-product-visual"><a href={product.link} target="_blank" rel="noreferrer" aria-label={`View ${product.title} at ${product.source}`}>{image&&!failed?<img src={image} alt={product.title} onError={()=>setFailed(true)} loading="lazy" referrerPolicy="no-referrer"/>:<div className="gift-image-fallback"><AppIcon name="redeem" size={48}/><span>View at {product.source}</span></div>}<span className="gift-store-badge"><AppIcon name="shopping_bag" size={15}/>{product.source}</span>{product.price?<span className="gift-price">{product.price}</span>:null}</a><button className="gift-favorite" aria-label={`${saved?'Unsave':'Save'} ${product.title}`} aria-pressed={saved} onClick={()=>setSaved(value=>!value)}><AppIcon name="favorite" size={25}/></button></div><div className="gift-product-copy"><a href={product.link} target="_blank" rel="noreferrer"><h3>{product.title}</h3></a><p>Explore at {product.source} <AppIcon name="open_in_new" size={15}/></p>{saved?<small>Saved for this visit</small>:null}</div></motion.article>;
}
export function ShoppingGrid({products,loading}:{products:Product[];loading:boolean}){
 if(loading)return <div className="gift-product-grid" aria-label="Loading gift results" role="status">{Array.from({length:6},(_,index)=><div key={index} className="gift-product-placeholder animate-pulse"/>)}</div>;
 if(!products.length)return <div className="gift-empty"><AppIcon name="search" size={34}/><h3>No matching gifts yet</h3><p>Try another category, see all platforms, or refresh your search.</p></div>;
 return <div className="gift-product-grid">{products.map((product,index)=><ShoppingCard key={product.link} product={product} index={index}/>)}</div>;
}
