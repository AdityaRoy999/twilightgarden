import React,{useMemo,useState,useEffect} from 'react';
import {Link} from 'react-router-dom';
import {motion} from 'framer-motion';
import {useCouples} from '../../contexts/CouplesContext';
import {useToday} from '../../hooks/useToday';
import {useGeneratedText} from '../../hooks/useGeneratedText';
import {useAppMotion} from '../../hooks/useAppMotion';
import {springs,motionTransition} from '../../lib/motion';
import {calculateCyclePhase} from '../../lib/cycleUtils';
import {buildWellnessContext} from '../../lib/wellnessContext';
import {generateEmpathyAlerts} from '../../lib/wellnessAI';
import {ReferenceHeading} from '../../components/ui/ReferenceArt';
import {SegmentedControl} from '../../components/ui/SegmentedControl';
import {AppIcon} from '../../components/ui/Icons';
import {GuidancePending} from '../../components/wellness/GuidancePending';
import {IllustratedGuide} from '../../components/wellness/IllustratedGuide';
import {GiftIdeas} from '../../components/wellness/GiftIdeas';
import {NearestPads} from '../../components/wellness/NearestPads';
import NotificationBell from '../../components/NotificationBell';

type Tab='care'|'gifts'|'shops';
export default function PartnerWellness(){
 const {couple,partnerProfile,partnerSettings,partnerLogs}=useCouples();const today=useToday();const {reduced}=useAppMotion();
 const [active,setActive]=useState<Tab>('care');
 const cycle=useMemo(()=>partnerSettings?.lastPeriodStart?calculateCyclePhase(today,partnerSettings,partnerLogs):null,[today,partnerSettings,partnerLogs]);
 const name=partnerProfile?.full_name||'your partner';
 const context=useMemo(()=>buildWellnessContext({phase:cycle?.phase||'Unknown',cycleDay:cycle?.currentDay||0,logs:partnerLogs||[],today,partnerName:name}),[cycle,partnerLogs,today,name]);
 const guide=useGeneratedText({care:(refresh)=>generateEmpathyAlerts(context,refresh)},JSON.stringify([partnerProfile?.id,couple?.id,context]));
 useEffect(()=>{if(couple?.status==='active'&&partnerProfile&&active==='care')void guide.request('care');},[active,guide.request,couple?.status,partnerProfile?.id]);
 if(couple?.status!=='active')return <div className="reference-page"><ReferenceHeading title="Wellness" description="Connect with your partner to explore their shared care guide."/><Link className="reference-button" to="/partner/dashboard">Connect with your partner</Link></div>;
 const entry=guide.entries.care;
 return <div className="reference-page reference-wellness partner-care-page"><header className="gift-profile bloom-card"><span className="bloom-avatar">{partnerProfile?.avatar_url?<img src={partnerProfile.avatar_url} alt=""/>:<AppIcon name="person" size={32}/>}</span><div><h1>{name}</h1><p>{cycle&&cycle.currentDay>0?`${cycle.phase} phase · Day ${cycle.currentDay}`:'A little care, at their pace'}</p></div><NotificationBell/></header><SegmentedControl<Tab> label="Partner wellness sections" value={active} onChange={setActive} options={[{value:'care',label:'Care Guide',icon:'favorite'},{value:'gifts',label:'Gift Ideas',icon:'redeem'},{value:'shops',label:'Nearest Pad',icon:'location_on'}]}/><motion.div key={active} initial={reduced?false:{y:8}} animate={{y:0}} transition={motionTransition(springs.section,reduced)}>{active==='gifts'?<GiftIdeas context={context} partnerName={name}/>:active==='shops'?<NearestPads/>:<><Link className="care-exercise-link" to="/partner/exercise"><AppIcon name="accessibility_new" size={22}/>Explore gentle movement together <AppIcon name="arrow_forward" size={19}/></Link>{!entry||entry.status==='loading'&&!entry.text?<GuidancePending partner/>:entry.error?<div className="gift-error" role="alert"><p>{entry.error}</p><button onClick={()=>void guide.request('care',true)}>Retry guide</button></div>:<IllustratedGuide text={entry.text} partner onRefresh={()=>void guide.request('care',true)} busy={entry.status==='loading'}/>}</>}</motion.div></div>;
}
