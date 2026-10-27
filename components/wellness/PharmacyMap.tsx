import React,{useEffect} from 'react';
import {MapContainer,TileLayer,Marker,Popup,Polyline,useMap} from 'react-leaflet';
import {pharmacyIcon,userIcon} from '../../lib/mapIcons';
import {pharmacyDirections,type PharmacyPlace} from '../../lib/places';
import type {RouteGeometry} from '../../lib/wellnessAI';
import {useTheme} from '../../contexts/ThemeContext';
function Viewport({places,origin,selected}: {places:PharmacyPlace[];origin:[number,number]|null;selected:PharmacyPlace|null}) {
 const map=useMap();
 useEffect(()=>{const observer=new ResizeObserver(()=>map.invalidateSize({animate:false}));observer.observe(map.getContainer());return()=>observer.disconnect();},[map]);
 useEffect(()=>{map.invalidateSize();if(selected)map.setView([selected.lat,selected.lon],15,{animate:false});else {const points:[number,number][]=places.map(place=>[place.lat,place.lon]);if(origin)points.push(origin);if(points.length)map.fitBounds(points,{padding:[25,25],maxZoom:15,animate:false});}},[map,places,origin,selected]);return null;
}
export default function PharmacyMap({places,origin,selected,route,onSelect}: {places:PharmacyPlace[];origin:[number,number]|null;selected:PharmacyPlace|null;route:RouteGeometry|null;onSelect:(place:PharmacyPlace)=>void}) {
 const center: [number,number]=origin||(places[0]?[places[0].lat,places[0].lon]:[22.5726,88.3639]);
 const {theme}=useTheme();
 return <MapContainer center={center} zoom={14} className="pharmacy-map" scrollWheelZoom={false}><TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" className={theme==='dark'?'map-tiles-dark':''}/>{origin?<Marker position={origin} icon={userIcon}><Popup>Your approximate location</Popup></Marker>:null}{places.map(place=><Marker key={place.id} position={[place.lat,place.lon]} icon={pharmacyIcon} eventHandlers={{click:()=>onSelect(place)}}><Popup><strong>{place.name}</strong><p>{place.address}</p><a href={pharmacyDirections(place)} target="_blank" rel="noreferrer">Walking directions</a></Popup></Marker>)}{route?<Polyline positions={route.coordinates.map(([lon,lat])=>[lat,lon])} color="#c33367" weight={4}/>:null}<Viewport places={places} origin={origin} selected={selected}/></MapContainer>;
}
