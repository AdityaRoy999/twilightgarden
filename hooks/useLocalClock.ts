import {useEffect,useState} from 'react';
export function useLocalClock(){
 const [now,setNow]=useState(()=>new Date());
 useEffect(()=>{const update=()=>{if(document.visibilityState==='visible')setNow(new Date());};const timer=setInterval(update,1000);window.addEventListener('focus',update);document.addEventListener('visibilitychange',update);return()=>{clearInterval(timer);window.removeEventListener('focus',update);document.removeEventListener('visibilitychange',update);};},[]);
 return now;
}
