import {SecurePreferences} from './securePreferences';
// Supabase credentials use the same protected device storage as encryption keys.
export const CapacitorStorage={
 async getItem(key:string){return (await SecurePreferences.get({key})).value;},
 async setItem(key:string,value:string){await SecurePreferences.set({key,value});},
 async removeItem(key:string){await SecurePreferences.remove({key});}
};
