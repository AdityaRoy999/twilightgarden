import type {Product} from './wellnessAI';
export function giftCategory(product:Product){
 const text=product.title.toLowerCase();
 if(/necklace|earring|jhumka|jewel|pendant|bangle|bracelet|\bring\b/.test(text))return 'Jewelry';
 if(/dress|kurta|kurti|shirt|trouser|skirt|apparel|saree|pajama/.test(text))return 'Fashion';
 if(/toy|teddy|plush|puzzle|board game/.test(text))return 'Toys';
 if(/chocolate|snack|fruit|tea|coffee|nuts|cookie/.test(text))return 'Food';
 if(/mask|skincare|skin care|bath|serum|lotion|beauty/.test(text))return 'Self-care';
 return 'Comfort';
}
export function productPrice(price?:string){
 if(!price)return null;const value=Number((price.match(/[\d][\d,]*(?:\.\d{1,2})?/)?.[0]||'').replaceAll(',',''));return Number.isFinite(value)&&value>0?value:null;
}
export function sortGiftProducts(products:Product[],sort:string){
 if(!['low','high'].includes(sort))return products;
 return [...products].sort((a,b)=>{const left=productPrice(a.price),right=productPrice(b.price);return left===null?right===null?0:1:right===null?-1:sort==='low'?left-right:right-left;});
}
