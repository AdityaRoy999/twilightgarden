import React,{useState,useEffect,useRef,useMemo} from 'react';
import {generateGiftRecommendations,searchShoppingProducts,type Product,type WellnessContext} from '../../lib/wellnessAI';
import {withinDeadline} from '../../lib/requestTimeout';
import {ShoppingGrid} from './ShoppingCards';
import {WellnessIllustration} from './WellnessIllustration';
import {SegmentedControl} from '../ui/SegmentedControl';
import {AppIcon} from '../ui/Icons';
import {giftCategory,sortGiftProducts} from '../../lib/gifts';
import {useAuth} from '../../contexts/AuthContext';
export function GiftIdeas({context,partnerName}:{context:WellnessContext;partnerName:string}){
 const {user}=useAuth();
 const [products,setProducts]=useState<Product[]>([]),[platform,setPlatform]=useState('All'),[category,setCategory]=useState('All'),[sort,setSort]=useState('relevant'),[busy,setBusy]=useState(true),[error,setError]=useState('');
 const version=useRef(0);const contextKey=JSON.stringify([user?.id,context]);
 const request=useRef<{key:string;pending:Promise<Product[]>}|null>(null);
 const load=async(refresh=false)=>{
  const revision=++version.current;setBusy(true);setError('');
  try{
   const pending=!refresh&&request.current?.key===contextKey?request.current.pending:withinDeadline(async()=>{
    if(!user?.id)throw new Error('Please sign in to search gift ideas.');
    const result=await generateGiftRecommendations(context,user.id);if(result.error)throw new Error(result.error);
    const terms=[...new Set(result.text.split(',').map(term=>term.trim()).filter(Boolean))].slice(0,5);
    if(!terms.length)throw new Error('No gift searches were returned. Please retry.');
    const responses=await Promise.allSettled(terms.map(term=>searchShoppingProducts(term,user.id)));
    const all=responses.flatMap(response=>response.status==='fulfilled'?response.value:[]);
    const valid=all.filter(product=>{try{return new URL(product.link).protocol==='https:'&&!!product.title;}catch{return false;}});
    if(!valid.length)throw new Error('No store results are available right now. Please try again.');
    return [...new Map(valid.map(product=>[product.link,product])).values()];
   },70000,'Gift searches are taking too long. Please retry.');
   request.current={key:contextKey,pending};
   const found=await pending;
   if(revision===version.current)setProducts(found);
  }catch(reason){if(revision===version.current)setError(reason instanceof Error?reason.message:'Gift search is unavailable.');}
  finally{if(revision===version.current)setBusy(false);}
 };
 useEffect(()=>{setProducts([]);setPlatform('All');setCategory('All');void load();return()=>{version.current++;};},[contextKey]);
 const filtered=useMemo(()=>sortGiftProducts(products.filter(product=>(platform==='All'||product.source===platform)&&(category==='All'||giftCategory(product)===category)),sort),[products,platform,category,sort]);
 return <section className="gift-ideas"><div className="gift-banner"><WellnessIllustration id="gift" decorative/><div><h2>Thoughtful gifts for {partnerName}</h2><p>{context.observedDays?`Ideas informed by available check-ins and their available cycle context.`:'A few thoughtful ideas while you get to know their preferences.'} Choose what they would enjoy; a gift is never a treatment.</p></div><button aria-label="Refresh gift ideas" disabled={busy} onClick={()=>void load(true)}><AppIcon name="refresh" size={22}/></button></div><div className="gift-filters"><div className="gift-filter-label"><AppIcon name="shopping_bag" size={20}/><h3>Platform</h3><button onClick={()=>setPlatform('All')}>See all <AppIcon name="arrow_forward" size={17}/></button></div><SegmentedControl label="Gift platform" value={platform} onChange={setPlatform} options={['All','Amazon','Flipkart','Nykaa','Myntra','Blinkit'].map(value=>({value,label:value}))}/><div className="gift-filter-label"><AppIcon name="category" size={20}/><h3>Category</h3><button onClick={()=>setCategory('All')}>See all <AppIcon name="arrow_forward" size={17}/></button></div><SegmentedControl label="Gift category" value={category} onChange={setCategory} options={['All','Jewelry','Fashion','Toys','Comfort','Food','Self-care'].map(value=>({value,label:value}))}/></div><div className="gift-results-toolbar"><span><AppIcon name="grid_view" size={20}/>{busy?'Finding store results…':`${filtered.length} products found`}</span><label className="gift-sort"><span className="sr-only">Sort gifts</span><select aria-label="Sort gifts" value={sort} onChange={event=>setSort(event.target.value)}><option value="relevant">Most relevant</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option></select></label></div>{error?<div className="gift-error" role="alert"><p>{error}</p><button disabled={busy} onClick={()=>void load(true)}>Try again</button></div>:null}<ShoppingGrid products={filtered} loading={busy}/><p className="gift-disclosure">Results and displayed prices come from store search and may change. Confirm price, delivery and availability with the retailer. No sample products or invented counts are shown.</p></section>;
}
