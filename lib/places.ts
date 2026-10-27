export interface PharmacyPlace { id:string;name:string;lat:number;lon:number;address:string;phoneNumber?:string;distanceKm?:number; }
export function distanceKm(lat1:number,lon1:number,lat2:number,lon2:number) {
 const rad=Math.PI/180, dlat=(lat2-lat1)*rad,dlon=(lon2-lon1)*rad;
 const a=Math.sin(dlat/2)**2+Math.cos(lat1*rad)*Math.cos(lat2*rad)*Math.sin(dlon/2)**2;
 return 6371*2*Math.atan2(Math.sqrt(a),Math.sqrt(Math.max(0,1-a)));
}
export function normalizePharmacies(input:unknown,origin?:[number,number]): PharmacyPlace[] {
 if(!Array.isArray(input))return [];
 const seen=new Set<string>();
 return input.flatMap(row=>{
   if(!row||typeof row!=='object')return [];
   const rawLat=row.latitude??row.lat, rawLon=row.longitude??row.lng??row.lon;
   if(rawLat===undefined||rawLon===undefined||rawLat===null||rawLon===null||rawLat===''||rawLon===''||typeof rawLat==='boolean'||typeof rawLon==='boolean')return [];
   const lat=Number(rawLat),lon=Number(rawLon);
   if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return [];
   const id=String(row.cid||`${lat.toFixed(6)},${lon.toFixed(6)}`);
   if(seen.has(id))return [];seen.add(id);
   const km=origin?distanceKm(...origin,lat,lon):undefined;
   if(km!==undefined&&km>25)return [];
   return [{id,name:typeof row.title==='string'?row.title:'Pharmacy',lat,lon,address:typeof row.address==='string'?row.address:'Address not supplied',phoneNumber:typeof row.phoneNumber==='string'?row.phoneNumber:undefined,distanceKm:km}];
 }).sort((a,b)=>(a.distanceKm??0)-(b.distanceKm??0));
}
export function pharmacyDirections(place:PharmacyPlace,mode:'walking'|'driving'='walking') {
 const url=new URL('https://www.google.com/maps/dir/');url.searchParams.set('api','1');url.searchParams.set('destination',`${place.lat},${place.lon}`);url.searchParams.set('travelmode',mode);return url.toString();
}
