/** One short retry for a transient provider failure; never an unbounded spinner. */
export async function requestGameCompletion(url:string,init:RequestInit,request:typeof fetch=fetch):Promise<Response>{
 for(let attempt=0;attempt<2;attempt++){
  try{
   const response=await request(url,{...init,signal:AbortSignal.timeout(attempt===0?8500:6500)});
   if(attempt===0 && (response.status===408 || response.status>=500)) {await response.body?.cancel();continue;}
   return response;
  }catch(error){
   const transient=error instanceof TypeError || error instanceof Error&&['TimeoutError','AbortError'].includes(error.name);
   if(attempt===0&&transient)continue;
   throw new Error('AI questions are taking too long. Tap Retry AI questions.');
  }
 }
 throw new Error('AI questions could not be prepared. Please retry.');
}
