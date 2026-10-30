import React,{useEffect,useState} from 'react';
import {Link,useNavigate} from 'react-router-dom';
import {useAuth} from '../../contexts/AuthContext';
import {usePrivacy} from '../../contexts/PrivacyContext';
import {supabase} from '../../lib/supabase';
import {canEnterPrivateApp,PRIVACY_NOTICE_VERSION,type PrivacyPreferences} from '../../lib/privacy';
import {AppIcon} from '../../components/ui/Icons';
import {PreferenceSwitch} from '../../components/ui/PreferenceSwitch';
import {ConfirmAction} from '../../components/ConfirmAction';
import {launchContactsReady} from '../../lib/legalConfig';

const empty:PrivacyPreferences={age_band:'18+',core_consent:false,health_consent:false,share_health:false,ai_consent:false,shopping_consent:false,notice_version:PRIVACY_NOTICE_VERSION};
export default function PrivacyCenter(){
 const {user,signOut}=useAuth(),{preferences,loading,save}=usePrivacy();const navigate=useNavigate();
 const [draft,setDraft]=useState<PrivacyPreferences>(preferences||empty),[ageChosen,setAgeChosen]=useState(!!preferences);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[confirmDelete,setConfirmDelete]=useState(false);
 const [kind,setKind]=useState('access'),[receipt,setReceipt]=useState('');
 const [tickets,setTickets]=useState<{id:string;kind:string;status:string;created_at:string}[]>([]);
 useEffect(()=>{if(preferences){setDraft(preferences);setAgeChosen(true);}},[preferences]);
 useEffect(()=>{if(!user)return;void supabase.from('privacy_requests').select('id,kind,status,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(10).then(({data})=>setTickets(data||[]));},[user?.id,receipt]);
 const commit=async()=>{setBusy(true);setMessage('');try{await save(draft);setMessage('Your choices are saved. Withdrawal stops future use; use Delete account to erase stored account data.');if(canEnterPrivateApp(draft,user?.role))navigate(user?.role==='partner'?'/partner/dashboard':'/dashboard');}catch(e){setMessage(e instanceof Error?e.message:'Please retry.');}finally{setBusy(false);}};
 const submit=async(e:React.FormEvent)=>{e.preventDefault();if(!user)return;setBusy(true);setMessage('');const {data,error}=await supabase.from('privacy_requests').insert({user_id:user.id,kind,description:'Category-only request. No private description submitted.'}).select('id').single();if(error)setMessage('Request could not be recorded. Please retry.');else{setReceipt(data.id);}setBusy(false);};
 const erase=async()=>{setConfirmDelete(false);setBusy(true);setMessage('');try{
  const {data:{session}}=await supabase.auth.getSession();if(!session)throw new Error('Sign in again before deleting your account.');
  const response=await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/privacy-action`,{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`,apikey:import.meta.env.VITE_SUPABASE_ANON_KEY,'Content-Type':'application/json'},body:JSON.stringify({action:'delete-account'}),signal:AbortSignal.timeout(60000)});
  const result=await response.json();if(!response.ok)throw new Error(result.error||'Deletion could not be started.');
  await signOut();navigate('/welcome',{replace:true});
 }catch(e){setMessage(e instanceof Error?e.message:'Please retry.');}finally{setBusy(false);}};
 const choices:[keyof Pick<PrivacyPreferences,'core_consent'|'health_consent'|'share_health'|'ai_consent'|'shopping_consent'>,string,string][]=[
 ['core_consent','Account and private connection','Use your login, profile, connection and game records to run the private app. Read the Terms and Privacy Notice first.'],
 ['health_consent','Health tracking','Store cycle dates, symptoms, moods, sleep, energy and notes in Supabase for tracking and reports. These structured health records are not end-to-end encrypted.'],
 ['share_health','Share health with my linked partner','Let your current linked partner read your health history and cycle estimates. Linking alone does not enable this. Turn this off to stop future access; previously viewed or exported copies cannot be recalled.'],
 ['ai_consent','Optional AI assistance','Send the selected prompt and relevant check-in context to NVIDIA for tips or generate game questions. AI can be wrong; it does not diagnose or provide emergency care. You may use the app without AI.'],
 ['shopping_consent','Optional shopping search','Send product search terms to Serper and open external retailer links. Purchases, prices and availability are handled by those sites. This is separate from health tracking.'],
 ];
 return <main className="privacy-center safe-screen"><header><AppIcon name="verified_user" size={32}/><h1>Privacy & safety</h1><p>Your data, your choices. Notice version {PRIVACY_NOTICE_VERSION}.</p></header>
 {!launchContactsReady&&<aside className="privacy-launch-note">Private testing build. Public operator, service address and grievance-officer details are not configured. Public launch requires these details and an operating support/safety process.</aside>}
 <nav className="privacy-links"><Link to="/privacy">Privacy notice</Link><Link to="/tos">Terms & safety</Link>{user&&<button onClick={()=>void signOut()}>Sign out</button>}</nav>
 {!user?<p><Link to="/login">Sign in</Link> to manage your data and send a request.</p>:<>
 <section><h2>Before you continue</h2><label htmlFor="age-band">Age group</label><select id="age-band" value={ageChosen?draft.age_band:''} disabled={!!preferences||busy} onChange={e=>{setAgeChosen(true);setDraft({...draft,age_band:e.target.value as PrivacyPreferences['age_band']});}}><option value="" disabled>Choose your age group</option><option value="under13">Under 13</option><option value="13-17">13–17</option><option value="18+">18 or older</option></select>
 {ageChosen&&draft.age_band!=='18+'?<p role="status">{draft.age_band==='under13'?'The app is not available to children under 13.':'Teen access to sensitive features is not yet enabled. A verified guardian-permission process must be in place first.'} You can read safety information, request help or delete your account below. An age correction needs review; changing a checkbox is not verification.</p>:<div className="privacy-choices">{choices.map(([key,title,detail])=><div className="privacy-choice" key={key}><div><strong>{title}</strong><p>{detail}</p></div><PreferenceSwitch checked={draft[key]} onChange={()=>setDraft({...draft,[key]:!draft[key]})} label={title}/></div>)}</div>}
 <button className="reference-button" disabled={busy||loading||!ageChosen} onClick={()=>void commit()}>{busy?'Saving…':'Save my choices'}</button>
 <p>Health tracking requires health consent. Optional choices can be withdrawn here at any time. Withdrawal does not erase your history automatically. You can export it in Account or request deletion below.</p></section>
 <section><h2>Requests & safety reports</h2><p>For access, correction (including age review), withdrawal, deletion, a grievance, or a safety concern. Do not upload identity documents, passwords, intimate media or child-abuse material. Only the request category is submitted. Private descriptions and attachments are disabled until an encrypted operator contact is configured.</p>
 <p>Ticket receipt is automatic. Human acknowledgement is targeted within 24 hours and ordinary resolution within 7 days; safety categories need urgent review. The operator’s public contact and staffed escalation process still need setup.</p>
 <form onSubmit={submit}><label htmlFor="request-kind">Request type</label><select id="request-kind" value={kind} onChange={e=>setKind(e.target.value)}>{['access','correction','withdrawal','deletion','grievance','safety','child-safety'].map(x=><option key={x}>{x}</option>)}</select><button className="reference-button secondary" disabled={busy}>Record request</button></form>
 {receipt&&<p role="status">Recorded. Reference: {receipt}. This is a receipt, not confirmation of human review.</p>}
 {tickets.length>0&&<ul>{tickets.map(t=><li key={t.id}>{new Date(t.created_at).toLocaleDateString()} · {t.kind} · {t.status} <small>{t.id}</small></li>)}</ul>}</section>
 <section><h2>Delete account</h2><p>Permanently deletes your login, profile and personal health records, disconnects your partner and resets shared messages, media, games and chat backups for both of you. Your partner’s independent health records stay with them. Sign out and sign in again first; deletion requires a sign-in within the last 10 minutes.</p><button className="privacy-delete" disabled={busy} onClick={()=>setConfirmDelete(true)}>Delete my account and data</button></section>
 {canEnterPrivateApp(preferences,user.role)&&<Link className="reference-button secondary" to={user.role==='partner'?'/partner/dashboard':'/dashboard'}>Return to my space</Link>}
 </>}
 {message&&<p role="status">{message}</p>}
 {confirmDelete&&<ConfirmAction title="Delete your account?" message="This permanently deletes your personal data and resets the shared conversation for both of you. You cannot undo it." confirmLabel="Delete account" onCancel={()=>setConfirmDelete(false)} onConfirm={()=>void erase()}/>}
 </main>;
}
