import {expect,it} from 'vitest';
import {cycleRingModel} from '../lib/cycleRing';
it('puts local noon on day two halfway between the day two and day three marks',()=>{
 const noon=new Date(2026,9,27,12,0,0);const model=cycleRingModel(2,28,5,noon);
 expect(model.progress).toBeCloseTo(1.5/28);expect(model.angle).toBeCloseTo((model.dayMarks[1]+model.dayMarks[2])/2);expect(model.dayMarks).toHaveLength(5);
 expect(cycleRingModel(2,28,5,new Date(2026,9,27,0,0,0)).angle).toBeCloseTo(model.dayMarks[1]);
});
it('uses saved period length and shares the cycle model’s ovulation calculation',()=>{
 const model=cycleRingModel(12,32,7,new Date(2026,9,27,6));
 expect(model.dayMarks).toHaveLength(7);expect(model.periodPercent).toBeCloseTo(7/32*100);
 expect(model.ovulationStartPercent).toBeCloseTo(17/32*100);expect(model.lutealStartPercent).toBeCloseTo(18/32*100);
});
it('does not wrap an overdue marker around to a new cycle',()=>{
 const model=cycleRingModel(37,28,5,new Date(2026,9,27,12));expect(model.overdue).toBe(true);expect(model.progress).toBe(1);
});
