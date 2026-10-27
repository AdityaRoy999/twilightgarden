import {expect,it} from 'vitest';
import {giftCategory,productPrice,sortGiftProducts} from '../lib/gifts';
const product=(title:string,price?:string)=>({title,price,source:'Amazon' as const,link:'https://example.invalid',image:''});
it('categorizes by whole product words rather than matching ring inside unrelated words',()=>{
 expect(giftCategory(product('Sterling silver ring'))).toBe('Jewelry');expect(giftCategory(product('Comforting spring blanket'))).toBe('Comfort');expect(giftCategory(product('Herbal tea'))).toBe('Food');
});
it('sorts quoted prices without inventing prices for unavailable values or including discounts',()=>{
 expect(productPrice('₹1,299.00')).toBe(1299);expect(productPrice('₹699 (20% off)')).toBe(699);expect(productPrice('Unavailable')).toBeNull();
 const list=[product('A'),product('B','₹700'),product('C','₹100')];expect(sortGiftProducts(list,'low').map(p=>p.title)).toEqual(['C','B','A']);expect(sortGiftProducts(list,'high').map(p=>p.title)).toEqual(['B','C','A']);expect(list[0].title).toBe('A');
});
