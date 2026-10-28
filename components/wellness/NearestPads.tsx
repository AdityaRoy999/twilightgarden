import React,{lazy,Suspense,useEffect,useRef,useState} from 'react';
import {searchPharmacyArea,getRouteToShop,type RouteGeometry} from '../../lib/wellnessAI';
import {pharmacyDirections,type PharmacyPlace} from '../../lib/places';
import {AppIcon} from '../ui/Icons';
import {WellnessIllustration} from './WellnessIllustration';
const PharmacyMap=lazy(()=>import('./PharmacyMap'));

export function NearestPads() {
 const [places,setPlaces]=useState<PharmacyPlace[]>([]),[origin,setOrigin]=useState<[number,number]|null>(null),[selected,setSelected]=useState<PharmacyPlace|null>(null),[route,setRoute]=useState<RouteGeometry|null>(null);
 const [area,setArea]=useState(''),[busy,setBusy]=useState(false),[searched,setSearched]=useState(false),[error,setError]=useState(''),[routeError,setRouteError]=useState(''),[routing,setRouting]=useState(false);
 const revision=useRef(0),routeRevision=useRef(0),alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;revision.current++;routeRevision.current++;};},[]);
 const search=async(location:[number,number]|null,query?:string)=>{
  const version=++revision.current;routeRevision.current++;setSearched(false);setPlaces([]);setOrigin(location);setBusy(true);setError('');setSelected(null);setRoute(null);setRouting(false);setRouteError('');
  try {const found=await searchPharmacyArea(location?.[0],location?.[1],query);if(!alive.current||version!==revision.current)return;setOrigin(found.origin);setPlaces(found.places);setSearched(true);}catch(e){if(alive.current&&version===revision.current)setError(e instanceof Error?e.message:'Nearby search is unavailable. Please retry.');}finally{if(alive.current&&version===revision.current)setBusy(false);}
 };
 const useLocation=()=>{
  if(!navigator.geolocation){setError('This browser cannot find your location. Search by area below.');return;}
  const version=++revision.current;setBusy(true);setError('');
  navigator.geolocation.getCurrentPosition(position=>{if(alive.current&&version===revision.current)void search([position.coords.latitude,position.coords.longitude]);},failure=>{if(!alive.current||version!==revision.current)return;setBusy(false);setError(failure.code===1?'Location access is off. Enter your area or city below.':'Your location could not be found. Try again or search by area.');},{enableHighAccuracy:false,timeout:12000,maximumAge:120000});
 };
 const select=async(place:PharmacyPlace)=>{
  const version=++routeRevision.current;setSelected(place);setRoute(null);setRouteError('');
  if(!origin)return;
  setRouting(true);
  const result=await getRouteToShop(...origin,place.lat,place.lon);
  if(!alive.current||version!==routeRevision.current)return;
  setRouting(false);setRoute(result);if(!result)setRouteError('Route preview is unavailable. You can still open directions.');
 };
 return <section className="nearest-pads"><header className="nearest-pads-heading"><div><span className="bloom-eyebrow">A little help, nearby</span><h2>Find period supplies</h2><p>Explore pharmacies and medical stores near you.</p></div><WellnessIllustration id="pharmacy" decorative/></header><div className="pharmacy-search"><button className="reference-button" onClick={useLocation} disabled={busy}><AppIcon name="location_on" size={21}/>{busy?'Searching…':'Use my location'}</button><form onSubmit={event=>{event.preventDefault();if(area.trim().length>=2)void search(null,area.trim());}}><label htmlFor="pharmacy-area">Or search an area or city</label><div><input id="pharmacy-area" value={area} onChange={event=>setArea(event.target.value)} placeholder="e.g. Salt Lake, Kolkata" minLength={2} maxLength={120} required autoComplete="address-level2"/><button type="submit" aria-label="Search pharmacies by area" disabled={busy||area.trim().length<2}><AppIcon name="search" size={22}/></button></div></form></div><p className="pharmacy-stock-note"><AppIcon name="info" size={17}/>OpenStreetMap community data. Pad availability isn’t verified. Call the store before travelling.</p>{error?<div className="pharmacy-error" role="alert"><p>{error}</p><button onClick={()=>void search(origin,origin?undefined:area.trim())} disabled={busy||(!origin&&area.trim().length<2)}>Retry search</button></div>:null}{busy?<p role="status" className="pharmacy-status">Finding nearby stores…</p>:null}
 {searched&&!busy&&places.length===0?<div className="pharmacy-empty"><WellnessIllustration id="location" decorative/><h3>No stores found in this search</h3><p>Try a nearby neighborhood or a larger city area.</p><a href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(area||'pharmacy')}`} target="_blank" rel="noreferrer">Search in Maps <AppIcon name="open_in_new" size={17}/></a></div>:null}
 {origin&&!busy&&!error&&<div className="pharmacy-results"><div className="pharmacy-list"><h3>{places.length} nearby {places.length===1?'store':'stores'}</h3>{places.map(place=><article key={place.id} className={selected?.id===place.id?'is-selected':''}><button className="pharmacy-select" onClick={()=>void select(place)} aria-pressed={selected?.id===place.id}><span className="tip-symbol"><AppIcon name="local_pharmacy" size={24}/></span><span><strong>{place.name}</strong><small>{place.address}</small>{place.openingHours?<small>Reported hours: {place.openingHours} (not live)</small>:null}{place.distanceKm!==undefined?<em>{place.distanceKm<1?`${Math.round(place.distanceKm*1000)} m`:`${place.distanceKm.toFixed(1)} km`} away · straight-line estimate</em>:null}</span></button><div className="pharmacy-actions">{place.phoneNumber?<a href={`tel:${place.phoneNumber.replace(/[^+\d]/g,'')}`}><AppIcon name="call" size={17}/>Call</a>:null}<a href={pharmacyDirections(place)} target="_blank" rel="noreferrer"><AppIcon name="route" size={17}/>Walking</a><a href={pharmacyDirections(place,'driving')} target="_blank" rel="noreferrer">Driving <AppIcon name="open_in_new" size={15}/></a></div>{selected?.id===place.id&&origin?<div className="pharmacy-route" aria-live="polite">{routing?'Loading a driving route preview…':route?`${(route.distance/1000).toFixed(1)} km · about ${Math.max(1,Math.round(route.duration/60))} min driving`:routeError}</div>:null}</article>)}</div><div className="pharmacy-map-frame"><Suspense fallback={<p className="pharmacy-status" role="status">Opening the map…</p>}><PharmacyMap places={places} origin={origin} selected={selected} route={route} onSelect={place=>void select(place)}/></Suspense></div></div>}</section>;
}
