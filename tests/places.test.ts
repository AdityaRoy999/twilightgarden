import {expect,it} from 'vitest';
import {normalizePharmacies,distanceKm,pharmacyDirections} from '../lib/places';
it('validates coordinates, removes duplicates, filters far-away stores and orders by distance',()=>{
 const result=normalizePharmacies([
  {cid:'near',title:'Near',latitude:22.573,longitude:88.364},
  {cid:'farther',title:'Farther',latitude:'22.58',longitude:'88.38'},
  {cid:'near',title:'Duplicate',latitude:22.573,longitude:88.364},
  {cid:'invalid',latitude:null,longitude:null},
  {cid:'missing'},{latitude:'bad',longitude:90},{latitude:94,longitude:1},
  {title:'Wrong city',latitude:28.6,longitude:77.2},
 ],[22.5726,88.3639]);
 expect(result.map(place=>place.id)).toEqual(['near','farther']);expect(result[0].distanceKm).toBeLessThan(1);
});
it('keeps valid manual-area results without fabricating a current location or distance',()=>{
 const result=normalizePharmacies([{title:'Medical Store',latitude:22.6,longitude:88.4}]);
 expect(result[0].distanceKm).toBeUndefined();expect(result[0].id).toBe('22.600000,88.400000');
 expect(distanceKm(0,0,0,0)).toBe(0);
});
it('builds explicit walking and driving directions using validated coordinates',()=>{
 const place={id:'1',name:'Store',lat:22.6,lon:88.4,address:'Local'};
 const walking=new URL(pharmacyDirections(place));expect(walking.searchParams.get('api')).toBe('1');expect(walking.searchParams.get('travelmode')).toBe('walking');expect(walking.searchParams.get('destination')).toBe('22.6,88.4');
 expect(new URL(pharmacyDirections(place,'driving')).searchParams.get('travelmode')).toBe('driving');
});
