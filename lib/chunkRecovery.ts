export function installChunkRecovery(target:Window=window){
 target.addEventListener('vite:preloadError',event=>{
  if(!target.navigator.onLine)return;
  try{
   const key='app-chunk-reload-at',now=Date.now(),previous=Number(target.sessionStorage.getItem(key)||0);
   if(now-previous<60000)return;
   target.sessionStorage.setItem(key,String(now));
   event.preventDefault();target.location.reload();
  }catch{/* Leave the error boundary available when storage or reload is blocked. */}
 });
}
export function isChunkLoadError(message:string){
 return /dynamically imported module|Importing a module script failed|Loading chunk .+ failed/i.test(message);
}
