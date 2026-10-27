type AuthCallbackClient={exchangeCodeForSession:(code:string)=>Promise<{error:unknown}>;setSession:(tokens:{access_token:string;refresh_token:string})=>Promise<{error:unknown}>};
/** Never log callback URLs: both PKCE codes and legacy tokens are credentials. */
export async function completeNativeAuth(url:string,auth:AuthCallbackClient){
 const parsed=new URL(url);
 if(!['com.twilight.garden:','twilight-garden:'].includes(parsed.protocol))return false;
 const hash=new URLSearchParams(parsed.hash.slice(1));
 const error=parsed.searchParams.get('error_description')||hash.get('error_description');
 if(error)throw new Error('Sign-in was not completed. Please retry.');
 const code=parsed.searchParams.get('code')||hash.get('code');
 if(code){const result=await auth.exchangeCodeForSession(code);if(result.error)throw new Error('Could not finish sign-in. Please retry.');return true;}
 const access_token=hash.get('access_token')||parsed.searchParams.get('access_token');
 const refresh_token=hash.get('refresh_token')||parsed.searchParams.get('refresh_token');
 if(access_token&&refresh_token){const result=await auth.setSession({access_token,refresh_token});if(result.error)throw new Error('Could not finish sign-in. Please retry.');return true;}
 return false;
}
