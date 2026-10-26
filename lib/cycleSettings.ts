import {localDateKey,parseDateKey} from './dates';
import type {CycleSettings} from '../types';

export function validateCycleSettings(settings:CycleSettings,today=localDateKey(),requireStart=false):void{
 if(!Number.isInteger(settings.avgCycleLength)||settings.avgCycleLength<20||settings.avgCycleLength>90||
    !Number.isInteger(settings.avgPeriodLength)||settings.avgPeriodLength<1||settings.avgPeriodLength>20||settings.avgPeriodLength>=settings.avgCycleLength){
  throw new Error('Choose valid cycle and period lengths.');
 }
 if(requireStart&&!settings.lastPeriodStart)throw new Error('Choose the date your last period started.');
 if(settings.lastPeriodStart){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(settings.lastPeriodStart)||Number.isNaN(parseDateKey(settings.lastPeriodStart).getTime()))throw new Error('Choose a valid period start date.');
  if(settings.lastPeriodStart>today)throw new Error('Choose a period start date that is today or earlier.');
 }
}

export function cycleSettingsSaveError(error:unknown):Error{
 if(error instanceof Error)return error;
 const failure=error as {code?:string;message?:string}|null;
 if(failure?.message==='Invalid cycle settings')return new Error('Check your cycle lengths and choose a period start date that is today or earlier.');
 if(failure?.code==='42501'||failure?.code==='PGRST301')return new Error('Your settings could not be authorized. Please sign in again and retry.');
 return new Error('Could not save your settings. Check your connection and retry.');
}
