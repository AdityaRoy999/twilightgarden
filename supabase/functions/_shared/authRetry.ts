type AuthResult = {data:{user:{id:string}|null};error?:{status?:number;name?:string}|null};
export class AuthVerificationUnavailable extends Error { constructor(){super('Sign-in verification is temporarily unavailable. Please retry.');this.name='AuthVerificationUnavailable';} }
/** Retry a transient verification failure once, never an invalid credential. */
export async function verifiedUser(lookup:()=>Promise<AuthResult>,pause=()=>new Promise<void>(resolve=>setTimeout(resolve,150))):Promise<string|null> {
 for(let attempt=0;attempt<2;attempt++){
  let result:AuthResult;
  try{result=await lookup();}catch(error){if(attempt===0&&(error instanceof TypeError||(error instanceof Error&&['TimeoutError','AuthRetryableFetchError'].includes(error.name)))){await pause();continue;}throw new AuthVerificationUnavailable();}
  if(!result.error)return result.data.user?.id||null;
  const transient=result.error.name==='AuthRetryableFetchError'||(result.error.status??0)>=500;
  if(!transient)return null;
  if(attempt===0)await pause();else throw new AuthVerificationUnavailable();
 }
 return null;
}
