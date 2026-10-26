import {describe,expect,it} from 'vitest';
import {validateCycleSettings,cycleSettingsSaveError} from '../lib/cycleSettings';
const settings={avgCycleLength:28,avgPeriodLength:5,lastPeriodStart:'2026-10-26',onboardingCompleted:true,irregularCycle:false};
describe('cycle settings save validation',()=>{
 it('accepts today and recorded past dates',()=>{expect(()=>validateCycleSettings(settings,'2026-10-26')).not.toThrow();expect(()=>validateCycleSettings({...settings,lastPeriodStart:'2026-10-01'},'2026-10-26')).not.toThrow();});
 it('rejects future dates before a network request',()=>{expect(()=>validateCycleSettings({...settings,lastPeriodStart:'2026-10-28'},'2026-10-26')).toThrow('today or earlier');});
 it('rejects impossible dates and requires a date for onboarding without blocking later no-start settings edits',()=>{expect(()=>validateCycleSettings({...settings,lastPeriodStart:'2026-02-30'},'2026-10-26')).toThrow('valid period start date');expect(()=>validateCycleSettings({...settings,lastPeriodStart:''},'2026-10-26',true)).toThrow('last period started');expect(()=>validateCycleSettings({...settings,lastPeriodStart:'',irregularCycle:true},'2026-10-26')).not.toThrow();});
 it('explains a PostgREST validation object rather than hiding it behind a generic retry',()=>{expect(cycleSettingsSaveError({code:'P0001',message:'Invalid cycle settings'}).message).toContain('today or earlier');});
 it('retains readable local validation and safely handles unknown server failures',()=>{const local=new Error('Choose valid cycle and period lengths.');expect(cycleSettingsSaveError(local)).toBe(local);expect(cycleSettingsSaveError({message:'private database details'}).message).not.toContain('private database details');});
});
