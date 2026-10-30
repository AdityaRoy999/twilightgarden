import React from 'react';
import {useLocation} from 'react-router-dom';
import {useAuth} from '../contexts/AuthContext';
import {usePrivacy} from '../contexts/PrivacyContext';
import {canEnterPrivateApp} from '../lib/privacy';
import PrivacyCenter from '../pages/legal/PrivacyCenter';
import PrivacyPolicy from '../pages/legal/PrivacyPolicy';
import TOS from '../pages/legal/TOS';
const ForgotPassword = React.lazy(() => import('../pages/ForgotPassword'));

export function PrivacyBoundary({children}:{children:React.ReactNode}){
 const {user,loading:authLoading,recoveringPassword}=useAuth(),{preferences,loading,error,refresh}=usePrivacy();
 const {pathname}=useLocation();
 if(recoveringPassword || /\/(?:reset-password|forgot-password)$/.test(pathname))return <React.Suspense fallback={<main className="privacy-center" role="status">Opening account recovery…</main>}><ForgotPassword/></React.Suspense>;
 if(pathname==='/privacy')return <PrivacyPolicy/>;
 if(pathname==='/tos')return <TOS/>;
 if(pathname==='/privacy-controls')return <PrivacyCenter/>;
 if(user && !authLoading){
  if(loading)return <main className="privacy-center" role="status">Checking your privacy choices…</main>;
  if(error)return <main className="privacy-center"><p role="alert">{error}</p><button className="reference-button" onClick={()=>void refresh()}>Retry</button></main>;
  if(!canEnterPrivateApp(preferences,user.role))return <PrivacyCenter/>;
 }
 return <React.Fragment key={JSON.stringify(preferences)}>{children}</React.Fragment>;
}
